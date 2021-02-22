import { Request, Response } from 'express';
import Mail from '../classes/mail';

async function sendMail(req: Request, res: Response) {
    const txEmail = req.body.txEmail;
    const txMessage = req.body.txMessage;

    Mail.sendMail('reservas', txEmail, txMessage).then(response => {
        return res.status(200).json({
            ok: true,
            msg: 'El Email fue enviado correctamente',
            response 
        });
    }).catch((response) => {
        return res.status(400).json({
            ok: false,
            msg: 'No se pudo enviar el Email',
            response
        });
    })

}

export = {
    sendMail
}

