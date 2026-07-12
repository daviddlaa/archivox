# 📚 ARCHIVOX — Documentación Técnica

**Versión:** 1.0.0  
**Stack:** Node.js + Express 5 + PostgreSQL (producción) / SQLite (local)  
**Frontend:** HTML5 + CSS3 + JavaScript vanilla (responsive: Desktop + Móvil)  
**Despliegue:** Render  

---

## 📑 Índice de Documentos

### Documentación Principal

| Documento | Descripción |
|-----------|-------------|
| [`docs/informe-auditoria-rendimiento.md`](informe-auditoria-rendimiento.md) | Auditoría completa de rendimiento y escalabilidad — análisis de backend, PostgreSQL, pool, caché, SSE, frontend y escenarios de carga |
| [`docs/informe-optimizacion-arquitectura.md`](informe-optimizacion-arquitectura.md) | Informe de optimización — cambios realizados, justificación técnica, comparativas antes/después y recomendaciones |

### Registro de Cambios (Changelog)

| Fecha | Versión | Cambio |
|------|---------|--------|
| Jul 2026 | 1.0 → 2.0 | **Optimización de Arquitectura** — Ver detalle abajo |
| Jul 2026 | 1.0 | Versión inicial del sistema |

---

## 🚀 Changelog v2.0 — Optimización de Arquitectura (Julio 2026)

### Resumen

Optimización completa de la arquitectura para soportar **100 usuarios registrados** y **30–50 concurrentes** en Render.

### Cambios Implementados

#### 🔧 Backend — Nuevos Archivos

| Archivo | Descripción |
|---------|-------------|
| `src/config/cache.js` | Módulo de caché en servidor con `node-cache` — dashboard (TTL 30s), datos globales (TTL 300s), estadísticas admin (TTL 60s) |
| `src/controllers/dashboard.controller.js` | Controlador independiente para dashboard (SRP) — extraído del monolito `excel.controller.js` |
| `migrations/002_add_compound_indexes.js` | Script ejecutable de migración — crea 11 índices compuestos en PostgreSQL |
| `migrations/002_add_compound_indexes.sql` | Script SQL de migración |

#### 🔧 Backend — Archivos Modificados

| Archivo | Cambio |
|---------|--------|
| `src/config/db.js` | Pool: `max: 20`, `idleTimeoutMillis: 30000`, `connectionTimeoutMillis: 5000`, monitoreo cada 5 min |
| `app.js` | Middleware global de errores agregado (compatible Express 5) |
| `src/controllers/excel.controller.js` | Cache invalidación agregada en 6 mutaciones (import, create, edit, delete, clear). Código duplicado de dashboard eliminado (~300 líneas) |
| `src/routes/excel.routes.js` | Rutas redirigidas a `dashboardController`. `requiresAuth` agregado a ruta `/dashboard` |
| `src/services/notificationBus.js` | Límites: máx 500 clientes totales, máx 5 por usuario, cleanup automático al cerrar |
| `src/config/initDb.pg.js` | 11 índices compuestos agregados para PostgreSQL |
| `src/config/initDb.js` | 11 índices compuestos agregados para SQLite |
| `package.json` | Dependencia `node-cache` agregada |

#### 🎨 Frontend — Modificaciones

| Archivo | Cambio |
|---------|--------|
| `public/desktop/js/dashboard.js` | Polling reducido de 5s → **60s** (reducción del 92%) |
| `public/movil/js/dashboard.js` | Polling eliminado — carga solo al abrir la página y al volver |

#### 🗄️ Base de Datos — Migración Ejecutada en Producción

El **12 de Julio de 2026** se ejecutó la migración `002_add_compound_indexes.js` contra la base de datos PostgreSQL en Render.

**Resultado:** 11/11 índices creados, 0 errores.

| Índice | Tabla | Columnas |
|--------|-------|----------|
| `idx_solicitudes_usuario_id_desc` | solicitudes | (usuario_id, id_solicitud DESC) |
| `idx_solicitudes_usuario_estado` | solicitudes | (usuario_id, estado) |
| `idx_solicitudes_usuario_segmento` | solicitudes | (usuario_id, segmento) |
| `idx_solicitudes_usuario_fecha` | solicitudes | (usuario_id, fecha_solicitud) |
| `idx_solicitudes_cedula` | solicitudes | (cedula) |
| `idx_gestiones_solicitud_usuario_fecha` | gestiones | (solicitud_id, usuario_id, fecha_gestion DESC) |
| `idx_gestiones_usuario_created` | gestiones | (usuario_id, created_at) |
| `idx_gestiones_maestro_id_solicitud` | gestiones | (gestion_maestro_id, solicitud_id) |
| `idx_notificaciones_destinatario_leida` | notificaciones | (destinatario_id, leida, created_at DESC) |
| `idx_historial_usuario_fecha` | historial_actualizaciones | (usuario_id, fecha_actualizacion DESC) |
| `idx_audit_log_accion_fecha` | audit_log | (accion, created_at DESC) |

### Impacto Esperado

| Métrica | Antes | Después | Mejora |
|---------|-------|---------|--------|
| Polling dashboard | 5s (720 req/hora) | 60s (60 req/hora) | **-92%** |
| Dashboard | Sin caché (cada request a PostgreSQL) | Caché en RAM (TTL 30s) | **-90% consultas** |
| Listar solicitudes (100K rows) | Sequential Scan (~500ms) | Index Scan (~2ms) | **250x** |
| Dashboard GROUP BY (100K rows) | Sequential Scan (~800ms) | Index Only Scan (~3ms) | **266x** |
| LATERAL JOIN gestiones | Seq Scan (~2s) | Index Scan (~10ms) | **200x** |
| Pool de conexiones | max 10 (default) | max 20 | **2x capacidad** |
| Conexiones SSE | Sin límite | 500 total, 5/usuario | **Controlado** |

### Pendiente para Completar

- [ ] Configurar `SESSION_SECRET` como variable de entorno en Render
- [ ] Verificar que Render se despliegue correctamente con los cambios

---

## 📋 Arquitectura del Sistema

```
Frontend (HTML/CSS/JS Vanilla)
    Desktop  ───  Móvil  ───  Admin
        ↕ HTTP REST + SSE (NotificationBus)
Backend (Express.js 5)
    Routes → Middleware (auth) → Controllers → Services → DB
        ↕ SQL parametrizado + Pool de conexiones
PostgreSQL (producción) / SQLite (local)
    • 12 tablas • 26 índices • WAL mode (SQLite)
```

### Capa de Caché

```
Cliente → API → Cache (node-cache, RAM)
                ├── Hit (≤30s) → Responde inmediato
                └── Miss (>30s) → Consulta PostgreSQL → Almacena en caché → Responde
                
Invalidación: uploadExcel, crearSolicitudManual, eliminarSolicitud, 
              limpiarSolicitudes, actualizarSolicitudEditar
```

---

## 📊 Archivos del Proyecto

### Backend (`src/`)

| Ruta | Archivos | Propósito |
|------|----------|-----------|
| `src/config/` | `db.js`, `cache.js`, `permissions.js`, `initDb*.js`, `multer.config.js`, `database*.js` | Configuración global, pool BD, caché, roles |
| `src/controllers/` | `auth`, `excel`, `dashboard`, `admin`, `estadisticas`, `gestionesMaestro`, `notificaciones`, `relaciones`, `relacionesGestion` | Lógica de negocio |
| `src/middleware/` | `auth.middleware.js` | Autenticación, autorización, sesión |
| `src/routes/` | `auth`, `excel`, `admin`, `gestionesMaestro`, `relaciones`, `relacionesGestion`, `debug` | Definición de rutas API |
| `src/services/` | `excel.service.js`, `relaciones.service.js`, `notificationBus.js` | Lógica de negocio reutilizable |

### Frontend (`public/`)

| Ruta | Propósito |
|------|-----------|
| `public/desktop/` | Versión escritorio (HTML + CSS + JS) |
| `public/movil/` | Versión móvil (HTML + CSS + JS) |
| `public/admin/` | Panel de administración |
| `public/css/` | Estilos compartidos |
| `public/js/` | JS compartido (login, dashboard base) |

### Migraciones (`migrations/`)

| Archivo | Descripción |
|---------|-------------|
| `001_add_admin_columns.sql` | Migración PostgreSQL — columnas admin + audit_log |
| `001_add_admin_columns.sqlite.sql` | Migración SQLite — columnas admin + audit_log |
| `001_add_admin_columns.js` | Script ejecutable para migración 001 |
| `002_add_compound_indexes.sql` | Migración SQL — 11 índices compuestos |
| `002_add_compound_indexes.js` | **Script ejecutado en producción** — 11 índices compuestos |

### Documentación (`docs/`)

| Archivo | Descripción |
|---------|-------------|
| `README.md` | **Este archivo** — índice central |
| `informe-auditoria-rendimiento.md` | Auditoría completa de rendimiento y escalabilidad |
| `informe-optimizacion-arquitectura.md` | Informe detallado de optimización con comparativas |
| `anteriores/` | Documentación de sesiones anteriores (archivada) |

---

## 🔐 Comandos Útiles

```bash
# Iniciar servidor local
node app.js

# Migrar índices compuestos a PostgreSQL (ejecutado en producción)
DATABASE_URL=postgresql://... node migrations/002_add_compound_indexes.js

# Commit y push
git add .
git commit -m "Mensaje descriptivo"
git push
```

---

## 📌 Notas de Producción (Render)

- La base de datos PostgreSQL en Render se actualiza automáticamente al iniciar el servidor (`initDb.pg.js`)
- Las migraciones deben ejecutarse manualmente con `node migrations/002_*.js`
- `SESSION_SECRET` debe configurarse como variable de entorno
- El plan Free de Render tiene 512MB RAM — suficiente para 50 usuarios concurrentes con las optimizaciones actuales

---

> *Documentación actualizada al 12 de Julio de 2026*
