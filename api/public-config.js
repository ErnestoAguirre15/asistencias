import { reply } from '../lib/server.js';
import { publicAuthConfig } from '../lib/visitor-auth.js';
export default function handler(req,res) {
  if(req.method!=='GET') return reply(res,405,{error:'Método no permitido.'});
  try { return reply(res,200,publicAuthConfig()); }
  catch(error) { return reply(res,503,{error:error.message}); }
}
