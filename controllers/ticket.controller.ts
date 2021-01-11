import { Request, Response } from 'express';
import Server from '../classes/server';
import spm from '../classes/spm';

// MODELS
import { Ticket } from '../models/ticket.model';
import { Position } from '../models/position.model';
import { Table } from '../models/table.model';
import { Section } from '../models/section.model';
import { TableSession } from '../models/table.session.model';
import { Settings } from '../models/settings.model';

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
	Ticket.findByIdAndUpdate(idTicket, { tx_status: 'finished', tm_end: + new Date().getTime() }, { new: true }).then((ticketCanceled) => {

		if (!ticketCanceled) {
			return res.status(400).json({
				ok: false,
				msg: 'No se puedo cancelar el ticket',
				ticket: ticketCanceled
			})
		}

		if (ticketCanceled?.id_session) {

			let idSession = ticketCanceled.id_session;
			// si ya tenía asignada una sesión de mesa, habilito la mesa y cierro su sesión.
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

function createTicket(req: Request, res: Response) {

	const { blContingent, idSocket, txName, nmPersons, idSection } = req.body;

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
				id_session: null,
				nm_persons: nmPersons,
				bl_contingent: blContingent,
				bl_priority: false,
				tx_name: txName,
				tx_call: null,
				tm_call: null,
				tx_status: 'queued',
				id_position: idPosition,
				id_socket_client: idSocket,
				id_socket_waiter: null,
				tm_start: + new Date().getTime(),
				tm_provided: null,
				tm_att: null,
				tm_end: null
			})

			ticket.save().then(async (ticketSaved) => {

				// obtengo las configuraciones para el comercio
				const settings = await Settings.findOne({id_company: ticketSaved.id_company});

				// si spm esta activado hago un push 
				let spmResp: string = settings?.bl_spm_auto ? await spm.push(ticket) : 'Spm desactivado, el ticket quedo en cola';
			
				// envío pedido de actualización despues del push
				const server = Server.instance;
				server.io.to(idSocket).emit('message-private', { msg: 'Bienvenido, puede realizar culquier consulta por aquí. Gracias por esperar.' });
				server.io.to(sectionDB.id_company).emit('update-waiters');

				return res.status(201).json({
					ok: true,
					msg: spmResp,
					ticket
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
	const { idTicket, txCall } = req.body;

	Ticket.findByIdAndUpdate(idTicket, { tx_call: txCall, tm_call: + new Date() }, { new: true }).then(ticketAttended => {

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

function readTickets(req: Request, res: Response) {
	const idCompany = req.params.idCompany;
	let year = + new Date().getFullYear();
	let month = + new Date().getMonth();
	let day = + new Date().getDate();
	let time = + new Date(year, month, day).getTime();

	Ticket.find({
		id_company: idCompany, // only this company
		tm_start: { $gt: time },  // only from today
		tm_end: null
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
	createTicket,
	callWaiter,
	releaseTicket,
	attendedTicket,
	endTicket,
	readTickets,
	updateSocket
}