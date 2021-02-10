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

    // VALIDATE TICKET
    bot.onText(/\/start (.+)/, async (msg, match) => {
        const idUser = msg.chat.id.toString();
        const txPlatform = 'telegram';
        const txName = msg.chat.first_name;
        const idTicket = match !== null ? match[1] : '';
        // ticket.validateTicket(idTicket, txPlatform, idUser, txName).then((resp: string) => {
        //     bot.sendMessage(idUser, resp);
        // }).catch((err) => {
        //     bot.sendMessage(idUser, err)
        // })

    });
}
