import { Router } from 'express';

// MIDDLEWARES
import  mdAuth  from '../middlewares/auth';

// CONTROLLER
import UserController from '../controllers/user.controller';

// ROUTES
const userRoutes = Router();

userRoutes.get('/testdata', UserController.testData);
userRoutes.post('/updatetoken', UserController.updateToken);
userRoutes.post('/google', UserController.loginGoogle);
userRoutes.post('/login', UserController.loginUser);
userRoutes.post('/register', UserController.createUser);
userRoutes.post('/checkemailexists', UserController.checkEmailExists);
userRoutes.post('/attachcompany/:idUser', mdAuth.verificaToken, UserController.attachCompany);



export default userRoutes;