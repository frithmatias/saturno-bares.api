import { Schema, model, Document } from 'mongoose';

const sectionSchema = new Schema({
    id_company: {type: String, required: [true, 'El id_company es necesario']},
    tx_section: {type: String, required: [true, 'El tx_section es necesario']},
},{ collection: "sections" })

export interface Section extends Document { 
    id_company: string;
    tx_section: string;
}
export const Section = model<Section>('Section', sectionSchema);