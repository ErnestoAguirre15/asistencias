import test from 'node:test';
import assert from 'node:assert/strict';
global.window=new EventTarget(); window.CONFIG={TIME_ZONE:'America/El_Salvador'};
global.document={querySelectorAll:()=>[]};
Object.defineProperty(global.navigator,'onLine',{value:true,configurable:true});
const storage=new Map();
global.localStorage={get length(){return storage.size;},key:i=>[...storage.keys()][i],getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)};
const {enqueue,pending,sync,migrate}=await import('../public/queue.js');
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
