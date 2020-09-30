import { Router } from 'express';

// MIDDLEWARES
import  mdAuth  from '../middlewares/auth';

// CONTROLLER
import WaiterController from '../controllers/waiter.controller';

// ROUTES
const waiterRoutes = Router();

// crud
waiterRoutes.post('/createwaiter', mdAuth.verificaToken, WaiterController.createWaiter);
waiterRoutes.post('/updatewaiter', mdAuth.verificaToken, WaiterController.updateWaiter);
waiterRoutes.get('/readwaiters/:idCompany', mdAuth.verificaToken, WaiterController.readWaiters);
waiterRoutes.delete('/deletewaiter/:idWaiter', mdAuth.verificaToken, WaiterController.deleteWaiter);

// auxiliar
waiterRoutes.get('/readwaitersuser/:idUser', mdAuth.verificaToken, WaiterController.readWaitersUser);

export default waiterRoutes;