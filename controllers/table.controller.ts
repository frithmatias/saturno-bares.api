import { Request, Response } from 'express';
import { Table } from '../models/table.model';
import { Section } from '../models/section.model';
import { Ticket } from '../models/ticket.model';
import { TableSession } from '../models/table.session.model';
import Server from '../classes/server';
// ========================================================
// Table Methods
// ========================================================

let createTable = (req: Request, res: Response) => {

    var { id_section, nm_table, nm_persons } = req.body;
    var table = new Table({
        id_section,
        nm_table,
        nm_persons,
        tx_satus: 'paused',
        id_session: null
    });
    table.save().then((tableSaved) => {
        res.status(200).json({
            ok: true,
            msg: 'Mesa guardada correctamente',
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

let readTables = (req: Request, res: Response) => {
    let idCompany = req.params.idCompany;

    Section.find({ id_company: idCompany }).then(sectionsDB => {

        if (!sectionsDB || sectionsDB.length === 0) {
            return res.status(400).json({
                ok: false,
                msg: 'No existen sectores para la empresa solicitada',
                tables: null
            })
        }

        // sections of company
        let idSections = sectionsDB.map(section => section._id)

        Table.find({ id_section: { $in: idSections } })
            .populate({
                path: 'id_session',
                populate: { path: 'id_waiter' }
            })
            .then(tablesDB => {
                if (!tablesDB) {
                    return res.status(400).json({
                        ok: false,
                        msg: 'No existen escritorios para la empresa seleccionada',
                        tables: null
                    })
                }
                return res.status(200).json({
                    ok: true,
                    msg: 'Mesas obtenidas correctamente',
                    tables: tablesDB
                })
            }).catch(() => {
                return res.status(500).json({
                    ok: false,
                    msg: 'Error al consultar las mesas para los sectores de la empresa.',
                    tables: null
                })

            })
    }).catch(() => {
        return res.status(500).json({
            ok: false,
            msg: 'Error al consultar los sectores para la empresa solicitada.',
            tables: null
        })

    })
}

let readSectionTables = (req: Request, res: Response) => {
    let idSection = req.params.idSection;
    Section.findById(idSection).then(sectionDB => {

        if (!sectionDB) {
            return res.status(400).json({
                ok: false,
                msg: 'No existe el sector solicitado',
                tables: null
            })
        }

        Table.find({ id_section: sectionDB._id })
            .populate({
                path: 'id_session',
                populate: { path: 'id_ticket' }
            })
            .then(tablesDB => {
                if (!tablesDB) {
                    return res.status(400).json({
                        ok: false,
                        msg: 'No existen escritorios para la empresa seleccionada',
                        tables: null
                    })
                }
                return res.status(200).json({
                    ok: true,
                    msg: 'Mesas obtenidas correctamente',
                    tables: tablesDB
                })
            }).catch(() => {
                return res.status(500).json({
                    ok: false,
                    msg: 'Error al consultar las mesas para los sectores de la empresa.',
                    tables: null
                })

            })
    }).catch(() => {
        return res.status(500).json({
            ok: false,
            msg: 'Error al consultar los sectores para la empresa solicitada.',
            tables: null
        })

    })
}

let toggleTableStatus = (req: Request, res: Response) => {
    let idTable = req.params.idTable;


    Table.findById(idTable).then(async tableDB => {

        let sectionDB = await Section.findById(tableDB?.id_section);

        if (!tableDB) {
            res.status(400).json({
                ok: false,
                msg: 'No existe la mesa',
                table: null
            })
        } else {

            if (tableDB.tx_status === 'paused' || tableDB.tx_status === 'reserved') {
                tableDB.tx_status = 'idle';
            } else if (tableDB.tx_status === 'idle') {
                tableDB.tx_status = 'paused';
            }

            tableDB.save().then(async statusSaved => {

                let msg: string;
                if (statusSaved.tx_status === 'idle') {
                    msg = await spmPull(tableDB);
                } else {
                    msg = 'La mesa fue pausada correctamente'
                }

                if (sectionDB) {
                    const server = Server.instance;
                    server.io.to(sectionDB.id_company).emit('update-waiters');
				    server.io.to(sectionDB.id_company).emit('update-clients');

                }

                return res.status(200).json({
                    ok: true,
                    msg: 'El nuevo estado de mesa fue guardado',
                    table: statusSaved
                })
            }).catch(() => {
                return res.status(500).json({
                    ok: false,
                    msg: 'No se pudo guardar el nuevo estado de mesa',
                    table: null
                })
            })
        }


    })
}

let deleteTable = (req: Request, res: Response) => {
    let idTable = req.params.idTable;
    Table.findByIdAndDelete(idTable).then((tableDeleted) => {
        res.status(200).json({
            ok: true,
            msg: 'Mesa eliminada correctamente',
            table: tableDeleted
        })
    }).catch(() => {
        res.status(400).json({
            ok: false,
            msg: 'Error al eliminar el escritorio',
            table: null
        })
    })
}

// se libera una mesa (tira)
let spmPull = (table: Table): Promise<string> => {
    return new Promise((resolve) => {

        let year = + new Date().getFullYear();
        let month = + new Date().getMonth();
        let day = + new Date().getDate();
        let time = + new Date(year, month, day).getTime();

        Ticket.findOne({
            id_section: table.id_section, // only this company
            tm_start: { $gt: time },  // only from today
            tm_provided: null,
            tm_att: null,
            tm_end: null,
            nm_persons: { $lte: table.nm_persons }
        }).then(ticketDB => {
            if (!ticketDB) { return resolve('Mesa liberada. No hay clientes para esta mesa') }
            let session = new TableSession();
            session.id_table = table._id;
            session.id_ticket = ticketDB._id;
            session.tm_start = + new Date();
            session.save().then(sessionSaved => {
                table.tx_status = 'busy';
                table.id_session = sessionSaved._id;
                table.save().then(tableSaved => {
                    ticketDB.tx_status = 'assigned';
                    ticketDB.id_session = sessionSaved._id;
                    ticketDB.tm_provided = + new Date();
                    ticketDB.save().then(ticketSaved => {
                        return resolve('Un nuevo cliente fue asignado a esta mesa');
                    })
                })
            })
        })
    })
}

export = {
    createTable,
    readTables,
    readSectionTables,
    toggleTableStatus,
    deleteTable,
    spmPull
}
