# MIGRACIÓN: Columna `accion_modulo` en tabla `notificaciones`

**Fecha:** Julio 2026
**Entorno:** Producción (PostgreSQL en Render.com)
**Arquitectura:** Deep Link Router (Opción B - Identificador Lógico)

---

## Resumen

Se agregó la columna `accion_modulo` a la tabla `notificaciones` en la base de datos de producción. Esta columna almacena un identificador lógico del módulo (ej: `'solicitudes'`, `'dashboard'`, `'relaciones'`) en lugar de una URL fija de plataforma.

## Comandos ejecutados

```bash
DATABASE_URL="postgresql://archivox:JCamkDhipyZlUXmnDuZttLCc6H0WHCZu@dpg-d8j4q0tdt1ts73b81jcg-a.virginia-postgres.render.com/archivox" \
  node scripts/migrate-production-accion-modulo.js
```

## Resultado

| Indicador | Valor |
|-----------|-------|
| Estado | ✅ Exitosa |
| Columna agregada | `accion_modulo` (TEXT, nullable) |
| Registros legacy migrados | 0 (ya migrados en ejecución anterior o no existían) |
| Total notificaciones | 3 |
| Con `accion_modulo` | 3 ✅ |
| Con `accion_url` (legacy) | 3 (preservados) |
| Sin acción | 0 |
| Errores | ❌ Ninguno |

## Cambio en base de datos

```sql
ALTER TABLE notificaciones ADD COLUMN accion_modulo TEXT;
```

## Compatibilidad

- ✅ **Hacia adelante:** Las nuevas notificaciones creadas desde el panel admin usarán `accion_modulo` en lugar de `accion_url`
- ✅ **Hacia atrás:** Las 3 notificaciones existentes con `accion_url` directa siguen funcionando mediante el `DeepLinkRouter.corregirUrl()` que corrige URLs de plataforma incorrecta
- ✅ **Columna `accion_url` se mantiene** para compatibilidad total

## Archivos relacionados

| Archivo | Propósito |
|---------|-----------|
| `public/js/deep-link-router.js` | Sistema de resolución de rutas por plataforma |
| `scripts/migrate-production-accion-modulo.js` | Script de migración ejecutado |
| `docs/informe-deep-links-arquitectura.md` | Documentación técnica completa de la arquitectura |
| `src/config/initDb.js` | Migración automática para SQLite (desarrollo local) |
| `src/config/initDb.pg.js` | Migración automática para PostgreSQL (futuros deploys) |
