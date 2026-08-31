# Fix: No perder foco/scroll al guardar gestiones en campañas (llamar 📞 y seguimiento)

> **Estado:** ✅ Implementada
> **Fecha:** 30/08/2026
> **Ámbito:** Frontend — `public/desktop/js/gestion-lote.js`, `public/movil/js/gestion-lote.js`, `public/js/gestion-campana.js`

---

## 1. Contexto / problema

En la página de campañas (`/gestion-lote` desktop y `/m/gestion-lote` móvil), al **guardar una gestión** —tanto desde el modal de **llamar** (popup 📞 con temporizador y las "nuevas opciones" de resultado + comentario) como desde el modal de **seguimiento** con comentario—, la página **saltaba arriba / perdía el foco**, y las solicitudes en curso "se iban a otro lado".

Había dos causas:

1. **Preservación de scroll rota en ambas plataformas.** `renderizarSolicitudes` guardaba/restauraba el scroll leyendo `container.scrollTop` de `#lista-solicitudes`, pero **ese elemento no es el que scrollea**:
   - Escritorio: el scroll real está en `.contenido` (`<main>`, `overflow-y:auto`, `public/desktop/css/base.css:44`); la lista es un `grid` (`public/css/gestion-lote.css:296`) → `scrollTop` siempre `0`.
   - Móvil: el scroll real está en la ventana/documento (`.sol-list` no tiene `overflow` ni altura fija) → `scrollTop` siempre `0`.

   Como `scrollTop` siempre era `0`, la restauración nunca funcionaba y tras **cualquier re-render** la lista saltaba al tope. **Esto afectaba tanto al seguimiento como a la llamada, en desktop y móvil.**

2. **El temporizador de llamada (móvil) hacía un refetch completo destructivo.** Al guardar la llamada, `onGuardada` llamaba a `cargarDatosGestionMovil()`, que además de recargar toda la lista:
   - **Reseteaba `filtroSemaforoMovil = null`** (`movil/gestion-lote.js`), perdiendo el filtro activo ("Sin clasificar", "Encaminada", "Seguimiento", "En espera"). De ahí que "las solicitudes en curso se van a otro lado".
   - Volvía a pedir la campaña al servidor y repintaba todo (parpadeo + salto).

   En cambio, el flujo de **seguimiento** usaba la lógica compartida `GestionCampana.guardarGestionIndividual` (`public/js/gestion-campana.js`) que actualiza la tarjeta **en memoria** (`aplicarGestionLocal`) conservando filtros y estado.

---

## 2. Cambios aplicados

### 2.1 Preservar scroll en el contenedor correcto

- **Escritorio** (`desktop/js/gestion-lote.js`, `renderizarSolicitudes`): se lee/restaura `scrollTop` de `.contenido` (con `scrollHeight` para validar), no de la lista.
- **Móvil** (`movil/js/gestion-lote.js`, `renderizarSolicitudes`): se usa `window.scrollY` al inicio y `window.scrollTo(0, scrollY)` al final, ya que el scroll está en la ventana.

Esto arregla el salto al tope para seguimiento, comentarios y cualquier re-render en ambas plataformas.

### 2.2 Temporizador de llamada sin refetch completo

- Se expone `GestionCampana.aplicarGestionLocal` en el API público de `public/js/gestion-campana.js` (antes era privada) para reutilizar la misma actualización en memoria que usa el seguimiento → única fuente de verdad.
- En `movil/js/gestion-lote.js`, el `onGuardada` del popup de llamada ya **no** llama a `cargarDatosGestionMovil()`. En su lugar:
  1. Si la respuesta incluye la gestión creada (`data.tipo_gestion`), aplica en memoria los campos `gestion_id`, `tipo_gestion`, `gestion_obs` y `fecha_gestion`.
  2. Re-renderiza la lista con `renderizarSolicitudes(todasLasSolicitudes, true)` + `actualizarProgreso()`, conservando **filtro de semáforo, búsqueda, scroll y foco** (mismo patrón que el seguimiento).
- Como `/api/excel/gestiones` devuelve `data` con esos campos (`id`, `tipo_gestion`, `observacion`, `fecha_gestion`), la tarjeta refleja el cambio sin recargar la página. El backend ya persistió la gestión.

---

## 3. Verificación

- `node --check` de los 3 archivos modificados ✓.
- Arranque local en SQLite (`DATABASE_URL= NODE_ENV=development node app.js`) con **Node 22** (el proyecto compila `better-sqlite3` para ese ABI) ✓.
- E2E API local: login → `POST /api/excel/gestiones` (tipo `Llamada`, `resultado`, `duracion_seg`, comentario) → la respuesta `data` incluye `id`, `tipo_gestion`, `observacion`, `fecha_gestion`; la campaña devuelve la solicitud con `tipo_gestion='Llamada'` ✓.
- Manual recomendado (desktop y móvil, con filtros de semáforo y búsqueda activos): guardar seguimiento con comentario y guardar llamada con resultado + comentario → el foco/scroll y el filtro se conservan.

---

## 4. Nota de alcance

El popup 📞 con "nuevas opciones" de resultado + comentario (`public/js/temporizador-llamada.js`) **solo está cargado en móvil** (`movil/gestion-lote.html` y `movil/solicitudes.html`). En escritorio la llamada se registra por el modal de gestión con tipo "Llamada" (que ya usaba `guardarGestionIndividual`). Con el arreglo de scroll (punto 2.1) y el arreglo del temporizador (punto 2.2), ambos flujos conservan el foco de forma **coherente** entre móvil y desktop.
