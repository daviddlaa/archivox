# Feature: Recordatorios de llamada/mensaje en campañas — badge "⏰" + notificación in-app

**Fecha:** Agosto 2026
**Ámbito:** `src/config/initDb.js`, `src/config/initDb.pg.js`,
`src/controllers/gestionesMaestro.controller.js`, `src/routes/gestionesMaestro.routes.js`,
`src/services/recordatorioScheduler.js`, `app.js`,
`public/desktop/gestion-lote.html`, `public/desktop/js/gestion-lote.js`,
`public/movil/gestion-lote.html`, `public/movil/js/gestion-lote.js`,
`public/css/gestion-lote.css`, `public/movil/css/gestion-lote.css`,
`public/desktop/js/gestiones.js`, `public/movil/js/gestiones.js`
**Solicitud:** Poder programar recordatorios de llamadas o mensajes por solicitud dentro de una
campaña, ver el pendiente en la tarjeta y recibir una notificación in-app cuando venza.

---

## 1. Resumen

Se añadió un sistema de **recordatorios de llamadas/mensajes** por solicitud dentro de las
campañas (`gestion-lote`). Cada recordatorio tiene un canal (`Llamada`/`Mensaje`), una fecha
y una nota opcional. Las tarjetas muestran un badge **"⏰"** cuando hay un recordatorio
pendiente (desktop y móvil), con acciones para marcar como hecho o cancelar. Cuando la fecha
vence, un **scheduler en servidor** crea una notificación in-app (tipo `warning`, prioridad
`alta`) dirigida al creador y la emite por SSE en tiempo real; el botón de acción lleva al
detalle de la campaña.

Decisiones de diseño aprobadas: tabla nueva `recordatorios` (sin tocar `gestiones`), opción
dedicada "⏰ Recordatorio" en el modal de gestión, badge ⏰ en cada tarjeta, y fase in-app
hoy + notificaciones push (web/PWA) **[implementadas — ver `feature-notificaciones-push-web.md`]**.

---

## 2. Base de Datos

### 2.1 Tabla `recordatorios`

| Columna | Tipo | Descripción |
|---------|------|-------------|
| id | SERIAL/INTEGER PK | ID único |
| solicitud_id | INTEGER NOT NULL | Solicitud asociada |
| gestion_maestro_id | INTEGER NOT NULL | Campaña asociada |
| usuario_id | INTEGER NOT NULL | Usuario que lo programó (destinatario de la notificación) |
| canal | TEXT NOT NULL | `Llamada` o `Mensaje` |
| fecha_recordatorio | TIMESTAMP/TEXT | Fecha/hora del recordatorio |
| nota | TEXT | Nota opcional |
| estado | TEXT DEFAULT 'pendiente' | `pendiente`, `hecho` o `cancelado` |
| notificado | INTEGER DEFAULT 0 | 0/1 — marca que ya se generó la notificación |
| created_at | TIMESTAMP/TEXT | Fecha de creación |
| completed_at | TIMESTAMP/TEXT | Fecha en que se marcó hecho/cancelado |

Índices:
- `idx_recordatorios_gestion_estado` → `(gestion_maestro_id, estado)` — badges por campaña.
- `idx_recordatorios_fecha_estado` → `(fecha_recordatorio, estado)` — barrido del scheduler.

La tabla se crea idempotente en `initDb.js` (SQLite) y `initDb.pg.js` (PostgreSQL), como el
resto del esquema.

> **Importante (PostgreSQL):** `initDb.pg.js` crea las tablas de forma **asíncrona** al
> arrancar (`initTables()` se invoca sin `await`). Por eso el scheduler reintenta el primer
> pase cada 5s hasta que la tabla existe.

---

## 3. Backend

### 3.1 Endpoints

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| POST | `/api/gestiones-maestro/:id/recordatorios` | ✅ | Crear recordatorio para una solicitud de la campaña |
| PUT | `/api/gestiones-maestro/:id/recordatorios/:rid/estado` | ✅ | Cambiar estado (`hecho`/`cancelado`) |
| PUT | `/api/gestiones-maestro/:id/recordatorios/:rid/posponer` | ✅ | Reprogramar (`fecha_recordatorio`); vuelve a `pendiente`/`notificado=0` |

**Controlador:** `crearRecordatorio`, `actualizarEstadoRecordatorio` y `posponerRecordatorio` en
`src/controllers/gestionesMaestro.controller.js` (exportados con el mismo nombre). Validan
acceso a la campaña con `buildGestionAccessWhere`, que la solicitud pertenezca a la campaña,
el canal y la fecha; insertan el recordatorio, una gestión de tipo `'Recordatorio'` y
aumentan el contador `gestionadas` de la campaña. `posponerRecordatorio` hace un UPDATE de
`fecha_recordatorio`, `estado='pendiente'`, `notificado=0` y `completed_at=NULL` para que el
scheduler vuelva a avisar cuando venza.

### 3.2 Detalle de campaña

`getGestionMaestroById` devuelve, por cada solicitud, el recordatorio pendiente más reciente
via LEFT JOIN con subquery: `recordatorio_id`, `recordatorio_canal`, `recordatorio_fecha`,
`recordatorio_nota`, `recordatorio_estado`. Con esto las tarjetas pintan el badge sin
consultas adicionales.

### 3.3 Scheduler `recordatorioScheduler.js`

Servicio nuevo que corre **cada 60 segundos**:

1. Selecciona `recordatorios WHERE estado='pendiente' AND notificado=0` con los datos de la
   solicitud (LEFT JOIN a `solicitudes`).
2. Para cada registro **vencido** (fecha ≤ ahora, comparación en JS contra el reloj del
   servidor): inserta una notificación en `notificaciones` (`tipo='warning'`,
   `prioridad='alta'`, `destinatario_id = usuario_id` del recordatorio, `accion_url =
   '/gestion-lote?id=<campaña>'` sin `accion_modulo` para que el DeepLinkRouter preserve el
   query, y **`recordatorio_id = id` del recordatorio** para que el campanario pueda ofrecer
   las acciones Hecho/Posponer/Eliminar), la emite por SSE con
   `notificationBus.emitir('notification.created', ...)` y marca `notificado=1` (idempotente).
3. **Resiliencia al arranque:** si el primer pase falla porque la tabla aún no existe
   (Postgres crea el esquema en background), reintenta cada 5s (máx. 6 veces) antes de caer
   al ciclo de 60s.

**Convención de fechas:** `fecha_recordatorio` se guarda como `"YYYY-MM-DD HH:MM:SS"` naive
(igual que `CURRENT_TIMESTAMP` y el resto de la app). El frontend envía `datetime-local` y el
backend normaliza `'T'`→`' '` (`.slice(0,19)`).

> **Gotcha de zona horaria (Postgres):** las columnas `TIMESTAMP` se devuelven como objetos
> `Date` y `res.json` las serializa a UTC (`toISOString`), lo que desplaza la hora en el
> navegador (p.ej. `09:30` → `04:30` con servidor en UTC y navegador en UTC-5). Por eso
> `getGestionMaestroById` normaliza `recordatorio_fecha` con `naiveDateString()` (getters
> locales) antes de responder. En SQLite el valor ya viaja como texto y no aplica. El
> scheduler usa el `Date` directo cuando llega desde PostgreSQL.

**Arranque:** `iniciarRecordatorioScheduler()` se llama en `app.js` al final (tras
`app.listen`), envuelto en try/catch para no tumbar el servidor.

### 3.4 Gestión del campanario (archivado + acciones del recordatorio)

La columna `notificaciones.recordatorio_id INTEGER` (migración idempotente en `initDb.js` y
`initDb.pg.js`) vincula cada notificación del scheduler con su recordatorio. Con eso el
centro de notificaciones (`public/js/notificaciones-dashboard.js`) ofrece:

- **Pestañas 🔔 Activas / 📦 Archivadas** en el panel. El listado (`listar`) **excluye por
  defecto** las archivadas (`?archivada=1` devuelve solo archivadas), así las archivadas dejan
  de reaparecer en el menú.
- **Botones directos en la card del recordatorio:** ✅ Hecho → `estado='hecho'`; ⏰ Posponer
  → modal con presets (+30 min / +1 h / +1 día) y `datetime-local` → `.../posponer`; ❌
  Eliminar → `estado='cancelado'`. Tras cada acción la notificación **se archiva** y el panel
  se refresca. El id de campaña se extrae de `accion_url`.
- **Novedades:** al marcar leída una notificación `es_novedad=1`, `marcarLeida` la archiva
  automáticamente (se oculta de la sección ✨ sin acumularse). Las de recordatorio **no** se
  archivan solo por leerlas.
- **`contarNoLeidas`** excluye archivadas del numerito.
- **`PUT /:id/restaurar`** y **`DELETE /:id`** (admin) para la pestaña Archivadas; el DELETE
  sigue siendo solo `superadmin` (ruta tras `requiresRole` en `admin.routes.js`).

---

## 4. Frontend

### 4.1 Móvil (`public/movil/gestion-lote.html` + `js/gestion-lote.js`)

- **Opción "⏰ Recordatorio"** en el modal de gestión (junto a Llamar y Mensaje). Al elegirla
  se muestran los campos `#recordatorio-canal` (Llamada/Mensaje) y `#recordatorio-fecha`
  (datetime-local con `min = valorMinimoDatetimeLocalMovil()` para impedir fechas pasadas)
  y una nota opcional.
- `guardarRecordatorioModalMovil()` → `POST /:id/recordatorios`; `guardarGestionIndividual`
  tiene rama propia para el modo Recordatorio (valida la fecha antes de enviar).
- **Badge** `⏰` en `.sol-header-badges` de cada tarjeta cuando hay recordatorio pendiente.
- **Botón `btn-sol-recordatorio`** junto a "Historial" con acciones
  `verRecordatorioMovil` / `marcarRecordatorioHechoMovil` / `cancelarRecordatorioMovil` vía
  `cambiarEstadoRecordatorioMovil`.
- `coloresTipo` del historial con `'Recordatorio': '#ffedd5'`.

### 4.2 Escritorio (`public/desktop/gestion-lote.html` + `js/gestion-lote.js`)

- Misma opción "⏰ Recordatorio" en el modal (`alternarModoRecordatorio`, campos
  `#recordatorio-fields`, `#recordatorio-fecha` con `min = valorMinimoDatetimeLocal()`),
  rama en `guardarGestionIndividual` y `guardarRecordatorioModal()`.
- **Badge** `.sol-recordatorio-badge` (⏰) en el header de la tarjeta.
- **Botón `.btn-accion.btn-recordatorio`** "⏰ Recordatorio" en la fila de acciones, con
  `verRecordatorio` / `marcarRecordatorioHecho` / `cancelarRecordatorio` y
  `cambiarEstadoRecordatorio`.
- `coloresEstado['Recordatorio']='#ffedd5'` y `coloresTipo` del historial actualizados.

### 4.3 Filtros y listado de campañas

- Opción **Recordatorio** agregada a los selects de estado en `gestion-lote.html` y
  `gestiones.html` (desktop y móvil).
- `coloresTipo` con Recordatorio en `public/desktop/js/gestiones.js` (2 mapas) y
  `public/movil/js/gestiones.js`.

### 4.4 Notificación (deep link)

La notificación del scheduler usa `accion_url='/gestion-lote?id=<campaña>'` **sin**
`accion_modulo` para que `DeepLinkRouter.corregirUrl()` preserve el query string. Ambas
páginas de campaña ya leen `?id=` al iniciar (`obtenerGestionId` desktop / móvil), así que
el clic abre directamente la campaña.

---

## 5. Verificación

- `node --check` OK en todos los archivos tocados (controllers, routes, scheduler, app.js,
  initDb ×2, frontend desktop/móvil).
- Test de integración SQLite: creación de tabla, INSERT/UPDATE/SELECT de recordatorios,
  INSERT de notificación, y scheduler de extremo a extremo (recordatorio vencido → notificación
  `warning` creada + `notificado=1`).
- Arranque real de `app.js` con `.env` (PostgreSQL): tabla `recordatorios` creada, scheduler
  activo cada 60s y sin errores en stderr.
- **Hallazgo en test:** `notificaciones.tipo` tiene CHECK `IN ('info','warning','success',
  'danger')`; el scheduler usa `'warning'` (un `'recordatorio'` fallaba).

---

## 6. Roadmap (fuera de alcance v1)

- ~~**Notificaciones push (web/PWA)**~~ → ✅ **Implementadas (28/08/2026):** ver
  [`feature-notificaciones-push-web.md`](feature-notificaciones-push-web.md).
- Notificar también al agente asignado de la campaña (v1 notifica solo al creador).
- Editar un recordatorio pendiente.
- Recordatorios recurrentes.
- Reporte/lista central de recordatorios pendientes.
- Indicador ⏰ en el listado de campañas (`gestiones`) con el conteo de pendientes.
