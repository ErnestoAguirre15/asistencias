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
    client=window.supabase.createClient(config.url,config.key,{auth:{flowType:'pkce',detectSessionInUrl:false,storageKey:'presencia-google-required',autoRefreshToken:true}});
    return client;
  })().finally(()=>{setup=null;});
  return setup;
}
export async function initializeGoogle() {
  const auth=await authClient();
  const params=new URLSearchParams(location.search), fragment=new URLSearchParams(location.hash.slice(1));
  if(params.has('error') || fragment.has('error')) {
    history.replaceState(null,'',location.pathname);
    throw new Error('Se canceló el acceso con Google. Pulsa el botón para volver a intentarlo.');
  }
  if(params.has('code')) {
    const {error}=await auth.auth.exchangeCodeForSession(params.get('code'));
    history.replaceState(null,'',location.pathname);
    if(error) throw new Error('El acceso de Google venció o no pudo completarse. Selecciona tu cuenta otra vez.');
  }
  const {data:{session}}=await auth.auth.getSession();
  if(!session) return null;
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
