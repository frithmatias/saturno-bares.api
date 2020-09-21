import { Router } from 'express';

// MIDDLEWARES
import  mdAuth  from '../middlewares/auth';

// CONTROLLER
import  ticketController from '../controllers/ticket.controller';

// ROUTES 
const ticketRoutes = Router();

// public requests
ticketRoutes.post('/createticket', ticketController.createTicket);
ticketRoutes.get('/cancelticket/:idTicket', ticketController.cancelTicket);

ticketRoutes.get('/gettickets/:id_company', ticketController.getTickets);
ticketRoutes.put('/actualizarsocket', ticketController.updateSocket);

// desktop requests
ticketRoutes.post('/taketicket', mdAuth.verificaToken, ticketController.takeTicket);
ticketRoutes.post('/releaseticket', mdAuth.verificaToken, ticketController.releaseTicket);
ticketRoutes.post('/endticket', mdAuth.verificaToken, ticketController.endTicket);
ticketRoutes.post('/reassignticket', mdAuth.verificaToken, ticketController.reassignTicket);

export default ticketRoutes;