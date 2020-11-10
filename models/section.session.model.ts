import { Schema, model, Document } from 'mongoose';

const sectionSessionSchema = new Schema({
    id_section: { type: String, ref: 'Section', required: [true, 'El ID del sector es necesario'] },
    id_waiter: { type: String, ref: 'User', required: [true, 'El ID del camarero es necesario'] },
    tm_start: { type: Number, required: true, default: + new Date().getTime() },
    tm_end: { type: Number, required: false, default: null },
}, { collection: "sessions" })

// middleware: populate section after save session
sectionSessionSchema.post('save', function (doc, next) {
    doc.populate('id_section').execPopulate().then(function () {
        next();
    });
});

interface sectionSession extends Document {
    id_section: string;
    id_waiter: string;
    tm_start: number;
    tm_end?: number | null;
}
export const sectionSession = model<sectionSession>('sectionSession', sectionSessionSchema);