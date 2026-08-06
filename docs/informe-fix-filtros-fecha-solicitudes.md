# Informe: Fix Filtros de Fecha en Solicitudes (Desktop y Móvil)

**Fecha:** Agosto 2026
**Ámbito:** `public/desktop/js/solicitudes.js`, `public/movil/js/solicitudes.js`, `src/controllers/excel.controller.js`
**Síntoma reportado:** al filtrar "Estado = ACTIVADA" más un mes (ej. enero), la página mostraba **todas** las solicitudes activadas ignorando el rango de fechas.

---

## Resumen

Se corrigieron tres defectos que impedían que los filtros de fecha (Desde/Hasta) y vendedor de la página de Solicitudes funcionaran de forma conjunta con los filtros de Estado y Segmento, tanto en escritorio como en móvil.

---

## 1. Causa raíz — Clave de caché del navegador incompleta

### Problema

El caché en memoria del cliente (TTL 30s) usaba una clave con solo `q | estado | segmento | offset`:

```javascript
// ANTES (desktop y móvil)
function getCacheKey(q, estado, segmento, offset) {
    return `${q}|${estado}|${segmento}|${offset}`;
}
```

Las fechas (`fecha_desde`/`fecha_hasta`) y el vendedor **no formaban parte de la clave**, pero los resultados sí dependían de ellos.

**Secuencia que reproducía el bug:**
1. El usuario elige `Estado = ACTIVADA` → la búsqueda devuelve "todas las activadas" y se guarda en caché con la clave `%|ACTIVADA||0`.
2. El usuario elige un mes (ej. enero) → misma clave `%|ACTIVADA||0` → **se devuelve el dato cacheado sin enviar las fechas al servidor** (siempre que ocurra dentro del TTL de 30s).

El resultado: "todas las activadas", sin importar el mes. El filtro de fecha parecía no existir.

### Solución

La clave ahora incluye todas las dimensiones de filtro que afectan el resultado:

```javascript
// DESPUÉS (desktop y móvil)
function getCacheKey(q, estado, segmento, offset, fechaDesde, fechaHasta, vendedor) {
    return `${q}|${estado}|${segmento}|${offset}|${fechaDesde}|${fechaHasta}|${vendedor}`;
}
```

Se actualizaron `getFromCache`/`setCache` y sus llamadas dentro de `buscarEnServidor` para pasar
`fechaDesdeActual`, `fechaHastaActual` y `vendedorActual` (en móvil: `filtros.estado`, `filtros.segmento`).

| Archivo | Líneas (aprox.) |
|---------|-----------------|
| `public/desktop/js/solicitudes.js` | `getCacheKey`/`getFromCache`/`setCache` (55-69), `buscarEnServidor` (lookup y setCache) |
| `public/movil/js/solicitudes.js` | `getCacheKey`/`getFromCache`/`setCache` (173-186), `buscarEnServidor` (lookup y setCache) |

---

## 2. Defecto — Filtros persistidos no se re-aplicaban al cargar

### Problema

Los filtros se guardan en `sessionStorage` (`sol_estado`, `sol_segmento`, `sol_fecha_desde`, `sol_fecha_hasta`, `sol_vendedor`) y se **restauraban en la UI** (selects, inputs de fecha), pero nunca se volvía a ejecutar la búsqueda. La lista quedaba con los primeros 100 registros sin filtrar mientras la UI parecía tener los filtros activos.

### Solución

En `init()` se detecta si hay filtros persistidos y se re-ejecuta la búsqueda:

- **Desktop:** después de `restaurarFiltrosUI()`, si `estadoActual || segmentoActual || fechaDesdeActual || fechaHastaActual || vendedorActual`, se llama `buscarEnServidor(true)`.
- **Móvil:** después de `renderizarFiltros()`, si `filtros.estado || filtros.segmento || fechaDesdeActual || fechaHastaActual || vendedorActual`, se llama `buscarEnServidor(true)`.

Así la lista mostrada siempre coincide con los filtros restaurados tras recargar la página.

---

## 3. Defecto — Límite de `fecha_hasta` con valores timestamp

### Problema

`fecha_solicitud` se almacena como `TEXT` y mezcla dos formatos:
- `YYYY-MM-DD` (importación Excel normalizada en `excel.service.js`).
- `YYYY-MM-DD HH:MM:SS` (otros flujos de creación; en la BD local el 100% de los registros usan este formato).

El filtro `s.fecha_solicitud <= '2026-01-31'` compara cadenas, y `'2026-01-31 09:00:00' <= '2026-01-31'` es **falso** (cadena más larga). Resultado: se perdían los registros del **último día** del rango cuando tenían hora.

### Solución

En `listarSolicitudes` y `buscarSolicitudes` (tanto en la consulta principal como en el COUNT), el parámetro de `fecha_hasta` se envía como `fecha_hasta + ' 23:59:59'`:

```javascript
params.push(fecha_hasta + ' 23:59:59');      // query
countParams.push(fecha_hasta + ' 23:59:59'); // count
```

- Sigue siendo comparación de cadenas (TEXT), compatible con SQLite y PostgreSQL.
- Conserva el uso del índice `idx_solicitudes_usuario_fecha` (no se envuelve la columna).
- `fecha_desde` se mantiene sin cambios: el prefijo `YYYY-MM-DD` ya compara bien contra ambos formatos.

| Archivo | Puntos modificados |
|---------|--------------------|
| `src/controllers/excel.controller.js` | `listarSolicitudes` (query + COUNT) y `buscarSolicitudes` (query + COUNT) |

---

## Verificación

- ✅ `node --check public/desktop/js/solicitudes.js` — sin errores de sintaxis.
- ✅ `node --check public/movil/js/solicitudes.js` — sin errores de sintaxis.
- ✅ `node --check src/controllers/excel.controller.js` — sin errores de sintaxis.
- ✅ Prueba de datos: en BD local, ACTIVADA con rango `2026-01-01` a `2026-01-31 23:59:59` devuelve 20 registros (vs. 95 ACTIVADAS totales), confirmando que el filtro de fecha reduce correctamente.

## Documentación relacionada

- `docs/feature-header-filtros-solicitudes-desktop.md` — rediseño del header/toolbar de filtros desktop.
- `docs/feature-filtros-movil-solicitudes.md` — rediseño de filtros móviles compactos.
