import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {tasksFor,runTasks,combineTiles} from '../out/modis-jobs.js';
import {processModis} from '../api/modis.js';
import {areaVegetationAnalysis,areaKm2} from '../out/global-area.js';
const site={lat:-25,lon:-63,area:{south:-25.05,north:-24.95,west:-63.05,east:-62.95}};
const folder=new URL('../../../work/modis-v4-cache/',import.meta.url);await mkdir(folder,{recursive:true});
const file=key=>new URL(createHash('sha256').update(key).digest('hex')+'.json',folder);
const {tasks,tiles}=tasksFor(site);console.log(JSON.stringify({areaKm2:areaKm2(site.area),tiles:tiles.length,tasks:tasks.length}));
let last=-1;
const outcome=await runTasks(tasks,{
  read:async key=>{try{return JSON.parse(await readFile(file(key),'utf8'));}catch{return null;}},
  write:async(key,r)=>writeFile(file(key),JSON.stringify(r)),
  fetchTask:task=>processModis({date:task.date,...task.tile.area}),
  onProgress:p=>{if(Math.floor(p.done/20)!==last||p.done===p.total){last=Math.floor(p.done/20);console.log(JSON.stringify(p));}}
});
const rows=[];for(let i=0;i<253;i++){const group=outcome.results.slice(i*tiles.length,(i+1)*tiles.length);if(group.every(Boolean))rows.push(combineTiles(group.map(r=>r.row),site.area));}
const analysis=areaVegetationAnalysis(rows,'ndvi',2015,2025,'strict');
const report={verifiedAt:new Date().toISOString(),site,areaKm2:areaKm2(site.area),tiles:tiles.length,expectedComposites:253,receivedComposites:rows.length,failed:outcome.failed,qaAccepted:analysis.quality.accepted,annual:analysis.annual,first:rows[0],last:rows.at(-1),receipts:outcome.results.filter(Boolean).map(r=>r.receipt)};
await writeFile(new URL('../VALIDATION-MODIS-V4.json',import.meta.url),JSON.stringify(report,null,2));
console.log(JSON.stringify({complete:rows.length===253,received:rows.length,failed:outcome.failed.length,qaAccepted:analysis.quality.accepted}));if(rows.length!==253)process.exitCode=1;
