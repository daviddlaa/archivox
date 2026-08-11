# Feature: Tab Solicitudes globales en SuperAdmin (solo lectura + export + filtros dinámicos)

**Fecha:** Agosto 2026  
**Ámbito:**  
- `src/controllers/admin.controller.js`  
- `src/routes/admin.routes.js`  
- `public/admin/index.html`, `public/admin/js/admin.js`  
- `public/js/drawer.js` (tab móvil admin)  
**Estado:** Implementado

## Resumen

Pestaña **📋 Solicitudes** en el panel superadmin para consultar **toda** la base de solicitudes (todos los dueños), con búsqueda, filtros **dinámicos basados en los valores reales de la BD**, paginación y export Excel importable. Sin editar ni borrar.

## API

| Método | Ruta | Auth |
|--------|------|------|
| GET | `/api/admin/solicitudes` | superadmin |
| GET | `/api/admin/solicitudes/filtros` | superadmin |
| GET | `/api/admin/solicitudes/export` | superadmin |

### `GET /api/admin/solicitudes/filtros`

Devuelve los catálogos de valores **reales** (globales, sin filtrar por usuario) para alimentar los selects:

```json
{ "estados": ["APROBADA PARA LIBERACIÓN", "Aprobada sin Venta", ...],
  "segmentos": ["RESCATE", "DESCUBRIMIENTO", ...],
  "productos": ["Moto", "A/a split", ...] }
```

- Cada catálogo = `SELECT columna, COUNT(*) ... WHERE NOT NULL AND != '' GROUP BY columna ORDER BY COUNT(*) DESC, columna ASC LIMIT 100`.
- No excluye filas por `usuario_id` (el superadmin ve todo).

### Query params (listado y export)

`q`, `estado`, `segmento`, `producto`, `usuario_id`, `fecha_desde`, `fecha_hasta`, `vendedor`, `pagina`, `limite`, `orden`, `direccion`

### Comportamiento de los filtros

| Parámetro | Coincidencia |
|---|---|
| `q` | `%q%` sobre nombre, cédula, celular, id_solicitud (case-insensitive) |
| `estado` | **Igualdad exacta** sobre `s.estado` |
| `estado=__no_aplica_credito__` | **Centinela** → `AND s.no_aplica_credito = 0` (mismo patrón que la app principal) |
| `segmento` | Igualdad exacta sobre `s.segmento` |
| `producto` | Igualdad exacta sobre `s.producto` |
| `usuario_id` | Igualdad numérica sobre `s.usuario_id` |
| `fecha_desde` / `fecha_hasta` | Rango sobre `s.fecha_solicitud` (TEXT `YYYY-MM-DD HH:MM:SS`; comparación lexicográfica; a `fecha_hasta` se le añade ` 23:59:59`) |
| `vendedor` | `%vendedor%` case-insensitive |
| `pagina` / `limite` | `limite` clamp 1–200, default 50 |
| `orden` / `direccion` | Columna segura (lista blanca) + `ASC`/`DESC`, default `s.id DESC` |

### Respuesta listado

```json
{ "data": [...], "total": 0, "pagina": 1, "limite": 50 }
```

Campos útiles: `id_solicitud`, cédula, nombre, celular, estado, segmento, producto, vendedor, fechas, `usuario_id`, `no_aplica_credito`, `created_at`, `dueno_username`, `dueno_nombre`, `campana_id`, `nombre_campana`.

Export **Excel (.xlsx)** con tope 10.000 filas: descarga `solicitudes_globales.xlsx` con las
columnas **importables** por el sistema — `ESTADO, CEDULA, NOMBRE, CELULAR, SEGMENTO, PRODUCTO,
FECHASOLICITUD, VENDEDOR` — **sin `IDSOLICITUD`**: al re-importarlo, el sistema auto-genera los
IDs y las solicitudes quedan a nombre del usuario que lo sube (dedupe por cédula). Respeta los
mismos filtros. Generado con ExcelJS (`workbook.xlsx.write(res)`).

## UI

- Toolbar con filtros + Exportar Excel.
- **Selects dinámicos:** `filterSolEstado`, `filterSolSegmento` y `filterSolProducto` se llenan desde `/api/admin/solicitudes/filtros` al abrir la pestaña (`cargarFiltrosSolicitudesGlobales()`), preservando la selección actual.
  - Antes tenían opciones hardcodeadas (Pendiente/Seguimiento/Cobranza… y A/B/C/D) que **no coincidían** con los valores reales (APROBADA PARA LIBERACIÓN, DEVUELTA, RESCATE, ORO…) y devolvían 0 filas.
  - `filterSolEstado` conserva la opción fija `👎 No aplica para crédito` (value `__no_aplica_credito__`).
- Tabla desktop + mobile cards.
- Paginación.
- `?tab=solicitudes` soportado en menú móvil admin.

## Seguridad

- Rutas detrás de `requiresRole('superadmin')` + rate limit admin.
- Solo lectura (GET).
- Los filtros usan parámetros preparados (`$N`) y orden por lista blanca → sin inyección SQL.

## Criterios de prueba

1. Superadmin ve solicitudes de varios usuarios.
2. Usuario no-superadmin → 403 en la API.
3. Los selects de estado/segmento/producto muestran los valores reales de la BD.
4. Filtrar por estado/segmento/producto/`No aplica para crédito` devuelve filas correctas (y export Excel coincidente).
5. Filtros y paginación funcionan.
6. Export descarga Excel filtrado.
