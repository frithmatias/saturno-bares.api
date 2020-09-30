import { Schema, model, Document } from 'mongoose';

const tableSchema = new Schema({
    id_section: {type: String, required: [true, 'El id_section es necesario']},
    nm_table: {type: Number, required: [true, 'El cd_table es necesario']},
    nm_persons: {type: Number, required: [true, 'El cn_persons es necesario']},
    tx_status: {type: String, required: [true, 'El tx_status es necesario'], default: 'paused'}, // busy, paused, idle
    id_ticket: {type: String, ref: 'Ticket', required: false}

},{ collection: "tables" })

export interface Table extends Document { 
    id_section?: string;
    nm_table?: number;
    nm_persons?: number;
    tx_status?: string;
    id_ticket?: string;
}
export const Table = model<Table>('Table', tableSchema);