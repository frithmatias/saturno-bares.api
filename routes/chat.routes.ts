import { Router } from 'express';

// MIDDLEWARES
import mdAuth from '../middlewares/auth';

// CONTROLLER
import ChatController from '../controllers/chat.controller';

// ROUTES
const chatRoutes = Router();

// client
chatRoutes.post('/chatrequest', mdAuth.verificaToken, ChatController.chatRequest);
chatRoutes.get('/endsession/:idSession', mdAuth.verificaToken, ChatController.endSession);
chatRoutes.post('/submitsubject/', mdAuth.verificaToken, ChatController.submitSubject);
chatRoutes.post('/actualizarsocket/', mdAuth.verificaToken, ChatController.actualizarSocket);



// assistant
chatRoutes.get('/readchatsrequests', mdAuth.verificaToken, ChatController.readChatsRequests);
chatRoutes.post('/initializesession', mdAuth.verificaToken, ChatController.initializeSession);

export default chatRoutes;