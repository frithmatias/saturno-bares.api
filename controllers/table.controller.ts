import { Request, Response } from 'express';
import { Table } from '../models/table.model';
import { Section } from '../models/section.model';
import { Ticket } from '../models/ticket.model';
import { TableSession } from '../models/table.session.model';
import Server from '../classes/server';
import tkt from './ticket.controller';

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

let readSectionTables = (req: Request, res: Response) => {
    let idSection = req.params.idSection;
    Table.find({ id_section: idSection })
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

                let spm = await spmPull(tableDB);
                if (sectionDB) {
                    const server = Server.instance;
                    server.io.to(sectionDB.id_company).emit('update-waiters');
                    server.io.to(sectionDB.id_company).emit('update-clients');
                }

                return res.status(200).json({
                    ok: true,
                    msg: spm.status,
                    table: spm.table
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

let assignTables = (req: Request, res: Response) => {
    var { idTicket, cdTables, blProvide } = req.body;
    Ticket.findByIdAndUpdate(idTicket, { cd_tables: cdTables, tx_status: 'assigned' }, { new: true }).then(ticketSaved => {

        if (!ticketSaved) {
            return res.status(400).json({
                ok: false,
                msg: 'Error al asignar las mesas',
                ticket: null
            })
        }

        const server = Server.instance;
        server.io.to(ticketSaved.id_company).emit('update-waiters'); // mesas proveídas
        server.io.to(ticketSaved.id_socket_client).emit('update-clients'); // mesas proveídas

        if (blProvide) {
            Table.find({
                id_section: ticketSaved.id_section,
                nm_table: { $in: cdTables }
            }).then(tablesAssigned => {
                spmProvide(tablesAssigned, ticketSaved).then((resp) => {
                    if (resp) {
                        server.io.to(ticketSaved.id_company).emit('update-waiters');
                        server.io.to(ticketSaved.id_company).emit('update-clients');
                    }
                }).catch(() => {
                    return res.status(400).json({
                        ok: true,
                        msg: 'Error al proveer las mesas',
                        ticket: ticketSaved
                    })
                })
            })
            return res.status(200).json({
                ok: true,
                msg: 'Las mesas fueron asignadas y proveídas correctamente',
                ticket: ticketSaved
            })
        }

        return res.status(200).json({
            ok: true,
            msg: 'Las mesas fueron asignadas correctamente',
            ticket: ticketSaved
        })

    }).catch(() => {
        return res.status(400).json({
            ok: false,
            msg: 'Error al asignar las mesas',
            ticket: null
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
            msg: 'Error al eliminar el escritorio',
            table: null
        })
    })
}

interface spmPullResponse {
    status: string, // status of table
    table: Table | null
}
let spmPull = (table: Table): Promise<spmPullResponse> => {
    // cuando se libera una mesa verifica el estado del primero en la lista, si es 'assigned' y la mesa le corresponde 
    // la mesa queda reservada, sino busca el próximo 'queued' que cumpla con las condiciones de la mesa.
    return new Promise((resolve, reject) => {
        const server = Server.instance;
        let year = + new Date().getFullYear();
        let month = + new Date().getMonth();
        let day = + new Date().getDate();
        let time = + new Date(year, month, day).getTime();

        // busco el primer turno (sin filtro por cantidad de comensales)
        Ticket.find({
            id_section: table.id_section,
            tm_start: { $gt: time },
            tm_provided: null,
            tm_att: null,
            tm_end: null
        }).then(ticketsDB => {

            let ticket: Ticket;
            ticket = ticketsDB[0];
            if (!ticket) { return resolve({ status: 'idle', table: table }) }

            // Se comienza a reservar mesas de un requerido SOLO CUANDO se encuentra en la PRIMERA posición y la mesa liberada le corresponde
            if (ticket?.tx_status === 'assigned' && ticket?.cd_tables?.includes(table.nm_table)) {
                Table.find({
                    id_section: table.id_section,
                    nm_table: { $in: ticket.cd_tables }
                }).then(tablesAssigned => {
                    spmProvide(tablesAssigned, ticket).then((resp) => {
                        if (resp) {
                            server.io.to(ticket.id_company).emit('update-waiters');
                            server.io.to(ticket.id_company).emit('update-clients');
                            resolve({ status: resp.status, table: resp.table })
                        }
                    }).catch(() => {
                        reject()
                    })
                })
            } else {
                ticket = ticketsDB.filter(ticket => ticket.tx_status === 'queued' && ticket.nm_persons <= table.nm_persons)[0];
                spmProvide([table], ticket).then((resp) => {
                    if (resp) {
                        server.io.to(ticket.id_company).emit('update-waiters');
                        server.io.to(ticket.id_company).emit('update-clients');
                        resolve({ status: resp.status, table: resp.table })

                    }
                }).catch(() => {
                    reject()
                })
            }
        })
    })
}

interface spmProvideResponse {
    status: string, // status of table
    table: Table | null
}

let spmProvide = (tables: Table[], ticket: Ticket): Promise<spmProvideResponse> => {
    return new Promise((resolve, reject) => {

        let allReserved = false;
        if (ticket.tx_status === 'assigned') {
            for (let table of tables) {
                if (table.tx_status === 'idle') {
                    table.tx_status = 'reserved';
                    table.save().then(() => {
                        resolve({ status: 'reserved', table: table });
                    })
                }
            }
            let tablesReserved = tables.filter(table => table.tx_status === 'reserved').length;
            if (tablesReserved === ticket.cd_tables?.length) { allReserved = true; }
        }

        if ((ticket.tx_status === 'assigned' && allReserved) || (ticket.tx_status === 'queued')) {

            let session = new TableSession();
            let idTables: string[] = tables.map(table => table._id);
            session.id_tables = idTables;
            session.id_ticket = ticket._id;
            session.tm_start = + new Date();
            session.save().then(sessionSaved => {
                for (let table of tables) {
                    table.tx_status = 'busy';
                    table.id_session = sessionSaved._id;
                    table.save().then(tableSaved => {
                        ticket.tx_status = 'provided';
                        ticket.id_session = sessionSaved._id;
                        ticket.tm_provided = + new Date();
                        ticket.save().then(ticketSaved => {
                            return resolve({ status: 'busy', table });
                        }).catch(() => reject(false))
                    })
                }

            })
        }
    })
}

export = {
    createTable,
    readTables,
    readSectionTables,
    toggleTableStatus,
    assignTables,
    deleteTable,
    spmPull,
    spmProvide
}
