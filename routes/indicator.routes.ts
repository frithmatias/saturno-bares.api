import { Router } from 'express';

// MIDDLEWARES
import  mdAuth  from '../middlewares/auth';

// CONTROLLER
import IndicatorController from '../controllers/indicator.controller';

// ROUTES
const indicatorRoutes = Router();

// indicatorRoutes.post('/updatetoken', IndicatorController.updateToken);
// indicatorRoutes.post('/google', IndicatorController.loginGoogle);
// indicatorRoutes.post('/login', IndicatorController.loginUser);
// indicatorRoutes.post('/register', IndicatorController.createUser);
// indicatorRoutes.post('/checkemailexists', IndicatorController.checkEmailExists);
// indicatorRoutes.post('/attachcompany/:idUser', mdAuth.verificaToken, IndicatorController.attachCompany);

export default indicatorRoutes;