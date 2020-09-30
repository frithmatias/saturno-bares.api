import { Request, Response } from 'express';
import Server from '../classes/server';

// MODELS
import { Ticket } from '../models/ticket.model';
import { Position } from '../models/position.model';
import { User } from '../models/user.model';
import { Table } from '../models/table.model';
import { Session } from '../models/session.model';
import { Section } from '../models/section.model';

const server = Server.instance; // singleton


// ========================================================
// user methods
// ========================================================

function createTicket(req: Request, res: Response) {

	const { idCompany, idSession, idSocket, blPriority } = req.body;

	const idDay = + new Date().getDate();
	const idMonth = + new Date().getMonth() + 1;
	const idYear = + new Date().getFullYear();

	let idPosition: number;

	Session.findById(idSession).then(sessionDB => {

		if (!sessionDB) {
			return res.status(400).json({
				ok: false,
				msg: 'No existe la session de mesa solicitada',
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

			// si no existe el primer turno lo crea
			if (!sessionNextNumber) {

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

			// guardo el ticket
			let ticket = new Ticket({
				id_session: idSession,
				id_position: idPosition,
				bl_priority: blPriority,
				id_socket_client: idSocket,
				id_socket_waiter: null,
				tm_start: + new Date().getTime(),
				tm_att: null,
				tm_end: null
			})

			ticket.save().then((ticketSaved) => {

				const server = Server.instance;
				// welcome message to client
				server.io.to(idSocket).emit('message-private', { msg: 'Bienvenido, puede realizar culquier consulta por aquí. Gracias por esperar.' });
				// advice to dekstops in company
				server.io.to(idCompany).emit('update-tables');

				res.status(201).json({
					ok: true,
					msg: "Ticket guardado correctamente.",
					ticket: ticketSaved
				});

			}).catch(() => {

				return res.status(400).json({
					ok: false,
					msg: 'Error al guardar el ticket',
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

};

function cancelTicket(req: Request, res: Response) {
	const idTicket = req.params.idTicket;

	Ticket.findByIdAndUpdate(idTicket, { tm_end: + new Date().getTime() }).then((ticketCanceled) => {
		if (ticketCanceled) {

			if (ticketCanceled.id_socket_waiter) {
				// cancel dekstop session and update tickets on waiter table 
				server.io.to(ticketCanceled.id_socket_waiter).emit('ticket-cancelled', ticketCanceled._id);
			} else {
				// update tickets on tables
				server.io.to(ticketCanceled.id_company).emit('update-tables');
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

		Session.findById(idSession).then((sessionDB) => {

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
					server.io.to(idCompany).emit('update-public');

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

function takeTicket(req: Request, res: Response) {

	const server = Server.instance;
	const { idTable, idSession, idSocketDesk } = req.body;

	// SPM: SISTEMA DE PROVISIÓN DE MESAS
	// 1. session: verifico que la sesión esté activa, sea válida y obtengo el sector tomado
	// 2. table:  verifico que la mesa que se quiere tomar pertenezca al sector verifico la disponibilidad de la mesa ('idle') 
	// 3. ticket: busco un ticket que posea la mesa como 'candidate' y se cambia el esatdo de 'assigned' a 'provided' con el timestamp correspondiente
	// 4. table: se cambia el estado de 'idle' a 'busy' con su timestamp 

	// 1
	Session.findById(idSession)
		.populate('id_waiter id_section')
		.then(sessionDB => { // obtengo el sector requerido

			if (!sessionDB) {
				return res.status(400).json({
					ok: false,
					msg: 'No existe la sesión del escritorio',
					session: null
				});
			}

			if (sessionDB.fc_end) {
				return res.status(400).json({
					ok: false,
					msg: 'La sesión del escritorio expiró',
					session: null
				});
			}

			Section.findById(sessionDB.id_section).then(sectionDB => {

				if(!sectionDB){
					return res.status(400).json({
						ok: false,
						msg: 'No existe el sector para la sesión solicitada',
						ticket: null
					})
				}

				Table.findById(idTable)
					.then(tableDB => {

						// verifico que la mesa a liberar pertenezca al sector de la sesion
						if (tableDB?.id_section !== sessionDB.id_section) {
							return res.status(400).json({
								ok: false,
								msg: 'La mesa que desea aprovisionar no existe en el sector indicado',
								waiter: null
							});
						}

						// verifico que la mesa este disponible ('idle')
						if (tableDB.tx_status !== 'idle') {
							return res.status(400).json({
								ok: false,
								msg: 'La mesa que desea aprovisionar no se encuentra disponible',
								waiter: null
							});
						}

						// 1. la sesión es válida 2. la mesa corresponde al sector de la sesión y está disponible
						// 3. busco un ticket con la mesa indicada asignada por SAC como candidata 

						Ticket.findOne({
							id_company: sectionDB.id_company,
							id_section: sessionDB.id_section, // session requested (sector requested),
							nm_persons: tableDB.nm_persons,
							id_session: null,
							tm_provided: null
						})
							.sort({ tm_start: 1 }) // priority true first
							// .limit(1)
							.then(ticketDB => {

								if (!ticketDB) {
									return res.status(200).json({
										ok: false,
										msg: 'No existen tickets pendientes.',
										ticket: null
									})
								}

								ticketDB.tm_provided = + new Date().getTime();
								ticketDB.id_session = idSession;
								ticketDB.id_socket_waiter = idSocketDesk;

								ticketDB.save().then(ticketSaved => {

									server.io.to(ticketSaved.id_socket_client).emit('message-private', { msg: `Por favor pase por la mesa ${tableDB.nm_table}` });
									if (ticketSaved?.id_company) { server.io.to(ticketSaved.id_company).emit('update-public'); }

									return res.status(200).json({
										ok: true,
										msg: 'Ticket obtenido correctamente',
										ticket: ticketSaved
									});

								}).catch(() => {
									return res.status(400).json({
										ok: false,
										msg: 'Se encontro un ticket pero sucedió un error al actualizarlo',
										ticket: null
									});
								})
							}).catch(() => {
								return res.status(500).json({
									ok: false,
									msg: 'Error al consultar el ticket',
									ticket: null
								})
							})

					}).catch(() => {
						return res.status(500).json({
							ok: false,
							msg: 'Error al consultar las mesas para el sector',
							waiter: null
						})
					})
			});

		}).catch(() => {
			return res.status(500).json({
				ok: false,
				msg: 'Error al consultar la session del camarero',
				waiter: null
			})
		})
}

function releaseTicket(req: Request, res: Response) {
	const idTicket = req.body.idTicket;

	Ticket.findByIdAndUpdate(idTicket, {
		tm_att: null,
		id_socket_waiter: null,
		id_session: null,
		tm_end: null
	}, { new: true }).then(ticketReleased => {
		if (ticketReleased?.id_company) { server.io.to(ticketReleased.id_company).emit('update-public'); }
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

function endTicket(req: Request, res: Response) {
	const idTicket = req.body.idTicket;
	Ticket.findByIdAndUpdate(idTicket, { tm_end: + new Date().getTime() }).then(ticketEnded => {

		if (ticketEnded?.id_company) {
			server.io.to(ticketEnded.id_company).emit('update-public'); // clients
		}

		return res.status(200).json({
			ok: true,
			msg: 'Ticket finalizado correctamente',
			ticket: ticketEnded
		})
	}).catch(() => {
		return res.status(400).json({
			ok: false,
			msg: 'No se pudo finalizar el ticket',
			ticket: null
		})
	})
};

// ========================================================
// public methods
// ========================================================

function getTickets(req: Request, res: Response) {
	const idCompany = req.params.id_company;

	let year = + new Date().getFullYear();
	let month = + new Date().getMonth();
	let day = + new Date().getDate();
	let time = + new Date(year, month, day).getTime();

	Ticket.find({
		id_company: idCompany, // only this company
		tm_start: { $gt: time }  // only from today
	}).populate({
		path: 'id_session',
		populate: { path: 'id_waiter id_table' }
	})
		.populate('id_session')
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
				msg: "Error al obtener los tickets para la empresa solicitada.",
				tickets: null
			});
		})
};

function updateSocket(req: Request, res: Response) {

	const idTicket = req.body.idTicket;
	const oldSocket = req.body.oldSocket;
	const newSocket = req.body.newSocket;

	Ticket.findById(idTicket).then((ticketDB) => {

		if (!ticketDB) {
			return res.status(400).json({
				ok: false,
				msg: "No existe el ticket con el socket a actualizar."
			});
		}

		let requestUpdateTo: string;
		switch (oldSocket) {
			case ticketDB.id_socket_client: // actualizo el socket del cliente
				ticketDB.id_socket_client = newSocket;
				if (ticketDB.id_socket_waiter) { requestUpdateTo = ticketDB.id_socket_waiter; }
				break;
			case ticketDB.id_socket_waiter: // actualizo el socket del camarero
				ticketDB.id_socket_waiter = newSocket
				requestUpdateTo = ticketDB.id_socket_client;
				break;
			default:
				break;
		}


		ticketDB.save().then((ticketUpdated) => {
			// antes de enviar el ticket actualizado al solicitante, tengo que 
			// avisarle a la otra parte, que tiene que actualizar el ticket. 
			if (requestUpdateTo) {
				server.io.to(requestUpdateTo).emit('ticket-updated', {
					ok: true,
					msg: 'El socket del destino ha cambiado',
					ticket: ticketUpdated
				});
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
	createTicket,
	cancelTicket,
	takeTicket,
	releaseTicket,
	reassignTicket,
	endTicket,
	getTickets,
	updateSocket,
}