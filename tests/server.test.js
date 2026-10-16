import test from 'node:test';
import assert from 'node:assert/strict';
import { authorized, session, validateRecord } from '../lib/server.js';
import attendance from '../api/attendance.js';
import login from '../api/session.js';
import { csvCell } from '../public/csv.js';

process.env.SESSION_SECRET='test-only-secret-with-at-least-32-characters';
process.env.SUPABASE_URL='https://example.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY='test-key';
process.env.ADMIN_PASSWORD='1234';
const response = () => ({ statusCode:0, headers:{}, setHeader(k,v){ this.headers[k]=v; }, status(n){ this.statusCode=n; return this; }, json(body){ this.body=body; return this; } });
const record={ id:'11223344-1234-4234-8234-123456789abc', nombre:'  Ana   Pérez ', hora_cliente:'2026-10-15T12:34:56Z' };
test('sessions reject tampering, expiration and missing cookies', () => {
  const token=session(1000), req={headers:{cookie:`presencia_session=${token}`}};
  assert.equal(authorized(req,2000),true);
  assert.equal(authorized(req,1000+8*3600000),false);
  assert.equal(authorized({headers:{cookie:`presencia_session=${token}x`}},2000),false);
  assert.equal(authorized({headers:{}}),false);
});
test('server validates and normalizes public input', () => {
  assert.equal(validateRecord(record).nombre,'Ana Pérez');
  for(const invalid of [{...record,id:'bad'}, {...record,nombre:' '}, {...record,nombre:'a'.repeat(121)}, {...record,hora_cliente:'invalid'}]) assert.equal(validateRecord(invalid),null);
});
test('CSV neutralizes formulas and quotes embedded separators', () => {
  assert.equal(csvCell('=HYPERLINK("x")'),'"\'=HYPERLINK(""x"")"');
  assert.equal(csvCell('Ana, Pérez'),'"Ana, Pérez"');
  assert.equal(csvCell('  +1'),'"\'  +1"');
});
test('API denies anonymous reads before accessing Supabase', async () => {
  const res=response(); await attendance({method:'GET',headers:{}},res);
  assert.equal(res.statusCode,401);
});
test('registration uses trusted request IP and returns only receipt', async () => {
  const original=global.fetch; let sent;
  global.fetch=async (url,options) => { sent=JSON.parse(options.body); return {ok:true,status:200,json:async()=>({id:record.id,created_at:'2026-10-15T12:35:02Z',ip:'private'})}; };
  try {
    const res=response(); await attendance({method:'POST',headers:{host:'example.test',origin:'https://example.test','x-forwarded-for':'1.2.3.4, 5.6.7.8'},body:{...record,ip:'spoofed',created_at:'spoofed'}},res);
    assert.equal(res.statusCode,200); assert.equal(sent.direccion_ip,'1.2.3.4');
    assert.equal(res.body.created_at,'2026-10-15T12:35:02Z'); assert.equal(res.body.ip,undefined);
    assert.equal(sent.hora_local,'2026-10-15T12:34:56.000Z');
  } finally {global.fetch=original;}
});
test('login validates server-side and sets HttpOnly cookie', async () => {
  const original=global.fetch;
  global.fetch=async()=>({ok:true,status:200,json:async()=>true});
  try {
    const bad=response(); await login({method:'POST',headers:{},body:{username:'admin',password:'bad'}},bad); assert.equal(bad.statusCode,401);
    const good=response(); await login({method:'POST',headers:{},body:{username:'admin',password:'1234'}},good);
    assert.equal(good.statusCode,200); assert.match(good.headers['Set-Cookie'],/HttpOnly/);
    assert.equal(authorized({headers:{cookie:good.headers['Set-Cookie']}}),true);
  } finally {global.fetch=original;}
});
test('API rejects cross-origin writes',async()=>{
  const res=response(); await attendance({method:'POST',headers:{host:'a.test',origin:'https://b.test'},body:record},res); assert.equal(res.statusCode,403);
});
