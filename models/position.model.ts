import { Schema, model, Document } from 'mongoose';

const positionSchema = new Schema({
    id_day: {type: Number, required: [true, 'El id_day es necesario']},
    id_month: {type: Number, required: [true, 'El id_month es necesario']},
    id_year: {type: Number, required: [true, 'El id_year es necesario']},
    id_section: {type: String, required: [true, 'El id_session es necesario']},
    id_position: {type: Number, required: [true, 'El id_position es necesario']},
},{ collection: "position" })

interface Position extends Document {
    id_day: number;
    id_month: number;
    id_year: number;
    id_section: string;
    id_position: number;
}

export const Position = model<Position>('Position', positionSchema);