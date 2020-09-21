import { Router } from 'express';

// MIDDLEWARES
import  mdAuth  from '../middlewares/auth';

// CONTROLLER
import MetricController from '../controllers/metric.controller';

// ROUTES
const metricRoutes = Router();

metricRoutes.post('/getusermetrics', mdAuth.verificaToken, MetricController.getUserMetrics);




export default metricRoutes;