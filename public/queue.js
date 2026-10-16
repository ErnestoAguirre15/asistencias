import { api } from './shared.js';
const PREFIX = 'presencia:pending:';
let authProvider=async()=>null;
export function setAuthProvider(provider) { authProvider=provider; }
export function pending() {
  const records = [];
  for (let i=0; i<localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith(PREFIX)) {
      const record = JSON.parse(localStorage.getItem(key));
      if (!record?.id || !record?.nombre || !record?.hora_cliente) throw new Error('Hay un registro local que no se puede leer. No borres los datos del navegador.');
      records.push(record);
    }
  }
  return records.sort((a,b) => a.hora_cliente.localeCompare(b.hora_cliente));
}
export function enqueue(record) {
  // Una clave por visita evita sobrescribir otras visitas desde pestañas diferentes.
  localStorage.setItem(PREFIX + record.id, JSON.stringify(record));
  window.dispatchEvent(new Event('queuechange'));
}
export function rejected() {
  const items=[];
  for (let i=0;i<localStorage.length;i++) {
    const key=localStorage.key(i);
    if(key?.startsWith('presencia:rejected:')) items.push(JSON.parse(localStorage.getItem(key)));
  }
  return items;
}
export function dismissRejected(id) { localStorage.removeItem('presencia:rejected:'+id); }
export function migrate() {
  const old = localStorage.getItem('asistencias_pendientes');
  if (!old) return;
  const records = JSON.parse(old);
  if (!Array.isArray(records)) throw new Error('No se pudo leer la cola de la versión anterior.');
  records.forEach(enqueue);
  localStorage.removeItem('asistencias_pendientes');
}
let running;
export function sync() {
  if (running) return running;
  running = (async () => {
    if (!navigator.onLine) return;
    for (const record of pending()) {
      try {
        const token=await authProvider(record);
        if(!token) continue;
        const saved = await api('attendance', { method:'POST', headers:{Authorization:`Bearer ${token}`}, body:JSON.stringify(record) });
        localStorage.removeItem(PREFIX + record.id);
        window.dispatchEvent(new CustomEvent('synced', { detail:{ ...record, ...saved } }));
        window.dispatchEvent(new Event('queuechange'));
      } catch (error) {
        if (error.status === 400 || error.status === 409) {
          const failed={...record, error:error.message};
          // Persistir el rechazo antes de retirarlo de la cola; se podrá corregir al volver.
          localStorage.setItem('presencia:rejected:'+record.id,JSON.stringify(failed));
          localStorage.removeItem(PREFIX+record.id);
          window.dispatchEvent(new CustomEvent('rejected',{detail:failed}));
          window.dispatchEvent(new Event('queuechange'));
          continue;
        }
        window.dispatchEvent(new CustomEvent('syncerror', { detail:error }));
        if (error.status !== 400) break;
      }
    }
  })().finally(() => { running = null; });
  return running;
}
export function startSync() {
  try { migrate(); } catch (error) { window.dispatchEvent(new CustomEvent('syncerror', { detail:error })); }
  const run = () => sync().catch(error => window.dispatchEvent(new CustomEvent('syncerror', { detail:error })));
  run();
  addEventListener('online',run);
  addEventListener('storage',run);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) run(); });
  setInterval(run,15000);
}
