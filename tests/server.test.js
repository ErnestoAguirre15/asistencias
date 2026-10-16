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
process.env.SUPABASE_ANON_KEY='sb_publishable_test';
const googleUser={email:'ana@ejemplo.com',email_confirmed_at:'2026-10-15',identities:[{provider:'google',identity_data:{email:'ana@ejemplo.com'}}]};
const userResponse=()=>({ok:true,status:200,json:async()=>googleUser});
const response = () => ({ statusCode:0, headers:{}, setHeader(k,v){ this.headers[k]=v; }, status(n){ this.statusCode=n; return this; }, json(body){ this.body=body; return this; } });
const record={ id:'11223344-1234-4234-8234-123456789abc', nombre:'  Ana   Pérez ', correo:'ANA@EJEMPLO.COM', hora_cliente:'2026-10-15T12:34:56Z' };
test('sessions reject tampering, expiration and missing cookies', () => {
  const token=session(1000), req={headers:{cookie:`presencia_session=${token}`}};
  assert.equal(authorized(req,2000),true);
  assert.equal(authorized(req,1000+8*3600000),false);
  assert.equal(authorized({headers:{cookie:`presencia_session=${token}x`}},2000),false);
  assert.equal(authorized({headers:{}}),false);
});
test('server validates and normalizes public input', () => {
  assert.equal(validateRecord(record).nombre,'Ana Pérez');
  assert.equal(validateRecord(record).correo,'ana@ejemplo.com');
  for(const correo of ['', 'incorrecto', 'a@b', 'a b@ejemplo.com', 'a'.repeat(255)+'@b.com']) assert.equal(validateRecord({...record,correo}),null);
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
  global.fetch=async (url,options) => { if(url.endsWith('/auth/v1/user')) return userResponse(); sent=JSON.parse(options.body); return {ok:true,status:200,json:async()=>({id:record.id,created_at:'2026-10-15T12:35:02Z',ip:'private'})}; };
  try {
    const res=response(); await attendance({method:'POST',headers:{authorization:'Bearer test',host:'example.test',origin:'https://example.test','x-forwarded-for':'1.2.3.4, 5.6.7.8'},body:{...record,ip:'spoofed',created_at:'spoofed'}},res);
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
test('duplicate email returns 409 rather than a success receipt',async()=>{
  const original=global.fetch;
  global.fetch=async(url)=>url.endsWith('/auth/v1/user') ? userResponse() : ({ok:true,status:200,json:async()=>({error:'Este correo ya está registrado.',status:409})});
  try {
    const res=response(); await attendance({method:'POST',headers:{authorization:'Bearer test'},body:record},res);
    assert.equal(res.statusCode,409); assert.equal(res.body.created_at,undefined);
  } finally {global.fetch=original;}
});
test('deletion requires admin session and same origin',async()=>{
  const res=response(); await attendance({method:'DELETE',headers:{},body:{id:record.id}},res); assert.equal(res.statusCode,401);
  const cross=response(); await attendance({method:'DELETE',headers:{cookie:`presencia_session=${session()}`,host:'a.test',origin:'https://b.test'},body:{id:record.id}},cross); assert.equal(cross.statusCode,403);
});
test('authenticated deletion calls only the selected record RPC',async()=>{
  const original=global.fetch; let sent;
  global.fetch=async(url,options)=>{sent={url,body:JSON.parse(options.body)}; return {ok:true,status:200,json:async()=>null};};
  try {
    const res=response(); await attendance({method:'DELETE',headers:{cookie:`presencia_session=${session()}`},body:{id:record.id}},res);
    assert.equal(res.statusCode,200); assert.match(sent.url,/rpc\/eliminar_visita$/); assert.deepEqual(sent.body,{registro_id:record.id});
  } finally {global.fetch=original;}
});
test('registration requires Google even when caller has an admin cookie',async()=>{
  const res=response(); await attendance({method:'POST',headers:{cookie:`presencia_session=${session()}`},body:record},res); assert.equal(res.statusCode,401);
});
test('Google email is verified server-side; forged email and empty name fail',async()=>{
  const original=global.fetch; global.fetch=async()=>userResponse();
  try {
    const forged=response(); await attendance({method:'POST',headers:{authorization:'Bearer test'},body:{...record,correo:'otro@ejemplo.com'}},forged); assert.equal(forged.statusCode,403);
    const empty=response(); await attendance({method:'POST',headers:{authorization:'Bearer test'},body:{...record,nombre:'   '}},empty); assert.equal(empty.statusCode,400);
  } finally {global.fetch=original;}
});
test('invalid token and non-Google identities cannot register',async()=>{
  const original=global.fetch;
  try {
    global.fetch=async()=>({ok:false,status:401});
    const expired=response(); await attendance({method:'POST',headers:{authorization:'Bearer bad'},body:record},expired); assert.equal(expired.statusCode,401);
    global.fetch=async()=>({ok:true,json:async()=>({...googleUser,identities:[{provider:'email'}]})});
    const password=response(); await attendance({method:'POST',headers:{authorization:'Bearer test'},body:record},password); assert.equal(password.statusCode,403);
  } finally {global.fetch=original;}
});

