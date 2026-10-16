export function publicAuthConfig() {
  const url=process.env.SUPABASE_URL, key=process.env.SUPABASE_ANON_KEY || '';
  let allowed=key.startsWith('sb_publishable_');
  try { allowed ||= JSON.parse(Buffer.from(key.split('.')[1],'base64url').toString()).role==='anon'; } catch {}
  if(!url || !allowed) throw Object.assign(new Error('Falta configurar SUPABASE_ANON_KEY con la clave pública de Supabase en Vercel.'),{status:503});
  return {url,key};
}
export async function verifyGoogleVisitor(req) {
  const header=req.headers.authorization || '';
  if(!/^Bearer \S+$/.test(header)) throw Object.assign(new Error('Selecciona tu cuenta de Google para registrar la visita.'),{status:401});
  const {url,key}=publicAuthConfig();
  const response=await fetch(`${url}/auth/v1/user`,{headers:{apikey:key,Authorization:header},signal:AbortSignal.timeout(12000)});
  if(!response.ok) throw Object.assign(new Error(response.status===401 || response.status===403 ? 'Tu sesión de Google terminó. Vuelve a seleccionar la cuenta.' : 'No pudimos verificar Google. Intenta nuevamente.'),{status:response.status===401 || response.status===403 ? 401 : 503});
  const user=await response.json();
  const google=user.identities?.find(identity=>identity.provider==='google');
  const correo=google?.identity_data?.email?.trim().toLowerCase();
  if(!correo || !user.email_confirmed_at || correo!==user.email?.trim().toLowerCase()) throw Object.assign(new Error('Debes usar una cuenta de Google con correo confirmado.'),{status:403});
  return {correo};
}
