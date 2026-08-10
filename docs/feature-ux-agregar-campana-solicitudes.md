# Feature: UX "Agregar a Campaña" — Solicitudes (escritorio + móvil)

**Fecha:** Agosto 2026
**Ámbito:** `public/desktop/js/solicitudes.js`, `public/movil/js/solicitudes.js`

---

## Resumen

Se mejoró el flujo **"Agregar a Campaña"** en la página de Solicitudes (desktop y móvil) con tres cambios:

1. **Botón de confirmación arriba, junto al título** del modal (antes quedaba al final de la lista de campañas, fuera del alcance mientras se navegaba).
2. **Toast de éxito** en lugar de `alert` al enviar, indicando la cantidad y el nombre de la campaña.
3. **Limpieza de selección + refresco en vivo** de la lista, de modo que el badge de campaña en las cards se actualice sin recargar la página.

En móvil el envío **ya no redirige** a `/m/gestion-lote?id=...`; se queda en Solicitudes con el mismo comportamiento que escritorio.

---

## Problema original

- El modal `Agregar a Campaña` renderizaba el botón confirmar **después de la lista de campañas** (`renderizarListaCampanasDesktop`/`renderizarListaCampanasMovil`). Con muchas campañas, el usuario debía hacer scroll hasta el final para confirmar.
- Tras enviar, `confirmarAgregarCampanaDesktop`/`confirmarAgregarCampanaMovil` mostraban `alert(...)` y cerraban el modal, pero **no refrescaban la lista**: el badge `nombre_campana` de las cards no se actualizaba en vivo.
- La selección quedaba activa y no había feedback visual del resultado.
- En móvil se navegaba automáticamente a la campaña, perdiendo el contexto de la selección.

---

## Cambios implementados

### 1. Modal con botón arriba (coherencia escritorio ↔ móvil)

Ambos modales se reestructuraron como **columna flex** con dos zonas:

- **Cabecera fija** (flex-shrink: 0):
  - Fila 1: título `➕ Agregar a Campaña` (izquierda) + botón `➕ Agregar a esta campaña` (derecha).
  - Fila 2: pill con el contador "N solicitudes seleccionadas" + botón `Cancelar`.
- **Lista de campañas scrollable** (`flex: 1; min-height: 0; overflow-y: auto`) debajo.

Así el botón de confirmación y el contador **quedan siempre visibles** mientras el usuario se desplaza por las campañas.

- **Desktop:** el wrapper interno usa `max-height: 80vh; overflow: hidden` para que scrolleé solo la lista y no el modal completo (`.modal-content` ya tenía `max-height: 90vh; overflow-y: auto`).
- **Móvil:** el overlay full-screen (`crearModalMovil`) pasa a `height: 100vh; display: flex; flex-direction: column; overflow: hidden`.

`renderizarListaCampanasDesktop`/`renderizarListaCampanasMovil` ya **no** añaden el botón confirmar al final; solo pintan las tarjetas de campaña. Cada tarjeta ahora incluye `data-nombre` para recuperar el nombre de la campaña seleccionada.

### 2. Toast de éxito con nombre de campaña

Al confirmar el envío (respuesta OK):

```js
cerrarModal();
cancelarSeleccion();          // desktop
// o
cancelarSeleccionMovil();     // móvil
queryCache.clear();
buscarEnServidor(true);
mostrarToastSimple('✅ ' + enviadas + ' solicitudes enviadas a la campaña "' + nombreCampana + '"');
```

- Se usa `mostrarToastSimple()` (definido en `public/js/notificaciones-dashboard.js`, cargado por ambas páginas).
- El nombre de la campaña se guarda en `campanaSeleccionadaNombre` (desktop) / `campanaSeleccionadaNombreMovil` (móvil) al seleccionar, leyéndolo de `data-nombre` — sin cambios en el backend.
- La cantidad mostrada usa `resultado.agregados` si viene en la respuesta, o la selección completa si no.
- Los errores siguen usando `alert`.

### 3. Refresco en vivo del badge de campaña

Después del envío exitoso:

1. `cerrarModal()` — cierra el modal.
2. `cancelarSeleccion()` / `cancelarSeleccionMovil()` — limpia checkboxes, filas y cards `.seleccionada`, y reinicia contadores/action bar.
3. `queryCache.clear()` — invalida la caché de resultados del cliente (Map con TTL).
4. `buscarEnServidor(true)` — vuelve a cargar la lista respetando los filtros actuales (sin filtros → `cargarLoteInicial()`); la API devuelve el `nombre_campana` ya actualizado, así el badge aparece en las cards sin recargar.

---

## Archivos modificados

- `public/desktop/js/solicitudes.js`
  - `abrirModalAgregarCampana` — nuevo layout flex; resetea `campanaSeleccionadaId`/`campanaSeleccionadaNombre`.
  - `renderizarListaCampanasDesktop` — ya no agrega botón confirmar; tarjetas con `data-nombre`.
  - `seleccionarCampanaDesktop` — guarda `campanaSeleccionadaNombre`.
  - `confirmarAgregarCampanaDesktop` — toast + limpieza + refresco.
- `public/movil/js/solicitudes.js`
  - `abrirModalAgregarCampanaMovil` — nuevo layout flex (full-screen); resetea variables de selección.
  - `renderizarListaCampanasMovil` — ya no agrega botón confirmar; tarjetas con `data-nombre`.
  - `seleccionarCampanaMovil` — guarda `campanaSeleccionadaNombreMovil`.
  - `confirmarAgregarCampanaMovil` — toast + limpieza + refresco; elimina la redirección a `/m/gestion-lote`.

## Funciones existentes reutilizadas

- `mostrarToastSimple(mensaje)` — `public/js/notificaciones-dashboard.js`.
- `cancelarSeleccion()` — `public/desktop/js/solicitudes.js` (línea ~530).
- `cancelarSeleccionMovil()` — `public/movil/js/solicitudes.js` (línea ~107).
- `queryCache` / `buscarEnServidor(resetOffset)` — presente en ambos `solicitudes.js`.

---

## Verificación

- `node --check` OK en `public/desktop/js/solicitudes.js` y `public/movil/js/solicitudes.js`.
- Prueba manual: seleccionar solicitudes → `➕ Agregar a Campaña` → elegir campaña (el botón queda arriba habilitado) → Agregar → toast con nombre de campaña, selección limpia y badge actualizado en las cards sin recargar.
