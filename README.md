# Observatorio de plenos municipales · Viladecans (PWA)

## Qué incluye
- Tu interfaz original adaptada para leer y guardar los datos en Supabase.
- PWA instalable (manifest, service worker e iconos).
- Consulta pública de sesiones, votaciones, partidos y consistorio.
- Edición restringida a cuentas incluidas en `observatorio_admins`.
- Sincronización en tiempo real cuando se publica una modificación.
- Importación/exportación JSON y alta manual de sesiones/votaciones/grupos, como en el HTML original.

## 1. Configurar Supabase
1. Abre el proyecto `https://rvwdvmfghjafxpyyleqv.supabase.co`.
2. Entra en **SQL Editor → New query**, pega todo `supabase-schema.sql` y pulsa **Run**.
3. En **Project Settings → API** (o **Data API / API Keys**, según la interfaz), copia la clave pública **anon** o **publishable**. Nunca uses `service_role` ni una secret key en el navegador.
4. Edita `js/config.js` y sustituye `PEGA_AQUI_TU_CLAVE_PUBLICA_ANON_O_PUBLISHABLE` por esa clave.
5. En **Authentication → Users**, crea tu usuario administrador con tu correo y una contraseña segura. Desactiva el registro público si aparece habilitado; el administrador se crea desde el panel de Supabase.
6. Copia el UUID de ese usuario y ejecuta en SQL Editor (sustituye el UUID):

```sql
insert into public.observatorio_admins (user_id)
values ('PEGA_AQUI_EL_UUID_DE_TU_USUARIO');
```

## 2. Subirlo a GitHub
Sube el contenido de esta carpeta a la raíz de `joelfr2003/observatorio-plenos-viladecans` (debe quedar `index.html` en la raíz, no dentro de otra carpeta). Puedes hacerlo con **Add file → Upload files** o reemplazando los archivos desde GitHub.

## 3. Activar GitHub Pages
En el repositorio: **Settings → Pages → Build and deployment**. Selecciona **Deploy from a branch**, rama `main` y carpeta `/ (root)`. Guarda. Espera a que termine el despliegue en **Actions**.

La URL habitual será `https://joelfr2003.github.io/observatorio-plenos-viladecans/`.

## 4. Instalar en el móvil
Abre la URL publicada desde Chrome/Edge en Android y elige **Instalar aplicación** o **Añadir a pantalla de inicio**. En iPhone, abre en Safari → Compartir → Añadir a pantalla de inicio. La primera visita requiere conexión. Los datos del observatorio se sincronizan desde Supabase; el service worker cachea la interfaz, no las respuestas de la base de datos.

## Seguridad
- La clave anon/publishable está pensada para estar en el cliente; RLS es lo que protege los datos.
- No publiques jamás `service_role`, secret keys ni contraseñas.
- El acceso de escritura depende de `observatorio_admins`; no basta con iniciar sesión.
- Si quieres dar de alta a otro administrador, crea su usuario en Supabase Auth e inserta su UUID en `observatorio_admins`.

## Limitación de esta primera versión
La aplicación conserva el flujo actual: crear la sesión, añadir el enlace al acta y registrar manualmente cada votación y el voto por grupo. Todavía no extrae automáticamente las votaciones de un PDF ni almacena los PDF en Supabase Storage.

## Novedades v6: usuarios y accesos
1. Ejecuta `supabase-schema-v2.sql` en el SQL Editor (después del esquema original).
2. Sube `index.html` y `sw.js` a GitHub (sustituyen a los anteriores).
3. En **Authentication → Providers → Email** decide si exiges confirmar el correo (recomendado) o la desactivas para que el alta sea inmediata.
4. Para ver los datos hay que registrarse. Solo las cuentas de `observatorio_admins` pueden editar; el resto es solo lectura.
5. El administrador ve en **Mi cuenta → Usuarios** quién está conectado, cuándo entró por última vez y su última actividad.
