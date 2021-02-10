import { Table } from "../models/table.model";
import { TableSession } from "../models/table.session.model";
import { Ticket } from "../models/ticket.model";
import { Settings } from '../models/settings.model';
import Server from './server';

// SPM:
// PUSH(), PULL() Y PROVIDE()

// spm.push() 
// a partir del ticket busca una mesa COMPATIBLE, si no 
// existe guardo el ticket como 'requested' si existe verifico si hay mesa DISPONIBLE, si no existe 
// existe guardo el ticket como 'queued' y si existe y es compatible y disponible se lo pasa a provide().

// spm.pull() 
// a partir de esa mesa busca tickets con el siguiente orden
// 1. 'assigned' con mesa liberada asignada && 'priority', 
// 2. 'queued' && 'priority'
// 3. 'assigned' con mesa liberada asignada ó 'queued' compatible con la mesa liberada. 
// Si encuentra mas de un ticket respeta orden FIFO, luego verifica si es 'assigned' busca todas las mesas 
// asignadas y la pasa a provide(), si es 'queued' lo pasa a provide() directamente.

// spm.provide() 
// recibe un array de una o mas mesas y un ticket, es el metodo de provisión de mesas para 
// spm.pull(), spm.push() y para assignTables(), en donde ya tengo seleccionadas las mesas a aprovisionar.

// spmAuto ON, 
// toggleTableStatus() -> pull() busca tickets 'assigned' ó 'queued' -> provide() [OK]
// createTicket() -> push() busca mesas 'idle' y compatibles -> provide() [OK]

// spmAuto OFF, 
// toggleTableStatus() -> pull() busca tickets solo 'assigned' -> provide() [OK]
// assignTables() -> asingación manual de mesas -> provide() [OK]

export default class Spm {

    private constructor() { }

    // a partir de un ticket 'queued' busca mesa 'idle' si encuentra la pasa a spmProvide
    // este método queda sin efecto en modo MANUAL (bl_spm_auto=false)
    public static push = (ticket: Ticket): Promise<string> => {

        return new Promise((resolve, reject) => {

            Table.find({
                nm_persons: { $gte: ticket.nm_persons },
                id_section: ticket.id_section
            }).then(compatibleTablesDB => {

                if (compatibleTablesDB.length === 0) {
                    Ticket.findByIdAndUpdate(ticket._id, { tx_status: 'requested' }, { new: true }).then((ticketRequested) => {
                        resolve('Sin mesa compatible, el ticket quedo requerido');
                    })
                    return;
                }

                // existen mesas compatibles para la solicitud verifico disponibilidad
                let idleTables = compatibleTablesDB.filter(table => table.tx_status === 'idle');

                if (idleTables.length === 0) {
                    // no hay disponibilidad queda en cola
                    resolve('Sin mesa disponible, el ticket quedo en cola');
                    return;
                } else {

                    const respProvide = Spm.provide([idleTables[0]], ticket);
                    resolve(respProvide);
                    return;

                }

            }).catch(() => {
                reject()
            })

        })
    }

    // a partir de una mesa 'idle' busca un ticket compatible, 
    // si es 'queued' lo pasa a spmProvide
    // si es 'assigned' busca las mesas asignadas y lo pasa a spmProvide()
    public static pull = (table: Table): Promise<string> => {

        return new Promise((resolve, reject) => {

            let year = new Date().getFullYear();
            let month = new Date().getMonth();
            let day = new Date().getDate();
            let time = new Date(year, month, day);

            // busco el primer turno (sin filtro por cantidad de comensales)
            Ticket.find({
                id_section: table.id_section,
                // Con la creación de agenda, los tickets pueden haber sido creados ANTES que la fecha de hoy
                //  tm_start: { $gt: time }, 
                tm_provided: null,
                tm_att: null,
                tm_end: null
            })
                .then(async (ticketsDB: Ticket[]) => {

                    // No hay tickets en espera la mesa queda IDLE.
                    if (ticketsDB.length === 0) { return resolve('No hay tickets para esta mesa') }

                    // Secuencia en prioridad de asignación de mesa liberada con orden FIFO

                    // AUTOMATIC MODE 
                    // 1. primer 'assigned' que le corresponda la mesa con priority true
                    // 2A. primer 'queued' compatible con la mesa con priority true
                    // 3A. primer 'assigned' que le corresponda la mesa ó 'queued' compatible con la mesa 

                    // MANUAL AUTOMATIC
                    // 1. primer 'assigned' que le corresponda la mesa con priority true
                    // 2B. primer 'assigned' que le corresponda la mesa 

                    // declaro el ticket, si lo encuentro se lo voy a pasar a provide()
                    let ticketToProvide: Ticket;

                    // 1. (AUTO ON AND OFF)
                    ticketToProvide = ticketsDB.filter((ticket: Ticket) =>
                        ticket.tx_status === 'assigned' &&
                        ticket.cd_tables?.includes(table.nm_table) &&
                        ticket.bl_priority === true
                    )[0];

                    // obtengo las configuraciones para el comercio
                    const settings = await Settings.findOne({ id_company: ticketsDB[0].id_company });

                    if (settings?.bl_spm_auto) {
                        // AUTO ON
                        // 2A.
                        if (!ticketToProvide) {
                            ticketToProvide = ticketsDB.filter((ticket: Ticket) =>
                                ticket.tx_status === 'queued' &&
                                ticket.nm_persons <= table.nm_persons &&
                                ticket.bl_priority === true
                            )[0];
                        }

                        // 3A. primer 'assigned' que le corresponda la mesa ó 'queued' de características compatibles con la mesa 
                        if (!ticketToProvide) {
                            ticketToProvide = ticketsDB.filter((ticket: Ticket) =>
                                (ticket.tx_status === 'assigned' && ticket.cd_tables?.includes(table.nm_table)) ||
                                (ticket.tx_status === 'queued' && ticket.nm_persons <= table.nm_persons)
                            )[0];
                        }

                    } else {
                        // AUTO OFF
                        // 2B. primer 'assigned' que le corresponda la mesa 
                        if (!ticketToProvide) {
                            ticketToProvide = ticketsDB.filter((ticket: Ticket) =>
                                (ticket.tx_status === 'assigned' && ticket.cd_tables?.includes(table.nm_table))
                            )[0];
                        }

                    }


                    // Encontró un ticket para proveerle la mesa.
                    if (ticketToProvide) {
                        if (ticketToProvide.tx_status === 'assigned') {

                            // si es 'assigned' el camarero le asigno mas de una mesa, 
                            // busco TODAS las mesas en el ticket y se las paso a provide()
                            Table.find({
                                id_section: table.id_section,
                                nm_table: { $in: ticketToProvide.cd_tables }
                            }).then(tablesDB => {
                                Spm.provide(tablesDB, ticketToProvide).then((resp: string) => {
                                    return resolve(resp)
                                }).catch((resp) => {
                                    return reject(resp)
                                })
                            })
                        }

                        // si es 'queued' el sistema le asigno una mesa única
                        else if (ticketToProvide.tx_status === 'queued') {
                            Spm.provide([table], ticketToProvide).then((resp: string) => {
                                return resolve(resp)
                            }).catch((resp) => {
                                return reject(resp)
                            })
                        }

                    } else {

                        return resolve('No hay tickets para asignar a esta mesa')

                    }

                })
        })
    }

    public static provide = (tables: Table[], ticket: Ticket): Promise<string> => {
        return new Promise(async (resolve, reject) => {

            let allReserved = false;
            if (ticket.tx_status === 'assigned') {
                for (let [index, table] of tables.entries()) {
                    if (table.tx_status === 'idle' || table.tx_status === 'paused') {
                        table.tx_status = 'reserved';
                        await table.save();
                    }
                }
            }

            let tablesReservedCount = tables.filter(table => table.tx_status === 'reserved').length;

            allReserved = tablesReservedCount === ticket.cd_tables?.length ? true : false;

            if (ticket.tx_status === 'assigned' && !allReserved) {
                return resolve(`Se reservaron ${tablesReservedCount} de ${ticket.cd_tables?.length} mesas para el ticket ${ticket.id_position} de ${ticket.tx_name}`)
            }

            if ((ticket.tx_status === 'assigned' && allReserved) || (ticket.tx_status === 'queued')) {

                let session = new TableSession();
                let idTables: string[] = tables.map(table => table._id);
                session.id_tables = idTables;
                session.id_ticket = ticket._id;
                session.tm_start = new Date();
                session.save().then(async sessionSaved => {

                    for (let [index, table] of tables.entries()) {
                        table.tx_status = 'waiting';
                        table.id_session = sessionSaved._id;

                        await table.save().then(async tableSaved => {
                            ticket.tx_status = 'provided';
                            ticket.id_session = tableSaved.id_session;
                            ticket.tm_provided = new Date();
                            await ticket.save().then(async ticketSaved => {
                                if (index === tables.length - 1) {
                                    const server = Server.instance; // singleton
			                        server.io.to(ticket.id_company).emit('update-waiters');
                                    if (ticket.id_socket_client) { server.io.to(ticket.id_socket_client).emit('update-ticket', ticket); }

                                    return resolve(`Por favor, avise a ${ticket.tx_name} con el ticket ${ticket.id_position} que pase a la mesa ${ticket.cd_tables}`);
                                }
                            }).catch(() => reject('Error guardando nuevo estado de ticket'))
                        }).catch(() => reject('Error guardando nuevo estado de mesa'))
                    }

                }).catch(() => reject('Error guardando sesion de mesa'))
            }
        })
    }

}