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
| [`docs/informe-drawer-movil.md`](informe-drawer-movil.md) | Auditoría y reparación del Drawer Móvil — causa raíz, comparativa Desktop vs Mobile, cambios realizados |

### Registro de Cambios (Changelog)

| Fecha | Versión | Cambio |
|------|---------|--------|
| Jul 2026 | 1.0 → 2.1 | 🏗️ **Estandarización Frontend (Fases 2-5)** — Botones, badges, modales, análisis legacy |
| Jul 2026 | 2.1 → 2.1.1 | 🐛 **Hotfix Drawer Móvil** — Import missing `drawer.css` en 8 HTML móviles + z-index nav-bottom corregido |
| Jul 2026 | 1.0 → 2.0 | **Optimización de Arquitectura** — Caché, índices, pool, SSE |
| Jul 2026 | 1.0 | Versión inicial del sistema |

---

## 🚀 Changelog v2.1 — Estandarización Frontend (Julio 2026)

### Resumen

Estandarización completa de la interfaz de usuario: sistema unificado de **botones**, **badges**, **modales**, más análisis de pendientes (página legacy, admin header).

### 🎯 Fase 2 — Botones y Badges (Alta prioridad)

**Sistema unificado de botones** (en `public/desktop/css/base.css` + `public/movil/css/estilos.css`):

| Clase | Propósito |
|-------|-----------|
| `.btn` | Botón base (inline-flex, gap, border-radius 8px) |
| `.btn-primary` | Acción principal (azul #2563eb) |
| `.btn-secondary` | Acción secundaria (gris) |
| `.btn-success` | Éxito/confirmación (verde) |
| `.btn-warning` | Advertencia (amarillo) |
| `.btn-danger` | Peligro/eliminar (rojo) |
| `.btn-ghost` | Sutil/transparente |
| `.btn-outline` | Outline azul |
| `.btn-sm` / `.btn-lg` / `.btn-block` | Tamaños |

**Sistema unificado de badges** (por color canónico en inglés):

| Canónico | Aliases legacy |
|----------|---------------|
| `.badge-green` | `.badge-verde`, `.badge-success` |
| `.badge-red` | `.badge-rojo`, `.badge-danger` |
| `.badge-yellow` | `.badge-amarillo`, `.badge-warning` |
| `.badge-blue` | `.badge-azul`, `.badge-info` |
| `.badge-purple` | — |
| `.badge-gray` | `.badge-secondary` |

**Etiquetas de estado** unificadas (`.estado-ACTIVADA`, `-RECHAZADA`, `-DEVUELTA`, `-PENDIENTE`, `-EN_REVISION`) — eliminados duplicados de `main.css`.

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

---

### 🎯 Fase 3 — Sistema Unificado de Modales (Media prioridad)

**Nuevos archivos creados:**

| Archivo | Descripción |
|---------|-------------|
| `public/css/modal.css` | Estilos compartidos — overlay, content, header, body, footer, animaciones, responsive |
| `public/js/modal.js` | API unificada con backward compatibility |

**API de Modal:**
```javascript
Modal.abrir(html, { ancho: 'wide'|'narrow' })   // Modal genérico
Modal.cerrar()                                    // Cerrar con animación
Modal.confirmar({ titulo, mensaje, icono, onConfirm })  // Confirmación
Modal.formulario({ titulo, html, onGuardar })     // Formulario con header+footer
```

**Archivos migrados (eliminado inline `crearModal`/`cerrarModal`):**

| Archivo | Líneas eliminadas | Sistema anterior |
|---------|:-----------------:|-----------------|
| `desktop/js/solicitudes.js` | ~15 | `crearModal()` inline con `modal-overlay` |
| `desktop/js/gestiones.js` | ~28 | `crearModal()` inline con ID `modal-gestiones` |
| `desktop/js/relaciones.js` | ~16 | `crearModal()` inline con estilo inline |
| `desktop/js/gestion-lote.js` | ~30 | `crearModal()` inline con estilo inline |

**SweetAlert2 reemplazado:**
- `public/desktop/js/ventas.js` — `Swal.fire()` → `Modal.formulario()` + `alert()`
- `public/desktop/ventas.html` — CDN `sweetalert2@11` eliminado

**Páginas actualizadas con `modal.css` + `modal.js`:**
`solicitudes.html`, `gestiones.html`, `relaciones.html`, `gestion-lote.html`, `ventas.html`

**Excepción documentada:** Panel Admin (`admin/index.html`) mantiene su propio sistema de modales (HTML en DOM + clase `.active` + overlay compartido). No se migró porque:
- Tiene 4 modales con lógica compleja (validación, AJAX, reset de campos)
- Tiene overlay compartido entre múltiples modales
- Es más seguro mantenerlo estable que refactorizarlo

---

### 🎯 Fase 4 — Análisis Página Legacy (`public/index.html`)

**Estado actual:**
- Sidebar antiguo (`sidebar.movable` con `toggleMenu()`)
- Sin autenticación (links a `/login`)
- Sin Drawer, sin notificaciones, sin `.page-header`
- Usa `css/main.css` (~2000 líneas)
- Usa `js/dashboard.js` independiente
- Sin versión responsive funcional

**Estrategia de migración (estimado ~45 min):**
1. Reemplazar `<aside class="sidebar movable">` por `<div id="drawer-wrapper">`
2. Cambiar `css/main.css` por `desktop/css/base.css` + `css/drawer.css`
3. Eliminar `toggleMenu()` y su JS asociado
4. Agregar `.page-header` con título y campanita de notificaciones
5. Cargar `drawer.js` + `notificaciones-dashboard.js`
6. Migrar dashboard stats a `desktop/js/dashboard.js`

**Riesgo:** Bajo — la página es un placeholder simple sin funcionalidad real.

---

### 🎯 Fase 5 — Análisis Admin Header (Baja prioridad)

**Decisión: NO unificar.** El `admin-header` tiene funcionalidades que `.page-header` no soporta:
- Botón de menú específico (`.admin-menu-btn`)
- Reloj en vivo (`.admin-clock`)
- Badge de rol (`.admin-badge`: "Super Admin" / "Admin")
- Layout con tabs debajo del header

**Recomendación futura:** En un rediseño del panel admin, `.admin-header` podría heredar de `.page-header` con extensiones CSS. También se podría eliminar ~100 líneas de CSS duplicado de modales en `admin.css` importando `modal.css`.

---

### 📊 Resumen de cambios — Sesión Estandarización Frontend

| Concepto | Antes | Después |
|---------|-------|---------|
| Sistemas de botones | ~50 clases en ~12 archivos CSS | 1 sistema unificado (8 variantes) en `base.css` + `estilos.css` |
| Sistemas de badges | 3 sistemas independientes | 1 sistema por color con aliases legacy |
| Sistemas de modales | 4 implementaciones inline + SweetAlert2 | 1 compartido (`modal.js` + `modal.css`) + 1 excepción (admin) |
| SweetAlert2 | CDN externo en ventas.html | Eliminado (reemplazado por Modal) |
| Código eliminado | ~160+ líneas (inline crearModal + Swal + script temp) | Código más limpio y mantenible |

### 📌 Pendientes para próximas fases

- [ ] Integrar `modal.js` en `drawer.js` para auto-carga en nuevas páginas
- [ ] Unificar CSS de modales admin con `modal.css` (~100 líneas duplicadas)
- [ ] Migrar `public/index.html` legacy (~45 min)
- [ ] Rediseñar panel admin (incluye header + modales)

---

## 📋 Arquitectura del Sistema (v2.1 → v3.0)

### Visión General

**ANTES (v2.1): Sistema plano sin equipos**
```
Frontend (HTML/CSS/JS Vanilla)         Frontend (Desktop + Móvil + Admin)
    Desktop  ───  Móvil  ───  Admin         ↕ HTTP REST + SSE (NotificationBus)
        ↕ HTTP REST + SSE              Backend (Express.js 5)
Backend (Express.js 5)                      Routes → Middleware (auth) → Controllers → Services → DB
    Routes → Middleware → Controllers → DB     ↕ SQL parametrizado + Pool de conexiones
        ↕ SQL parametrizado + Pool          PostgreSQL (producción) / SQLite (local)
PostgreSQL (producción) / SQLite (local)      • 18 tablas (12 originales + 6 nuevas)
    • 12 tablas • 26 índices • WAL mode          • 43 índices (26 originales + 17 nuevos)
```                                         • Capa organizacional multi-equipo

### 🆕 Arquitectura Multi-Equipo (v3.0)

```
                    ┌─────────────────────┐
                    │     SUPERADMIN       │
                    └──────────┬──────────┘
                               │
              ┌────────────────┼────────────────┐
              │                │                │
    ┌─────────┴─────────┐  ┌──┴──────────┐  ┌──┴──────────┐
    │   EQUIPO "VENTAS"  │  │ EQUIPO "COB" │  │EQUIPO "SISTEMA"│
    │  (Nuevo)           │  │ (Nuevo)      │  │(Migración auto)│
    └─────────┬─────────┘  └──┬──────────┘  └──┬──────────┘
              │                │                │
    ┌─────────┴─────────┐  ┌──┴──────────┐  ┌──┴──────────┐
    │  LÍDER: Carlos    │  │ LÍDER: María │  │  SUPERADMIN  │
    └─────────┬─────────┘  └──┬──────────┘  └──────┬───────┘
              │                │                     │
    ┌─────────┴─────────┐  ┌──┴──────────┐     Usuarios
    │ AGENTE: Pedro     │  │AGENTE: Juan  │    actuales
    │ AGENTE: Ana       │  │AGENTE: Luis  │
    └───────────────────┘  └──────────────┘
```

### Estructura del Sistema

```
SUPERADMIN → EQUIPOS → LÍDER → AGENTES → CAMPAÑAS → SOLICITUDES → GESTIONES
```

### Filosofía: Separación de Conceptos

| Concepto | Qué determina | Dónde se almacena |
|----------|---------------|-------------------|
| **ROL** | Quién es el usuario | `usuarios.rol` (existente) |
| **EQUIPO** | Con quién trabaja | `equipo_usuarios` (NUEVA) |
| **PERMISOS** | Qué puede hacer | `permisos_roles` (NUEVA) |
| **ASIGNACIONES** | Sobre qué solicitudes trabaja | `asignaciones_solicitudes` (NUEVA) |

### Roles del Sistema

| Rol | Level | ¿Puede crear? | ¿Puede asignar? | ¿Qué ve? |
|-----|:-----:|---------------|-----------------|----------|
| **superadmin** | 100 | Equipos, Líderes, Admins | Todo | Todo el sistema |
| **admin** | 50 | Usuarios (no admins) | No | Sistema completo |
| **lider** | 30 | Agentes (solo en su equipo) | Solicitudes a sus agentes | Solo su equipo |
| **agente** | 20 | Nada | Nada | Sus campañas, solicitudes, gestiones |
| **user** | 10 | Nada | Nada | Sus propios datos (legacy) |

### Capa de Caché

```
Cliente → API → Cache (node-cache, RAM)
                ├── Hit (≤30s) → Responde inmediato
                └── Miss (>30s) → Consulta PostgreSQL → Almacena en caché → Responde
                
Invalidación: uploadExcel, crearSolicitudManual, eliminarSolicitud, 
              limpiarSolicitudes, actualizarSolicitudEditar
```

---

## 🗄️ Modelo de Datos Multi-Equipo

### 6 Tablas Nuevas

| # | Tabla | Propósito | FK |
|---|-------|-----------|:--:|
| 1 | `equipos` | Catálogo de equipos organizacionales | — |
| 2 | `equipo_usuarios` | Membresía usuario↔equipo con historial | equipos, usuarios |
| 3 | `permisos_roles` | Permisos por rol (extensible) | — |
| 4 | `permisos_equipo` | Permisos extras por equipo | equipos |
| 5 | `asignaciones_solicitudes` | **Corazón del sistema**: qué solicitud→qué equipo/agente | equipos, usuarios |
| 6 | `campañas_equipo` | Asociación campaña↔equipo | equipos |

### 1 Tabla Modificada

| Tabla | Cambio | Default |
|-------|--------|:-------:|
| `gestiones_maestro` | + `equipo_id` (INTEGER, nullable) | `NULL` = comportamiento actual |

### 17 Nuevos Índices

| Tabla | Índice | Columnas |
|-------|--------|----------|
| `equipos` | `idx_equipos_activo` | activo |
| `equipo_usuarios` | `idx_equipo_usuarios_usuario_activo` | (usuario_id, fecha_salida) |
| `equipo_usuarios` | `idx_equipo_usuarios_equipo` | (equipo_id, es_lider, fecha_salida) |
| `equipo_usuarios` | `idx_equipo_usuarios_lider` | (equipo_id, es_lider) WHERE líder activo |
| `permisos_roles` | `idx_permisos_roles_rol` | (rol) |
| `permisos_equipo` | `idx_permisos_equipo_equipo` | equipo_id |
| `asignaciones_solicitudes` | `idx_asignaciones_solicitud_activa` | (solicitud_id, fecha_desasignacion) |
| `asignaciones_solicitudes` | `idx_asignaciones_usuario_activas` | (usuario_id, fecha_desasignacion) |
| `asignaciones_solicitudes` | `idx_asignaciones_equipo_activas` | (equipo_id, fecha_desasignacion) |
| `asignaciones_solicitudes` | `idx_asignaciones_campaña` | (desde_campaña_id, fecha_desasignacion) |
| `asignaciones_solicitudes` | `idx_asignaciones_fecha` | fecha_asignacion DESC |
| `campañas_equipo` | `idx_campañas_equipo_equipo` | equipo_id |
| `gestiones_maestro` | `idx_gestiones_maestro_equipo` | equipo_id |

### 47 Permisos por Rol

| Rol | Permisos |
|-----|----------|
| **líder** (20) | equipo:ver/gestionar, agentes:ver/crear/editar, campañas:ver/crear/gestionar/asignar, solicitudes:importar/ver-equipo/asignar/reasignar, dashboard:ver-equipo/ver-agentes, gestiones:ver-equipo, relaciones:ver-equipo, historial:ver-equipo |
| **agente** (12) | campañas:ver-propias, solicitudes:ver-asignadas/gestionar/editar-estado/completar-info, gestiones:crear/ver-propias/editar, relaciones:gestionar, historial:ver-propio, perfil:ver/editar |
| **user** (15) | solicitudes:importar/ver-propias/gestionar, campañas:crear/gestionar, gestiones:crear/ver-propias/editar, relaciones:gestionar, ventas:gestionar, historial:ver-propio, perfil:ver/editar |

---

## 🔐 Flujo de Permisos

```
Petición del usuario
        │
        ▼
Middleware: requiresAuth
        │
    ┌───┴───┐
    │       │
  NO (401) SÍ (continúa)
    │       │
    ▼       ▼
¿Requiere permiso específico?
    │       │
  NO (pasa) SÍ (verificar)
                │
        ┌──────┴──────┐
        │             │
    SUPERADMIN?    NO → Buscar en permisos_roles
        │                  (según su rol)
        │             │
      ✅ PASA        Buscar en permisos_equipo
                         (según su equipo)
                          │
                    ┌─────┴─────┐
                    │           │
                  SÍ (✅)    NO (403)
```

---

## 🔄 Flujo de Asignaciones

```
LÍDER importa Excel o crea solicitud
        │
        ▼
  Solicitud INSERT en DB
  (usuario_id = líder)
        │
        ▼
  Asignación automática al equipo del líder
  (sin agente específico)
        │
    ┌───┴───┐
    │       │
  Directa  Campaña
    │       │
    ▼       ▼
  INSERT INTO    LÍDER asigna campaña
  asignaciones   a agente(s)
    │            │
    └────┬───────┘
         │
         ▼
  AGENTE ve solicitud asignada
         │
         ▼
  AGENTE realiza gestiones
         │
         ▼
  LÍDER monitorea progreso
  desde dashboard del equipo
```

---

## 🌐 Endpoints API Multi-Equipo

| Método | Ruta | Propósito | Acceso |
|--------|------|-----------|:------:|
| GET | `/api/equipos` | Listar equipos | Autenticado |
| GET | `/api/equipos/mi-equipo` | Info del equipo del usuario | Autenticado |
| GET | `/api/equipos/:id` | Ver equipo con detalle | requiresEquipo |
| POST | `/api/equipos` | Crear equipo | superadmin |
| PUT | `/api/equipos/:id` | Actualizar equipo | superadmin |
| DELETE | `/api/equipos/:id` | Eliminar equipo | superadmin |
| GET | `/api/equipos/:id/miembros` | Listar miembros del equipo | Autenticado |
| GET | `/api/equipos/:id/dashboard` | Dashboard del equipo | requiresEquipo |
| GET | `/api/equipos/:id/gestiones` | Gestiones del equipo | requiresEquipo |
| GET | `/api/equipos/:id/campanas` | Campañas del equipo | Autenticado |
| POST | `/api/equipos/:id/agentes` | Crear agente en equipo | requiresPermissionAsync('agentes:crear') |
| PUT | `/api/equipos/:id/asignar-lider` | Asignar líder del equipo | superadmin |
| PUT | `/api/equipos/:id/remover-miembro` | Remover miembro del equipo | superadmin |
| POST | `/api/equipos/:id/mover-usuario` | Mover usuario entre equipos | superadmin |

---

## 📱 Frontend — Páginas Multi-Equipo

| Ruta | Página | Para quién |
|------|--------|:----------:|
| `/` | Dashboard con card "Mi Equipo" | Todos (con equipo) |
| `/equipo` (nueva) | Panel del Líder | Líderes / Admins |
| `/admin` → pestaña Equipos | Gestión de equipos | SuperAdmin |

### Panel del Líder (`/equipo`)
- Dashboard con stats (agentes, asignaciones, campañas, gestiones)
- Acciones rápidas (crear agente, importar Excel, crear campaña)
- Tabla de agentes con asignaciones y gestiones 7d
- Tabla de campañas con barras de progreso
- Gestiones recientes del equipo
- Modal para crear agente
- Modal para ver asignaciones por agente

### Card "Mi Equipo" en Dashboard
- Visible para todos los usuarios con equipo
- Muestra: nombre del equipo, líder, agentes totales, asignaciones activas
- Badge de rol (líder/agente/miembro)

---

## 📁 Migraciones Ejecutadas

| Migración | Archivo | Descripción | Fecha |
|-----------|---------|-------------|:----:|
| 002 | `migrations/002_add_compound_indexes.js` | 11 índices compuestos de rendimiento | Jul 2026 |
| 003a | `migrations/003_create_team_tables.js` | 6 tablas multi-equipo + modificar gestiones_maestro | Jul 2026 |
| 003b | `migrations/003_seed_team_data.js` | Seed: equipo Sistema, 9 usuarios, 47 permisos | Jul 2026 |

---

## 📊 Archivos del Proyecto (v3.0)

### Backend (`src/`)

| Ruta | Archivos | Propósito |
|------|----------|-----------|
| `src/config/` | `db.js`, `cache.js`, `permissions.js`, `initDb*.js`, `multer.config.js`, `database*.js` | Configuración global, pool BD, caché, roles |
| `src/controllers/` | `auth`, `excel`, `dashboard`, `admin`, `estadisticas`, `equipos` (🆕), `gestionesMaestro`, `notificaciones`, `relaciones`, `relacionesGestion` | Lógica de negocio |
| `src/middleware/` | `auth.middleware.js` | Autenticación, autorización, sesión |
| `src/routes/` | `auth`, `admin`, `equipos` (🆕), `excel`, `gestionesMaestro`, `relaciones`, `relacionesGestion`, `debug` | Definición de rutas API |
| `src/services/` | `excel.service.js`, `relaciones.service.js`, `notificationBus.js` | Lógica reutilizable |

### Frontend (`public/`)

| Ruta | Propósito |
|------|-----------|
| `public/desktop/` | Versión escritorio (+ `equipo.html` 🆕) |
| `public/movil/` | Versión móvil |
| `public/admin/` | Panel de administración (+ pestaña Equipos 🆕) |
| `public/desktop/css/equipo.css` 🆕 | Estilos del Panel del Líder |
| `public/desktop/js/equipo.js` 🆕 | JS del Panel del Líder |
| `public/css/` | Estilos compartidos |
| `public/js/` | JS compartido, drawer.js (🆕 enlace líder), deep-link-router.js |

### Migraciones (`migrations/`)

| Archivo | Descripción |
|---------|-------------|
| `001_add_admin_columns.*` | Columnas admin + audit_log |
| `002_add_compound_indexes.*` | 11 índices compuestos ( ⚡ejecutado en producción) |
| `003_create_team_tables.*` 🆕 | 6 tablas multi-equipo ( ⚡ejecutado en producción) |
| `003_seed_team_data.*` 🆕 | Seed datos iniciales ( ⚡ejecutado en producción) |
| `003_rollback_team_tables.*` 🆕 | Rollback completo |

### Documentación (`docs/`)

| Archivo | Descripción |
|---------|-------------|
| `README.md` | **Este archivo** — índice central actualizado v3.0 |
| `informe-arquitectura-multi-equipo.md` 🆕 | Diseño completo de arquitectura multi-equipo |
| `informe-modelo-datos-multi-equipo.md` 🆕 | Especificación detallada del modelo de datos |
| `progreso-multi-equipo.md` 🆕 | Seguimiento de progreso del proyecto v3.0 |
| `informe-auditoria-rendimiento.md` | Auditoría de rendimiento (v2.0) |
| `informe-optimizacion-arquitectura.md` | Optimización de arquitectura (v2.0) |
| `anteriores/` | Documentación de sesiones anteriores |

---

## 🔐 Comandos Útiles

```bash
# Iniciar servidor local
node app.js

# Migrar a PostgreSQL (ejecutado en producción)
DATABASE_URL=postgresql://... node migrations/002_add_compound_indexes.js
DATABASE_URL=postgresql://... node migrations/003_create_team_tables.js
DATABASE_URL=postgresql://... node migrations/003_seed_team_data.js

# Rollback multi-equipo (solo si es necesario)
# Ejecutar script SQL: migrations/003_rollback_team_tables.sql

# Commit y push
git add .
git commit -m "Actualizacion general"
git push
```

---

## ✅ Resumen Fases del Proyecto v3.0

| Fase | Descripción | Archivos clave |
|:----:|-------------|----------------|
| **0** | Auditoría completa del sistema | Sin cambios de código |
| **1** | Diseño de arquitectura multi-equipo | `docs/informe-arquitectura-multi-equipo.md` |
| **2** | Diseño del modelo de datos | `docs/informe-modelo-datos-multi-equipo.md` |
| **3** | Migraciones generadas (PG + SQLite + rollback) | 8 archivos en `migrations/003_*` |
| **4** | Migraciones ejecutadas en producción | 6 tablas, 9 usuarios, 47 permisos |
| **5** | Backend: controllers, middleware, permisos | `permissions.js`, `auth.middleware.js`, `equipos.controller.js` |
| **6** | Panel SuperAdmin: gestión de equipos | `admin/index.html` + pestaña Equipos |
| **7** | Panel del Líder: dashboard + agentes + campañas | `desktop/equipo.html` + JS/CSS |
| **8** | Panel del Agente: card Mi Equipo | `desktop/index.html` + card en dashboard |
| **9** | Pruebas de regresión | 28 módulos OK, 20 endpoints OK, 22 HTML OK, 18 JS OK |

---

## 📌 Notas de Producción (Render)

- Base de datos PostgreSQL se actualiza automáticamente al iniciar (`initDb.pg.js`)
- Las migraciones multi-equipo ya se ejecutaron en producción (FASE 4)
- `SESSION_SECRET` debe configurarse como variable de entorno
- Plan Free Render: 512MB RAM — suficiente para 50 usuarios concurrentes
- Pool de conexiones: `max: 20`, `idleTimeoutMillis: 30000`
- Caché en RAM: dashboard TTL 30s, datos globales TTL 300s

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
