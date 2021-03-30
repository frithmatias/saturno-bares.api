// MODELS
import { Ticket } from '../models/ticket.model';
import { Position } from '../models/position.model';
import { Table } from '../models/table.model';
import { Section } from '../models/section.model';
import { TableSession } from '../models/table.session.model';
import { Settings } from '../models/settings.model';
import { Request, Response } from 'express';
import Server from '../classes/server';
import spm from '../classes/spm';
import cron from 'node-cron';
import moment from 'moment';
import Mail from '../classes/mail';

// run cron
cron.schedule('*/10 * * * * *', () => {
	checkTickets();
})

// set moment locales
moment.locale('es');

// const reserve = "2021-02-25T00:00:00.000Z";
// cnsole.log(moment(reserve).format('DD [de] MMMM [a las] HH:mm')) // 24 de febrero a las 21:00
// cnsole.log(moment(reserve).fromNow()); // en 9 dias

// ========================================================
// interfaces
// ========================================================

interface availability {
	interval: Date;
	compatible: number[];
	available: avData[] | null; // filled if has NOT compatible tables
	capacity: number | null; // -> number when has NOT compatible tables, null if has compatible options  
}

interface avData {
	nmTable: number,
	nmPersons: number,
	blReserved: boolean,
	ticketOwner?: Ticket
}


// ========================================================
// system methods
// ========================================================

async function checkTickets() {
	// Chequea la CADUCIDAD de los tickets según su estado.

	const server = Server.instance; // singleton

	// at least 1 element should exist
	// Con TM_INTERVALS.0 sólo voy a manejar los tickets con intervalos, es decir los que entraron por AGENDA. 
	// 'tm_intervals.0': { $exists: true },
	let tickets: Ticket[] = await Ticket.find({ tm_end: null }).populate('id_company');
	let waiting = tickets.filter(ticket => ticket.tx_status === 'waiting');
	let pending = tickets.filter(ticket => ticket.tx_status === 'pending');
	let scheduled = tickets.filter(ticket => ticket.tx_status === 'scheduled');
	let assigned = tickets.filter(ticket => ticket.tx_status === 'assigned');
	let provided = tickets.filter(ticket => ticket.tx_status === 'provided');
	let queued = tickets.filter(ticket => ticket.tx_status === 'queued');
	let requested = tickets.filter(ticket => ticket.tx_status === 'requested');

	console.table({
		'waiting': waiting.length,
		'pending': pending.length,
		'scheduled': scheduled.length,
		'assigned': assigned.length,
		'provided': provided.length,
		'queued': queued.length,
		'requested': requested.length,
	});


	// ┌───────────┬────────┐
	// │  (index)  │ Values │
	// ├───────────┼────────┤
	// │  waiting  │   1    │ CHECKED ✔
	// │  pending  │   0    │ CHECKED ✔
	// │ scheduled │   0    │ CHECKED ✔
	// │ assigned  │   0    │ CHECKED ✔
	// │ provided  │   0    │ CHECKED ✔
	// │  queued   │   0    │
	// │ requested │   0    │
	// └───────────┴────────┘

	// -------------------------------------------------------------
	// TTK: TIME-TO-KILL: KILL 'WAITING' NOT CONFIRMED AFTER 10MIN FROM TM_START	
	// -------------------------------------------------------------

	for (let ticket of waiting) {
		const now = +new Date();
		const ttk = (now - ticket.tm_start?.getTime()) >= 10 * 60 * 1000; // Time To Terminate Waiting Tickets 10 minutes 
		if (ttk) {
			ticket.tx_status = 'killed';
			ticket.tm_end = new Date();
			await ticket.save().then((ticketSaved) => {
				server.io.to(ticket.id_company._id).emit('update-admin'); // schedule update
				console.log('System: ', `Ticket WAITING de ${ticketSaved.tx_name} sin confirmar terminado.`)
				if (ticket.id_socket_client) { server.io.to(ticket.id_socket_client).emit('update-ticket', ticket); }
			})
		}
	}

	// -------------------------------------------------------------
	// TTK: TIME-TO-KILL: KILL 'PENDING' NOT CONFIRMED BY ADMIN BEFORE 1HR FROM TM_INTERVALS[0]	
	// -------------------------------------------------------------

	for (let ticket of pending) {
		const now = +new Date();
		const ttk = (ticket.tm_intervals[0]?.getTime() - now) <= 60 * 60 * 1000;
		if (ttk) {
			ticket.tx_status = 'killed';
			ticket.tm_end = new Date();
			await ticket.save().then((ticketSaved) => {
				server.io.to(ticket.id_company._id).emit('update-admin'); // schedule update
				console.log('System: ', `Ticket PENDING de ${ticketSaved.tx_name} sin confirmar por el comercio terminado.`)
				if (ticket.id_socket_client) { server.io.to(ticket.id_socket_client).emit('update-ticket', ticket); }
			})
		}
	}

	// -------------------------------------------------------------
	// TTR: TIME-TO-RESERVE: IF TABLES ARE NOT BUSY SET 'RESERVED' BEFORE 1:30HS AT TM_INTERVALS[0] AND SET TICKET TO 'ASSIGNED'
	// TTF: TIME-TO-FORCE-RESERVE: IF TABLES ARE BUSY FORCE TO SET 'RESERVED' BEFORE 20MIN AT TM_INTERVALS[0] AND SET TICKET TO 'ASSIGNED'
	// -------------------------------------------------------------

	for (let ticket of scheduled) {

		// relative reservetion time from now to define event
		const now = +new Date();
		const ttr = (ticket.tm_intervals[0]?.getTime() - now) <= 90 * 60 * 1000; // Time To Reserve 1:30hs (3 intervals)
		const ttf = (ticket.tm_intervals[0]?.getTime() - now) <= 20 * 60 * 1000; // Time To Force Reserve 0:20hs (20 min)

		if (ttr || ttf) {
			// company and reservation data for email pourposes
			const txPlatform = ticket.tx_platform;
			const txEmail = ticket.tx_email;
			const txName = ticket.tx_name;
			const txCompanyName = ticket.id_company.tx_company_name;
			const txCompanyAddress = ticket.id_company.tx_address_street + ' ' + ticket.id_company.tx_address_number;
			const cdTables = ticket.cd_tables;
			const cdTablesStr = ticket.cd_tables.length > 1 ? 'las mesas' : 'la mesa';

			await Table.find({ id_section: ticket.id_section, nm_table: { $in: ticket.cd_tables } }).then(async tablesToReserve => {

				if (!tablesToReserve) {
					return;
				}

				let allReserved = false;

				for (let [index, table] of tablesToReserve.entries()) {
					if (ttf || table.tx_status === 'idle' || table.tx_status === 'paused') {

						// SET TO TABLE 'RESERVED' STATUS AND ID_TICKET
						table.id_session = null;
						table.tx_status = 'reserved';
						table.id_ticket = ticket._id;

						await table.save().then(() => {
							server.io.to(ticket.id_company._id).emit('update-waiters');
							server.io.to(ticket.id_company._id).emit('update-admin'); // schedule update
						})

						// FINISH CURRENT TABLESESSION AND CURRENT TICKET
						if (ttf) {
							const session = await TableSession.findByIdAndUpdate(table.id_session, { tm_end: new Date() });
							const ticket = await Ticket.findByIdAndUpdate(session?.id_ticket, { tm_end: new Date(), tx_status: 'terminated' }, { new: true });
							if (ticket?.id_socket_client) {
								server.io.to(ticket.id_socket_client).emit('update-ticket', ticket);
							}
						}

					}
				}

				// READ TOTAL RESERVED TABLES FOR THE TICKET
				let tablesReservedCount = tablesToReserve.filter(table => table.tx_status === 'reserved' && table.id_ticket === ticket._id.toString()).length;
				allReserved = tablesReservedCount === ticket.cd_tables?.length ? true : false;

				// IF ALL TABLES ARE RESERVED CHANGE TICKET STATUS TO 'ASSIGEND'
				if (allReserved) {

					ticket.tx_status = 'assigned';
					await ticket.save().then((ticketSaved: Ticket) => {

						if ((txPlatform === 'facebook' || txPlatform === 'google') && txEmail) {
							const messageToUser = `
Hola ${txName}, ya te reservamos ${cdTablesStr} ${cdTables} en ${txCompanyName}!. 

Te esperamos en ${txCompanyAddress}.

Para ver todas tus reservas o cancelarlas por favor hace click aquí:
https://saturno.fun/public/tickets

Muchas Gracias!
Saturno.fun`;
							Mail.sendMail('reservas', txEmail, messageToUser);
						}

						if (ticket.id_socket_client) { server.io.to(ticket.id_socket_client).emit('update-ticket', ticketSaved); }
					})
				}
			})
		}
	}

	// -------------------------------------------------------------
	// TTP: TIME-TO-PROVIDE: PROVIDE TABLES	
	// -------------------------------------------------------------

	for (let ticket of assigned) {

		// si no tiene intervalos, es un asignado por cola virtual, 
		// el cron sólo provee tickets en agenda, se omite.
		if (!ticket.tm_intervals) {
			continue;
		}

		const now = +new Date();
		const ttp = (ticket.tm_intervals[0]?.getTime() - now) <= 0; // Time To Provide (o'clock)
		if (ttp) {
			Table.find({ id_section: ticket.id_section, nm_table: { $in: ticket.cd_tables } }).then(tablesToProvide => {
				if (!tablesToProvide) {
					return;
				}
				//CRON IN-TIME: proveyendo ticket y estableciendo estado waiting a las mesas asignadas...
				spm.provide(tablesToProvide, ticket).then(data => {
					server.io.to(ticket.id_company._id).emit('update-admin'); // schedule update
					server.io.to(ticket.id_company._id).emit('update-waiters');
				})
			})
		}
	}

	// -------------------------------------------------------------
	// TTT: TIME-TO-TERMINATE: TERMINATE TICKETS INITIALIZED AFTER 3HRS FROM TM_PROVIDE, OR 30MINS IF WAS NOT INITIALIZED	
	// -------------------------------------------------------------

	for (let ticket of provided) {
		const now = +new Date();
		if (!ticket.tm_provided) continue;


		// If then the customer is in the table, table was initialized and the ticket has tm_init, then the threshold is 3hrs.
		// If the customer did not arrive at the table, the ticket is killed in 30 minutes. 

		const threshold: number = ticket.tm_init ? 3 * 60 * 60 * 1000 : 30 * 60 * 1000;
		const ttt = now - ticket.tm_provided.getTime() >= threshold;

		if (ttt) {

			const session = await TableSession.findByIdAndUpdate(ticket.id_session, { tm_end: new Date() });
			if (!session) return;

			for (let table of session?.id_tables) {
				await Table.findById(table).then(tableDB => {
					if (!tableDB) return;
					tableDB.id_session = null;
					tableDB.tx_status = 'paused';
					tableDB.id_ticket = null;
					tableDB?.save()
				})
			}

			const ticketUpdated = await Ticket.findByIdAndUpdate(ticket._id, { tm_end: new Date(), tx_status: 'terminated' }, { new: true });

			server.io.to(ticket.id_company._id).emit('update-waiters');
			if (ticketUpdated?.id_socket_client) {
				server.io.to(ticketUpdated.id_socket_client).emit('update-ticket', ticketUpdated);
			}
		}
	}

};

// ========================================================
// waiter methods
// ========================================================

function attendedTicket(req: Request, res: Response) {
	const server = Server.instance; // singleton

	const idTicket = req.body.idTicket;
	Ticket.findByIdAndUpdate(idTicket, { tx_call: null, tm_call: null }, { new: true }).then(ticketAttended => {
		if (ticketAttended) {
			server.io.to(ticketAttended.id_company).emit('update-waiters');
			server.io.to(ticketAttended.id_company).emit('update-clients');
			return res.status(200).json({
				ok: true,
				msg: 'El llamado al camarero fue atendido.',
				ticket: ticketAttended
			})
		}
	}).catch(() => {
		return res.status(400).json({
			ok: false,
			msg: 'Ocurrio un error al guardar la atención del camarero en el ticket.',
			ticket: null
		})
	})
};

function releaseTicket(req: Request, res: Response) {

	const ticket: Ticket = req.body.ticket;
	const server = Server.instance; // singleton

	let newStatus;

	if (ticket.tm_intervals) {
		newStatus = 'scheduled';
	} else {
		if (ticket.cd_tables) {
			newStatus = ticket.cd_tables.length > 0 ? 'assigned' : 'queued';
		} else {
			newStatus = 'queued';
		}
	}

	Ticket.findByIdAndUpdate(ticket._id, {
		tx_status: newStatus,
		id_session: null,
		tm_init: null,
		tm_provided: null,
		tm_att: null
	}, { new: true }).then((ticketReleased) => {

		if (!ticketReleased) {
			return res.status(400).json({
				ok: false,
				msg: "No se pudo guardar el ticket con su estado anterior",
				ticket: null
			})
		}


		if (ticketReleased.id_socket_client) {
			server.io.to(ticketReleased.id_socket_client).emit('update-ticket', ticketReleased);
		}

		// cierro la sesión de la mesa
		let idSession = ticket.id_session;

		TableSession.findByIdAndUpdate(idSession, { tm_end: new Date() }).then(async tableSessionCancelled => {

			if (!tableSessionCancelled) {
				return res.status(400).json({
					ok: false,
					msg: "No se pudo cancelar la sesión de la mesa",
					ticket: null
				})
			}

			// libero las mesas del ticket
			for (let idTable of tableSessionCancelled?.id_tables) {
				await Table.findByIdAndUpdate(idTable, { tx_status: 'paused', id_session: null });
			}

			// ticket released, update waiters table list
			server.io.to(ticketReleased.id_company).emit('update-waiters');

			return res.status(200).json({
				ok: true,
				msg: "Mesas liberadas correctamente",
				ticket: null
			})

		}).catch(() => {
			return res.status(400).json({
				ok: false,
				msg: "No se pudo cancelar la sesion de mesa",
				ticket: null
			})
		})

	}).catch(() => {
		return res.status(400).json({
			ok: false,
			msg: "No se pudo finalizar el ticket",
			ticket: null
		})
	})
}

async function endTicket(req: Request, res: Response) {
	const idTicket = req.body.idTicket;
	const reqBy = req.body.reqBy;
	const newStatus = reqBy === 'waiter' ? 'finished' : 'cancelled';
	await Ticket.findByIdAndUpdate(idTicket, { tx_status: newStatus, tm_end: new Date() }, { new: true })
		.populate('id_section')
		.then(async (ticketCancelled) => {

			if (!ticketCancelled) {
				return res.status(400).json({
					ok: false,
					msg: 'No se puedo cancelar el ticket',
					ticket: ticketCancelled
				})
			}

			const server = Server.instance; // singleton
			server.io.to(ticketCancelled.id_company).emit('update-admin'); //schedule update

			if (ticketCancelled?.id_session) {

				let idSession = ticketCancelled.id_session;
				// si ya tenía asignada una sesión de mesa, pauso la mesa y cierro su sesión.
				await TableSession.findByIdAndUpdate(idSession, { tm_end: new Date() }).then(async sessionCanceled => {
					// let new_status = ticketCancelled.tm_att === null ? 'idle' : 'paused';

					if (!sessionCanceled) {
						return;
					}

					// en una sesión de mesa puedo tener asignadas una o mas mesas
					for (let idTable of sessionCanceled?.id_tables) {
						await Table.findByIdAndUpdate(idTable, { tx_status: 'paused', id_ticket: null, id_session: null });
					}


					server.io.to(ticketCancelled.id_company).emit('update-waiters');

					if (ticketCancelled.id_socket_client) {
						server.io.to(ticketCancelled.id_socket_client).emit('update-ticket', ticketCancelled); // ticket-create component
					}

					return res.status(200).json({
						ok: true,
						msg: "Ticket finalalizado correctamente",
						ticket: null
					})

				}).catch(() => {

					return res.status(400).json({
						ok: false,
						msg: "No se pudo cancelar la sesion de mesa",
						ticket: null
					})

				})

			} else {

				const server = Server.instance; // singleton
				server.io.to(ticketCancelled.id_company).emit('update-waiters');
				server.io.to(ticketCancelled.id_company).emit('update-clients'); //ticket component
				if (ticketCancelled.id_socket_client) {
					server.io.to(ticketCancelled.id_socket_client).emit('update-ticket', ticketCancelled); // ticket-create component
				}
				return res.status(200).json({
					ok: true,
					msg: "Ticket finalizado correctamente",
					ticket: ticketCancelled
				})
			}



		}).catch(() => {
			return res.status(400).json({
				ok: false,
				msg: "No se pudo finalizar el ticket",
				ticket: null
			})
		})
}

// ========================================================
// public methods
// ========================================================

async function readAvailability(req: Request, res: Response) {

	const nmPersons = req.body.nmPersons;
	const idSection = req.body.idSection;
	const dtReserve = req.body.dtReserve; // '2021-03-16T03:00:00.000Z' utc

	const dayStart = new Date(dtReserve);
	const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);

	let compatibleTables: number[] = []; // ie. [2,3,5,8] -> only compatible tables
	let sectionTables: number[] = []; // all tables numbers
	let sectionTablesFull: avData[] = [];  // all tables numbers and persons
	let tickets: Ticket[] = []; // tickets agendados para el día seleccionado y que tengan mesas compatibles asignadas
	let availability: availability[] = []; // return availability

	// -----------------------------------
	// TABLES
	// -----------------------------------

	// ALL TABLES IN SECTION
	await Table.find({ id_section: idSection })
		.then(resp => {
			sectionTables = resp.map(table => table.nm_table);
			sectionTablesFull = resp.map(table => {
				return {
					nmTable: table.nm_table,
					nmPersons: table.nm_persons,
					blReserved: false
				}
			})
		}).catch(() => {
			return res.status(500).json({
				ok: false,
				msg: 'Error al obtener todas las mesas del sector',
				availability
			})
		})

	// COMPATIBLE TABLES IN SECTION 
	await Table.find({ id_section: idSection, nm_persons: { $gte: nmPersons } })
		.then(resp => compatibleTables = resp.map(table => table.nm_table))
		.catch(() => {
			return res.status(500).json({
				ok: false,
				msg: 'Error al obtener las mesas compatibles',
				availability
			})
		})



	// -----------------------------------
	// TICKETS
	// -----------------------------------

	if (compatibleTables.length > 0) {

		// Si hay mesas compatibles busco los tickets que te tengan asignados esas mesas compatibles
		await Ticket.find({
			id_section: idSection,
			tx_status: { $in: ['scheduled', 'waiting'] },
			'tm_intervals.0': { $gte: dayStart, $lt: dayEnd },
			cd_tables: { $in: compatibleTables }
		}).then(resp => {
			tickets = resp
		}).catch(() => {
			return res.status(500).json({
				ok: false,
				msg: 'Error al obtener los tickets en la agenda',
				availability
			})
		})
	} else {
		// Si NO hay mesas compatibles obtengo TODOS los tickets del día para obtener la disponibilidad del sector
		await Ticket.find({
			id_section: idSection,
			tx_status: { $in: ['scheduled', 'waiting'] },
			'tm_intervals.0': { $gte: dayStart, $lt: dayEnd }
		}).then(resp => {
			tickets = resp
		}).catch(() => {
			return res.status(500).json({
				ok: false,
				msg: 'Error al obtener los tickets en la agenda',
				availability
			})
		})
	}

	let sectionDB: any = await Section.findById(idSection);
	let settingsDB: any = await Settings.findOne({ id_company: sectionDB.id_company });

	const dayWeekReserve = new Date(dtReserve).getDay(); // 0-6 (0 do - 6 sa)
	const workingIntervals = settingsDB.tm_working[dayWeekReserve];

	let intervals: Date[] = [];

	let intervalUTCdate = new Date(dayStart);

	for (let int of [...Array(48).keys()]) {
		const interval_hr = Math.trunc(int / 2); // parte entera de un decimal
		const interval_min = int % 2 === 0 ? 0 : 30;
		const hr = new Date(intervalUTCdate.getTime() + interval_hr * 60 * 60 * 1000 + interval_min * 60 * 1000);
		intervals.push(hr);
	}

	for (let [index, interval] of intervals.entries()) {

		// obtengo UTC del intervalo
		const interval_code = interval.getUTCHours() * 100 + interval.getMinutes();

		if (!workingIntervals.includes(interval_code)) {
			continue;
		}

		// obtengo todas las mesas disponibles/comatibles y a partir de la disponibilidad resto las reservadas para cada intervalo
		let availableTables: number[] = compatibleTables.length > 0 ? compatibleTables : sectionTables;

		if (!workingIntervals.includes(interval_code)) {
			//continue; // omit just this loop
		}

		// TABLES RESERVED PREVIOUS INTERVAL
		let PrevInterval: Date = index === 0 ? new Date(intervalUTCdate.setUTCHours(dayStart.getUTCHours() - 1, 30, 0, 0)) : intervals[index - 1];
		let PrevTickets: Ticket[] = tickets.filter(ticket => !!ticket.tm_intervals.find(d => d.getTime() === PrevInterval.getTime()));
		let PrevTables: number[] = [];
		for (let ticket of PrevTickets) {
			for (let table of ticket.cd_tables) {
				PrevTables.push(table);
			}
		}

		// TABLES RESERVED THIS INTERVAL
		let ThisTickets: Ticket[] = tickets.filter(ticket => !!ticket.tm_intervals.find(d => d.getTime() === interval.getTime()));
		let ThisTables: number[] = [];
		for (let ticket of ThisTickets) {
			for (let table of ticket.cd_tables) {
				ThisTables.push(table);
			}
		}

		// TABLES RESERVED NEXT INTERVAL
		let NextInterval: Date = index === 47 ? new Date(intervalUTCdate.setUTCHours(dayStart.getUTCHours() + 24, 0, 0, 0)) : intervals[index + 1];
		let NextTickets: Ticket[] = tickets.filter(ticket => !!ticket.tm_intervals.find(d => d.getTime() === NextInterval.getTime()));
		let NextTables: number[] = [];
		for (let ticket of NextTickets) {
			for (let table of ticket.cd_tables) {
				NextTables.push(table);
			}
		}

		for (let table of sectionTables) {
			if (ThisTables.includes(table) ||
				(!ThisTables.includes(table) && (PrevTables.includes(table) || NextTables.includes(table)))) {
				availableTables = availableTables.filter(nm => nm != table);
			}
		}

		// FLAGS: 
		// Verifico todas las celdas INTERVALO/MESA con reserva. Verifico que si para la celda correspondiente al 
		// siguiente intervalo esta DISPONIBLE entonces la reservo para una bandera (F). Esta bandera es un intervalo que se reserva el 
		// sistema para esperar al cliente si el cliente decide tomar los intervalos siguientes.
		// (Un reserva puede ser multidimensional, es decir tomar mas de una mesa y mas de un intervalo [1])

		// Mesas		   1  2  3  4  5  6
		// intervalo 0530 [-][F][F][-][F][F]
		// intervalo 0600 [F][1][1][F][2][3]
		// intervalo 0630 [4][1][1][5][2][F]
		// intervalo 0700 [4][F][F][F][F][7]
		// intervalo 0730 [F][-][-][-][-][F]

		if (compatibleTables.length > 0) {
			// si después del filtro quedaron mesas compatibles, entonces ofrece las mesas compatibles
			availability.push({
				interval: interval,
				compatible: availableTables,
				available: null,
				capacity: null
			})
		} else {
			// si después del filtro NO quedaron mesas compatibles, entonces devuleve TODAS las disponibles y la capacidad total del sector
			// armo el array de mesas con toda su data, si tiene ticket lo adjunto

			let fullTablesData: avData[] = [];
			for (let table of sectionTablesFull) {
				fullTablesData.push({
					nmTable: table.nmTable,
					nmPersons: table.nmPersons,
					blReserved: !availableTables.includes(table.nmTable),
					ticketOwner: ThisTickets.find(ticket => ticket.cd_tables.includes(table.nmTable))
				})
			}


			// SECTION CAPACITY
			// obtiene las capacidades de las mesas DISPONIBLES (sin reserva) y asume que una mesa para/ menos de 4 personas puede ser para 4 personas
			let intervalTablesCapacity = fullTablesData.filter(table => table.blReserved === false).map(table => table.nmPersons < 4 ? 4 : table.nmPersons)
			// obtiene la capacidad total del sector haciendo la sumatoria de las capacidades de las mesas libres (blReserved === false)
			let capacity: number = 0;
			if (intervalTablesCapacity.length > 0) {
				capacity = intervalTablesCapacity.reduce((a, b) => a + b) - (intervalTablesCapacity.length * 2) + 2;
			}

			availability.push({
				interval: interval,
				compatible: [],
				available: fullTablesData,
				capacity
			})
		}

	}
	return res.status(200).json({
		ok: true,
		msg: 'Disponibilidad obtenida correctamente',
		availability,
		compatible: compatibleTables.length > 0 ? true : false
	})
}

async function readPending(req: Request, res: Response) {
	// obtiene los tickets 'pending', pasaron el estado 'waiting' y esperan asignación de mesa por un admin y pasar a estado 'scheduled'.

	const idCompany = req.body.idCompany;
	const idYear = req.body.idYear;
	const idMonth = req.body.idMonth;

	const firstDay = new Date(idYear, idMonth);
	const lastDay = new Date(idYear, idMonth + 1);

	await Ticket.find({ id_company: idCompany, tx_status: { $in: ['pending', 'scheduled'] }, 'tm_intervals.0': { $gte: firstDay, $lt: lastDay } })
		.populate('id_section')
		.then((ticketsDB: Ticket[]) => {

			if (!ticketsDB) {
				return res.status(200).json({
					ok: false,
					msg: 'No hay pendientes ni agendados',
					pending: null,
					scheduled: null
				})
			}

			return res.status(200).json({
				ok: true,
				msg: 'Pendientes obtenidos correctamente',
				pending: ticketsDB.filter(ticket => ticket.tx_status === 'pending')
			})

		})
		.catch(() => {
			return res.status(500).json({
				ok: false,
				msg: 'Error al obtener los pendientes',
				pending: null
			})
		})

}

function createTicket(req: Request, res: Response) {
	// CUSTOMER(VQ) -> QUEUED / REQUESTED 
	// WAITER(VQ) -> QUEUED 

	// CUSTOMER(SCHEDULE) -> WAITING / PENDING / SCHEDULED (TM_INTERVALS)
	// ADMIN(SCHEDULE) -> SCHEDULED (TM_INTERVALS)

	const txName: string = req.body.txName;
	const nmPersons: number = req.body.nmPersons;
	const idSection: string = req.body.idSection;
	const tmIntervals: Date[] = req.body.tmIntervals;
	const cdTables: number[] = req.body.cdTables;
	const blContingent: boolean = req.body.blContingent;
	const idSocket: string = req.body.idSocket || null; // admin/waiter contingency has not socket
	const txEmail: string = req.body.txEmail || null;
	const nmPhone: number = req.body.nmPhone || null;

	const server = Server.instance; // singleton

	const thisDay = + new Date().getDate();
	const thisMonth = + new Date().getMonth() + 1;
	const thisYear = + new Date().getFullYear();

	Section.findById(idSection).then(async (sectionDB) => {

		if (!sectionDB) {
			return res.status(400).json({
				ok: false,
				msg: 'No existe el sector solicitado',
				ticket: null
			})
		}

		let idPosition: Number | null = null;

		// tiene intervalos entra por cola virtual, calculo la posición 
		if (tmIntervals.length === 0) {
			// busco la posición que le corresponde en la cola virtual
			let position = await Position.findOneAndUpdate({
				id_section: idSection,
				id_year: thisYear,
				id_month: thisMonth,
				id_day: thisDay
			}, { $inc: { id_position: 1 } }, { new: true });

			if (position?.id_position) {
				idPosition = position.id_position;
			} else {
				// si no existe el primer turno lo crea
				let firstNumber = new Position({
					id_section: idSection,
					id_year: thisYear,
					id_month: thisMonth,
					id_day: thisDay,
					id_position: 1
				})

				firstNumber.save().catch(() => {
					return res.status(400).json({
						ok: false,
						msg: "El nuevo status no se pudo guardar."
					});
				})

				idPosition = firstNumber.id_position;

			}

		} else {
			// si tiene intervalos entra en agenda, verifico la consecutividad de los intervalos 
			tmIntervals.sort();
			for (let [index, interval] of tmIntervals.entries()) {
				if (index === 0) continue;
				let diff = new Date(tmIntervals[index]).getTime() - new Date(tmIntervals[index - 1]).getTime();
				// if not 30min diff between intervals
				if (diff !== 1800000) {
					return res.status(400).json({
						ok: false,
						msg: 'Los intervalos deben ser consecutivos',
						ticket: null
					})
				}
			}
		}

		// agenda / cola virtual
		const txStatus = tmIntervals.length > 0 ? (blContingent ? 'scheduled' : 'waiting') : 'queued';

		// guardo el ticket
		let ticket = new Ticket({
			id_company: sectionDB.id_company,
			id_section: idSection,
			id_session: null,
			nm_persons: nmPersons,
			bl_contingent: blContingent,
			bl_priority: false,
			tx_name: txName,
			tx_platform: blContingent ? 'system' : null,
			tx_email: txEmail,
			nm_phone: nmPhone,
			tx_call: null,
			tx_status: txStatus,
			cd_tables: cdTables || [],
			id_position: idPosition || null, // if tx_status:'scheduled' -> idPosition = null
			id_socket_client: idSocket,
			id_socket_waiter: null,
			tm_intervals: tmIntervals || null,
			tm_start: + new Date().getTime(),
			tm_init: null,
			tm_call: null,
			tm_provided: null,
			tm_att: null,
			tm_end: null
		})

		ticket.save().then(async (ticketSaved) => {

			// obtengo las configuraciones para el comercio
			const settings = await Settings.findOne({ id_company: ticketSaved.id_company });

			server.io.to(sectionDB.id_company).emit('update-waiters');
			server.io.to(sectionDB.id_company).emit('update-admin'); //schedule update

			if (txStatus === 'queued') {
				// si spm esta activado hago un push es en el metodo push donde el ticket puede quedar 'requested'
				let spmResp: string = settings?.bl_spm ? await spm.push(ticket) : 'Ticket guardado y esperando mesa.';

				return res.status(201).json({
					ok: true,
					msg: spmResp,
					ticket
				});

			} else if (txStatus === 'waiting') {

				return res.status(201).json({
					ok: true,
					msg: 'Ticket esperando confirmación',
					ticket
				});

			} else if (txStatus === 'scheduled') {

				return res.status(201).json({
					ok: true,
					msg: 'Ticket guardado y agendado',
					ticket
				});

			}


		}).catch((err) => {

			return res.status(400).json({
				ok: false,
				msg: "Error al guardar el ticket.",
				err
			});

		})


	}).catch(() => {
		return res.status(400).json({
			ok: false,
			msg: 'No se pudo obtener el sector solicitado',
			ticket: null
		})
	})

};


let every = (arr: any[], target: any[]) => target.every(v => arr.includes(v));
let some = (arr: any[], target: any[]) => target.some(v => arr.includes(v));

// let array1 = [1,2,3],
//     array2 = [1,2,3,4],
//     array3 = [1,2];
// cnsole.log(checker(array2, array1)); //true
// cnsole.log(checker(array3, array1)); //false

async function validateTicket(req: any, res: Response) {
	// WAITING -> TERMINATED || PENDING || SCHEDULED
	const idTicket = req.body.idTicket;
	const user = req.usuario; // inject on mdAuth
	const server = Server.instance; // singleton

	Ticket.findById(idTicket)
		.populate('id_company')
		.then(async (ticketWaiting) => {

			// 1. Verifico que el ticket existe
			if (!ticketWaiting) {
				return res.status(400).json({
					ok: false,
					msg: 'No existe el ticket a validar.',
					ticket: ticketWaiting
				})
			}

			// company and reservation data for mail pourposes
			const txCompanyName = ticketWaiting.id_company.tx_company_name;
			const txCompanyAddress = ticketWaiting.id_company.tx_address_street + ' ' + ticketWaiting.id_company.tx_address_number;
			const cdTables = ticketWaiting.cd_tables;
			const cdTablesStr = ticketWaiting.cd_tables.length > 1 ? 'las mesas' : 'la mesa';

			// 2. Verifico que esté en su estado WAITING
			if (ticketWaiting.tx_status !== 'waiting') {
				if (ticketWaiting.id_socket_client) { server.io.to(ticketWaiting.id_socket_client).emit('update-ticket', ticketWaiting); }
				return res.status(400).json({
					ok: false,
					msg: 'El ticket no se encuentra en estado de validación',
					ticket: ticketWaiting
				})
			}

			// Obtengo los tickets activos para el sector y hacer otras verificaciones
			const ticketsActiveCompany = await Ticket.find({
				// _id: { $ne: ticketWaiting?._id }, // que no sea el que hay que validar
				// tx_platform: txPlatform,
				// tx_email: txEmail,
				id_section: ticketWaiting.id_section,
				tx_status: { $nin: ['cancelled', 'finished', 'killed', 'terminated'] },
				id_company: ticketWaiting?.id_company._id,
				tm_end: null
			}).then((ticketsActiveCompany: Ticket[]) => {
				return ticketsActiveCompany;
			})

			// 3. Verifico que el usuario no tenga otro ticket activo para este negocio.
			const ticketsUser = ticketsActiveCompany.filter(ticket => ticket.tx_platform === user.tx_platform && ticket.tx_email === user.tx_email && ticket._id !== idTicket)
			if (ticketsUser && ticketsUser.length > 0) {
				server.io.to(ticketWaiting.id_company._id).emit('update-admin'); // schedule update
				ticketWaiting.tx_platform = user.tx_platform;
				ticketWaiting.tx_email = user.tx_email;
				ticketWaiting.tx_status = 'killed';
				ticketWaiting.tm_end = new Date();
				return await ticketWaiting.save().then((ticketSaved: Ticket) => {
					if (ticketWaiting.id_socket_client) { server.io.to(ticketWaiting.id_socket_client).emit('update-ticket', ticketSaved); }
					return res.status(200).json({
						ok: false,
						msg: `Ya tenés un ticket activo para este negocio.`,
						ticket: ticketWaiting
					})
				})
			}

			// 4. SOLO si el ticket tiene una mesa compatible asignada (UNA porque se trata de asignación automática) verifico que esa mesa que quiere reservar todavía esté disponible.
			if (ticketWaiting.cd_tables.length > 0) {
				const ticketsTable = ticketsActiveCompany.filter(ticket =>
					ticket.tx_status === 'scheduled' && //un ticket agendado
					ticket.cd_tables.includes(ticketWaiting.cd_tables[0]) &&  //para la mesa de reserva
					ticket.tm_intervals.some(i => ticketWaiting.tm_intervals.includes(i)) && //verifico que ningún ticket tenga AL MENOS un intervalo 
					ticket._id !== ticketWaiting._id) //que no sea el mismo ticket

				if (ticketsTable && ticketsTable.length > 0) {
					ticketWaiting.tx_platform = user.tx_platform;
					ticketWaiting.tx_email = user.tx_email;
					ticketWaiting.tx_status = 'killed';
					ticketWaiting.tm_end = new Date();
					return await ticketWaiting.save().then((ticketSaved: Ticket) => {
						if (ticketWaiting.id_socket_client) { server.io.to(ticketWaiting.id_socket_client).emit('update-ticket', ticketSaved); }
						return res.status(400).json({
							ok: false,
							msg: `La mesa ya fué reservada por otro cliente.`,
							ticket: ticketWaiting
						})
					})
				}
			}


			// Pasó todas las verificaciones anteriores, se valida el ticket.
			ticketWaiting.tx_platform = user.tx_platform;
			ticketWaiting.tx_email = user.tx_email;
			ticketWaiting.tx_status = ticketWaiting.cd_tables.length === 0 ? 'pending' : 'scheduled';

			await ticketWaiting.save().then((ticketSaved: Ticket) => {

				server.io.to(ticketSaved.id_company._id).emit('update-admin'); // update schedule

				// QUEDO AGENDADO Y ASIGNADO
				let response: string = '';
				if (ticketSaved.tx_status === 'scheduled') {
					response = `Reserva confirmada correctamente`
				}

				// QUEDO AGENDADO COMO REQUERIDO
				if (ticketSaved.tx_status === 'pending') {
					response = `Reserva pendiente de aprobación`
				}

				if ((user.tx_platform === 'facebook' || user.tx_platform === 'google') && ticketSaved.tm_intervals?.length > 0) {
					const messageToUser = `
Hola ${ticketWaiting.tx_name}, la reserva de ${cdTablesStr} ${cdTables} en ${txCompanyName} quedó confirmada.

Te esperamos en ${txCompanyAddress}.

Podés ver o cancelar tus reservas haciendo click aquí:
https://saturno.fun/public/tickets

Muchas Gracias!
Saturno.fun`;
					Mail.sendMail('reservas', user.tx_email, messageToUser);
				}

				return res.status(200).json({
					ok: true,
					msg: response,
					ticket: ticketSaved
				})


			})

		}).catch(() => {
			return res.status(400).json({
				ok: false,
				msg: 'Error al confirmar el ticket o el ticket fué cancelado.',
				ticket: null
			})
		})

}

function callWaiter(req: Request, res: Response) {

	const { idTicket, txCall } = req.body;
	const server = Server.instance; // singleton

	Ticket.findByIdAndUpdate(idTicket, { tx_call: txCall, tm_call: new Date() }, { new: true }).then(ticketAttended => {

		if (ticketAttended) {

			server.io.to(ticketAttended.id_company).emit('update-waiters');

			return res.status(200).json({
				ok: true,
				msg: 'El camarero fue llamado.',
				ticket: ticketAttended
			})

		}

	}).catch(() => {
		return res.status(400).json({
			ok: false,
			msg: 'Ocurrio un error al llamar al camarero.',
			ticket: null
		})
	})
};

function readUserTickets(req: Request, res: Response) {

	const txPlatform = req.params.txPlatform;
	const txEmail = req.params.txEmail;

	Ticket.find({ tx_email: txEmail })
		.populate('id_company')
		.then((userTickets: Ticket[]) => {
			if (!userTickets) {
				return res.status(400).json({
					ok: false,
					msg: 'No hay tickets para el usuario',
					tickets: null
				})
			}

			return res.status(200).json({
				ok: true,
				msg: 'Se obtuvieron los tickets del usuario correctamente',
				tickets: userTickets
			})
		})
};

function readTickets(req: Request, res: Response) {

	const idCompany = req.params.idCompany;
	let year = + new Date().getFullYear();
	let month = + new Date().getMonth();
	let day = + new Date().getDate();
	let today = + new Date(year, month, day).getTime();
	Ticket.find({
		id_company: idCompany,
		tm_end: null
	})
		.populate({
			path: 'id_session id_section id_company',
			populate: { path: 'id_tables' }
		})
		.then((tickets) => {

			if (tickets.length > 0) {
				return res.status(200).json({
					ok: true,
					msg: "Tickets obtenidos correctamente",
					tickets
				});
			}

			return res.status(200).json({
				ok: true,
				msg: "No hay tickets",
				tickets: []
			});

		}).catch((err) => {
			return res.status(500).json({
				ok: false,
				msg: err,
				tickets: null
			});
		})
};

function readTicket(req: Request, res: Response) {

	const idTicket = req.params.idTicket;

	Ticket.findById(idTicket)
		.populate({
			path: 'id_session id_section id_company',
			populate: { path: 'id_tables' }
		})
		.then((ticket) => {

			if (!ticket) {
				return res.status(400).json({
					ok: false,
					msg: "No existe el ticket",
					ticket: null
				});
			}

			return res.status(200).json({
				ok: true,
				msg: "Se obtuvo el ticket correctamente",
				ticket
			});

		}).catch((err) => {
			return res.status(500).json({
				ok: false,
				msg: err,
				ticket: null
			});
		})
};

function updateSocket(req: Request, res: Response) {
	const server = Server.instance; // singleton

	const idTicket = req.body.idTicket;
	const newSocket = req.body.newSocket;
	const isClient = req.body.isClient;
	Ticket.findById(idTicket).then((ticketDB) => {

		if (!ticketDB) {
			return res.status(400).json({
				ok: false,
				msg: "No existe el ticket con el socket a actualizar."
			});
		}

		let requestUpdateTo: string;

		if (isClient) {
			ticketDB.id_socket_client = newSocket;
			if (ticketDB.id_socket_waiter) { requestUpdateTo = ticketDB.id_socket_waiter; }
		} else {
			ticketDB.id_socket_waiter = newSocket;
			if (ticketDB.id_socket_client) { requestUpdateTo = ticketDB.id_socket_client; }
		}



		ticketDB.save().then((ticketUpdated) => {
			// antes de enviar el ticket actualizado al solicitante, tengo que 
			// avisarle a la otra parte, que tiene que actualizar el ticket. 

			return res.status(200).json({
				ok: true,
				msg: "El socket del ticket fue actualizado correctamente.",
				ticket: ticketUpdated
			});


		}).catch(() => {

			return res.status(400).json({
				ok: false,
				msg: "Error al actualizar el socket del ticket."
			});

		})

	}).catch(() => {

		return res.status(400).json({
			ok: false,
			msg: "Error al obtener el socket del ticket."
		});

	})
}

export = {
	readAvailability,
	readPending,
	createTicket,
	validateTicket,
	callWaiter,
	releaseTicket,
	attendedTicket,
	endTicket,
	readUserTickets,
	readTickets,
	readTicket,
	updateSocket
}