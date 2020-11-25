import { Router } from 'express';

// MIDDLEWARES
import  mdAuth  from '../middlewares/auth';

// CONTROLLER
import scoreItemController from '../controllers/scoreitem.controller';

// ROUTES
const scoreitemRoutes = Router();

scoreitemRoutes.post('/createscoreitem', mdAuth.verificaToken, scoreItemController.createScoreItem);
scoreitemRoutes.get('/readscoreitems/:idCompany', mdAuth.verificaToken, scoreItemController.readScoreItems);
scoreitemRoutes.delete('/deletescoreitem/:idScoreItem', mdAuth.verificaToken, scoreItemController.deleteScoreItem);

export default scoreitemRoutes;