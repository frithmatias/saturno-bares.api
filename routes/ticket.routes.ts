import { Router } from 'express';

// MIDDLEWARES
import  mdAuth  from '../middlewares/auth';

// CONTROLLER
import  ticketController from '../controllers/ticket.controller';

// ROUTES 
const ticketRoutes = Router();

// public requests
ticketRoutes.post('/createticket', ticketController.createTicket);
ticketRoutes.get('/readtickets/:idCompany', ticketController.readTickets);
ticketRoutes.get('/callwaiter/:idTicket', ticketController.callWaiter);
ticketRoutes.put('/actualizarsocket', ticketController.updateSocket);


// waiter actions
ticketRoutes.post('/endticket', ticketController.endTicket);
ticketRoutes.post('/releaseticket', mdAuth.verificaToken, ticketController.releaseTicket);
ticketRoutes.post('/reassignticket', mdAuth.verificaToken, ticketController.reassignTicket);
ticketRoutes.post('/attendedticket', mdAuth.verificaToken, ticketController.attendedTicket);


export default ticketRoutes;