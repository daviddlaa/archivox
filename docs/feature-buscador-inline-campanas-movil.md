# Feature: Buscador Inline en Campañas Móvil (reemplaza el bottom sheet)

**Fecha:** Agosto 2026
**Ámbito:** `public/movil/gestion-lote.html`, `public/movil/css/gestion-lote.css`, `public/movil/js/gestion-lote.js`

---

## Resumen

En la página móvil de Campañas (`/m/gestion-lote`) se reemplazó el **bottom sheet de "Buscar y filtrar"** (abierto con el botón 🔍 del footer) por una **fila inline siempre visible** debajo del semáforo, con el buscador y el selector de estado en una sola línea. La lista de tarjetas ya no queda tapada y el filtrado en vivo se ve mientras se escribe.

---

## Problema original

- La búsqueda se abría en un bottom sheet que **se deslizaba sobre las tarjetas** y llamaba a `input.focus()`, por lo que el teclado saltaba y el contenido quedaba cubierto; era incómodo y poco práctico.
- El botón 🔍 ocupaba el lugar de un ítem de navegación normal en el footer.

## Solución

### Fila inline debajo del semáforo (sticky)

```html
<div class="filtros-inline-row" id="filtros-inline-row">
    <input type="search" id="busqueda" placeholder="🔍 Buscar..." ...>
    <select id="filtro-estado" aria-label="Filtrar por estado">
        <option value="">Todos</option>
        <option value="Pendiente">Pendiente</option>
        ...
    </select>
    <button ... class="filtros-inline-limpiar" id="btn-filtros-limpiar" onclick="limpiarFiltrosBusqueda()" ...>✕</button>
</div>
```

- La fila vive **dentro** del contenedor sticky `#semaforo-mobile`, así que se pega debajo del header y viaja con el scroll junto al semáforo.
- El input usa `type="search"` (botón ✕ nativo del navegador), `enterkeyhint="search"` y `autocomplete="off"`.
- Se mantienen los **IDs** `busqueda` y `filtro-estado`, por lo que toda la lógica existente sigue intacta:
  - Filtrado en tiempo real en `renderizarSolicitudes()` (eventos `input`/`change`, gestion-lote.js:1176-1177).
  - El select filtra por `tipo_gestion`; la búsqueda por id/cédula/nombre/celular; el semáforo por `semaforo` (los tres se combinan).

### Eliminado

- Markup del bottom sheet: `#filtros-bs-overlay`, `#filtros-bs-sheet` (y sus estilos `.filtros-bs-*`).
- Botón 🔍 del footer (`#btn-filtros-trigger`) y su badge → el footer vuelve a Inicio / Solicitudes / Menú.
- Funciones `toggleFiltrosSheet()`, `abrirFiltrosSheet()`, `cerrarFiltrosSheet()`.
- Referencias `.filtros-bs-*` en la regla `prefers-reduced-motion`.

### Comportamiento nuevo

- **Chip "✕ Limpiar"**: aparece solo cuando hay filtros activos (búsqueda, estado o semáforo) y borra **todo** (`limpiarFiltrosBusqueda()` ahora también resetea `filtroSemaforoMovil` y llama `actualizarSemaforoMovil()`).
- El indicador de filtros activos se repinta sobre este chip (antes era el badge rojo del footer).

---

## Archivos involucrados

| Archivo | Cambio |
|---------|--------|
| `public/movil/gestion-lote.html` | Se quita el bottom sheet y el botón 🔍 del footer; se agrega `.filtros-inline-row` dentro del sticky del semáforo |
| `public/movil/css/gestion-lote.css` | Se reemplazan `.filtros-bs-*`, `.btn-filtros-nav`, `.filtros-nav-badge` por `.filtros-inline-row`, `.filtros-inline-limpiar` |
| `public/movil/js/gestion-lote.js` | Se eliminan las funciones del sheet; `actualizarIndicadorFiltros()` usa el chip; `limpiarFiltrosBusqueda()` limpia todo |

---

## Verificación

- ✅ `node --check public/movil/js/gestion-lote.js` — sin errores de sintaxis.
- ✅ Llaves CSS balanceadas (291/291).
- ✅ Sin referencias huérfanas a `filtros-bs-*`, `btn-filtros-trigger`, `toggle/abrir/cerrarFiltrosSheet`.
- ⏳ Prueba visual en móvil: fila visible bajo el semáforo, sticky al hacer scroll, filtrado en vivo sin tapar tarjetas, "✕ Limpiar" borra búsqueda + estado + semáforo, footer con 3 ítems.
