import { Schema, model, Document } from 'mongoose';
import uniqueValidator from 'mongoose-unique-validator';

const contactSchema = new Schema({
    tx_type: { type: String, required: [true, 'El cd_contact es necesario'] },
    tx_message: { type: String, required: [true, 'El tx_message es necesario'] },
    tx_name: { type: String, required: false },
    tx_email: { type: String, required: false },
    tx_phone: { type: String, required: false },

}, { collection: "contacts" })

interface Contact extends Document {
    tx_type: string;
    tx_message: string;
    tx_name: string;
    tx_email: string;
    tx_phone: string;
}
contactSchema.plugin(uniqueValidator, { message: 'El campo {PATH} debe de ser unico' });
export const Contact = model<Contact>('Contact', contactSchema);