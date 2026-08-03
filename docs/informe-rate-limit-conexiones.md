# Informe: Rate Limiting y Reconexión SSE (Fix "Demasiadas solicitudes")

**Fecha:** Agosto 2026
**Estado:** Implementado

---

## 1. Problema Reportado

Usuarios navegando en la app (incluso un solo usuario) recibían un error tipo
**"Demasiadas solicitudes"** y quedaban bloqueados. Reiniciar el servidor en
Render lo resolvía temporalmente.

### Causa raíz

El `express-rate-limit` guarda su contador **en memoria**. Al reiniciar el
servidor, los contadores se reinician → por eso "funcionaba" al reiniciar.

El límite configurado era demasiado agresivo y mal aplicado:

```
Antes (app.js):
  windowMs: 15 min, max: 100 solicitudes POR IP, aplicado a TODO
```

**Por qué un solo usuario lo agotaba:**

1. **Reconexión SSE cada 3s**: el cliente (`notificaciones-dashboard.js`) tenía
   `SSE_RECONNECT_DELAY: 3000` → si la conexión SSE se caía (típico en datos
   móviles/WiFi inestable), se reconectaba cada 3 segundos. Cada reconexión es
   una petición HTTP. 100 cupo / 20 por minuto ≈ **se agota en ~5 minutos**.
2. **Contaba estáticos**: el limiter aplicaba a `CSS/JS/imágenes` (cada pantalla
   carga ~10-20 recursos) y al stream SSE.
3. **Por IP, no por usuario**: si varios usuarios compartían una IP (NAT de
   oficina o de operadora móvil), todos consumían el mismo cupo de 100.

---

## 2. Solución Implementada

### 2.1 Rate Limiter (`app.js`)

| Configuración | Antes | Ahora |
|---------------|-------|-------|
| Ventana | 15 min | 15 min |
| Límite | 100 | **600** |
| Base del conteo | IP | **Usuario autenticado** (IP solo para login/registro) |
| Archivos estáticos | Contaban | **Excluidos** (css/js/png/svg/ico/...) |
| Endpoint SSE `/stream` | Contaba | **Excluido** |
| Header `Retry-After` | No | **Sí** (mensaje 429 con tiempo de espera) |

Detalles:

- La sesión (`app.use(session)`) ahora se registra **antes** del rate limiter
  para poder identificar al usuario con `req.session.usuario.id`.
- `keyGenerator` → `user:<id>` cuando hay sesión; si no, `req.ip`.
- `skip` → excluye el stream SSE y archivos estáticos (por extensión).
- `handler` → respuesta 429 con `Retry-After` y mensaje claro.
- El limiter estricto de **login (5 / 15 min)** se mantiene en
  `src/routes/auth.routes.js` (protección anti fuerza bruta).
- El limiter de **admin (30 / 1 min)** se mantiene en
  `src/routes/admin.routes.js`.

### 2.2 Reconexión SSE del Cliente (`public/js/notificaciones-dashboard.js`)

Backoff exponencial en `es.onerror`:

```
5s → 10s → 20s → 40s → 60s (máximo)
```

- Si `document.hidden` (pestaña en segundo plano) **no reconecta** hasta que la
  pestaña vuelva a estar visible (chequeo cada 5s).
- Al conectar con éxito (`connected`), `reconnectAttempts` se resetea a 0.

---

## 3. Archivos Modificados

| Archivo | Cambio |
|---------|--------|
| `app.js` | Sesión antes del rate limiter + limiter general rediseñado (600/15min por usuario, sin estáticos/SSE, `Retry-After`) + monitoreo de peticiones |
| `public/js/notificaciones-dashboard.js` | Backoff exponencial + pausa en segundo plano + reset de contador |
| `src/services/monitor.js` | **NUEVO** — contadores en memoria: peticiones por usuario (15 min), bloqueos rate limit, uptime |
| `src/controllers/admin.controller.js` | **NUEVO** endpoint `GET /api/admin/conexiones` (SSE + pool + monitoreo) |
| `src/routes/admin.routes.js` | Ruta `/conexiones` (solo superadmin) |
| `public/admin/index.html` | Sección "🔌 Conexiones y Seguridad" en tab Estadísticas |
| `public/admin/js/admin.js` | `cargarConexiones()` + auto-refresh cada 30s |
| `public/admin/css/admin.css` | Estilos armonizados + responsive móvil |

### 3.1 Panel SuperAdmin — "Conexiones y Seguridad"

En la pestaña **Estadísticas** del Panel de Administración (escritorio y móvil,
vía `/admin?tab=estadisticas` o `/m/admin?tab=estadisticas`) se muestra ahora:

**Tarjetas resumen:**
- 🟢 **Conectados ahora** — usuarios con SSE activo + total de conexiones SSE
- 📈 **Peticiones (15 min)** — total de peticiones API + usuarios activos
- ⏱️ **Uptime servidor** — tiempo desde el último reinicio
- 🛡️ **Bloqueos Rate Limit** — total de respuestas 429 + fecha del último
- 🗄️ **Pool BD** — conexiones totales/idle/en espera de PostgreSQL (o SQLite)

**Tabla/cards de usuarios con actividad** (últimos 15 min):
usuario, nombre, rol, peticiones, conexiones SSE y si está conectado ahora.

Se actualiza automáticamente cada 30 s mientras la pestaña está activa.

### 3.2 Endpoint `GET /api/admin/conexiones`

Solo superadmin. Devuelve:

```json
{
  "sse": { "total_conexiones": 3, "usuarios_conectados": 2 },
  "pool": { "engine": "postgres", "total": 4, "idle": 3, "waiting": 0 },
  "monitor": { "uptime_segundos": 3600, "total_peticiones": 12345,
                "usuarios_activos": 5,
                "bloqueos": { "total": 1, "ultimo": "...", "ultimaClave": "user:2" } },
  "usuarios": [ { "usuario_id": 2, "username": "maria", "nombre": "María",
                   "rol": "agente", "peticiones_15min": 42,
                   "conexiones_sse": 1, "conectado_ahora": true } ]
}
```

> **Nota:** El monitor y el rate limiter son **en memoria**; los contadores
> se reinician al reiniciar el servidor (consistente con el comportamiento
> de `express-rate-limit`).

---

## 4. Verificación

- `node --check app.js` ✅
- `node --check public/js/notificaciones-dashboard.js` ✅

### Prueba manual sugerida en producción

1. Abrir la app en un móvil con datos móviles.
2. Navegar por varias pantallas durante >15 min (solicitudes, gestiones, dashboard).
3. Dejar la app en segundo plano y volver: el SSE no debe reconectar en ráfagas.
4. Confirmar que ya NO aparece "Demasiadas solicitudes".

---

## 5. Seguimiento Recomendado

- Monitorear `429` en los logs del servidor después del deploy.
- Verificar en el Panel SuperAdmin → Estadísticas → "Conexiones y Seguridad"
  que los conteos de SSE, peticiones y bloqueos se vean sanos.
- Si un usuario reporta el problema de nuevo, revisar la tarjeta
  "🛡️ Bloqueos Rate Limit" para confirmar (y ver `ultimaClave` en el endpoint).
- Considerar subir `max` del `adminLimiter` (30/min) si el SuperAdmin navega
  rápido el panel y se siente limitado.
