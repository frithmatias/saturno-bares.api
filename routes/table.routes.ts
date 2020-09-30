import { Router } from 'express';

// MIDDLEWARES
import  mdAuth  from '../middlewares/auth';

// CONTROLLER
import TableController from '../controllers/table.controller';

// ROUTES
const tableRoutes = Router();

tableRoutes.post('/createtable', mdAuth.verificaToken, TableController.createTable);
tableRoutes.get('/readtablesuser/:idUser', mdAuth.verificaToken, TableController.readTablesUser);
tableRoutes.get('/readtables/:idCompany', mdAuth.verificaToken, TableController.readTables);
tableRoutes.get('/readsectiontables/:idSection', mdAuth.verificaToken, TableController.readSectionTables);
tableRoutes.delete('/deletetable/:idTable', mdAuth.verificaToken, TableController.deleteTable);

export default tableRoutes;