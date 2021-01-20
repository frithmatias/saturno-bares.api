process.env["NTBA_FIX_319"] = '1'; //node-telegram-bot-api: Automatic enabling of cancellation of promises
import express from 'express';
import socketIO from 'socket.io';
import http from 'http';
import https from 'https';
import fs from 'fs';

import * as socket from '../sockets/sockets';

import environment from '../global/environment.prod';
import TelegramBot from 'node-telegram-bot-api';
import { Ticket } from '../models/ticket.model';

const options = {
	key: fs.readFileSync('ssl/private.key'),
	cert: fs.readFileSync('ssl/certificate.crt')
};

export default class Server {

	private static _instance: Server;
	public app: express.Application;
	public port: number;
	public io: socketIO.Server;
	// private httpServer: http.Server;
	private httpsServer: https.Server;
	private telegramBot: TelegramBot;

	private constructor() {
		this.app = express();
		this.port = environment.SERVER_PORT;
		// this.httpServer = new http.Server(this.app);
		this.httpsServer = new https.Server(options, this.app)
		// this.io = socketIO(this.httpServer);
		this.io = socketIO(this.httpsServer);
		this.escucharSockets(); // socket.io

		this.telegramBot = new TelegramBot(environment.TOKEN_TELEGRAM, { polling: true });
		this.escucharTelegram(); // telegram



	}

	public static get instance() {
		return this._instance || (this._instance = new this());
	}

	private escucharSockets() {
		console.log('Escuchando conexiones de sockets en el puerto ', this.port);
		this.io.on('connection', (cliente) => {
			socket.escucharMensajes(cliente, this.io);
		});
	}

	private escucharTelegram() {
		this.telegramBot.on('message', (msg) => {
			console.log(msg)
			const chatId = msg.chat.id;
			this.telegramBot.sendMessage(chatId, 'Mensaje recibido');
		});

		this.telegramBot.onText(/\/echo (.+)/, (msg, match) => {
			const chatId = msg.chat.id;
			const resp = match !== null ? match[1] : '';
			this.telegramBot.sendMessage(chatId, resp);
		});

		this.telegramBot.onText(/\/start (.+)/, async (msg, match) => {
			const idUser = msg.chat.id.toString();
			const firstName = msg.chat.first_name;
			const idTicket = match !== null ? match[1] : '';
			
			let response: string = '';

			await Ticket.findByIdAndUpdate(idTicket, { tx_status: 'scheduled', tx_platform: 'telegram', id_user: idUser }, {new: true})
				.populate('id_company')
				.then((ticketDB: any) => {
					

					console.log(ticketDB)
					if (!ticketDB) {
						return response = 'No existe el ticket o el ticket fué cancelado.'
					}

					const idTable = ticketDB.cd_tables[0];
					const txCompanyName = ticketDB.id_company.tx_company_name;
					const txCompanyAddressStreet = ticketDB.id_company.tx_address_street;
					const txCompanyAddressNumber = ticketDB.id_company.tx_address_number;
					const txCompanyLocation = ticketDB.id_company.tx_company_location;
					const dtDate = new Date(ticketDB.tm_reserve);
					const dtYear = dtDate.getFullYear();
					const months = ['Enero', 'Febrero', 'Marzo', 'Arbil', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
					const dtMonth = months[dtDate.getMonth()];
					const dtDay = dtDate.getDate();


					const idCompany = ticketDB.id_company._id;
					ticketDB.id_company = null; // el formulario de ticket del comercio requiere del ticket sin popular id_company
					ticketDB.id_company = idCompany;
					console.log(ticketDB)
					Server.instance.io.to(ticketDB.id_socket_client).emit('update-private', ticketDB);


					return response = `
				Hola ${firstName}, tu reserva para la mesa ${idTable} quedó confirmada.  

				Te esperamos el ${dtDay} de ${dtMonth} de ${dtYear} a las ${dtDate.getHours()}:00hs en ${txCompanyName}, ${txCompanyAddressStreet} ${txCompanyAddressNumber}, ${txCompanyLocation}
				
				Recordá que tenés 30 minutos extra si no llegas antes de las ${dtDate.getHours()}:30hs tu turno quedará finalizado.

				Para ver tus tickets visitá este link:
				https://192.168.1.3:4200/public/tickets/telegram/${idUser}
				`;
				
				}).catch(() => {
					response = 'Error al confirmar el ticket o el ticket fué cancelado.'
				})
			this.telegramBot.sendMessage(idUser, response);
		});


		this.telegramBot.onText(/\/commands/, (msg) => {
			console.log(msg)
			this.telegramBot.getMyCommands().then(function (info) {
				console.log(info)
			});
		})
	}

	start(callback: Function) {
		// this.app.listen( this.port, callback );
		// this.httpServer.listen(this.port);
		this.httpsServer.listen(this.port);
	}
}
