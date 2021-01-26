import { Ticket } from '../models/ticket.model';
import ticket from '../controllers/ticket.controller';
import TelegramBot from 'node-telegram-bot-api';
import Server from '../classes/server';

export const escucharTelegram = (bot: TelegramBot) => {
    
    bot.on('message', (msg: any) => {
        const chatId = msg.chat.id;
        const firstName = msg.chat.first_name;
        bot.sendMessage(chatId, `Hola ${firstName} recibimos tu mensaje.`);
    });

    // CONFIRM TICKET BY TX_NAME  
    bot.onText(/\/conf (.+)/, async (msg, match) => {
        const idUser = msg.chat.id.toString();
        const firstName = msg.chat.first_name;
        const idTicket = match !== null ? match[1] : '';

        await Ticket.find({ tx_name: idTicket }).then(tickets => {
            for (let ticket of tickets) {
                ticket.tx_status = 'scheduled';
                ticket.tx_platform = 'telegram';
                ticket.id_user = 'test';
                ticket.save().then(() => {
                    if (ticket.id_socket_client) {
                        const server = Server.instance; // singleton
                        server.io.to(ticket.id_socket_client).emit('update-private', { txPlatform: 'telegram', idUser: 'test' });
                    }
                    bot.sendMessage(idUser, 'Validado ' + ticket._id);
                })
            }
        })
    })

    // VALIDATE TICKET
    bot.onText(/\/start (.+)/, async (msg, match) => {
        const idUser = msg.chat.id.toString();
        const txPlatform = 'telegram';
        const txName = msg.chat.first_name;
        const idTicket = match !== null ? match[1] : '';

        ticket.validateTicket(idTicket, txPlatform, idUser, txName).then((resp: string) => {
            bot.sendMessage(idUser, resp);
        }).catch(() => {
            bot.sendMessage(idUser, 'Ocurrió un error al validar tu ticket, por favor volvé a intentar mas tarde.')
        })

    });
}
