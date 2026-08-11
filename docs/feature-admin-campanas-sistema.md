# Feature: Campañas "Asignadas por el sistema" (SuperAdmin)

**Fecha:** Agosto 2026  
**Ámbito:**
- `src/controllers/gestionesMaestro.controller.js` (`crearCampanaSistema`)
- `src/routes/admin.routes.js` (`POST /api/admin/campanas`)
- `src/config/initDb.pg.js`, `src/config/initDb.js` (columna `es_sistema`, SCHEMA_VERSION 6)
- `public/admin/index.html`, `public/admin/js/admin.js` (checkbox + modal)
- `public/desktop/js/gestion-lote.js`, `public/movil/js/gestion-lote.js` (badge)
**Estado:** Implementado

## Problema

Cuando el superadmin asignaba solicitudes a un usuario creando una campaña, la
campaña aparecía como **una más** (con botón de editar/eliminar/asignar) y el
**líder del equipo del usuario la veía**, porque una campaña normal lleva
`equipo_id` y aparece en el listado del líder. No había forma de entregar
solicitudes "desde arriba" sin que el líder interviniera.

## Solución

1. Nueva columna `gestiones_maestro.es_sistema INTEGER DEFAULT 0`.
   - Migración idempotente en `initDb.pg.js` (ADD COLUMN IF NOT EXISTS + fallback)
     y en `initDb.js` (SQLite). `SCHEMA_VERSION = 6`.
2. `POST /api/admin/campanas` (solo superadmin, detrás del `requiresRole` de
   `admin.routes.js`): crea la campaña con:
   - `equipo_id = NULL` → **el líder NO la ve** (los listados de equipo filtran
     por `equipo_id`; el usuario destino sí la ve vía `gm.usuario_id = me`).
   - `es_sistema = 1` → la UI la etiqueta como "Asignada por el sistema".
   - Valida que el usuario destino exista y esté activo, normaliza/deduplica
     los IDs, inserta el puente de semáforo `sin_clasificar`, vincula
     `solicitudes.campana_id` e invalida la caché de campañas.
3. UI SuperAdmin → Tab **Solicitudes**:
   - Columna de checkboxes + "seleccionar todas" (página actual).
   - Botón **🚀 Crear campaña** (se habilita al seleccionar ≥ 1).
   - Modal: usuario destino, nombre, descripción, fecha límite y conteo de
     solicitudes seleccionadas.
4. Landing (`gestion-lote`) desktop y móvil: badge **🤖 Asignada por el
   sistema** en las tarjetas, el popover del desktop y el bottom-sheet móvil.
   El header de detalle (desktop) también lo muestra.

## API

| Método | Ruta | Auth | Body |
|--------|------|------|------|
| POST | `/api/admin/campanas` | superadmin | `{ usuario_id, nombre, descripcion, fecha_limite, solicitudes_ids: [] }` |

Respuesta: `{ id, mensaje, total_solicitudes }`.

## Notas

- La campaña creada **no** se asigna a un agente (`asignado_a = NULL`): la ve el
  usuario destino y la gestiona él.
- Dedupe por cédula/ID igual que el importador: `normalizarIdsSolicitud` elimina
  duplicados.
- El badge funciona porque `getGestionesMaestro` / `getGestionMaestroById`
  usan `SELECT gm.*`, que ya incluye `es_sistema`.
- Caché: `cache.invalidateAllCampanas()` tras crear, para que el nuevo badge
  aparezca de inmediato.
