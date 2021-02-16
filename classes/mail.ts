import { environment } from '../global/environment';
import nodemailer from 'nodemailer';

export default class Mail {
    constructor(){}

    public static async sendMail(type: string, email: string, message: string){
        
        let MAILER_SENDER;
        let MAILER_SUBJECT;
        switch (type) {
            case 'reservas':
                MAILER_SENDER = environment.MAILER_RESERVAS;
                MAILER_SUBJECT = 'Información de tu reserva';
                break;
            case 'registro':
                MAILER_SENDER = environment.MAILER_REGISTRO;
                MAILER_SUBJECT = 'Activá tu cuenta';
                break;
            default:
                MAILER_SENDER = environment.MAILER_ADMIN;
                MAILER_SUBJECT = 'Información';
                break;
        }

        const MAILER_FROM = '"Saturno Fun" < ' + MAILER_SENDER + '>';
    console.log(MAILER_SENDER)
        let transporter = nodemailer.createTransport({
            host: environment.MAILER_HOST,
            port: environment.MAILER_PORT,
            secure: false, // true for 465, false for other ports
            auth: {
                user: MAILER_SENDER, // generated ethereal user
                pass: environment.MAILER_PASS, // generated ethereal password
            },
        });
    
        let info = await transporter.sendMail({
            from: MAILER_FROM, // sender address
            to: email, // list of receivers
            subject: MAILER_SUBJECT, // Subject line
            text: message, // plain text body
            //  html: "<b>Hello world?</b>", // html body
        });
    }
}