import { Request, Response } from 'express';
import Server from '../classes/server';
import spm from '../classes/spm';
import cron from 'node-cron';

// MODELS
import { Ticket } from '../models/ticket.model';
import { Position } from '../models/position.model';
import { Table } from '../models/table.model';
import { Section } from '../models/section.model';
import { TableSession } from '../models/table.session.model';
import { Settings } from '../models/settings.model';

cron.schedule('*/10 * * * * *', () => {
	checkScheduled();
})

const server = Server.instance; // singleton

// ========================================================
// waiter methods
// ========================================================

function attendedTicket(req: Request, res: Response) {
	const idTicket = req.body.idTicket;
	Ticket.findByIdAndUpdate(idTicket, { tx_call: null, tm_call: null }, { new: true }).then(ticketAttended => {
		if (ticketAttended) {
			server.io.to(ticketAttended.id_company).emit('update-waiters');
			if (ticketAttended.id_socket_client) { server.io.to(ticketAttended.id_socket_client).emit('update-clients'); }
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

	let newStatus;
	if (ticket.cd_tables) {
		newStatus = ticket.cd_tables.length > 0 ? 'assigned' : 'queued';
	} else {
		newStatus = 'queued';
	}

	Ticket.findByIdAndUpdate(ticket._id, {
		tx_status: newStatus,
		id_session: null,
		tm_provided: null,
		tm_att: null
	}).then((ticketCanceled) => {

		if (!ticketCanceled) {
			return res.status(400).json({
				ok: false,
				msg: "No se pudo guardar el ticket con su estado anterior",
				ticket: null
			})
		}


		// cierro la sesión de la mesa
		let idSession = ticketCanceled.id_session;
		TableSession.findByIdAndUpdate(idSession, { tm_end: + new Date().getTime() }).then(async sessionCanceled => {

			if (!sessionCanceled) {
				return res.status(400).json({
					ok: false,
					msg: "No se pudo cancelar la sesión de la mesa",
					ticket: null
				})
			}

			// libero las mesas del ticket
			for (let idTable of sessionCanceled?.id_tables) {
				await Table.findByIdAndUpdate(idTable, { tx_status: 'paused', id_session: null });
			}


			server.io.to(ticketCanceled.id_company).emit('update-waiters');
			server.io.to(ticketCanceled.id_company).emit('update-clients');

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

function endTicket(req: Request, res: Response) {
	const idTicket = req.body.idTicket;
	Ticket.findByIdAndUpdate(idTicket, { tx_status: 'finished', tm_end: new Date() }, { new: true }).then((ticketCanceled) => {

		if (!ticketCanceled) {
			return res.status(400).json({
				ok: false,
				msg: 'No se puedo cancelar el ticket',
				ticket: ticketCanceled
			})
		}

		if (ticketCanceled?.id_session) {

			let idSession = ticketCanceled.id_session;
			// si ya tenía asignada una sesión de mesa, pauso la mesa y cierro su sesión.
			TableSession.findByIdAndUpdate(idSession, { tm_end: + new Date().getTime() }).then(async sessionCanceled => {
				// let new_status = ticketCanceled.tm_att === null ? 'idle' : 'paused';

				if (!sessionCanceled) {
					return;
				}

				// en una sesión de mesa puedo tener asignadas una o mas mesas
				for (let idTable of sessionCanceled?.id_tables) {
					await Table.findByIdAndUpdate(idTable, { tx_status: 'paused', id_session: null });
				}

				server.io.to(ticketCanceled.id_company).emit('update-waiters');
				server.io.to(ticketCanceled.id_company).emit('update-clients');

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
		} else {
			server.io.to(ticketCanceled.id_company).emit('update-waiters');
			server.io.to(ticketCanceled.id_company).emit('update-clients');
			return res.status(200).json({
				ok: true,
				msg: "Ticket finalizado correctamente",
				ticket: ticketCanceled
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

interface availability {
	interval: number;
	tables: number[];
}

async function readAvailability(req: Request, res: Response) {

	let nmPersons = req.body.nmPersons;
	let idSection = req.body.idSection;
	let tmReserve = req.body.tmReserve;

	let intervals = [...Array(24).keys()]; // 0-23 
	let compatibleTables: number[] = [];
	let scheduledTickets: Ticket[] = [];
	let availability: availability[];

	// Get compatible tables 
	await Table.find({ id_section: idSection, nm_persons: { $gte: nmPersons } })
		.then(resp => compatibleTables = resp.map(table => table.nm_table))
		.catch(() => {
			return res.status(500).json({
				ok: false,
				msg: 'Error al obtener las mesas compatibles',
				availability: []
			})
		})

	if (compatibleTables.length === 0) {
		return res.status(200).json({
			ok: true,
			msg: 'No hay mesas compatibles',
			availability: []
		})
	}

	// Get scheduled and waiting to confirm tickets 
	let takenIntervals = ['scheduled', 'waiting'];
	await Ticket.find({ id_section: idSection, tx_status: { $in: takenIntervals }, tm_reserve: tmReserve, cd_tables: { $in: compatibleTables } })
		.then(resp => scheduledTickets = resp)
		.catch(() => {
			return res.status(500).json({
				ok: false,
				msg: 'Error al obtener los tickets agendados',
				availability: [],
			})
		})

	if (scheduledTickets.length === 0) {
		availability = [];
		intervals.forEach(num => {
			availability.push({ interval: num, tables: compatibleTables })
		})
		return res.status(200).json({
			ok: true,
			msg: 'No hay tickets agendados',
			availability
		})
	}

	// has compatible tables and scheduled tickets, lets verify availability... 
	let availableIntervals = [...Array(24).keys()]; // 0-23 all available by default
	availability = [];

	for (let hr of intervals) {
		let availableTables: number[] = compatibleTables;
		let scheduledTicketsInterval = scheduledTickets.filter(ticket => ticket.tm_reserve?.getHours() === hr);
		for (let ticket of scheduledTicketsInterval) { // for each scheduled ticket
			for (let table of ticket.cd_tables) { // for each scheduled table
				if (availableTables.includes(table)) { // remove table scheduled
					availableTables = availableTables.filter(nm => nm != table);
				}
			}
		}

		if (availableTables.length <= 0) { // if all available tables were scheduled then remove interval
			availableIntervals = availableIntervals.filter(interval => interval != hr)
		}

		availability.push({ interval: hr, tables: availableTables })
	}

	// If receives tmReserve and that interval continues with available tables after a second check, take first available table and reserve it.
	return res.status(200).json({
		ok: true,
		msg: 'Disponibilidad obtenida correctamente',
		availability
	})
}

async function checkScheduled() {

	let scheduledTickets: Ticket[] = [];
	const difToReserve = 2 * 60 * 60 * 1000; // 2hrs

	await Ticket.find({ tm_reserve: { $ne: null }, tm_provided: null, tm_end: null }).then(data => {
		scheduledTickets = data;
	}).catch(() => {
		console.log('error')
	})

	let waiting = scheduledTickets.filter(ticket => ticket.tx_status === 'waiting');
	let scheduled = scheduledTickets.filter(ticket => ticket.tx_status === 'scheduled');
	let assigned = scheduledTickets.filter(ticket => ticket.tx_status === 'assigned');

	console.log('waiting:', waiting.length, ' scheduled: ', scheduled.length, ' assigned: ', assigned.length);

	for (let ticket of scheduledTickets) {
		if (!ticket.tm_reserve) {
			return;
		}
		const now = +new Date().getTime();
		const timeToReserve = ticket.tm_reserve?.getTime() - now;

		// Es hora de provisión?	
		if (timeToReserve <= 0 && ticket.tm_provided === null) {
			console.log('Privison de agendado')
			Table.findOne({ id_section: ticket.id_section, nm_table: ticket.cd_tables[0] }).then(tableToProvide => {
				if (!tableToProvide) {
					return;
				}
				spm.pull(tableToProvide).then(data => {
					console.log('MESA PROVEIDA', data)
				})

			})
		}

		// Faltan 2hs o menos para la hora de provisión?
		console.log(timeToReserve, difToReserve)
		if (ticket.tx_status === 'scheduled' && (timeToReserve < difToReserve)) {
			Table.findOne({ id_section: ticket.id_section, nm_table: ticket.cd_tables[0] }).then(tableToReserve => {
				if (!tableToReserve) {
					return;
				}
				
				console.log('Intentando liberar la mesa ', tableToReserve.nm_table, ' en estado ', tableToReserve.tx_status)
				if (tableToReserve?.tx_status !== 'busy') {
					tableToReserve.tx_status = 'reserved';
					tableToReserve.save().then(() => {
						ticket.tx_status = 'assigned';
						ticket.save().then(() => {
							console.log('Ticket asignado y mesa reservada!')
						})
					})
				}
			})

		}


	}


};

function createTicket(req: Request, res: Response) {

	const { blContingent, idSocket, txName, nmPersons, idSection, nmPhone, txEmail, tmReserve, cdTables } = req.body;

	const thisDay = + new Date().getDate();
	const thisMonth = + new Date().getMonth() + 1;
	const thisYear = + new Date().getFullYear();

	const dateReserve = + new Date(tmReserve);

	Section.findById(idSection).then(async sectionDB => {

		if (!sectionDB) {
			return res.status(400).json({
				ok: false,
				msg: 'No existe el sector solicitado',
				ticket: null
			})
		}

		let idPosition: Number | null = null;

		// si no es reserva, entonces es espontáneo
		if (!tmReserve && !tmReserve) {

			// busco la posición que le corresponde en la cola virtual
			let position = await Position.findOneAndUpdate({ id_section: idSection, id_year: thisYear, id_month: thisMonth, id_day: thisDay }, { $inc: { id_position: 1 } }, { new: true });

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

				firstNumber.save()
					.catch(() => {
						return res.status(400).json({
							ok: false,
							msg: "El nuevo status no se pudo guardar."
						});
					})

				idPosition = firstNumber.id_position;

			}

		}


		const txStatus = (tmReserve || tmReserve) ? 'waiting' : 'queued';

		// guardo el ticket
		let ticket = new Ticket({
			id_company: sectionDB.id_company,
			id_section: idSection,
			id_session: null,
			nm_persons: nmPersons,
			bl_contingent: blContingent,
			bl_priority: false,
			tx_name: txName,
			tx_platform: null,
			nm_phone: nmPhone,
			tx_email: txEmail,
			tx_call: null,
			tm_call: null,
			tx_status: txStatus,
			cd_tables: cdTables || [],
			id_position: idPosition || null, // if tx_status:'scheduled' -> idPosition = null
			id_socket_client: idSocket,
			id_socket_waiter: null,
			tm_start: + new Date().getTime(),
			tm_provided: null,
			tm_reserve: dateReserve || null,
			tm_att: null,
			tm_end: null
		})

		ticket.save().then(async (ticketSaved) => {

			// obtengo las configuraciones para el comercio
			const settings = await Settings.findOne({ id_company: ticketSaved.id_company });




			if (txStatus === 'queued') {
				// si spm esta activado hago un push 
				let spmResp: string = settings?.bl_spm_auto ? await spm.push(ticket) : 'Spm desactivado, el ticket quedo en cola o agendado.';

				// envío pedido de actualización despues del push
				const server = Server.instance;
				server.io.to(sectionDB.id_company).emit('update-waiters');

				return res.status(201).json({
					ok: true,
					msg: spmResp,
					ticket
				});

			} else if (txStatus === 'waiting') {

				// let contactResp: string = await contact.whatsapp(ticket);

				return res.status(201).json({
					ok: true,
					msg: 'Ticket guardado y a confirmar',
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

function callWaiter(req: Request, res: Response) {
	const { idTicket, txCall } = req.body;

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
	const idUser = req.params.idUser;

	Ticket.find({tx_platform: txPlatform, id_user: idUser})
	.populate('id_company')
	.then((userTickets: Ticket[]) => {
		if(!userTickets){
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
	let yesterday = new Date(today - (1000 * 60 * 60 * 24)); // Yesterday
	Ticket.find({
		id_company: idCompany, // only this company
		tm_start: { $gt: yesterday },  // only from Yesterday (now -24hs)
	})
		.populate({
			path: 'id_session id_section',
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

function updateSocket(req: Request, res: Response) {

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
			if (requestUpdateTo) {
				server.io.to(requestUpdateTo).emit('socket-updated', { idTicket: ticketDB._id, idSocket: newSocket });
			}

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
	createTicket,
	callWaiter,
	releaseTicket,
	attendedTicket,
	endTicket,
	readUserTickets,
	readTickets,
	updateSocket
}