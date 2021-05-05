import { Schema, model, Document } from 'mongoose';
import uniqueValidator from 'mongoose-unique-validator';

var valdTypes = {
  values: ["bar", "resto", "coffee"],
  message: "{VALUE} no es un rol permitido"
};

const companySchema = new Schema({

  // company form
  id_user: { type: String, ref: 'User', required: [true, 'El id_user es necesario'] },
  tx_company_type: { type: String, required: [true, 'El tx_company_type es necesario'], enum: valdTypes },
  tx_company_name: { type: String, unique: true, required: [true, 'El tx_company_name es necesario'] },
  tx_company_slogan: { type: String, required: false },
  tx_company_string: { type: String, unique: true, required: [true, 'El tx_company_string es necesario'] },
  //tx_company_location: { type: String, required: [true, 'El tx_company_location es necesario'] },
  //cd_company_location: { type: String, required: [true, 'El cd_company_location es necesario'] },
  tx_company_location: { type: String, required: false },
  cd_company_location: { type: String, required: false },

  tx_company_lat: { type: Number, required: [true, 'El tx_company_lat es necesario'] },
  tx_company_lng: { type: Number, required: [true, 'El tx_company_lng es necesario'] },
  tx_address_street: { type: String, required: [true, 'El tx_address_street es necesario'] },
  tx_address_number: { type: Number, required: [true, 'El tx_address_number es necesario'] },

  // about form
  tx_email: { type: String, default: '' },
  tx_telegram: { type: String, default: '' },
  tx_whatsapp: { type: String, default: '' },
  tx_facebook: { type: String, default: '' },
  tx_twitter: { type: String, default: '' },
  tx_instagram: { type: String, default: '' },
  tx_company_welcome: { type: String, default: '' },

  // uploader
  tx_company_logo: { type: String, required: false },
  tx_company_cover: { type: String, required: false },
  tx_company_images: { type: [String], default: [] },
  tx_theme: { type: String, required: false }
}, { collection: "companies" })

interface Company extends Document {
  id_user: string;
  tx_company_name: string;
  tx_company_slogan: string;
  tx_company_string: string;
  tx_company_location: string;
  cd_company_location: string;
  tx_company_lat: number;
  tx_company_lng: number;
  tx_address_street: string;
  tx_address_number: number;
  tx_email: string;
  tx_telegram: string;
  tx_whatsapp: string;
  tx_facebook: string;
  tx_twitter: string;
  tx_instagram: string;
  tx_company_welcome: string;
  tx_company_logo: string | null;
  tx_company_cover: string | null;
  tx_company_images: string[];
  tx_theme: string;
}

companySchema.plugin(uniqueValidator, { message: 'El campo {PATH} debe de ser unico' });
export const Company = model<Company>('Company', companySchema);