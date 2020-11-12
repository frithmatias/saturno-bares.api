import { Router } from 'express';

// MIDDLEWARES
import  mdAuth  from '../middlewares/auth';

// CONTROLLER
import SectionController from '../controllers/section.controller';

// ROUTES
const sectionRoutes = Router();

sectionRoutes.post('/createsection', mdAuth.verificaToken, SectionController.createSection);
sectionRoutes.get('/readsections/:idCompany', SectionController.readSections);
sectionRoutes.get('/readsessions/:idCompany', SectionController.readSessions);


sectionRoutes.delete('/deletesection/:idSection', mdAuth.verificaToken, SectionController.deleteSection);
sectionRoutes.post('/takesection', mdAuth.verificaToken, SectionController.takeSection);
sectionRoutes.post('/releasesection', mdAuth.verificaToken, SectionController.releaseSection);

export default sectionRoutes;