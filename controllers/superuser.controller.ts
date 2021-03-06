import { Request, Response } from 'express';
import { Company } from '../models/company.model';
import { Menu } from '../models/menu.model';
import environment from '../global/environment.prod';

// ========================================================
// Superuser Methods
// ========================================================

const SUPERUSERS: string[] = environment.SUPERUSERS;

function checkSuper(req: any, res: Response) {
    return res.status(200).send(SUPERUSERS.includes(req.usuario.tx_email) ? true : false);
}

function createMenu(req: Request, res: Response) {

    var body = req.body;

    var menu = new Menu({
        id_parent: body.id_parent,
        cd_pricing: body.cd_pricing,
        cd_role: body.cd_role,
        tx_titulo: body.tx_titulo,
        tx_icon: body.tx_icon,
        tx_url: body.tx_url,
    });
    menu.save().then((menuSaved: any) => {
        res.status(200).json({
            ok: true,
            msg: 'Menu guardado correctamente',
            menuitem: menuSaved
        })
    }).catch((err) => {
        res.status(400).json({
            ok: false,
            msg: 'Error al guardar el menú',
            menuitem: null
        });
    });
}

function readMenu(req: Request, res: Response) {
    Menu.find({}).then(menuDB => {
        if (!menuDB) {
            return res.status(200).json({
                ok: false,
                msg: 'No existen items de menu en la base de datos!',
                menuitem: []
            })
        }
        return res.status(200).json({
            ok: true,
            msg: 'Menu obtenido correctamente',
            menuitem: menuDB
        })
    }).catch(() => {
        return res.status(500).json({
            ok: false,
            msg: 'Error al consultar el menu',
            menuitem: null
        })
    })
}

function updateMenu(req: Request, res: Response) {

    var body = req.body;
    let menu: any = {
        id_parent: body.id_parent,
        cd_pricing: body.cd_pricing,
        cd_role: body.cd_role,
        tx_titulo: body.tx_titulo,
        tx_icon: body.tx_icon,
        tx_url: body.tx_url
    }

    Menu.findByIdAndUpdate(body._id, menu, { new: true })
        .then(menuDB => {
            if (!menuDB) {
                return res.status(500).json({
                    ok: false,
                    msg: 'Ocurrio un error al actualizar el menu',
                    menuitem: null
                })
            }
            return res.status(200).json({
                ok: true,
                msg: 'Se actualizo el menu correctamente',
                menuitem: menuDB
            })
        }).catch(() => {
            return res.status(400).json({
                ok: false,
                msg: 'Ocurrio un error al actualizar el menu',
                menuitem: null
            })
        })
}

function deleteMenu(req: Request, res: Response) {
    let idMenu = req.params.idMenu;

    Menu.findByIdAndDelete(idMenu).then((menuDeleted) => {
        res.status(200).json({
            ok: true,
            msg: 'Item del Menu eliminado correctamente',
            menuitem: menuDeleted
        })
    }).catch(() => {
        res.status(400).json({
            ok: false,
            msg: 'Error al eliminar el item del Menu',
            menuitem: null
        })
    })
}

function readAllCompanies(req: Request, res: Response) {

    Company.find({}).populate('id_user').then(allCompaniesDB => {

        if (!allCompaniesDB) {
            return res.status(400).json({
                ok: false,
                msg: 'No se pudieron obtener los comercios',
                companies: null
            })
        }

        return res.status(200).json({
            ok: true,
            msg: 'Comercios obtenidos correctamente',
            companies: allCompaniesDB
        })

    })

}

export = {
    checkSuper,
    createMenu,
    readMenu,
    updateMenu,
    deleteMenu,
    readAllCompanies
}
