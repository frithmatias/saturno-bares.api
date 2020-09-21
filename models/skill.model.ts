import { Schema, model, Document } from 'mongoose';
import uniqueValidator from 'mongoose-unique-validator';

const skillSchema = new Schema({
    id_company: { type: String, required: [true, 'El id_company es necesario'] },
    cd_skill: { type: String, required: [true, 'El cd_skill es necesario'] },
    tx_skill: { type: String, required: [true, 'El tx_skill es necesario'] },
    bl_generic: { type: Boolean, required: true, default: false }
}, { collection: "skills" })

interface Skill extends Document {
    id_company: string;
    cd_skill: string;
    tx_skill: string;
    bl_generic: boolean;
}
skillSchema.plugin(uniqueValidator, { message: 'El campo {PATH} debe de ser unico' });
export const Skill = model<Skill>('Skill', skillSchema);