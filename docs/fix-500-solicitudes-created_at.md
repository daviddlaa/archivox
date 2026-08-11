# Fix: Error 500 en `/api/admin/solicitudes` + mecanismo `SCHEMA_VERSION`

**Fecha:** 2026-08-11
**Entorno:** Producción (Render / PostgreSQL)
**Archivos:** `src/config/initDb.pg.js`
**Estado:** Resuelto y verificado

---

## 1. Síntoma

- `GET /api/admin/solicitudes?pagina=1&limite=50` devolvía **HTTP 500** en producción.
- Localmente funcionaba; el error solo ocurría con el Postgres de Render.
- La causa técnica inmediata: la consulta SQL del listado referencia `s.created_at`,
  columna que **no existía** en la tabla `solicitudes` de producción.

## 2. Causa raíz (importante)

La migración que crea la columna `created_at` **sí estaba** en
`src/config/initDb.pg.js`, pero **nunca se ejecutó** en producción por el
**guard de versión de esquema**:

```js
const SCHEMA_VERSION = 4;                       // ← era 4
...
const versionActual = verRes.rows[0] ? Number(verRes.rows[0].version) : 0;
if (versionActual >= SCHEMA_VERSION) {
    console.log('✅ Esquema actualizado — DDL omitido');
    return;                                     // ← SALE ANTES de las migraciones
}
```

- La BD de producción ya tenía `_schema.version = 4`.
- Como `SCHEMA_VERSION` también era `4`, el arranque hacía `return` temprano y
  **omitía todo el DDL** (CREATE/ALTER idempotentes), incluyendo el
  `ALTER TABLE solicitudes ADD COLUMN IF NOT EXISTS created_at`.

### Regla del guard

> **Subir `SCHEMA_VERSION` (+1) cada vez que se agregue/modifique un DDL o seed**
> nuevo en `initDb.pg.js`. Solo así el próximo arranque re-ejecuta todo el bloque
> (que es 100% idempotente: `IF NOT EXISTS`, `WHERE NOT EXISTS`, `ON CONFLICT DO NOTHING`).
> La tabla ligera `_schema` se actualiza al final con
> `INSERT ... ON CONFLICT (id) DO UPDATE`.

## 3. Solución aplicada

1. **`SCHEMA_VERSION` de 4 → 5** en `src/config/initDb.pg.js:11`.
2. Se aplicó manualmente la migración a la BD de producción (idempotente):
   ```sql
   ALTER TABLE solicitudes ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
   ```
   → verificada con `information_schema.columns` (`created_at` presente).
   Las filas existentes toman `CURRENT_TIMESTAMP` del momento del ALTER
   (la fecha real de cada solicitud ya la da `fecha_solicitud`).

## 4. Verificación

- `node --check src/config/initDb.pg.js` OK.
- Consulta directa a producción: la columna existe.
- `GET /api/admin/solicitudes` responde 200 (sin filtros → 2.010 filas).

## 5. Prevención / checklist para futuros DDL

- [ ] Agregar el `ALTER`/DDL idempotente en `initDb.pg.js`.
- [ ] **Subir `SCHEMA_VERSION` +1** (si se omite, el cambio **no se aplica** en entornos ya inicializados).
- [ ] Verificar en producción consultando `information_schema.columns` o la tabla `_schema`.
- [ ] Todos los seeds del bloque deben ser idempotentes (ya lo son).
