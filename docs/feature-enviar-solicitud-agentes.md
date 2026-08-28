# Feature: Envío de solicitudes entre agentes con líder — Enviar a + Reasignación + Historial + Métricas

**Fecha:** Agosto 2026
**Estado:** ✅ Implementado (backend + frontend desktop/móvil, métricas y tablas verificadas en SQLite)
**Ámbito:** `src/config/initDb.js`, `src/config/initDb.pg.js`,
`src/controllers/equipos.controller.js`, `src/controllers/gestionesMaestro.controller.js`,
`src/routes/equipos.routes.js`, `src/routes/gestionesMaestro.routes.js`,
`public/desktop/js/solicitudes.js`, `public/movil/js/solicitudes.js`,
`public/desktop/js/gestion-lote.js`, `public/movil/js/gestion-lote.js`

---

## Resumen

Un **agente sin líder** puede enviar una o varias solicitudes a un **agente que sí tiene líder**
en cualquier momento. El envío crea una **campaña tripartita** que ven las tres partes
(remitente, agente destino y líder del destino). El líder puede **reasignar** la solicitud a
otro agente de **su mismo equipo** desde la campaña. Cada envío y reasignación queda
registrado en la tabla `envios_solicitudes` (trazabilidad) y genera **notificaciones** a todos
los implicados (SSE). Además se calculan **métricas por agente con líder** para **recomendar**
al agente más rápido gestionando.

---

## 1. Reglas de negocio

### 1.1 Quién puede enviar

- **Solo los agentes sin líder** pueden usar "Enviar a".
- El destino debe ser un **agente que tenga líder**.
- `destino != remitente`.
- Envío **abierto todo el tiempo**: sin restricción de horario ni de frecuencia, individual y
  múltiple (selección de varias solicitudes).

> **Selector de destino (`GET /api/equipos/agentes-con-lider`):** lista solo agentes con líder
> **activo**, de rol `agente` y **excluye el equipo "Sistema"** (por defecto). Si un líder se
> inactiva, su grupo deja de aparecer.
>
> **"Sin líder" (remitente):** se decide igual que el destino — un usuario solo en el equipo
> "Sistema" **no** cuenta como "tiene líder" y **puede enviar**. Solo se bloquea a quien
> pertenece a un equipo no-"Sistema" con un líder real y activo.
>
> Ver `fix-agentes-con-lider-filtros.md`.

### 1.2 Campaña tripartita

La campaña creada se ve por las tres partes, cada una por su vía ya soportada en
`buildGestionAccessWhere` (`gestionesMaestro.controller.js`):

| Parte | Cómo la ve | Mecanismo |
|---|---|---|
| Remitente (agente sin líder) | Su propia campaña | `gm.usuario_id = su id` |
| Agente destino (con líder) | Asignada a él | `gm.asignado_a = su id` |
| Líder del destino | De su equipo | `gm.equipo_id = su equipo` |

### 1.3 Reasignación

- La hace el **líder del equipo** de la campaña (o superadmin).
- Nuevo destino debe ser un **agente del mismo equipo**.
- Al reasignar se **conserva** el `destino_id` original y se registra `nuevo_destino_id`
  (trazabilidad completa).

### 1.4 Notificaciones

- **Al enviar:** se notifica al **agente destino** y al **líder del destino**.
- **Al reasignar:** se notifica al **remitente** (agente sin líder), al **agente destino
  original** y al **nuevo agente destino**.
- **Al gestionar:** si quien gestiona la solicitud no es el remitente, se notifica al
  **remitente**.
- Todas por SSE (`notification.created` + `count.updated`).

---

## 2. Modelo de datos — Tabla `envios_solicitudes` (nueva)

Creada automáticamente en `src/config/initDb.js` (SQLite) y `initDb.pg.js` (PostgreSQL),
idempotente.

```sql
CREATE TABLE IF NOT EXISTS envios_solicitudes (
    id                   SERIAL/INTEGER PRIMARY KEY,
    solicitud_id         INTEGER NOT NULL,   -- id_solicitud enviada
    remitente_id         INTEGER NOT NULL,   -- FK usuarios: quién envió
    destino_id           INTEGER NOT NULL,   -- FK usuarios: destino ORIGINAL (se conserva)
    comentario           TEXT,               -- opcional del remitente
    equipo_id            INTEGER NOT NULL,   -- FK equipos: equipo del destino
    campana_id           INTEGER NOT NULL,   -- FK gestiones_maestro: campaña creada
    fecha_envio          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    gestionada           INTEGER DEFAULT 0,  -- ¿ya se gestionó?
    fecha_gestion        TIMESTAMP,
    gestionada_por       INTEGER,            -- FK usuarios: quién la gestionó
    reasignada           INTEGER DEFAULT 0,
    nuevo_destino_id     INTEGER,            -- FK usuarios: destino reasignado (trazabilidad)
    reasignada_por       INTEGER,            -- FK usuarios: líder que reasignó
    fecha_reasignacion   TIMESTAMP
);
```

Índices: `idx_envios_destino (destino_id)`, `idx_envios_equipo (equipo_id)`,
`idx_envios_fecha (fecha_envio)`, `idx_envios_solicitud (solicitud_id)`.

---

## 3. Backend — Endpoints

### 3.1 `GET /api/equipos/agentes-con-lider`
Devuelve los **agentes que tienen líder** (para el selector). Excluye al propio usuario.
Incluye métricas de velocidad y `es_recomendado` para el badge "⚡ Más rápido".
Protección: `requiresAuth`.

### 3.2 `POST /api/gestiones-maestro/enviar-solicitudes`
Body: `{ destino_id, solicitudes_ids: [], comentario? }`
1. Valida que el remitente es un agente **sin líder** (no-superadmin operativo), que el
   destino **tiene líder** y que `destino != remitente`.
2. Crea la campaña tripartita (`usuario_id=remitente`, `asignado_a=destino`,
   `equipo_id=equipo destino`, `estado='activa'`).
3. Inserta el puente semáforo y vincula `campana_id` en las solicitudes.
4. Inserta una fila por solicitud en `envios_solicitudes`.
5. Invalida caché (`invalidateAllCampanas`, dashboard del destino).
6. Notifica a **destino** y **líder del destino** + SSE + audit.
Protección: `requiresAuth`.

### 3.3 `POST /api/gestiones-maestro/:id/reasignar-agente`
Body: `{ nuevo_agente_id }`
1. Solo líder del `equipo_id` de la campaña (o superadmin).
2. `nuevo_agente_id` debe ser del mismo equipo.
3. `UPDATE gestiones_maestro SET asignado_a = nuevo_agente_id`.
4. Actualiza filas activas de `envios_solicitudes` (marca `reasignada`, conserva
   `destino_id`, registra `nuevo_destino_id`, `reasignada_por`, `fecha_reasignacion`).
5. Notifica a **remitente**, **destino original** y **nuevo destino** + SSE + audit.

### 3.4 Marcar gestionada al guardar gestión en campaña
Al registrar una gestión sobre una solicitud de una campaña (en `gestionesMaestro.controller.js`):
- Marca la fila correspondiente de `envios_solicitudes` como `gestionada=1`,
  `gestionada_por`, `fecha_gestion`.
- Si quien gestiona ≠ remitente, notifica al **remitente**.

---

## 4. Frontend

### Desktop (`public/desktop/js/solicitudes.js`)
- Botón **"➡️ Enviar a"** en la tarjeta de solicitud y en la barra de acciones al seleccionar
  varias (individual y múltiple).
- Modal "Enviar a" (`Modal.abrir`): carga `GET /api/equipos/agentes-con-lider`, lista de
  agentes con su equipo + badge "⚡ Más rápido", confirmar `POST enviar-solicitudes` → toast +
  limpieza + refresco.
- Campañas tripartitas: el líder ve "👤 Reasignar" (`abrirModalAsignarAgente`).

### Móvil (`public/movil/js/solicitudes.js`)
- Ídem con `crearModalMovil`/`cerrarModal` (NO asume `Modal`).
- Modal "Enviar a" full-screen y mismas acciones.

---

## 5. Métricas y recomendación de agente

Por agente con líder (a partir de `gestiones` + `envios_solicitudes`):
- **Volumen**: solicitudes recibidas por envío vs gestionadas.
- **Velocidad**: tiempo medio envío→gestión (`fecha_envio`→`fecha_gestion`) y ratio gestionadas.
- **Duración** promedio de llamada (`gestiones.duracion_seg`).
- **Score de rapidez**: menor tiempo medio envío→gestión y mayor ratio gestionadas → badge
  "⚡ Más rápido" en el selector.

---

## 6. Comandos de verificación

- `node --check` en cada archivo JS tocado.
- Probar local con `DATABASE_URL= NODE_ENV=development node app.js` (nunca contra producción)
  y `curl` (login → cookie → endpoints).
- Probar contra **SQLite y PostgreSQL** (el wrapper traga errores en SQLite).
- Respetar la conversión de placeholders (no reutilizar `$N`).

---

## 7. Archivos modificados/creados

| Archivo | Cambio |
|---|---|
| `src/config/initDb.js` | Nueva tabla `envios_solicitudes` (SQLite) |
| `src/config/initDb.pg.js` | Nueva tabla `envios_solicitudes` (PostgreSQL) |
| `src/controllers/equipos.controller.js` | `agentes-con-lider` + métricas |
| `src/controllers/gestionesMaestro.controller.js` | `enviar-solicitudes`, `reasignar-agente`, marcar gestionada |
| `src/routes/equipos.routes.js` | ruta `agentes-con-lider` |
| `src/routes/gestionesMaestro.routes.js` | rutas `enviar-solicitudes`, `reasignar-agente` |
| `public/desktop/js/solicitudes.js` | botón + modal "Enviar a" |
| `public/movil/js/solicitudes.js` | botón + modal "Enviar a" |
| `public/desktop/js/gestion-lote.js` | "👤 Reasignar" en campañas (si aplica) |
| `public/movil/js/gestion-lote.js` | "👤 Reasignar" en campañas (si aplica) |
| `public/desktop/solicitudes.html`, `public/movil/solicitudes.html` | Botón "Enviar a" en barras de selección |
| `public/css/solicitudes.css`, `public/desktop/css/solicitudes.css`, `public/movil/css/solicitudes-mobile.css` | Estilos `.btn-enviar` (desktop + móvil) |
| `public/css/gestion-lote.css` | Estilo `.campaña-btn-reasignar` |
| `docs/ESTADO-PROYECTO.md`, `docs/README.md` | Documentación |
