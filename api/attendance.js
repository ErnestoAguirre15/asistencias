import { authorized, database, reply, sameOrigin, validateRecord } from '../lib/server.js';
import { verifyGoogleVisitor } from '../lib/visitor-auth.js';

export default async function handler(req, res) {
  if (req.method === 'GET') {
    if (!authorized(req)) return reply(res, 401, { error: 'Inicia sesión para consultar las visitas.' });
    try {
      const cursor = req.query?.cursor;
      if (cursor && !/^\d+$/.test(cursor)) return reply(res, 400, { error: 'Cursor inválido.' });
      const rows = await database(`asistencias?select=id,nombre,correo,created_at,hora_cliente,ip,sequence&deleted_at=is.null&order=sequence.asc&limit=1000${cursor ? `&sequence=gt.${cursor}` : ''}`);
      return reply(res, 200, { rows, next: rows.length ? String(rows.at(-1).sequence) : cursor || '0', more: rows.length === 1000 });
    } catch (error) { return reply(res, 503, { error: error.message }); }
  }
  if (req.method === 'DELETE') {
    if (!authorized(req)) return reply(res, 401, { error: 'Inicia sesión para eliminar visitas.' });
    if (!sameOrigin(req)) return reply(res, 403, { error: 'Origen no permitido.' });
    const id = req.body?.id;
    if (typeof id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) return reply(res, 400, { error:'Identificador inválido.' });
    try {
      await database('rpc/eliminar_visita', { method:'POST', body:JSON.stringify({ registro_id:id }) });
      return reply(res, 200, { ok:true });
    } catch (error) { return reply(res, 503, { error:error.message }); }
  }
  if (req.method !== 'POST') return reply(res, 405, { error: 'Método no permitido.' });
  if (!sameOrigin(req)) return reply(res, 403, { error: 'Origen no permitido.' });
  let identity;
  try { identity=await verifyGoogleVisitor(req); }
  catch(error) { return reply(res,error.status || 503,{error:error.message}); }
  if(typeof req.body?.correo !== 'string' || req.body.correo.trim().toLowerCase() !== identity.correo) return reply(res,403,{error:'Selecciona la misma cuenta de Google con la que creaste este registro pendiente.'});
  const record = validateRecord(req.body);
  if (!record) return reply(res, 400, { error: 'Escribe un nombre y un correo electrónico válido. Si este registro es antiguo, vuelve a completarlo con correo.' });
  try {
    const ip = String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'desconocida').split(',')[0].trim().slice(0, 100);
    const saved = await database('rpc/registrar_visita_correo', { method: 'POST', body: JSON.stringify({ registro_id: record.id, visitante: record.nombre, email:record.correo, hora_local: record.hora_cliente, direccion_ip: ip }) });
    if (saved.error) return reply(res, saved.status || 409, { error:saved.error });
    return reply(res, 200, { id: saved.id, created_at: saved.created_at });
  } catch (error) { return reply(res, 503, { error: error.message }); }
}
