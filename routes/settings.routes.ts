import { Router } from 'express';

// MIDDLEWARES
import  mdAuth  from '../middlewares/auth';

// CONTROLLER
import SettingsController from '../controllers/settings.controller';

// ROUTES
const settingsRoutes = Router();
settingsRoutes.get('/readsettings/:idCompany', mdAuth.verificaToken, SettingsController.readSettings);
settingsRoutes.put('/updatesettings', mdAuth.verificaToken, SettingsController.updateSettings);
settingsRoutes.post('/sendmessage', mdAuth.verificaToken, SettingsController.sendMessage);
export default settingsRoutes;