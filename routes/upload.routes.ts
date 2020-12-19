import { Router } from 'express';

// MIDDLEWARES
import  mdAuth  from '../middlewares/auth';

// CONTROLLER
import UploadController from '../controllers/upload.controller';

// ROUTES
const uploadRoutes = Router();

uploadRoutes.put('/:idDocument/:idField', UploadController.uploadImagen);
uploadRoutes.delete('/:idDocument/:idField/:filename', UploadController.deleteImagen);

export default uploadRoutes;