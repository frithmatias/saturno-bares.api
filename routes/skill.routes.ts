import { Router } from 'express';

// MIDDLEWARES
import  mdAuth  from '../middlewares/auth';

// CONTROLLER
import SkillController from '../controllers/skill.controller';

// ROUTES
const skillRoutes = Router();

skillRoutes.post('/createskill', mdAuth.verificaToken, SkillController.createSkill);
skillRoutes.get('/readskills/:idCompany', SkillController.readSkills);
skillRoutes.get('/readskillsuser/:idUser', SkillController.readSkillsUser);
skillRoutes.delete('/deleteskill/:idSkill', mdAuth.verificaToken, SkillController.deleteSkill);

export default skillRoutes;