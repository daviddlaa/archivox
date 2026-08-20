# AGENTS.md

Sistema web full-stack (Express + PostgreSQL/SQLite + HTML/CSS/JS vanilla sin frameworks) para gestión de solicitudes comerciales, campañas por lotes y equipos. Desktop y móvil con detección de dispositivo.

## Comandos

- **Arrancar:** `node app.js` — el entry point es `app.js` (NO existe `index.js`, aunque `package.json` diga `"main": "index.js"`). No hay `npm start`.
- **No hay test/lint/typecheck** (`npm test` solo imprime error). La verificación es `node --check <archivo.js>` + pruebas manuales con `curl` (login → cookie → endpoints).
- **Desarrollo local:** `DATABASE_URL= NODE_ENV=development node app.js` → usa SQLite (`database.db`), no producción.
- **Producción:** `node app.js` con `DATABASE_URL` (PostgreSQL en Render).

### ⚠️ El `.env` del repo apunta a PRODUCCIÓN

`dotenv` se carga siempre (aún si sobreescribes `DATABASE_URL` en el comando). `.env` define `DATABASE_URL` (Postgres de producción) y `NODE_ENV=production`. Implicaciones críticas:

1. Si corres `node app.js` a secas, conectarás a la **Postgres de producción**. Para pruebas locales **siempre** prefija `DATABASE_URL=` (vacío) — y de preferencia `NODE_ENV=development`.
2. Con `NODE_ENV=production`, `express-session` pone `cookie.secure=true` y **no envía la cookie por HTTP**: el login responde 200 pero nunca emite `Set-Cookie`, y toda petición autenticada devuelve 401. Sin `NODE_ENV=development`, no puedes probar nada localmente.
3. Nunca ejecutar scripts destructivos/activación masiva contra la `DATABASE_URL` de producción.

Login: `POST /api/auth/login` con `{username, password}` (rate limit 5/15min por IP).

## Wrapper de BD (`src/config/db.js`) — lee esto antes de escribir SQL

Único módulo de acceso; el código se escribe una vez y corre en ambos motores:

- **SQLite** convierte `$1,$2,…` → `?` posicionales; **Postgres** convierte `?` → `$1,$2,…`. Puedes escribir cualquiera de los dos estilos.
- **Nunca reutilices el mismo placeholder** (`WHERE x=$1 OR y=$1`): funciona en Postgres pero falla en SQLite ("Too few parameter values", porque cada `$N` se convierte a un `?` posicional nuevo). Repite el parámetro con índices separados.
- **El wrapper SQLite TRAGA errores:** SELECT fallido devuelve `{rows:[]}` sin lanzar excepción; writes devuelven `{rows:[], rowCount:0}`. PostgreSQL SÍ lanza. Un bug de SQL puede verse "OK" en SQLite y explotar en producción — prueba siempre contra ambos si el cambio toca SQL.
- `db.query()` siempre devuelve `{rows, rowCount, lastInsertRowid}` en ambos motores.
- Soporta conversión automática de `INTERVAL 'N days/months'`, `TO_CHAR(..., 'YYYY-MM'|'Mon YYYY')` y `COALESCE(x,'literal')`. La búsqueda sin acentos usa `translate()` (registrado en SQLite, nativo en PG).
- El esquema se crea/actualiza solo al arrancar (`initDb` / `initDb.pg`). Los scripts de `migrations/` son manuales/legacy de producción.
- `src/config/cache.js` expone helpers de invalidación (`invalidateDashboard`, `invalidateCatalogosUsuario`, `invalidateAllCampanas`) — úsalos al modificar datos que alimenten dashboards/catálogos.

## Arquitectura y frontend

- **Sin framework frontend:** JS vanilla por página. El mismo módulo existe dos veces: `public/desktop/` y `public/movil/` (HTML/CSS/JS duplicados con lógica casi idéntica). Al tocar un módulo, actualiza **ambas** versiones. Compartido en `public/js/` y `public/css/`.
- **Detección de dispositivo:** `/solicitudes` (desktop) vs `/m/solicitudes` (móvil); `?movil=1` fuerza móvil. Un **SuperAdmin siempre es redirigido a `/admin` o `/m/admin`** y no puede abrir páginas operativas (`/solicitudes`, `/gestiones`, …) — si pruebas con un superadmin verás 302, es comportamiento existente.
- **Modales:** escritorio usa `public/js/modal.js` → `Modal.abrir(html, {ancho: 'wide'|'narrow'})` y `Modal.cerrar()`. Las páginas móviles NO cargan `modal.js`; usan funciones propias por archivo (`crearModalMovil(contenido)` + `cerrarModal()`). No asumas que `Modal` existe en móvil.
- **Auth:** API → `requiresAuth` (401 JSON); páginas → `requireAuthPage` (redirect a login). Roles: `requiresRole`, `requiresPermission`.
- **SSE de notificaciones** en `public/js/notificaciones-dashboard.js` + `src/services/notificationBus.js`; los schedulers se arrancan al final de `app.js`: `recordatorioScheduler` (cada 60s) y `liberacionScheduler` (cada 6h, dedup de alertas por título).

### Convención de CSS del módulo Solicitudes (ver `docs/convencion-css-solicitudes.md`)

- La página carga `desktop|movil/css/solicitudes.css` Y LUEGO el compartido `/css/solicitudes.css` → a igual especificidad **el compartido gana** (causó bugs reales).
- La estructura de tarjeta vive SOLO en el compartido. Los overrides por plataforma deben ganar por **especificidad mayor**, no por `!important` ni por orden. Cambios en el compartido → probar desktop Y móvil.

### Escape de datos en plantillas JS

No hay helper compartido de escape HTML; cada archivo define el suyo (`panelEscapeHtml` en desktop/solicitudes.js, `escaparParaHTMLMovil` en movil/solicitudes.js, `escapeHtml` en equipo.js/dashboard.js). Si interpolas datos del usuario (nombres, cédulas, observaciones) en HTML generado por JS, usa el helper local del archivo.

## Workflow del repo

- **Commits:** todos usan mensaje `Actualización general` (ver `git log` y `commit_push.bat`). Rama `master`. Deploy = `commit_push.bat` (add -A, commit, push). Solo hacer commit si el usuario lo pide.
- **Documentación:** cada feature/fix se registra con `docs/feature-*.md` / `docs/fix-*.md` (prefijos = implementado; `plan-*` = pendiente). Lo pendiente vive en **una sola fuente**: sección 3 de `docs/ESTADO-PROYECTO.md`. Al terminar una función, añade su doc con el mismo patrón.
- **Errores históricos repetidos en este repo:** placeholder reutilizado en SQL (SQLite), olvidar `NODE_ENV=development` al probar local, editar solo una de las dos versiones (desktop/móvil), y CSS en el archivo equivocado del módulo Solicitudes.

## Referencias de documentación

- `docs/ESTADO-PROYECTO.md` — qué está hecho vs pendiente (fuente única).
- `docs/README.md` — documentación completa del sistema (esquema, endpoints).
- `docs/convencion-css-solicitudes.md` — propiedad de los CSS de Solicitudes.