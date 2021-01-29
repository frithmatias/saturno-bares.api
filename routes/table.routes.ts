import { Router } from 'express';

// MIDDLEWARES
import  mdAuth  from '../middlewares/auth';

// CONTROLLER
import TableController from '../controllers/table.controller';

// ROUTES
const tableRoutes = Router();

tableRoutes.get('/readtables/:idCompany', mdAuth.verificaToken, TableController.readTables);

// WAITER
tableRoutes.get('/toggletablestatus/:idTable', mdAuth.verificaToken, TableController.toggleTableStatus);
tableRoutes.post('/assigntablesrequested', mdAuth.verificaToken, TableController.assignTablesRequested);

// ADMIN
tableRoutes.post('/createtable', mdAuth.verificaToken, TableController.createTable);
tableRoutes.delete('/deletetable/:idTable', mdAuth.verificaToken, TableController.deleteTable);
tableRoutes.post('/assigntablespending', mdAuth.verificaToken, TableController.assignTablesPending);

export default tableRoutes;