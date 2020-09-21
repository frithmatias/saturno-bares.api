import { Socket } from 'socket.io';
import socketIO from 'socket.io';

// Borrar marcador
export const escucharMensajes = (cliente: Socket, io: socketIO.Server) => {
	cliente.on('enterCompany', (idCompany) => {
		cliente.join(idCompany);
		console.log(cliente.id, 'entrando a la sala ', idCompany);
	})
	// Orden enviada por el cliente.
	cliente.on('cliente-en-camino', (idSocketDesk) => {
		io.to(idSocketDesk).emit('cliente-en-camino');
	});

	cliente.on('mensaje-publico', (payload: { de: string, cuerpo: string }) => {
		io.emit('mensaje-publico', payload);
	});
	
	cliente.on('mensaje-privado', (payload: { to: string, msg: string }) => {
		io.to(payload.to).emit('mensaje-privado', payload);
	});
};

