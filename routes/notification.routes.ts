import { Router } from 'express';

// MIDDLEWARES
import  mdAuth  from '../middlewares/auth';

// CONTROLLER
import NotificationController from '../controllers/notification.controller';

// ROUTES
const notificationRoutes = Router();

notificationRoutes.post('/subscribe', NotificationController.notificationSubscribe);
notificationRoutes.get('/key', NotificationController.notificationKey);
notificationRoutes.post('/push', NotificationController.notificationPush);
notificationRoutes.post('/readnotifications', NotificationController.readNotifications);
notificationRoutes.post('/updatenotificationread', NotificationController.updateNotificationRead);
notificationRoutes.post('/updatenotificationsread', NotificationController.updateNotificationsRead);



export default notificationRoutes;