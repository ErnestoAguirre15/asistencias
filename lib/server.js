import { createHmac, timingSafeEqual } from 'node:crypto';

export const equal = (a, b) => {
  const x = Buffer.from(String(a ?? '')), y = Buffer.from(String(b ?? ''));
  return x.length === y.length && timingSafeEqual(x, y);
};
function signature(value) {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) throw new Error('Configura SESSION_SECRET (mínimo 32 caracteres).');
  return createHmac('sha256', secret).update(value).digest('base64url');
}
export function session(now = Date.now()) {
  const value = Buffer.from(JSON.stringify({ exp: now + 8 * 3600000, role: 'admin' })).toString('base64url');
  return `${value}.${signature(value)}`;
}
export function authorized(req, now = Date.now()) {
  try {
    const token = (req.headers.cookie || '').split(';').map(x => x.trim()).find(x => x.startsWith('presencia_session='))?.slice(18);
    if (!token) return false;
    const [value, sig, extra] = token.split('.');
    if (extra || !equal(signature(value), sig)) return false;
    const payload = JSON.parse(Buffer.from(value, 'base64url').toString());
    return payload.role === 'admin' && payload.exp > now;
  } catch { return false; }
}
export function cookie(token, req, clear = false) {
  return `presencia_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${clear ? 0 : 28800}${process.env.VERCEL || req.headers['x-forwarded-proto'] === 'https' ? '; Secure' : ''}`;
}
export function sameOrigin(req) {
  if (!req.headers.origin) return true;
  try { return new URL(req.headers.origin).host === req.headers.host; } catch { return false; }
}
export function reply(res, status, body) {
  res.setHeader('Cache-Control', 'no-store');
  return res.status(status).json(body);
}
export async function database(path, options = {}) {
  const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Falta configurar Supabase en Vercel.');
  const response = await fetch(`${url}/rest/v1/${path}`, {
    ...options, signal: AbortSignal.timeout(12000),
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', ...options.headers }
  });
  if (!response.ok) {
    console.error('Supabase HTTP', response.status);
    throw new Error('No se pudo acceder a la base de datos.');
  }
  return response.status === 204 ? null : response.json();
}
export function validateRecord(input) {
  if (!input || typeof input.nombre !== 'string' || typeof input.id !== 'string') return null;
  const nombre = input.nombre.trim().replace(/\s+/g, ' ');
  if (nombre.length < 2 || nombre.length > 120 || /[\u0000-\u001f\u007f]/.test(nombre)) return null;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(input.id)) return null;
  if (!input.hora_cliente || !Number.isFinite(Date.parse(input.hora_cliente))) return null;
  const correo = typeof input.correo === 'string' ? input.correo.trim().toLowerCase() : '';
  if (correo.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) return null;
  return { id: input.id, nombre, correo, hora_cliente: new Date(input.hora_cliente).toISOString() };
}
