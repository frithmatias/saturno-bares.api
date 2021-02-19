import { Router } from 'express';

// MIDDLEWARES
import  mdAuth  from '../middlewares/auth';

// CONTROLLER
import MessengerController from '../controllers/messenger.controller';

// ROUTES
const messengerRoutes = Router();

messengerRoutes.post('/sendmail', mdAuth.verificaToken, MessengerController.sendMail)
export default messengerRoutes;