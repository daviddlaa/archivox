# Feature: Rediseño Filtros Móvil — Solicitudes

**Fecha:** Agosto 2026
**Ámbito:** `public/movil/solicitudes.html`, `public/movil/js/solicitudes.js`, `public/movil/css/solicitudes-mobile.css`

---

## Resumen

Se rediseñaron los filtros de la página de solicitudes **móvil** para que dejen de ocupar ~70% de la pantalla y para que **todo se aplique en tiempo real** (sin botón Aplicar). Quedó un máximo de 3 filas de filtros en lugar de 6-8.

---

## Problema original

```
┌─ Filtros ──────────────────────────┐
│ 📌 Estado: [Todos][Pendiente][...]  │ ← chips con flex-wrap
│ 🏷️ Segmento: [Todos][A][B][C][...] │ ← cada uno desborda a 2-3 líneas
│ 📅 Desde:  [____]                  │ ← una fila por campo
│ 📅 Hasta:  [____]                  │
│ 👤 Vendedor: [____]                │
│ [Aplicar] [Limpiar]                │
└────────────────────────────────────┘
```

Los chips generados por `renderizarFiltros()` (un botón por estado/segmento distinto) se envolvían en varias líneas, y los campos de líder iban uno debajo de otro con botones Aplicar/Limpiar. Resultado: hasta 6-8 filas antes de las tarjetas.

---

## Cambios

### 1. Estado y Segmento → selects desplegables

```
[📌 Estado ▾] [🏷️ Segmento ▾] [✕ Limpiar]     ← una sola fila
```

- Los contenedores de chips `#filtro-estado` / `#filtro-segmento` fueron reemplazados por `<select>` con los IDs `filtro-estado-select` y `filtro-segmento-select`.
- `renderizarFiltros()` ahora llena los `<option>` con las mismas opciones dinámicas (estados/segmentos únicos de `todosDatos`) y restaura el valor previamente seleccionado.
- El select usa una flecha SVG como `background-image` (`appearance: none`) y tiene foco con anillo índigo, acorde al estilo app del móvil.

### 2. Filtros de líder en grid compacto

```
[📅 Desde]  [📅 Hasta]               ← grid 2 columnas
[👤 Vendedor ▸▸▸▸▸▸▸▸▸▸▸▸]          ← ancho completo
```

- `#filtrosLider` cambió de `filtros-row` a la clase nueva `.filtros-lider` (grid de 2 columnas + vendedor a ancho completo), separado con borde punteado superior.
- `mostrarFiltrosLider()` ahora pone `display: grid` (antes `flex`).

### 3. Auto-aplicar en tiempo real — fuera el botón Aplicar

- **Selects Estado/Segmento:** aplican al cambiar (`onchange` → `buscarEnServidor(true)`).
- **Fechas (líder+):** aplican al cambiar (`onchange` → `aplicarFiltrosLider`).
- **Vendedor (líder+):** aplica con debounce de 400 ms mientras se escribe (`timerVendedorFiltro`).
- **Buscador:** conserva su debounce de 300 ms (ya existía).

### 4. Botón Limpiar (se mantiene, ahora resetea todo)

- Botón `✕ Limpiar` (`.btn-limpiar-movil`, rojo suave) en la fila principal de selects.
- `limpiarFiltrosLider()` ahora resetea **todo**: estado + segmento (selects y variables `filtros.*`) + fechas + vendedor + **buscador** (`#cedula`), limpia `sessionStorage` (`sol_fecha_*`, `sol_vendedor`) y recarga (`buscarEnServidor(true)`).
- Al limpiar también se cancelan los timers pendientes (`clearTimeout(timerVendedorFiltro)` y `clearTimeout(debounceBusqueda)`) para evitar búsquedas redundantes si el usuario toca Limpiar justo después de escribir.

---

## Archivos involucrados

| Archivo | Cambio |
|---------|--------|
| `public/movil/solicitudes.html` | Selects en vez de chips; grid de líder; botón Limpiar en fila principal; se eliminó el botón Aplicar |
| `public/movil/js/solicitudes.js` | `renderizarFiltros()` llena selects; `adjuntarEventos()` con `onchange`/debounce; `limpiarFiltrosLider()` resetea todo; `mostrarFiltrosLider()` con `display:grid` |
| `public/movil/css/solicitudes-mobile.css` | Estilos `.filtro-select`, `.btn-limpiar-movil`, `.filtros-lider` (grid), override `.filtros-row` para la fila de selects |

---

## Notas de compatibilidad

- **No se tocó el escritorio** (tiene su propio diseño con toolbar desde el rediseño anterior).
- El CSS compartido `/css/solicitudes.css` se carga **antes** que `/movil/css/solicitudes-mobile.css` en el HTML móvil (líneas 9-10), por lo que los overrides móviles ganan por igual especificidad (orden de carga) o superior.
- El botón "Seleccionar todo" del buscador se mantiene intacto.

---

---

## Corrección (Agosto 2026): filtros de fecha/vendedor aplicando en conjunto

Se corrigió que el filtro de fecha (Desde/Hasta) y vendedor no se aplicara junto con Estado/Segmento (mostraba todas las activadas en vez de solo las del mes):

1. **Clave de caché incompleta (causa raíz).** El caché del cliente (TTL 30s) usaba `q|estado|segmento|offset` sin las fechas ni el vendedor. Si primero filtrabas por Estado y luego elegías el mes (dentro de 30s), la caché devolvía el resultado anterior sin mandar las fechas al servidor. Ahora `getCacheKey(q, estado, segmento, offset, fechaDesde, fechaHasta, vendedor)` incluye **todas** las dimensiones, y `buscarEnServidor` las pasa a `getFromCache`/`setCache`.
2. **Filtros persistidos no re-aplicados al recargar.** `init()` ahora detecta `filtros.estado/filtros.segmento/fechaDesdeActual/fechaHastaActual/vendedorActual` en `sessionStorage` y ejecuta `buscarEnServidor(true)` tras `renderizarFiltros()`, para que la lista coincida con la UI restaurada.

Detalle completo: `docs/informe-fix-filtros-fecha-solicitudes.md`.

## Verificación

- ✅ `node --check public/movil/js/solicitudes.js` — sin errores de sintaxis.
- ✅ Llaves CSS balanceadas (207/207).
- ✅ Todos los IDs existen una vez en el HTML: `filtro-estado-select`, `filtro-segmento-select`, `filtrosLider`, `fechaDesde`, `fechaHasta`, `filtroVendedor`, `vendedoresList`, `cedula`.
- ✅ Sin referencias huérfanas a los viejos contenedores `#filtro-estado` / `#filtro-segmento` / `filtro-botones`.
- ✅ Revisión de código pendiente/realizada según corresponda.
- ⏳ Prueba visual en navegador pendiente (requiere login).
