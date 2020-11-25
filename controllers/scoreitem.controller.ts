import { Request, Response } from 'express';
import { ScoreItem } from '../models/scoreitem.model';
import { Section } from '../models/section.model';

// ========================================================
// ScoreItem Methods
// ========================================================

let createScoreItem = (req: Request, res: Response) => {

    var { id_section, tx_item } = req.body;

    var scoreitem = new ScoreItem({
        id_section,
        tx_item
    });
    
    scoreitem.save().then((scoreitemSaved) => {
        res.status(200).json({
            ok: true,
            msg: 'Item a calificar guardada correctamente',
            scoreitem: scoreitemSaved
        })
    }).catch((err) => {
        res.status(400).json({
            ok: false,
            msg: err.message,
            scoreitem: null
        })
    })
}

let readScoreItems = (req: Request, res: Response) => {
    let idCompany = req.params.idCompany;

    Section.find({ id_company: idCompany })
        .then(sectionsDB => {

            if (!sectionsDB || sectionsDB.length === 0) {
                return res.status(200).json({
                    ok: false,
                    msg: 'No existen sectores para la empresa solicitada',
                    scoreitems: []
                })
            }

            // sections of company
            let idSections = sectionsDB.map(section => section._id)

            ScoreItem.find({ id_section: { $in: idSections } })
                .populate({
                    path: 'id_session',
                    populate: { path: 'id_ticket' }
                })
                .sort({id_section:1,tx_scoreitem:1})
                .then(scoreitemsDB => {
                    if (!scoreitemsDB) {
                        return res.status(200).json({
                            ok: false,
                            msg: 'No existen items a calificar para la empresa seleccionada',
                            scoreitems: []
                        })
                    }
                    return res.status(200).json({
                        ok: true,
                        msg: 'Items a calificar obtenidos correctamente',
                        scoreitems: scoreitemsDB
                    })
                }).catch(() => {
                    return res.status(500).json({
                        ok: false,
                        msg: 'Error al consultar los items a calificar para los sectores de la empresa.',
                        scoreitems: null
                    })

                })
        }).catch(() => {
            return res.status(500).json({
                ok: false,
                msg: 'Error al consultar los sectores para la empresa solicitada.',
                scoreitems: null
            })

        })
}

let deleteScoreItem = (req: Request, res: Response) => {
    let idScoreItem = req.params.idScoreItem;
    ScoreItem.findByIdAndDelete(idScoreItem).then((scoreitemDeleted) => {
        res.status(200).json({
            ok: true,
            msg: 'Item a calificar eliminado correctamente',
            scoreitem: scoreitemDeleted
        })
    }).catch(() => {
        res.status(400).json({
            ok: false,
            msg: 'Error al eliminar el item a calificar',
            scoreitem: null
        })
    })
}


export = {
    createScoreItem,
    readScoreItems,
    deleteScoreItem,
}
