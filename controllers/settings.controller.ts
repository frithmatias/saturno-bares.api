import { Request, response, Response } from 'express';
import { Settings } from '../models/settings.model';

// ========================================================
// Setting Methods
// ========================================================

function readSettings(req: Request, res: Response) {
    let idCompany = req.params.idCompany;
    console.log(idCompany)
    Settings.findOne({ id_company: idCompany }).then(settingsDB => {
        return res.status(200).json({
            ok: true,
            msg: 'Configuracion del comercio obtenida correctamente',
            settings: settingsDB
        })
    })
}

function updateSettings(req: Request, res: Response) {

    let idCompany = req.body._id;
    let blSpmAuto = req.body.bl_spm_auto;

    Settings.findByIdAndUpdate(idCompany, { bl_spm_auto: blSpmAuto }).then(settingsUpdated => {
        return res.status(200).json({
            ok: true,
            msg: 'Ajustes guardados correctamente',
            settigns: settingsUpdated
        })

    }).catch(() => {
        return res.status(400).json({
            ok: false,
            msg: 'Error al actualizar los ajustes',
            settigns: null
        })
    })
}

export = {
    readSettings,
    updateSettings
}
