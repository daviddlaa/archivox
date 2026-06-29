# Feature: Selección múltiple y borrado masivo en Gestiones

## 📅 Fecha
29 de junio de 2026

## 🎯 Objetivo

Agregar checkboxes de selección y un botón de borrado masivo en la página de gestiones, permitiendo seleccionar varias gestiones y eliminarlas en lote.

## 🔧 Cambios realizados

### 1. `public/desktop/gestiones.html`

- **Nueva columna** con checkbox en el header de la tabla (`<th>` con checkbox "seleccionar todos")
- **Nuevo botón** "🗑️ Borrar (N)" en la barra de filtros, oculto por defecto, visible solo cuando hay selección

### 2. `public/desktop/js/gestiones.js`

Nuevas variables y funciones agregadas:

| Variable/Función | Descripción |
|-----------------|-------------|
| `gestionesSeleccionadas = {}` | Objeto que almacena los IDs seleccionados |
| `toggleSeleccionGestion(id, checkbox)` | Marca/desmarca una gestión individual |
| `seleccionarTodosGestiones()` | Marca/desmarca todas las gestiones visibles |
| `actualizarContadorSeleccion()` | Actualiza el contador y muestra/oculta el botón de borrar |
| `eliminarSeleccionadas()` | Elimina en secuencia todas las gestiones seleccionadas |

**`renderizarTabla()` actualizada:**
- Cada fila ahora incluye un `<input type="checkbox" class="chk-gestion">`
- El `colspan` de la fila "sin datos" se actualizó de 7 a 8

### Flujo de borrado masivo

```
Usuario marca checkboxes → Botón "🗑️ Borrar (N)" aparece
  → Click en "🗑️ Borrar (N)" → Confirmación
    → DELETE secuencial a /api/excel/gestiones/:id
      → Al terminar: recarga la tabla, limpia selección
```

## 📁 Archivos modificados

| Archivo | Cambio |
|---------|--------|
| `public/desktop/gestiones.html` | + checkbox columna, + botón borrar masivo |
| `public/desktop/js/gestiones.js` | + selección múltiple, + borrado en lote |

## 📊 Resultado

| Antes | Después |
|-------|---------|
| Solo se podía eliminar 1 gestión a la vez (botón 🗑️ por fila) | Se pueden seleccionar varias con checkbox y borrar todas juntas |
| Sin checkbox de selección | Checkbox "seleccionar todos" en el header |
| Sin contador de selección | Contador visible "Borrar (N)" |
