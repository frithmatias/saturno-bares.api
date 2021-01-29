import { Router } from 'express';

// MIDDLEWARES
import  mdAuth  from '../middlewares/auth';

// CONTROLLER
import  ticketController from '../controllers/ticket.controller';

// ROUTES 
const ticketRoutes = Router();

// public routes
ticketRoutes.post('/readavailability', ticketController.readAvailability);
ticketRoutes.post('/createticket', ticketController.createTicket);
ticketRoutes.get('/readusertickets/:txPlatform/:idUser', ticketController.readUserTickets);
ticketRoutes.get('/readtickets/:idCompany', ticketController.readTickets);
ticketRoutes.get('/readticket/:idTicket', ticketController.readTicket);
ticketRoutes.post('/callwaiter', ticketController.callWaiter);
ticketRoutes.put('/actualizarsocket', ticketController.updateSocket);
ticketRoutes.post('/validateticketgoogle', ticketController.validateTicketGoogle);
ticketRoutes.post('/endticket', ticketController.endTicket);

// waiter routes
ticketRoutes.post('/releaseticket', mdAuth.verificaToken, ticketController.releaseTicket);
ticketRoutes.post('/attendedticket', mdAuth.verificaToken, ticketController.attendedTicket);

// admin routes
ticketRoutes.post('/readpending', mdAuth.verificaToken, ticketController.readPending);

export default ticketRoutes;