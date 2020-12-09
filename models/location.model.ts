import { Schema, model, Document } from 'mongoose';

var locationSchema = new Schema(
    {
        properties: {
            categoria: { type: String, required: false },
            fuente: { type: String, required: false },
            nombre: { type: String, required: false },
            id: { type: String, required: false },
            municipio: {
                nombre: { type: String, required: false },
                id: { type: String, required: false }
            },
            departamento: {
                nombre: { type: String, required: false },
                id: { type: String, required: false }
            },
            provincia: {
                nombre: { type: String, required: false },
                id: { type: String, required: false },
            },
            localidad_censal: {
                nombre: { type: String, required: false },
                id: { type: String, required: false },
            },
            type: { type: String, required: false }

        },
        type: { type: String, required: false },
        geometry: {
            coordinates: { type: [String], required: false },
        }
    },
    { collection: "locations" }
);


interface Location extends Document {
    properties: {
        categoria: string;
        fuente: string;
        nombre: string;
        id: string;
        municipio: {
            nombre: string;
            id: string;
        };
        departamento: {
            nombre: string;
            id: string;
        };
        provincia: {
            nombre: string;
            id: string;
        };
        localidad_censal: {
            nombre: string;
            id: string;
        };
    };
    geometry: {
        coordinates: string[];
        type: string;
    };
    _id: string;
    type: string;
}

export const Location = model<Location>('Location', locationSchema);