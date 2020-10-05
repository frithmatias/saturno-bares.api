import { Router } from 'express';

// CONTROLLER
import PublicController from '../controllers/public.controller';

// ROUTES
const publicRoutes = Router();
publicRoutes.get('/getuserdata/:company', PublicController.getClientData);
publicRoutes.post('/contact', PublicController.postContact);
publicRoutes.post('/postscores', PublicController.postScores);
publicRoutes.get('/getscoreitems/:idSection', PublicController.getScoreItems);

export default publicRoutes; 