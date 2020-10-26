import { Schema, model, Document } from 'mongoose';

const tableSessionSchema = new Schema({
    id_tables: [{type: Schema.Types.ObjectId, ref: 'Table', required: [true, 'El id del ticket es necesario']}],
    id_ticket: {type: String, ref: 'Ticket', required: false },
    tm_start: {type: Number, required: true, default: + new Date().getTime()},
    tm_end: {type: Number, required: false, default: null},
},{ collection: "table.sessions" })

export interface TableSession extends Document {
    id_tables: string[]; 
    id_ticket: string; 
    tm_start: Number;
    tm_end: Number; 
}

export const TableSession = model<TableSession>('TableSession', tableSessionSchema);