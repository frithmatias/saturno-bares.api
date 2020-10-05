import { Schema, model, Document } from 'mongoose';

const scoreItemsSchema = new Schema({
    id_section: {type: String, ref: 'Section', required: [true, 'El id_section es necesario']},
    tx_item: {type: String,  required: [true, 'El tx_item es necesario']},
    bl_active: {type: Boolean, required: [true, 'El bl_active es necesario']},
},{ collection: "score.items" })

interface ScoreItem extends Document {
    id_section: string;
    tx_item: string;
    bl_active: boolean;
}

export const ScoreItem = model<ScoreItem>('ScoreItem', scoreItemsSchema);