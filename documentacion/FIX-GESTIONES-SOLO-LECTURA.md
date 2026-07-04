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
