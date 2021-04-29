import { Request, Response } from 'express';
import { Settings } from '../models/settings.model';
import Server from '../classes/server';

const server = Server.instance; // singleton

// ========================================================
// Setting Methods
// ========================================================

function readSettings(req: Request, res: Response) {
    let idCompany = req.params.idCompany;
    Settings.findOne({ id_company: idCompany }).then(settingsDB => {
        return res.status(200).json({
            ok: true,
            msg: 'Configuracion del comercio obtenida correctamente',
            settings: settingsDB
        })
    })
}

function updateSettings(req: Request, res: Response) {
    
    const idSettings = req.body._id; 
    const blSpm = req.body.bl_spm;
    const blSchedule = req.body.bl_schedule;
    const blQueue = req.body.bl_queue;
    const tmWorking = req.body.tm_working;
    const nmIntervals = req.body.nm_intervals;

    Settings.findById(idSettings).then(companySettings => {

        if(!companySettings){
            return res.status(400).json({
                ok: false, 
                msg: 'No existen ajustes para el comercio',
                settings: null
            })
        }


        companySettings.bl_spm = blSpm; 
        companySettings.bl_schedule = blSchedule; 
        companySettings.bl_queue = blQueue; 
        companySettings.tm_working = tmWorking; 
        companySettings.nm_intervals = nmIntervals;
        
        companySettings.save().then(settingsUpdated => {

            return res.status(200).json({
                ok: true,
                msg: 'Ajustes guardados correctamente',
                settings: settingsUpdated
            })

        }).catch((err)=>{
            return res.status(400).json({
                ok: false,
                msg: 'Error al guardar los ajustes para el comercio',
                settings: err
            })
        })


    }).catch(() => {
        return res.status(400).json({
            ok: false,
            msg: 'Error al obtener los ajustes para el comercio',
            settings: null
        })
    })
}

let sendMessage = (req: Request, res: Response): void => {

    let txMessage = String(req.body.txMessage);
    let idCompany = String(req.body.idCompany);


    if (txMessage && txMessage.length <= 100) {
        server.io.to(idCompany).emit('message-system', txMessage)
        res.status(200).json({
            ok: true,
            msg: 'Mensaje enviado correctemante', 
            text: null
        })
    }

}

export = {
    readSettings,
    updateSettings,
    sendMessage
}
