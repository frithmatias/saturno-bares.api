import { Schema, model, Document } from 'mongoose';

const sectionSchema = new Schema({
    id_company: {type: String, required: [true, 'El id_company es necesario']},
    tx_section: {type: String, required: [true, 'El tx_section es necesario']},
    id_session: {type: String, required: false},
},{ collection: "sections" })

export interface Section extends Document { 
    id_company?: string;
    tx_section?: string;
    id_session?: string | null; 
}
export const Section = model<Section>('Section', sectionSchema);