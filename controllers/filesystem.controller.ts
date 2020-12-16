import fs from 'fs';
import path from 'path';

function createFolder(dirPath: string) {
    // ./uploads/aviso
    // ./uploads/usuario

    // seems like fs works fine with dirPath instead completePath
    // var completePath = path.resolve(__dirname, '../', dirPath);
    var existe = fs.existsSync(dirPath);

    if (!existe) {
        fs.mkdirSync(dirPath, { recursive: true });
    }
    // return completePathTemp;
}

function syncFolder(dirPath: string, filesInDb: string[]): Promise<void> {
    return new Promise(resolve => {
        if (fs.existsSync(dirPath)) {
            fs.readdirSync(dirPath).forEach((file, index) => {
                console.log('Sync file', file)
                if(!filesInDb.includes(file)){
                    const curPath = [dirPath, file].join('/');
                    fs.unlinkSync(curPath);
                }
            })
            resolve();
            console.log('Fin de syncFolder')
        }

    })
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



export = { createFolder, deleteFolder, syncFolder }