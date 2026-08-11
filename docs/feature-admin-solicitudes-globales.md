# Feature: Tab Solicitudes globales en SuperAdmin (solo lectura + export)

**Fecha:** Agosto 2026  
**Ámbito:**  
- `src/controllers/admin.controller.js`  
- `src/routes/admin.routes.js`  
- `public/admin/index.html`, `public/admin/js/admin.js`  
- `public/js/drawer.js` (tab móvil admin)  
**Estado:** Implementado

## Resumen

Nueva pestaña **📋 Solicitudes** en el panel superadmin para consultar **toda** la base de solicitudes (todos los dueños), con búsqueda, filtros, paginación y export CSV. Sin editar ni borrar.

## API

| Método | Ruta | Auth |
|--------|------|------|
| GET | `/api/admin/solicitudes` | superadmin |
| GET | `/api/admin/solicitudes/export` | superadmin |

### Query params (ambos)

`q`, `estado`, `segmento`, `usuario_id`, `fecha_desde`, `fecha_hasta`, `vendedor`, `pagina`, `limite`, `orden`, `direccion`

### Respuesta listado

```json
{ "data": [...], "total": 0, "pagina": 1, "limite": 50 }
```

Campos útiles: `id_solicitud`, cédula, nombre, celular, estado, segmento, producto, vendedor, fechas, `usuario_id`, `dueno_username`, `dueno_nombre`, `campana_id`, `nombre_campana`.

Export CSV: tope 10.000 filas, BOM UTF-8.

## UI

- Toolbar con filtros + Exportar CSV.
- Tabla desktop + mobile cards.
- Paginación.
- `?tab=solicitudes` soportado en menú móvil admin.

## Seguridad

- Rutas detrás de `requiresRole('superadmin')` + rate limit admin.
- Solo lectura (GET).

## Criterios de prueba

1. Superadmin ve solicitudes de varios usuarios.
2. Usuario no-superadmin → 403 en la API.
3. Filtros y paginación funcionan.
4. Export descarga CSV filtrado.
