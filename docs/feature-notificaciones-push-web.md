# Feature: Notificaciones push web (Web Push API / VAPID/PWA)

**Fecha:** 28/08/2026
**Ámbito:** `src/config/pushConfig.js`, `src/services/pushService.js`,
`src/controllers/push.controller.js`, `src/routes/push.routes.js`, `app.js`,
`src/config/initDb.js`, `src/config/initDb.pg.js`,
`src/controllers/notificaciones.controller.js`,
`src/controllers/gestionesMaestro.controller.js`,
`src/services/recordatorioScheduler.js`, `src/services/liberacionScheduler.js`,
`public/sw.js`, `public/manifest.webmanifest`, `public/img/icono-*.png`,
`public/favicon.ico`, `public/js/push-suscripcion.js`, `public/css/push-suscripcion.css`,
`public/js/drawer.js`, `public/js/perfil.js`, `public/perfil.html` y los 24 HTML de
`public/desktop/*.html`, `public/movil/*.html` + `public/admin/index.html` (head con
manifest + favicon + CSS push + script `push-suscripcion.js`).
**Solicitud:** Que el usuario reciba las notificaciones importantes del centro aunque la
pestaña del sitio esté cerrada (escritorio y Android), y de forma "nativa" en iOS cuando la
app esté **instalada** como PWA (iOS 16.4+). Implementación con Web Push API + VAPID.

---

## 1. Resumen

Se añade soporte de **notificaciones push web** con `web-push` + claves VAPID. Cada usuario
puede **suscribir su navegador** (1 clic, requerido un gesto): el suscriptor se guarda en la
tabla `push_subscriptions` por `(usuario_id, endpoint)`. Cuando el sistema crea una
notificación in-app **con destinatario concreto**, además del SSE se dispara un **push real**
en segundo plano (fire-and-forget, jamás bloquea el guardado) hacia todas las suscripciones
activas de ese usuario. Las notificaciones **globales** (`destinatario_id = NULL`) **NO**
disparan push: son avisos generales para todo el centro y un push por usuario no tiene sentido.

La app se vuelve **instalable (PWA)**: manifest + service worker + iconos. El service worker
se encarga de mostrar la notificación y de abrir la URL correcta al hacer clic (desktop vs
móvil). En iOS Safari (que siempre desactiva las notificaciones web en pestañas normales) se
muestra una **guía para "Añadir a Home Screen"**; instalada como PWA, iOS 16.4+ sí recibe push.

## 2. Decisiones de diseño (aprobadas)

| Tema | Decisión |
|---|---|
| Alcance | Push solo a notificaciones **con `destinatario_id`**; las globales no hacen push |
| Permiso | Se pide **con gesto** (nunca al cargar): ① banner contextual al guardar un ⏰ recordatorio, ② banner one-time en el dashboard (localStorage `archivox_push_banner_visto`) |
| Navegadores | Chrome/Edge/Firefox desktop · Chrome Android · Safari macOS. iOS ✗ en pestaña (guía PWA) ✓ instalada iOS 16.4+ |
| Dependencia | `npm i web-push` (claves VAPID en entorno) |
| Fallo de envío | 404/410/400 → se **borra** la suscripción muerta; otros errores solo log |

## 3. Base de Datos — tabla `push_subscriptions`

Creada (idempotente) en `initDb.js` y `initDb.pg.js`:

```sql
CREATE TABLE push_subscriptions (
    id INTEGER/BIGSERIAL PRIMARY KEY,
    usuario_id INTEGER NOT NULL,
    endpoint TEXT NOT NULL,          -- URL del push service (FCM/vapid/Mozilla)
    keys_p256dh TEXT NOT NULL,       -- clave pública del navegador (base64)
    keys_auth TEXT NOT NULL,         -- secreto de autenticación (base64)
    plataforma TEXT NOT NULL DEFAULT 'desktop',  -- 'desktop' | 'movil'
    user_agent TEXT,
    created_at DATETIME/TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME/TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX idx_push_subscriptions_usuario_endpoint ON push_subscriptions(usuario_id, endpoint);
```

> **⚠️ Ojo con el guard `SCHEMA_VERSION` (PostgreSQL):** al añadir un DDL en
> `initDb.pg.js` hay que **incrementar `SCHEMA_VERSION`** (v7 → **v8** en este caso). Si no,
> la BD de producción ya está en `v7` y el arranque salta todo el DDL ("arranque rápido") → la
> tabla nunca se crea y `/api/push/estado` responde 500
> (`relation "push_subscriptions" does not exist`, visible en los logs de Render como
> `[Push] Error consultando estado:`). `initDb.js` (SQLite local) corre siempre el DDL, por
> eso el bug solo apareció en producción.

## 4. API (`/api/push`, todas con `requiresAuth`)

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/api/push/vapid-public-key` | Clave VAPID pública (`{ publicKey }`) para el `pushManager.subscribe` |
| `POST` | `/api/push/subscribe` | Registra/actualiza la suscripción (upsert por `(usuario_id, endpoint)`). Body: `{ endpoint, keys:{p256dh,auth}, plataforma }` |
| `DELETE` | `/api/push/subscribe` | Elimina: una suscripción (`{ endpoint }`) o todas las del usuario (body vacío) |
| `GET` | `/api/push/estado` | `{ configurado, suscrito, activas: [...] }` para la UI de Perfil |

La configuración VAPID vive en `src/config/pushConfig.js` (lee `.env`). El flag
`configurado` es `false` si faltan claves → la API de estado lo reporta y el frontend
oculta la sección.

## 5. Puntos de disparo del push (hooks)

`pushService.enviarPushDesdeNotificacion(notificacion)` se invoca **tras** guardar la
notificación in-app, en los 4 sitios donde el centro emite notificaciones directas:

1. `notificaciones.controller.js` → `crear` (con `if (destinatario_id)`, el resto de la lógica
   del modal no depende del push).
2. `gestionesMaestro.controller.js` → helper `crearYNotificar` (usado por enviar-campana y
   "Enviar a" de agentes).
3. `recordatorioScheduler.js` (cada 60 s) → recordatorios vencidos.
4. `liberacionScheduler.js` → `crearAlerta` (campaña automática de reactivación).

Todas las llamadas son asíncronas `fire-and-forget`; un fallo de push nunca rompe el
guardado ni el SSE. El payload llevará `{ titulo, cuerpo, url }` donde `url` se ajusta por
plataforma con `urlParaPlataforma` (`/m/x` ↔ `/x`).

## 6. Frontend

- **`public/sw.js`** — service worker de solo push (`SW_VERSION = 1`): handler `push`
  (payload JSON → `showNotification`) y `notificationclick` (cierra el clic en la pestaña
  correcta vía `clients.openWindow`/`matchAll`). Tras cada push, hace broadcast `message`
  `{ tipo:'push-recibido' }` a las pestañas abiertas (informativo). **No** caché de HTML/API.
- **`public/manifest.webmanifest`** — PWA instalable (nombre "Archivox", `display:
  standalone`, color `#6366f1`, iconos 192/512 + maskable). Se inyecta en el `<head>` de
  todas las páginas junto a `apple-touch-icon`, `favicon` y `push-suscripcion.css`.
- **`public/js/push-suscripcion.js`** — API global `PushNotif`: `soportado()`,
  `esPWAInstalada()`, `esIOSEnPestana()`, `estadoPermiso()`, `registrarSW()`,
  `solicitar()`, `desactivar()`, `errorLegible(err)`, `bannerDashboard()`,
  `bannerTrasRecordatorio()`. Se auto-inicializa en el dashboard (banner one-time +
  registro silencioso del SW) y escucha el evento `archivox:recordatorio-guardado`
  (disparado por `gestión-campana.js`).
- **`public/perfil.html` + `perfil.js`** — tarjeta "🔔 Notificaciones push": estado
  (soportado/instalable iOS/permiso), botones Activar/Desactivar, y guía PWA en iOS.
- **`public/js/drawer.js`** — `cerrarSesion()` desactiva las suscripciones push al salir.

## 7. Configuración de despliegue

- `.env` / `.env.template`:
  `VAPID_PUBLIC_KEY=BH9Jg6WaQeDfXKn8NR_QDlqyNaU17LxUUYLtqT5Nq4aJD5u82CtfIox2yhuCs4N00RX_dH6MILPVi1q9DtLAS3Q`,
  `VAPID_PRIVATE_KEY=MescajGhAyVj2o0yndivBCZcP7z8fY5zkB430nGC_bU`,
  `VAPID_SUBJECT=mailto:soporte@archivox.com`.
- En Render hay que **añadir esas 3 variables** (el `web-push` exige `VAPID_SUBJECT` para
  enviar). HTTPS es obligatorio para Web Push (Render ya lo da).

## 8. Robustez del `subscribe` y diagnóstico móvil (cliente)

`pushManager.subscribe` falla con `"Registration failed - push service error"` en tres
casos reales que ya se han dado en producción. La app los maneja así
(`suscribirseConReintento` en `push-suscripcion.js`):

1. **Suscripción vieja del mismo SW con otra `applicationServerKey`** → se intenta
   `getSubscription()`, se hace `unsubscribe()` a la obsoleta y se reintenta.
2. **FCM transitorio / propagación del permiso en Android** → 2 intentos iniciales con
   pausa de 250 ms.
3. **Registración del SW "rota" en el navegador** (típico tras varios despliegues; el
   teléfono no crea fila en la BD ni suscripción en el navegador, y `subscribe` falla
   siempre) → se **desregistra el SW, se re-registra y se espera `serviceWorker.ready`**
   antes de un intento final ("borrar y rehacer").

Además:

- **Detección iPadOS:** el iPadOS 13+ envía user-agent de escritorio (`Macintosh`); se
  detecta con `maxTouchPoints > 1` (`esApple()`). `esIOSEnPestana()` = Apple **y** sin PWA
  instalada, y **no** depende de `soportado()` (antes la guía quedaba oculta en iPad).
- **iOS siempre a la guía:** en pestaña normal de iPhone/iPad (incl. iOS 16.4+, que expone
  la API pero rechaza el `subscribe` sin app instalada) el flujo `solicitar()` devuelve
  `ios-pestana` **antes** de comprobar soporte; banner del dashboard y tarjeta de Perfil
  muestran "Compartir → Añadir a Pantalla de Inicio". `bannerDashboard()` y
  `bannerTrasRecordatorio()` muestran la guía incluso cuando `!soportado()`.
- **Errores accionables:** `errorLegible()` traduce el error técnico del navegador a un
  mensaje en español (variante móvil si `detectarPlataforma() === 'movil'`); Perfil y el
  banner nunca exponen el texto crudo del navegador. Los logs (`console.error`) sí guardan
  el motivo real.
- Verificación de la detección con Chromium headless (emulación de UA/`maxTouchPoints`):
  iPad→`true`, iPhone→`true`, Android/desktop→`false` ✓, y el flujo Android completo
  (UA Pixel 5 + permiso concedido + sin suscripción previa) → suscripción real guardada ✓.

## 9. Limitaciones conocidas

- **iOS Safari en pestaña normal:** no recibe push (Apple lo desactiva). Con la app
  **instalada** (Añadir a Home Screen) e iOS ≥ 16.4 sí. La UI muestra la guía.
- El permiso de notificación es **por navegador** (no por cuenta): desactivar desde el
  navegador anula suscripciones futuras de esa cuenta en ese navegador.
- Las notificaciones **globales** no generan push (decisión).
- Los navegadores pueden limitar el formato del icono/payload; se usa el payload mínimo
  estándar para máxima compatibilidad.
- **Dispositivos Android sin acceso a FCM (hallazgo en producción 30/08/2026):** hay
  teléfonos cuyo Chrome/Brave **nunca** consigue crear la suscripción (`push service
  error`) aunque el permiso esté permitido y todo esté actualizado, con datos y WiFi.
  El `subscribe` ocurre 100% dentro del navegador; el servidor no participa (no llega
  ninguna fila a `push_subscriptions`). Si falla en Chrome y Brave y funciona en otro
  dispositivo → el bloqueo es del propio teléfono/ROM/red (FCM inalcanzable, sin cuenta
  de Google en Chrome, ROM sin servicios de Google, DNS privado/VPN regional). Probar en
  otro navegador/dispositivo confirma que la app no tiene fallo.

## 10. Verificación E2E

- Flujo API completo en local (SQLite): login → `vapid-public-key` → `subscribe` (upsert) →
  `estado` → `DELETE subscribe` ✓ (curl real).
- **Push real verificado con Chromium headless:** `Notification.requestPermission()`
  concedido, suscripción real contra FCM (clave VAPID real), `enviarPushAUsuario` →
  `web-push` responde OK y el SW muestra la notificación y hace broadcast `push-recibido` a
  la página ✓.
- El envío a un endpoint muerto (400/404/410) **limpia** la suscripción de la BD ✓.
- `node --check` en los 16 ficheros JS tocados ✓.