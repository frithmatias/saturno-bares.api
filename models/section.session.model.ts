import { Schema, model, Document } from 'mongoose';

const sectionSessionSchema = new Schema({
    id_section: {type: String, ref: 'Section', required: [true, 'El ID del sector es necesario']},
    id_waiter: {type: String, ref: 'User', required: [true, 'El ID del camarero es necesario']},
    fc_start: {type: Number, required: true, default: + new Date().getTime()},
    fc_end: {type: Number, required: false, default: null},
},{ collection: "sessions" })

interface sectionSession extends Document { 
    id_section: string;
    id_waiter: string;
    fc_start: number;
    fc_end?: number | null;
}
export const sectionSession = model<sectionSession>('sectionSession', sectionSessionSchema);