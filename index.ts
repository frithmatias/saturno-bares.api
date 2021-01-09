//import { SERVER_PORT } from "./global/environment";
import Server from './classes/server';
import bodyParser from 'body-parser';
import fileUpload from 'express-fileupload';
import cors from 'cors';
import path from 'path';
import express from 'express';
import mongoose from 'mongoose';
import compression from 'compression';

// ROUTES
import publicRoutes from './routes/public.routes';
import ticketRoutes from './routes/ticket.routes';
import superuserRoutes from './routes/superuser.routes';
import userRoutes from './routes/user.routes';
import companyRoutes from './routes/company.routes';
import sectionRoutes from './routes/section.routes';
import waiterRoutes from './routes/waiter.routes';
import tableRoutes from './routes/table.routes';
import scoreItemRoutes from './routes/scoreitem.routes';
import notificationRoutes from './routes/notification.routes';
import indicatorRoutes from './routes/indicator.routes';
import metricRoutes from './routes/metric.routes';
import uploadRoutes from './routes/upload.routes';
import imageRoutes from './routes/image.routes';
import settingsRoutes from './routes/settings.routes';


import environment from './global/environment.prod';


// SINGLETON
// const server = new Server();
const server = Server.instance; // obtenemos una nueva instancia de forma estática

// force ssl for api
// server.app.use(function (req, res, next) {
//     let hostname = req.headers?.host?.split(':')[0] // localhost
// 	if(req.protocol === 'http' && hostname !== 'localhost') {
//         res.redirect('https://' + req.headers.host + req.url);
//     } else {
// 		next()
// 	}
// });

const publicPath = path.resolve(__dirname, '../public');
server.app.use(express.static(publicPath));

// Lo que reciba por el body, lo toma y lo convierte en un objeto de JavaScript
server.app.use(bodyParser.urlencoded({ extended: true }));
server.app.use(bodyParser.json());


// express-fileupload
server.app.use(fileUpload());

// CORS
server.app.use(cors({ origin: true, credentials: true })); // permito que cualquier persona puede llamar mis servicios.


// compress all responses
//server.app.use(compression());


server.app.get('/test', (req, res) => {
	const animal = 'alligator';
	// Send a text/html file back with the word 'alligator' repeated 1000 times
	res.send(animal.repeat(100000));
})
server.app.use('/t', ticketRoutes);
server.app.use('/p', publicRoutes);
server.app.use('/superuser', superuserRoutes);
server.app.use('/u', userRoutes);
server.app.use('/c', companyRoutes);
server.app.use('/section', sectionRoutes);
server.app.use('/w', waiterRoutes);
server.app.use('/table', tableRoutes);
server.app.use('/n', notificationRoutes);
server.app.use('/metrics', metricRoutes);
server.app.use('/i', indicatorRoutes);
server.app.use('/scoreitem', scoreItemRoutes);
server.app.use('/uploads', uploadRoutes);
server.app.use('/image', imageRoutes);
server.app.use('/settings', settingsRoutes);


server.start(() => {
	console.log(`Servidor corriendo en el puerto ${server.port}`); // ES lo mismo que que ${ SERVER_PORT }
});

// MONGO DB
mongoose.connect(environment.MONGO_DB, {
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

