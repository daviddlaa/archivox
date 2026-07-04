# 🔒 Fix: Página de Gestiones en modo solo lectura

## Objetivo
Eliminar todos los botones y funciones que generan escrituras en la base de datos desde la página de Gestiones (móvil y escritorio), dejándola en modo **solo lectura**.

## Cambios realizados

### Versión Escritorio

**Archivo modificado:** `public/desktop/js/gestiones.js`

| Función eliminada | Acción en BD | Motivo |
|------------------|-------------|--------|
| `eliminarGestion(id)` | **DELETE** `/api/excel/gestiones/{id}` | Eliminación individual |
| `eliminarSeleccionadas()` | **DELETE** batch | Eliminación masiva |
| `abrirNuevaGestion()` | Abría modal para **POST** | Creación de gestión |
| `guardarNuevaGestion()` | **POST** `/api/excel/gestiones` | Guardar nueva gestión |
| `agregarSeguimiento(id)` | Abría modal para **POST** | Agregar seguimiento |
| `guardarSeguimiento(id)` | **POST** `/api/excel/gestiones` | Guardar seguimiento |
| `actualizarInfoNuevaGestion()` | Helper | Info de solicitud en modal |
| `toggleSeleccionGestion(id, cb)` | Helper | Selección para batch delete |
| `seleccionarTodosGestiones()` | Helper | Seleccionar todos |
| `actualizarContadorSeleccion()` | Helper | Contador de selección |

**Variables eliminadas:**
- `gestionesSeleccionadas` — almacenaba IDs para batch delete
- `opcionesTipoGestion` — opciones de tipo para crear gestiones

**Archivo modificado:** `public/desktop/gestiones.html`
- Eliminado checkbox "Seleccionar todo" del header de tabla
- Eliminada columna de checkboxes
- Eliminado botón "🗑️ Borrar (N)" de acciones

### Versión Móvil

**Archivo modificado:** `public/movil/js/gestiones.js`

| Función eliminada | Acción en BD | Motivo |
|------------------|-------------|--------|
| `eliminarGestion(id)` | **DELETE** `/api/excel/gestiones/{id}` | Eliminación individual |
| `agregarSeguimiento(id)` | Abría modal para **POST** | Agregar seguimiento |
| `guardarSeguimiento(id)` | **POST** `/api/excel/gestiones` | Guardar seguimiento |

### Lo que se mantiene (solo lectura)

- 🔍 Búsqueda por cédula / nombre / teléfono / observación
- 📋 Filtro por tipo de gestión
- 👁️ Ver detalle de cada gestión (modal informativo)
- 📊 Estadísticas (total, mostrando)
- 📥 Exportar a Excel
- ♾️ Infinite scroll
- 🧹 Limpiar filtros

---

## 🐛 Fix posterior: Error "Illegal return statement" en producción (Render)

### Síntoma
La página de Gestiones en escritorio no cargaba. La consola mostraba:
```
gestiones.js:17 Uncaught SyntaxError: Illegal return statement
```
La versión móvil sí funcionaba correctamente.

### Causa raíz
Al eliminar el bloque de selección múltiple (funciones de escritura), el comentario de reemplazo quedó **pegado en la misma línea** que la función `getFechaHoraActual()`:

```javascript
// ANTES (roto):
// ================== FIN SELECCIÓN MÚLTIPLE (ELIMINADA) ==================function getFechaHoraActual() {
```

Al estar en la misma línea que `//`, JavaScript trató `function getFechaHoraActual() {` como parte del comentario, por lo que:
- La función nunca se definió
- El `return` de su cuerpo (línea 17) quedó como código suelto a nivel global
- `return` solo es válido dentro de una función → `SyntaxError: Illegal return statement`

La versión móvil no se vio afectada porque su archivo (`public/movil/js/gestiones.js`) no tenía esta concatenación.

### Solución aplicada

**Archivo:** `public/desktop/js/gestiones.js`

1. Se agregó un **salto de línea** entre el comentario y `function getFechaHoraActual()`:

```javascript
// DESPUÉS (corregido):
// ================== FIN SELECCIÓN MÚLTIPLE (ELIMINADA) ==================

function getFechaHoraActual() {
```

2. Se corrigió `colspan="8"` → `colspan="7"` en la fila de "No se encontraron gestiones" porque la tabla ahora tiene 7 columnas (se eliminó la columna de checkboxes).

### Lección aprendida
Al usar `str_replace` para eliminar bloques grandes de código, hay que verificar que el reemplazo no deje código pegado a comentarios. Siempre revisar que el archivo resultante tenga saltos de línea adecuados entre declaraciones.
