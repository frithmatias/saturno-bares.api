import { Request, Response } from 'express';
import { Table } from '../models/table.model';
import { Section } from '../models/section.model';
import { Ticket } from '../models/ticket.model';
import spm from '../classes/spm';

import Server from '../classes/server';
import { TableSession } from '../models/table.session.model';
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
        tableDB.save().then(statusSaved => {

            if (sectionDB) {
                server.io.to(sectionDB.id_company).emit('update-waiters');
            }

            if (tableDB.tx_status === 'idle') {
                // busca un ticket para la mesa liberada

                spm.pull(tableDB).then((resp) => {

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


// ADMIN 
let resetTable = async (req: Request, res: Response) => {
    // el camarero inicializa las mesas en estado "waiting" (el cliente llegó a la mesa)
    let idTable = req.body.idTable;

    await Table.findByIdAndUpdate(idTable, {tx_status: 'paused', id_session: null}).then(async tableUpdated => {

        if (!tableUpdated) {
            return res.status(400).json({
                ok: false,
                msg: 'No existe la mesa que desea resetear',
                table: null
            })
        }

        if(!tableUpdated.id_session){
            return res.status(200).json({
                ok: true,
                msg: 'Mesa sin sesión reseteada correctamente',
                table: null
            })
        }

        const session = await TableSession.findByIdAndUpdate(tableUpdated?.id_session, {tm_end: new Date()});
        const ticket = await Ticket.findByIdAndUpdate(session?.id_ticket, {tm_end: new Date(), tx_status: 'killed'}, {new: true});

        if (ticket?.id_socket_client) {
                server.io.to(ticket.id_socket_client).emit('update-ticket', ticket);
        }

        return res.status(200).json({
            ok: true,
            msg: `La mesa y la sesión fueron reseteadas correctamente`,
            table: tableUpdated
        })


    })

}


// WAITER
let initTables = async (req: Request, res: Response) => {
    // el camarero inicializa las mesas en estado "waiting" (el cliente llegó a la mesa)
    let idTables = req.body.idTables;

    await Table.find({ _id: { $in: idTables } }).then(async tablesDB => {

        if (!tablesDB) {
            return res.status(400).json({
                ok: false,
                msg: 'No existe la mesa que desea inicializar',
                table: null
            })
        }

        const section = await Section.findById(tablesDB[0]?.id_section);
        const session = await TableSession.findById(tablesDB[0]?.id_session);
        const ticket = await Ticket.findById(session?.id_ticket);

        if (!section || !session || !ticket) {
            return res.status(400).json({
                ok: false,
                msg: 'No se pudo obtener el ticket para asignarle estado de inicialización.',
                table: null
            })
        }

        ticket.tm_init = new Date();
        await ticket.save();

        for (let table of tablesDB) {
            table.tx_status = 'busy';
            await table.save();
        }

        server.io.to(section.id_company).emit('update-waiters');
        if (ticket.id_socket_client) {
                server.io.to(ticket.id_socket_client).emit('update-ticket', ticket);
        }

        return res.status(200).json({
            ok: true,
            msg: `Las mesas se inicializaron correctamente`,
            tables: tablesDB
        })


    })

}

// ADMIN: PENDING <-> SCHEDULED -> LO TOMA EL CRON
let assignTablesPending = (req: Request, res: Response) => {
    // asigna mesas a pendientes en agenda 

    var { idTicket, blPriority, cdTables } = req.body;

    Ticket.findById(idTicket).then(async ticketDB => {
        if (!ticketDB) {
            return res.status(400).json({
                ok: false,
                msg: 'No existe el ticket que desea asignar',
                ticket: null
            })
        }


        ticketDB.cd_tables = cdTables;
        // puedo asignar o desasignar
        ticketDB.tx_status = cdTables.length === 0 ? 'pending' : 'scheduled';
        ticketDB.bl_priority = blPriority;

        ticketDB.save().then(ticketSaved => {

            if (!ticketSaved) {
                return res.status(400).json({
                    ok: false,
                    msg: 'Error guardar el ticket',
                    ticket: null
                })
            }

            if (ticketSaved.id_socket_client) { server.io.to(ticketSaved.id_socket_client).emit('update-ticket', ticketSaved); } // mesas proveídas

            return res.status(200).json({
                ok: true,
                msg: 'Mesas asignadas correctamente',
                ticket: ticketSaved
            })

        }).catch(() => {

            return res.status(400).json({
                ok: false,
                msg: 'Error guardar el ticket',
                ticket: null
            })

        })
    })
}

// WAITER: REQUESTED <-> ASSIGNED -> LO TOMA SPM
let assignTablesRequested = (req: Request, res: Response) => {
    // asigna mesas a requeridos en cola virtual 

    var { idTicket, blPriority, blFirst, cdTables } = req.body;

    Ticket.findById(idTicket).then(async ticketDB => {

        if (!ticketDB) {
            return res.status(400).json({
                ok: false,
                msg: 'No existe el ticket que desea asignar',
                ticket: null
            })
        }

        // si des-asigno verifico las mesas del sector, si no hay compatibles queda 'requested'
        let tables = await Table.find({ id_section: ticketDB.id_section })
        let compatibles = tables.filter(table => table.nm_persons >= ticketDB.nm_persons);
        let newStatus;


        if (cdTables.length === 0) {
            // waiter des-asigna todas
            newStatus = compatibles.length === 0 ? 'requested' : 'queued';
        } else {
            // waiter asigna o re-asigna
            newStatus = 'assigned';
        }

        // MESAS RESERVADAS PARA TICKETS EN AGENDA:
        // si waiter RE-asigna mesas y esas mesas estaban reservadas (el cron las reservo para el cliente)
        // entonces des-reserva las des-asignadas 
        // agarro las mesas que tenía, y le saco las nuevas las que quedan las des-reserva
        if (ticketDB.tx_status === 'assigned' && cdTables.length > 0) {
            // ambos asignados, de agenda y cola virtual, pueden tener reservas

            //1. DES-RESERVA DES-ASIGNADAS: obtengo las mesas del ticket que no estan incluidas en cdTables (mesas nuevas)
            //en ticket [1,2,3] nuevas [3,4] obtiene [1,2]
            const missingTables = ticketDB.cd_tables.filter(table => !cdTables.includes(table))
            let tablesToPause = await Table.find({ id_section: ticketDB.id_section, nm_table: { $in: missingTables }, tx_status: 'reserved' });

            if (tablesToPause.length > 0) {
                for (let table of tablesToPause) {
                    table.tx_status = 'paused';
                    await table.save();
                }
            }
            //2. RESERVA NUEVAS ASIGNADAS:
            //en ticket [1,2,3] nuevas [3,4] obtiene [4]
            const newTables = cdTables.filter((table: number) => !ticketDB.cd_tables.includes(table))
            let tablesToReserve = await Table.find({ id_section: ticketDB.id_section, nm_table: { $in: newTables }, tx_status: { $ne: 'busy' } });

            if (tablesToReserve.length > 0) {
                for (let table of tablesToReserve) {
                    table.tx_status = 'reserved';
                    await table.save();
                }
            }
        }

        ticketDB.cd_tables = cdTables; // asigno las mesas nuevas al ticket
        ticketDB.tx_status = newStatus;
        ticketDB.bl_priority = blPriority;
        ticketDB.save().then(ticketSaved => {
            server.io.to(ticketSaved.id_company).emit('update-waiters'); // mesas proveídas

            if (ticketSaved.id_socket_client) server.io.to(ticketSaved.id_socket_client).emit('update-clients'); // mesas proveídas

            if (blPriority || blFirst) {

                let tablesToProvide: Table[] = [];
                // obtengo las mesas para pasarle a provide()
                if (ticketSaved.tx_status === 'queued') {
                    tablesToProvide = [compatibles[0]]; // todo: debe tomar la mesa mas compatible, no la primera
                }

                else if (ticketSaved.tx_status === 'assigned') {
                    tablesToProvide = tables.filter(table => ticketDB.cd_tables?.includes(table.nm_table));
                }

                else if (ticketSaved.tx_status === 'requested' || cdTables.length === 0) {
                    return res.status(200).json({
                        ok: true,
                        msg: 'El ticket quedo requerido a la espera de asignación',
                        tables: null
                    })
                }

                spm.provide(tablesToProvide, ticketSaved).then((resp) => {

                    return res.status(200).json({
                        ok: true,
                        msg: resp,
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
        }).catch(() => {

            return res.status(400).json({
                ok: false,
                msg: 'Error guardar el ticket',
                ticket: null
            })

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
    resetTable,
    initTables,
    assignTablesPending,
    assignTablesRequested,
    deleteTable
}
