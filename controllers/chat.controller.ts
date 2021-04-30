import { Request, Response } from 'express';
import Server from '../classes/server';
import { ChatSession } from '../models/chat.session.model';

const server = Server.instance; // singleton

// ========================================================
// Chat Methods
// ========================================================

function chatRequest(req: Request, res: Response) {


    const idUser = req.body.idUser;
    const idSocket = req.body.idSocket;

    if (!idUser || !idSocket) {
        return res.status(400).json({
            ok: false,
            msg: 'No se obtuvo el usuario o el socket',
            session: null
        });
    }

    const chatSession = new ChatSession();
    chatSession.id_user = idUser;
    chatSession.id_user_socket = idSocket;

    chatSession.save().then((chatSessionSaved) => {

        server.io.to('superuser').emit('update-clients-list'); // clients update
        return res.status(200).json({
            ok: true,
            msg: 'Sesión de chat iniciada correctamente',
            session: chatSessionSaved
        });

    }).catch((err) => {

        return res.status(400).json({
            ok: false,
            msg: err,
            session: null
        });

    })

}

function submitSubject(req: Request, res: Response) {

    const idSession = req.body.idSession;
    const txSubject = req.body.txSubject;

    ChatSession.findByIdAndUpdate(idSession, { tx_subject: txSubject }, { new: true }).then(sessionSaved => {

        if (!sessionSaved) {
            return res.status(400).json({
                ok: false,
                msg: 'No se pudo guardar el asunto de la sesión de chat',
                session: null
            })
        }

        return res.status(200).json({
            ok: true,
            msg: 'El asunto de la sesión de chat se guardo correctamente',
            session: sessionSaved
        })
    })

}

function initializeSession(req: any, res: Response) {



    if (!req.usuario) {
        return res.status(400).json({
            ok: false,
            msg: 'No se pudo obtener el id del usuario',
            session: null
        })
    }

    const idSession = req.body.idSession;
    const idSocket = req.body.idSocket;
    const idAssistant = req.usuario._id;
    const txAssistantName = req.usuario.tx_name;


    ChatSession.findByIdAndUpdate(idSession, {
        tm_init: new Date(),
        id_assistant_socket: idSocket,
        id_assistant: idAssistant,
        tx_assistant_name: txAssistantName
    }, { new: true }).then(sessionInitialized => {
        if (!sessionInitialized) {
            return res.status(400).json({
                ok: false,
                msg: 'No se pudo inicializar la sesión de chat',
                session: null
            })
        }

        server.io.to(sessionInitialized.id_user_socket).emit('chat-session-initialized', sessionInitialized); // schedule update

        return res.status(200).json({
            ok: true,
            msg: 'Sesión de chat inicializada correctamente',
            session: sessionInitialized
        })
    })

}

function endSession(req: Request, res: Response) {
    const idSession = req.params.idSession;
    ChatSession.findByIdAndUpdate(idSession, { tm_end: new Date() }, { new: true }).then((sessionEnded) => {

        if (!sessionEnded) {
            return res.status(400).json({
                ok: false,
                msg: 'No se pudo finalizar la sesión de chat',
                session: null
            })
        }

        server.io.to('superuser').emit('chat-session-finished'); // schedule update
        server.io.to(sessionEnded.id_user_socket).emit('chat-session-finished');

        return res.status(200).json({
            ok: true,
            msg: 'Sesión de chat finalizada correctamente',
            session: sessionEnded
        })

    })
}

async function readChatsRequests(req: Request, res: Response) {

    const chatsRequests: ChatSession[] = await ChatSession.find({ tm_end: null }).populate('id_user');

    if (!chatsRequests) {
        return res.status(400).json({
            ok: false,
            msg: 'No se obtuvieron sesiones de chat',
            sessions: null
        })
    }

    return res.status(200).json({
        ok: true,
        msg: 'Se obtuvieron sesiones de chat correctamente',
        sessions: chatsRequests
    })

}

async function readChatsNotInit(req: Request, res: Response) {

    const chatsNotInit: ChatSession[] = await ChatSession.find({ tm_init: null, tm_end: {$ne: null}}).populate('id_user');

    if (!chatsNotInit) {
        return res.status(400).json({
            ok: false,
            msg: 'No se obtuvieron sesiones de chat finalizadas y no inicializadas',
            sessions: null
        })
    }

    return res.status(200).json({
        ok: true,
        msg: 'Se obtuvieron sesiones de chat que no fueron inicializadas correctamente',
        sessions: chatsNotInit
    })

}

function actualizarSocket(req: Request, res: Response) {

    const idSession = req.body.idSession;
    const txSocket = req.body.txSocket;
    const blClient = req.body.blClient;

    ChatSession.findById(idSession).then(sessionDB => {

        if (!sessionDB) {
            return res.status(400).json({
                ok: false,
                msg: 'No se pudo obtener la sesión de chat para actualizar el socket',
                session: null
            })
        }

        if (blClient) {
            sessionDB.id_user_socket = txSocket;
        } else {
            sessionDB.id_assistant_socket = txSocket;
        }

        sessionDB.save().then(sessionSaved => {

            server.io.to('superuser').emit('update-clients-list'); // clients update

            return res.status(200).json({
                ok: true,
                msg: 'Se guardo la sesión de chat con el socket actualizado correctamente',
                session: sessionSaved
            })

        }).catch(() => {

            return res.status(400).json({
                ok: false,
                msg: 'No se pudo guardar la sesión de chat con el socket actualizado',
                session: null
            })

        })
    })

}

export = {
    chatRequest,
    submitSubject,
    initializeSession,
    endSession,
    readChatsRequests,
    readChatsNotInit,
    actualizarSocket
}
