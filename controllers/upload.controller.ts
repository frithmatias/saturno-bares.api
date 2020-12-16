import { Request, Response } from 'express';
import { Company } from '../models/company.model';

import fileSystem from './filesystem.controller';
import fs from 'fs';
import ftp from 'basic-ftp';

import environment from '../global/environment';


// ========================================================
// Upload Methods
// ========================================================

// front -> [HTTP] -> heroku -> [FTP] -> hostinger
async function uploadImagen(req: any, res: Response) {

    var txType = req.params.txType;
    var idCompany = req.params.idCompany;
    var tiposValidos = ["banner", "logo", "user"];

    if (!tiposValidos.includes(txType)) {
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
    let response: any = await grabarImagenBD(txType, idCompany, archivoNombre, res);

    if (!response.ok) {
        return res.status(400).json(response)
    }

    // si no existe la carpeta la crea
    var pathdir = `./uploads/${idCompany}/${txType}`;
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
    // syncHostinger(pathdir).then(() => console.log('subido ok')).catch(err => console.log(err));

}

function grabarImagenBD(txType: string, idCompany: string, archivoNombre: string, res: Response) {
    return new Promise((resolve) => {

        //usuario 5c75c21b70933c1784cdc8db 5c75c21b70933c1784cdc8db-924.jpg ServerResponse {...}
        if (txType === "logo") {
            Company.findByIdAndUpdate(idCompany, { tx_company_logo: archivoNombre }).then(companyDB => {

                if (!companyDB) {
                    return resolve({
                        ok: false,
                        msg: "No existe el comercio solicitado",
                        company: null
                    })
                }

                //borro imagen vieja
                var pathViejo = `./uploads/${idCompany}/${companyDB.tx_company_logo}`;

                if (fs.existsSync(pathViejo)) {
                    fs.unlinkSync(pathViejo);
                }

                return resolve({
                    ok: true,
                    msg: "Logo actualizado correctamente",
                    company: companyDB
                });


            }).catch(() => {
                return resolve({
                    ok: false,
                    msg: 'Error al actualizar el nuevo logo',
                    company: null
                })
            })
        }

        if (txType === "banner") {
            let imagenesPermitidas = 12;
            Company.findById(idCompany).then(companyDB => {

                if (!companyDB) {
                    return resolve({
                        ok: false,
                        msg: "El comercio no existe",
                        company: null
                    });
                }

                if (companyDB.tx_company_banners.length >= imagenesPermitidas) {
                    return resolve({
                        ok: false,
                        msg: `Supera el máximo de ${imagenesPermitidas} imagenes permitidas`,
                        company: null
                    });
                }


                companyDB.tx_company_banners.push(archivoNombre);
                companyDB.save().then(companySaved => {

                    if (!companySaved) {
                        return resolve({
                            // ERROR DE BASE DE DATOS
                            ok: false,
                            msg: "No se pudo guardar el banner",
                            company: null
                        });
                    }

                    return resolve({
                        ok: true,
                        msg: "Banner guardado correctamente",
                        company: companySaved,
                        filename: archivoNombre
                    });


                });
            });

        }


    })

}

function deleteImagen(req: Request, res: Response) {
    var txType = req.params.txType;
    var idCompany = req.params.idCompany;
    // Puede tomar el nombre del archivo o "TODAS" para elimnar todas las imagenes del aviso
    var filename = req.params.filename;

    if (txType === "banner") {

        Company.findById(idCompany).then(companyDB => {

            if (!companyDB) {
                return res.status(400).json({
                    ok: false,
                    msg: "El aviso no existe",
                    user: null
                });
            }

            var dirPath = `./uploads/${idCompany}/${txType}`;

            if (filename === 'todas') {

                companyDB.tx_company_banners = [];
                fileSystem.syncFolder(dirPath, []);

            } else {

                companyDB.tx_company_banners = companyDB.tx_company_banners.filter(archivo => archivo != filename);
                var filePath = `./uploads/${idCompany}/${txType}/${filename}`;
                if (fs.existsSync(filePath)) { fs.unlinkSync(filePath); }

            }

            // ===================================================
            // SINCRONIZO STORAGE EN HOSTINGER
            // ===================================================
            // Si mi ambiente de producción es Heroku tengo que sincronizar mi storage en Hostinger
            // syncHostinger(dirPath).then(() => console.log('eliminado ok')).catch(err => console.log(err));
            companyDB.save().then(companySaved => {
                if (companySaved)
                    return res.status(200).json({
                        ok: true,
                        msg: "Se elimino de la BD la imagen: " + filename,
                        company: companySaved
                    });
            });
        });
    }

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