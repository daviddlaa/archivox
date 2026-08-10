# Feature: Vista móvil de Solicitudes — filtros colapsables, KPIs compactos, buscador con ✕ y fix del menú ⋮

**Fecha:** Agosto 2026
**Ámbito:** `public/movil/solicitudes.html`, `public/movil/css/solicitudes-mobile.css`,
`public/movil/js/solicitudes.js` (solo versión móvil; escritorio sin cambios)

---

## 1. Resumen

Rediseño de la experiencia móvil de Solicitudes en 3 frentes:

1. **Filtros:** leyenda "🔍 Filtros de búsqueda" encima, filtros principales en **una sola
   fila** y los filtros de **fecha (Desde/Hasta) colapsables** detrás de un toggle. Las fechas
   ahora están **disponibles para todos los usuarios** (antes solo Lider+); el filtro de
   **Vendedor sigue siendo solo Lider+**.
2. **Densidad:** KPIs **20% más compactos** (60→48 px de alto), selects de Estado/Segmento y
   buscador más pequeños, botón "Seleccionar todo" armónico con el buscador.
3. **Bug fix:** el **menú contextual ⋮ de las tarjetas se recortaba** (no dejaba ver las
   opciones Editar / No aplica / Eliminar). Se mitiga posicionándolo como `position: fixed`
   calculado desde el botón, para que nunca lo recorte el `overflow: hidden` de la card.

---

## 2. Cambios

### 2.1 `public/movil/solicitudes.html`

- Nueva **leyenda** `.filtros-leyenda` (🔍 Filtros de búsqueda) al tope del panel de filtros.
- Fila única de filtros: **📌 Estado + 🏷️ Segmento + ✕ Limpiar** (sin cambios de estructura).
- Nuevo **toggle colapsable** `.filtros-mas-toggle` (`id="filtrosMasToggle"`, chevron
  `filtrosMasChevron`, texto `filtrosMasTexto`) que envuelve la sección `#filtrosLider`
  (Desde / Hasta / Vendedor), oculta por defecto (`display:none`).
- El grupo de Vendedor ahora tiene `id="filtroGrupoVendedor"` para poder ocultarlo a roles
  no líder.
- Buscador: el input quedó envuelto en `.buscador-search-input-wrap` y se agregó el botón
  `btn-limpiar-busqueda` (✕) para borrar el texto.

### 2.2 `public/movil/css/solicitudes-mobile.css`

| Elemento | Antes | Ahora |
|----------|-------|-------|
| `.stats-grid-unificado` | gap 10px, padding 14/10 | gap 8px, padding 10/8 |
| `.stat-card-compacto` | min-height **60px**, padding 10/16, radio 14px | min-height **48px** (−20%), padding 8/10, radio 12px |
| `.stat-valor` | 22px | 18px |
| `.stat-etiqueta` | 10px, margin-top 2px | 9px, margin-top 1px |
| `.filtros-unificado` | padding 14/16 | padding 12/16 |
| `.filtro-select` | min-height 38px, padding 9/12, fuente 13px, radio 10px | min-height **32px**, padding 6/10, fuente 12px, radio 8px |
| `.btn-limpiar-movil` | min-height 38px | min-height **32px** |
| Buscador `input` | padding 14/18, fuente 16px, radio 14px | padding 10px 36px 10px 14px (espacio para ✕), fuente 14px, radio 12px |
| `#btn-seleccionar-todo` / `.btn-select-all` | min-height 48px, padding 14/16, radio 14px | min-height **38px**, padding 0 14px, radio 12px (armónico con el input) |
| `.card-dropdown-menu-movil` (menú ⋮) | z-index 100, min-width 150px, `overflow:hidden` | z-index **300**, min-width 170px, `overflow-y:auto`, `max-height:55vh` |

- Nuevos estilos: `.filtros-leyenda`, `.filtros-mas-toggle` (+ `:active`), `.filtros-chevron`,
  `.buscador-search-input-wrap`, `.buscador-clear-btn` (+ `.visible`, `:active`).

### 2.3 `public/movil/js/solicitudes.js`

- **Fechas para todos los usuarios:** `mostrarFiltrosLider()` se llama ahora siempre en
  `init()` (antes `if (_esLider)`). El grupo de Vendedor se oculta con
  `display:none` cuando el rol no es Lider+.
- **Filtros colapsables:** nuevas funciones `setFiltrosMasAbierto(abierto)` y
  `toggleFiltrosMasMovil()`. Si hay filtros de fecha/vendedor persistidos en `sessionStorage`
  de una sesión anterior, la sección se **auto-expande** al cargar; `limpiarFiltrosLider()`
  la **colapsa** al limpiar.
- **Búsqueda con fechas:** en `buscarEnServidor()` se eliminó el guard `if (_esLider)` para
  `fecha_desde`/`fecha_hasta` — ahora se envían siempre que tengan valor (el backend ya las
  aplicaba sin restricción de rol, filtradas dentro del `usuario_id` del usuario). El parámetro
  `vendedor` solo se envía si `vendedorActual` tiene valor (los no líderes nunca lo tienen).
- **Botón ✕ del buscador:** `actualizarBotonLimpiarBusqueda()` muestra/oculta el botón según
  haya texto (se llama en `oninput`, en `limpiarFiltrosLider()` y en `limpiarBusquedaMovil()`);
  `limpiarBusquedaMovil()` vacía el input, lo re-enfoca y relanza `buscarEnServidor(true)`.
- **Fix menú ⋮ (`toggleCardMenuMovil`):** antes era `position: absolute` abriendo hacia arriba
  dentro de la card, que tiene `overflow: hidden` → el menú se recortaba (sobre todo en la
  primera card visible). Ahora:
  1. Se calcula la posición del botón con `getBoundingClientRect()`.
  2. El menú se fija a nivel de **viewport** (`position: fixed`) alineado a la derecha del botón.
  3. **Abre hacia abajo** si hay espacio (`espacioAbajo >= 160px`) o **hacia arriba** si no,
     con clamp mínimo de 8px desde el borde superior.
  4. `z-index: 300` + `max-height: 55vh` con scroll como respaldo en pantallas pequeñas.
  Resultado: el menú siempre se ve completo y sus 3 opciones (✏️ Editar, 👎 No aplica, 🗑️
  Eliminar) quedan accesibles.

---

## 3. Qué NO cambió

| Elemento | Estado |
|----------|--------|
| Vista de escritorio de Solicitudes | Sin cambios (desktop tiene su propia copia de `solicitudes.js` y CSS) |
| Backend de búsqueda (`buscarSolicitudes`) | Sin cambios — ya aceptaba `fecha_desde`/`fecha_hasta` sin guard de rol |
| Lógica de búsqueda/filtros (cache, debounce, scroll infinito) | Sin cambios |
| Filtro de Vendedor para Lider+ | Sin cambios funcionales (solo se oculta el grupo para otros roles) |
| Estructura de las tarjetas de solicitud | Sin cambios |

---

## 4. Comportamiento resultante

| Caso | Antes | Ahora |
|------|-------|-------|
| Usuario normal viendo fechas | No veía los filtros de fecha | Ve el toggle "📅 Más filtros (fecha)" y puede filtrar por Desde/Hasta (funciona: el backend las aplica) |
| Lider+ con filtros de fecha | Veía el grid siempre desplegado | Los tiene colapsados por defecto; un toque los despliega (auto-expande si hay filtros persistidos) |
| Filtros de fecha activos | — | Colapsados por defecto; un toque los despliega (auto-expande si hay persistidos) |
| Menú ⋮ en tarjeta cerca del borde superior | **Se recortaba** (opciones invisibles) | Abre completo hacia abajo/arriba según espacio, nunca se corta |
| KPIs (Total / Mostrando / Selecc) | 60 px de alto | 48 px (−20%) |
| Buscador | Grande (16px) sin forma de limpiar | Compacto (14px) con botón ✕ que limpia y re-enfoca |
| Botón "Seleccionar todo" | 48 px, desalineado con el buscador | 38 px, mismo radio del input (armónico) |

---

## Verificación

- ✅ `node --check public/movil/js/solicitudes.js` — sin errores de sintaxis.
- ✅ Revisión de código: el menú ⋮ no tiene ruta de recorte (fixed + cálculo de espacio), el
  toggle colapsable no rompe `mostrarFiltrosLider`/`limpiarFiltrosLider`, y no hay regresiones
  para usuarios no líderes (el vendedor se oculta y nunca se envía; las fechas sí funcionan).
- ⏳ Prueba manual: abrir `/m/solicitudes` en móvil con un usuario normal (ver toggle de
  fechas y botón ✕) y con un líder (ver vendedor dentro del toggle); tocar ⋮ en la primera
  tarjeta visible y confirmar que el menú se ve completo.

## Documentación relacionada

- `docs/feature-filtros-movil-solicitudes.md` — rediseño previo: selects + auto-aplicar (v1).
- `docs/informe-fix-filtros-fecha-solicitudes.md` — fix de filtros de fecha/vendedor + caché.
- `docs/README.md` — estructura del proyecto (§4) y módulo Solicitudes (§11.2).
- `README.md` — tabla de Features Recientes.
