import { Schema, model, Document } from 'mongoose';
import { Company } from './company.model';

const ticketsSchema = new Schema({
    id_company: { type: String, ref: 'Company', required: [true, 'El id_company es necesario'] },
    id_section: { type: String, ref: 'Section', required: [true, 'El id_section es necesario'] },
    id_session: { type: String, ref: 'TableSession', required: false, default: null },
    nm_persons: { type: Number, required: [true, 'El nm_persons es necesario'] },
    bl_contingent: { type: Boolean, required: true, default: false },
    bl_priority: { type: Boolean, required: true, default: false },
    tx_name: { type: String, required: false, default: null },
    tx_platform: { type: String, required: false, default: null },
    tx_email: { type: String, required: false, default: null },
    nm_phone: { type: Number, required: false, default: null },
    tx_call: { type: String, required: false, default: null },
    tx_status: { type: String, required: [true, 'El tx_status es necesario'], default: 'queued' },
    cd_tables: { type: [Number], required: true, default: [] }, // only for requested and assigned tickets
    id_position: { type: Number, required: false }, // id_position -> queued, requested [but not reserved]
    id_socket_client: { type: String, required: false },
    id_socket_waiter: { type: String, required: false },
    tm_intervals: { type: [Date], required: false, default: [] },

    tm_start: { type: Date, required: true, default: + new Date() },
    tm_init: { type: Date, required: false, default: null },
    tm_call: { type: Date, required: false, default: null },
    tm_provided: { type: Date, required: false, default: null },
    tm_att: { type: Date, required: false, default: null },
    tm_end: { type: Date, required: false, default: null }
}, { collection: "tickets" })

export interface Ticket extends Document {
    id_company: any | string; // ani if company is populated
    id_section: any | string; // any if section is populated
    id_session?: string | null; 
    nm_persons: number;
    bl_contingent: boolean;
    bl_priority: boolean;
    tx_name: string | null;
    tx_platform: string | null;
    tx_email: string | null;
    nm_phone: number | null;
    tx_call: string | null;
    tx_status: string; // Virtual: [queued, requested, assigned, provided, finished, terminated], Scheduled: [waiting, scheduled, assigned, provided, finished, terminated], killed
    cd_tables: number[]; //for requested and assigned tickets
    id_position: number | null;
    id_socket_client: string | null;
    id_socket_waiter?: string | null;
    tm_intervals: Date[],
    tm_start: Date;
    tm_init: Date | null;
    tm_call: Date | null;
    tm_provided?: Date | null;
    tm_att?: Date | null;
    tm_end?: Date | null;
}

export const Ticket = model<Ticket>('Ticket', ticketsSchema);