import express from 'express';
import socketIO from 'socket.io';
import http from 'http'; // express levanta un servidor http, por eso es que son compatibles.
import * as socket from '../sockets/sockets';
import environment from '../global/environment';

export default class Server {
	
	private static _instance: Server; // private, no se debería poder llamar desde afuera a la instancia directamente
	public app: express.Application;
	public port: number;
	public io: socketIO.Server;
	// SocketIO recibe la conf del server corriendo la app de express, como no son compatibles uso httpServer.
	private httpServer: http.Server; 

	private constructor() {
		this.app = express();
		this.port = environment.SERVER_PORT;
		this.app.enable('trust proxy'); // sin esta configuracion req.protocol detecta siempre http
		// le enviamos la confiugarccion de la app de express.
		this.httpServer = new http.Server(this.app);
		// this.io = socketIO( this.app ); // no puedo usar el server http de express directamente uso httpServer
		this.io = socketIO(this.httpServer);
		this.escucharSockets();
	}

	public static get instance() {
		// retorna si existe una instancia, sino la crea.
		return this._instance || (this._instance = new this()); 
	}

	// levantmos el server
	private escucharSockets() {
		// privado porque se llama sólo desde la inicialización de la clase
		console.log('Escuchando conexiones de sockets en el puerto ', this.port);

		// Emisión de eventos
		this.io.on('connection', (cliente) => {
			console.log('Cliente conectado', cliente.id);
			// cliente.to(cliente.id).emit('adjuntar-sesion-ticket', cliente.id);
			socket.escucharMensajes(cliente, this.io);
		});
	}

	start(callback: Function) {
		// this.app.listen( this.port, callback );
		this.httpServer.listen(this.port);
	}
}
