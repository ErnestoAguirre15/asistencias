import { api } from './shared.js';
let client, setup;
export async function authClient() {
  if(client) return client;
  if(setup) return setup;
  setup=(async()=>{
    const config=await api('public-config');
    if(!window.supabase) await new Promise((resolve,reject)=>{
      const script=document.createElement('script');script.src='/vendor/supabase.js';script.onload=resolve;script.onerror=()=>reject(new Error('No se pudo cargar el acceso con Google. Revisa la conexión.'));document.head.append(script);
    });
    client=window.supabase.createClient(config.url,config.key,{auth:{flowType:'pkce',detectSessionInUrl:true,storageKey:'presencia-google-required',autoRefreshToken:true}});
    return client;
  })().finally(()=>{setup=null;});
  return setup;
}
export async function initializeGoogle() {
  // Leer la URL antes de que el SDK la limpie al completar el intercambio PKCE.
  const params=new URLSearchParams(location.search), fragment=new URLSearchParams(location.hash.slice(1));
  if(params.has('error') || fragment.has('error')) {
    history.replaceState(null,'',location.pathname);
    throw new Error('Se canceló el acceso con Google. Pulsa el botón para volver a intentarlo.');
  }
  const auth=await authClient();
  // El SDK 2.45.4 consume automáticamente el código PKCE una sola vez.
  // initialize() espera ese proceso; NO volver a llamar exchangeCodeForSession.
  const {error:initError}=await auth.auth.initialize();
  if(params.has('code')) history.replaceState(null,'',location.pathname);
  if(initError) throw new Error('No se pudo completar Google. Abre el formulario original y selecciona la cuenta otra vez en la misma pestaña.');
  const {data:{session},error:sessionError}=await auth.auth.getSession();
  if(sessionError) throw new Error('No se pudo recuperar tu sesión. Selecciona la cuenta de Google otra vez.');
  if(!session) {
    if(params.has('code')) throw new Error('Falta la sesión que inició este acceso. Vuelve al formulario y selecciona Google desde el mismo navegador.');
    return null;
  }
  const {data,error}=await auth.auth.getUser();
  if(error) throw new Error('No pudimos verificar la cuenta. Selecciona Google nuevamente.');
  return data.user;
}
export async function signInGoogle() {
  const auth=await authClient();
  await auth.auth.signOut({scope:'local'});
  const {error}=await auth.auth.signInWithOAuth({provider:'google',options:{redirectTo:location.origin+'/asistencia',queryParams:{prompt:'select_account'}}});
  if(error) throw new Error('No se pudo iniciar Google. Revisa que el proveedor esté configurado en Supabase.');
}
export async function tokenFor(record) {
  const auth=await authClient();
  const {data,error}=await auth.auth.getSession();
  if(error) throw error;
  if(data.session?.user.email?.toLowerCase()!==record.correo?.toLowerCase()) return null;
  return data.session?.access_token || null;
}
export async function clearGoogle() {
  if(client) {
    const {error}=await client.auth.signOut({scope:'local'});
    if(error) throw error;
  }
}
