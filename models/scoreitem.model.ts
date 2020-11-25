import { Schema, model, Document } from 'mongoose';

const scoreItemsSchema = new Schema({
    id_section: {type: String, ref: 'Section', required: [true, 'El id_section es necesario']},
    tx_item: {type: String,  required: [true, 'El tx_item es necesario']},
},{ collection: "score.items" })

interface ScoreItem extends Document {
    id_section: string;
    tx_item: string;
}

export const ScoreItem = model<ScoreItem>('ScoreItem', scoreItemsSchema);