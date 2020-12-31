import express from 'express';
import socketIO from 'socket.io';
import http from 'http';
import https from 'https';
import fs from 'fs';
import * as socket from '../sockets/sockets';
import environment from '../global/environment.prod';


const options = {
	key: fs.readFileSync('ssl/private.key'),
	cert: fs.readFileSync('ssl/certificate.crt')
};

export default class Server {

	private static _instance: Server;
	public app: express.Application;
	public port: number;
	public io: socketIO.Server;
	private httpServer: http.Server;
	private httpsServer: https.Server;

	private constructor() {
		this.app = express();
		this.port = environment.SERVER_PORT;
		this.app.enable('trust proxy');
		this.httpServer = new http.Server(this.app);
		this.httpsServer = new https.Server(options, this.app)
		http.Server
		//this.io = socketIO(this.httpServer);
		this.io = socketIO(this.httpsServer);

		this.escucharSockets();
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

	start(callback: Function) {
		// this.app.listen( this.port, callback );
		this.httpsServer.listen(this.port);
	}
}
