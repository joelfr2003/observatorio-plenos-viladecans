# Observatorio de plenos municipales · Viladecans (PWA) · v7

Aplicación web instalable (PWA) para seguir y analizar las votaciones del pleno de Viladecans.
Datos en Supabase, publicación en GitHub Pages.

## Estructura del repositorio
```
index.html                      aplicación principal
manifest.webmanifest, sw.js     PWA (el service worker es v11)
icons/                          icon.svg, icon-192.png, icon-512.png
js/config.js                    URL y clave pública de Supabase
js/analisis.js                  pestaña «Análisis» y noticias
js/estudio2.js                  NUEVO v7: pestaña «Estudio» profesional
supabase-schema-v3.sql          NUEVO v7: esquema completo (úsalo en lugar de los anteriores)
.github/workflows/pages.yml     despliegue automático en GitHub Pages
```

## Novedades v7
**Estudio profesional** (pestaña *Estudio*), con filtros de legislatura y tipo:
- **Panorama:** consenso, aprobación, polarización, tendencia con contraste estadístico, cohesión y peso decisivo por grupo.
- **Mi grupo:** informe estratégico de un grupo (rol, peso real, derrotas, votaciones decisivas, resultados por tema, aliados y rivales, mociones propias, aritmética de escaños y grupos bisagra). Se puede imprimir o guardar en PDF.
- **Gobierno y oposición:** derrotas del gobierno, mociones de la oposición que prosperan (con o sin apoyo del gobierno), mayoría absoluta y qué grupos harían falta.
- **Mociones:** éxito por grupo, ranking por apoyo/oposición, buscador.
- **Temas:** qué temas salen adelante y cuáles no; el administrador puede corregir el tema de cada punto.
- **Bloques:** clustering jerárquico y matriz de afinidad calculada solo sobre votaciones **no unánimes**.
- **Calidad de datos:** detecta resultados incoherentes, recuentos que no cuadran, puntos duplicados, grupos mal escritos, fechas fuera de legislatura… con botón para editar.
- **Metodología y exportación:** definiciones, limitaciones, cita APA y CSV/JSON para replicar en R, Python, SPSS o Excel.
- Rigor: intervalos de confianza de Wilson (95 %) en todos los porcentajes, aviso ⚠ con muestras pequeñas y valor *p* en las tendencias.
- Por defecto se analizan solo los **plenos municipales** (las juntas de VIQUAL/VIMED/VIGEM se excluyen; hay un selector).

**Importación de actas:** al elegir (o arrastrar) los PDF se analizan automáticamente.

**Base de datos (v3):** historial automático de versiones (últimas 100), función de restauración, bucket privado `actas` con permisos, realtime y validación de forma.

## Puesta en marcha (una sola vez)
1. **Supabase → SQL Editor → New query:** pega todo `supabase-schema-v3.sql` y pulsa **Run**. Es idempotente: puedes ejecutarlo aunque ya tengas el esquema anterior.
2. Comprueba que tu usuario sigue en `observatorio_admins` (si no: `insert into public.observatorio_admins (user_id) values ('TU-UUID');`).
3. **GitHub:** sube todo el contenido de esta carpeta a la raíz de `joelfr2003/observatorio-plenos-viladecans` (incluida la carpeta oculta `.github`). Con *Add file → Upload files* los archivos ocultos a veces no se suben: si pasa, crea a mano `.github/workflows/pages.yml` con el contenido incluido.
4. **Settings → Pages:** *Deploy from a branch* → `main` → `/ (root)`.
5. Abre la web y recarga con Ctrl+F5 una vez (el service worker se actualiza a v11).
6. Entra como administrador → **Estudio → Calidad de datos** y revisa lo que marque.
7. En **Estudio → Gobierno y oposición** marca qué grupos gobiernan en cada legislatura (activa los análisis de poder).

## Restaurar una versión anterior de los datos
```sql
select id, guardado_at, n_sesiones, n_votaciones from public.observatorio_historial order by id desc;
select public.restaurar_version_obs(<id>);
```

## Seguridad
- La clave publishable de `js/config.js` está pensada para el cliente; lo que protege los datos es RLS.
- Nunca publiques `service_role` ni contraseñas.
- Lectura: cuentas registradas. Escritura: solo `observatorio_admins`.

## Uso en el TFG
- **Estudio → Metodología** contiene definiciones, limitaciones y la cita APA.
- Exporta los CSV (una fila por votación; una fila por votación y grupo; indicadores por grupo) con el filtro que quieras y replica los cálculos.
- Declara en el trabajo que los temas son automáticos, que los datos se transcriben de las actas y que el análisis es descriptivo.

## Limitaciones conocidas
- El lector de PDF está ajustado al formato de las actas de Viladecans (catalán, «ACORD NÚM.») y no hace OCR de PDF escaneados. Revisa siempre la vista previa antes de guardar.
- Los datos viven en una única fila JSON; el historial protege frente a pisadas, pero dos administradores guardando a la vez se sobrescriben.
