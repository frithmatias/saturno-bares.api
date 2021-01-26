process.env["NTBA_FIX_319"] = '1'; //node-telegram-bot-api: Automatic enabling of cancellation of promises
import environment from '../global/environment.prod';

import express from 'express';
import socketIO from 'socket.io';
import http from 'http';
import https from 'https';
import fs from 'fs';

import TelegramBot from 'node-telegram-bot-api';

// listeners
import * as socket from '../sockets/sockets';
import * as telegram from '../sockets/telegram';

const options = {
	key: fs.readFileSync('./ssl/private.key'),
	cert: fs.readFileSync('./ssl/certificate.crt')
};

export default class Server {

	private static _instance: Server;
	public app: express.Application;
	public port: number;
	public io: socketIO.Server;
	//private httpServer: http.Server;
	private httpsServer: https.Server;
	// private telegramBot: TelegramBot;
	
	private constructor() {
		this.app = express();
		this.port = environment.SERVER_PORT;
		
		// this.httpServer = new http.Server(this.app);
		this.httpsServer = new https.Server(options, this.app)

		// WEB SOCKETS
		// this.io = socketIO(this.httpServer);
		this.io = socketIO(this.httpsServer);
		this.escucharSockets(); // socket.io

		// TELEGRAM
		//this.telegramBot = new TelegramBot(environment.TOKEN_TELEGRAM, { polling: true });
		this.escucharTelegram(); // telegram
	}

	public static get instance() {
		return this._instance || (this._instance = new this());
	}

	private escucharSockets() {
		
		console.log('System: Escuchando conexiones de sockets en el puerto ', this.port);
		this.io.on('connection', (cliente) => {
			socket.escucharMensajes(cliente, this.io);
		});
	}

	private escucharTelegram() {
		// telegram.escucharTelegram(this.telegramBot);
	}

	start(callback: Function) {
		// this.app.listen( this.port, callback );
		// this.httpServer.listen(this.port);
		this.httpsServer.listen(this.port);
	} 
}
