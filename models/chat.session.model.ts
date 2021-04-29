import { Schema, model, Document } from 'mongoose';

const chatSessionSchema = new Schema({
    id_user: {type: Schema.Types.ObjectId, ref: 'User', required: [true, 'El id_user es necesario']},
    id_user_socket: {type: String, required: [true, 'El id_user_socket es necesario']},
    id_assistant: {type: Schema.Types.ObjectId, ref: 'User', required: false, default: null},
    id_assistant_socket: {type: String, required: false, default: null},
    tx_assistant_name: {type: String, required: false, default: null},
    tm_start: {type: Date, required: true, default: new Date().getTime()},
    tm_init: {type: Date, required: false, default: null},
    tm_end: {type: Date, required: false, default: null},
    tx_subject: {type: String, required: false, default: null},
    nm_score: {type: Number, required: false, default: null}
},{ collection: "chat.session" })

export interface ChatSession extends Document {

    id_user: string | null; 
    id_user_socket: string;
    id_assistant: string; 
    id_assistant_socket: string;
    tx_assistant_name: string;
    tm_start: Date;
    tm_init: Date | null;
    tm_end: Date | null; 
    tx_subject: string;
    nm_score: number;
}

export const ChatSession = model<ChatSession>('ChatSession', chatSessionSchema);