import { Request, Response } from 'express';
import { User } from '../models/user.model';
import bcrypt from 'bcrypt';
import { Company } from '../models/company.model';
import { sectionSession } from '../models/section.session.model';

// ========================================================
// Waiter && Session Methods
// ========================================================

// crud

function createWaiter(req: Request, res: Response) {

    var body = req.body;
    var waiter = new User({
        tx_name: body.tx_name,
        tx_email: body.tx_email,
        tx_password: bcrypt.hashSync(body.tx_password, 10),
        id_company: body.id_company,
        id_role: 'WAITER_ROLE',
        fc_createdat: new Date()
    });

    waiter.save().then((waiterSaved: any) => {
        res.status(200).json({
            ok: true,
            msg: 'Usuario guardado correctamente',
            user: waiterSaved
        })
    }).catch((err) => {
        res.status(400).json({
            ok: false,
            msg: err,
            user: null
        });
    });
}

function readWaiters(req: Request, res: Response) {
    let idCompany = req.params.idCompany;

    User.find({ id_company: idCompany })
        .populate('id_company').then(usersDB => {
            if (!usersDB) {
                return res.status(400).json({
                    ok: false,
                    msg: 'No existen asistentes para la empresa seleccionada',
                    users: null
                })
            }
            return res.status(200).json({
                ok: true,
                msg: 'Asistentes obtenidos correctamente',
                users: usersDB
            })
        }).catch(() => {
            return res.status(500).json({
                ok: false,
                msg: 'Error al consultar los asistentes para las empresas del user',
                users: null
            })
        })


}

function updateWaiter(req: Request, res: Response) {

    var body = req.body;

    let user: any = {
        id_role: body.id_role,
        id_company: body.id_company,
        tx_name: body.tx_name,
        tx_email: body.tx_email,
    }

    if (body.tx_password !== '******') { user.tx_password = bcrypt.hashSync(body.tx_password, 10); }

    User.findByIdAndUpdate(body._id, user, { new: true })
        .populate('id_company')
        .then(userDB => {
            return res.status(200).json({
                ok: true,
                msg: 'Se actualizo el asistente correctamente',
                user: userDB
            })
        }).catch(() => {
            return res.status(400).json({
                ok: false,
                msg: 'Ocurrio un error al actualizar el asistente',
                user: null
            })
        })
}

function deleteWaiter(req: Request, res: Response) {
    let idWaiter = req.params.idWaiter;
    User.findByIdAndDelete(idWaiter).then((waiterDeleted) => {
        res.status(200).json({
            ok: true,
            msg: 'Usuario eliminado correctamente',
            user: waiterDeleted
        })
    }).catch(() => {
        res.status(400).json({
            ok: false,
            msg: 'Error al eliminar al asistente',
            user: null
        })
    })
}

// auxiliar

function readWaitersUser(req: Request, res: Response) {
    // obtiene todos los asistentes de todas las empresas de un usuario

    let idUser = req.params.idUser;
    Company.find({ id_user: idUser }).then(companiesDB => {
        return companiesDB.map(data => data._id) // solo quiero los _id
    }).then(resp => {
        User
            .find({ $or: [{ '_id': idUser }, { id_company: { $in: resp } }] })
            .populate('id_company').then(usersDB => {
                if (!usersDB) {
                    return res.status(400).json({
                        ok: false,
                        msg: 'No existen asistentes para la empresa seleccionada',
                        users: null
                    })
                }
                return res.status(200).json({
                    ok: true,
                    msg: 'Asistentes obtenidos correctamente',
                    users: usersDB
                })
            }).catch(() => {
                return res.status(500).json({
                    ok: false,
                    msg: 'Error al consultar los asistentes para las empresas del user',
                    users: null
                })
            }).catch(() => {
                return res.status(500).json({
                    ok: false,
                    msg: 'Error al consultar las empresas del user',
                    users: null
                })
            })
    })

}


export = {
    createWaiter,
    readWaiters,
    readWaitersUser,
    updateWaiter,
    deleteWaiter,
}
