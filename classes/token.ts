import jwt from 'jsonwebtoken';
import environment from '../global/environment.prod';

export default class Token {

    constructor() { }

    static getJwtToken(payload: any): string {
        return jwt.sign(
            { payload },
            environment.TOKEN_SEED,
            { expiresIn: environment.TOKEN_TIMEOUT }
        );
    }

    static checkToken(userToken: string) {
        return new Promise((resolve, reject) => {
            jwt.verify(userToken, environment.TOKEN_SEED, (err: any, decoded: any) => {
                if (err) {
                    reject();
                } else {
                    resolve(decoded);
                }
            });
        });
    }
}