import {readdir,readFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const out=new URL('../out/',import.meta.url);
for(const filename of (await readdir(out)).filter(name=>name.endsWith('.js'))){
  const check=spawnSync(process.execPath,['--check',fileURLToPath(new URL(filename,out))],{encoding:'utf8'});
  if(check.status!==0){console.error(check.stderr);process.exit(1);}
}
const html=await readFile(new URL('index.html',out),'utf8');
for(const match of html.matchAll(/(?:src|href)="\.\/([^"?#]+)"/g)){
  if(match[1].endsWith('/'))continue;
  await readFile(new URL(match[1],out));
}
console.log('Módulos y recursos locales verificados.');
