import { Request, Response } from 'express';
import { Table } from '../models/table.model';

// ========================================================
// Indicator Methods
// ========================================================

function createTable(req: Request, res: Response) {

    var body = req.body;
    var table = new Table({
        id_company: body.id_company,
        cd_table: body.cd_table,
        id_waiter: body.id_waiter
    });

    table.save().then((tableSaved) => {
        res.status(200).json({
            ok: true,
            msg: 'Escritorio guardado correctamente',
            table: tableSaved
        })
    }).catch((err) => {
        res.status(400).json({
            ok: false,
            msg: err.message,
            table: null
        })
    })
}


export = {
    createTable
}
