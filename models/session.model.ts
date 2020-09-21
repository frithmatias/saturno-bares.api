import { Schema, model, Document } from 'mongoose';

const sessionSchema = new Schema({
    id_desktop: {type: String, ref: 'Desktop', required: [true, 'El desktop es necesario']},
    id_assistant: {type: String, ref: 'User', required: [true, 'El usuario es necesario']},
    fc_start: {type: Number, required: true, default: + new Date().getTime()},
    fc_end: {type: Number, required: false, default: null},
},{ collection: "sessions" })

interface Session extends Document { 
    id_desktop?: string;
    id_assistant?: string;
    fc_start?: number;
    fc_end?: number | null;
}
export const Session = model<Session>('Session', sessionSchema);