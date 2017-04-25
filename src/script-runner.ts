import * as fs from 'fs';
import * as express from 'express';
import { PerformanceDymos } from './performance-dymos';

let PORT = '4111';
let SERVER_PATH = 'http://localhost:' + PORT + '/';

var app = express();
app.use(express["static"](__dirname));
var server = app.listen(PORT);
console.log('server started at '+SERVER_PATH);

createAndSavePerformanceDymo('audio/Chopin_Op028-11_003_20100611-SMD-cut/', 'output/dymo.json')
  .then(() => console.log('done'))
  .then(() => server.close());

function createAndSavePerformanceDymo(audioPath: string, outPath: string): Promise<any> {
  return getFilesInDir(audioPath, ['wav'])
    .then(files => PerformanceDymos.createSebastianDymo3(files))
    .then(generator => generator.getManager().getStore().toJsonld())
    .then(jsonld => writeFile(jsonld, outPath))
    .catch(e => console.log(e));
}

function getFilesInDir(dirPath: string, fileTypes: string[]): Promise<string[]> {
  return new Promise(resolve => {
    fs.readdir(dirPath, (err, files) => {
      if (err) {
        console.log(err);
      } else if (files) {
        var files = files.filter(f =>
          //check if right extension
          fileTypes.indexOf(f.split('.').slice(-1)[0]) >= 0
        );
      }
      resolve(files);
    });
  });
}

function writeFile(content: string, path: string): Promise<any> {
  return new Promise((resolve, reject) => {
    fs.writeFile(path, content, function (err) {
      if (err) return reject(err);
      resolve('file saved at ' + path);
    });
  });
}