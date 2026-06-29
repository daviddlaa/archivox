# 🔍 Diagnóstico: Gestión por Lotes

## 📋 Resumen de Problemas

### Problema 1: No redirige después de crear gestión
**Síntoma:** La gestión se crea en BD pero no redirige a `/gestion-lote?id=X`.  
**Consola:**
```
[crearGestionLote] Response status: 200
[crearGestionLote] Resultado: Object
[crearGestionLote] Error: Object
```

### Problema 2: Las solicitudes no se muestran al hacer clic en campaña
**Síntoma:** La campaña aparece en el sidebar pero al hacer clic no se ven las gestiones a la derecha.

---

## 🔎 Análisis Técnico

### Problema 1 — Código en `public/desktop/js/solicitudes.js`

```javascript
if (response.ok && resultado.id) {
    window.location.href = '/gestion-lote?id=' + resultado.id;
} else {
    var msg = resultado.error || 'Error desconocido';
    alert('Error: ' + msg);
    console.error('[crearGestionLote] Error:', resultado);
}
```

**Causa:** El `response.status` es 200 (OK), pero `resultado.id` es `undefined` o `null`.

**Revisando el backend** (`src/controllers/gestionesMaestro.controller.js`):
```javascript
const resultGM = await pool.query(`INSERT INTO gestiones_maestro ...`);
const gestion_id = resultGM.lastInsertRowid;
res.json({ id: gestion_id, mensaje: '...', total_solicitudes: n });
```

El backend usa `pool.query()` para el INSERT. En **better-sqlite3**, el método para INSERT es `run()`, no `query()` (que es para SELECT). El método `query()` puede devolver un objeto que NO tiene `lastInsertRowid`, resultando en `gestion_id = undefined`.

**Solución:** Verificar que `pool.query()` retorna correctamente `lastInsertRowid` para INSERTs, o cambiar a usar el método apropiado de la librería SQLite.

### Problema 2 — Código en `public/desktop/js/gestion-lote.js`

Flujo al hacer clic en campaña:
```javascript
function seleccionarCampaña(id) {
    gestionId = id;
    marcarCampañaActiva(id);
    window.location.href = '/gestion-lote?id=' + id;  // Recarga la página
}
```

Al recargar la página, `init()` se ejecuta:
```javascript
async function init() {
    await cargarListaCampanas();
    gestionId = obtenerGestionId();
    if (gestionId) {
        await cargarGestion();
        await cargarSolicitudes();
        marcarCampañaActiva(gestionId);
    }
}
```

**Causa posible 1:** La función `cargarGestion()` y `cargarSolicitudes()` llaman AMBAS al mismo endpoint:
```javascript
var response = await fetch('/api/gestiones-maestro/' + gestionId);
```

Esto hace **2 llamadas idénticas al servidor**. La segunda sobreescribe `datosGestion` pero usa el resultado para renderizar.

**Causa posible 2:** El SQL en `getGestionMaestroById` usa `LEFT JOIN` con condición `AND g.gestion_maestro_id = ?`:
```sql
LEFT JOIN gestiones g ON s.id_solicitud = g.solicitud_id AND g.gestion_maestro_id = ?
```

Si `pool.query()` no funciona correctamente para el INSERT (Problema 1), las `gestiones` individuales no se crean, y por lo tanto el SELECT devuelve 0 solicitudes.

**Causa posible 3:** La función `cargarGestion()` se ejecuta primero, y si falla (porque no hay datos), hace `window.location.href = '/solicitudes'`, abortando todo el flujo antes de que `cargarSolicitudes()` se ejecute.

---

## ✅ Plan de Solución

### Paso 1: Revisar `db.js` — Cómo maneja `pool.query()` los INSERTs
- Verificar si `pool.query()` retorna `lastInsertRowid` correctamente
- Si no, cambiar a `pool.run()` o el método equivalente

### Paso 2: Simplificar `cargarGestion()` y `cargarSolicitudes()` 
- Hacer una sola llamada al endpoint en lugar de dos
- O que `cargarSolicitudes()` reutilice `datosGestion` si ya se cargó

### Paso 3: Agregar logs de depuración
- En `crearGestionLote()`: loguear `JSON.stringify(resultado)` para ver exactamente qué devuelve el backend
- En `cargarSolicitudes()`: loguear `datosGestion.solicitudes.length`

### Paso 4: Validar que el endpoint `GET /api/gestiones-maestro/:id` funcione correctamente
- Probar con curl o Postman: `GET /api/gestiones-maestro/1`
- Verificar que devuelva `{ ..., solicitudes: [...] }`

---

## 🛠️ Soluciones Inmediatas

### 1. Arreglar `crearGestionLote()` en `solicitudes.js`
Agregar mejor manejo de errores y logging:

```javascript
console.log('[crearGestionLote] Resultado:', JSON.stringify(resultado));
if (response.ok && resultado && resultado.id) {
    // Éxito
} else {
    console.error('[crearGestionLote] resultado.id es:', resultado?.id);
    console.error('[crearGestionLote] resultado completo:', JSON.stringify(resultado));
}
```

### 2. Arreglar `gestion-lote.js` — Evitar doble llamada
```javascript
async function cargarGestionYSolicitudes() {
    var response = await fetch('/api/gestiones-maestro/' + gestionId);
    datosGestion = await response.json();
    solicitudes = datosGestion.solicitudes || [];
    todasLasSolicitudes = [...solicitudes];
    actualizarProgreso();
    renderizarSolicitudes(solicitudes);
}
```

### 3. Arreglar `init()` para manejar errores
```javascript
async function init() {
    await cargarListaCampanas();
    gestionId = obtenerGestionId();
    if (gestionId) {
        try {
            await cargarGestionYSolicitudes();
            marcarCampañaActiva(gestionId);
        } catch (e) {
            console.error('Error al cargar gestión:', e);
        }
    }
}
```

---

## 📊 Diagrama de Flujo Actual

```
Usuario hace clic en "🚀 Crear Gestión"
    → POST /api/gestiones-maestro (status: 200)
    → resultado.id es undefined? → alert("Error: [object Object]")
    → ❌ No redirige

Usuario va a /gestion-lote manualmente
    → init()
    → GET /api/gestiones-maestro (lista campañas) ✅
    → Si hay ?id en URL:
        → GET /api/gestiones-maestro/:id (cargarGestion)
        → GET /api/gestiones-maestro/:id (cargarSolicitudes) ← DUPLICADO
    → Si solicitudes vacías → "No hay solicitudes" ❌
```
