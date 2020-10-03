import { Request, Response } from 'express';
import { Table } from '../models/table.model';
import { Section } from '../models/section.model';

// ========================================================
// Table Methods
// ========================================================

let createTable = (req: Request, res: Response) => {

    var { id_section, nm_table, nm_persons } = req.body;
    var table = new Table({
        id_section,
        nm_table,
        nm_persons,
        bl_status: false,
        tx_satus: 'paused',
        id_session: null
    });
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

let readTables = (req: Request, res: Response) => {
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

let readSectionTables = (req: Request, res: Response) => {
    let idSection = req.params.idSection;
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

let toggleTableStatus = (req: Request, res: Response) => {
    let idTable = req.params.idTable;


    Table.findById(idTable).then(tableDB => {
        
        if(!tableDB){
            res.status(400).json({
                ok: false,
                msg: 'No existe la mesa',
                table: null
            })
        } else {
            tableDB.tx_status = tableDB?.tx_status==='idle' ? 'paused' : 'idle';
            tableDB.save().then(statusSaved => {
                res.status(200).json({
                    ok: true,
                    msg: 'El nuevo estado de mesa fue guardado',
                    table: statusSaved
                })
            }).catch(() => {
                res.status(500).json({
                    ok: false, 
                    msg: 'No se pudo guardar el nuevo estado de mesa',
                    table: null
                })
            })
        }

        
    })
}

let deleteTable = (req: Request, res: Response) => {
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
    readTables,
    readSectionTables,
    toggleTableStatus,
    deleteTable
}
