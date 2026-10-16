import { reply } from '../lib/server.js';
// Compatibilidad con versiones previas: acceso Google desactivado.
export default function handler(req,res) {
  return reply(res,200,{google:false});
}
