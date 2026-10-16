import { $, time } from './shared.js';
import { enqueue, startSync, sync, rejected, dismissRejected } from './queue.js';
let current;
let correction;
function showRejection(record) {
  if (current && current.id !== record.id) return;
  correction=record.id; current=null;
  $('successView').hidden=true; $('formView').hidden=false;
  $('nombre').value=record.nombre;
  $('correo').value=record.correo || '';
  $('formError').textContent=record.error;
  $('submit').disabled=false; $('correo').focus();
}
addEventListener('rejected',event=>showRejection(event.detail));
function connection() {
  $('connection').textContent = navigator.onLine ? 'En línea' : 'Sin conexión';
  $('connection').classList.toggle('pending',!navigator.onLine);
}
function confirmed(record) {
  if (record.id !== current?.id) return;
  $('thanks').textContent=`¡Gracias por su visita, ${record.nombre}!`;
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
  const correo = $('correo').value.trim().toLowerCase();
  if (correo.length>254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) { $('formError').textContent='Escribe un correo electrónico válido.'; return; }
  if (nombre.length < 2) { $('formError').textContent = 'Escribe tu nombre completo (al menos 2 caracteres).'; return; }
  $('submit').disabled = true;
  try {
    current = { id:crypto.randomUUID(), nombre, correo, hora_cliente:new Date().toISOString() };
    enqueue(current);
    if(correction) { dismissRejected(correction); correction=null; }
  } catch {
    current = null;
    $('formError').textContent = 'No pudimos guardar en este dispositivo. Permite el almacenamiento del navegador e intenta otra vez.';
    $('submit').disabled = false;
    return;
  }
  $('thanks').textContent = 'Estamos comprobando tu registro';
  $('statusText').textContent = 'Guardada en este dispositivo';
  $('registeredTime').textContent = 'Pendiente de sincronizar';
  $('registeredTime').style.fontSize = '22px';
  $('syncNote').textContent = 'Tu registro aún no está confirmado. Al conectar verificaremos que el correo no esté registrado y confirmaremos la hora del servidor.';
  $('formView').hidden = true; $('successView').hidden = false;
  $('thanks').tabIndex = -1; $('thanks').focus();
  sync().catch(() => {});
};
$('another').onclick = () => {
  current = null; $('visitorForm').reset(); $('submit').disabled = false;

  $('successView').hidden = true; $('formView').hidden = false; $('nombre').focus();
};
addEventListener('online',connection); addEventListener('offline',connection); connection(); startSync();
try { const failed=rejected(); if(failed.length) showRejection(failed.at(-1)); } catch {}
if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});

