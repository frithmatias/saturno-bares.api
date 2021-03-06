import { Router } from 'express';

// MIDDLEWARES
import  mdAuth  from '../middlewares/auth';

// CONTROLLER
import TableController from '../controllers/table.controller';

// ROUTES
const tableRoutes = Router();

tableRoutes.get('/readtables/:idCompany', mdAuth.verificaToken, TableController.readTables);

// WAITER
tableRoutes.post('/toggletablestatus', mdAuth.verificaToken, TableController.toggleTableStatus);
tableRoutes.post('/assigntablesrequested', mdAuth.verificaToken, TableController.assignTablesRequested);
tableRoutes.post('/initTables', mdAuth.verificaToken, TableController.initTables);

// ADMIN
tableRoutes.post('/resettable', mdAuth.verificaToken, TableController.resetTable);
tableRoutes.post('/createtable', mdAuth.verificaToken, TableController.createTable);
tableRoutes.delete('/deletetable/:idTable', mdAuth.verificaToken, TableController.deleteTable);
tableRoutes.post('/assigntablespending', mdAuth.verificaToken, TableController.assignTablesPending);

export default tableRoutes;