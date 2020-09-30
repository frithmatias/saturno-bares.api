import { Schema, model, Document } from 'mongoose';

const tableStatusSchema = new Schema({
    id_table: {type: String, ref: 'Table', required: [true, 'El id del ticket es necesario']},
    id_ticket: {type: String, ref: 'Ticket', required: false },
    tx_status: {type: String, required: [true, 'El tx_status es necesario']},
    tm_timestamp: {type: String, required: [true, 'El timestamp del nuevo estado es necesario']}
},{ collection: "tableStatus" })

export interface TablesStatus extends Document {
    id_table: string; 
    id_ticket: string; 
    tx_status: string;  // busy, reserved, idle
    tm_timestamp: Date; 
}

export const TablesStatus = model<TablesStatus>('TablesStatus', tableStatusSchema);