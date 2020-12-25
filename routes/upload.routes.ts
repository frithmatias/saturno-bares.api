import { Router } from 'express';

// MIDDLEWARES
import  mdAuth  from '../middlewares/auth';

// CONTROLLER
import UploadController from '../controllers/upload.controller';

// ROUTES
const uploadRoutes = Router();

uploadRoutes.put('/:idDocument/:idField', mdAuth.verificaToken, UploadController.uploadImagen);
uploadRoutes.delete('/:idDocument/:idField/:fileName', mdAuth.verificaToken, UploadController.deleteImagen);
uploadRoutes.post('/synchostinger', mdAuth.verificaToken, UploadController.syncHostinger)
export default uploadRoutes;