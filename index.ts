//import { SERVER_PORT } from "./global/environment";
import Server from './classes/server';
import bodyParser from 'body-parser';
import cors from 'cors';
import path from 'path';
import express from 'express';
import mongoose from 'mongoose';

// ROUTES
import publicRoutes from './routes/public.routes';
import ticketRoutes from './routes/ticket.routes';
import companyRoutes from './routes/company.routes';
import userRoutes from './routes/user.routes';
import skillRoutes from './routes/skill.routes';
import desktopRoutes from './routes/desktop.routes';
import assistantRoutes from './routes/assistant.routes';
import notificationRoutes from './routes/notification.routes';
import indicatorRoutes from './routes/indicator.routes';
import metricRoutes from './routes/metric.routes';
import superuserRoutes from './routes/superuser.routes';




import environment from './global/environment';


// SINGLETON
// const server = new Server();
const server = Server.instance; // obtenemos una nueva instancia de forma estática

// force ssl
server.app.use(function (req, res, next) {
    let hostname = req.headers?.host?.split(':')[0] // localhost
	
	if(req.protocol === 'http' && hostname !== 'localhost') {
        res.redirect('https://' + req.headers.host + req.url);
    } else {
		next()
	}
});

const publicPath = path.resolve(__dirname, '../public');
server.app.use(express.static(publicPath));

// Lo que reciba por el body, lo toma y lo convierte en un objeto de JavaScript
server.app.use(bodyParser.urlencoded({ extended: true }));
server.app.use(bodyParser.json());

// CORS
server.app.use(cors({ origin: true, credentials: true })); // permito que cualquier persona puede llamar mis servicios.

// RUTAS
server.app.use('/t', ticketRoutes);
server.app.use('/p', publicRoutes);
server.app.use('/c', companyRoutes);
server.app.use('/u', userRoutes);
server.app.use('/s', skillRoutes);
server.app.use('/d', desktopRoutes);
server.app.use('/a', assistantRoutes);
server.app.use('/n', notificationRoutes);
server.app.use('/m', metricRoutes);
server.app.use('/i', indicatorRoutes);
server.app.use('/su', superuserRoutes);


server.start(() => {
	console.log(`Servidor corriendo en el puerto ${server.port}`); // ES lo mismo que que ${ SERVER_PORT }
});

// MONGO DB
mongoose.connect(environment.DB_CONN_STR, {
		useNewUrlParser: true,
		useCreateIndex: true,
		useUnifiedTopology: true,
		useFindAndModify: false
	})
	.then(() => {
		console.log('MongoDB corriendo en el puerto 27017: \x1b[32m%s\x1b[0m', 'ONLINE');
	})
	.catch((err) => {
		throw err;
	}); 

