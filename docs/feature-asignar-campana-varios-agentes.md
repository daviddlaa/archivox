# Feature: Asignar una campaña a varios agentes con líder (agente del sistema / admin)

> **Estado:** ✅ Implementada
> **Fecha:** 30/08/2026
> **Ámbito:**
> - Backend — `src/controllers/gestionesMaestro.controller.js` (nuevo `asignarAVariosAgentes`)
> - Ruta — `src/routes/gestionesMaestro.routes.js`
> - Frontend desktop — `public/desktop/js/gestion-lote.js`
> - Frontend móvil — `public/movil/js/gestion-lote.js`
> - Admin — `public/admin/js/admin.js` + `public/admin/index.html`

---

## 1. Contexto / problema

Un miembro del equipo **"Sistema"** (con `puede_enviar=true`) crea sus campañas en `/gestion-lote` y hoy solo puede asignarlas a **un** agente a la vez (`asignarAgenteACampana`). Cuando la misma campaña debe llegar a **varios agentes con líder** (cada uno con su propio líder), no existe un flujo masivo: habría que clonarla manualmente por cada agente.

## 2. Solución elegida

Nuevo endpoint que, al recibir una campaña YA creada y un conjunto de agentes destino, crea **una copia (clon)** de la campaña por cada agente seleccionado y notifica a cada agente y a su líder.

Semántica confirmada: **"Copia a cada agente"** (cada clon lleva el mismo `solicitudes_ids`).

Decisiones confirmadas:
- **Permisos:** solo miembros del equipo **"Sistema"** + **admin/superadmin**. Un líder normal NO.
- **Límite:** máx. **20 agentes** por tanda.
- **Idempotencia:** se **permiten duplicados** (re-asignar crea más clones) con trazabilidad.
- **Nombrado del clon:** `"Usuario <remitente>, asigna a <destino>"` (p. ej. `Usuario daviddlaa, asigna a rosa sanchez`).
- **UI:** desktop + móvil (menú de la campaña) **y** Admin.

---

## 3. Backend

### 3.1 Ruta nueva (`src/routes/gestionesMaestro.routes.js`)

```
POST /api/gestiones-maestro/:id/asignar-a-varios-agentes
Body: { agentes_ids: [1,2,...] }
```

### 3.2 Controlador `asignarAVariosAgentes` (`src/controllers/gestionesMaestro.controller.js`)

1. **Autorización:**
   - Autenticado obligatorio.
   - Permitido si el usuario es **admin/superadmin** (`rol`) **o** es miembro activo de un equipo de nombre **'Sistema'** (`equipo_usuarios` con `fecha_salida IS NULL` + `equipos.nombre='Sistema'`).
   - La campaña debe existir y ser **del propio usuario** (vía `buildGestionAccessWhere`) a menos que sea admin/superadmin (que puede asignar cualquiera).
2. **Validación de destinos (lote, ANTES de escribir):**
   - `agentes_ids` no vacío, sin duplicados, sin auto-asignación, máx **20**.
   - Cada destino debe ser `rol='agente'`, `es_lider=0`, activo, en equipo `!= 'Sistema'`, con **líder activo**.
   - Si algún destino falla → **400** y no se escribe nada.
3. **Clon por agente (dentro de transacción en PostgreSQL; secuencial en SQLite):**
   - `INSERT` en `gestiones_maestro`:
     - `nombre = 'Usuario <remitente>, asigna a <destino>'`
     - `usuario_id = remitente` (el agente del sistema conserva el registro)
     - `equipo_id = agente.equipo_id` (destino → su líder lo ve)
     - `asignado_a = agente.id`
     - `es_sistema = 1`
     - `solicitudes_ids` = JSON de la original (misma lista)
     - `total_solicitudes`, `gestionadas=0`, `fecha_limite`, `estado='activa'`
   - `insertarSemaforoSinClasificar(clonId, ids, usuario_id)` (puente semáforo).
   - Trazabilidad: `INSERT INTO envios_solicitudes (solicitud_id, remitente_id, destino_id, comentario, equipo_id, campana_id)` por solicitud.
   - **No** se re-vincula `solicitudes.campana_id` (evita pisar la original).
4. **Caché:** `cache.invalidateAllCampanas()` + `cache.invalidateDashboard(agenteId)` por destino.
5. **Notificaciones** (vía `crearYNotificar`) por destino:
   - Al **agente**: "📥 Te asignaron la campaña 'X' con N solicitud(es)" → `accion_url='/gestion-lote?id=<clon>'`, prioridad `alta`.
   - Al **líder del destino**: "📋 Tu agente 'Y' recibió la campaña 'X'" → prioridad `normal`.
6. **Auditoría:** `campana.asignada.varios` (agentes, total_agentes, total_solicitudes).
7. **Respuesta 201:** `{ clones:[{id, agente:{id,nombre,username}, lider_id}], total_agentes, total_solicitudes, mensaje }`.

> **Nota de motor:** el wrapper `db.js` **no** soporta `pool.connect()`/`client.query()` en SQLite (solo expone `pool.query`). Por eso, si `pool.connect` existe (PostgreSQL) se ejecuta en transacción con `BEGIN/COMMIT/ROLLBACK`; si no (SQLite local) se ejecuta secuencialmente con `pool.query`. Se sigue así la convención de `moverUsuario` sin romper la prueba local en SQLite.

---

## 4. Frontend

### 4.1 Desktop (`public/desktop/js/gestion-lote.js`)

- Nueva flag `_esSistema` (se calcula en `verificarRolUsuario`: `puede_enviar===true` o admin/superadmin).
- Botón **"🔀 Asignar a varios"** en la tarjeta de campaña, visible solo si `_esSistema`.
- `abrirModalAsignarVariosDesktop(id, nombre)`:
  - `fetch('/api/equipos/agentes-con-lider')`.
  - Lista con **checkboxes** (multiselección), mostrando `usuario_nombre`, `@username`, `lider_nombre` y badge "⚡ Más rápido".
  - Contador de seleccionados.
  - Confirmar → `POST /api/gestiones-maestro/:id/asignar-a-varios-agentes` con `{agentes_ids}`.
  - Éxito: `cerrarModal()`, refresco de lista, alert de confirmación.

### 4.2 Móvil (`public/movil/js/gestion-lote.js`)

- Nueva flag `_esSistema` (misma lógica).
- Opción **"🔀 Asignar a varios agentes"** en el bottom sheet de la campaña.
- `abrirModalAsignarVariosMovil(id, nombre)`: sub-sheet reutilizando `campaña-bs-overlay`/`campaña-bs-sheet`, llamando `cancelarLimpiezaBottomSheet()` (incluye el fix del timer de limpieza ya implementado), con checkboxes multiselección y contador.
- `asignarVariosAgentesMovil`: el POST + refresco.

### 4.3 Admin (`public/admin/js/admin.js` + `public/admin/index.html`)

- Botón **"🔀 Asignar a varios"** junto a "Crear campaña".
- Nuevo modal `asignarVariosCampanaModal`:
  - Select de **campaña** (desde `GET /api/gestiones-maestro`, con etiqueta "🤖" cuando `es_sistema`).
  - Lista de **agentes con líder** con checkboxes y contador.
  - Confirmar → mismo endpoint.
- Registrado en `_MODALES`; `cerrarTodosLosModales` ya lo cubre.

---

## 5. Casos borde

- **No dueño / no autorizado** → 403.
- **Agente sin líder, inactivo, del equipo 'Sistema', o inexistente** → 400 (no escribe nada).
- **Auto-asignación** → 400.
- **> 20 agentes** → 400.
- **Campaña sin solicitudes** → 400.
- **Re-asignar la misma campaña** → crea clones duplicados (comportamiento intencional, con trazabilidad).
- **SQLite** sin transacción real: una falla a media tanda podría dejar parciales (limitado por previa validación en lote; en PostgreSQL es atómico).

---

## 6. Verificación

- `node --check` de: `src/controllers/gestionesMaestro.controller.js`, `src/routes/gestionesMaestro.routes.js`, `public/desktop/js/gestion-lote.js`, `public/movil/js/gestion-lote.js`, `public/admin/js/admin.js` ✓.
- Prueba local en SQLite (`DATABASE_URL= NODE_ENV=development node app.js`) con **Node 22**:
  - Crear campaña como miembro del "Sistema"/superadmin y asignar a 2-3 agentes con líder.
  - Verificar 1 clon por agente (nombre `Usuario X, asigna a Y`, `asignado_a`, `equipo_id=destino`, `es_sistema=1`), puente semáforo, filas en `envios_solicitudes`, notificaciones por destinatario.
  - Verificar que el destino ve la campaña y que su líder la ve.
  - Casos negativos: no-dueño 403, sin-líder 400, >20 agentes 400, auto-asignación 400.
- **Importante:** no ejecutar la asignación contra la Postgres de producción.

---

## 7. Implicaciones

- **Clutter en la lista del remitente:** como `usuario_id = remitente`, el agente del sistema ve los N clones (igual que hoy ve la campaña enviada en "Enviar a"). Aceptado.
- **Mismas solicitudes en N campañas:** cada clon refiere las mismas solicitudes; el puente semáforo es por `gestion_maestro_id`, así que la edición de un clon no afecta a los demás. Correcto por diseño.
- **`es_sistema=1` en los clones:** los etiqueta como "Asignada por el sistema"; la visibilidad para el líder viene por `equipo_id` (destino), no por `es_sistema`.

---

## 8. Archivos tocados

- `src/controllers/gestionesMaestro.controller.js` — `asignarAVariosAgentes` + export.
- `src/routes/gestionesMaestro.routes.js` — nueva ruta POST.
- `public/desktop/js/gestion-lote.js` — flag `_esSistema` + botón + modal multiselección.
- `public/movil/js/gestion-lote.js` — flag `_esSistema` + opción sheet + sub-sheet multiselección.
- `public/admin/js/admin.js` — modal y funciones de asignación múltiple.
- `public/admin/index.html` — botón + modal `asignarVariosCampanaModal`.
