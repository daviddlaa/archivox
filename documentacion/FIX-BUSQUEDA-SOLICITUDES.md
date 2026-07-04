# 🔍 Fix: Barra de búsqueda de Solicitudes (móvil y escritorio)

## Diagnóstico

### Bug 1 (Crítico) — Infinite scroll mezcla resultados irrelevantes
Cuando el usuario buscaba y luego hacía scroll, `cargarMas()` cargaba datos del endpoint **normal** (`/api/excel/solicitudes`) en vez del endpoint de **búsqueda** (`/api/excel/solicitudes/buscar`). Como `todosDatos` se reemplazaba con los resultados de búsqueda, los nuevos datos del scroll se **mezclaban** con los de búsqueda, mostrando resultados irrelevantes.

```
1. Usuario escribe "Juan" → busca en BD → 3 resultados
2. todosDatos = [3 resultados de Juan]
3. Usuario hace scroll → cargarMas() trae 100 registros NORMALES (sin filtro)
4. todosDatos = [3 de Juan, 100 normales] ← MEZCLADOS!
```

### Bug 2 (Grave) — Filtros ignoran el texto de búsqueda
`filtrarEnServidor()` **siempre** enviaba `q=%` (comodín que trae TODOS los registros), ignorando lo que el usuario hubiera escrito en la búsqueda.

```
Usuario escribe "María" → ve resultados de María
Usuario hace clic en filtro "ACTIVADA" →
  filtrarEnServidor() enviaba q=% (NO q=María) →
  mostraba TODAS las ACTIVADAS, no solo las de María
```

### Bug 3 (Menor) — Duplicación de lógica
`buscarEnServidor` y `filtrarEnServidor` hacían casi lo mismo pero separadas.

## Solución aplicada

### Archivos modificados

| Archivo | Cambio |
|---------|--------|
| `public/desktop/js/solicitudes.js` | Unificación de búsqueda + filtros, deshabilitar infinite scroll durante búsqueda |
| `public/movil/js/solicitudes.js` | Mismos cambios que desktop |

### Cambios específicos

**1. Función unificada `buscarEnServidor()`**
Se eliminó `filtrarEnServidor()` y se unificó con `buscarEnServidor()`:
- Lee el término de búsqueda del input (`document.getElementById('cedula').value`)
- Si hay término → lo envía como `q=termino`
- Si NO hay término → envía `q=%` (todos)
- Siempre incluye `estado` y `segmento` si están activos
- Reemplaza `todosDatos` y renderiza

**2. `buscarConDebounce()` simplificado**
Ya no llama a `init()` al limpiar la búsqueda. Ahora siempre llama a la función unificada con o sin término de búsqueda.

**3. Botones de filtro actualizados**
Ahora llaman a `buscarEnServidor()` en vez de `filtrarEnServidor()`, lo que respeta el texto de búsqueda actual.

**4. Infinite scroll deshabilitado durante búsqueda**
Se agregó `if (busquedaActiva) return;` al inicio de `cargarMas()` para evitar que se mezclen datos.

## Cómo probar
1. Buscar un término (ej: "María") → deben aparecer solo resultados relevantes
2. Con la búsqueda activa, hacer clic en un filtro de estado → debe respetar el término de búsqueda
3. Limpiar la búsqueda → debe mostrar todos los registros (con filtros si están activos)
4. Hacer scroll en modo normal → debe cargar más datos correctamente (infinite scroll)
5. Hacer scroll durante búsqueda → no debe cargar datos adicionales
