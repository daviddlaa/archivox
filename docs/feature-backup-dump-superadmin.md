# Feature: Backup de base de datos con un clic (SuperAdmin)

**Fecha:** 2026-08-11
**Ámbito:**
- `src/services/dump.service.js` (nuevo)
- `src/controllers/admin.controller.js` (`infoDump`, `descargarDump`)
- `src/routes/admin.routes.js`
- `public/admin/index.html`, `public/admin/js/admin.js` (tab `🗄️ Base de Datos`)
**Estado:** Implementado

## Resumen

Botón **Descargar Dump** en el panel SuperAdmin que genera un respaldo `.sql`
completo (esquema + datos) de la base de datos activa — **PostgreSQL o SQLite** —
sin depender del motor. Pensado como respaldo de contingencia: el respaldo
oficial y completo sigue siendo `pg_dump` en producción.

## API

| Método | Ruta | Auth |
|--------|------|------|
| GET | `/api/admin/dump/info` | superadmin |
| GET | `/api/admin/dump` | superadmin |

### `GET /api/admin/dump/info`

Devuelve metadatos del motor para la UI:

```json
{ "motor": "postgres" | "sqlite", "nombre": "...", "fecha": "..." }
```

### `GET /api/admin/dump`

Descarga el archivo `archivox_dump_<fecha>.sql` (attachment, BOM UTF-8).
El SQL lo genera el propio servicio (`src/services/dump.service.js`) — **no depende
del binario `pg_dump`** — por lo que funciona idéntico en local y en producción:

- **PostgreSQL:** `BEGIN;` + `CREATE TABLE IF NOT EXISTS` (columnas con tipos/PK/UNIQUE,
  `SERIAL` para secuencias) → `INSERT INTO ... VALUES` por fila (solo columnas,
  datos como literales escapados) → `SELECT setval(...)` para las secuencias →
  `ALTER TABLE ... ADD CONSTRAINT ... FOREIGN KEY` al final (tras los datos) → `COMMIT;`.
- **SQLite:** `PRAGMA foreign_keys = OFF;` + DDL original de `sqlite_master` →
  `INSERT INTO ... VALUES` por fila → `COMMIT;` + `PRAGMA foreign_keys = ON;`.

## UI

- Nueva pestaña **🗄️ Base de Datos** en el panel superadmin.
- Muestra el motor activo y un botón **📥 Descargar Dump**.
- Registro de auditoría (`audit_log`) al descargar.

## Seguridad

- Rutas detrás de `requiresRole('superadmin')` + rate limit admin.
- El dump se genera bajo demanda, no se almacena en el servidor.

## Criterios de prueba

1. Con `DATABASE_URL` (Postgres) el dump incluye esquema + datos restaurables.
2. Sin `DATABASE_URL` (SQLite) el dump incluye el esquema + inserts.
3. Usuario no-superadmin → 403.
4. El `.sql` descargado se restaura correctamente en una BD vacía (verificado contra producción).
