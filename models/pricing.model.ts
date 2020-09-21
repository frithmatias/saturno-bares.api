import { Schema, model, Document } from 'mongoose';
import uniqueValidator from 'mongoose-unique-validator';

const pricingSchema = new Schema({
    cd_pricing: { type: Number, required: [true, 'El cd_pricing es necesario'] },
    tx_pricing: { type: String, required: [true, 'El tx_pricing es necesario'] },
}, { collection: "pricings" })

interface Pricing extends Document {
    cd_pricing: number;
    tx_pricing: string;
}
pricingSchema.plugin(uniqueValidator, { message: 'El campo {PATH} debe de ser unico' });
export const Pricing = model<Pricing>('Pricing', pricingSchema);