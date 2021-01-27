// MODELS
import { Ticket } from '../models/ticket.model';
import { Position } from '../models/position.model';
import { Table } from '../models/table.model';
import { Section } from '../models/section.model';
import { TableSession } from '../models/table.session.model';
import { Settings } from '../models/settings.model';
import { Request, Response } from 'express';
import user from './user.controller';
import Server from '../classes/server';
import spm from '../classes/spm';
import cron from 'node-cron';
import colors from '../global/colors';

cron.schedule('*/10 * * * * *', () => {
	checkScheduled();
})

// ========================================================
// waiter methods
// ========================================================

function attendedTicket(req: Request, res: Response) {
	const server = Server.instance; // singleton

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
	const server = Server.instance; // singleton

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

async function endTicket(req: Request, res: Response) {
	const idTicket = req.body.idTicket;
	const reqBy = req.body.reqBy;
	const newStatus = reqBy === 'waiter' ? 'finished' : 'cancelled';
	await Ticket.findByIdAndUpdate(idTicket, { tx_status: newStatus, tm_end: new Date() }, { new: true }).then(async (ticketCanceled) => {

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
			await TableSession.findByIdAndUpdate(idSession, { tm_end: + new Date().getTime() }).then(async sessionCanceled => {
				// let new_status = ticketCanceled.tm_att === null ? 'idle' : 'paused';

				if (!sessionCanceled) {
					return;
				}

				// en una sesión de mesa puedo tener asignadas una o mas mesas
				for (let idTable of sessionCanceled?.id_tables) {
					await Table.findByIdAndUpdate(idTable, { tx_status: 'paused', id_session: null });
				}

				const server = Server.instance; // singleton
				server.io.to(ticketCanceled.id_company).emit('update-waiters');
				server.io.to(ticketCanceled.id_company).emit('update-clients'); //ticket component
				if (ticketCanceled.id_socket_client) {
					server.io.to(ticketCanceled.id_socket_client).emit('update-ticket', ticketCanceled); // ticket-create component
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
			server.io.to(ticketCanceled.id_company).emit('update-waiters');
			server.io.to(ticketCanceled.id_company).emit('update-clients'); //ticket component
			if (ticketCanceled.id_socket_client) {
				server.io.to(ticketCanceled.id_socket_client).emit('update-ticket', ticketCanceled); // ticket-create component
			}
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
	tables: number[] | tablesData[];
	capacity: number | null; // -> number when has NOT compatible tables, null has compatible options  
}

interface tablesData {
	nmTable: number,
	nmPersons: number,
	blReserved: boolean
}

async function readAvailability(req: Request, res: Response) {

	const nmPersons = req.body.nmPersons;
	const idSection = req.body.idSection;
	const tmReserve = req.body.dtReserve;

	const dayStart = new Date(tmReserve.split('T')[0]);
	const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);

	const intervals = [...Array(24).keys()]; // 0-23 

	let compatibleTables: number[] = []; // ie. [2,3,5,8] -> only compatible tables
	let sectionTables: number[] = []; // all tables numbers
	let sectionTablesFull: tablesData[] = [];  // all tables numbers and persons
	let scheduledTickets: Ticket[] = []; // tickets agendados para el día seleccionado y que tengan mesas compatibles asignadas
	let availability: availability[] = []; // return availability



	// Get ALL scheduled tickets
	await Ticket.find({ id_section: idSection, tx_status: { $in: ['scheduled', 'waiting'] }, tm_reserve: { $gte: dayStart, $lt: dayEnd } })
		.then(resp => scheduledTickets = resp)
		.catch(() => {
			return res.status(500).json({
				ok: false,
				msg: 'Error al obtener los tickets en la agenda',
				availability
			})
		})


	if (nmPersons > 0) {

		// COMPATIBLE TABLES
		await Table.find({ id_section: idSection, nm_persons: { $gte: nmPersons } })
			.then(resp => compatibleTables = resp.map(table => table.nm_table))
			.catch(() => {
				return res.status(500).json({
					ok: false,
					msg: 'Error al obtener las mesas compatibles',
					availability
				})
			})

		// TICKETS WITH COMPATIBLE TABLES ASSIGNED
		await Ticket.find({ id_section: idSection, tx_status: { $in: ['scheduled', 'waiting'] }, tm_reserve: { $gte: dayStart, $lt: dayEnd }, cd_tables: { $in: compatibleTables } })
			.then(resp => {
				scheduledTickets = resp
			})
			.catch(() => {
				return res.status(500).json({
					ok: false,
					msg: 'Error al obtener los tickets en la agenda',
					availability
				})
			})

	}

	// 1. Si no hay mesas compatibles, devuelvo TODAS las CAPACIDADES de cada mesa disponible por intervalo para analizar la posibilidad de armar una mesa especial
	// 2. Si hay mesas que cumplen la capacidad solicitada se devuelve la disponibilidad SOLO de esas mesas por intervalo.

	// ALL TABLES
	await Table.find({ id_section: idSection })
		.then(resp => {
			sectionTables = resp.map(table => table.nm_table);
			sectionTablesFull = resp.map(table => {
				return { nmTable: table.nm_table, nmPersons: table.nm_persons, blReserved: false }
			})
		})
		.catch(() => {
			return res.status(500).json({
				ok: false,
				msg: 'Error al obtener todas las mesas del sector',
				availability
			})
		})


	// FILTER BUSY TABLES
	for (let hr of intervals) {

		let availableTables: number[] = compatibleTables.length > 0 ? compatibleTables : sectionTables;
		let scheduledTicketsInterval = scheduledTickets.filter(ticket => ticket.tm_reserve?.getHours() === hr);
		for (let ticket of scheduledTicketsInterval) { // for each scheduled ticket
			for (let table of ticket.cd_tables) { // for each table assigned in that ticket
				if (availableTables.includes(table)) { // remove table from my available tables list
					availableTables = availableTables.filter(nm => nm != table);
				}
			}
		}
		if (compatibleTables.length > 0) {
			availability.push({ interval: hr, tables: availableTables, capacity: 0 })
		} else {

			let newTables: tablesData[] = [];
			for (let table of sectionTablesFull) {
				if (availableTables.includes(table.nmTable)) {
					newTables.push({ nmTable: table.nmTable, nmPersons: table.nmPersons, blReserved: false })
				} else {
					newTables.push({ nmTable: table.nmTable, nmPersons: table.nmPersons, blReserved: true })
				}
			}
			// por la unión de mesas resto 2 personas por mesa, luego sumo 2 personas que entran en los extremos.
			let arrcapacity = newTables
				.filter(table => table.blReserved === false)
				.map(table => table.nmPersons < 4 ? 4 : table.nmPersons) //asumo que las mesas con menos de 4 son de 4

			const capacity: number  = arrcapacity.reduce((a, b) => a + b) - (arrcapacity.length * 2) + 2;
			availability.push({ interval: hr, tables: newTables, capacity })
		}
	}

	/*
	compatibleTables [ 5 ]
	sectionTables [ 1, 2, 3, 4, 5 ]
	sectionTablesFull [
		{ nmTable: 1, nmPersons: 2 },
		{ nmTable: 2, nmPersons: 2 },
		{ nmTable: 3, nmPersons: 4 },
		{ nmTable: 4, nmPersons: 5 },
		{ nmTable: 5, nmPersons: 7 }
	]
	*/


	// If receives tmReserve and that interval continues with available tables after a second check, take first available table and reserve it.
	return res.status(200).json({
		ok: compatibleTables.length > 0 ? true : false,
		msg: 'Disponibilidad obtenida correctamente',
		availability
	})
}

async function checkScheduled() {
	const server = Server.instance; // singleton

	let scheduledTickets: Ticket[] = [];

	await Ticket.find({ tm_reserve: { $ne: null }, tm_provided: null, tm_end: null })
		.populate('id_company')
		.then(data => {
			scheduledTickets = data;
		}).catch(() => {
		})

	let waiting = scheduledTickets.filter(ticket => ticket.tx_status === 'waiting');
	let scheduled = scheduledTickets.filter(ticket => ticket.tx_status === 'scheduled');
	let assigned = scheduledTickets.filter(ticket => ticket.tx_status === 'assigned');

	console.log(`${colors.FgBlue}System:${colors.Reset}`, 'waiting:', waiting.length, ' scheduled: ', scheduled.length, ' assigned: ', assigned.length);

	for (let ticket of scheduledTickets) {
		if (!ticket.tm_reserve) {
			return;
		}
		const now = +new Date().getTime();
		const timeToProvide = (ticket.tm_reserve?.getTime() - now) <= 0;
		const timeToReserve = (ticket.tm_reserve?.getTime() - now) <= 2 * 60 * 60 * 1000; // 2hrs
		const timeToTerminate = (now - ticket.tm_start?.getTime()) >= 10 * 60 * 1000; // 10 minutes 

		// -------------------------------------------------------------
		// AFTER 10MIN OF TM_START: IF NOT CONFIRMED SET 'TERMINATED' W/ TM_END	
		// -------------------------------------------------------------

		if (ticket.tx_status === 'waiting' && timeToTerminate) {
			ticket.tx_status = 'terminated';
			ticket.tm_end = new Date();
			await ticket.save().then((ticketSaved) => {
				console.log('System: ', `Ticket de ${ticketSaved.tx_name} sin confirmar terminado.`)
				if (ticket.id_socket_client) { server.io.to(ticket.id_socket_client).emit('update-ticket', ticket); }

			})
		}

		// -------------------------------------------------------------
		// IN TIME: PROVIDE TABLE	
		// -------------------------------------------------------------

		if (ticket.tx_status === 'assigned' && timeToProvide) {
			Table.findOne({ id_section: ticket.id_section, nm_table: ticket.cd_tables[0] }).then(tableToProvide => {

				if (!tableToProvide) {
					return;
				}

				spm.pull(tableToProvide).then(data => {
					console.log('System: ', 'Mesa aprovisionada ok', data);
				})

			})
		}

		// -------------------------------------------------------------
		// BEFORE 2HS AT TM_RESERVE: TABLE RESERVE AND TICKET ASSIGN
		// -------------------------------------------------------------

		if (ticket.tx_status === 'scheduled' && timeToReserve) {
			await Table.findOne({ id_section: ticket.id_section, nm_table: ticket.cd_tables[0] })
				.then(async tableToReserve => {

					if (!tableToReserve) {
						return;
					}

					console.log('System: ', 'Intentando reservar la mesa ', tableToReserve.nm_table, ' en estado ', tableToReserve.tx_status)

					if (tableToReserve?.tx_status !== 'busy') {
						tableToReserve.tx_status = 'reserved';
						await tableToReserve.save().then(async () => {
							ticket.tx_status = 'assigned';

							await ticket.save().then((ticketSaved: Ticket) => {
								console.log('System: ', 'Mesa reservada y ticket asignado ok')
								server.io.to(ticket.id_company._id).emit('update-waiters');
								if (ticket.id_socket_client) { server.io.to(ticket.id_socket_client).emit('update-ticket', ticketSaved); }
							})
						})
					}
				})

		}


	}


};

function createTicket(req: Request, res: Response) {

	const { blContingent, idSocket, txName, nmPersons, idSection, tmReserve, cdTables } = req.body;
	const server = Server.instance; // singleton

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

async function validateTicketGoogle(req: Request, res: Response) {

	let idTicket = req.body.idTicket;
	var gtoken = req.body.gtoken;

	await user.verify(gtoken).then((googleUser: any) => {

		let txName = googleUser.name;
		let txEmail = googleUser.email;
		let txImage = googleUser.img;

		// El usuario de Google es válido, ahora busco el ticket y lo valido 'waiting' -> 'schedule'
		validateTicket(idTicket, 'google', txEmail, txName).then((data: string) => {

			return res.status(200).json({
				ok: true,
				msg: 'El usuario es válido el ticket fué confirmado correctamente',
				response: data
			})

		}).catch((err) => {
			return res.status(400).json({
				ok: false,
				msg: err,
				response: null
			})
		})
	})

}

async function validateTicket(idTicket: string, txPlatform: string, idUser: string, txName?: string): Promise<string> {

	return new Promise(async (resolve, reject) => {
		const server = Server.instance; // singleton
		let response: string = '';
		return await Ticket.findById(idTicket)
			.populate('id_company')
			.then(async (ticketWaiting) => {

				// No tiene un ticket activo para este comercio, procede a validarlo.
				if (!ticketWaiting) {
					return reject('No existe el ticket o el ticket fué cancelado.');
				}

				// 1. Busco el ticket y verifico que no esté confirmado, si ya estaba confirmado le envío el ticket, probablemente la webapp no lo tiene en el storage.
				// 2. Verifico que no exista otro ticket activo para ese usuario para ese mismo comercio 
				// 3. Si existe el 'waiting' queda 'terminated', lo notifico, y le envío la lista actualizada de sus tickets 
				// 4. Si NO existe procedo a validar el ticket 'scheduled'


				// Verifico que el ticket no esté ya confirmado
				if (ticketWaiting.tx_status === 'scheduled') {
					if (ticketWaiting.id_socket_client) { server.io.to(ticketWaiting.id_socket_client).emit('update-ticket', ticketWaiting); }
					return reject('El ticket ya se está confirmado.');
				}

				// Busco tickets activos para este usuario y para este negocio.
				let ticketsUser = await Ticket.find({
					_id: { $ne: ticketWaiting?._id }, // que no sea el que hay que validar
					tx_platform: txPlatform,
					id_user: idUser,
					id_company: ticketWaiting?.id_company._id,
					tm_end: null
				}).then((ticketsUser: Ticket[]) => {
					return ticketsUser;
				})

				// Tiene otro ticket activo para este comercio, se finaliza y se lo notifica.
				if (ticketsUser && ticketsUser.length > 0) {
					ticketWaiting.tx_platform = txPlatform;
					ticketWaiting.id_user = idUser;
					ticketWaiting.tx_status = 'terminated';
					ticketWaiting.tm_end = new Date();
					return await ticketWaiting.save().then((ticketSaved: Ticket) => {
						if (ticketWaiting.id_socket_client) { server.io.to(ticketWaiting.id_socket_client).emit('update-ticket', ticketSaved); }
						let response = `Ya tenés un ticket activo para este negocio.`;

						if (['whatsapp', 'telegram'].includes(txPlatform)) {
							response += `
							Podés ver todos tus tickets haciendo click en el siguiente enlace: 
							https://saturno.fun/public/tickets/${txPlatform}/${idUser}`;
						}

						resolve(response);
					})
				}

				// No tiene tickets activos para el comercio, se valida el ticket.
				ticketWaiting.tx_platform = txPlatform;
				ticketWaiting.id_user = idUser;

				// Si la mesa solicitada es -1 se trata de un scheduled_requested
				ticketWaiting.tx_status = ticketWaiting.cd_tables[0] === -1 ? 'pending' : 'scheduled';


				await ticketWaiting.save().then((ticketSaved: Ticket) => {
					if (ticketSaved.id_socket_client) { server.io.to(ticketSaved.id_socket_client).emit('update-ticket', ticketSaved); }
					const idTable = ticketWaiting.cd_tables[0];
					const txCompanyName = ticketWaiting.id_company.tx_company_name;
					const txCompanyAddressStreet = ticketWaiting.id_company.tx_address_street;
					const txCompanyAddressNumber = ticketWaiting.id_company.tx_address_number;
					const txCompanyLocation = ticketWaiting.id_company.tx_company_location;
					const dtDate = new Date(String(ticketWaiting.tm_reserve));
					const dtYear = dtDate.getFullYear();
					const months = ['Enero', 'Febrero', 'Marzo', 'Arbil', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
					const dtMonth = months[dtDate.getMonth()];
					const dtDay = dtDate.getDate();

					const idCompany = ticketWaiting.id_company._id;
					ticketWaiting.id_company = null; // el formulario de ticket del comercio requiere del ticket sin popular id_company
					ticketWaiting.id_company = idCompany;

					let response = `
					Hola ${txName}, tu reserva para la mesa ${idTable} quedó confirmada.  
					
					Te esperamos el ${dtDay} de ${dtMonth} de ${dtYear} a las ${dtDate.getHours()}:00hs en ${txCompanyName}, ${txCompanyAddressStreet} ${txCompanyAddressNumber}, ${txCompanyLocation}
					
					Recordá que tenés 30 minutos extra si no llegas antes de las ${dtDate.getHours()}:30hs tu turno quedará finalizado.
					`

					if (['whatsapp', 'telegram'].includes(txPlatform)) {
						response += `
					Para ver tus tickets visitá este link:
					https://saturno.fun/public/tickets/${txPlatform}/${idUser}
					`}

					resolve(response);
				})

			}).catch(() => {
				reject('Error al confirmar el ticket o el ticket fué cancelado.');
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
	const idUser = req.params.idUser;

	Ticket.find({ tx_platform: txPlatform, id_user: idUser, tx_status: { $ne: 'terminated' } })
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
	let yesterday = new Date(today - (1000 * 60 * 60 * 24)); // Yesterday
	Ticket.find({
		id_company: idCompany, // only this company
		tm_start: { $gt: yesterday },  // only from Yesterday (now -24hs)
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
	validateTicketGoogle,
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