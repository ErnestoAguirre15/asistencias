import { $, time } from './shared.js';
import { enqueue, startSync, sync } from './queue.js';
let current;
function connection() {
  $('connection').textContent = navigator.onLine ? 'En línea' : 'Sin conexión';
  $('connection').classList.toggle('pending',!navigator.onLine);
}
function confirmed(record) {
  if (record.id !== current?.id) return;
  $('statusText').textContent = 'Asistencia registrada a las';
  $('registeredTime').textContent = time(record.created_at);
  $('syncNote').textContent = 'Tu visita se guardó correctamente. Esta es la hora confirmada del servidor.';
}
addEventListener('synced', e => confirmed(e.detail));
addEventListener('syncerror', () => {
  if (current) $('syncNote').textContent = 'Tu visita sigue guardada en este dispositivo. Reintentaremos automáticamente; puedes volver a abrir esta página para sincronizar.';
});
$('visitorForm').onsubmit = e => {
  e.preventDefault();
  $('formError').textContent = '';
  const nombre = $('nombre').value.trim().replace(/\s+/g,' ');
  if (nombre.length < 2) { $('formError').textContent = 'Escribe tu nombre completo (al menos 2 caracteres).'; return; }
  $('submit').disabled = true;
  try {
    current = { id:crypto.randomUUID(), nombre, hora_cliente:new Date().toISOString() };
    enqueue(current);
  } catch {
    current = null;
    $('formError').textContent = 'No pudimos guardar en este dispositivo. Permite el almacenamiento del navegador e intenta otra vez.';
    $('submit').disabled = false;
    return;
  }
  $('thanks').textContent = `¡Gracias por su visita, ${nombre}!`;
  $('statusText').textContent = 'Guardada en este dispositivo';
  $('registeredTime').textContent = 'Pendiente de sincronizar';
  $('registeredTime').style.fontSize = '22px';
  $('syncNote').textContent = 'Confirmaremos la hora del servidor al sincronizar. Si no tienes conexión, conserva los datos de este navegador y vuelve a abrir esta página con internet.';
  $('formView').hidden = true; $('successView').hidden = false;
  $('thanks').tabIndex = -1; $('thanks').focus();
  sync().catch(() => {});
};
$('another').onclick = () => {
  current = null; $('visitorForm').reset(); $('submit').disabled = false;
  $('successView').hidden = true; $('formView').hidden = false; $('nombre').focus();
};
addEventListener('online',connection); addEventListener('offline',connection); connection(); startSync();
if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
