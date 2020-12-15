import fs from 'fs';
import path from 'path';

function createFolder(dirPath: string) {
    // ./uploads/aviso
    // ./uploads/usuario

    // seems like fs works fine with dirPath instead completePath
    // var completePath = path.resolve(__dirname, '../', dirPath);
    var existe = fs.existsSync(dirPath);
    
    if (!existe) {
        fs.mkdirSync(dirPath, {recursive: true});
    } 
    // return completePathTemp;
}

function deleteFolder(dirPath: string) {

    const deleteFolderRecursive = (dirPath: string) => {
        if (fs.existsSync(dirPath)) {
            fs.readdirSync(dirPath).forEach((file, index) => {
                const curPath = [dirPath, file].join('/');
                if (fs.lstatSync(curPath).isDirectory()) { // recurse
                    deleteFolderRecursive(curPath);
                } else { // delete file
                    fs.unlinkSync(curPath);
                }
            });
            fs.rmdirSync(dirPath);
        }
    };

    deleteFolderRecursive(dirPath);

    if (fs.existsSync(dirPath)) {
        return (false);
    } else {
        return (true);
    }

}



export = { createFolder, deleteFolder }