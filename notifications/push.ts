import * as keys from '../notifications/vapid.json';
import  urlsafeBase64  from 'urlsafe-base64';

// npm install @types/urlsafe-base64

export const getPublicKey = () => {
    return urlsafeBase64.decode(keys.publicKey);
}

export const getPrivateKey = () => {
    return urlsafeBase64.decode(keys.privateKey);
}



