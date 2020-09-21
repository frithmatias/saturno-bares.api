import { Schema, model, Document } from 'mongoose';

const ticketsSchema = new Schema({
    id_root: {type: String, ref: 'Ticket', required: false},
    id_child: {type: String, ref: 'Ticket', required: false, default: false},
    bl_priority: {type: Boolean, required: false},
    id_position: {type: Number, required: [true, 'El id del ticket es necesario']},
    id_socket: {type: String, required: [true, 'El socket del cliente en el ticket es necesario']},
    id_socket_desk: {type: String, required: false},
    id_session: {type: String, ref: 'Session', required: false},
    id_company: {type: String, ref: 'Company', required: [true, 'El id de la empresa es necesario']},
    id_skill: {type: String, ref: 'Skill', required: [true, 'El id del skill es necesario']},
    tm_start: {type: Number, required: true, default: + new Date().getTime()},
    tm_att: {type: Number, required: false },
    tm_end: { type: Number, required: false },
},{ collection: "tickets" })

export interface Ticket extends Document {
    id_root: string | null;
    id_child: string | null;
    bl_priority: boolean | null;
    id_position: number;
    id_socket: string;
    id_socket_desk: string | null;
    id_session: string | null;
    id_company: string;
    id_skill: string;
    tm_start: number;
    tm_att: number | null;
    tm_end: number | null;
}

export const Ticket = model<Ticket>('Ticket', ticketsSchema);