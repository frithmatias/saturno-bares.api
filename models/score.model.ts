import { Schema, model, Document } from 'mongoose';

const scoreSchema = new Schema({
    id_ticket: {type: String, ref: 'Ticket', required: [true, 'El id_ticket es necesario']},
    id_scoreitem: {type: String, ref: 'ScoreItem', required: [true, 'El id_scoreitem es necesario']},
    cd_score: {type: Number, required: [true, 'El cd_score es necesario']},
},{ collection: "scores" })

interface Score extends Document {
    id_ticket: string;
    id_scoreitem: string;
    cd_score: number;
}

export const Score = model<Score>('Score', scoreSchema);