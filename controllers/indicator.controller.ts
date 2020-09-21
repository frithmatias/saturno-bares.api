import { Request, Response } from 'express';
import { Desktop } from '../models/desktop.model';

// ========================================================
// Indicator Methods
// ========================================================

function createDesktop(req: Request, res: Response) {

    var body = req.body;
    var desktop = new Desktop({
        id_company: body.id_company,
        cd_desktop: body.cd_desktop,
        id_assistant: body.id_assistant
    });

    desktop.save().then((desktopSaved) => {
        res.status(200).json({
            ok: true,
            msg: 'Escritorio guardado correctamente',
            desktop: desktopSaved
        })
    }).catch((err) => {
        res.status(400).json({
            ok: false,
            msg: err.message,
            desktop: null
        })
    })
}


export = {
    createDesktop
}
