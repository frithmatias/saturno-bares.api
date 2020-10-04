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
        tx_section: body.tx_section,
        id_session: null
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

function readSectionsUser(req: Request, res: Response) {
    let idUser = req.params.idUser;

    Company.find({ id_user: idUser }).then(companiesDB => {
        return companiesDB.map(company => company._id)
    }).then(resp => {
        Section.find({ id_company: { $in: resp } }).populate('id_company').then(sectionsDB => {
            if (!sectionsDB) {
                return res.status(400).json({
                    ok: false,
                    msg: 'No existen escritorios para la empresa seleccionada',
                    sections: null
                })
            }
            return res.status(200).json({
                ok: true,
                msg: 'Escritorios obtenidos correctamente',
                sections: sectionsDB
            })
        }).catch(() => {
            return res.status(500).json({
                ok: false,
                msg: 'Error al consultar los escritorios para las empresas del user',
                sections: null
            })
        }).catch(() => {
            return res.status(500).json({
                ok: false,
                msg: 'Error al consultar las empresas del user',
                sections: null
            })
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
                return res.status(400).json({
                    ok: false,
                    msg: 'No existen sectores para la empresa seleccionada',
                    sections: null
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

function deleteSection(req: Request, res: Response) {
    let idSection = req.params.idSection;
    Section.findByIdAndDelete(idSection).then((sectionDeleted) => {
        res.status(200).json({
            ok: true,
            msg: 'Escritorio eliminado correctamente',
            section: sectionDeleted
        })
    }).catch(() => {
        res.status(400).json({
            ok: false,
            msg: 'Error al eliminar el escritorio',
            section: null
        })
    })
}

function takeSection(req: Request, res: Response) {

    let idSection = req.body.idSection;
    let idWaiter = req.body.idWaiter;
    // actualizo el estado del escritorio
    var session = new sectionSession({
        id_section: idSection,
        id_waiter: idWaiter,
        tm_start: + new Date().getTime(),
        tm_end: null
    });

    session.save().then(sessionSaved => {

        // actualizo el escritorio
        Section.findByIdAndUpdate(idSection, { id_session: sessionSaved._id }, { new: true })
            .populate({
                path: 'id_session',
                populate: { path: 'id_waiter id_section' }
            })
            .then(sectionTaked => {

                return res.status(200).json({
                    ok: true,
                    msg: 'Se asigno el asistente al escritorio',
                    section: sectionTaked
                });

            }).catch(() => {
                return res.status(500).json({
                    ok: false,
                    msg: 'Error al registrar la sesión en el escritorio',
                    section: null
                });
            })


    }).catch(() => {
        return res.status(500).json({
            ok: false,
            msg: 'Error al guardar la sesion del escritorio',
            table: null
        });
    });




}

function releaseSection(req: Request, res: Response) {

    let idSection = req.body.idSection;

    Section.findByIdAndUpdate(idSection, { id_session: null }).then(tableUpdated => {

        if (!tableUpdated) {
            return res.status(400).json({
                ok: false,
                msg: 'No existe el escritorio que se desea finalizar',
                table: null
            })
        }

        sectionSession.findByIdAndUpdate(tableUpdated.id_session,
            { tm_end: + new Date().getTime() }).then(tableReleased => {

                return res.status(200).json({
                    ok: true,
                    msg: 'Esctirorio finalizado correctamente',
                    table: tableReleased
                })

            }).catch(() => {
                return res.status(400).json({
                    ok: true,
                    msg: 'Error al guardar la sesion del escritorio',
                    table: null
                })
            })


    }).catch(() => {
        return res.status(500).json({
            ok: false,
            msg: 'Error al buscar el escritorio a finalizar',
            table: null
        })
    })


}

export = {
    createSection,
    readSectionsUser,
    readSections,
    deleteSection,
    takeSection,
    releaseSection
}
