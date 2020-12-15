import { Router } from 'express';

// MIDDLEWARES
import  mdAuth  from '../middlewares/auth';

// CONTROLLER
import UploadController from '../controllers/upload.controller';

// ROUTES
const uploadRoutes = Router();

uploadRoutes.put('/:idCompany/:txType', UploadController.uploadImagen);
uploadRoutes.delete('/:idCompany/:txType/:filename', UploadController.deleteImagen);

export default uploadRoutes;