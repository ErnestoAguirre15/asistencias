import { $, time } from './shared.js';
import { enqueue, startSync, sync, rejected, dismissRejected, pending, setAuthProvider } from './queue.js';
import { initializeGoogle, signInGoogle, tokenFor, clearGoogle } from './google-auth.js';
let current, correction, selectedEmail='';
setAuthProvider(tokenFor);
function connection() {
  $('connection').textContent=navigator.onLine?'En línea':'Sin conexión';
  $('connection').classList.toggle('pending',!navigator.onLine);
}
function signedOut() {
  selectedEmail=''; $('correo').value=''; $('nombre').value='';
  $('visitorForm').hidden=true; $('googleLogin').hidden=false;
  $('accountView').hidden=true;
}
function showPending() {
  $('thanks').textContent='Estamos comprobando tu registro';
  $('statusText').textContent='Guardada en este dispositivo';
  $('registeredTime').textContent='Pendiente de sincronizar';
  $('registeredTime').style.fontSize='22px';
  $('syncNote').textContent='Confirmaremos tu visita cuando el servidor verifique la cuenta y que el correo no esté registrado.';
  $('formView').hidden=true; $('successView').hidden=false;
  $('thanks').tabIndex=-1; $('thanks').focus();
}
function showRejection(record) {
  if(record.correo!==selectedEmail || (current && current.id!==record.id)) return;
  correction=record.id; current=null;
  $('successView').hidden=true; $('formView').hidden=false;
  $('formError').textContent=record.error;
  $('submit').disabled=false;
}
addEventListener('rejected',event=>showRejection(event.detail));
addEventListener('synced',event=>{
  const record=event.detail;
  if(record.id!==current?.id) return;
  $('thanks').textContent=`¡Gracias por su visita, ${record.nombre}!`;
  $('statusText').textContent='Asistencia registrada a las';
  $('registeredTime').textContent=time(record.created_at);
  $('syncNote').textContent='Tu visita se guardó correctamente con el correo de Google seleccionado.';
});
addEventListener('syncerror',event=>{
  const msg=event.detail.status===401 || event.detail.status===403 ? event.detail.message+' Tu registro pendiente se conserva.' : 'No se pudo sincronizar. Tu registro sigue guardado en este dispositivo; vuelve con conexión y la misma cuenta de Google.';
  if(current) $('syncNote').textContent=msg;
  else $('formError').textContent=msg;
});
$('googleLogin').onclick=async()=>{
  $('googleLogin').disabled=true; $('authError').textContent='';
  try { await signInGoogle(); }
  catch(error) { $('authError').textContent=error.message; $('googleLogin').disabled=false; }
};
$('changeAccount').onclick=async()=>{
  $('changeAccount').disabled=true;
  try { await clearGoogle(); signedOut(); await signInGoogle(); }
  catch(error) { $('authError').textContent=error.message; }
  finally { $('changeAccount').disabled=false; }
};
$('visitorForm').onsubmit=event=>{
  event.preventDefault(); $('formError').textContent='';
  const nombre=$('nombre').value.trim().replace(/\s+/g,' ');
  if(!selectedEmail) { $('formError').textContent='Primero selecciona tu cuenta de Google.'; return; }
  if(nombre.length<2 || nombre.length>120) { $('formError').textContent='Escribe tu nombre completo (de 2 a 120 caracteres).'; return; }
  $('submit').disabled=true;
  try {
    const previous=pending().find(record=>record.correo===selectedEmail);
    if(previous) {
      current=previous;
    } else {
      current={id:crypto.randomUUID(),nombre,correo:selectedEmail,hora_cliente:new Date().toISOString()};
      enqueue(current);
      if(correction) { dismissRejected(correction); correction=null; }
    }
  } catch {
    current=null; $('submit').disabled=false;
    $('formError').textContent='No pudimos guardar en este dispositivo. Permite el almacenamiento del navegador e intenta otra vez.'; return;
  }
  showPending();
  sync().catch(()=>{});
};
$('another').onclick=async()=>{
  $('another').disabled=true;
  try {
    await clearGoogle(); current=null; correction=null;
    $('visitorForm').reset(); $('submit').disabled=false;
    $('successView').hidden=true; $('formView').hidden=false;
    signedOut(); $('googleLogin').disabled=false;
    $('googleLogin').focus();
  } catch { $('syncNote').textContent='No se pudo cerrar la sesión local. Intenta nuevamente.'; }
  finally { $('another').disabled=false; }
};
addEventListener('online',connection); addEventListener('offline',connection); connection();
startSync();
(async()=>{
  try {
    const user=await initializeGoogle();
    if(user?.email && user.identities?.some(identity=>identity.provider==='google')) {
      selectedEmail=user.email.trim().toLowerCase();
      $('correo').value=selectedEmail;
      // El nombre se escribe siempre; no usar user_metadata.full_name.
      $('nombre').value=''; $('visitorForm').hidden=false;
      $('accountView').hidden=false; $('googleLogin').hidden=true;
      $('nombre').focus();
      const failed=rejected().find(record=>record.correo===selectedEmail);
      if(failed) showRejection(failed);
      const queued=pending().find(record=>record.correo===selectedEmail);
      if(queued) { current=queued; showPending(); }
      await sync();
    } else signedOut();
  } catch(error) { $('authError').textContent=error.message; }
})();
if('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(()=>{});
