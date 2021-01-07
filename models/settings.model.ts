import { Schema, model, Document } from 'mongoose';

const settingsSchema = new Schema({
    id_company: {type: String, required: [true, 'El id_company es necesario']},
    bl_spm_auto: {type: Boolean, required: [true, 'El bl_automatic es necesario']}
},{ collection: "settings" })

export interface Settings extends Document { 
    id_company: string;
    bl_spm_auto: boolean;
}

export const Settings = model<Settings>('Settings', settingsSchema);