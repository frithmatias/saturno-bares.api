import { Router } from 'express';

// MIDDLEWARES
import  mdAuth  from '../middlewares/auth';

// CONTROLLER
import DesktopController from '../controllers/desktop.controller';

// ROUTES
const desktopRoutes = Router();

desktopRoutes.post('/createdesktop', mdAuth.verificaToken, DesktopController.createDesktop);
desktopRoutes.get('/readdesktopsuser/:idUser', mdAuth.verificaToken, DesktopController.readDesktopsUser);
desktopRoutes.get('/readdesktops/:idCompany', mdAuth.verificaToken, DesktopController.readDesktops);

desktopRoutes.delete('/deletedesktop/:idDesktop', mdAuth.verificaToken, DesktopController.deleteDesktop);
desktopRoutes.post('/takedesktop', mdAuth.verificaToken, DesktopController.takeDesktop);
desktopRoutes.post('/releasedesktop', mdAuth.verificaToken, DesktopController.releaseDesktop);

export default desktopRoutes;