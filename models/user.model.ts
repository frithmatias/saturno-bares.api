import { Schema, model, Document } from 'mongoose';
import uniqueValidator from 'mongoose-unique-validator';
import bcrypt from 'bcrypt';

var rolesValidos = {
    values: ["SUPERUSER_ROLE", "ADMIN_ROLE", "WAITER_ROLE"],
    message: "{VALUE} no es un rol permitido"
  };
  
const userSchema = new Schema({
    bl_active: {type: Boolean, required: false, default: false},
    tx_name: {type: String, required: [true, 'El nombre es necesario']},
    tx_email: {type: String, unique: true, required: [true, 'El email es necesario']},
    tx_password: {type: String, required: [true, 'El password es necesario']},
    id_company: {type: String, ref: 'Company', required: false},
    id_role: {type: String, required: [true, 'El rol del usuario es necesario']},
    tx_img: {type: String, required: false},
    bl_social: {type: Boolean, required: true, default: false},
    tx_platform: {type: String, required: true, default: false},
    cd_pricing: {type: Number, ref: 'Pricing' , required: false, default: 0},
    tm_lastlogin: { type: Date, required: false },
    tm_createdat: { type: Date, required: false }
},{ collection: "users" })

userSchema.method('checkPassword', function(this: any, pass: String = ''): boolean {
    // Aca es muy importante NO USAR función de flecha sino una función tradicional
    // para no perder la referencia al THIS que apunta al objeto const userSchema = new Schema({})
    if (bcrypt.compareSync(pass, this.tx_password)) {
        return true;
    } else {
        return false;
    }
});

userSchema.method('getData', function(this: any) {
    // Aca es muy importante NO USAR función de flecha sino una función tradicional
    // para no perder la referencia al THIS que apunta al objeto const userSchema = new Schema({})
        const {__v, _id, tx_password, ...object} = this.toJSON();
        object.uid = _id;
        return object;
});

interface User extends Document {
    bl_active: boolean;
    tx_name: string;
    tx_email: string;
    tx_password: string;
    id_company: string;
    id_role: string;
    cd_pricing: number;
    tx_img: string | null;
    bl_social: boolean;
    tx_platform: string;
    tm_lastlogin: Date | null;
    tm_createdat: Date;
    getData: () => {};
}

userSchema.plugin( uniqueValidator, {message: 'El campo {PATH} debe de ser unico'} );
export const User = model<User>('User', userSchema);

