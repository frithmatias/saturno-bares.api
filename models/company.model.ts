import { Schema, model, Document } from 'mongoose';
import uniqueValidator from 'mongoose-unique-validator';
  
const companySchema = new Schema({
    id_user: {type: String, required: [true, 'El id_user es necesario']},
    tx_company_name: {type: String, unique: true, required: [true, 'El tx_company_name es necesario']},
    tx_company_slogan: {type: String, required: false},
    tx_public_name: {type: String, unique: true, required: [true, 'El tx_public_name es necesario']},
    tx_address_street: {type: String, required: false},
    tx_address_number: {type: String, required: false},
    cd_city: {type: String, required: false},
    tm_start: {type: Date, required: false},
    tm_end: {type: Date, required: false},
},{ collection: "companies" })

interface Company extends Document {
    id_user: string;
    tx_company_name: string;
    tx_company_slogan: string;
    tx_address_street: string;
    tx_address_number: string;
    cd_city: string;
    tm_start: Date;
    tm_end: Date;
}

companySchema.plugin( uniqueValidator, {message: 'El campo {PATH} debe de ser unico'} );
export const Company = model<Company>('Company', companySchema);