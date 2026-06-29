# Fix: Eliminar escritura innecesaria en tabla `gestiones` al crear Campaña

## 📅 Fecha
29 de junio de 2026

## 🐛 Problema

Al crear una **gestión por lotes (campaña)**, el sistema escribía **un registro en la tabla `gestiones` por cada solicitud** incluida en la campaña, con `tipo_gestion = 'Pendiente'` y `observacion = 'Por gestionar'`.

### Código ELIMINADO en `createGestionMaestro()` (`src/controllers/gestionesMaestro.controller.js`)

```javascript
// ❌ ESTO YA NO SE HACE
for (const sol_id of solicitudes_ids) {
    await pool.query(`
        INSERT INTO gestiones (solicitud_id, usuario_id, tipo_gestion, observacion, gestion_maestro_id)
        VALUES (?, ?, 'Pendiente', 'Por gestionar', ?)
    `, [sol_id, usuario_id, gestion_id]);
}
```

### Impacto del problema

| Aspecto | Detalle |
|---------|---------|
| **Escrituras innecesarias** | Por cada solicitud en la campaña se hacía un `INSERT` en `gestiones` con datos falsos |
| **Volumen** | Campaña con 10,000 solicitudes → 10,000 `INSERT` basura |
| **Lecturas contaminadas** | La query `getGestionMaestroById()` debía excluirlos con `WHERE tipo_gestion != 'Pendiente'` |
| **Conteo de progreso** | El progreso debía ignorar 'Pendiente' explícitamente |

## ✅ Solución Aplicada

**Guardar los IDs de solicitudes como JSON** directamente en una nueva columna `solicitudes_ids` de la tabla `gestiones_maestro`.

### 1. Nueva columna en `gestiones_maestro`

```sql
solicitudes_ids TEXT  -- ej: "[1,2,3,4,5]"
```

### 2. En `createGestionMaestro()` — eliminar loop, guardar JSON

**ANTES:** INSERT en gestiones_maestro (1) + loop INSERT en gestiones (N)

**AHORA:** INSERT en gestiones_maestro con `solicitudes_ids` incluido (1 sola query)

```javascript
const solicitudesIdsJson = JSON.stringify(solicitudes_ids);

const resultGM = await pool.query(`
    INSERT INTO gestiones_maestro (nombre, descripcion, usuario_id, total_solicitudes, gestionadas, fecha_limite, solicitudes_ids)
    VALUES (?, ?, ?, ?, 0, ?, ?)
`, [nombre, descripcion || '', usuario_id, solicitudes_ids.length, fecha_limite || null, solicitudesIdsJson]);
```

### 3. En `getGestionMaestroById()` — leer IDs desde JSON

**ANTES:** Subconsulta a `gestiones` para saber qué solicitudes pertenecen a la campaña

**AHORA:** Leer `gestion.solicitudes_ids`, parsear JSON, construir IN clause:

```javascript
var solicitudesIds = JSON.parse(gestion.solicitudes_ids);
const placeholders = solicitudesIds.map(() => '?').join(',');
// WHERE s.id_solicitud IN (${placeholders})
```

### 4. En `obtenerProgresoGestion()` — simplificar conteo

Se eliminó la exclusión de `'Pendiente'` ya que esos registros ya no existen.

## 📁 Archivos modificados

| Archivo | Cambio |
|---------|--------|
| `src/controllers/gestionesMaestro.controller.js` | `createGestionMaestro()`: +solicitudes_ids, -loop INSERT gestiones |
| `src/controllers/gestionesMaestro.controller.js` | `getGestionMaestroById()`: usar JSON.parse + IN clause |
| `src/controllers/gestionesMaestro.controller.js` | `obtenerProgresoGestion()`: simplificar conteo |
| `src/config/initDb.js` | +columna `solicitudes_ids TEXT` en CREATE TABLE |
| `src/config/initDb.pg.js` | +columna `solicitudes_ids TEXT` en CREATE TABLE |
| `migracion-agregar-solicitudes-ids.sql` | Script de migración para producción (Render/PostgreSQL) |

## 🗄️ Migración para producción (PostgreSQL en Render)

### Método 1 (recomendado) — Usar Node.js (no requiere psql)

El proyecto ya tiene el paquete `pg` instalado. Ejecutar:

```bash
node migrar-produccion.js
```

Esto lee automáticamente la `DATABASE_URL` desde `.env.template` y ejecuta la migración.

### Método 2 — Usar psql (si está instalado)

```bash
psql "$DATABASE_URL" -f migracion-agregar-solicitudes-ids.sql
```

O con el .bat:
```bash
migrar-produccion.bat
```

> ⚠️ Si `psql` no está instalado, usar Método 1.

### Método 3 — Consola SQL de Render (web)

Ir a Render Dashboard → Database → SQL (Run Query) y pegar:

```sql
ALTER TABLE gestiones_maestro ADD COLUMN IF NOT EXISTS solicitudes_ids TEXT;

UPDATE gestiones_maestro gm
SET solicitudes_ids = (
    SELECT COALESCE(
        '[' || string_agg(DISTINCT g.solicitud_id::text, ',' ORDER BY g.solicitud_id::text) || ']',
        '[]'
    )
    FROM gestiones g
    WHERE g.gestion_maestro_id = gm.id
)
WHERE gm.solicitudes_ids IS NULL;

DELETE FROM gestiones
WHERE tipo_gestion = 'Pendiente' 
  AND observacion = 'Por gestionar'
  AND gestion_maestro_id IS NOT NULL;
```

### Scripts disponibles

| Archivo | Descripción |
|---------|-------------|
| `migrar-produccion.js` | ✅ Script Node.js (usa paquete `pg`, no requiere psql) |
| `migrar-produccion.bat` | Script .bat para Windows (requiere psql) |
| `migracion-agregar-solicitudes-ids.sql` | Script SQL puro (referencia) |

## 📊 Resultado

| Antes | Después |
|-------|---------|
| 10,000 solicitudes = 10,001 INSERTs (1 maestro + 10,000 basura) | 10,000 solicitudes = **1 INSERT** (solo maestro con JSON) |
| `gestiones` llena de registros "Pendiente/Por gestionar" | `gestiones` solo tiene **gestiones reales** |
| Queries con `tipo_gestion != 'Pendiente'` | Queries sin exclusiones |

## ✅ Frontend no requiere cambios

El `COALESCE(g.tipo_gestion, 'Pendiente')` y `COALESCE(g.observacion, 'Por gestionar')` en la query siguen funcionando: cuando una solicitud no tiene gestiones reales, el LEFT JOIN devuelve NULL y se muestra "Pendiente" automáticamente.
