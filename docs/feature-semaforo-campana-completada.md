# Feature: Campaña Completada sale del semáforo

**Fecha:** Agosto 2026  
**Ámbito:** `public/desktop/js/gestion-lote.js`, `public/desktop/gestion-lote.html`, `public/movil/js/gestion-lote.js`, `public/movil/gestion-lote.html`

---

## Resumen

Cuando una campaña tiene `estado = Completada` (o `completada`), el **semáforo se oculta** en la página de detalle (`gestion-lote`, desktop y móvil) y se muestra la nota:

> ✅ Campaña completada — semáforo desactivado

Así las gestiones de esa campaña **no entran en los contadores ni en los filtros del semáforo**. Al volver a `Activa`, el semáforo reaparece con sus datos intactos (no se borra el puente `gestiones_maestro_solicitudes`).

---

## Problema original

- El semáforo solo excluía solicitudes cuya última gestión era `tipo_gestion = 'Completada'`.
- Si la **campaña** estaba en estado `Completada` pero aún había solicitudes pendientes/en seguimiento, seguían contando y filtrando en el semáforo.
- Editar el estado a Completada no actualizaba en vivo la UI del semáforo de la campaña abierta.

---

## Comportamiento

| Situación | UI |
|-----------|-----|
| Campaña `Activa` | Semáforo visible, contadores y filtros normales |
| Campaña `Completada` | Semáforo oculto + nota verde; filtros de semáforo desactivados |
| Búsqueda / filtro por tipo de gestión | Siguen disponibles |
| Re-activar a `Activa` | Semáforo vuelve con los mismos valores |

Detección: `/^completad[ao]$/i` sobre `datosGestion.estado` (tolera mayúsculas/minúsculas).

---

## Implementación

### Desktop
- HTML: `#semaforo-completada-note` en el rail, tras `.semaforo-meta`.
- JS: global `campanaCompletada` + `aplicarEstadoSemaforoCompletada()`:
  - Oculta `#semaforo-barra`, `#btn-semaforo-todos`, `#btn-filtro-semaforo-chip`.
  - Muestra la nota; resetea `filtroSemaforo`.
- Llamadas: `cargarDatosGestion`, `guardarEdicionCampana` (si es la campaña abierta).
- Defensivo: `actualizarBarraSemaforo` usa conteo 0; `setFiltroSemaforo` no-op si completada; `renderizarSolicitudes` excluye filtro semáforo.

### Móvil
- HTML: `#semaforo-completada-note-movil` tras `.semaforo-mobile-row`.
- JS: `aplicarEstadoSemaforoCompletadaMovil()`:
  - Oculta solo `#semaforo-mobile-scroll` (conserva chip Consejo + fila búsqueda/estado).
  - Muestra la nota; resetea `filtroSemaforoMovil`.
- Llamadas: `cargarDatosGestionMovil`, `guardarEdicionCampanaMovil` (si es la campaña abierta).
- Defensivo: `obtenerConteoSemaforoMovil` devuelve 0; `setFiltroSemaforoMovil` no-op; filtro en `renderizarSolicitudes`.

### Sin backend
No se eliminan filas del puente semáforo. Solo UI + filtros en cliente.

---

## Verificación

- `node --check` en ambos `gestion-lote.js`.
- Manual: editar campaña → estado Completada → semáforo oculto + nota; volver a Activa → semáforo restaurado.
