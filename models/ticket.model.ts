import { Schema, model, Document } from 'mongoose';

const ticketsSchema = new Schema({
    id_company: {type: String, ref: 'Company', required: [true, 'El id de la empresa es necesario']},
    id_session: {type: String, ref: 'Session', required: false},
    nm_persons: {type: Number, required: [true, 'El número de personas es necesario']},
    bl_priority: {type: Boolean, required: false},
    id_status: {type: String, ref: 'TicketsStatus', required: true},
    id_position: {type: Number, required: [true, 'El id del ticket es necesario']},
    id_socket_client: {type: String, required: [true, 'El socket del cliente en el ticket es necesario']},
    id_socket_waiter: {type: String, required: false},
    tm_start: {type: Number, required: true, default: + new Date().getTime()},
    tm_provided: {type: Number, required: true, default: + new Date().getTime()},
    tm_att: {type: Number, required: false },
    tm_end: { type: Number, required: false },
},{ collection: "tickets" })

export interface Ticket extends Document {
    id_company: string; // requested
    id_session: string | null; // requested 
    nm_persons: number; // requested
    bl_priority: boolean | null; // requested
    id_status: string, // assigned [privided, assigned, queued, requested]
    id_position: number; // assigned
    id_socket_client: string; // primary
    id_socket_waiter: string | null; // assigned
    tm_start: number;
    tm_provided: number | null;
    tm_att: number | null;
    tm_end: number | null;
}

export const Ticket = model<Ticket>('Ticket', ticketsSchema);