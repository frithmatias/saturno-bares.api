import { Schema, model, Document } from 'mongoose';

const tableSessionSchema = new Schema({
    id_table: {type: String, ref: 'Table', required: [true, 'El id del ticket es necesario']},
    id_ticket: {type: String, ref: 'Ticket', required: false },
    fc_start: {type: Number, required: true, default: + new Date().getTime()},
    fc_end: {type: Number, required: false, default: null},
},{ collection: "tableSessions" })

export interface TableSession extends Document {
    id_table: string; 
    id_ticket: string; 
    fc_start: Number;
    fc_end: Number; 
}

export const TableSession = model<TableSession>('TableSession', tableSessionSchema);