import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname,sep,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import earth from '../api/earth.js';
import places from '../api/places.js';
import modis from '../api/modis.js';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../out');
const port=Number(process.env.PORT||4180);
const mime={'.html':'text/html;charset=utf-8','.js':'text/javascript;charset=utf-8','.css':'text/css;charset=utf-8','.json':'application/json;charset=utf-8','.md':'text/plain;charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg'};
const server=http.createServer(async(req,res)=>{
  try{
    if(new URL(req.url,'http://localhost').pathname==='/api/modis')return await modis(req,res);
    if(new URL(req.url,'http://localhost').pathname==='/api/places')return await places(req,res);
    if(new URL(req.url,'http://localhost').pathname==='/api/earth')return await earth(req,res);
    if(!['GET','HEAD'].includes(req.method)){res.writeHead(405,{'Allow':'GET, HEAD'});return res.end();}
    const requestPath=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    const target=resolve(root,'.'+(requestPath==='/'?'/index.html':requestPath));
    if(!target.startsWith(root+sep)){res.writeHead(403);return res.end('Acceso fuera del sitio.');}
    const bytes=await readFile(target);
    res.writeHead(200,{'Content-Type':mime[extname(target)]||'application/octet-stream','Content-Length':bytes.length,'Cache-Control':'no-cache','X-Content-Type-Options':'nosniff'});
    res.end(req.method==='HEAD'?undefined:bytes);
  }catch(error){res.writeHead(error.code==='ENOENT'?404:400);res.end('Recurso no disponible.');}
});
server.listen(port,'127.0.0.1',()=>console.log(`TerraMind Evidencia: http://127.0.0.1:${port}`));
process.on('SIGINT',()=>server.close(()=>process.exit(0)));
