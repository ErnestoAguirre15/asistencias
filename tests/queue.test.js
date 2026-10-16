import test from 'node:test';
import assert from 'node:assert/strict';
global.window=new EventTarget(); window.CONFIG={TIME_ZONE:'America/El_Salvador'};
global.document={querySelectorAll:()=>[]};
Object.defineProperty(global.navigator,'onLine',{value:true,configurable:true});
const storage=new Map();
global.localStorage={get length(){return storage.size;},key:i=>[...storage.keys()][i],getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)};
const {enqueue,pending,sync,migrate,setAuthProvider}=await import('../public/queue.js');
setAuthProvider(async()=> 'test-token');
test('queue persists first, retains failures and removes only acknowledged records',async()=>{
  const record={id:'test-id',nombre:'Ana',hora_cliente:new Date().toISOString()};
  enqueue(record); assert.equal(pending().length,1);
  global.fetch=async()=>{throw new Error('offline');};
  await sync(); assert.equal(pending().length,1);
  global.fetch=async()=>({ok:true,json:async()=>({id:'test-id',created_at:'2026-10-15T00:00:00Z'})});
  let ack; window.addEventListener('synced',e=>ack=e.detail,{once:true});
  await Promise.all([sync(),sync()]);
  assert.equal(pending().length,0); assert.equal(ack.created_at,'2026-10-15T00:00:00Z');
});
test('old pending visits migrate without changing identifiers',()=>{
  localStorage.setItem('asistencias_pendientes',JSON.stringify([{id:'legacy-id',nombre:'Luis',hora_cliente:new Date().toISOString()}]));
  migrate(); assert.equal(pending()[0].id,'legacy-id'); assert.equal(localStorage.getItem('asistencias_pendientes'),null);
});
test('duplicate emails leave retry queue and persist a rejection for correction',async()=>{
  storage.clear();
  enqueue({id:'duplicate-id',nombre:'Ana',correo:'ana@example.com',hora_cliente:new Date().toISOString()});
  let calls=0;
  global.fetch=async()=>{calls++;return {ok:false,status:409,json:async()=>({error:'Este correo ya está registrado.'})};};
  let rejection; window.addEventListener('rejected',event=>rejection=event.detail,{once:true});
  await sync(); await sync();
  assert.equal(pending().length,0); assert.equal(calls,1);
  assert.equal(rejection.correo,'ana@example.com');
  assert.ok(localStorage.getItem('presencia:rejected:duplicate-id'));
});
test('expired Google session preserves pending data for reauthentication',async()=>{
  storage.clear(); enqueue({id:'expired',nombre:'Ana',correo:'ana@example.com',hora_cliente:new Date().toISOString()});
  global.fetch=async()=>({ok:false,status:401,json:async()=>({error:'Sesión terminada'})});
  await sync(); assert.equal(pending().length,1); assert.equal(storage.has('presencia:rejected:expired'),false);
});
test('a different Google account cannot send another visitors pending record',async()=>{
  setAuthProvider(async()=>null); let calls=0; global.fetch=async()=>{calls++;};
  await sync(); assert.equal(calls,0); assert.equal(pending().length,1);
});
