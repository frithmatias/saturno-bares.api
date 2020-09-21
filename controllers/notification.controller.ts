import { Request, Response } from 'express';
import { getPublicKey } from '../notifications/push';
import { Subscription } from '../models/subscription.model';

import webpush from 'web-push';
import * as keys from '../notifications/vapid.json';

webpush.setVapidDetails(
    'mailto:matiasfrith@gmail.com', // por si los servicios cambian
    keys.publicKey,
    keys.privateKey
  );


// ========================================================
// Skill Methods
// ========================================================

function notificationSubscribe(req: Request, res: Response) {
    

    var body = req.body;
    body.expirationTime = + new Date().getTime() + 3600 * 24 * 7;

    var subscription = new Subscription(body);
    subscription.save().then(subscriptionSaved => {
        return res.status(200).json({
            ok: true,
            msg: 'Subscripción a notificaciones exitosa',
            subscription: subscriptionSaved
        })
    }).catch(()=>{
        return res.status(400).json({
            ok: false, 
            msg: 'No se pudo suscribir a las notificaciones',
            subscription: null
        })
    })


}

function notificationKey(req: Request, res: Response) {
    // return res.status(200).json({ 
    return res.status(200).send( // for encoding data with urlsafeBase64
            getPublicKey()
    )
}

function notificationPush(req: Request, res: Response) {


    const post = {
        title: req.body.title,
        msg: req.body.msg
    };

    Subscription.find({}).then(async (subscriptions: any) => {
        let subscriptors = subscriptions.length;
        for (let subscription of subscriptions) {
        
            await webpush.sendNotification(subscription, JSON.stringify(post))
            .then( () => console.log('Notificación enviada'))
            .catch( () => {
                subscriptors--;
                subscription.remove().then((subscriptionRemoved: any) => {
                })
            });
        }
        
        return res.status(200).json({
            ok: true,
            msg: 'Notificaciones enviadas',
            subscriptors
        })
    });





}

export = {
    notificationSubscribe,
    notificationKey,
    notificationPush
}
