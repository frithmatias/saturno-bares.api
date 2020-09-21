import { Router } from 'express';

// MIDDLEWARES
import  mdAuth  from '../middlewares/auth';

// CONTROLLER
import AssistantController from '../controllers/assistant.controller';

// ROUTES
const assistantRoutes = Router();

// crud
assistantRoutes.post('/createassistant', mdAuth.verificaToken, AssistantController.createAssistant);
assistantRoutes.post('/updateassistant', mdAuth.verificaToken, AssistantController.updateAssistant);
assistantRoutes.get('/readassistants/:idCompany', mdAuth.verificaToken, AssistantController.readAssistants);
assistantRoutes.delete('/deleteassistant/:idAssistant', mdAuth.verificaToken, AssistantController.deleteAssistant);

assistantRoutes.get('/readactivesessionsbyskill/:idSkill', AssistantController.readActiveSessionsBySkill);
assistantRoutes.get('/readassistantsuser/:idUser', mdAuth.verificaToken, AssistantController.readAssistantsUser);

export default assistantRoutes;