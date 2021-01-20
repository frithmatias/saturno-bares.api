import { Ticket } from "../models/ticket.model";

export default class Spm {

    private constructor() { }

    public static email = (ticket: Ticket): Promise<string> => {
        return new Promise((resolve, reject) => {
            
        })
    }


    public static whatsapp = (ticket: Ticket): Promise<string> => {
        return new Promise((resolve, reject) => {

        })
    }


    public static telegram = (ticket: Ticket): Promise<string> => {
        return new Promise(async (resolve, reject) => {

        })
    }

}