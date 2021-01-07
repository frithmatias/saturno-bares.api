import { Request, response, Response } from 'express';
import { Table } from '../models/table.model';
import { Section } from '../models/section.model';
import { Ticket } from '../models/ticket.model';
import spm from '../classes/spm';
import Server from '../classes/server';
import { Settings } from '../models/settings.model';

const server = Server.instance; // singleton
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

    Section.find({ id_company: idCompany })
        .then(sectionsDB => {

            if (!sectionsDB || sectionsDB.length === 0) {
                return res.status(200).json({
                    ok: false,
                    msg: 'No existen sectores para la empresa solicitada',
                    tables: []
                })
            }

            // sections of company
            let idSections = sectionsDB.map(section => section._id)

            Table.find({ id_section: { $in: idSections } })
                .populate({
                    path: 'id_session',
                    populate: { path: 'id_ticket' }
                })
                .sort({ id_section: 1, nm_table: 1 })
                .then(tablesDB => {
                    if (!tablesDB) {
                        return res.status(200).json({
                            ok: false,
                            msg: 'No existen mesas para la empresa seleccionada',
                            tables: []
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

        if (!tableDB) {
            return res.status(400).json({
                ok: false,
                msg: 'No existe la mesa',
                table: null
            })
        }

        let sectionDB = await Section.findById(tableDB?.id_section);

        if (!sectionDB) {
            return res.status(400).json({
                ok: false,
                msg: 'No existe el sector de la mesa',
                table: null
            })
        }

        tableDB.tx_status = tableDB.tx_status === 'idle' ? 'paused' : 'idle';
        tableDB.save().then(async statusSaved => {

            if (sectionDB) {
                server.io.to(sectionDB.id_company).emit('update-waiters');
                server.io.to(sectionDB.id_company).emit('update-clients');
            }

            if (tableDB.tx_status === 'idle') {
                // busca un ticket para la mesa liberada

                await spm.pull(tableDB).then((resp) => {

                    return res.status(200).json({
                        ok: true,
                        msg: resp,
                        table: tableDB
                    })

                }).catch((err) => {

                    return res.status(400).json({
                        ok: false,
                        msg: err,
                        table: tableDB
                    })
                })


            } else {

                return res.status(200).json({
                    ok: true,
                    msg: `Estado ${statusSaved.tx_status} guardado correctamente`,
                    table: tableDB
                })

            }


        }).catch((err) => {
            return res.status(500).json({
                ok: false,
                msg: `Error al guardar el estado ${tableDB.tx_status}`,
                table: null
            })
        })

    })
}

let assignTables = (req: Request, res: Response) => {

    var { isFirst, idTicket, cdTables, blPriority } = req.body;

    // 1. busco el ticket que quiero actualizar 
    // 2. verifico si des-asigna para evaluar el estado original 
    // 3. solo para blPriority con estados queue o assigned, verifico disponibilidad

    let newStatus: string;

    Ticket.findById(idTicket).then(async ticketDB => {

        if (!ticketDB) {
            return res.status(400).json({
                ok: false,
                msg: 'No existe el ticket que desea asignar',
                ticket: null
            })
        }

        let tables = await Table.find({ id_section: ticketDB.id_section })
        let compatibles = tables.filter(table => table.nm_persons >= ticketDB.nm_persons);
        let newStatus;

        if (cdTables.length === 0) {
            newStatus = compatibles.length === 0 ? 'requested' : 'queued';
        } else {
            newStatus = 'assigned';
        }

        ticketDB.cd_tables = cdTables;
        ticketDB.tx_status = newStatus;
        ticketDB.bl_priority = blPriority;

        ticketDB.save().then(ticketSaved => {

            if (!ticketSaved) {
                return res.status(400).json({
                    ok: false,
                    msg: 'Error guardar el ticket',
                    ticket: null
                })
            }

            server.io.to(ticketSaved.id_company).emit('update-waiters'); // mesas proveídas
            if (ticketSaved.id_socket_client) server.io.to(ticketSaved.id_socket_client).emit('update-clients'); // mesas proveídas

            if (blPriority || isFirst) {

                let tablesToProvide: Table[] = [];

                if (ticketSaved.tx_status === 'queued') { // aprovisiono una mesa compatible
                    tablesToProvide = [compatibles[0]];
                } else if (ticketSaved.tx_status === 'assigned') { // intento aprovisionar la/las mesas asignadas
                    tablesToProvide = tables.filter(table => ticketDB.cd_tables?.includes(table.nm_table));
                }

                if (tablesToProvide.length === 0) {
                    // se le dio prioridad a un ticket en estado 'requerido'
                    return res.status(200).json({
                        ok: true,
                        msg: 'No hay mesas asignadas ni compatibles para proveer.',
                        tables: compatibles[0]
                    })
                }

                spm.provide(tablesToProvide, ticketSaved).then(() => {

                    return res.status(200).json({
                        ok: true,
                        msg: 'Mesa asignada y proveída correctamente',
                        tables: compatibles[0]
                    })

                }).catch(() => {

                    return res.status(400).json({
                        ok: true,
                        msg: 'Error al proveer las mesas',
                        tables: null
                    })

                })


            } else {
                return res.status(200).json({
                    ok: true,
                    msg: 'Mesas asignadas correctamente',
                    tables: null
                })
            }
        })
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
            msg: 'Error al eliminar la mesa',
            table: null
        })
    })
}

export = {
    createTable,
    readTables,
    toggleTableStatus,
    assignTables,
    deleteTable
}
