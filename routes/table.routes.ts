import { Router } from 'express';

// MIDDLEWARES
import  mdAuth  from '../middlewares/auth';

// CONTROLLER
import TableController from '../controllers/table.controller';

// ROUTES
const tableRoutes = Router();

tableRoutes.post('/createtable', mdAuth.verificaToken, TableController.createTable);
tableRoutes.get('/readtables/:idCompany', mdAuth.verificaToken, TableController.readTables);
tableRoutes.get('/toggletablestatus/:idTable', mdAuth.verificaToken, TableController.toggleTableStatus);
tableRoutes.delete('/deletetable/:idTable', mdAuth.verificaToken, TableController.deleteTable);

export default tableRoutes;