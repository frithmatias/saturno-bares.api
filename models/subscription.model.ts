import { Schema, model, Document } from 'mongoose';
import uniqueValidator from 'mongoose-unique-validator';

const subscriptionSchema = new Schema({
    endpoint: { type: String, required: [true, 'El ob_subscription es necesario'] },
    expirationTime: { type: String, required: false },
    keys: {
        p256dh: { type: String, required: false },
        auth: { type: String, required: false }
    }
}, { collection: "subscriptions" })

interface Subscription extends Document {
    endpoint: String;
    expirationTime: String | null;
    keys: {
        p256dh: string;
        auth: string;
    }
}


subscriptionSchema.plugin(uniqueValidator, { message: 'El campo {PATH} debe de ser unico' });
export const Subscription = model<Subscription>('Subscription', subscriptionSchema);