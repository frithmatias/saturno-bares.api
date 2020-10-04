import { Request, Response } from 'express';
import Server from '../classes/server';

// MODELS
import { Ticket } from '../models/ticket.model';
import { Position } from '../models/position.model';
import { Table } from '../models/table.model';
import { sectionSession } from '../models/section.session.model';
import { Section } from '../models/section.model';
import { TableSession } from '../models/table.session.model';

const server = Server.instance; // singleton

// ========================================================
// waiter methods
// ========================================================

function reassignTicket(req: Request, res: Response) {
	// desvía un ticket de una session de msa a otranuevo session. 

	const { idTicket, idSession, blPriority } = req.body;

	const idDay = + new Date().getDate();
	const idMonth = + new Date().getMonth() + 1;
	const idYear = + new Date().getFullYear();

	let idPosition: number;

	Ticket.findById(idTicket).then(ticketDB => {

		if (!ticketDB) {
			return res.status(400).json({
				ok: false,
				msg: 'No existe el ticket a reenviar',
				ticket: null
			})
		}

		sectionSession.findById(idSession).then((sessionDB) => {

			if (!sessionDB) {
				return res.status(400).json({
					ok: false,
					msg: 'No existe el session solicitado',
					ticket: null
				})
			}

			// busco la posición que le corresponde
			Position.findOneAndUpdate({
				id_session: idSession,
				id_year: idYear,
				id_month: idMonth,
				id_day: idDay
			}, { $inc: { id_position: 1 } }, { new: true }).then((sessionNextNumber) => {

				if (!sessionNextNumber) {
					// si no existe el primer turno lo crea

					let newSessionNumber = new Position({
						id_session: idSession,
						id_year: idYear,
						id_month: idMonth,
						id_day: idDay,
						id_position: 1
					})

					newSessionNumber.save()
						.catch(() => {
							return res.status(400).json({
								ok: false,
								msg: "El nuevo status no se pudo guardar."
							});
						})

					idPosition = newSessionNumber.id_position;
				}

				if (sessionNextNumber) {
					idPosition = sessionNextNumber.id_position;
				}



				let idCompany = ticketDB.id_company;
				let idSocket = ticketDB.id_socket_client;

				// guardo el ticket

				let ticket = new Ticket({
					id_company: idCompany,
					id_session: idSession,
					id_position: idPosition,
					bl_priority: blPriority,
					id_socket_client: idSocket,
					id_socket_waiter: null,
					tm_start: + new Date().getTime(),
					tm_att: null,
					tm_end: null
				})

				ticket.save().then((ticketChildSaved) => {

					const server = Server.instance;

					server.io.to(idSocket).emit('message-private', { msg: 'Bienvenido, puede realizar culquier consulta por aquí. Gracias por esperar.' });
					server.io.to(idCompany).emit('update-clients');

					let ticketToUser = {
						id_session: idSession,
						id_position: ticketChildSaved.id_position,
						bl_priority: blPriority,
						id_socket_client: ticketChildSaved.id_socket_client,
						id_socket_waiter: null,
						tm_start: ticketChildSaved.tm_start,
						tm_att: null,
						tm_end: null
					}

					res.status(201).json({
						ok: true,
						msg: "Ticket guardado correctamente.",
						ticket: ticketToUser
					});

					// después de guardar el nuevo ticket, cierro el anterior
					ticketDB.tm_end = + new Date().getTime();
					ticketDB.save().catch(() => {
						return res.status(400).json({
							ok: false,
							msg: 'Error al cerrar el ticket anterior',
							ticket: false
						});
					})

				}).catch(() => {

					return res.status(400).json({
						ok: false,
						msg: 'Error al abrir el ticket nuevo',
						ticket: false
					});

				})
			}).catch(() => {

				return res.status(400).json({
					ok: false,
					msg: "Error al procesar el status de los tickets para la empresa."
				});

			})


		}).catch(() => {
			return res.status(400).json({
				ok: false,
				msg: 'No se pudo obtener el session solicitado',
				ticket: null
			})
		})


	})



};

function attendedTicket(req: Request, res: Response) {

	const idTicket = req.body.idTicket;
	Ticket.findByIdAndUpdate(idTicket, { bl_called: false, tm_att: + new Date().getTime() }, {new: true}).then(ticketAttended => {

		if(ticketAttended?.bl_called === false) {

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
	const idTicket = req.body.idTicket;

	Ticket.findByIdAndUpdate(idTicket, {
		tx_status: 'queued',
		tm_provided: null,
		tm_att: null,
		id_socket_waiter: null,
		id_session: null,
		tm_end: null
	}, { new: true }).then(ticketReleased => {
		if (ticketReleased?.id_company) { server.io.to(ticketReleased.id_company).emit('update-clients'); }
		return res.status(200).json({
			ok: true,
			msg: 'Ticket soltado correctamente',
			ticket: ticketReleased
		})
	}).catch(() => {
		return res.status(400).json({
			ok: false,
			msg: 'No se pudo soltar el ticket',
			ticket: null
		})
	})
};

// ========================================================
// public methods
// ========================================================

function createTicket(req: Request, res: Response) {

	const { idSocket, blPriority, nmPersons, idSection } = req.body;

	const idDay = + new Date().getDate();
	const idMonth = + new Date().getMonth() + 1;
	const idYear = + new Date().getFullYear();

	let idPosition: number;

	Section.findById(idSection).then(sectionDB => {

		if (!sectionDB) {
			return res.status(400).json({
				ok: false,
				msg: 'No existe el sector solicitado',
				ticket: null
			})
		}

		// busco la posición que le corresponde
		Position.findOneAndUpdate({
			id_section: idSection,
			id_year: idYear,
			id_month: idMonth,
			id_day: idDay
		}, { $inc: { id_position: 1 } }, { new: true }).then((sectionNextNumber) => {

			// si no existe el primer turno lo crea
			if (!sectionNextNumber) {

				let newSectionNumber = new Position({
					id_section: idSection,
					id_year: idYear,
					id_month: idMonth,
					id_day: idDay,
					id_position: 1
				})

				newSectionNumber.save()
					.catch(() => {
						return res.status(400).json({
							ok: false,
							msg: "El nuevo status no se pudo guardar."
						});
					})

				idPosition = newSectionNumber.id_position;
			}

			if (sectionNextNumber) {
				idPosition = sectionNextNumber.id_position;
			}

			// guardo el ticket
			let ticket = new Ticket({
				id_company: sectionDB.id_company,
				id_section: idSection,
				nm_persons: nmPersons,
				id_position: idPosition,
				bl_called: true,
				bl_priority: blPriority,
				id_socket_client: idSocket,
				id_socket_waiter: null,
				tm_start: + new Date().getTime(),
				tm_att: null,
				tm_end: null
			})

			ticket.save().then((ticketSaved) => {


				// SPM: Sistema de Provisión de mesas
				spm(ticket);

				const server = Server.instance;
				// welcome message to client
				server.io.to(idSocket).emit('message-private', { msg: 'Bienvenido, puede realizar culquier consulta por aquí. Gracias por esperar.' });
				// advice to dekstops in company
				server.io.to(sectionDB.id_company).emit('update-waiters');

				res.status(201).json({
					ok: true,
					msg: "Ticket guardado correctamente.",
					ticket: ticketSaved
				});

			}).catch((err) => {

				return res.status(400).json({
					ok: false,
					msg: err,
					ticket: false
				});

			})
		}).catch(() => {

			return res.status(400).json({
				ok: false,
				msg: "Error al procesar el status de los tickets para la empresa."
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

	const idTicket = req.params.idTicket;
	Ticket.findByIdAndUpdate(idTicket, { bl_called: true }, {new: true}).then(ticketAttended => {

		if(ticketAttended?.bl_called === true) {

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

function getTickets(req: Request, res: Response) {
	const idCompany = req.params.idCompany;
	let year = + new Date().getFullYear();
	let month = + new Date().getMonth();
	let day = + new Date().getDate();
	let time = + new Date(year, month, day).getTime();

	Ticket.find({
		id_company: idCompany, // only this company
		tm_start: { $gt: time }  // only from today
	})

		.then((tickets) => {

			if (tickets.length > 0) {
				return res.status(200).json({
					ok: true,
					msg: "Se encontraron tickets para la empresa solicitada.",
					tickets
				});
			}

			return res.status(200).json({
				ok: false,
				msg: "No existen tickets para la empresa solicitada.",
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

function endTicket(req: Request, res: Response) {
	const idTicket = req.body.idTicket;
	Ticket.findByIdAndUpdate(idTicket, { tm_end: + new Date().getTime() }).then((ticketCanceled) => {

		if (ticketCanceled?.id_session) {
			let idSession = ticketCanceled.id_session;
			// si ya tenía asignada una sesión de mesa, habilito la mesa y cierro su sesión.
			TableSession.findByIdAndUpdate(idSession, { tm_end: + new Date().getTime() }).then(sessionCanceled => {

				let new_status = ticketCanceled.tm_att === null ? 'idle' : 'paused';
				Table.findByIdAndUpdate(sessionCanceled?.id_table, { tx_status: new_status, id_session: null }).then(tableCanceled => {

					if (ticketCanceled.id_socket_waiter) {
						// cancel dekstop session and update tickets on waiter table 
						server.io.to(ticketCanceled.id_socket_waiter).emit('ticket-cancelled', ticketCanceled._id);
					} else {
						// update tickets on tables
						server.io.to(ticketCanceled.id_company).emit('update-waiters');
					}

					return res.status(200).json({
						ok: true,
						msg: "Ticket finalizado correctamente",
						ticket: ticketCanceled
					})

				}).catch(() => {
					return res.status(400).json({
						ok: false,
						msg: "No se pudo habilitar la mesa",
						ticket: null
					})
				})

			}).catch(() => {
				return res.status(400).json({
					ok: false,
					msg: "No se pudo cancelar la sesion de mesa",
					ticket: null
				})
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



// sistema de provisión de mesas
let spm = (ticket: Ticket) => {

	/*
	1. verifico que exista al menos una mesa para la cantidad solicitada, si no existe el status pasa de 'queued' a 'requested'
	2. si existe y el status es 'idle' el estado pasa de queue a 'assigned', si es busy el estado persiste en 'queued' 
	*/
	// buscar una mesa para 'ticket'
	Table.find({ nm_persons: { $gte: ticket.nm_persons }, id_section: ticket.id_section }).then(tablesDB => {
		// no existe, 'queued' -> 'requested'
		if (tablesDB.length === 0) { // no existen mesas para la solicitud
			Ticket.findByIdAndUpdate(ticket._id, { tx_status: 'requested' }, { new: true }).then(result => {
			}).catch(err => {
			})
			return;
		}
		// existe, verifico si hay disponibilidad
		let idleTables = tablesDB.filter(table => table.tx_status === 'idle');

		if (idleTables.length > 0) {

			let session = new TableSession();

			let idTable = idleTables[0]._id;
			let idTicket = ticket._id;
			session.id_table = idTable;
			session.id_ticket = idTicket;
			session.tm_start = + new Date();

			session.save().then(sessionSaved => {

				let idSession = sessionSaved._id;

				// update ticket
				Ticket.findByIdAndUpdate(ticket._id, {
					tx_status: 'assigned',
					id_session: idSession,
					tm_provided: + new Date()
					// todo: asignar el socket del camaero en el ticket
				}).then(result => {
				}).catch(err => {
				})

				// update table
				Table.findByIdAndUpdate(idTable, {
					tx_status: 'busy',
					id_session: idSession
				}, { new: true }).then(tableDB => {
				}).catch(err => {
				})



			})
		}
	})
}


export = {
	createTicket,
	callWaiter,
	releaseTicket,
	reassignTicket,
	attendedTicket,
	endTicket,
	getTickets,
	updateSocket,
}