import { authorized, cookie, database, equal, reply, sameOrigin, session } from '../lib/server.js';

export default async function handler(req, res) {
  if (req.method === 'GET') return reply(res, authorized(req) ? 200 : 401, { authenticated: authorized(req) });
  if (!sameOrigin(req)) return reply(res, 403, { error: 'Origen no permitido.' });
  if (req.method === 'DELETE') {
    res.setHeader('Set-Cookie', cookie('', req, true));
    return reply(res, 200, { ok: true });
  }
  if (req.method !== 'POST') return reply(res, 405, { error: 'Método no permitido.' });
  try {
    const ip = String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown').split(',')[0].trim();
    // Shared, database-backed limit: survives cold starts and multiple Vercel instances.
    const allowed = await database('rpc/attendance_login_allowed', { method: 'POST', body: JSON.stringify({ client_ip: ip }) });
    if (!allowed) return reply(res, 429, { error: 'Demasiados intentos. Intenta de nuevo en 15 minutos.' });
    if (!process.env.ADMIN_PASSWORD) throw new Error('Configura ADMIN_PASSWORD en Vercel.');
    if (!equal(req.body?.username, process.env.ADMIN_USER || 'admin') || !equal(req.body?.password, process.env.ADMIN_PASSWORD)) {
      return reply(res, 401, { error: 'Usuario o contraseña incorrectos.' });
    }
    res.setHeader('Set-Cookie', cookie(session(), req));
    return reply(res, 200, { authenticated: true });
  } catch (error) { return reply(res, 503, { error: error.message }); }
}
