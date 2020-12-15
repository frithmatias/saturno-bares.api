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
function uploadImagen(req: any, res: Response) {

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


    console.log(req.files.imagen.data)
    if(!req.files.imagen?.size || req.files.imagen?.size > 102400) {
        return res.status(400).json({
            ok: false, 
            msg: 'El archivo no debe superar los 100k (102400b)',
            company: null
        })
    }


    // Obtener nombre del archivo
    var archivo = req.files.imagen; //'imagen' es el nombre dado en body>form-data en POSTMAN
    var nombreCortado = archivo.name.split(".");
    var extensionArchivo = nombreCortado[nombreCortado.length - 1];

    // extensiones permitidas
    var extensionesValidas = ["png", "jpg", "gif", "jpeg"];

    if (!extensionesValidas.includes(extensionArchivo)) {
        return res.status(400).json({
            // ERROR DE BASE DE DATOS
            ok: false,
            msg: "Error, extension de archivo no valida.",
            company: null
        });
    }

    // si no existe la carpeta la crea
    var pathdir = `./uploads/${idCompany}`;
    fileSystem.createFolder(pathdir);

    var nombreArchivo = `${idCompany}-${new Date().getMilliseconds()}.${extensionArchivo}`; // Uso los backticks para hacer un template literal
    let pathfile = `./uploads/${idCompany}/${nombreArchivo}`;

    archivo.mv(pathfile, (err: any) => {
        if (err) {
            return res.status(500).json({
                ok: false,
                msg: "Error, no se pudo mover el archivo.",
                company: null
            });
        }

        // Ya tengo la imagen en uploads/usuario ahora
        // 1. borro la imagen vieja
        // 2. guardo el nombre en la bbdd
        
        
        return grabarImagenBD(txType, idCompany, nombreArchivo, res);
        
        // ================================================================
        // SYNC HOSTINGER FTP: envío las imagenes hacia hostinger por FTP
        // ================================================================
        // syncHostinger(pathdir).then(() => console.log('subido ok')).catch(err => console.log(err));
    });

}

function grabarImagenBD(txType: string, idCompany: string, nombreArchivo: string, res: Response) {
    //usuario 5c75c21b70933c1784cdc8db 5c75c21b70933c1784cdc8db-924.jpg ServerResponse {...}
    if (txType === "logo") {

        Company.findByIdAndUpdate(idCompany, { tx_company_logo: nombreArchivo }).then(companyDB => {

            if (!companyDB) {
                return res.status(400).json({
                    ok: false,
                    msg: "No existe el comercio solicitado",
                    company: null
                });
            }

            //borro imagen vieja
            var pathViejo = `./uploads/${idCompany}/${companyDB.tx_company_logo}`;
            
            if (fs.existsSync(pathViejo)) {
                fs.unlinkSync(pathViejo);
            }


            return res.status(200).json({
                ok: true,
                msg: "Logo actualizado correctamente",
                company: companyDB
            });

        }).catch(()=>{
            return res.status(500).json({
                ok: false, 
                msg: 'Error al actualizar el nuevo logo',
                company: null
            })
        })
    }

    if (txType === "banner") {

        Company.findById(idCompany).then(companyDB => {

            if (!companyDB) {
                return res.status(400).json({
                    ok: false,
                    msg: "El comercio no existe",
                    company: null
                });
            }

            companyDB.tx_company_banners.push(nombreArchivo);

            companyDB.save().then( companySaved => {

                if (!companySaved) {
                    return res.status(500).json({
                        // ERROR DE BASE DE DATOS
                        ok: false,
                        msg: "No se pudo guardar el banner",
                        company: null
                    });
                }

                return res.status(200).json({
                    ok: true,
                    msg: "Banner guardado correctamente",
                    company: companySaved
                });


            });
        });

    }
}

function deleteImagen(req: Request, res: Response) {
    var txType = req.params.txType;
    var idCompany = req.params.idCompany;
    // Puede tomar el nombre del archivo o "TODAS" para elimnar todas las imagenes del aviso
    var filename = req.params.filename;

    if (txType === "banner") {
        // ===================================================
        // BUSCO EL AVISO EN LA BASE DE DATOS
        // ===================================================
        Company.findById(idCompany).then(companyDB => {

            if (!companyDB) {
                return res.status(400).json({
                    ok: false,
                    msg: "El aviso no existe",
                    user: null
                });
            }

            // ===================================================
            // ELIMINO ARCHIVOS FÍSICOS EN STORAGE
            // ===================================================
            var dirPath = `./uploads/${idCompany}/${txType}`;

            if (filename === 'todas') {

                fileSystem.deleteFolder(dirPath)
                companyDB.tx_company_banners = [];

            } else {

                var filePath = `./uploads/${idCompany}/${txType}/${filename}`;
                if (fs.existsSync(filePath)) { fs.unlinkSync(filePath); }
                companyDB.tx_company_banners = companyDB.tx_company_banners.filter(archivo => archivo != filename);

            }

            // ===================================================
            // SINCRONIZO STORAGE EN HOSTINGER
            // ===================================================
            // Si mi ambiente de producción es Heroku tengo que sincronizar mi storage en Hostinger
            // syncHostinger(dirPath).then(() => console.log('eliminado ok')).catch(err => console.log(err));

            companyDB.save().then(companySaved => {

                if (companySaved)
                    res.status(200).json({
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