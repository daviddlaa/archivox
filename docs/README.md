# 📋 Archivox - Documentación Completa del Sistema

**Versión:** 3.0 (Arquitectura Multi-Equipo)
**Fecha:** Julio 2026
**Propósito:** Sistema de gestión de solicitudes, relaciones y equipos para operaciones comerciales.

---

## Índice

1. [Descripción General](#1--descripción-general)
2. [Arquitectura General](#2--arquitectura-general)
3. [Stack Tecnológico](#3--stack-tecnológico)
4. [Estructura del Proyecto](#4--estructura-del-proyecto)
5. [Base de Datos](#5--base-de-datos)
6. [Backend (API REST)](#6--backend-api-rest)
7. [Frontend](#7--frontend)
8. [Sistema Multi-Equipo v3.0](#8--sistema-multi-equipo-v30)
9. [Autenticación y Seguridad](#9--autenticación-y-seguridad)
10. [Notificaciones en Tiempo Real (SSE)](#10--notificaciones-en-tiempo-real-sse)
11. [Módulos del Sistema](#11--módulos-del-sistema)
12. [API REST - Endpoints](#12--api-rest---endpoints)
13. [Renderizado Responsivo](#13--renderizado-responsivo)
14. [Migraciones de Base de Datos](#14--migraciones-de-base-de-datos)
15. [Scripts de Utilidad](#15--scripts-de-utilidad)
16. [Despliegue](#16--despliegue)
17. [Deep Link Router](#17--deep-link-router)
18. [Caché en Servidor](#18--caché-en-servidor)
19. [Glosario](#19--glosario)

---

## 1. 📋 Descripción General

**Archivox** es un sistema web full-stack para la gestión operativa de solicitudes comerciales, relaciones con clientes, equipos de trabajo y campañas de gestión por lotes. Está diseñado para operar tanto en **escritorio** como en **dispositivos móviles**, con detección automática del dispositivo del usuario.

### Funcionalidades Principales

| Módulo | Descripción |
|--------|-------------|
| **Solicitudes** | CRUD completo de solicitudes con importación desde Excel |
| **Dashboard** | KPIs, gráficos por estado/segmento, promedios y ventas mensuales |
| **Gestiones** | Registro de acciones sobre solicitudes (individual y por lotes) |
| **Relaciones** | Gestión de relaciones ALTA/BAJA con clientes |
| **Equipos** | Sistema multi-equipo con líderes y agentes (v3.0) |
| **Campañas** | Gestión por lotes de solicitudes para acción masiva |
| **Ventas** | Control de ventas por vendedor con configuración de bonos |
| **Administración** | Panel de superadmin con auditoría, usuarios y estadísticas |
| **Notificaciones** | Centro de notificaciones con SSE en tiempo real |

### Roles del Sistema

| Rol | Nivel | Descripción |
|-----|-------|-------------|
| **SuperAdmin** | 100 | Control total del sistema. Acceso al Panel de Administración. |
| **Admin** | 50 | Administración de usuarios (herencia de versiones anteriores). |
| **Líder** | 30 | Gestiona su equipo, crea agentes, asigna solicitudes y campañas. |
| **Agente** | 20 | Opera sobre solicitudes y campañas asignadas por su líder. |
| **User** | 10 | Usuario base (compatibilidad con versiones anteriores). |

> **Nota importante:** El SuperAdmin tiene un flujo completamente separado del Dashboard Operativo. Al iniciar sesión, es redirigido automáticamente al **Panel de Administración** y **no tiene acceso** a las rutas operativas (solicitudes, dashboard, etc.).

---

## 2. 🏗️ Arquitectura General

```
┌─────────────────────────────────────────────────────────────┐
│                    CLIENTE (Navegador)                       │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────────┐   │
│  │ Desktop UI  │  │  Mobile UI   │  │  Admin Panel     │   │
│  │ (HTML+CSS+  │  │ (HTML+CSS+   │  │ (HTML+CSS+JS)    │   │
│  │  VanillaJS) │  │  VanillaJS)  │  │                  │   │
│  └──────┬──────┘  └──────┬───────┘  └────────┬─────────┘   │
│         │                │                    │             │
│         └────────────────┴────────────────────┘             │
│                        │  SSE (Event Stream)                │
└────────────────────────┼────────────────────────────────────┘
                         │ HTTP / SSE
┌────────────────────────┼────────────────────────────────────┐
│              EXPRESS.JS SERVER (app.js)                     │
│                         │                                    │
│  ┌──────────────────────┴──────────────────────────────┐    │
│  │              MIDDLEWARE STACK                        │    │
│  │  Helmet → Rate Limiting → Session → Auth → Routes   │    │
│  └──────────────────────┬──────────────────────────────┘    │
│                         │                                    │
│  ┌──────────────────────┴──────────────────────────────┐    │
│  │              API ROUTES (REST)                       │    │
│  │  /api/auth  /api/excel  /api/admin  /api/equipos     │    │
│  │  /api/relaciones  /api/gestiones-maestro             │    │
│  └──────────────────────┬──────────────────────────────┘    │
│                         │                                    │
│  ┌──────────────────────┴──────────────────────────────┐    │
│  │              CONTROLADORES                           │    │
│  │  auth  excel  dashboard  admin  equipos              │    │
│  │  notificaciones  relaciones  gestionesMaestro        │    │
│  │  estadisticas  relacionesGestion                     │    │
│  └──────────────────────┬──────────────────────────────┘    │
│                         │                                    │
│  ┌──────────────────────┴──────────────────────────────┐    │
│  │              SERVICIOS                               │    │
│  │  excel.service  relaciones.service  notificationBus  │    │
│  └──────────────────────┬──────────────────────────────┘    │
│                         │                                    │
│  ┌──────────────────────┴──────────────────────────────┐    │
│  │              CAPA DE DATOS                           │    │
│  │  ┌─────────────┐  ┌──────────────┐  ┌───────────┐  │    │
│  │  │ PostgreSQL  │  │   SQLite     │  │  Cache    │  │    │
│  │  │ (Producción)│  │  (Desarrollo)│  │(node-cache)│  │    │
│  │  └─────────────┘  └──────────────┘  └───────────┘  │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

### Separación de Flujos: Operativo vs Administración

```
                    ┌─── USUARIO LOGUEADO ───┐
                    │                         │
                    ▼                         ▼
          ┌──────────────────┐      ┌──────────────────┐
          │  DASHBOARD       │      │  PANEL DE        │
          │  OPERATIVO       │      │  ADMINISTRACIÓN   │
          │                  │      │                  │
          │ • Solicitudes    │      │ • Gestión de     │
          │ • Dashboard      │      │   Usuarios       │
          │ • Gestiones      │      │ • Estadísticas   │
          │ • Relaciones     │      │   del Sistema    │
          │ • Ventas         │      │ • Logs de        │
          │ • Campañas       │      │   Auditoría      │
          │ • Equipos        │      │ • Notificaciones │
          │ • Historial      │      │   Globales       │
          └──────────────────┘      └──────────────────┘
                    │                         │
                    ▼                         ▼
          ┌──────────────────┐      ┌──────────────────┐
          │  Usuarios:       │      │  Solo:           │
          │  user, agente,   │      │  superadmin      │
          │  lider           │      │  (is_superadmin  │
          └──────────────────┘      │   = TRUE)        │
                                    └──────────────────┘
```

---

## 3. 🛠️ Stack Tecnológico

### Backend
| Tecnología | Versión | Propósito |
|------------|---------|-----------|
| **Node.js** | - | Runtime de JavaScript |
| **Express.js** | ^5.2.1 | Framework web (HTTP server y routing) |
| **better-sqlite3** | ^11.7.0 | Base de datos local (desarrollo) |
| **pg** | ^8.13.0 | Cliente PostgreSQL (producción) |
| **bcryptjs** | ^3.0.3 | Hashing de contraseñas |
| **express-session** | ^1.19.0 | Manejo de sesiones |
| **helmet** | ^8.0.0 | Headers de seguridad HTTP |
| **express-rate-limit** | ^7.4.0 | Rate limiting |
| **multer** | ^2.1.1 | Subida de archivos (Excel, imágenes) |
| **exceljs** | ^3.4.0 | Procesamiento de archivos Excel |
| **node-cache** | ^5.1.2 | Caché en memoria del servidor |
| **dotenv** | ^16.6.1 | Variables de entorno |

### Frontend
| Tecnología | Propósito |
|------------|-----------|
| **HTML5 + CSS3** | Estructura y estilos |
| **Vanilla JavaScript** | Lógica del cliente (sin frameworks) |
| **Chart.js** (CDN) | Gráficos del dashboard |
| **CSS Grid / Flexbox** | Layout responsivo |

### Base de Datos
| Entorno | Motor |
|---------|-------|
| **Producción** | PostgreSQL (Render) |
| **Desarrollo Local** | SQLite (better-sqlite3) |

### Seguridad
- **bcryptjs**: Hash de contraseñas (10 rondas)
- **helmet**: Headers de seguridad (CSP, XSS, etc.)
- **express-rate-limit**: Rate limiting por ruta
- **express-session**: Cookies httpOnly, secure, sameSite strict
- **Bloqueo de cuenta**: 5 intentos fallidos → 15 min de bloqueo

---

## 4. 📁 Estructura del Proyecto

```
ARCHIVOX/
├── app.js                          # Punto de entrada del servidor Express
├── package.json                    # Dependencias y scripts
├── .env                            # Variables de entorno (no trackeado)
├── commit_push.bat                 # Script de deploy (Windows)
│
├── docs/                           # Documentación del sistema
│   ├── README.md                   # Este archivo
│   └── anteriores/                 # Documentación histórica
│       ├── informe-arquitectura-multi-equipo.md
│       ├── informe-auditoria-flujo-multi-equipo.md
│       ├── informe-auditoria-rendimiento.md
│       ├── informe-tecnico-sesion.md
│       ├── informe-modelo-datos-multi-equipo.md
│       ├── informe-optimizacion-arquitectura.md
│       ├── informe-deep-links-arquitectura.md
│       ├── informe-drawer-movil.md
│       ├── informe-funcional-multiequipo.md
│       ├── informe-correccion-errores-lider-equipos.md
│       ├── progreso-multi-equipo.md
│       ├── progreso-correccion-sistema.md
│       ├── progreso-simplificacion.md
│       ├── migration-accion-modulo-produccion.md
│       ├── analisis-admin.md
│       └── analisis-solicitud-manual.md
│
├── src/                            # CÓDIGO FUENTE BACKEND
│   ├── config/                     # Configuraciones del sistema
│   │   ├── database.js             # SQLite - Conexión directa (better-sqlite3)
│   │   ├── database.pg.js          # PostgreSQL - Pool de conexiones (pg)
│   │   ├── db.js                   # DB UNIFICADA - Abstraction layer (SQLite↔PostgreSQL)
│   │   ├── initDb.js               # SQLite - Inicialización y migraciones automáticas
│   │   ├── initDb.pg.js            # PostgreSQL - Inicialización y migraciones automáticas
│   │   ├── cache.js                # Caché en servidor (node-cache)
│   │   ├── permissions.js          # Sistema de roles y permisos
│   │   ├── multer.config.js        # Configuración de subida de archivos
│   │   └── auth.controller.js      # [DEPRECATED] Replaced by src/controllers/auth.controller.js
│   │
│   ├── middleware/                  # Middleware Express
│   │   └── auth.middleware.js       # Autenticación, roles, permisos, equipos
│   │
│   ├── controllers/                # Controladores (lógica de negocio)
│   │   ├── auth.controller.js      # Registro, login, logout, perfil
│   │   ├── excel.controller.js     # Solicitudes CRUD, gestiones, upload Excel
│   │   ├── dashboard.controller.js # Dashboard KPIs, segmentos, estados, ventas
│   │   ├── admin.controller.js     # Admin: usuarios, estadísticas, auditoría
│   │   ├── equipos.controller.js   # Multi-equipo: equipos, agentes, dashboard
│   │   ├── gestionesMaestro.controller.js  # Campañas por lotes
│   │   ├── relaciones.controller.js        # Relaciones ALTA/BAJA
│   │   ├── relacionesGestion.controller.js # Gestiones de relaciones
│   │   ├── notificaciones.controller.js    # Centro de notificaciones + SSE
│   │   └── estadisticas.controller.js      # Métricas por usuario (escalable)
│   │
│   ├── routes/                     # Definición de rutas Express
│   │   ├── auth.routes.js          # /api/auth/*
│   │   ├── excel.routes.js         # /api/excel/*
│   │   ├── admin.routes.js         # /api/admin/*
│   │   ├── equipos.routes.js       # /api/equipos/*
│   │   ├── relaciones.routes.js    # /api/relaciones/*
│   │   ├── relacionesGestion.routes.js  # /api/relaciones/gestiones/*
│   │   ├── gestionesMaestro.routes.js   # /api/gestiones-maestro/*
│   │   └── debug.routes.js         # /api/debug/* (diagnóstico)
│   │
│   └── services/                   # Servicios (lógica reutilizable)
│       ├── excel.service.js        # Procesamiento de archivos Excel (solicitudes)
│       ├── relaciones.service.js   # Procesamiento de archivos Excel (relaciones)
│       └── notificationBus.js      # SSE Bus - Notificaciones en tiempo real
│
├── public/                         # CÓDIGO FRONTEND (estático)
│   ├── index.html                  # Entry point (redirección a login)
│   ├── perfil.html                 # Página de perfil de usuario
│   │
│   ├── css/                        # Estilos compartidos
│   │   ├── main.css                # Estilos globales
│   │   ├── login.css               # Estilos de login
│   │   ├── solicitudes.css         # Estilos de solicitudes
│   │   ├── drawer.css              # Estilos del drawer móvil
│   │   ├── modal.css               # Estilos de modales
│   │   ├── notificaciones.css      # Estilos de notificaciones
│   │   ├── perfil.css              # Estilos de perfil
│   │   ├── importar.css            # Estilos de importación
│   │   └── gestion-lote.css        # Estilos de gestión por lotes
│   │
│   ├── js/                         # JavaScript compartido
│   │   ├── login.js                # Lógica de login/registro
│   │   ├── dashboard.js            # Redirección a login (fallback)
│   │   ├── deep-link-router.js     # Router de deep links para notificaciones
│   │   ├── drawer.js               # Drawer de navegación móvil
│   │   ├── modal.js                # Sistema de modales
│   │   ├── notificaciones-dashboard.js  # Widget de notificaciones
│   │   └── perfil.js               # Lógica de perfil de usuario
│   │
│   ├── desktop/                    # VERSIÓN ESCRITORIO
│   │   ├── login.html              # Login (escritorio)
│   │   ├── index.html              # Dashboard principal (escritorio)
│   │   ├── solicitudes.html        # Listado de solicitudes (escritorio)
│   │   ├── importar.html           # Importación Excel (escritorio)
│   │   ├── gestiones.html          # Gestión de campañas (escritorio)
│   │   ├── gestion-lote.html       # Gestión por lotes (escritorio)
│   │   ├── relaciones.html         # Relaciones (escritorio)
│   │   ├── ventas.html             # Control de ventas (escritorio)
│   │   ├── historial.html          # Historial de actualizaciones (escritorio)
│   │   ├── equipo.html             # Panel del líder (escritorio)
│   │   │
│   │   ├── css/                    # Estilos específicos escritorio
│   │   │   ├── base.css            # Base layout
│   │   │   ├── dashboard.css       # Dashboard
│   │   │   ├── solicitudes.css     # Solicitudes
│   │   │   ├── gestiones.css       # Gestiones
│   │   │   ├── importar.css        # Importar
│   │   │   ├── ventas.css          # Ventas
│   │   │   ├── equipo.css          # Panel líder
│   │   │   ├── historial.css       # Historial
│   │   │   └── relaciones.css      # Relaciones
│   │   │
│   │   └── js/                     # JavaScript específico escritorio
│   │       ├── dashboard.js        # Dashboard
│   │       ├── solicitudes.js      # Solicitudes (con caché cliente + AbortController)
│   │       ├── importar.js         # Importación
│   │       ├── gestiones.js        # Gestiones
│   │       ├── gestion-lote.js     # Gestión por lotes
│   │       ├── relaciones.js       # Relaciones
│   │       ├── ventas.js           # Ventas
│   │       ├── historial.js        # Historial
│   │       └── equipo.js           # Panel líder
│   │
│   └── movil/                      # VERSIÓN MÓVIL
│       ├── login.html              # Login (móvil)
│       ├── index.html              # Dashboard (móvil)
│       ├── solicitudes.html        # Solicitudes (móvil)
│       ├── importar.html           # Importación (móvil)
│       ├── gestiones.html          # Campañas (móvil)
│       ├── gestion-lote.html       # Gestión por lotes (móvil)
│       ├── relaciones.html         # Relaciones (móvil)
│       ├── ventas.html             # Ventas (móvil)
│       ├── historial.html          # Historial (móvil)
│       ├── equipo.html             # Panel líder (móvil)
│       │
│       ├── css/                    # Estilos específicos móvil
│       │   ├── estilos.css         # Estilos base móvil
│       │   ├── solicitudes-mobile.css  # Solicitudes móvil
│       │   ├── gestiones.css       # Gestiones móvil
│       │   ├── gestion-lote.css    # Gestión por lotes móvil
│       │   └── importar.css        # Importar móvil
│       │
│       └── js/                     # JavaScript específico móvil
│           ├── dashboard.js        # Dashboard
│           ├── solicitudes.js      # Solicitudes
│           ├── importar.js         # Importación
│           ├── gestiones.js        # Gestiones
│           ├── gestion-lote.js     # Gestión por lotes
│           ├── relaciones.js       # Relaciones
│           ├── ventas.js           # Ventas
│           ├── historial.js        # Historial
│           └── equipo.js           # Panel líder
│
│   └── admin/                      # PANEL DE ADMINISTRACIÓN
│       ├── index.html              # Panel admin (HTML)
│       ├── css/admin.css           # Estilos admin
│       └── js/admin.js             # Lógica admin
│
├── migrations/                     # Migraciones de base de datos
│   ├── 001_add_admin_columns.js    # Admin Fase 1 (PostgreSQL script)
│   ├── 001_add_admin_columns.sql   # Admin Fase 1 (PostgreSQL SQL)
│   ├── 001_add_admin_columns.sqlite.sql  # Admin Fase 1 (SQLite SQL)
│   ├── 002_add_compound_indexes.js       # Índices compuestos (script)
│   ├── 002_add_compound_indexes.sql      # Índices compuestos (SQL)
│   ├── 003_create_team_tables.js         # Multi-equipo tablas (script)
│   ├── 003_create_team_tables.pg.sql     # Multi-equipo PostgreSQL SQL
│   ├── 003_create_team_tables.sqlite.sql # Multi-equipo SQLite SQL
│   ├── 003_rollback_team_tables.sql      # Rollback multi-equipo
│   ├── 003_rollback_team_tables.sqlite.sql # Rollback SQLite
│   ├── 003_seed_team_data.js             # Seed datos multi-equipo (script)
│   ├── 003_seed_team_data.sql            # Seed datos multi-equipo (SQL)
│   ├── 003_seed_team_data.sqlite.sql     # Seed datos multi-equipo SQLite
│   └── 004_add_asignado_a_columna.js     # Columna asignado_a (script)
│
├── scripts/                        # Scripts de utilidad
│   ├── audit-funciones.js          # Auditoría de funciones JS llamadas desde HTML
│   ├── audit-production-schema.js  # Auditoría de esquema PostgreSQL
│   ├── fix-production-notificaciones.js  # Corrección de notificaciones en producción
│   ├── migrate-production-accion-modulo.js # Migración deep links en producción
│   └── optimize-solicitudes-performance.js # Optimización de rendimiento
│
├── fix_escapes.js                  # Script de corrección de escapes
├── fix_final.js                    # Script de corrección final
└── fix_team.js                     # Script de corrección de equipos
```

---

## 5. 🗄️ Base de Datos

### 5.1 Arquitectura Dual (SQLite ↔ PostgreSQL)

El sistema utiliza una **capa de abstracción unificada** (`src/config/db.js`) que permite funcionar con ambos motores sin cambiar el código de los controladores.

| Característica | SQLite (Local) | PostgreSQL (Producción) |
|----------------|---------------|------------------------|
| Driver | better-sqlite3 | pg (node-postgres) |
| Archivo | `database.db` | Servicio Render |
| WAL Mode | ✅ | N/A |
| Placeholders | `?` | `$1, $2, ...` |
| Funciones Fecha | `datetime('now')` | `CURRENT_TIMESTAMP` |
| INTERVAL | No nativo | Nativo |
| JSON | No nativo | JSONB |
| RETURNING | No nativo | Nativo |

El wrapper en `db.js` se encarga automáticamente de:
- Convertir `?` a `$1, $2, ...` para PostgreSQL
- Convertir `$1, $2, ...` a `?` para SQLite
- Convertir sintaxis `INTERVAL` de PostgreSQL a SQLite
- Convertir `TO_CHAR()` a `strftime()` para SQLite
- Agregar `RETURNING id` automáticamente a INSERTs para PostgreSQL

### 5.2 Esquema de Tablas

#### `usuarios`
| Columna | Tipo | Descripción |
|---------|------|-------------|
| id | SERIAL/INTEGER PK | ID único |
| username | TEXT UNIQUE NOT NULL | Nombre de usuario |
| password | TEXT NOT NULL | Hash bcrypt |
| nombre | TEXT | Nombre completo |
| email | TEXT UNIQUE | Correo electrónico |
| email_verified | BOOLEAN/INTEGER | ¿Email verificado? |
| rol | TEXT DEFAULT 'user' | Rol: user, agente, lider, admin, superadmin |
| is_active | BOOLEAN/INTEGER DEFAULT 1 | ¿Cuenta activa? |
| is_superadmin | BOOLEAN/INTEGER DEFAULT 0 | ¿Es superadmin? |
| failed_login_attempts | INTEGER DEFAULT 0 | Intentos fallidos de login |
| locked_until | TIMESTAMP/TEXT | ¿Bloqueado hasta? |
| password_changed_at | TIMESTAMP/TEXT | Último cambio de contraseña |
| created_at | TIMESTAMP/TEXT | Fecha de creación |
| updated_at | TIMESTAMP/TEXT | Fecha de actualización |
| last_login | TIMESTAMP/TEXT | Último inicio de sesión |

#### `solicitudes`
| Columna | Tipo | Descripción |
|---------|------|-------------|
| id | SERIAL/INTEGER PK | ID interno |
| id_solicitud | INTEGER UNIQUE | ID de solicitud (externo) |
| estado | TEXT | Estado (ACTIVADA, RECHAZADA, etc.) |
| cedula | TEXT | Cédula de identidad |
| nombre | TEXT | Nombre del cliente |
| celular | TEXT | Número de celular |
| segmento | TEXT | Segmento comercial |
| producto | TEXT | Producto solicitado |
| codigo_plus | TEXT | Código adicional |
| correo_electronico | TEXT | Email del cliente |
| direccion | TEXT | Dirección |
| fecha_solicitud | TEXT | Fecha de solicitud |
| usuario_id | INTEGER FK | Usuario propietario |
| destacado | INTEGER DEFAULT 0 | ¿Destacado? |
| fecha_importacion | TIMESTAMP/TEXT | Fecha de importación |
| fecha_actualizacion | TIMESTAMP/TEXT | Fecha de actualización |

#### `gestiones`
| Columna | Tipo | Descripción |
|---------|------|-------------|
| id | SERIAL/INTEGER PK | ID único |
| solicitud_id | INTEGER NOT NULL | Solicitud asociada |
| usuario_id | INTEGER NOT NULL | Usuario que gestiona |
| tipo_gestion | TEXT NOT NULL | Tipo: RECHAZADO, APROBADO, etc. |
| observacion | TEXT | Notas de la gestión |
| gestion_maestro_id | INTEGER FK | Campaña asociada (opcional) |
| fecha_gestion | TIMESTAMP/TEXT | Fecha de gestión |
| created_at | TIMESTAMP/TEXT | Fecha de creación |
| updated_at | TIMESTAMP/TEXT | Fecha de actualización |

#### `gestiones_maestro` (Campañas)
| Columna | Tipo | Descripción |
|---------|------|-------------|
| id | SERIAL/INTEGER PK | ID único |
| nombre | TEXT NOT NULL | Nombre de la campaña |
| descripcion | TEXT | Descripción |
| usuario_id | INTEGER NOT NULL | Creador |
| estado | TEXT DEFAULT 'activa' | Estado de la campaña |
| total_solicitudes | INTEGER DEFAULT 0 | Total de solicitudes asignadas |
| gestionadas | INTEGER DEFAULT 0 | Solicitudes ya gestionadas |
| fecha_limite | DATE | Fecha límite |
| solicitudes_ids | TEXT | IDs de solicitudes (JSON) |
| equipo_id | INTEGER FK | Equipo asignado (v3.0) |
| asignado_a | INTEGER FK | Agente asignado (v3.0) |
| fecha_inicio | TIMESTAMP/TEXT | Fecha de inicio |
| fecha_fin | TIMESTAMP/TEXT | Fecha de finalización |

#### `relaciones`
| Columna | Tipo | Descripción |
|---------|------|-------------|
| id | SERIAL/INTEGER PK | ID único |
| usuario_id | INTEGER NOT NULL FK | Usuario propietario |
| identificacion | TEXT | Identificación del cliente |
| cliente | TEXT | Nombre del cliente |
| celular | TEXT | Celular |
| estado_relacion | TEXT CHECK('ALTA','BAJA') | Estado de la relación |
| fecha_inicio_relacion | DATE | Inicio de relación |
| fecha_fin_relacion | DATE | Fin de relación |
| fecha_fin_credito | DATE | Fin de crédito |
| fecha_fin_fidelizacion | DATE | Fin de fidelización |
| proxima_baja | DATE | Próxima baja estimada |
| motivo_ruptura | TEXT | Motivo de ruptura |
| numero_operaciones | INTEGER DEFAULT 0 | Número de operaciones |

#### `equipos` (v3.0)
| Columna | Tipo | Descripción |
|---------|------|-------------|
| id | SERIAL/INTEGER PK | ID único |
| nombre | VARCHAR(100) UNIQUE NOT NULL | Nombre del equipo |
| descripcion | TEXT | Descripción |
| activo | INTEGER DEFAULT 1 | ¿Equipo activo? |

#### `equipo_usuarios` (v3.0)
| Columna | Tipo | Descripción |
|---------|------|-------------|
| id | SERIAL/INTEGER PK | ID único |
| equipo_id | INTEGER NOT NULL FK | Equipo |
| usuario_id | INTEGER NOT NULL FK | Usuario |
| es_lider | INTEGER DEFAULT 0 | ¿Es líder? |
| fecha_ingreso | TIMESTAMP/TEXT | Fecha de ingreso |
| fecha_salida | TIMESTAMP/TEXT | Fecha de salida (NULL = activo) |
| motivo_salida | TEXT | Motivo de salida |

#### Otras tablas
- `ventas_vendedores` - Ventas por vendedor por mes
- `config_bonos` - Configuración de bonos por mes
- `solicitudes_referencias` - Referencias de solicitudes
- `historial_actualizaciones` - Auditoría de cambios en solicitudes
- `gestiones_relaciones` - Gestiones específicas de relaciones
- `audit_log` - Registro de auditoría del sistema
- `notificaciones` - Centro de notificaciones
- `permisos_roles` - Permisos por rol (v3.0)
- `permisos_equipo` - Permisos adicionales por equipo (v3.0)
- `asignaciones_solicitudes` - Asignaciones de solicitudes a equipos/agentes (v3.0)
- `campañas_equipo` - Asociación campañas ↔ equipos (v3.0)

### 5.3 Índices Compuestos

El sistema cuenta con índices compuestos optimizados para las consultas más frecuentes:

| Índice | Tabla | Columnas | Propósito |
|--------|-------|----------|-----------|
| `idx_solicitudes_usuario_id_desc` | solicitudes | (usuario_id, id_solicitud DESC) | Listado principal con ORDER BY |
| `idx_solicitudes_usuario_estado` | solicitudes | (usuario_id, estado) | Dashboard por estado |
| `idx_solicitudes_usuario_segmento` | solicitudes | (usuario_id, segmento) | Dashboard por segmento |
| `idx_solicitudes_usuario_fecha` | solicitudes | (usuario_id, fecha_solicitud) | Promedios mensuales/semanales |
| `idx_solicitudes_cedula` | solicitudes | (cedula) | Búsqueda por cédula |
| `idx_gestiones_solicitud_usuario_fecha` | gestiones | (solicitud_id, usuario_id, fecha_gestion DESC) | LATERAL JOIN (consulta más frecuente) |
| `idx_gestiones_usuario_created` | gestiones | (usuario_id, created_at) | Dashboard actividad (últimos 7/30 días) |
| `idx_gestiones_maestro_id_solicitud` | gestiones | (gestion_maestro_id, solicitud_id) | Progreso de campañas |
| `idx_notificaciones_destinatario_leida` | notificaciones | (destinatario_id, leida, created_at DESC) | Listado de notificaciones |
| `idx_historial_usuario_fecha` | historial_actualizaciones | (usuario_id, fecha_actualizacion DESC) | Historial por usuario |
| `idx_audit_log_accion_fecha` | audit_log | (accion, created_at DESC) | Consulta de auditoría |

---

## 6. 🔧 Backend (API REST)

### 6.1 Punto de Entrada (`app.js`)

El servidor se inicia con Express.js y aplica el siguiente stack de middleware en orden:

1. **trust proxy** - Habilita confianza en proxies (Render, Nginx)
2. **helmet** - Headers de seguridad HTTP
3. **express.json/urlencoded** - Parseo de body
4. **Rate Limiting General** - 100 req / 15 min
5. **Session** - Sesiones con cookies seguras
6. **Static Files** - `public/` como raíz estática
7. **API Routes** - Todas bajo `/api/*`
8. **Error Handler Global** - Captura errores no manejados

### 6.2 Configuración de Sesión

```javascript
{
    secret: process.env.SESSION_SECRET || 'default-secret',
    resave: false,
    saveUninitialized: false,
    cookie: {
        maxAge: 24 * 60 * 60 * 1000,  // 24 horas
        httpOnly: true,                // Protección XSS
        secure: process.env.NODE_ENV === 'production',  // Solo HTTPS
        sameSite: 'strict'             // Protección CSRF
    }
}
```

### 6.3 Middleware de Autenticación (`auth.middleware.js`)

| Middleware | Propósito |
|-----------|-----------|
| `requiresAuth` | API: 401 si no hay sesión |
| `requireAuthPage` | HTML: redirecciona a login si no hay sesión |
| `requiresRole(...roles)` | Verifica que el rol esté en la lista |
| `requiresPermission(permiso)` | Verifica permiso específico (síncrono) |
| `requiresPermissionAsync(permiso)` | Verifica permiso en BD (asíncrono) |
| `requiresLevel(minLevel)` | Verifica nivel mínimo de rol |
| `requiresEquipo(accion)` | Verifica pertenencia al equipo |
| `requiresSuperAdmin` | Solo SuperAdmin |

### 6.4 Sistema de Caché (`cache.js`)

Estrategia **cache-aside** con invalidación explícita:

| Cache | TTL | Invalidación |
|-------|-----|-------------|
| Dashboard totals (por usuario) | 30s | Importación, creación, edición, eliminación |
| Dashboard segmentos/estados | 30s | Mismo que arriba |
| Estados disponibles (global) | 300s | Manual (rara vez cambia) |
| Segmentos disponibles (global) | 300s | Manual |
| Estadísticas admin | 60s | Creación/modificación de usuarios |

### 6.5 Configuración de Permisos (`permissions.js`)

Los permisos se definen con la convención `<recurso>:<acción>`:

```
equipo:ver, equipo:gestionar
agentes:ver, agentes:crear, agentes:editar, agentes:desactivar
campañas:ver, campañas:crear, campañas:gestionar, campañas:asignar
solicitudes:importar, solicitudes:ver-equipo, solicitudes:asignar
gestiones:ver-equipo, gestiones:crear, gestiones:editar
dashboard:ver-equipo, dashboard:ver-agentes
relaciones:ver-equipo, relaciones:gestionar
historial:ver-equipo, historial:ver-propio
perfil:ver, perfil:editar
```

---

## 7. 🎨 Frontend

### 7.1 Arquitectura Frontend

El frontend está construido con **HTML + CSS + Vanilla JavaScript** (sin frameworks). Sigue una arquitectura de **páginas independientes** servidas por el backend según la ruta y el dispositivo.

#### Páginas Compartidas
- **Login/Registro** - `login.html` (versiones desktop y móvil)
- **Perfil** - `perfil.html` (única versión)

#### Versión Desktop
- Dashboard, Solicitudes, Importar, Gestiones, Gestión por Lotes
- Relaciones, Ventas, Historial, Panel del Líder

#### Versión Móvil
- Mismas funcionalidades que desktop pero con UI adaptada
- Drawer de navegación (`drawer.js`)
- Diseño responsivo para pantallas táctiles

#### Panel de Administración
- Accesible solo para SuperAdmin
- Gestión de usuarios, estadísticas, auditoría, notificaciones

### 7.2 JavaScript Compartido (`public/js/`)

| Archivo | Propósito |
|---------|-----------|
| `login.js` | Autenticación (login, registro, verificación de sesión) |
| `deep-link-router.js` | Resolución de deep links para notificaciones |
| `drawer.js` | Drawer de navegación lateral para móvil |
| `modal.js` | Sistema de modales reutilizables |
| `notificaciones-dashboard.js` | Widget de notificaciones en tiempo real (SSE) |
| `perfil.js` | Gestión de perfil de usuario |

### 7.3 Características del Cliente

- **Caché cliente**: Las solicitudes se cachean en `localStorage` con TTL
- **AbortController**: Las peticiones fetch usan AbortController para cancelar peticiones obsoletas
- **SSE (Server-Sent Events)**: Notificaciones en tiempo real
- **Deep Link Router**: Navegación inteligente desde notificaciones
- **Drawer Móvil**: Navegación lateral con menú hamburguesa

---

## 8. 👥 Sistema Multi-Equipo v3.0

### 8.1 Conceptos

| Concepto | Descripción |
|----------|-------------|
| **Equipo** | Grupo organizacional con nombre, descripción y estado |
| **Líder** | Usuario con nivel 30 que gestiona su equipo |
| **Agente** | Usuario con nivel 20, miembro de un equipo |
| **Asignación** | Solicitud asignada a un equipo/agente |
| **Campaña** | Gestión por lotes asociada a un equipo |

### 8.2 Jerarquía de Equipos

```
SUPERADMIN (Nivel 100)
│
├── Equipo "Ventas Norte"
│   ├── Líder: Juan Pérez
│   ├── Agente: María García
│   ├── Agente: Carlos López
│   └── Campañas: ...
│
├── Equipo "Ventas Sur"
│   ├── Líder: Ana Martínez
│   ├── Agente: Pedro Sánchez
│   └── Campañas: ...
│
└── Equipo "Sistema" (técnico, creado automáticamente en migración)
    └── Usuarios sin equipo real asignado
```

### 8.3 Flujo de Trabajo

1. **SuperAdmin** crea equipos y promueve líderes
2. **Líder** gestiona su equipo: crea agentes, asigna solicitudes
3. **Líder** crea campañas y las asigna a agentes
4. **Agente** ve sus campañas y solicitudes asignadas
5. **Agente** realiza gestiones sobre las solicitudes asignadas

### 8.4 Tablas del Sistema Multi-Equipo

| Tabla | Propósito |
|-------|-----------|
| `equipos` | Definición de equipos |
| `equipo_usuarios` | Miembros de equipos (con liderazgo) |
| `permisos_roles` | Permisos por rol extendido |
| `permisos_equipo` | Permisos adicionales por equipo |
| `asignaciones_solicitudes` | Solicitudes asignadas a equipos/agentes |
| `campañas_equipo` | Campañas asociadas a equipos |

### 8.5 Permisos del Líder vs Agente

| Permiso | Líder | Agente |
|---------|-------|--------|
| Ver equipo | ✅ | ❌ |
| Gestionar equipo | ✅ | ❌ |
| Crear agentes | ✅ | ❌ |
| Ver campañas del equipo | ✅ | ❌ |
| Ver campañas propias | ✅ | ✅ |
| Ver solicitudes del equipo | ✅ | ❌ |
| Ver solicitudes asignadas | ✅ | ✅ |
| Gestionar solicitudes | ✅ | ✅ |
| Asignar solicitudes | ✅ | ❌ |

---

## 9. 🔒 Autenticación y Seguridad

### 9.1 Flujo de Autenticación

```
Login Request
    │
    ▼
Rate Limiting (5 intentos / 15 min)
    │
    ▼
Buscar usuario en BD
    │
    ▼
Verificar bloqueo temporal (locked_until)
    │
    ▼
Verificar cuenta activa (is_active)
    │
    ▼
Verificar contraseña (bcrypt.compareSync)
    │
    ▼
    ├── Éxito: Resetear intentos → Actualizar last_login → Crear sesión
    │
    └── Fallo: Incrementar failed_login_attempts
                ├── ¿Alcanzó límite? → Bloquear cuenta 15 min
                └── No → Responder con intentos restantes
```

### 9.2 Políticas de Seguridad

| Política | Valor |
|----------|-------|
| Mínimo de caracteres en contraseña | 8 |
| Requisitos de contraseña | 1 mayúscula + 1 número |
| Intentos de login antes de bloqueo | 5 |
| Duración del bloqueo | 15 minutos |
| Tiempo de sesión | 24 horas |
| Cookie httpOnly | ✅ |
| Cookie secure (producción) | ✅ |
| Cookie sameSite | strict |
| Rate limit general | 100 req / 15 min |
| Rate limit login | 5 req / 15 min |
| Rate limit admin | 30 req / 1 min |
| CSP (Content Security Policy) | Desactivado (scripts inline) |

### 9.3 Auditoría

Todas las acciones importantes se registran en `audit_log`:

- `user.created` - Creación de usuario
- `user.updated` - Actualización de usuario
- `user.deactivated` / `user.activated` - Cambio de estado
- `user.password_reset` - Reseteo de contraseña
- `user.promoted_to_lider` - Promoción a líder
- `user.lider_revoked` - Revocación de líder
- `user.unlocked` - Desbloqueo de cuenta
- `user.password_changed` - Cambio de contraseña
- `user.profile_updated` - Actualización de perfil
- `login.success` / `login.blocked` / `login.locked` - Eventos de login
- `equipo.created` / `equipo.updated` - Gestión de equipos
- `agente.created` / `agente.updated` - Gestión de agentes
- `notification.created` - Creación de notificación
- `system.migration` - Migraciones del sistema

---

## 10. 🔔 Notificaciones en Tiempo Real (SSE)

### 10.1 Arquitectura

```
┌──────────────┐           SSE Stream           ┌──────────────┐
│   Servidor   │ ◄──────────────────────────►   │   Cliente    │
│  (Express)   │     GET /api/admin/             │  (Navegador) │
│              │     notificaciones/stream       │              │
│              │                                 │              │
│  notification │  Eventos:                       │  notificaciones│
│  Bus         │   • notification.created        │  -dashboard.js│
│  (EventEmitter)│   • notification.read          │              │
│              │   • notification.archived       │              │
│              │   • count.updated               │              │
│              │   • ping (cada 30s)             │              │
└──────────────┘                                 └──────────────┘
```

### 10.2 NotificationBus

El `notificationBus` (singleton) gestiona conexiones SSE:

- **Máximo de conexiones totales**: 500
- **Máximo por usuario**: 5 (cierra la más antigua si excede)
- **KeepAlive**: Ping cada 30 segundos
- **Limpieza automática**: Al desconectarse el cliente

### 10.3 Tipos de Eventos SSE

| Evento | Data | Propósito |
|--------|------|-----------|
| `connected` | `{clientId, timestamp}` | Confirmación de conexión |
| `ping` | `{time}` | Mantener conexión viva |
| `notification.created` | `{id, titulo, mensaje, tipo, ...}` | Nueva notificación |
| `notification.read` | `{id, usuarioId}` | Notificación leída |
| `notification.archived` | `{id, usuarioId}` | Notificación archivada |
| `count.updated` | `{no_leidas}` | Actualización de contador |

### 10.4 Deep Link Router

Las notificaciones pueden incluir un `accion_modulo` que permite navegar directamente al módulo correspondiente:

| Módulo | Destino |
|--------|---------|
| `dashboard` | `/` o `/m` |
| `dashboard-admin` | `/admin` o `/m/admin` |
| `solicitudes` | `/solicitudes` o `/m/solicitudes` |
| `importar` | `/importar` o `/m/importar` |
| `historial` | `/historial` o `/m/historial` |
| `gestiones` | `/gestiones` o `/m/gestiones` |
| `gestion-lote` | `/gestion-lote` o `/m/gestion-lote` |
| `relaciones` | `/relaciones` o `/m/relaciones` |
| `ventas` | `/equipo-ventas` o `/m/ventas` |
| `perfil` | `/perfil` |
| `perfil-config` | `/perfil?tab=config` |
| `perfil-ayuda` | `/perfil?tab=ayuda` |

---

## 11. 📦 Módulos del Sistema

### 11.1 Dashboard

**Ruta:** `/` (desktop), `/m` (móvil)
**Archivos:** `dashboard.controller.js`, `public/desktop/js/dashboard.js`, `public/movil/js/dashboard.js`

- KPIs principales: total, activadas, rechazadas, devueltas, pendientes
- Gráfico de distribución por estado
- Gráfico de distribución por segmento
- Promedio mensual (últimos 3 meses)
- Promedio semanal (últimas 9 semanas)
- Ventas mensuales (últimos 12 meses, solo ACTIVADAS)
- Caché en servidor (30s) y en cliente (localStorage)

### 11.2 Solicitudes

**Ruta:** `/solicitudes` (desktop), `/m/solicitudes` (móvil)
**Archivos:** `excel.controller.js`, `public/desktop/js/solicitudes.js`, `public/movil/js/solicitudes.js`

- Listado paginado con scroll infinito
- Búsqueda en servidor con filtros (estado, segmento, cédula, nombre)
- Vista de tarjetas con información detallada
- Edición de estado y segmento (con auditoría)
- Completar información (código plus, referencias, dirección)
- Destacar solicitudes
- Gestión directa (crear gestión)
- Exportación de seleccionadas
- Eliminación individual/masiva

### 11.3 Importación Excel

**Ruta:** `/importar` (desktop), `/m/importar` (móvil)
**Archivos:** `excel.service.js`, `public/desktop/js/importar.js`, `public/movil/js/importar.js`

- Subida de archivos Excel (.xlsx, .xls)
- Procesamiento de hasta 50 archivos simultáneamente
- Auto-detección de columnas (IDSOLICITUD, ESTADO, CEDULA, NOMBRE, etc.)
- Auto-generación de IDs cuando IDSOLICITUD está vacío
- Asignación de "SIN ESTADO" cuando ESTADO está vacío
- Detección de duplicados por CÉDULA
- Auditoría de cambios (estado, segmento)
- Reporte de resultados (inserts, updates, errores)
- Conversión automática de fechas (serial Excel, DD/MM/YYYY, Date object)

### 11.4 Gestiones

**Ruta:** `/gestiones` (desktop/móvil)
**Archivos:** `public/desktop/js/gestiones.js`, `public/movil/js/gestiones.js`

- Vista de campañas con progreso
- Creación y gestión de campañas (gestiones_maestro)
- Asignación de solicitudes a campañas
- Progreso: solicitudes gestionadas vs total

### 11.5 Gestión por Lotes

**Ruta:** `/gestion-lote` (desktop/móvil)
**Archivos:** `gestionesMaestro.controller.js`, `public/desktop/js/gestion-lote.js`

- Asignar agentes a campañas
- Visualizar solicitudes de una campaña
- Gestionar solicitudes en lote dentro de una campaña

### 11.6 Relaciones

**Ruta:** `/relaciones` (desktop), `/m/relaciones` (móvil)
**Archivos:** `relaciones.controller.js`, `relaciones.service.js`, `public/desktop/js/relaciones.js`

- Importación de relaciones desde Excel
- Estados: ALTA / BAJA
- Campos: identificación, cliente, celular, fechas (inicio_relacion, fin_relacion, fin_credito, fidelización), próxima_baja, motivo_ruptura, número de operaciones
- Dashboard de relaciones (totales, altas, bajas)
- Gestión individual de relaciones
- Historial de gestiones por relación

### 11.7 Ventas (Control de Equipo)

**Ruta:** `/equipo-ventas` (desktop), `/m/equipo-ventas` (móvil)
**Archivos:** `public/desktop/js/ventas.js`, `public/movil/js/ventas.js`

- Registro de ventas por vendedor
- Dos períodos de venta por mes
- Configuración de bonos escalonados (bono1-bono6)
- Meta de equipo
- Cálculo automático de cumplimiento

### 11.8 Panel del Líder

**Ruta:** `/equipo` (desktop), `/m/equipo` (móvil)
**Archivos:** `equipos.controller.js`, `public/desktop/js/equipo.js`, `public/movil/js/equipo.js`

- Dashboard del equipo (miembros, campañas, asignaciones)
- Gestión de agentes (crear, editar, activar/desactivar, resetear contraseña)
- Campañas del equipo
- Gestiones del equipo

### 11.9 Panel de Administración

**Ruta:** `/admin` (solo SuperAdmin)
**Archivos:** `admin.controller.js`, `admin.routes.js`, `public/admin/js/admin.js`

- Gestión completa de usuarios (CRUD, roles, activar/desactivar)
- Promover/revocar líderes
- Resetear contraseñas
- Desbloquear cuentas
- Estadísticas del sistema
- Logs de auditoría
- Centro de notificaciones (crear, listar, eliminar)

### 11.10 Perfil de Usuario

**Ruta:** `/perfil`
**Archivos:** `public/perfil.html`, `public/js/perfil.js`

- Visualización de datos del perfil
- Edición de nombre y email
- Cambio de contraseña
- Configuración de cuenta

### 11.11 Historial de Actualizaciones

**Ruta:** `/historial` (desktop/móvil)
**Archivos:** `public/desktop/js/historial.js`, `public/movil/js/historial.js`

- Visualización de cambios en solicitudes
- Filtros por usuario y fecha
- Detalle: campo, valor anterior, valor nuevo

---

## 12. 🌐 API REST - Endpoints

### 12.1 Autenticación (`/api/auth`)

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| POST | `/api/auth/registrar` | ❌ | Registrar nuevo usuario |
| POST | `/api/auth/login` | ❌ (rate limited) | Iniciar sesión |
| POST | `/api/auth/logout` | ❌ | Cerrar sesión |
| GET | `/api/auth/sesion` | ✅ | Verificar sesión actual |
| GET | `/api/auth/perfil` | ✅ | Obtener perfil |
| PUT | `/api/auth/perfil` | ✅ | Actualizar perfil |
| PUT | `/api/auth/cambiar-password` | ✅ | Cambiar contraseña |
| GET | `/api/auth/usuarios` | ✅ (admin) | Listar usuarios |

### 12.2 Solicitudes y Excel (`/api/excel`)

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| POST | `/api/excel/upload` | ✅ | Subir archivos Excel |
| POST | `/api/excel/upload-imagen` | ✅ | Subir imagen para gestión |
| DELETE | `/api/excel/upload-imagen/:nombre` | ✅ | Eliminar imagen temporal |
| POST | `/api/excel/solicitudes` | ✅ | Crear solicitud manual |
| GET | `/api/excel/solicitudes` | ✅ | Listar solicitudes (paginado) |
| GET | `/api/excel/solicitudes/buscar` | ✅ | Buscar solicitudes |
| GET | `/api/excel/solicitudes/:id` | ✅ | Obtener solicitud |
| GET | `/api/excel/solicitudes/:id/completa` | ✅ | Solicitud completa (con referencias) |
| PUT | `/api/excel/solicitudes/:id/editar` | ✅ | Editar estado/segmento |
| PUT | `/api/excel/solicitudes/:id/completar-info` | ✅ | Completar información |
| PUT | `/api/excel/solicitudes/:id/codigo-plus` | ✅ | Actualizar código plus |
| PUT | `/api/excel/solicitudes/:id/destacar` | ✅ | Destacar solicitud |
| DELETE | `/api/excel/solicitudes/:id` | ✅ | Eliminar solicitud |
| DELETE | `/api/excel/limpiar` | ✅ | Borrar todas las solicitudes |

### 12.3 Dashboard (`/api/excel/dashboard`)

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| GET | `/api/excel/dashboard` | ✅ | KPIs principales |
| GET | `/api/excel/dashboard/segmentos` | ✅ | Distribución por segmento |
| GET | `/api/excel/dashboard/estados` | ✅ | Distribución por estado |
| GET | `/api/excel/dashboard/segmentos/filtrado` | ✅ | Segmentos filtrados por estado |
| GET | `/api/excel/dashboard/estados/filtrado` | ✅ | Estados filtrados por segmento |
| GET | `/api/excel/dashboard/promedio/mes` | ✅ | Promedio mensual |
| GET | `/api/excel/dashboard/promedio/semana` | ✅ | Promedio semanal |
| GET | `/api/excel/dashboard/ventas-mensuales` | ✅ | Ventas mensuales |

### 12.4 Gestiones (`/api/excel`)

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| POST | `/api/excel/gestiones` | ✅ | Crear gestión |
| GET | `/api/excel/gestiones/:solicitud_id` | ✅ | Obtener gestiones de solicitud |
| GET | `/api/excel/gestiones/ultimas` | ✅ | Últimas gestiones (batch) |
| GET | `/api/excel/gestiones/todas` | ✅ | Todas las gestiones (global) |
| PUT | `/api/excel/gestiones/:id` | ✅ | Actualizar gestión |
| DELETE | `/api/excel/gestiones/:id` | ✅ | Eliminar gestión |

### 12.5 Campañas (`/api/excel/gestiones-maestro`)

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| GET | `/api/excel/gestiones-maestro` | ✅ | Listar campañas |
| GET | `/api/excel/gestiones-maestro/:id` | ✅ | Obtener campaña |
| POST | `/api/excel/gestiones-maestro` | ✅ | Crear campaña |
| PUT | `/api/excel/gestiones-maestro/:id` | ✅ | Actualizar campaña |
| DELETE | `/api/excel/gestiones-maestro/:id` | ✅ | Eliminar campaña |

### 12.6 Campañas v2 (`/api/gestiones-maestro`)

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| GET | `/api/gestiones-maestro` | ✅ | Listar campañas |
| GET | `/api/gestiones-maestro/:id` | ✅ | Obtener campaña con solicitudes |
| GET | `/api/gestiones-maestro/:id/progreso` | ✅ | Progreso de campaña |
| POST | `/api/gestiones-maestro` | ✅ | Crear campaña |
| PUT | `/api/gestiones-maestro/:id` | ✅ | Actualizar campaña |
| DELETE | `/api/gestiones-maestro/:id` | ✅ | Eliminar campaña |
| PUT | `/api/gestiones-maestro/:id/agregar-solicitudes` | ✅ | Agregar solicitudes |
| PUT | `/api/gestiones-maestro/:id/quitar-solicitud` | ✅ | Quitar solicitud |
| PUT | `/api/gestiones-maestro/:id/asignar-agente` | ✅ | Asignar agente |
| PUT | `/api/gestiones-maestro/:id/quitar-asignacion` | ✅ | Quitar asignación |

### 12.7 Ventas (`/api/excel`)

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| GET | `/api/excel/ventas-equipo` | ✅ | Obtener ventas del equipo |
| POST | `/api/excel/ventas-equipo` | ✅ | Agregar/actualizar vendedor |
| DELETE | `/api/excel/ventas-equipo/:id` | ✅ | Eliminar vendedor |
| GET | `/api/excel/config-bonos` | ✅ | Configuración de bonos |
| POST | `/api/excel/config-bonos` | ✅ | Guardar configuración |

### 12.8 Relaciones (`/api/relaciones`)

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| POST | `/api/relaciones/upload` | ✅ | Subir Excel de relaciones |
| GET | `/api/relaciones` | ✅ | Listar relaciones |
| GET | `/api/relaciones/stats` | ✅ | Estadísticas de relaciones |
| DELETE | `/api/relaciones` | ✅ | Limpiar relaciones |

### 12.9 Gestiones de Relaciones (`/api/relaciones/gestiones`)

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| POST | `/api/relaciones/gestiones` | ✅ | Crear gestión |
| GET | `/api/relaciones/gestiones/:relacion_id` | ✅ | Gestiones de una relación |
| GET | `/api/relaciones/gestiones/ultimas` | ✅ | Últimas gestiones (batch) |
| DELETE | `/api/relaciones/gestiones/:id` | ✅ | Eliminar gestión |

### 12.10 Administración (`/api/admin`) — Solo SuperAdmin

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| GET | `/api/admin/usuarios` | ✅ superadmin | Listar usuarios |
| GET | `/api/admin/usuarios/:id` | ✅ superadmin | Obtener usuario |
| POST | `/api/admin/usuarios` | ✅ superadmin | Crear usuario |
| PUT | `/api/admin/usuarios/:id` | ✅ superadmin | Actualizar usuario |
| PUT | `/api/admin/usuarios/:id/toggle-active` | ✅ superadmin | Activar/Desactivar |
| PUT | `/api/admin/usuarios/:id/reset-password` | ✅ superadmin | Resetear contraseña |
| PUT | `/api/admin/usuarios/:id/unlock` | ✅ superadmin | Desbloquear |
| POST | `/api/admin/usuarios/:id/promover-lider` | ✅ superadmin | Promover a líder |
| POST | `/api/admin/usuarios/:id/revocar-lider` | ✅ superadmin | Revocar líder |
| GET | `/api/admin/estadisticas` | ✅ superadmin | Estadísticas del sistema |
| GET | `/api/admin/estadisticas/usuario/:id` | ✅ superadmin | Estadísticas por usuario |
| GET | `/api/admin/estadisticas/listado` | ✅ superadmin | Resumen de estadísticas |
| GET | `/api/admin/auditoria` | ✅ superadmin | Logs de auditoría |
| GET | `/api/admin/notificaciones` | ✅ | Listar notificaciones |
| GET | `/api/admin/notificaciones/stream` | ✅ | SSE Stream |
| GET | `/api/admin/notificaciones/no-leidas` | ✅ | Contar no leídas |
| PUT | `/api/admin/notificaciones/:id/leer` | ✅ | Marcar leída |
| PUT | `/api/admin/notificaciones/marcar-todas-leidas` | ✅ | Marcar todas leídas |
| PUT | `/api/admin/notificaciones/:id/archivar` | ✅ | Archivar |
| POST | `/api/admin/notificaciones` | ✅ superadmin | Crear notificación |
| DELETE | `/api/admin/notificaciones/:id` | ✅ superadmin | Eliminar notificación |

### 12.11 Equipos (`/api/equipos`)

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| GET | `/api/equipos` | ✅ | Listar equipos |
| GET | `/api/equipos/mi-equipo` | ✅ | Mi equipo actual |
| GET | `/api/equipos/:id` | ✅ (equipo) | Obtener equipo |
| GET | `/api/equipos/:id/miembros` | ✅ (equipo) | Miembros del equipo |
| GET | `/api/equipos/:id/dashboard` | ✅ (equipo) | Dashboard del equipo |
| GET | `/api/equipos/:id/gestiones` | ✅ (equipo) | Gestiones del equipo |
| GET | `/api/equipos/:id/campanas` | ✅ (equipo) | Campañas del equipo |
| POST | `/api/equipos` | ✅ superadmin | Crear equipo |
| PUT | `/api/equipos/:id` | ✅ superadmin | Actualizar equipo |
| DELETE | `/api/equipos/:id` | ✅ superadmin | Eliminar equipo |
| POST | `/api/equipos/:id/mover-usuario` | ✅ superadmin | Mover usuario de equipo |
| PUT | `/api/equipos/:id/asignar-lider` | ✅ superadmin | Asignar líder |
| PUT | `/api/equipos/:id/remover-miembro` | ✅ superadmin | Remover miembro |
| POST | `/api/equipos/:id/agentes` | ✅ (lider+) | Crear agente |
| PUT | `/api/equipos/:id/agentes/:agenteId` | ✅ (lider+) | Editar agente |
| PUT | `/api/equipos/:id/agentes/:agenteId/toggle-active` | ✅ (lider+) | Activar/Desactivar agente |
| PUT | `/api/equipos/:id/agentes/:agenteId/reset-password` | ✅ (lider+) | Resetear contraseña |

### 12.12 Debug (`/api/debug`)

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| GET | `/api/debug/health` | ❌ | Health check del sistema |
| GET | `/api/debug/tablas` | ✅ | Listar tablas |
| GET | `/api/debug/usuarios` | ✅ | Listar usuarios |
| GET | `/api/debug/foreign-keys/:tabla` | ✅ | Foreign keys de tabla |

---

## 13. 📱 Renderizado Responsivo

### 13.1 Detección de Dispositivo

En el servidor (`app.js`), se detecta el dispositivo mediante el User-Agent:

```javascript
function isMobileDevice(userAgent) {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);
}
```

### 13.2 Rutas por Dispositivo

| Ruta Desktop | Ruta Móvil | Descripción |
|-------------|-----------|-------------|
| `/` | `/m` | Dashboard |
| `/login` | `/m/login` | Login |
| `/solicitudes` | `/m/solicitudes` | Solicitudes |
| `/importar` | `/m/importar` | Importación |
| `/gestiones` | `/m/gestiones` | Campañas |
| `/gestion-lote` | `/m/gestion-lote` | Gestión por lotes |
| `/relaciones` | `/m/relaciones` | Relaciones |
| `/equipo-ventas` | `/m/equipo-ventas` | Ventas |
| `/historial` | `/m/historial` | Historial |
| `/equipo` | `/m/equipo` | Panel líder |
| `/admin` | `/m/admin` | Admin |
| `/perfil` | (única) | Perfil |

### 13.3 Redirección de SuperAdmin

El SuperAdmin es redirigido automáticamente al Panel de Administración y **nunca** debe acceder al Dashboard Operativo:

```javascript
// En app.js, para cada ruta operativa:
function redirectSuperAdmin(req, res) {
    if (req.session?.usuario?.is_superadmin) {
        res.redirect('/admin');  // o /m/admin si es móvil
        return true;
    }
    return false;
}
```

---

## 14. 🔄 Migraciones de Base de Datos

### 14.1 Historial de Migraciones

| Migración | Descripción | Estado |
|-----------|-------------|--------|
| **001** | Panel de Administración Fase 1: columnas de seguridad en usuarios, tabla audit_log, índices | ✅ Completa |
| **002** | Índices compuestos para optimización de rendimiento (11 índices) | ✅ Completa |
| **003a** | Sistema Multi-Equipo: 6 tablas nuevas (equipos, equipo_usuarios, permisos_roles, permisos_equipo, asignaciones_solicitudes, campañas_equipo) | ✅ Completa |
| **003b** | Seed de datos multi-equipo: equipo "Sistema", permisos de líder/agente/user | ✅ Completa |
| **004** | Columna asignado_a en gestiones_maestro para asignación a agentes | ✅ Completa |

### 14.2 Migraciones Automáticas

Además de las migraciones explícitas, `initDb.js` y `initDb.pg.js` ejecutan migraciones automáticas al iniciar el servidor:

- Creación de tablas con `CREATE TABLE IF NOT EXISTS`
- Agregado de columnas faltantes con `ALTER TABLE ADD COLUMN IF NOT EXISTS`
- Migración `ultimo_login` → `last_login`
- Migración `accion_url` → `accion_modulo` en notificaciones legacy
- Auto-seed de datos multi-equipo
- Asignación de superadmin para `daviddlaa`
- Notificación de bienvenida/email

---

## 15. 📜 Scripts de Utilidad

| Script | Propósito |
|--------|-----------|
| `scripts/audit-funciones.js` | Audita funciones JS llamadas desde HTML (detecta funciones no definidas) |
| `scripts/audit-production-schema.js` | Compara el esquema de PostgreSQL en producción vs el esperado |
| `scripts/fix-production-notificaciones.js` | Corrige problemas de notificaciones en producción |
| `scripts/migrate-production-accion-modulo.js` | Migra deep links en producción |
| `scripts/optimize-solicitudes-performance.js` | Optimiza el rendimiento del módulo de solicitudes |
| `fix_escapes.js` | Script auxiliar de corrección de escapes |
| `fix_final.js` | Script de corrección final |
| `fix_team.js` | Script de corrección del sistema de equipos |

---

## 16. 🚀 Despliegue

### 16.1 Variables de Entorno

| Variable | Obligatoria | Descripción |
|----------|-------------|-------------|
| `DATABASE_URL` | Sí (producción) | URL de conexión PostgreSQL |
| `SESSION_SECRET` | Recomendada | Secreto para cifrar sesiones |
| `PORT` | No (default 3000) | Puerto del servidor |
| `NODE_ENV` | Recomendada | `production` o `development` |

### 16.2 Entornos

#### Desarrollo Local
- **Base de datos**: SQLite (`database.db`)
- **Servidor**: `node app.js` en `http://localhost:3000`
- **No requiere** `DATABASE_URL`

#### Producción (Render u otro host)
- **Base de datos**: PostgreSQL (vía `DATABASE_URL`)
- **SSL**: Habilitado (`rejectUnauthorized: false`)
- **Trust proxy**: Habilitado (para funcionar detrás de proxy)

### 16.3 Comandos

```bash
# Iniciar en desarrollo
node app.js

# Migraciones (producción)
node migrations/001_add_admin_columns.js "$DATABASE_URL"
node migrations/002_add_compound_indexes.js
node migrations/003_create_team_tables.js "$DATABASE_URL"
node migrations/003_seed_team_data.js "$DATABASE_URL"
node migrations/004_add_asignado_a_columna.js "$DATABASE_URL"

# Deploy (Windows)
commit_push.bat
```

---

## 17. 🔗 Deep Link Router

El **Deep Link Router** (`public/js/deep-link-router.js`) resuelve navegación inteligente desde notificaciones.

### 17.1 Funcionamiento

1. Una notificación incluye `accion_modulo` (ej: `solicitudes`, `gestiones`)
2. El router resuelve el módulo a una URL concreta según el dispositivo
3. Si es escritorio: usa rutas desktop, si es móvil: usa rutas `/m/`
4. Navega a la página correspondiente y ejecuta acciones opcionales

### 17.2 Arquitectura de Resolución

```
Notificación con accion_modulo = "solicitudes"
    │
    ▼
Deep Link Router
    │
    ├── ¿Es móvil? → /m/solicitudes
    └── ¿Es desktop? → /solicitudes
    │
    ▼
Cargar página + ejecutar callback (opcional)
```

---

## 18. 💾 Caché en Servidor

### 18.1 Estrategia

El sistema utiliza **node-cache** con estrategia **cache-aside**:

1. El controlador verifica el caché antes de consultar la BD
2. Si hay dato en caché y no ha expirado, lo sirve directamente
3. Si no hay caché, consulta la BD, guarda en caché y responde
4. Después de operaciones de escritura, invalida el caché correspondiente

### 18.2 TTLs Configurados

| Dato | TTL | Justificación |
|------|-----|---------------|
| Dashboard totals | 30s | Datos semi-dinámicos que cambian con frecuencia |
| Dashboard segmentos | 30s | Misma sesión de usuario, datos estánticos |
| Dashboard estados | 30s | Misma sesión de usuario, datos estánticos |
| Estados disponibles | 300s | Catálogo que cambia muy rara vez |
| Segmentos disponibles | 300s | Catálogo que cambia muy rara vez |
| Estadísticas admin | 60s | Consulta pesada que no necesita ser precisa al segundo |

---

## 19. 📖 Glosario

| Término | Definición |
|---------|-----------|
| **Solicitud** | Registro de una petición comercial de un cliente |
| **Gestión** | Acción realizada sobre una solicitud (llamada, seguimiento, etc.) |
| **Campaña** | Conjunto de solicitudes agrupadas para gestión por lotes |
| **Gestión Maestro** | Sinónimo de campaña (nomenclatura legacy) |
| **Relación** | Estado de relación con un cliente (ALTA/BAJA) |
| **Equipo** | Grupo organizacional de usuarios bajo un líder |
| **Líder** | Usuario que gestiona un equipo y sus agentes |
| **Agente** | Usuario miembro de un equipo que opera sobre asignaciones |
| **Asignación** | Solicitud asignada a un equipo o agente específico |
| **SSE** | Server-Sent Events - Tecnología para notificaciones en tiempo real |
| **Deep Link** | Enlace que navega directamente a una sección específica |
| **SuperAdmin** | Usuario con control total del sistema (panel de administración) |
| **Drawer** | Menú de navegación lateral (móvil) |
| **Rate Limiting** | Límite de peticiones para prevenir abuso |
| **Cache-Aside** | Estrategia de caché: consultar caché → si no hay, consultar BD → guardar en caché |

---

## 📝 Notas Finales

- El sistema fue desarrollado como una **aplicación web progresiva** (no PWA, sino multi-dispositivo desde el servidor)
- No se utilizan frameworks frontend (React, Vue, etc.) — todo es Vanilla JavaScript
- La **capa de abstracción de BD** (`db.js`) permite desarrollar localmente con SQLite y desplegar en producción con PostgreSQL sin cambios de código
- El sistema **no usa ORM** — todas las consultas son SQL directo para máximo control y rendimiento
- La **auditoría** está presente en todas las operaciones críticas del sistema
- El **SuperAdmin** tiene un flujo completamente separado del Dashboard Operativo por seguridad

---

> **Última actualización:** Julio 2026  
> **Documentación generada automáticamente** con análisis del código fuente.
