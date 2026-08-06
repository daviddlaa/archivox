# Archivox

**Version:** 3.0 (Multi-Equipo)
**Fecha:** Julio 2026

Sistema web full-stack para gestion operativa de solicitudes comerciales, relaciones con clientes, equipos de trabajo y campanas de gestion por lotes. Funciona en escritorio y movil con deteccion automatica del dispositivo.

---

## Stack Tecnologico

| Capa | Tecnologia | Version |
|------|-----------|---------|
| Runtime | Node.js | - |
| Framework | Express.js | ^5.2.1 |
| BD Produccion | PostgreSQL (pg) | ^8.13.0 |
| BD Desarrollo | SQLite (better-sqlite3) | ^11.7.0 |
| Seguridad | bcryptjs, helmet, express-rate-limit | ^3.0.3, ^8.0.0, ^7.4.0 |
| Sesiones | express-session | ^1.19.0 |
| Archivos | multer | ^2.1.1 |
| Excel | exceljs | ^3.4.0 |
| Caché | node-cache | ^5.1.2 |
| Notificaciones | Server-Sent Events (SSE) | Nativo |
| Frontend | HTML5 + CSS3 + Vanilla JavaScript | Sin frameworks |

---

## Arquitectura

```
┌─────────────────────────────────────────────────────────┐
│                 CLIENTE (Navegador)                      │
│  ┌──────────┐  ┌──────────┐  ┌────────────────┐        │
│  │ Desktop  │  │  Movil   │  │  Admin Panel   │        │
│  │ HTML+CSS │  │ HTML+CSS │  │  HTML+CSS+JS   │        │
│  │ +Vanilla │  │ +Vanilla │  │                │        │
│  │   JS     │  │   JS     │  │                │        │
│  └────┬─────┘  └────┬─────┘  └───────┬────────┘        │
│       └──────────────┴────────────────┘                  │
│                      │ SSE (Event Stream)                │
└──────────────────────┼──────────────────────────────────┘
                       │ HTTP / SSE
┌──────────────────────┼──────────────────────────────────┐
│              EXPRESS.JS SERVER (app.js)                   │
│                      │                                   │
│  ┌───────────────────┴───────────────────────────────┐  │
│  │  Helmet → Rate Limit → Session → Auth → Routes    │  │
│  └───────────────────┬───────────────────────────────┘  │
│                      │                                   │
│  ┌───────────────────┴───────────────────────────────┐  │
│  │  /api/auth  /api/excel  /api/admin  /api/equipos  │  │
│  │  /api/relaciones  /api/gestiones-maestro           │  │
│  │  /api/catalogos  /api/debug                        │  │
│  └───────────────────┬───────────────────────────────┘  │
│                      │                                   │
│  ┌───────────────────┴───────────────────────────────┐  │
│  │  Controladores → Servicios → db.js (wrapper)      │  │
│  └───────────────────┬───────────────────────────────┘  │
│                      │                                   │
│  ┌───────────────────┴───────────────────────────────┐  │
│  │  PostgreSQL (Produccion)  │  SQLite (Desarrollo)  │  │
│  │                           │  + node-cache (caché) │  │
│  └───────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

### Capa de Abstraccion de BD (`src/config/db.js`)

Un wrapper unificado permite desarrollar con SQLite y producir con PostgreSQL sin cambiar codigo. Convierte automaticamente:
- Placeholders `?` ↔ `$1, $2, ...`
- Funciones `INTERVAL` ↔ `datetime('now', ...)`
- `TO_CHAR()` ↔ `strftime()`
- `RETURNING id` automatico en INSERTs

---

## Estructura del Proyecto

```
ARCHIVOX/
├── app.js                          # Entry point del servidor
├── package.json                    # Dependencias
├── .env                            # Variables de entorno (no trackeado)
│
├── src/                            # Backend
│   ├── config/
│   │   ├── db.js                   # Wrapper unificado SQLite↔PostgreSQL
│   │   ├── database.js             # SQLite directo (better-sqlite3)
│   │   ├── database.pg.js          # PostgreSQL pool (pg)
│   │   ├── initDb.js               # Migraciones automaticas SQLite
│   │   ├── initDb.pg.js            # Migraciones automaticas PostgreSQL
│   │   ├── cache.js                # Caché en servidor (node-cache)
│   │   ├── permissions.js          # Sistema de roles y permisos
│   │   └── multer.config.js        # Config subida de archivos
│   │
│   ├── middleware/
│   │   └── auth.middleware.js       # Autenticación y autorización
│   │
│   ├── controllers/
│   │   ├── auth.controller.js      # Login, registro, perfil
│   │   ├── excel.controller.js     # Solicitudes CRUD, gestiones
│   │   ├── dashboard.controller.js # KPIs, graficos, metricas
│   │   ├── admin.controller.js     # Panel de administracion
│   │   ├── equipos.controller.js   # Multi-equipo
│   │   ├── gestionesMaestro.controller.js  # Campanas por lotes
│   │   ├── relaciones.controller.js        # Relaciones ALTA/BAJA
│   │   ├── relacionesGestion.controller.js # Gestiones de relaciones
│   │   ├── notificaciones.controller.js    # Notificaciones SSE
│   │   └── estadisticas.controller.js      # Metricas por usuario
│   │
│   ├── routes/
│   │   ├── auth.routes.js          # /api/auth/*
│   │   ├── excel.routes.js         # /api/excel/*
│   │   ├── admin.routes.js         # /api/admin/*
│   │   ├── equipos.routes.js       # /api/equipos/*
│   │   ├── relaciones.routes.js    # /api/relaciones/*
│   │   ├── relacionesGestion.routes.js  # /api/relaciones/gestiones/*
│   │   ├── gestionesMaestro.routes.js   # /api/gestiones-maestro/*
│   │   ├── catalog.routes.js       # /api/catalogos/*
│   │   └── debug.routes.js         # /api/debug/*
│   │
│   └── services/
│       ├── excel.service.js        # Procesamiento Excel (solicitudes)
│       ├── relaciones.service.js   # Procesamiento Excel (relaciones)
│       ├── catalog.service.js      # Catalogos dinamicos con fallback
│       └── notificationBus.js      # SSE Bus (EventEmitter)
│
├── public/                         # Frontend (estatico)
│   ├── desktop/                    # Version escritorio
│   │   ├── *.html                  # Paginas desktop
│   │   ├── css/                    # Estilos desktop
│   │   └── js/                     # Logica desktop
│   ├── movil/                      # Version movil
│   │   ├── *.html                  # Paginas movil
│   │   ├── css/                    # Estilos movil
│   │   └── js/                     # Logica movil
│   ├── admin/                      # Panel de administracion
│   ├── js/                         # JS compartido (login, drawer, modal, SSE)
│   └── css/                        # CSS compartido
│
├── migrations/                     # Migraciones de BD
├── scripts/                        # Scripts de utilidad
└── docs/                           # Documentacion
```

---

## Base de Datos

### Esquema Principal

| Tabla | Propósito |
|-------|-----------|
| `usuarios` | Usuarios con roles, bloqueo, superadmin |
| `solicitudes` | Solicitudes comerciales (CRUD + importacion Excel) |
| `gestiones` | Acciones sobre solicitudes |
| `gestiones_maestro` | Campanas por lotes |
| `relaciones` | Relaciones ALTA/BAJA con clientes |
| `equipos` | Equipos organizacionales |
| `equipo_usuarios` | Miembros de equipos (lider/agente) |
| `ventas_vendedores` | Ventas por vendedor |
| `config_bonos` | Configuracion de bonos |
| `notificaciones` | Centro de notificaciones |
| `audit_log` | Registro de auditoria |
| `historial_actualizaciones` | Cambios en solicitudes |
| `permisos_roles` | Permisos por rol (v3.0) |
| `permisos_equipo` | Permisos por equipo (v3.0) |
| `asignaciones_solicitudes` | Asignaciones a equipos/agentes |
| `campanas_equipo` | Campanas ↔ equipos |
| `recordatorios` | Recordatorios ⏰ de llamada/mensaje en campanas (Agosto 2026) |

### Indices Compuestos (13)

Optimizados para las consultas mas frecuentes: listado por usuario, dashboard por estado/segmento, busqueda por cedula, gestiones con LATERAL JOIN, notificaciones, historial y auditoria.

---

## Roles del Sistema

| Rol | Nivel | Descripcion |
|-----|-------|-------------|
| SuperAdmin | 100 | Control total. Panel de Administracion. |
| Admin | 50 | Administracion de usuarios (herencia) |
| Lider | 30 | Gestiona equipo, crea agentes, asigna |
| Agente | 20 | Opera sobre asignaciones de su lider |
| User | 10 | Usuario base (compatibilidad) |

---

## API REST - Endpoints

### Autenticacion (`/api/auth`)

| Metodo | Ruta | Auth | Descripcion |
|--------|------|------|-------------|
| POST | `/api/auth/registrar` | No | Registrar usuario |
| POST | `/api/auth/login` | No | Iniciar sesion (rate limited) |
| POST | `/api/auth/logout` | Si | Cerrar sesion |
| GET | `/api/auth/sesion` | Si | Verificar sesion |
| GET | `/api/auth/perfil` | Si | Obtener perfil |
| PUT | `/api/auth/perfil` | Si | Actualizar perfil |
| PUT | `/api/auth/cambiar-password` | Si | Cambiar contrasena |

### Solicitudes (`/api/excel`)

| Metodo | Ruta | Descripcion |
|--------|------|-------------|
| POST | `/api/excel/upload` | Subir Excel |
| POST | `/api/excel/solicitudes` | Crear solicitud |
| GET | `/api/excel/solicitudes` | Listar (paginado) |
| GET | `/api/excel/solicitudes/buscar` | Buscar |
| PUT | `/api/excel/solicitudes/:id/editar` | Editar estado/segmento |
| DELETE | `/api/excel/solicitudes/:id` | Eliminar |

### Dashboard (`/api/excel/dashboard`)

| Metodo | Ruta | Descripcion |
|--------|------|-------------|
| GET | `/api/excel/dashboard` | KPIs principales |
| GET | `/api/excel/dashboard/segmentos` | Por segmento |
| GET | `/api/excel/dashboard/estados` | Por estado |
| GET | `/api/excel/dashboard/promedio/mes` | Promedio mensual |
| GET | `/api/excel/dashboard/ventas-mensuales` | Ventas mensuales |

### Campanas (`/api/gestiones-maestro`)

| Metodo | Ruta | Descripcion |
|--------|------|-------------|
| GET | `/api/gestiones-maestro` | Listar |
| POST | `/api/gestiones-maestro` | Crear |
| PUT | `/api/gestiones-maestro/:id/agregar-solicitudes` | Agregar solicitudes |
| PUT | `/api/gestiones-maestro/:id/asignar-agente` | Asignar agente |

### Equipos (`/api/equipos`)

| Metodo | Ruta | Descripcion |
|--------|------|-------------|
| GET | `/api/equipos` | Listar equipos |
| GET | `/api/equipos/mi-equipo` | Mi equipo |
| GET | `/api/equipos/:id/dashboard` | Dashboard del equipo |
| POST | `/api/equipos` | Crear (superadmin) |
| POST | `/api/equipos/:id/agentes` | Crear agente (lider+) |

### Administracion (`/api/admin`) — Solo SuperAdmin

| Metodo | Ruta | Descripcion |
|--------|------|-------------|
| GET | `/api/admin/usuarios` | Listar usuarios |
| POST | `/api/admin/usuarios` | Crear usuario |
| PUT | `/api/admin/usuarios/:id/toggle-active` | Activar/Desactivar |
| POST | `/api/admin/usuarios/:id/promover-lider` | Promover a lider |
| GET | `/api/admin/estadisticas` | Estadisticas del sistema |
| GET | `/api/admin/auditoria` | Logs de auditoria |
| GET | `/api/admin/notificaciones/stream` | SSE Stream |
| POST | `/api/admin/notificaciones` | Crear notificacion |

### Relaciones (`/api/relaciones`)

| Metodo | Ruta | Descripcion |
|--------|------|-------------|
| POST | `/api/relaciones/upload` | Subir Excel |
| GET | `/api/relaciones` | Listar |
| GET | `/api/relaciones/stats` | Estadisticas |
| POST | `/api/relaciones/gestiones` | Crear gestion |

### Catalogos (`/api/catalogos`)

| Metodo | Ruta | Descripcion |
|--------|------|-------------|
| GET | `/api/catalogos/estados` | Estados disponibles |
| GET | `/api/catalogos/segmentos` | Segmentos disponibles |

### Debug (`/api/debug`)

| Metodo | Ruta | Descripcion |
|--------|------|-------------|
| GET | `/api/debug/health` | Health check |
| GET | `/api/debug/tablas` | Listar tablas |

---

## Seguridad

- **bcryptjs**: Hash de contrasenas (10 rondas)
- **helmet**: Headers de seguridad HTTP
- **express-rate-limit**: 100 req/15min general, 5 req/15min login
- **Sesiones**: httpOnly, secure (produccion), sameSite strict, 24h TTL
- **Bloqueo de cuenta**: 5 intentos fallidos → 15 min de bloqueo
- **SuperAdmin**: Flujo completamente separado del Dashboard Operativo
- **Auditoria**: Todas las acciones criticas registradas en `audit_log`

---

## Sistema Multi-Equipo v3.0

```
SUPERADMIN (Nivel 100)
├── Equipo "Ventas Norte"
│   ├── Lider: Juan Perez
│   ├── Agente: Maria Garcia
│   └── Campanas: ...
├── Equipo "Ventas Sur"
│   ├── Lider: Ana Martinez
│   └── Agente: Pedro Sanchez
└── Equipo "Sistema" (tecnico)
    └── Usuarios sin equipo asignado
```

**Flujo:** SuperAdmin crea equipos → Lider gestiona agentes y asigna → Agente opera.

**Permisos:** Sistema basado en BD (`permisos_roles`, `permisos_equipo`) con convencion `<recurso>:<accion>`.

---

## Notificaciones en Tiempo Real (SSE)

- **NotificationBus** (singleton) gestiona conexiones SSE
- Maximo 500 conexiones totales, 5 por usuario
- KeepAlive cada 30 segundos
- **Deep Link Router**: Navegacion directa desde notificaciones a modulos
- Eventos: `notification.created`, `notification.read`, `count.updated`, `ping`

---

## Caché

Estrategia **cache-aside** con `node-cache`:

| Dato | TTL | Invalidacion |
|------|-----|-------------|
| Dashboard totals | 30s | Importacion, creacion, edicion, eliminacion |
| Dashboard segmentos/estados | 30s | Mismo |
| Estados/Segmentos (global) | 300s | Manual |
| Estadisticas admin | 60s | CRUD usuarios |

---

## Despliegue

### Variables de Entorno

| Variable | Obligatoria | Descripcion |
|----------|-------------|-------------|
| `DATABASE_URL` | Si (produccion) | URL PostgreSQL |
| `SESSION_SECRET` | Recomendada | Secreto para sesiones |
| `PORT` | No (default 3000) | Puerto del servidor |
| `NODE_ENV` | Recomendada | `production` o `development` |

### Comandos

```bash
# Desarrollo local (SQLite, sin DATABASE_URL)
node app.js

# Produccion (PostgreSQL, con DATABASE_URL)
node app.js

# Migraciones (produccion)
node migrations/001_add_admin_columns.js "$DATABASE_URL"
node migrations/002_add_compound_indexes.js
node migrations/003_create_team_tables.js "$DATABASE_URL"
node migrations/003_seed_team_data.js "$DATABASE_URL"
node migrations/004_add_asignado_a_columna.js "$DATABASE_URL"
# 005 y 006: OBTOLETAS (vendedor fue movido a solicitudes)
# node migrations/005_add_vendedor_to_gestiones.js "$DATABASE_URL"
# node migrations/006_add_vendedor_to_gestiones_relaciones.js "$DATABASE_URL"
node migrations/007_add_vendedor_to_solicitudes.js "$DATABASE_URL"
node migrations/008_remove_vendedor_from_gestiones.js "$DATABASE_URL"

# Deploy (Windows)
commit_push.bat
```

### Deteccion de Dispositivo

El servidor detecta User-Agent y sirve la version correspondiente:
- `/` → Desktop, `/m` → Movil
- `/solicitudes` → Desktop, `/m/solicitudes` → Movil
- SuperAdmin siempre redirige a `/admin` o `/m/admin`

---

## Documentacion

Ver `docs/README.md` para documentacion completa del sistema (1375+ lineas), incluyendo esquema de tablas detallado, todos los endpoints, y diagramas de arquitectura.

### Features Recientes

| Feature | Fecha | Documento |
|---------|-------|-----------|
| Rediseño del Indicador de Estado (Semáforo) v6 | Agosto 2026 | `docs/feature-rediseño-semaforo-campañas.md` |
| Rediseño UX de Campañas: progreso y prioridad | Agosto 2026 | `docs/feature-ux-comportamiento-campanas.md` |
| Tarjeta de Solicitudes Desktop: sin botón Llamar, cédula + teléfono visibles, fix checkbox duplicado y limpieza CSS | Agosto 2026 | `docs/feature-tarjeta-solicitudes-escritorio.md` |
| Convención de propiedad de los CSS de Solicitudes (compartido vs desktop vs móvil) | Agosto 2026 | `docs/convencion-css-solicitudes.md` |
| Header unificado + toolbar de filtros con auto-aplicar en Solicitudes Desktop | Agosto 2026 | `docs/feature-header-filtros-solicitudes-desktop.md` |
| Filtros móviles compactos: selects, auto-aplicar en tiempo real y Limpiar total | Agosto 2026 | `docs/feature-filtros-movil-solicitudes.md` |
| Fix filtros de fecha/vendedor en Solicitudes: caché cliente con todas las dimensiones, filtros persistidos re-aplicados y rango `fecha_hasta` con hora final | Agosto 2026 | `docs/informe-fix-filtros-fecha-solicitudes.md` |
| Fix widgets del Dashboard Móvil: nombres/cédula truncados (30/26/15 chars) y slides del mini-carrusel con altura igualada para snap limpio | Agosto 2026 | `docs/informe-fix-widgets-dashboard-movil.md` |
| Buscador inline en Campañas móvil: fila búsqueda + estado sticky debajo del semáforo (reemplaza el bottom sheet) | Agosto 2026 | `docs/feature-buscador-inline-campanas-movil.md` |
| Selector de semáforo con color real en tarjetas móviles (etiquetas semánticas) + tarjetas ~35px más compactas | Agosto 2026 | `docs/informe-semaforo-tarjetas-movil.md` |
| Historial general de campaña: botón "🕘 Últimas gestiones" (móvil + escritorio) vía `GET /api/gestiones-maestro/:id/historial`; reemplaza el widget de prioridad en desktop | Agosto 2026 | `docs/feature-historial-campana.md` |
| Fix semáforo móvil en orden fijo: Sin clasificar · Seguimiento · Encaminadas · En espera (ya no se reordena por prioridad) | Agosto 2026 | `docs/fix-semaforo-movil-orden-fijo.md` |
| Recordatorios ⏰ de llamada/mensaje en campañas: badge por solicitud (móvil + escritorio), endpoints POST/PUT y scheduler que notifica in-app por SSE al vencer | Agosto 2026 | `docs/feature-recordatorios-campanas.md` |
