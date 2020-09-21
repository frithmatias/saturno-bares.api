import { Request, Response } from 'express';
import { Ticket } from '../models/ticket.model';
import { Session } from '../models/session.model';
import moment from 'moment';
import { Score } from '../models/score.model';

// ========================================================
// Metric Methods
// ========================================================

function getUserMetrics(req: Request, res: Response) {

    let idUser = req.body.idUser;
    let fcSel = req.body.fcSel;
    let fcSelAdd24 = fcSel + 3600 * 24 * 1000;
    Session.find({ id_assistant: idUser }).then(sessionsDB => {
        // sessions array to get tickets
        let sessions = sessionsDB.map(session => String(session._id));

        Ticket.find({
            id_session: { $in: sessions },
            $and: [
                { tm_att: { $gt: fcSel } },
                { tm_att: { $lt: fcSelAdd24 } }
            ]
        }, 'id_skill id_position tm_start tm_att tm_end')
            .populate('id_skill', 'cd_skill tx_skill')
            .then(ticketsDB => {
                // tickets array to get scores 
                
                if(ticketsDB.length === 0){
                    return res.status(200).json({
                        ok: false,
                        msg: 'No existen tickets del asistente',
                        metrics: { tickets: ticketsDB, total: 0, avg: 0 }
                    })
                }

                let tickets = ticketsDB.map(ticket => String(ticket._id));

                Score.aggregate([
                    { $match: { id_ticket: { $in: tickets } } },
                    { $group: { _id: null, total: { $sum: 1 }, avg: { $avg: '$cd_score' } } },
                    { $addFields: { avg: { $round: ['$avg', 1] } } }
                ]).then(scoresDB => {
                   
                    return res.status(200).json({
                        ok: true,
                        msg: 'Metricas del asistente obtenidas correctamente',
                        metrics: { tickets: ticketsDB, total: scoresDB[0].total, avg: scoresDB[0].avg }
                    })

                }).catch((err)=> {
                    return res.status(200).json({
                        ok: true,
                        msg: 'No existen puntuaciones para las metricas',
                        metrics: { tickets: ticketsDB, total: 0, avg: 0 }
                    })
                })

            }).catch(() => {
                return res.status(400).json({
                    ok: false,
                    msg: 'Error al obtener los tickets del asistente',
                    tickets: null
                })
            })
    })
}

function getDesktopSessions(req: Request, res: Response) {

    let { idUser } = req.params;

    Ticket.find({ id_assistant: idUser }, 'id_session id_skill id_position tm_start tm_att tm_end')
        .populate('id_skill')

        .then(ticketsDB => {
            return res.status(200).json({
                ok: true,
                msg: 'Tickets del asistente obtenidos correctamente',
                tickets: ticketsDB
            })
        }).catch(() => {
            return res.status(400).json({
                ok: false,
                msg: 'Error al obtener los tickets del asistente',
                tickets: null
            })
        })
}


export = {
    getUserMetrics,
    getDesktopSessions
}
