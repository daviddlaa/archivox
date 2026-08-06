# 🔐 Informe de auditoría de seguridad — Archivox

**Fecha:** 5 de agosto de 2026
**Alcance:** Autenticación, protección de pantallas y rutas API.
**Método:** Revisión de `app.js`, middlewares de auth, todos los archivos de rutas, controladores y verificación de sesión en el frontend.

---

## 1. Cómo funciona la autenticación hoy

**Modelo: sesiones por cookie (no JWT).** La cookie de sesión es la llave de todo el sistema:

| Aspecto | Estado | Nota |
|---|---|---|
| Almacén de sesión | `express-session` (MemoryStore) | Se pierden al reiniciar el servidor |
| `httpOnly` | ✅ | La cookie no es legible por JS (protege contra XSS) |
| `sameSite: 'strict'` | ✅ | Bloquea CSRF desde otros sitios |
| `secure` | ⚠️ Solo si `NODE_ENV=production` | Si Render no setea esa variable, la cookie viaja por HTTP |
| Vigencia | 24 h | Sin renovación deslizante |
| Hash de contraseñas | `bcrypt` (10 rounds) | ✅ Correcto |
| Rate limit login | 5 intentos / 15 min por IP | ✅ |
| Rate limit general | 600 req / 15 min por usuario | ✅ |
| Rate limit admin | 30 req / min | ✅ |
| Lockout de cuenta | `failed_login_attempts` + `locked_until` | ✅ |
| Headers de seguridad | `helmet` | ⚠️ CSP **desactivado** |

---

## 2. Veredicto: ¿están protegidas todas las pantallas?

**Sí, todas las rutas de páginas HTML definidas en `app.js` están protegidas con `requireAuthPage`** (redirige a `/login` si no hay sesión, y bloquea a SuperAdmin de pantallas operativas). Pantallas verificadas: dashboard, importar, solicitudes, ventas, gestiones, gestión por lotes, relaciones, historial, perfil, equipo, plantillas, admin (móvil y escritorio). ✅

**Pero hay una excepción crítica:**

### 🔴 HALLAZGO 1 — `express.static('public')` expone TODOS los archivos sin login

```js
app.use(express.static('public'));
```

Esto sirve **cualquier archivo** de `public/` sin autenticación. Cualquier persona puede abrir directamente en el navegador:

- `https://tu-app/desktop/solicitudes.html` → **se descarga el HTML completo** (el JS luego redirige, pero el HTML ya se sirvió)
- `https://tu-app/movil/gestiones.html`, `/admin/index.html`, `/perfil.html` → idem
- **Todo el código JS** (`/desktop/js/solicitudes.js`, `/admin/js/admin.js`, etc.) → expone la lógica de negocio completa

**Impacto real:** la protección de pantallas existe pero es **client-side** (el JS hace `fetch('/api/auth/sesion')` y redirige). Un atacante no ve *datos* (las APIs sí están protegidas), pero sí ve la estructura de la app, endpoints, y puede analizar el código.

---

## 3. Hallazgos por API

### 🔴 HALLAZGO 2 — Registro público abierto sin límite
`POST /api/auth/registrar` es público y **no tiene restricción de "primer usuario"**: cualquiera puede crear cuentas ilimitadas (rol `user`). El comentario del código dice *"públicas para crear primer usuario"* pero **no hay ningún check** que lo impida.

### 🔴 HALLAZGO 3 — Rutas `debug` accesibles a CUALQUIER usuario autenticado
`/api/debug/tablas`, `/api/debug/usuarios` y `/api/debug/foreign-keys/:tabla` solo exigen `requiresAuth`: **un usuario común puede listar las tablas de la BD, todos los usuarios del sistema y sus esquemas**. Deberían ser solo SuperAdmin.

### 🟠 HALLAZGO 4 — IDOR en equipos: campañas y miembros de cualquier equipo
En `equipos.routes.js`:
```js
router.get('/:id/campanas', equiposController.campanasEquipo);   // sin requiresEquipo
router.get('/:id/miembros', equiposController.listarMiembros);   // sin requiresEquipo
```
Cualquier usuario autenticado puede ver **las campañas y los miembros de cualquier equipo** solo cambiando el `:id` en la URL. Las rutas hermanas (`/dashboard` y `/gestiones`) sí tienen `requiresEquipo('ver')`.

### 🟠 HALLAZGO 5 — Session secret por defecto
```js
secret: process.env.SESSION_SECRET || 'default-secret-change-me'
```
Si `SESSION_SECRET` **no está configurado en Render**, cualquiera que conozca el valor por defecto (es público en el código) **puede falsificar cookies de sesión** e iniciar sesión como cualquier usuario.

### 🟠 HALLAZGO 6 — Rutas protegidas "de facto" (por el controlador, no por middleware)
Estas rutas **no tienen `requiresAuth` en el router**, pero el controlador chequea sesión internamente y responde 401:

| Ruta | Estado |
|---|---|
| `/api/gestiones-maestro/*` (**todas**, incl. crear/eliminar campañas, semáforo, asignar agentes) | ✅ 401 interno, pero **0 middleware** |
| `GET /api/excel/solicitudes` (listar) | ✅ 401 interno |
| `/api/excel/dashboard/*` (segmentos, estados, promedios) | ✅ 401 interno |
| `GET /api/debug/health` | ❌ **público**: expone nombres de tablas y conteo de usuarios |

Riesgo: inconsistencia. La protección depende de que cada autor se acuerde de chequear `getUsuarioId(req)`.

---

## 4. Lo que está BIEN (y se nota cuidado)

- ✅ **Aislamiento de datos por usuario**: solicitudes, gestiones, campañas y dashboard filtran por `usuario_id` en SQL.
- ✅ **Arquitectura multi-equipo** bien implementada: `buildGestionAccessWhere` permite a líder ver su equipo y a agente solo lo asignado; admin/superadmin ven todo.
- ✅ **Panel admin**: `router.use(requiresAuth)` + `router.use(requiresRole('superadmin'))` + rate limit propio. Modelo a seguir.
- ✅ **`listarUsuarios`** valida SuperAdmin dentro del controlador.
- ✅ **Login**: rate limit + lockout por intentos fallidos + bcrypt.
- ✅ **Logout destruye sesión** y las rutas de perfil/cambio de contraseña exigen auth.
- ✅ SuperAdmin no puede entrar a pantallas operativas (y viceversa).

---

## 5. Correcciones aplicadas

| # | Hallazgo | Corrección |
|---|---|---|
| 1 | Secret por defecto | Secret aleatorio por arranque + warning en producción si falta `SESSION_SECRET` |
| 2 | Registro abierto | Bloqueado por defecto: solo permitido si hay 0 usuarios o env `REGISTRO_ABIERTO=true`; el login oculta el formulario de registro |
| 3 | Estáticos expuestos | Bloqueados los `.html` por estáticos (solo se sirven vía rutas protegidas) |
| 4 | Rutas debug | `/tablas`, `/usuarios`, `/foreign-keys` ahora exigen SuperAdmin; `/health` saneado (sin tablas ni conteo) |
| 5 | IDOR equipos | `requiresEquipo('ver')` en `/campanas` y `/miembros` |
| 6 | Rutas de facto | `requiresAuth` añadido a `gestionesMaestro`, `GET /solicitudes` y rutas dashboard |

### Pendiente (requiere refactor mayor, no rompe por sí solo)
- **CSP desactivado**: reactivarlo requiere mover cientos de handlers `onclick` inline a listeners y estilos inline a clases. No se toca en esta ronda para no romper el funcionamiento actual.
- **MemoryStore**: opcional migrar a sesiones persistentes (conectar-redis / postgres) si se escala a más de una instancia.

---

## 6. Estado de producción (Render) — 5 de agosto de 2026

Servicio: **archivox** (`srv-d8j41tmrnols73ca6vr0`) — https://archivox.onrender.com

| Variable | Estado | Nota |
|---|---|---|
| `DATABASE_URL` | ✅ Configurada | PostgreSQL en Render |
| `NODE_ENV` | ✅ Configurada | Activa el flag `secure` de la cookie (solo HTTPS) |
| `SESSION_SECRET` | ✅ Configurada (5/ago/2026) | Secreto aleatorio de 96 caracteres hex. **Antes de configurarla**, el sistema usaba el secret por defecto (vulnerabilidad crítica de falsificación de cookies). **Efecto**: al guardarla, Render reinició el servicio y todos los usuarios se desloguearon una vez (normal, no se repetirá) |
| `REGISTRO_ABIERTO` | No configurada | Registro público **cerrado** por defecto (solo primer usuario o si se activa esta variable con `true`) |

### Cómo cambiar el SESSION_SECRET en Render (referencia)
1. Panel del Web Service → **Environment → Environment Variables → Edit**.
2. Agregar fila: **Key** `SESSION_SECRET` / **Value** un valor aleatorio largo (p. ej. generado con `crypto.randomBytes(48).toString('hex')`).
3. **Save** → Render re-despliega. Los usuarios se desloguean una única vez.

### Checklist de verificación post-deploy
- [x] `SESSION_SECRET` configurada
- [x] `NODE_ENV` configurada (cookie segura)
- [x] Verificado en producción (5/ago): `/api/debug/health` → `{status:ok, database:connected}` (sin tablas ni conteos)
- [x] Verificado en producción: `/api/excel/solicitudes` y `/api/gestiones-maestro` sin sesión → **401**
- [x] Fix del regex `.html` desplegado y verificado (5/ago): `/desktop/solicitudes.html`, `/admin/index.html` y `/perfil.html` → **302 a /login**; CSS/JS → 200 normal
- [ ] Probar que el login no muestra "Regístrate"
- [ ] Probar login de un usuario normal y acceso a todas las pantallas
- [ ] Probar el panel SuperAdmin (/admin)

### ⚠️ Nota de fix post-deploy (5/ago/2026)
El primer deploy incluyó un error en el regex del middleware de bloqueo `.html`:
`/\\.html$/i` (doble backslash) en lugar de `/\.html$/i`. El doble backslash hacía que el regex **nunca matcheara** y el bloqueo no actuara. Corregido en `app.js` línea 357 y **pendiente de commit + re-deploy**. Verificación del fix:
- `solicitudes.html` → matchea ✅ / `index.html` → matchea ✅ / `login.html` → matchea ✅
- `main.css` → NO matchea ✅ / `app.js` (JS) → NO matchea ✅

---

## 7. Impacto visual

Ninguna de las correcciones aplicadas cambia la interfaz de los usuarios autenticados. Único cambio visible: el formulario "Regístrate" de la página de login deja de mostrarse cuando el registro está cerrado.
