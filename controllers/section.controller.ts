import { Request, Response } from 'express';
import { Section } from '../models/section.model';
import { sectionSession } from '../models/section.session.model';
import { Company } from '../models/company.model';

// ========================================================
// Section Methods
// ========================================================

function createSection(req: Request, res: Response) {

    var body = req.body;

    var section = new Section({
        id_company: body.id_company,
        tx_section: body.tx_section
    });

    section.save().then((sectionSaved) => {
        res.status(200).json({
            ok: true,
            msg: 'Sector guardado correctamente',
            section: sectionSaved
        })
    }).catch((err) => {
        res.status(400).json({
            ok: false,
            msg: err.message,
            section: null
        })
    })
}

function readSections(req: Request, res: Response) {
    let idCompany = req.params.idCompany;

    Section.find({ id_company: idCompany })
        .populate({
            path: 'id_session',
            populate: { path: 'id_waiter' }
        })

        .then(sectionsDB => {
            if (!sectionsDB) {
                return res.status(200).json({
                    ok: false,
                    msg: 'No existen sectores para la empresa seleccionada',
                    sections: []
                })
            }
            return res.status(200).json({
                ok: true,
                msg: 'Sectores obtenidos correctamente',
                sections: sectionsDB
            })
        }).catch(() => {
            return res.status(500).json({
                ok: false,
                msg: 'Error al consultar los sectores para las empresa solicitada',
                sections: null
            })

        })
}

function readSessions(req: Request, res: Response) {
    let idCompany = req.params.idCompany;

    Section.find({ id_company: idCompany })
        .then(sectionsDB => {
            return sectionsDB.map(section => section._id);
        }).then(resp => {

            sectionSession.find({ id_section: { $in: resp }, tm_end: null }).populate('id_section').then(sessionsDB => {

                if (!resp) {
                    return res.status(200).json({
                        ok: false,
                        msg: 'No existen sesiones para la empresa seleccionada',
                        sessions: []
                    })
                }

                return res.status(200).json({
                    ok: true,
                    msg: 'Sesiones obtenidas correctamente',
                    sessions: sessionsDB
                })

            }).catch(() => {
                return res.status(500).json({
                    ok: false,
                    msg: 'Error al consultar las sesiones para las empresa solicitada',
                    sessions: null
                })

            })
        })
}

function deleteSection(req: Request, res: Response) {
    let idSection = req.params.idSection;
    Section.findByIdAndDelete(idSection).then((sectionDeleted) => {
        res.status(200).json({
            ok: true,
            msg: 'Sector eliminado correctamente',
            section: sectionDeleted
        })
    }).catch(() => {
        res.status(400).json({
            ok: false,
            msg: 'Error al eliminar el sector',
            section: null
        })
    })
}

function takeSection(req: Request, res: Response) {

    let idSection = req.body.idSection;
    let idWaiter = req.body.idWaiter;

    sectionSession.findOne({ id_section: idSection, id_waiter: idWaiter, tm_end: null }).then(activeSession => {
        console.log(activeSession)
        if (activeSession) {
            return res.status(400).json({
                ok: false,
                msg: 'Usted ya tiene una sesión activa!',
                session: activeSession
            });
        }

        var session = new sectionSession({
            id_section: idSection,
            id_waiter: idWaiter,
            tm_start: + new Date().getTime(),
            tm_end: null
        });

        session.save().then(sessionSaved => {
            return res.status(200).json({
                ok: true,
                msg: 'Se creo la sesión de camarero correctamente',
                session: sessionSaved
            });
        }).catch(() => {
            return res.status(500).json({
                ok: false,
                msg: 'Error al guardar la sesion del camarero',
                session: null
            });
        });
    })

}

function releaseSection(req: Request, res: Response) {
    let idSection = req.body.idSection;
    let idWaiter = req.body.idWaiter;

    sectionSession.findOne({ id_section: idSection, id_waiter: idWaiter, tm_end: null }).then(sessionToClose => {
        if (!sessionToClose) {
            return res.status(400).json({
                ok: false,
                msg: 'No existe la sesión que desea cerrar',
                session: null
            })
        }
        sessionToClose.tm_end = + new Date().getTime();
        sessionToClose.save().then((sessionSaved) => {
            return res.status(200).json({
                ok: true,
                msg: 'Sesión cerrada correctamente',
                session: sessionSaved
            })
        })
    })
}

export = {
    createSection,
    readSections,
    readSessions,
    deleteSection,
    takeSection,
    releaseSection
}
