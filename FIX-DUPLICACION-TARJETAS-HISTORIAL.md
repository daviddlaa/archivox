# Fix: Duplicación de Tarjetas en Gestión por Lotes

## 📋 Problema

Al abrir una campaña en **Gestión por Lotes**, las tarjetas de solicitudes se **duplicaban** — una misma solicitud aparecía varias veces, mostrando cada gestión histórica como una card independiente.

### Síntomas

- Solicitud #170617 aparecía **5 veces** (WhatsApp × 3, Llamada × 1, Pendiente × 1)
- El porcentaje de progreso se inflaba (ej: 133%)
- En consola los KPIs se mostraban correctamente, pero las cards se repetían

### Ejemplo de lo que se veía

```
#170617  WhatsApp  "Hola qué te tal"       👁️ Ver Gestión
#170617  WhatsApp  "hola"                   👁️ Ver Gestión
#170617  WhatsApp  "se envio un mensaje..." 👁️ Ver Gestión
#170617  Llamada   "se realizo la llamda"   👁️ Ver Gestión
#170617  Pendiente "Por gestionar"          📞 💬 📋 💰 ✅
```

## 🔍 Causa Raíz

**La consulta SQL en `getGestionMaestroById()`** (`src/controllers/gestionesMaestro.controller.js`)

La query original:

```sql
-- ❌ Antes: Devuelve TODAS las gestiones históricas de cada solicitud
SELECT s.*, g.id as gestion_id, g.tipo_gestion, g.observacion as gestion_obs, g.fecha_gestion
FROM solicitudes s
LEFT JOIN gestiones g ON s.id_solicitud = g.solicitud_id AND g.gestion_maestro_id = ?
WHERE s.id_solicitud IN (
    SELECT solicitud_id FROM gestiones WHERE gestion_maestro_id = ?
)
ORDER BY g.fecha_gestion DESC
```

El `LEFT JOIN` sin restricción de "solo la última" provocaba que por cada **gestión histórica** de una solicitud se generara una fila en el resultado. Si una solicitud tenía 5 gestiones, aparecía 5 veces.

## ✅ Solución

**Archivo modificado:** `src/controllers/gestionesMaestro.controller.js`

### Cambio: Subconsulta para obtener solo la última gestión

```sql
-- ✅ Ahora: Solo devuelve la ÚLTIMA gestión de cada solicitud
SELECT s.*, g.id as gestion_id, g.tipo_gestion, g.observacion as gestion_obs, g.fecha_gestion
FROM solicitudes s
LEFT JOIN gestiones g ON g.id = (
    SELECT g2.id FROM gestiones g2 
    WHERE g2.solicitud_id = s.id_solicitud 
    AND g2.gestion_maestro_id = ?
    ORDER BY g2.fecha_gestion DESC, g2.id DESC 
    LIMIT 1
)
WHERE s.id_solicitud IN (
    SELECT solicitud_id FROM gestiones WHERE gestion_maestro_id = ?
)
ORDER BY g.fecha_gestion DESC
```

### Cómo funciona

1. **Subconsulta correlacionada**: Por cada solicitud (`s.id_solicitud`), busca en `gestiones` la gestión más reciente
2. **`ORDER BY fecha_gestion DESC, id DESC`**: Ordena por fecha de gestión (la más reciente primero). Si dos tienen la misma fecha, usa el ID más alto (último insertado)
3. **`LIMIT 1`**: Toma solo la gestión más reciente
4. **Resultado**: Cada solicitud aparece **una sola vez** con su estado actual

### Compatibilidad

| Motor | ¿Funciona? |
|-------|-----------|
| **SQLite** | ✅ Sí (soporta subconsultas correlacionadas con LIMIT) |
| **PostgreSQL** | ✅ Sí (soporta subconsultas correlacionadas con LIMIT) |

### Efecto en el progreso

Con el fix, `actualizarProgreso()` en el frontend cuenta cada solicitud una sola vez:

```javascript
solicitudes.forEach(function(sol) {
    // Ahora cada sol es UNA solicitud con su última gestión
    if (sol.gestion_id && sol.tipo_gestion && sol.tipo_gestion !== 'Pendiente') {
        gestionadas++;  // Solo cuenta una vez por solicitud
    }
});
```

### ¿Y el historial?

El historial completo de cada solicitud **no se pierde**. Solo cambia lo que se muestra en las cards de Gestión por Lotes (que deben mostrar el **estado actual**, no el histórico). Si el usuario necesita ver el historial, puede hacerlo desde:
- **Solicitudes** → seleccionar una solicitud → ver historial
- **👁️ Ver Gestión** en la card (muestra la última gestión registrada)

## 📂 Archivos modificados

| Archivo | Cambio |
|---------|--------|
| `src/controllers/gestionesMaestro.controller.js` | Query SQL en `getGestionMaestroById()` — subconsulta para última gestión |
