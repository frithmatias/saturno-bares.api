import { Schema, model, Document } from 'mongoose';

const settingsSchema = new Schema({
    id_company: {type: String, required: [true, 'El id_company es necesario']},
    bl_spm: {type: Boolean, required: [true, 'El bl_spm es necesario']},
    bl_schedule: {type: Boolean, required: [true, 'El bl_schedule es necesario']},
    bl_queue: {type: Boolean, required: [true, 'El bl_queue es necesario']},
    tm_working: {type: [[Number]], required: false},
    nm_intervals: {type: Number, required: [true, 'El nm_intervals es necesario']}
},{ collection: "settings" })

export interface Settings extends Document { 
    id_company: string;
    bl_spm: boolean;
    bl_schedule: boolean;
    bl_queue: boolean;
    tm_working: number[][];
    nm_intervals: number;
}

export const Settings = model<Settings>('Settings', settingsSchema);