// Vista previa estática opcional: no simula registros ni conexiones a Supabase.
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root=path.resolve(fileURLToPath(new URL('./public/',import.meta.url)));
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml'};
http.createServer(async(req,res)=>{
  const url=new URL(req.url,'http://localhost');
  if(url.pathname.startsWith('/api/')){res.writeHead(503,{'Content-Type':'application/json'});res.end(JSON.stringify({error:'Vista previa local: conecta Supabase y despliega en Vercel para activar el servidor.'}));return;}
  let pathname=decodeURIComponent(url.pathname);
  if(pathname==='/')pathname='/asistencia';
  if(!path.extname(pathname))pathname+='.html';
  const filename=path.resolve(root,'.'+pathname);
  if(!filename.startsWith(root+path.sep)&&filename!==root){res.writeHead(403);res.end();return;}
  try{const data=await readFile(filename);res.writeHead(200,{'Content-Type':types[path.extname(filename)]||'application/octet-stream'});res.end(data);}
  catch{res.writeHead(404);res.end('No encontrado');}
}).listen(4173,'127.0.0.1',()=>console.log('Vista previa: http://127.0.0.1:4173/asistencia'));
