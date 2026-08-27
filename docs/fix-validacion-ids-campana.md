# Fix: Validación de IDs numéricos en campañas + Eliminación de filtro `relaciones` en liberación

> **Estado:** ✅ Implementada
> **Fecha:** 28/08/2026
> **Ámbito:** Backend — `src/controllers/gestionesMaestro.controller.js`, `src/services/liberacion.service.js`, `src/services/liberacionScheduler.js`

---

## 1. Problema

### 1.1 IDs no numéricos en campañas

Al crear una campaña (`POST /api/gestiones-maestro`) o agregar solicitudes a una existente (`PUT /api/gestiones-maestro/:id/agregar-solicitudes`), el array `solicitudes_ids` se guardaba directamente en la BD **sin validar que los IDs fueran numéricos**.

Si un checkbox HTML no tiene atributo `value`, el browser usa `"on"` por defecto. Este artefacto se coló en la campaña 81 de Angelica:

```json
["352684","440212","448549","450270","468900","487234","491537","415141","416327","425407","on"]
```

Al intentar cargar la campaña, el endpoint `GET /api/gestiones-maestro/:id` intentaba buscar `id_solicitud = 'on'` en PostgreSQL (columna INTEGER), provocando:

```
invalid input syntax for type integer: "on"
→ 500 Error al buscar gestión
```

### 1.2 Filtro de `relaciones` en conteo de liberación

El conteo semanal de solicitudes liberadas (scheduler + endpoints) incluía un `NOT EXISTS` sobre la tabla `relaciones` que excluía solicitudes si existía una relación en estado `ALTA`. La tabla `relaciones` no tiene relación funcional con este conteo — solo deben participar `solicitudes` y `gestiones_maestro`.

Actualmente la diferencia era 0 (ninguna solicitud calificante tenía relación ALTA), pero el filtro podría causar exclusiones incorrectas en el futuro.

---

## 2. Cambios aplicados

### 2.1 Backend — Validación de IDs

En `src/controllers/gestionesMaestro.controller.js`, ambos endpoints ahora usan `normalizarIdsSolicitud()` (función existente que filtra IDs no numéricos, elimina duplicados y normaliza a enteros):

- **`POST /api/gestiones-maestro`** (crear campaña): se reemplaza la validación `Array.isArray` manual por `normalizarIdsSolicitud()`.
- **`PUT /api/gestiones-maestro/:id/agregar-solicitudes`** (agregar a campaña): se agrega `normalizarIdsSolicitud()` antes de procesar.

```javascript
// Antes
if (!solicitudes_ids || !Array.isArray(solicitudes_ids) || solicitudes_ids.length === 0) {
    return res.status(400).json({ error: 'Se requiere al menos una solicitud' });
}

// Después
solicitudes_ids = normalizarIdsSolicitud(solicitudes_ids);
if (solicitudes_ids.length === 0) {
    return res.status(400).json({ error: 'Se requiere al menos una solicitud válida' });
}
```

### 2.2 Backend — Eliminación de filtro `relaciones`

En `src/services/liberacion.service.js`, se eliminó el `NOT EXISTS` sobre `relaciones` del `buildWhereLiberacion()`:

```javascript
// Antes
AND COALESCE(${a}.no_aplica_credito, 1) = 1
AND NOT EXISTS (
    SELECT 1 FROM relationships r
    WHERE r.usuario_id = ${a}.usuario_id
      AND r.identificacion = ${a}.cedula
      AND r.estado_relacion = 'ALTA'
)

// Después
AND COALESCE(${a}.no_aplica_credito, 1) = 1
```

En `src/services/liberacionScheduler.js`, se hizo lo mismo en `getSolicitudesValidas()`.

### 2.3 Producción — Limpieza de dato

La campaña 81 se limpió manualmente: se eliminó `"on"` del array `solicitudes_ids` (11 → 10 solicitudes válidas).

---

## 3. Verificación

- `node --check` pasa en ambos archivos.
- Conteo de liberación en producción: sigue en **74** (sin cambio).
- Todas las campañas en producción verificadas: **0 con IDs inválidos**.
- La campaña 81 carga correctamente después de la limpieza.
