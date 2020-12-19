import { Request, Response } from 'express';
import { Company } from '../models/company.model';

import fileSystem from './filesystem.controller';
import fs from 'fs';
import ftp from 'basic-ftp';

import environment from '../global/environment';
import { User } from '../models/user.model';


// ========================================================
// Upload Methods
// ========================================================

// front -> [HTTP] -> heroku -> [FTP] -> hostinger
async function uploadImagen(req: any, res: Response) {

    var idField = req.params.idField;
    var idDocument = req.params.idDocument;
    var idFieldsValid = ["tx_company_banners", "tx_company_logo", "tx_img"];

    if (!idFieldsValid.includes(idField)) {
        return res.status(400).json({
            ok: false,
            msg: "Error, tipo de imagen no valida.",
            company: null
        });
    }

    if (!req.files) {
        return res.status(500).json({
            ok: false,
            msg: "Error no hay archivos para subir.",
            company: null
        });
    }

    if (!req.files.imagen?.size || req.files.imagen?.size > 102400) {
        return res.status(400).json({
            ok: false,
            msg: 'El archivo no debe superar los 100k (102400b)',
            company: null
        })
    }

    // Obtener nombre del archivo
    var archivo = req.files.imagen; //'imagen' es el nombre dado en body>form-data en POSTMAN
    var archivoPartes = archivo.name.split(".");
    var archivoExtension = archivoPartes[archivoPartes.length - 1];

    // extensiones permitidas
    var extensionesValidas = ["png", "jpg", "gif", "jpeg"];

    if (!extensionesValidas.includes(archivoExtension)) {
        return res.status(400).json({
            // ERROR DE BASE DE DATOS
            ok: false,
            msg: "Error, extension de archivo no valida.",
            company: null
        });
    }

    var archivoNombre = `${+ new Date()}.${archivoExtension}`;

    let response: any = await grabarImagenBD(idField, idDocument, archivoNombre, res);

    if (!response.ok) {
        return res.status(400).json(response)
    }

    // si no existe la carpeta la crea
    var pathdir = `./uploads/${idDocument}/${idField}`;
    fileSystem.createFolder(pathdir);
    let pathfile = `${pathdir}/${archivoNombre}`;

    await archivo.mv(pathfile, (err: any) => {
        if (err) {
            return res.status(500).json({
                ok: false,
                msg: "Error, no se pudo mover el archivo.",
                company: null
            });
        }
    });

    // Elimino cualquier archivo en la carpeta que no esta registrado en la BD
    // let banners = response.company.tx_company_banners;
    // fileSystem.syncFolder(pathdir, banners);

    return res.status(200).json(response);

    // ================================================================
    // SYNC HOSTINGER FTP: envío las imagenes hacia hostinger por FTP
    // ================================================================
    // syncHostinger(pathdir).then().catch();

}

function deleteImagen(req: Request, res: Response) {
    var idField = req.params.idField;
    var idDocument = req.params.idDocument;
    // Puede tomar el nombre del archivo o "TODAS" para elimnar todas las imagenes del aviso
    var filename = req.params.filename;

    if (['tx_company_banners', 'tx_company_logo'].includes(idField)) {
        Company.findById(idDocument).then(companyDB => {

            if (!companyDB) {
                return res.status(400).json({
                    ok: false,
                    msg: "No existe el comercio para la imagen que desea eliminar",
                    company: null
                });
            }

            var dirPath = `./uploads/${idDocument}/${idField}`;


            if (idField === 'tx_company_banners') {
                if (filename === 'todas') {
                    companyDB.tx_company_banners = [];
                } else {
                    companyDB.tx_company_banners = companyDB.tx_company_banners.filter(archivo => archivo != filename);
                }
                fileSystem.syncFolder(dirPath, companyDB.tx_company_banners);
            }

            if (idField === 'tx_company_logo') {
                companyDB.tx_company_logo = null;
                fileSystem.syncFolder(dirPath, []);
            }


            // ===================================================
            // SINCRONIZO STORAGE EN HOSTINGER
            // ===================================================
            // Si mi ambiente de producción es Heroku tengo que sincronizar mi storage en Hostinger
            // syncHostinger(dirPath).then(() =>).catch(err =>);
            companyDB.save().then(companySaved => {
                if (companySaved)
                    return res.status(200).json({
                        ok: true,
                        msg: "Se elimino de la BD la imagen: " + filename,
                        company: companySaved,
                        filename: filename
                    });
            });
        });
    }

    if (['tx_img'].includes(idField)) {
        User.findByIdAndUpdate(idDocument, { tx_img: filename }).then(userDB => {

            if (!userDB) {
                return res.status(400).json({
                    ok: false,
                    msg: "No existe el usuario para la imagen que desea eliminar",
                    user: null
                });
            }

            var dirPath = `./uploads/${idDocument}/${idField}`;


            if (idField === 'tx_img') {
                userDB.tx_img = null;
                fileSystem.syncFolder(dirPath, []);
            }

            // ===================================================
            // SINCRONIZO STORAGE EN HOSTINGER
            // ===================================================
            // Si mi ambiente de producción es Heroku tengo que sincronizar mi storage en Hostinger
            // syncHostinger(dirPath).then(() => ).catch(err => );
            userDB.save().then(userSaved => {
                if (userSaved)
                    return res.status(200).json({
                        ok: true,
                        msg: "Se elimino de la BD la imagen: " + filename,
                        user: userSaved,
                        filename: filename
                    });
            });
        })
    }

}

function grabarImagenBD(idField: string, idDocument: string, archivoNombre: string, res: Response) {

    return new Promise((resolve) => {

        // Company collection
        if (['tx_company_banners', 'tx_company_logo'].includes(idField)) {
            Company.findById(idDocument).then(companyDB => {

                if (!companyDB) {
                    return resolve({
                        ok: false,
                        msg: "El comercio no existe",
                        company: null
                    });
                }


                if (idField === 'tx_company_banners') {
                    let imagenesPermitidas = 12;
                    if (companyDB.tx_company_banners.length >= imagenesPermitidas) {
                        return resolve({
                            ok: false,
                            msg: `Supera el máximo de ${imagenesPermitidas} imagenes permitidas`,
                            company: null
                        });
                    }
                    companyDB.tx_company_banners.push(archivoNombre);
                }

                if (idField === 'tx_company_logo') {
                    companyDB.tx_company_logo = archivoNombre;
                }

                companyDB.save().then(companySaved => {
                    if (!companySaved) {
                        return resolve({
                            // ERROR DE BASE DE DATOS
                            ok: false,
                            msg: "No se pudo guardar la imagen",
                            company: null
                        });
                    }
                    return resolve({
                        ok: true,
                        msg: "Imagen guardada correctamente",
                        company: companySaved,
                        filename: archivoNombre
                    });
                });
            });

        }

        // User collection
        if (['tx_img'].includes(idField)) {
            User.findById(idDocument).then(UserDB => {

                if (!UserDB) {
                    return resolve({
                        ok: false,
                        msg: "El comercio no existe",
                        company: null
                    });
                }

                UserDB.tx_img = archivoNombre;

                UserDB.save().then(userSaved => {
                    if (!userSaved) {
                        return resolve({
                            // ERROR DE BASE DE DATOS
                            ok: false,
                            msg: "No se pudo guardar la imagen",
                            user: null
                        });
                    }
                    return resolve({
                        ok: true,
                        msg: "Imagen guardada correctamente",
                        user: userSaved,
                        filename: archivoNombre
                    });
                });
            });
        }
    })
}

async function syncHostinger(pathdir: string) {

    const client = new ftp.Client();
    client.ftp.verbose = false;

    try {
        await client.access({
            host: environment.FTP_HOST,
            user: environment.FTP_USER,
            password: environment.FTP_PASS,
            secure: false
        });

        await client.ensureDir(pathdir);
        await client.clearWorkingDir();
        await client.uploadFromDir(pathdir);
    }
    catch (err) {
    }
    client.close();

}

export = {
    uploadImagen,
    deleteImagen
}