# Presencia · Registro de visitantes

Versión mejorada, independiente de los archivos originales. HTML, Tailwind CSS compilado, JavaScript vanilla, funciones de Vercel y Supabase. Iconos SVG sin emojis. No hay que instalar una aplicación para registrar visitas o usar el panel.

## Publicar en Vercel

1. Crea un proyecto gratuito en [Supabase](https://supabase.com). Abre **SQL Editor**, pega el contenido de `supabase.sql` y ejecútalo. También admite la tabla original: conserva los registros y cierra la lectura pública anterior. Haz una copia de seguridad si ya contiene información importante.
2. Sube **el contenido de esta carpeta** a un repositorio privado de GitHub. No subas `node_modules` ni archivos `.env` con secretos.
3. En [Vercel](https://vercel.com/new), importa ese repositorio. Selecciona **Other** como framework. Si subes esta carpeta dentro de otro repositorio, selecciónala como **Root Directory**. `vercel.json` configura la compilación y el directorio `public` automáticamente.
4. En **Settings → Environment Variables**, agrega:

| Variable | Valor |
| --- | --- |
| `SUPABASE_URL` | URL de tu proyecto Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Clave secreta `service_role` de Supabase, disponible en API Keys / Legacy API Keys |
| `SESSION_SECRET` | Secreto aleatorio de al menos 32 caracteres, único para este sistema |
| `ADMIN_USER` | `admin` |
| `ADMIN_PASSWORD` | `1234` para la validación provisional solicitada |

5. Despliega. Si modificas variables después, haz un **Redeploy**.
6. Abre `https://tu-proyecto.vercel.app/asistencia` y registra una visita. En `/admin`, entra con `admin` / `1234`. Verifica que aparezca y descarga el QR desde ese dominio definitivo.

El login solicitado es provisional: cambia `ADMIN_PASSWORD` antes de compartir el sistema fuera de las pruebas. Las credenciales se verifican en el servidor; la sesión expira en 8 horas, usa cookie HttpOnly y hay un límite de 10 intentos por IP cada 15 minutos. Nunca pongas la clave `service_role` en `public/config.js`.

## Comportamiento

- **Un campo público:** nombre completo. Primero se persiste una visita con UUID en localStorage; después se envía al servidor.
- **Hora exacta:** la base de datos asigna `clock_timestamp()` y Vercel obtiene la IP de la petición. No se confía en la hora o IP aportada por el visitante. Se conserva por separado la hora del dispositivo para auditoría.
- **Sin conexión:** muestra “Pendiente de sincronizar”; no presenta la hora local como confirmación del servidor. Reintenta al volver internet, al abrir o volver a la página y cada 15 segundos mientras permanece abierta. Los reintentos de una UUID no duplican visitas ni cambian su hora original del servidor.
- **Página disponible sin conexión:** después de una primera carga correcta con internet, un service worker conserva el formulario y sus recursos. No se puede abrir por primera vez sin conexión. Si cierras la página antes de sincronizar, debes abrirla otra vez con internet. Borrar los datos del navegador elimina los pendientes.
- **Panel:** consulta automática cada 5 segundos mientras está visible; es actualización casi en tiempo real mediante consultas, no una suscripción WebSocket. Carga todos los registros por lotes de 1.000, con páginas de 20 en pantalla. Si falla una consulta, mantiene la última vista y muestra un aviso.
- **Pendientes:** el panel solo puede ver pendientes del mismo navegador y origen. Ningún servidor puede ver un registro que todavía no ha salido del dispositivo de otro visitante.
- **Fechas:** se muestran en `America/El_Salvador`; puedes cambiarlo en `public/config.js` (también ajusta el texto de zona horaria del panel).
- **CSV para Excel:** exporta todos los resultados filtrados, no solo la página visible; incluye IP, fecha/hora, estado y marcas ISO. UTF-8 con BOM para acentos y neutralización de fórmulas. Si Excel no separa columnas automáticamente, usa Datos → Desde texto/CSV y elige coma.
- **QR:** se genera localmente, incluye margen blanco y descarga PNG. Apunta al origen actual seguido de `/asistencia`; no se envía a servicios externos.
- **Privacidad:** los visitantes no pueden listar nombres ni IP; solo reciben el identificador y la hora del registro que enviaron. La API de consulta requiere sesión.
- **Migración local:** recupera `asistencias_pendientes` de la versión anterior si se abre en el mismo dominio y navegador. No puede recuperar almacenamiento de otro dominio.

## Archivos

- `public/`: páginas, estilos y lógica del navegador. `tailwind.css` ya está compilado para previsualización; Vercel lo recompila.
- `api/`: registro/consulta y sesión, ejecutados exclusivamente en Vercel.
- `lib/server.js`: acceso a Supabase, validación y sesiones.
- `supabase.sql`: tablas, permisos y funciones idempotentes.
- `tests/server.test.js`: pruebas de validación, sesión, API y exportación.

## Verificación técnica opcional

Con Node.js: `npm ci`, `npm test` y `npm run build`. El usuario final no instala nada. Para probar también las funciones localmente, usa el entorno de desarrollo de Vercel con las variables anteriores. Abrir los HTML por doble clic no ejecuta las funciones ni equivale a un despliegue.

La compilación y las pruebas aisladas no sustituyen una prueba contra tu proyecto real. Los archivos originales solo tenían valores de ejemplo de Supabase; hay que completar las variables y ejecutar SQL para conectar la base.

El historial es de solo inserción desde esta aplicación. Para un evento público con alto tráfico, ajusta límites/retención y revisa las cuotas gratuitas vigentes de Vercel y Supabase.

## Referencias y licencia de terceros

- [Vercel: variables de entorno](https://vercel.com/docs/environment-variables)
- [Vercel: cabeceras de solicitudes e IP](https://vercel.com/docs/headers/request-headers)
- [Supabase: seguridad por filas](https://supabase.com/docs/guides/database/postgres/row-level-security)
- Generador de QR: `qrcode-generator` 1.4.4, Kazuhiko Arase (MIT), licencia incluida en la cabecera de `public/vendor/qrcode.js`.
