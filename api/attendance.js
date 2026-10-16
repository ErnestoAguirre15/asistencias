import { authorized, database, reply, sameOrigin, validateRecord } from '../lib/server.js';

export default async function handler(req, res) {
  if (req.method === 'GET') {
    if (!authorized(req)) return reply(res, 401, { error: 'Inicia sesión para consultar las visitas.' });
    try {
      const cursor = req.query?.cursor;
      if (cursor && !/^\d+$/.test(cursor)) return reply(res, 400, { error: 'Cursor inválido.' });
      const rows = await database(`asistencias?select=id,nombre,created_at,hora_cliente,ip,sequence&order=sequence.asc&limit=1000${cursor ? `&sequence=gt.${cursor}` : ''}`);
      return reply(res, 200, { rows, next: rows.length ? String(rows.at(-1).sequence) : cursor || '0', more: rows.length === 1000 });
    } catch (error) { return reply(res, 503, { error: error.message }); }
  }
  if (req.method !== 'POST') return reply(res, 405, { error: 'Método no permitido.' });
  if (!sameOrigin(req)) return reply(res, 403, { error: 'Origen no permitido.' });
  const record = validateRecord(req.body);
  if (!record) return reply(res, 400, { error: 'Revisa el nombre y los datos del registro.' });
  try {
    const ip = String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'desconocida').split(',')[0].trim().slice(0, 100);
    const saved = await database('rpc/registrar_visita', { method: 'POST', body: JSON.stringify({ registro_id: record.id, visitante: record.nombre, hora_local: record.hora_cliente, direccion_ip: ip }) });
    return reply(res, 200, { id: saved.id, created_at: saved.created_at });
  } catch (error) { return reply(res, 503, { error: error.message }); }
}
