# Feature: Vista móvil de Solicitudes (v2) — filtros colapsables, KPIs compactos, buscador integrado al panel con ✕ y fix del menú ⋮

**Fecha:** Agosto 2026 (2 iteraciones)
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
   opciones Editar / No aplica / Eliminar). Se posiciona como `position: fixed` calculado
   desde el botón, para que nunca lo recorte el `overflow: hidden` de la card.

> **Segunda iteración (fix crítico):** tras probar en dispositivo se reportó que el menú ⋮
> "no se desplegaba". La causa raíz estaba en un `transform` retenido en la card (contenedor
> de posicionamiento) y no en el `position: fixed` en sí. También se **integró el buscador +
> botón "Seleccionar todo" DENTRO del panel de filtros**, debajo del toggle colapsable, con
> alturas unificadas de 32 px. Detalles en la **sección 5** (Segunda iteración).

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
| Buscador `input` | padding 14/18, fuente 16px, radio 14px | padding 6px 34px 6px 12px (espacio para ✕), fuente 13px, **min-height 32px**, radio 10px |
| `#btn-seleccionar-todo` / `.btn-select-all` | min-height 48px, padding 14/16, radio 14px | min-height **32px**, padding 0 12px, radio 10px (misma altura que el input y los selects) |
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

## 5. Segunda iteración — fix crítico del menú ⋮ y buscador integrado al panel

### 5.1 Por qué el menú ⋮ "no se desplegaba" (causa raíz)

El `position: fixed` se posiciona contra el **viewport**… salvo que algún ancestro tenga un
`transform` (o `filter`/`perspective`/`will-change`) no `none`: en ese caso ese ancestro se
convierte en el **containing block** y las coordenadas de viewport se interpretan relativas a él.

En `.solicitud-card` había **dos fuentes de transform**:

| Fuente | Detalle |
|--------|---------|
| Animación `fadeInUp` | `animation: fadeInUp 0.35s ... both` con keyframe final `to { transform: translateY(0) }`. Por `fill-mode: both` el estado final se retiene **para siempre**, así que la card quedaba con `transform: translateY(0)` permanente → containing block. |
| `:active` | `.solicitud-card:active { transform: scale(0.985) }` — al tocar el botón ⋮ la card (ancestro del botón presionado) entraba en `:active` y volvía a ser containing block en el instante del toque (riesgo en táctil). |

**Síntoma:** `top: rect.bottom + 6` (coordenadas de viewport, p. ej. 500 px) se interpretaba
relativo a la card → el menú se dibujaba cientos de px más abajo, fuera de la zona visible →
"no se despliega".

### 5.2 Cambios del fix

**`public/movil/css/solicitudes-mobile.css`**

- `@keyframes fadeInUp`: el keyframe `to` ya **no retiene `transform`** (solo `opacity: 1`).
  La interpolación `translateY(16px) → 0` es visualmente idéntica; lo que cambia es que la
  card ya no es containing block.
- `.solicitud-card:active`: se eliminó `transform: scale(0.985)`; se conserva el
  `background: #fafafa` como feedback táctil.
- Resultado: **ningún ancestro del menú puede tener transform** → `position: fixed` siempre
  usa el viewport real.

**`public/movil/js/solicitudes.js`**

- Guard defensivo en `toggleCardMenuMovil()`: `if (!btn) return;` antes de
  `getBoundingClientRect()`.

### 5.3 Buscador + "Seleccionar todo" integrados al panel de filtros

**Antes:** el buscador era un bloque suelto fuera del panel de filtros (38 px, desalineado con
los selects de 32 px).

**Ahora:**

- **`public/movil/solicitudes.html`:** el bloque `.buscador-unificado` se movió **dentro** de
  `.filtros-unificado`, justo después de `#filtrosLider` (es decir, **debajo del toggle
  colapsable** "📅 Más filtros (fecha)"). Queda siempre visible dentro del panel.
- **`public/movil/css/solicitudes-mobile.css`:** `.buscador-unificado` pasó a
  `padding: 12px 0 0; margin: 12px 0 0; border-top: 1.5px dashed #e5e7eb;` (sección propia
  dentro del panel). El input de búsqueda y el botón "Seleccionar todo" se unificaron a
  **32 px de alto** (mismo tamaño que los selects de Estado/Segmento) → panel totalmente
  armónico. El botón ✕ sigue dentro del input (22 px, `right: 6px`).
- El CSS compartido `public/css/solicitudes.css` (`.buscador-unificado`, `input`) queda
  correctamente sobreescrito: el móvil se carga después y usa `!important` donde importa.

### 5.4 Comportamiento resultante (segunda iteración)

| Caso | Antes | Ahora |
|------|-------|-------|
| Tocar ⋮ en una tarjeta | "No se desplegaba" (containing block por transform retenido) | Abre **completo** hacia abajo (o arriba con clamp), contra el viewport real |
| Buscador | Fuera del panel, 38 px | **Dentro del panel**, bajo el toggle de filtros, 32 px |
| Botón "Seleccionar todo" | Fuera del panel, 38 px | **Dentro del panel** junto al buscador, 32 px (armónico) |

---

## Verificación

- ✅ `node --check public/movil/js/solicitudes.js` — sin errores de sintaxis.
- ✅ Revisión de código (2 iteraciones): el menú ⋮ no tiene ruta de recorte ni de
  desposicionamiento (fixed + sin transform en ancestros), el toggle colapsable no rompe
  `mostrarFiltrosLider`/`limpiarFiltrosLider`, y no hay regresiones para usuarios no líderes.
- ⏳ Prueba manual: abrir `/m/solicitudes` en móvil; tocar ⋮ en una tarjeta (debe abrir
  completo hacia abajo) y confirmar que el buscador + "Seleccionar todo" quedaron integrados
  bajo el toggle de filtros con la misma altura que los selects.

## Documentación relacionada

- `docs/feature-filtros-movil-solicitudes.md` — rediseño previo: selects + auto-aplicar (v1).
- `docs/informe-fix-filtros-fecha-solicitudes.md` — fix de filtros de fecha/vendedor + caché.
- `docs/README.md` — estructura del proyecto (§4) y módulo Solicitudes (§11.2).
- `README.md` — tabla de Features Recientes.
