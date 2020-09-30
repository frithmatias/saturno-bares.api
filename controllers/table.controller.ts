import { Request, Response } from 'express';
import { Table } from '../models/table.model';
import { Session } from '../models/session.model';
import { Company } from '../models/company.model';
import { Section } from '../models/section.model';

// ========================================================
// Table Methods
// ========================================================

function createTable(req: Request, res: Response) {

    var { id_section, nm_table, nm_persons } = req.body;
    console.log(req.body)
    var table = new Table({
        id_section,
        nm_table,
        nm_persons
    });
    console.log(table)

    table.save().then((tableSaved) => {
        res.status(200).json({
            ok: true,
            msg: 'Mesa guardada correctamente',
            table: tableSaved
        })
    }).catch((err) => {
        res.status(400).json({
            ok: false,
            msg: err.message,
            table: null
        })
    })
}

function readTablesUser(req: Request, res: Response) {
    let idUser = req.params.idUser;

    Company.find({ id_user: idUser }).then(companiesDB => {
        return companiesDB.map(company => company._id)
    }).then(resp => {
        Table.find({ id_company: { $in: resp } }).populate('id_company').then(tablesDB => {
            if (!tablesDB) {
                return res.status(400).json({
                    ok: false,
                    msg: 'No existen escritorios para la empresa seleccionada',
                    tables: null
                })
            }
            return res.status(200).json({
                ok: true,
                msg: 'Mesas obtenidos correctamente',
                tables: tablesDB
            })
        }).catch(() => {
            return res.status(500).json({
                ok: false,
                msg: 'Error al consultar los escritorios para las empresas del user',
                tables: null
            })
        }).catch(() => {
            return res.status(500).json({
                ok: false,
                msg: 'Error al consultar las empresas del user',
                tables: null
            })
        })
    })
}

function readTables(req: Request, res: Response) {
    let idCompany = req.params.idCompany;

    Section.find({ id_company: idCompany }).then(sectionsDB => {

        if (!sectionsDB || sectionsDB.length === 0) {
            return res.status(400).json({
                ok: false,
                msg: 'No existen sectores para la empresa solicitada',
                tables: null
            })
        }

        // sections of company
        let idSections = sectionsDB.map(section => section._id)

        Table.find({ id_section: { $in: idSections } })
            .populate({
                path: 'id_session',
                populate: { path: 'id_waiter' }
            })
            .then(tablesDB => {
                if (!tablesDB) {
                    return res.status(400).json({
                        ok: false,
                        msg: 'No existen escritorios para la empresa seleccionada',
                        tables: null
                    })
                }
                return res.status(200).json({
                    ok: true,
                    msg: 'Mesas obtenidas correctamente',
                    tables: tablesDB
                })
            }).catch(() => {
                return res.status(500).json({
                    ok: false,
                    msg: 'Error al consultar las mesas para los sectores de la empresa.',
                    tables: null
                })

            })
    }).catch(() => {
        return res.status(500).json({
            ok: false,
            msg: 'Error al consultar los sectores para la empresa solicitada.',
            tables: null
        })

    })
}

function readSectionTables(req: Request, res: Response) {
    let idSection = req.params.idSection;
    console.log(idSection)
    Section.findById(idSection).then(sectionDB => {

        if (!sectionDB) {
            return res.status(400).json({
                ok: false,
                msg: 'No existe el sector solicitado',
                tables: null
            })
        }

        Table.find({ id_section: sectionDB._id })
            .populate({
                path: 'id_session',
                populate: { path: 'id_waiter id_section' }
            })
            .then(tablesDB => {
                if (!tablesDB) {
                    return res.status(400).json({
                        ok: false,
                        msg: 'No existen escritorios para la empresa seleccionada',
                        tables: null
                    })
                }
                return res.status(200).json({
                    ok: true,
                    msg: 'Mesas obtenidas correctamente',
                    tables: tablesDB
                })
            }).catch(() => {
                return res.status(500).json({
                    ok: false,
                    msg: 'Error al consultar las mesas para los sectores de la empresa.',
                    tables: null
                })

            })
    }).catch(() => {
        return res.status(500).json({
            ok: false,
            msg: 'Error al consultar los sectores para la empresa solicitada.',
            tables: null
        })

    })
}

function deleteTable(req: Request, res: Response) {
    let idTable = req.params.idTable;
    Table.findByIdAndDelete(idTable).then((tableDeleted) => {
        res.status(200).json({
            ok: true,
            msg: 'Mesa eliminada correctamente',
            table: tableDeleted
        })
    }).catch(() => {
        res.status(400).json({
            ok: false,
            msg: 'Error al eliminar el escritorio',
            table: null
        })
    })
}


export = {
    createTable,
    readTablesUser,
    readTables,
    readSectionTables,
    deleteTable
}
