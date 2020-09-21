import { Schema, model, Document } from 'mongoose';
import uniqueValidator from 'mongoose-unique-validator';

const errorSchema = new Schema({
    cd_error: {type: String, required: [true, 'El cd_error es necesario']},
    tx_error: {type: String, required: [true, 'El tx_error es necesario']},
},{ collection: "errors" })

interface Error extends Document {
    cd_error: string;
    tx_error: string;
}
errorSchema.plugin( uniqueValidator, {message: 'El campo {PATH} debe de ser unico'} );
export const Error = model<Error>('Error', errorSchema);