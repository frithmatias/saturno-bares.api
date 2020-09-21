import { Request, Response } from 'express';
import { Desktop } from '../models/desktop.model';
import { Session } from '../models/session.model';
import { Company } from '../models/company.model';

// ========================================================
// Desktop Methods
// ========================================================

function createDesktop(req: Request, res: Response) {

    var body = req.body;



    // if has a default desktop then remove it
    Desktop.findOneAndDelete({ id_company: body.id_company, bl_generic: true }).catch(() => {
        return res.status(400).json({
            ok: true,
            msg: 'Error al eliminar el escritorio genérico',
            skill: null
        })
    })

    var desktop = new Desktop({
        id_company: body.id_company,
        cd_desktop: body.cd_desktop,
        id_session: null
    });

    desktop.save().then((desktopSaved) => {
        res.status(200).json({
            ok: true,
            msg: 'Escritorio guardado correctamente',
            desktop: desktopSaved
        })
    }).catch((err) => {
        res.status(400).json({
            ok: false,
            msg: err.message,
            desktop: null
        })
    })
}

function readDesktopsUser(req: Request, res: Response) {
    let idUser = req.params.idUser;

    Company.find({ id_user: idUser }).then(companiesDB => {
        return companiesDB.map(company => company._id)
    }).then(resp => {
        Desktop.find({ id_company: { $in: resp } }).populate('id_company').then(desktopsDB => {
            if (!desktopsDB) {
                return res.status(400).json({
                    ok: false,
                    msg: 'No existen escritorios para la empresa seleccionada',
                    desktops: null
                })
            }
            return res.status(200).json({
                ok: true,
                msg: 'Escritorios obtenidos correctamente',
                desktops: desktopsDB
            })
        }).catch(() => {
            return res.status(500).json({
                ok: false,
                msg: 'Error al consultar los escritorios para las empresas del user',
                desktops: null
            })
        }).catch(() => {
            return res.status(500).json({
                ok: false,
                msg: 'Error al consultar las empresas del user',
                desktops: null
            })
        })
    })
}

function readDesktops(req: Request, res: Response) {
    let idCompany = req.params.idCompany;

    Desktop.find({ id_company: idCompany })
        .populate({
            path: 'id_session',
            populate: { path: 'id_assistant' }
        })

        .then(desktopsDB => {
            if (!desktopsDB) {
                return res.status(400).json({
                    ok: false,
                    msg: 'No existen escritorios para la empresa seleccionada',
                    desktops: null
                })
            }
            return res.status(200).json({
                ok: true,
                msg: 'Escritorios obtenidos correctamente',
                desktops: desktopsDB
            })
        }).catch(() => {
            return res.status(500).json({
                ok: false,
                msg: 'Error al consultar los escritorios para las empresas del user',
                desktops: null
            })

        })
}

function deleteDesktop(req: Request, res: Response) {
    let idDesktop = req.params.idDesktop;
    Desktop.findById(idDesktop).then(desktopDB => {
        Desktop.find({ id_company: desktopDB?.id_company }).then(desktopsDB => {

            // si queda un solo escritorio, antes de borrarlo creo un genérico.
            let generics = desktopsDB.filter(desktop => desktop.bl_generic === true).length;
            let customs = desktopsDB.filter(desktop => desktop.bl_generic === false).length;
            if (customs === 1 && generics === 0) { // antes de borrar el último creo el genérico
                const desktop = new Desktop();
                desktop.id_company = desktopDB?.id_company;
                desktop.cd_desktop = '1';
                desktop.id_session = null;
                desktop.bl_generic = true;
                desktop.save().catch(() => {
                    return res.status(400).json({
                        ok: false,
                        msg: 'No se elimino el ultimo escritorio porque no se pudo crear el genérico.',
                        skill: null
                    })
                })
            }

            Desktop.findByIdAndDelete(idDesktop).then((desktopDeleted) => {
                res.status(200).json({
                    ok: true,
                    msg: 'Escritorio eliminado correctamente',
                    desktop: desktopDeleted
                })
            }).catch(() => {
                res.status(400).json({
                    ok: false,
                    msg: 'Error al eliminar el escritorio',
                    desktop: null
                })
            })




        });
    });



}

function takeDesktop(req: Request, res: Response) {

    let idDesktop = req.body.idDesktop;
    let idAssistant = req.body.idAssistant;

    // actualizo el estado del escritorio
    var session = new Session({
        id_desktop: idDesktop,
        id_assistant: idAssistant,
        fc_start: + new Date().getTime(),
        fc_end: null
    });

    session.save().then(sessionSaved => {

        // actualizo el escritorio
        Desktop.findByIdAndUpdate(idDesktop, { id_session: sessionSaved._id }, { new: true })
            .populate({
                path: 'id_session',
                populate: { path: 'id_assistant id_desktop' }
            })
            .then(desktopTaked => {

                return res.status(200).json({
                    ok: true,
                    msg: 'Se asigno el asistente al escritorio',
                    desktop: desktopTaked
                });

            }).catch(() => {
                return res.status(500).json({
                    ok: false,
                    msg: 'Error al registrar la sesión en el escritorio',
                    desktop: null
                });
            })


    }).catch(() => {
        return res.status(500).json({
            ok: false,
            msg: 'Error al guardar la sesion del escritorio',
            desktop: null
        });
    });




}

function releaseDesktop(req: Request, res: Response) {

    let idDesktop = req.body.idDesktop;

    Desktop.findByIdAndUpdate(idDesktop, { id_session: null }).then(desktopUpdated => {

        if (!desktopUpdated) {
            return res.status(400).json({
                ok: false,
                msg: 'No existe el escritorio que se desea finalizar',
                desktop: null
            })
        }

        Session.findByIdAndUpdate(desktopUpdated.id_session,
            { fc_end: + new Date().getTime() }).then(desktopReleased => {

                return res.status(200).json({
                    ok: true,
                    msg: 'Esctirorio finalizado correctamente',
                    desktop: desktopReleased
                })

            }).catch(() => {
                return res.status(400).json({
                    ok: true,
                    msg: 'Error al guardar la sesion del escritorio',
                    desktop: null
                })
            })


    }).catch(() => {
        return res.status(500).json({
            ok: false,
            msg: 'Error al buscar el escritorio a finalizar',
            desktop: null
        })
    })


}

export = {
    createDesktop,
    readDesktopsUser,
    readDesktops,
    deleteDesktop,
    takeDesktop,
    releaseDesktop
}
