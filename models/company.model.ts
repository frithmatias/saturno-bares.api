import { Schema, model, Document } from 'mongoose';
import uniqueValidator from 'mongoose-unique-validator';

const companySchema = new Schema({
    id_user: { type: String, required: [true, 'El id_user es necesario'] },
    tx_company_name: { type: String, unique: true, required: [true, 'El tx_company_name es necesario'] },
    tx_company_slogan: { type: String, default: false },
    tx_company_string: { type: String, unique: true, required: [true, 'El tx_company_string es necesario'] },
    tx_company_location: { type: String, required: [true, 'El tx_company_location es necesario'] },
    cd_company_location: { type: String, required: [true, 'El cd_company_location es necesario'] },
    tx_company_lat: { type: String, required: [true, 'El tx_company_lat es necesario'] },
    tx_company_lng: { type: String, required: [true, 'El tx_company_lng es necesario'] },
    tx_address_street: { type: String, required: [true, 'El tx_address_street es necesario'] },
    tx_address_number: { type: Number, required: [true, 'El tx_address_number es necesario'] },
    tx_company_history: { type: String, default: 'La Historia o presentación de tu comercio aquí' },
    tx_company_logo: { type: String, default: 'default-logo.svg' }, // busy, paused, idle, reserved 
    tx_company_banners: { type: [String], default: [] }, // busy, paused, idle, reserved 
    tm_start: { type: Date, required: false },
    tm_end: { type: Date, required: false },
}, { collection: "companies" })

interface Company extends Document {
    id_user: string;
    tx_company_name: string;
    tx_company_slogan: string;
    tx_company_string: string;
    tx_address_street: string;
    tx_address_number: number;
    tx_company_location: string;
    cd_company_location: string;
    tx_company_lat: string;
    tx_company_lng: string;
    tx_company_history: string;
    tx_company_logo: string;
    tx_company_banners: string[];
    tm_start: Date;
    tm_end: Date;
}

companySchema.plugin(uniqueValidator, { message: 'El campo {PATH} debe de ser unico' });
export const Company = model<Company>('Company', companySchema);