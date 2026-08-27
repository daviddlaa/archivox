# Fix: Campañas en vivo — SSE `campanas.updated` (crear / renombrar / eliminar)

> **Estado:** ✅ Implementada
> **Fecha:** 28/08/2026
> **Ámbito:** Backend — `src/controllers/gestionesMaestro.controller.js` · Frontend — `public/js/notificaciones-dashboard.js`

---

## 1. Problema

Al **eliminar** una campaña (y también al crearla o renombrarla), el cambio no se propagaba **en vivo** a las páginas/ventanas abiertas: la grid de campañas (`/gestion-lote` desktop y `/m/gestion-lote` móvil) seguía mostrando el dato obsoleto hasta recargar manualmente o esperar el polling del dashboard (60 s).

El refresco **dentro de la pestaña que ejecuta la acción** sí funcionaba (el frontend llamaba `cargarListaCampanas()` tras el `DELETE` y el backend invalidaba `cache.invalidateAllCampanas()`), pero el servidor **nunca avisaba por SSE** al resto de clientes conectados. La infraestructura para ello ya existía y estaba cargada en ambas plataformas (`public/js/notificaciones-dashboard.js` + `notificationBus`), pero `deleteGestionMaestro`/`createGestionMaestro`/`updateGestionMaestro` no emitían ningún evento.

---

## 2. Cambios aplicados

### 2.1 Backend — Emisión del evento en los 3 endpoints (`gestionesMaestro.controller.js`)

Se importa `notificationBus` y, junto a cada `cache.invalidateAllCampanas()`, se emite `campanas.updated` (broadcast global, mismo patrón que `count.updated`; cada grid hace su refetch y el servidor filtra por acceso):

```javascript
// Tras crear (también invalida caché)
notificationBus.emitir('campanas.updated', { accion: 'creada', id: gestion_id, nombre, timestamp });

// Tras renombrar/actualizar
notificationBus.emitir('campanas.updated', { accion: 'renombrada', id: Number(id), nombre, timestamp });

// Tras eliminar
notificationBus.emitir('campanas.updated', { accion: 'eliminada', id: Number(id), timestamp });
```

### 2.2 Frontend — Listener SSE compartido (`notificaciones-dashboard.js`)

Nuevo listener `campanas.updated` en `iniciarSSE()` (script compartido, cargado por desktop **y** móvil — un solo cambio cubre ambas plataformas):

- **Refresco en vivo:** si la página define `cargarListaCampanas()` (global en `desktop/js/gestion-lote.js` y `movil/js/gestion-lote.js`), se invoca con debounce de 150 ms para coalescer ráfagas. En páginas sin grid (ej. `solicitudes.html`) es un no-op.
- **Campaña abierta eliminada:** si `window.gestionId` coincide con el `id` eliminado, se redirige a la landing (`/gestion-lote` o `/m/gestion-lote` según `pathname`), evitando quedar con una campaña borrada en pantalla.

---

## 3. Verificación

- `node --check` OK en `gestionesMaestro.controller.js` y `notificaciones-dashboard.js`.
- Dev local (SQLite): con un cliente SSE autenticado conectado a `/api/admin/notificaciones/stream`, se creó → renombró → eliminó una campaña vía API y el stream recibió los 3 eventos:

```
event: campanas.updated
data: {"accion":"creada","id":17,"nombre":"SSE Prueba",...}
data: {"accion":"renombrada","id":17,"nombre":"SSE Prueba Renombrada",...}
data: {"accion":"eliminada","id":17,...}
```

- `cargarListaCampanas` y `gestionId` confirmados como globales en ambos `gestion-lote.js`.
- Artefactos de prueba eliminados de la BD local; sin tocar producción.