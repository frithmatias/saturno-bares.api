import { Request, Response } from 'express';
import { Company } from '../models/company.model';

import fileSystem from './filesystem.controller';
import fs from 'fs';
const ftp = require("basic-ftp")

import environment from '../global/environment';
import { User } from '../models/user.model';


// ========================================================
// Upload Methods
// ========================================================

// front -> [HTTP] -> heroku -> [FTP] -> hostinger
async function uploadImagen(req: any, res: Response) {

    // ==============================================================
    // START FILE VERIFICATIONS
    // ==============================================================

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

    var fileName = `${+ new Date()}.${archivoExtension}`;

    // ==============================================================
    // SAVE FILE IN FILESYSTEM
    // ==============================================================

    var dirPath = `./uploads/${idDocument}/${idField}`;
    fileSystem.createFolder(dirPath);
    let filePath = `${dirPath}/${fileName}`;
    await archivo.mv(filePath, (err: any) => {
        if (err) {
            return res.status(500).json({
                ok: false,
                msg: "Error, no se pudo guardar el archivo.",
                company: null
            });
        }
    });

    // ==============================================================
    // SYNC HOSTINGER FTP: envío las imagenes hacia hostinger por FTP
    // ==============================================================
    await syncHostinger(dirPath)
        .then(() => {
            // ==============================================================
            // SAVE IMAGE IN DB
            // ==============================================================
            grabarImagenBD(idField, idDocument, fileName, res).then((resp: any) => {
                if (!resp.ok) {
                    if (fs.existsSync(filePath)) { fs.unlinkSync(filePath); }
                    return res.status(400).json(resp)
                }
                return res.status(200).json(resp);
            }).catch((resp) => {
                if (fs.existsSync(filePath)) { fs.unlinkSync(filePath); }
                return res.status(400).json(resp)
            })
        }).catch((err) => {
            if (fs.existsSync(filePath)) { fs.unlinkSync(filePath); }
            return res.status(500).json({
                ok: false,
                msg: "Error al subir la imagen a Hostinger",
                company: null
            });
        });



}

function deleteImagen(req: Request, res: Response) {
    var idField = req.params.idField;
    var idDocument = req.params.idDocument;
    // Puede tomar el nombre del archivo o "TODAS" para elimnar todas las imagenes del aviso
    var fileName = req.params.fileName;

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
                if (fileName === 'todas') {
                    companyDB.tx_company_banners = [];
                } else {
                    companyDB.tx_company_banners = companyDB.tx_company_banners.filter(archivo => archivo != fileName);
                }
                fileSystem.syncFolder(dirPath, companyDB.tx_company_banners);
            }

            if (idField === 'tx_company_logo') {
                companyDB.tx_company_logo = null;
                fileSystem.syncFolder(dirPath, []);
            }



            companyDB.save().then(companySaved => {

                if (!companySaved) {
                    return res.status(400).json({
                        ok: false,
                        msg: "No se pudo eliminar de la BD la imagen: " + fileName,
                        company: companySaved,
                        filename: fileName
                    });
                }

                // ===================================================
                // SINCRONIZO STORAGE EN HOSTINGER
                // ===================================================
                // Si mi ambiente de producción es Heroku tengo que sincronizar mi storage en Hostinger
                syncHostinger(dirPath).then(() => {
                    console.log('Banner eliminado en Hostinger correctamente');
                }).catch(() => console.log('Error al borrar banner en Hostinger'));


                return res.status(200).json({
                    ok: true,
                    msg: "Se elimino de la BD la imagen: " + fileName,
                    company: companySaved,
                    filename: fileName
                });
            });
        });
    }

    if (['tx_img'].includes(idField)) {
        User.findByIdAndUpdate(idDocument, { tx_img: fileName }).then(userDB => {

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



            userDB.save().then(userSaved => {
                if (!userSaved) {
                    return res.status(400).json({
                        ok: false,
                        msg: "No se pudo eliminar de la BD la imagen: " + fileName,
                        user: userSaved,
                        filename: fileName
                    });
                }

                // ===================================================
                // SINCRONIZO STORAGE EN HOSTINGER
                // ===================================================
                // Si mi ambiente de producción es Heroku tengo que sincronizar mi storage en Hostinger
                syncHostinger(dirPath).then(() => {
                    console.log('Logo de bar eliminado en Hostinger correctamente');
                }).catch(() => console.log('Error al eliminar el logo del bar en Hostinger'));

                return res.status(200).json({
                    ok: true,
                    msg: "Se elimino de la BD la imagen: " + fileName,
                    user: userSaved,
                    filename: fileName
                });
            });
        })
    }

}

function grabarImagenBD(idField: string, idDocument: string, fileName: string, res: Response) {

    return new Promise((resolve, reject) => {

        // Company collection
        if (['tx_company_banners', 'tx_company_logo'].includes(idField)) {
            Company.findById(idDocument).then(companyDB => {

                if (!companyDB) {
                    return reject({
                        ok: false,
                        msg: "El comercio no existe",
                        company: null
                    });
                }

                if (idField === 'tx_company_banners') {
                    let imagenesPermitidas = 12;
                    if (companyDB.tx_company_banners.length >= imagenesPermitidas) {
                        return reject({
                            ok: false,
                            msg: `Supera el máximo de ${imagenesPermitidas} imagenes permitidas`,
                            company: null
                        });
                    }
                    companyDB.tx_company_banners.push(fileName);
                }

                if (idField === 'tx_company_logo') {
                    companyDB.tx_company_logo = fileName;
                }

                companyDB.save().then(companySaved => {
                    if (!companySaved) {
                        return reject({
                            ok: false,
                            msg: "No se pudo guardar la imagen",
                            company: null
                        });
                    }
                    return resolve({
                        ok: true,
                        msg: "Imagen guardada correctamente",
                        company: companySaved,
                        filename: fileName
                    });
                });
            });

        }

        // User collection
        if (['tx_img'].includes(idField)) {
            User.findById(idDocument).then(UserDB => {

                if (!UserDB) {
                    return reject({
                        ok: false,
                        msg: "El comercio no existe",
                        company: null
                    });
                }

                UserDB.tx_img = fileName;

                UserDB.save().then(userSaved => {
                    if (!userSaved) {
                        return reject({
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
                        filename: fileName
                    });
                });
            });
        }
    })
}

async function syncHostinger(dirPath: string): Promise<string> {
    return new Promise(async (resolve, reject) => {
        console.log('sincronizando ', dirPath)
        const client = new ftp.Client();
        client.ftp.verbose = false; // true for console logs messages
        try {
            await client.access({
                host: environment.FTP_HOST,
                user: environment.FTP_USER,
                password: environment.FTP_PASS,
                secure: false
            });
            await client.ensureDir(dirPath);
            await client.clearWorkingDir();
            await client.uploadFromDir(dirPath);
            resolve('');
        }
        catch (err) {
            reject(err);
        }
        client.close();
    })
}

export = {
    uploadImagen,
    deleteImagen
}