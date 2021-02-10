import { Schema, model, Document } from 'mongoose';

const tableSessionSchema = new Schema({
    id_tables: [{type: Schema.Types.ObjectId, ref: 'Table', required: [true, 'El id del ticket es necesario']}],
    id_ticket: {type: String, ref: 'Ticket', required: false },
    tm_start: {type: Date, required: true, default: new Date().getTime()},
    tm_end: {type: Date, required: false, default: null},
},{ collection: "table.session" })

export interface TableSession extends Document {
    id_tables: string[]; 
    id_ticket: string; 
    tm_start: Date;
    tm_end: Date; 
}

export const TableSession = model<TableSession>('TableSession', tableSessionSchema);