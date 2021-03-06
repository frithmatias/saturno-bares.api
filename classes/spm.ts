import { Table } from "../models/table.model";
import { TableSession } from "../models/table.session.model";
import { Ticket } from "../models/ticket.model";
import { Settings } from '../models/settings.model';
import Server from './server';
import { Notification } from "../models/notification.model";

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
    // este método queda sin efecto en modo MANUAL (bl_spm=false)
    public static push = (ticket: Ticket): Promise<string> => {

        return new Promise((resolve, reject) => {

            Table.find({
                nm_persons: { $gte: ticket.nm_persons },
                id_section: ticket.id_section
            }).then(compatibleTablesDB => {

                if (compatibleTablesDB.length === 0) {
                    Ticket.findByIdAndUpdate(ticket._id, { tx_status: 'requested' }, { new: true }).then((ticketRequested) => {
                        resolve('Sin mesa compatible, el ticket quedo requerido');
                        const notif = new Notification({ // TICKET REQUESTED (CV)
                            id_owner: [ticket.id_company, ticket.id_section], // company->admin && section->waiter
                            tx_icon: 'mdi-alert-circle-outline',
                            tx_title: 'Solicitud de Mesa Especial Cola Virtual',
                            tx_message: `Debe asignar mesas para una solicitud de mesa especial a nombre de ${ticket.tx_name}.`,
                            tm_notification: new Date(),
                            tm_event: null,
                            tx_link: '/waiter/section'

                        });
                        notif.save();
                        const server = Server.instance; // singleton
                        server.io.to(ticket.id_company).emit('update-waiter'); // table reserved
                        server.io.to(ticket.id_company).emit('update-admin'); // table reserved
                    })

                    return;
                }

                // existen mesas compatibles para la solicitud verifico disponibilidad
                let idleTables = compatibleTablesDB.filter(table => table.tx_status === 'idle');

                if (idleTables.length === 0) {
                    // no hay disponibilidad queda en cola
                    resolve('Sin mesa disponible, el ticket quedo en cola');
                    const notif = new Notification({ // TICKET QUEUED (CV)
                        id_owner: [ticket.id_company, ticket.id_section], // company->admin && section->waiter
                        tx_icon: 'mdi-human-queue',
                        tx_title: 'Nuevo cliente esperando mesa',
                        tx_message: `El cliente ${ticket.tx_name} espera una mesa para ${ticket.nm_persons}.`,
                        tm_notification: new Date(),
                        tm_event: null,
                        tx_link: '/waiter/section'
                    });
                    notif.save();
                    const server = Server.instance; // singleton
                    server.io.to(ticket.id_company).emit('update-waiter'); // table reserved
                    server.io.to(ticket.id_company).emit('update-admin'); // table reserved
                    return;
                } else {
                    // todo: a provide() le debo pasar la mesa mas compatible, no la primera
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
                    if (ticketsDB.length === 0) { return resolve('Pull: No hay tickets asignados para esta mesa') }

                    // Secuencia en prioridad de asignación de mesa liberada con orden FIFO

                    // 1. primer 'assigned' que le corresponda la mesa con priority true

                    // SPM: ON - AUTOMATIC  
                    // 2A. primer 'queued' compatible con la mesa con priority true
                    // 3A. primer 'assigned' que le corresponda la mesa ó 'queued' compatible con la mesa 

                    // SPM: OFF - MANUAL (no aprovisiona queued)
                    // 2B. primer 'assigned' que le corresponda la mesa 

                    // declaro el ticket, si lo encuentro se lo voy a pasar a provide()
                    let ticketToProvide: Ticket;

                    // 1. (SPM: ON || SPM: OFF)
                    ticketToProvide = ticketsDB.filter((ticket: Ticket) =>
                        ticket.tx_status === 'assigned' &&
                        ticket.cd_tables?.includes(table.nm_table) &&
                        ticket.bl_priority === true
                    )[0];

                    // obtengo las configuraciones para el comercio
                    const settings = await Settings.findOne({ id_company: ticketsDB[0].id_company });

                    if (settings?.bl_spm) {
                        // SPM: ON
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
                        // SPM: OFF
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

            // Si se trata de un asignado, tenga una o mas mesas, o sea un asignado por agenda o por cola virtual,
            // las mesas siempre se RESERVAN antes una por una antes de ponerlas en estado WAITING y el ticket en 
            // estado PROVIDED.
            let allReserved = false;
            if (ticket.tx_status === 'assigned') {
                for (let [index, table] of tables.entries()) {
                    // La mesa puede salir del estado PAUSED y pasar a RESERVED SOLO si la mesa esta IDLE 
                    // (o si esta PAUSED pero el ticket viene de Agenda)
                    if (table.tx_status === 'idle' || (ticket.tm_intervals && table.tx_status === 'paused')) {
                        table.tx_status = 'reserved';
                        table.id_ticket = ticket._id;
                        await table.save();
                    }
                }
            }
            let tablesReservedCount = tables.filter(table => table.tx_status === 'reserved' && table.id_ticket === ticket._id.toString()).length;

            allReserved = tablesReservedCount === ticket.cd_tables?.length ? true : false;

            if (ticket.tx_status === 'assigned' && !allReserved) {
                return resolve(`Se reservaron ${tablesReservedCount} de ${ticket.cd_tables?.length} mesas para el ticket ${ticket.id_position} de ${ticket.tx_name}`)
            }

            if ((ticket.tx_status === 'assigned' && allReserved) || (ticket.tx_status === 'queued')) {

                // 1. Start Session
                let session = new TableSession();
                let idTables: string[] = tables.map(table => table._id);
                session.id_tables = idTables;
                session.id_ticket = ticket._id;
                session.tm_start = new Date();
                session.save().then(async sessionSaved => {

                    // 2. Set Each Table as WAITING customer
                    for (let [index, table] of tables.entries()) {
                        table.tx_status = 'waiting';
                        table.id_session = sessionSaved._id;

                        // 3. Set Ticket as PROVIDED
                        await table.save().then(async tableSaved => {
                            ticket.tx_status = 'provided';
                            ticket.id_session = tableSaved.id_session;
                            ticket.cd_tables = tables.map(table => table.nm_table); // tickets from vqueue have NOT assigned tables yet
                            ticket.tm_provided = new Date();
                            await ticket.save().then(async ticketSaved => {
                                if (index === tables.length - 1) {

                                    const notif = new Notification({ // TICKET PROVIDED (CV)
                                        id_owner: [ticket.id_company, ticket.id_section], // company->admin && section->waiter
                                        tx_icon: 'mdi-silverware-fork-knife',
                                        tx_title: 'Mesas proveídas',
                                        tx_message: `El cliente ${ticket.tx_name} tiene mesa/s aprovisionadas. Por favor guíelo hacia su mesa.`,
                                        tm_notification: new Date(),
                                        tm_event: null,
                                        tx_link: '/waiter/section'
                                    });
                                    notif.save();
                                    const server = Server.instance; // singleton
                                    server.io.to(ticket.id_company).emit('update-waiter'); // table reserved
                                    server.io.to(ticket.id_company).emit('update-admin'); // table reserved

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