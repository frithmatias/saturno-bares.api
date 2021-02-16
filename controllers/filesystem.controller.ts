import fs from 'fs';
import path from 'path';

function createFolder(dirPath: string) {

    var dirPath = path.resolve(__dirname, '../', dirPath);
    var existe = fs.existsSync(dirPath);

    if (!existe) {
        fs.mkdirSync(dirPath, { recursive: true });
    }
    
}

function syncFolder(dirPath: string, filesInDb: string[]): Promise<void> {
    var dirPath = path.resolve(__dirname, '../', dirPath);
   
    return new Promise(resolve => {
        if (fs.existsSync(dirPath)) {
            fs.readdirSync(dirPath).forEach((file, index) => {
                if(!filesInDb.includes(file)){
                    const curPath = [dirPath, file].join('/');
                    fs.unlinkSync(curPath);
                }
            })
            resolve();
        }

    })
}

function deleteFolder(dirPath: string) {
    var dirPath = path.resolve(__dirname, '../', dirPath);

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