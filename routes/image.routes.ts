import { Router } from 'express';

// MIDDLEWARES
import  mdAuth  from '../middlewares/auth';

// CONTROLLER
import ImageController from '../controllers/image.controller';

// ROUTES
const imageRoutes = Router();

imageRoutes.get('/:idCompany/:idType/:idFile', ImageController.getImage);

export default imageRoutes;