export const $ = id => document.getElementById(id);
const paths = { mark:'M5 5h5v14H5z M14 5h5v8h-5z M14 17h5v2h-5z', user:'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8 M20 8v6 M17 11h6', check:'m5 12 4 4L19 6', shield:'M12 3 4 6v6c0 5 8 9 8 9s8-4 8-9V6z m-4 9 3 3 5-6', arrow:'M4 12h16 m-6-6 6 6-6 6', grid:'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z', qr:'M3 3h6v6H3z M15 3h6v6h-6z M3 15h6v6H3z M15 15h3v3h-3z M21 15v6h-6', download:'M12 3v12 m-5-5 5 5 5-5 M4 16v5h16v-5', clock:'M12 8v5l3 2 M22 12a10 10 0 1 0-20 0 10 10 0 0 0 20 0', calendar:'M4 5h16v16H4z M16 3v4 M8 3v4 M4 11h16', exit:'M9 3H3v18h6 M10 12h11 m-4-4 4 4-4 4', link:'M14 3h7v7 M21 3 10 14 M10 3H3v18h18v-7', list:'M8 6h13 M8 12h13 M8 18h13 M3 6h1 M3 12h1 M3 18h1' };
export const icon = name => `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="${paths[name] || paths.grid}"/></svg>`;
document.querySelectorAll('[data-icon]').forEach(el => el.innerHTML = icon(el.dataset.icon));
const zone = window.CONFIG.TIME_ZONE;
export const time = iso => new Date(iso).toLocaleTimeString('es-SV', { timeZone: zone, hour:'2-digit', minute:'2-digit', second:'2-digit', hour12:false });
export const date = iso => new Date(iso).toLocaleDateString('es-SV', { timeZone:zone, day:'2-digit', month:'short', year:'numeric' });
export const day = iso => {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone:zone, year:'numeric', month:'2-digit', day:'2-digit' }).formatToParts(new Date(iso));
  const get = t => parts.find(x => x.type === t).value;
  return `${get('year')}-${get('month')}-${get('day')}`;
};
export async function api(path, options = {}) {
  const res = await fetch(`/api/${path}`, { ...options, credentials:'same-origin', headers:{ 'Content-Type':'application/json', ...options.headers }, signal:AbortSignal.timeout(18000) });
  let body;
  try { body = await res.json(); } catch { throw new Error('El servidor no está disponible. Tu registro pendiente se conserva.'); }
  if (!res.ok) { const error = new Error(body.error || 'No se pudo completar la solicitud.'); error.status = res.status; throw error; }
  return body;
}
export const escapeHTML = str => String(str ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
export function download(blob, filename) {
  const url = URL.createObjectURL(blob), a = Object.assign(document.createElement('a'), { href:url, download:filename });
  a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
