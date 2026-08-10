# Feature: Rediseño Header + Filtros — Solicitudes Escritorio

**Fecha:** Agosto 2026
**Ámbito:** `public/desktop/solicitudes.html`, `public/desktop/js/solicitudes.js`, `public/desktop/css/solicitudes.css`

---

## Resumen

Se reorganizó el bloque superior de la página de solicitudes de escritorio para **ganar espacio vertical y dejar subir las tarjetas**. Antes la página apilaba 4 bloques (header con botones, KPIs, filtros, buscador); ahora son 2: un **header unificado** y una **toolbar única de filtros**.

---

## Problemas resueltos

| Problema | Antes | Después |
|----------|-------|---------|
| KPIs (Total/Mostrando/Selecc) ocupaban una fila completa | Fila propia con tarjetas grandes | Pills compactas dentro del header |
| 3 botones de acción (Dashboard/Nueva Solicitud/Importar Excel) ocupaban espacio del header | Botones a la vista | Menú desplegable ⋮ |
| Estado/Segmento como botones chips que se desbordaban | Botones en fila propia | Selects desplegables compactos |
| 3 filas de controles antes de las tarjetas | Header + KPIs + filtros + buscador | Header + 1 toolbar |

---

## Cambio 1 — Header unificado

**Antes:**
```
📋 Solicitudes                     [🔔] [🏠 Dashboard] [➕ Nueva Solicitud] [📤 Importar Excel]
Consulta y filtra los registros importados

[387 Total]  [100 Mostrando]  [0 Selecc]
```

**Después:**
```
📋 Solicitudes      [387 Total] [100 Mostrando] [0 Selecc]        🔔   [⋮]
Consulta y filtra los registros importados
```

- Los **KPIs** (`#totalRegistros`, `#mostrando`, `#seleccionadas-count`) se movieron al centro del header como pills `.kpi-inline` con el valor en negrita grande.
- La **campana 🔔** queda sola, siempre visible (fuera del menú), porque las notificaciones deben notarse sin clics extra.
- El **menú desplegable ⋮** (`.menu-acciones`) contiene: 🏠 Dashboard, ➕ Nueva Solicitud, 📤 Importar Excel.
  - Se abre/cierra con `toggleMenuAcciones(event)` (usa `stopPropagation`).
  - Se cierra al hacer clic fuera (listener en `document` con `closest('.menu-acciones')`), con la tecla `Escape`, o al elegir una opción (`cerrarMenuAcciones`).

**HTML clave:**
```html
<div class="page-header-center">
    <div class="kpis-inline">
        <span class="kpi-inline">Total <span class="kpi-valor" id="totalRegistros">0</span></span>
        <span class="kpi-inline">Mostrando <span class="kpi-valor" id="mostrando">0</span></span>
        <span class="kpi-inline">Selecc <span class="kpi-valor" id="seleccionadas-count">0</span></span>
    </div>
</div>
<div class="header-acciones">
    <div id="notif-boton" class="notif-boton">...</div>  <!-- campana -->
    <div class="menu-acciones">
        <button id="btn-menu-acciones" class="menu-acciones-btn" onclick="toggleMenuAcciones(event)">⋮</button>
        <div id="menu-acciones-dropdown" class="menu-acciones-dropdown">
            <a href="/desktop/index.html">🏠 Dashboard</a>
            <a href="/desktop/index.html#nueva-solicitud">➕ Nueva Solicitud</a>
            <a href="/desktop/importar.html">📤 Importar Excel</a>
        </div>
    </div>
</div>
```

---

## Cambio 2 — Toolbar única de filtros

Una sola fila con todo visible. Los filtros se aplican **automáticamente al cambiar** (sin botón Aplicar):

```
[🔍 Buscar por id, cédula, nombre...] [📌 Estado ▾] [🏷️ Segmento ▾] [📅 Desde] [📅 Hasta] [👤 Vendedor] [✓ Seleccionar todo] [✕ Limpiar]
```

- **Estado y Segmento** dejaron de ser botones chips y ahora son **selects** (`#filtro-estado-select`, `#filtro-segmento-select`) llenados por `cargarEstados()`/`cargarSegmentos()` (que ahora añaden `<option>` en lugar de botones). Preservan `estadoActual`/`segmentoActual` para restaurar la selección tras recargar.
- **Filtros de líder** (Desde/Hasta/Vendedor, contenedor `#filtrosLider`) siguen mostrándose solo para líderes vía `mostrarFiltrosLider()`, pero ahora viven en la misma fila.
- **Eventos:** en `configurarEventosCheckboxes()` los selects y las fechas usan `onchange = aplicarFiltrosLider` (auto-aplicar); el vendedor usa `oninput` con debounce de 400 ms; el buscador conserva su debounce.
- **Limpiar:** `limpiarFiltros()` resetea buscador, ambos selects, fechas y vendedor, y borra `sessionStorage` (`sol_filtro_*`), conservando los selectores "Todos".
- **Seleccionar todo:** el botón `✓ Seleccionar todo` se conservó (usa `marcarSeleccionadas()`); ya no se oculta con las selecciones (la barra de selección tipo Gmail sigue apareciendo al marcar tarjetas).

---

## Cambio 3 — Estilos nuevos (CSS)

Añadidos al final de `public/desktop/css/solicitudes.css`:

| Selector | Propósito |
|----------|-----------|
| `.kpis-inline` / `.kpi-inline` | Pills compactas redondeadas con hover (elevación sutil) |
| `.menu-acciones` / `.menu-acciones-btn` | Botón ⋮ con posicionamiento relativo |
| `.menu-acciones-dropdown` | Dropdown con sombra, animación de entrada y links con hover |
| `.toolbar-filtros` | Fila única flex con wrap, buscador `flex: 1` |
| `.toolbar-filtros .filtro-input` | Inputs/selects compactos con foco azul |

---

## Archivos involucrados

| Archivo | Cambio |
|---------|--------|
| `public/desktop/solicitudes.html` | Header con KPIs + campana + menú ⋮; toolbar única; se eliminó la vieja barra `acciones-unificado` (Exportar/Marcar) |
| `public/desktop/js/solicitudes.js` | `cargarEstados`/`cargarSegmentos` llenan selects; eventos con auto-aplicar; `limpiarFiltros` actualizado; nuevas `toggleMenuAcciones`/`cerrarMenuAcciones`; se eliminó `limpiarFiltrosLider()` (código muerto) |
| `public/desktop/css/solicitudes.css` | Estilos del header, KPIs inline, menú desplegable y toolbar |

---

## Corrección (Agosto 2026): filtros de fecha/vendedor aplicando en conjunto

Se corrigió que el filtro de fecha (Desde/Hasta) y vendedor no se aplicara junto con Estado/Segmento (mostraba todas las activadas en vez de solo las del mes):

1. **Clave de caché incompleta (causa raíz).** El caché del cliente (TTL 30s) usaba `q|estado|segmento|offset` sin las fechas ni el vendedor. Si primero filtrabas por Estado y luego elegías el mes (dentro de 30s), la caché devolvía el resultado anterior sin mandar las fechas al servidor. Ahora `getCacheKey(q, estado, segmento, offset, fechaDesde, fechaHasta, vendedor)` incluye **todas** las dimensiones, y `buscarEnServidor` las pasa a `getFromCache`/`setCache`.
2. **Filtros persistidos no re-aplicados al recargar.** `init()` ahora detecta `estadoActual/segmentoActual/fechaDesdeActual/fechaHastaActual/vendedorActual` en `sessionStorage` y ejecuta `buscarEnServidor(true)` tras `restaurarFiltrosUI()`, para que la lista coincida con la UI restaurada.

Detalle completo: `docs/informe-fix-filtros-fecha-solicitudes.md`.

## Verificación

- ✅ `node --check public/desktop/js/solicitudes.js` — sin errores de sintaxis.
- ✅ Llaves CSS balanceadas (346/346).
- ✅ Todos los IDs del HTML (`totalRegistros`, `mostrando`, `seleccionadas-count`, `cedula`, `filtro-estado-select`, `filtro-segmento-select`, `filtrosLider`, `fechaDesde`, `fechaHasta`, `filtroVendedor`, `seleccionar-todos`, `menu-acciones-dropdown`) existen una vez cada uno.
- ✅ Sin referencias huérfanas a los viejos contenedores de botones ni a `limpiarFiltrosLider`.
- ✅ Revisión de código: aprobada (única observación: código muerto `limpiarFiltrosLider`, ya eliminado).
- ⏳ Prueba visual en navegador pendiente (requiere login).

---

## Compatibilidad

- **Escritorio:** nueva estructura. **No se tocó la versión móvil** (tiene su propio HTML/JS/CSS).
- `mostrarFiltrosLider()` se conservó: líderes ven Desde/Hasta/Vendedor en la misma fila; el resto de usuarios no los ven.
- La barra de selección flotante (aparece al marcar tarjetas) sigue funcionando igual.
