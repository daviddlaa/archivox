# 🚀 Fix: Gestión por Lotes — Documentación Completa

## 📋 Resumen

Se corrigieron **4 bugs** en el módulo de Gestión por Lotes que impedían:
1. Crear gestiones correctamente en PostgreSQL (producción en Render)
2. Redirigir a la página de gestión después de crear
3. Mostrar las solicitudes al hacer clic en una campaña
4. Que la versión móvil funcionara consistentemente

---

## 🐛 Bug #1 — `lastInsertRowid` no existe en PostgreSQL

### Síntoma
```json
// Respuesta del servidor (status 200):
{"mensaje":"Gestión creada correctamente","total_solicitudes":6}
// Falta "id" → resultado.id = undefined → no redirige
```

### Causa Raíz
El wrapper de PostgreSQL en `src/config/db.js` usaba `pool.query()` de la librería `pg`, que **NO** tiene la propiedad `lastInsertRowid` (es exclusiva de SQLite).

El controlador `gestionesMaestro.controller.js` hacía:
```javascript
const resultGM = await pool.query(`INSERT INTO gestiones_maestro ...`);
const gestion_id = resultGM.lastInsertRowid;  // undefined en PostgreSQL
```

### Solución
**Archivo:** `src/config/db.js`

**Wrapper PostgreSQL:** Se agrega `RETURNING id` automáticamente a todos los INSERTs y se extrae `lastInsertRowid` desde `result.rows[0].id`:

```javascript
// Auto-add RETURNING id for INSERT queries
if (trimmed.startsWith('INSERT') && !trimmed.includes('RETURNING')) {
    pgSql += ' RETURNING id';
}

return originalQuery(pgSql, queryParams).then(function(result) {
    if (result.rows && result.rows.length > 0 && result.rows[0].id != null) {
        result.lastInsertRowid = result.rows[0].id;  // ← Compatibilidad con código existente
    }
    return result;
});
```

**Wrapper SQLite:** Se agregó soporte para queries con `RETURNING`:
```javascript
if (/\bRETURNING\b/i.test(sqliteSql)) {
    const rows = db.prepare(sqliteSql).all(...queryParams);
    return Promise.resolve({ rows, rowCount: rows.length, lastInsertRowid: rows[0]?.id });
}
```

---

## 🐛 Bug #2 — Redirección no funcionaba por falta de `id`

### Síntoma
```javascript
// solicitudes.js
if (response.ok && resultado.id) {  // resultado.id = undefined
    window.location.href = '/gestion-lote?id=' + resultado.id;  // No se ejecuta
}
```

### Causa
Consecuencia directa del Bug #1. Al no venir `id` en la respuesta, la condición fallaba y se mostraba el error.

### Solución
**Archivo:** `public/desktop/js/solicitudes.js`

Se mejoró el logging para diagnosticar:
```javascript
console.log('[crearGestionLote] Resultado JSON:', JSON.stringify(resultado));
console.log('[crearGestionLote] response.ok:', response.ok, 'resultado.id:', resultado && resultado.id);
```

Y se agregó null-check:
```javascript
if (response.ok && resultado && resultado.id) { ... }
```

---

## 🐛 Bug #3 — Doble llamada API y error silencioso en `gestion-lote.js`

### Síntoma
```
[cargarDatosGestion] Response status: 200
[cargarDatosGestion] Solicitudes recibidas: 0
```
La campaña se veía en el sidebar, pero al hacer clic no mostraba las solicitudes.

### Causa
1. `cargarGestion()` y `cargarSolicitudes()` llamaban **2 veces** al mismo endpoint
2. Si `cargarGestion()` fallaba, redirigía a `/solicitudes` y abortaba todo
3. Las campañas creadas antes del fix tenían `gestion_maestro_id = NULL` (por Bug #1)

### Solución
**Archivo:** `public/desktop/js/gestion-lote.js`

Se unificaron ambas funciones en una sola:
- `cargarDatosGestion()` — reemplaza a `cargarGestion()` + `cargarSolicitudes()`
- Ya no redirige si falla, solo muestra error en pantalla
- Se agregó `AbortController` con timeout de 10s
- Se agregaron logs de depuración en cada paso

**Archivo:** `public/movil/js/gestion-lote.js`
- Mismos cambios aplicados
- `cargarDatosGestionMovil()` — versión móvil unificada
- Actualizadas referencias en `guardarGestionIndividual()` y `enviarWhatsAppImagen()`

---

## 📁 Archivos Modificados

| Archivo | Cambio |
|---------|--------|
| `src/config/db.js` | `RETURNING id` automático en INSERTs PostgreSQL + soporte RETURNING en SQLite |
| `public/desktop/js/solicitudes.js` | Mejor logging, null-check, mensajes de error descriptivos |
| `public/desktop/js/gestion-lote.js` | Unificación `cargarDatosGestion()`, timeout, logs |
| `public/movil/js/gestion-lote.js` | Unificación `cargarDatosGestionMovil()`, timeout, logs |

---

## 🧪 Cómo Probar

1. Ir a **Solicitudes** → seleccionar algunas → click "🚀 Gestión por Lotes"
2. Llenar nombre, tipo, objetivo → click "🚀 Crear Gestión"
3. ✅ Debe redirigir a `/gestion-lote?id=X`
4. ✅ El sidebar muestra la campaña
5. ✅ Al hacer clic, se ven las solicitudes con botones de gestión
6. ✅ También funciona en versión móvil (`/m/gestion-lote`)

---

## ⚠️ Nota sobre campañas existentes

Las campañas creadas **antes del fix** pueden tener `gestion_maestro_id = NULL` en las gestiones hijas porque `lastInsertRowid` era `undefined`. Solución:
- Eliminar la campaña huérfana desde el botón 🗑️ en la card
- Crear una nueva gestión desde Solicitudes

---

## 📊 Diagrama de Flujo Corregido

```
Usuario → Click "🚀 Crear Gestión"
  → POST /api/gestiones-maestro
    → db.js agrega RETURNING id
    → PostgreSQL inserta y devuelve { id: 42 }
    → resultGM.lastInsertRowid = 42 ✅
  → Response: { id: 42, mensaje: "ok", ... }
  → resultado.id = 42 → Redirige a /gestion-lote?id=42 ✅

/gestion-lote?id=42 → init()
  → cargarListaCampanas() → GET /api/gestiones-maestro ✅
  → cargarDatosGestion() → GET /api/gestiones-maestro/42
    → SQL encuentra gestiones con gestion_maestro_id = 42 ✅
    → solicitudes.length > 0 → Renderiza cards ✅
```
