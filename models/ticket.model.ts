import { Schema, model, Document } from 'mongoose';

const ticketsSchema = new Schema({
    id_company: {type: String, ref: 'Company', required: [true, 'El id_company es necesario']},
    id_section: {type: String, ref: 'Section', required: [true, 'El id_section es necesario']},
    id_session: {type: String, ref: 'Session', required: false, default: null},
    nm_persons: {type: Number, required: [true, 'El nm_persons es necesario']},
    bl_priority: {type: Boolean, required: true, default: false},
    bl_called: {type: Boolean, required: true, default: true},
    tx_status: {type: String, required: [true, 'El tx_status es necesario'], default: 'queued'},
    id_position: {type: Number, required: [true, 'El id_position es necesario']},
    id_socket_client: {type: String, required: [true, 'El id_socket_client es necesario']},
    id_socket_waiter: {type: String, required: false},
    tm_start: {type: Number, required: true, default: + new Date().getTime()},
    tm_provided: {type: Number, required: false, default: null},
    tm_att: {type: Number, required: false, default: null },
    tm_end: { type: Number, required: false, default: null }
},{ collection: "tickets" })

export interface Ticket extends Document {
    id_company: string; // requested
    id_section: string; // requested
    id_session?: string | null; // requested 
    nm_persons: number; // requested
    bl_priority: boolean; // requested
    bl_called: boolean;
    tx_status: string; // assigned [privided, assigned, queued, requested]
    id_position: number; // assigned
    id_socket_client: string; // primary
    id_socket_waiter?: string | null; // assigned
    tm_start: number;
    tm_provided?: number | null;
    tm_att?: number | null;
    tm_end?: number | null;
}

export const Ticket = model<Ticket>('Ticket', ticketsSchema);