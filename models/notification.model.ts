import { Schema, model, Document } from 'mongoose';
import uniqueValidator from 'mongoose-unique-validator';

const notificationSchema = new Schema({
    id_owner: { type: [String], required: [true, 'El id_owner es necesario'] },
    tx_icon: { type: String, required: [true, 'El tx_icon es necesario'] },
    tx_title: { type: String, required: [true, 'El tx_title es necesario'] },
    tx_message: { type: String, required: [true, 'El tx_message es necesario'] },
    tm_notification: { type: Date, required: [true, 'El tm_notification es necesario'] },
    tm_event: { type: Date, required: false },

}, { collection: "notifications" })

interface Notification extends Document {
    id_owner: string[]; // id_company | id_section | id_user
    tx_icon: string;
    tx_title: string;
    tx_message: string;
    tm_notification: Date;
    tm_event: Date;
}
notificationSchema.plugin(uniqueValidator, { message: 'El campo {PATH} debe de ser unico' });
export const Notification = model<Notification>('Notification', notificationSchema);