# Fix: Asignar campaña en móvil (el modal se cerraba solo) + mover agente entre líderes

> **Estado:** ✅ Implementada
> **Fecha:** 30/08/2026
> **Ámbito:**
> - Frontend móvil — `public/movil/js/gestion-lote.js`
> - Backend — `src/controllers/equipos.controller.js` (`moverUsuario`, `gestionesEquipo`)
> - Admin — `public/admin/js/admin.js` (botón "Mover Usuario")

---

## 1. Bug móvil: al asignar una campaña el modal se cierra solo

### 1.1 Contexto / problema

En la versión **móvil** (`/m/gestion-lote`), un líder al tocar "Asignar a agente" (o "Reasignar") veía el modal que **se cerraba solo y no podía asignar**. El mismo flujo **funcionaba en escritorio** (bug exclusivo de móvil).

### 1.2 Causa raíz

`public/movil/js/gestion-lote.js` reutiliza el **mismo nodo** `#campaña-bs-overlay` / `#campaña-bs-sheet` para el menú de la campaña y para los sub-sheets de asignar/reasignar/quitar. El flujo al tocar "Asignar a agente" era:

1. `onclick` → `cerrarBottomSheetCampana()` y luego `abrirModalAsignarAgenteMovil(...)`.
2. `cerrarBottomSheetCampana()` quitaba `.visible` y **programaba `overlay.innerHTML = ''` a los 300 ms**.
3. `abrirModalAsignarAgenteMovil()` reescribía el **mismo** `overlay.innerHTML` con la lista de agentes y lo animaba.
4. A los 300 ms el `setTimeout` pendiente del paso 2 **borraba el sheet de agentes** recién abierto → "se cierra el modal".

Escritorio **no** usa este patrón de hoja reutilizada (llama `asignarAgente` directo), por eso solo fallaba móvil.

Afectaba a los 3 sub-sheets que reutilizan `campaña-bs-overlay`: **Asignar a agente**, **Reasignar** y **Quitar asignación**. No afectaba a "Editar", "Agregar solicitudes" ni "Eliminar" (usan `#modal-generico`/`modal` aparte).

### 1.3 Cambio aplicado

En `public/movil/js/gestion-lote.js`:

- Nueva variable de módulo `_bsClearTimer` (guarda el id del timeout pendiente de limpieza) + helper `cancelarLimpiezaBottomSheet()`.
- `cerrarBottomSheetCampana()` guarda el id del `setTimeout` en `_bsClearTimer` (y se limpia al ejecutarse).
- Cada función que reabre el overlay (`abrirBottomSheetCampana`, `abrirModalAsignarAgenteMovil`, `abrirModalReasignarMovil`) llama a `cancelarLimpiezaBottomSheet()` **antes** de escribir `overlay.innerHTML`, evitando que un cierre anterior borre la hoja recién abierta.

Con esto cada hoja se cierra solo a propósito (botón ✕ / tap fuera / al confirmar), y la asignación/reasignación persiste.

---

## 2. Mover agente entre líderes (superadmin)

### 2.1 Contexto

Un superadmin puede mover un agente de un líder a otro mediante `POST /api/equipos/:id/mover-usuario` (solo superadmin). El endpoint ya existía, pero tras el movimiento **faltaba** ajustar la visibilidad de campañas y gestiones del agente transferido.

### 2.2 Cambio en `moverUsuario` (`src/controllers/equipos.controller.js`)

Dentro de la transacción existente (tras el `INSERT` de la nueva membresía y antes del `COMMIT`):

1. **Des-asignar al agente de campañas ajenas:**
   `UPDATE gestiones_maestro SET asignado_a = NULL WHERE asignado_a = <agente>`
   → el agente deja de ver las campañas de otros líderes que le estaban asignadas (vuelven a su líder original). Coherente con "solo las campañas que el agente creó son de él".

2. **Remapear sus campañas propias al equipo destino:**
   `UPDATE gestiones_maestro SET equipo_id = <destino> WHERE usuario_id = <agente>`
   → el **nuevo líder** puede ver y supervisar las campañas que el agente creó (`usuario_id` no cambia; el agente las conserva).

(Las gestiones de `gestiones` están atadas a `usuario_id`, no a equipo, así que el propio agente conserva su historial; las campañas se conservan por `usuario_id`/`asignado_a`.)

### 2.3 Restringir historial de gestiones para el nuevo líder — opción B

`gestionesEquipo` (`GET /api/equipos/:id/gestiones`) mostraba a un líder **todo** el historial de gestiones de los miembros, incluido el de un agente **recién transferido** (el historial previo del líder anterior). Se añade:

```
WHERE eu.equipo_id = $1 AND eu.fecha_salida IS NULL
  AND g.fecha_gestion >= eu.fecha_ingreso
```

Como `moverUsuario` inserta la nueva membresía con `fecha_ingreso = CURRENT_TIMESTAMP`, el **nuevo líder solo ve las gestiones posteriores al movimiento** (opción B elegida). El **líder anterior** ya pierde al agente automáticamente (su membresía tiene `fecha_salida` → no nula). Para miembros establecidos, `fecha_ingreso` es su fecha original de ingreso, así que no pierden historial.

### 2.4 Fix del botón "Mover Usuario" en el admin

El botón "🔄 Mover Usuario" del panel de admin estaba **roto** por desajuste frontend/backend:

- Frontend enviaba `PUT /api/equipos/${equipoActualId}/mover-usuario` con body `{usuario_id, equipo_destino_id}`.
- Backend solo registra `POST` y usa `:id` de la URL como equipo **destino**, leyendo `{usuario_id, es_lider}` (ignoraba `equipo_destino_id`).

Corregido en `public/admin/js/admin.js` (`moverUsuario()`):

- Método `PUT` → **`POST`**.
- URL → `/api/equipos/${equipoDestinoId}/mover-usuario` (el **equipo destino** seleccionado).
- Body → `{ usuario_id, es_lider: false }` (se mueve un agente, no el líder; se quita `equipo_destino_id` que sobraba).
- Tras el movimiento se recarga la vista del equipo origen (`verEquipo(equipoActualId, ...)`).

---

## 3. Verificación

- `node --check` de los archivos modificados: `public/movil/js/gestion-lote.js`, `src/controllers/equipos.controller.js`, `public/admin/js/admin.js` ✓.
- Prueba local en SQLite (`DATABASE_URL= NODE_ENV=development node app.js`) con **Node 22** (ABI de `better-sqlite3`).
- **Móvil** (`?movil=1`): asignar, reasignar y quitar asignación de una campaña → el modal ya no se cierra solo y la asignación persiste.
- **Mover usuario** (superadmin): mover un agente a otro equipo → sus campañas propias quedan con `equipo_id = destino` (visibles para el nuevo líder), las campañas ajenas quedan `asignado_a = NULL`, y `gestionesEquipo` del destino solo muestra gestiones posteriores al movimiento.
- **Importante:** no ejecutar el movimiento contra la Postgres de producción; solo SQLite local.

---

## 4. Nota de alcance

- El sub-sheet móvil (`campaña-bs-*`) es solo de `movil/gestion-lote.js`; el fix no toca `public/js/gestion-campana.js` ni el desktop.
- El movimiento de agente solo lo ejecuta un **superadmin** (rutas `requiresRole('superadmin')`).
- El remapeo de campañas y la restricción de gestiones se aplican al mover un usuario: no cambian el comportamiento de agentes/líderes establecidos.

---

## 5. Archivos tocados

- `public/movil/js/gestion-lote.js` — fix modal móvil (timer de limpieza del overlay).
- `src/controllers/equipos.controller.js` — `moverUsuario` (des-asignar + remapeo) y `gestionesEquipo` (filtro por `fecha_ingreso`).
- `public/admin/js/admin.js` — botón "Mover Usuario" (POST + equipo destino).
