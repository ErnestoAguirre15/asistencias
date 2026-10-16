import { $, api, date, day, download, escapeHTML as esc, time } from './shared.js';
import { pending, startSync } from './queue.js';
import { csvCell } from './csv.js';
let records = new Map(), cursor = '0', page = 0, active = false, loading = false, loaded = false, generation = 0;
const PAGE_SIZE = 20;
const normalized = s => s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
function localRecords() {
  try { return pending().filter(r => !records.has(r.id)); }
  catch { $('loadError').hidden=false; $('loadError').textContent='No se pudo leer el almacenamiento local. Los datos del servidor siguen disponibles.'; return []; }
}
function all() {
  return [...records.values()].map(r => ({ ...r, fecha:r.created_at, estado:'Sincronizado' }))
    .concat(localRecords().map(r => ({ ...r, fecha:r.hora_cliente, estado:'Pendiente' })))
    .sort((a,b) => b.fecha.localeCompare(a.fecha));
}
function filtered() {
  const q = normalized($('search').value.trim()), d = $('filterDate').value;
  return all().filter(r => (!q || normalized(r.nombre).includes(q)) && (!d || day(r.fecha) === d));
}
function render() {
  const list = filtered(), today = day(new Date());
  page = Math.min(page, Math.max(0,Math.ceil(list.length/PAGE_SIZE)-1));
  $('todayCount').textContent = all().filter(r => day(r.fecha) === today).length;
  $('totalCount').textContent = records.size;
  $('pendingCount').textContent = localRecords().length;
  $('rows').innerHTML = list.slice(page*PAGE_SIZE,(page+1)*PAGE_SIZE).map(r => {
    const initials = r.nombre.trim().split(/\s+/).slice(0,2).map(s => s[0]).join('').toUpperCase();
    return `<tr><td><div class="person"><span class="avatar" aria-hidden="true">${esc(initials)}</span><span>${esc(r.nombre)}</span></div></td><td>${esc(date(r.fecha))}</td><td>${esc(time(r.fecha))}${r.estado === 'Pendiente' ? ' <small class="muted">(local)</small>' : ''}</td><td><span class="badge ${r.estado === 'Pendiente' ? 'pending' : ''}">${r.estado}</span></td></tr>`;
  }).join('');
  $('empty').hidden = list.length > 0;
  $('emptyText').textContent = !loaded ? 'Cargando las visitas…' : ($('search').value || $('filterDate').value ? 'No encontramos visitas con estos filtros.' : 'Todavía no hay visitas. Comparte el QR para comenzar.');
  $('resultCount').textContent = list.length ? `${page*PAGE_SIZE+1}–${Math.min((page+1)*PAGE_SIZE,list.length)} de ${list.length} registros` : '0 registros';
  $('previous').disabled = page === 0;
  $('next').disabled = (page+1)*PAGE_SIZE >= list.length;
  $('exportCSV').disabled = !loaded || loading || list.length === 0;
}
function showLogin() {
  generation++; active=false; records.clear(); cursor='0'; loaded=false;
  $('rows').replaceChildren(); $('panelView').hidden=true; $('loginView').hidden=false;
}
async function load() {
  if (!active || loading || document.hidden) return;
  loading=true;
  $('exportCSV').disabled=true;
  const run = generation;
  try {
    let more, nextCursor='0';
    const snapshot=new Map();
    do {
      const data = await api(`attendance?cursor=${encodeURIComponent(nextCursor)}`);
      if (run !== generation || !active) return;
      data.rows.forEach(r => snapshot.set(r.id,r)); nextCursor=data.next; more=data.more;
    } while (more);
    records=snapshot;
    loaded=true; $('loadError').hidden=true;
    $('liveStatus').textContent=`Actualizado ${time(new Date())}`; $('liveStatus').classList.remove('pending');
  } catch (error) {
    if (run !== generation) return;
    if (error.status === 401) { showLogin(); $('loginError').textContent='Tu sesión terminó. Ingresa nuevamente.'; return; }
    $('loadError').hidden=false; $('loadError').textContent=`${error.message} Reintentaremos automáticamente.`;
    $('liveStatus').textContent='Sin actualizar'; $('liveStatus').classList.add('pending');
  } finally { loading=false; if (active) render(); }
}
function enter() { active=true; $('loginView').hidden=true; $('panelView').hidden=false; $('password').value=''; load(); }
$('loginForm').onsubmit = async e => {
  e.preventDefault(); $('loginButton').disabled=true; $('loginError').textContent='';
  try { await api('session', { method:'POST', body:JSON.stringify({ username:$('username').value.trim(), password:$('password').value }) }); enter(); }
  catch (error) { $('loginError').textContent=error.message; }
  finally { $('loginButton').disabled=false; }
};
async function logout() {
  try { await api('session',{ method:'DELETE' }); showLogin(); }
  catch { $('loadError').hidden=false; $('loadError').textContent='No se pudo cerrar la sesión. Comprueba la conexión y vuelve a intentarlo.'; }
}
$('logout').onclick=logout; $('mobileLogout').onclick=logout;
['search','filterDate'].forEach(id => $(id).addEventListener('input', () => { page=0; render(); }));
$('clearFilters').onclick = () => { $('search').value=''; $('filterDate').value=''; page=0; render(); };
$('previous').onclick = () => { page--; render(); }; $('next').onclick = () => { page++; render(); };
$('exportCSV').onclick = () => {
  const rows = [['Nombre','Fecha','Hora','Estado','IP','Hora local original (ISO)','Hora servidor (ISO)'],...filtered().map(r => [r.nombre,day(r.fecha),time(r.fecha),r.estado,r.ip || '',r.hora_cliente,r.created_at || ''])];
  download(new Blob(['\uFEFF'+rows.map(row => row.map(csvCell).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'}),`visitas_${day(new Date())}.csv`);
};
function openQR() {
  const url = `${location.origin}/asistencia`;
  $('qrUrl').textContent=url; $('qrError').textContent=''; $('downloadQR').disabled=true;
  $('qrDialog').showModal();
  try {
    const qr=qrcode(0,'M'); qr.addData(url); qr.make();
    const canvas=$('qrCanvas'), ctx=canvas.getContext('2d'), count=qr.getModuleCount(), margin=4, scale=Math.floor(512/(count+margin*2));
    canvas.width=canvas.height=(count+margin*2)*scale;
    ctx.fillStyle='#ffffff'; ctx.fillRect(0,0,canvas.width,canvas.height); ctx.fillStyle='#172f36';
    for(let y=0;y<count;y++) for(let x=0;x<count;x++) if(qr.isDark(y,x)) ctx.fillRect((x+margin)*scale,(y+margin)*scale,scale,scale);
    $('downloadQR').disabled=false;
  } catch { $('qrError').textContent='No se pudo generar el QR. Recarga la página e intenta nuevamente.'; }
}
$('showQR').onclick=openQR; $('sidebarQR').onclick=openQR;
$('closeQR').onclick=() => $('qrDialog').close();
$('downloadQR').onclick=() => $('qrCanvas').toBlob(blob => { if(blob) download(blob,'presencia-qr.png'); });
$('todayLabel').textContent=date(new Date());
addEventListener('queuechange',() => { if(active) render(); });
addEventListener('synced',() => load());
addEventListener('storage',() => { if(active) render(); });
addEventListener('online',load);
document.addEventListener('visibilitychange',load);
setInterval(load,window.CONFIG.POLL_MS);
startSync();
api('session').then(enter).catch(() => {});
