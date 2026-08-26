# 📋 Archivox - Documentación Completa del Sistema

**Versión:** 3.0 (Arquitectura Multi-Equipo)
**Fecha:** Julio 2026
**Propósito:** Sistema de gestión de solicitudes, relaciones y equipos para operaciones comerciales.

> 🚀 **¿Te pierdes en la documentación?** Empieza por [`ESTADO-PROYECTO.md`](ESTADO-PROYECTO.md): una sola página con **qué está implementado** y **qué está pendiente**, con enlaces a cada documento.

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
| **Plantillas** | Mensajes de WhatsApp reutilizables con variable `{nombre}` (máx. 5 por usuario) |
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
├── commit_push.bat                 # Script de deploy (Windows)│   ├── docs/                           # Documentación del sistema
│   ├── README.md                   # Este archivo
│   ├── ESTADO-PROYECTO.md          # 🗺️ Estado del proyecto: implementado vs pendiente (Agosto 2026)
│   ├── feature-rediseño-semaforo-campañas.md  # Rediseño del indicador de estado v6.1 (Agosto 2026)
│   ├── feature-ux-comportamiento-campanas.md  # UX de progreso y prioridad v2.0 (Agosto 2026)
│   ├── feature-plantillas-mensajes.md         # Plantillas de mensajes personalizadas v1.5 (rediseño móvil) (Agosto 2026)
│   ├── feature-panel-lateral-solicitudes.md   # Panel lateral de detalle/edición en Solicitudes (Agosto 2026)
│   ├── feature-panel-lateral-agentes.md       # Panel lateral de gestión de agentes del equipo (Agosto 2026)
│   ├── feature-tarjeta-solicitudes-escritorio.md  # Tarjeta Solicitudes Desktop: sin Llamar, cédula+teléfono, fix checkbox, limpieza CSS (Agosto 2026)
│   ├── convencion-css-solicitudes.md          # Convención de propiedad de los CSS de Solicitudes (Agosto 2026)
│   ├── feature-header-filtros-solicitudes-desktop.md # Header unificado + toolbar con auto-aplicar (Agosto 2026)
│   ├── feature-filtros-movil-solicitudes.md   # Filtros móviles compactos: selects + auto-aplicar (Agosto 2026)
│   ├── informe-fix-filtros-fecha-solicitudes.md      # Fix filtros de fecha/vendedor + caché cliente (Agosto 2026)
│   ├── informe-fix-widgets-dashboard-movil.md        # Fix widgets dashboard móvil: truncado de nombres y slide (Agosto 2026)
│   ├── informe-armonia-widgets-movil.md              # Armonía widgets móvil: 3 widgets como tarjeta igual (4 registros, min-height 62px) (Agosto 2026)
│   ├── feature-filtros-fecha-todos-solicitudes.md    # Filtros de fecha (Desde/Hasta) para todos en Solicitudes desktop; vendedor solo líderes (Agosto 2026)
│   ├── feature-buscador-inline-campanas-movil.md     # Buscador inline en Campañas móvil: reemplaza bottom sheet (Agosto 2026)
│   ├── informe-semaforo-tarjetas-movil.md            # Selector de semáforo con color real + tarjetas más compactas (Agosto 2026)
│   ├── feature-historial-campana.md                  # Historial general de campaña: botón "🕘 Últimas gestiones" (Agosto 2026)
│   ├── feature-recordatorios-campanas.md             # Recordatorios ⏰ de llamada/mensaje en campañas + notificación in-app (Agosto 2026)
│   ├── fix-semaforo-movil-orden-fijo.md              # Semáforo móvil en orden fijo: Sin clasificar · Seguimiento · Encaminadas · En espera (Agosto 2026)
│   ├── feature-widget-ultimas-gestiones-dashboard.md # Widget "🕘 Últimas gestiones" en dashboard + pasarela de widgets en escritorio (Agosto 2026)
│   ├── feature-ux-agregar-campana-solicitudes.md     # Modal "Agregar a Campaña": botón arriba, toast de éxito y refresco en vivo (Agosto 2026)
│   ├── feature-semaforo-campana-completada.md        # Campaña Completada: oculta semáforo + nota (gestion-lote desktop/móvil) (Agosto 2026)
│   ├── fix-importacion-proteccion-datos-usuarios.md  # Importación Excel: nunca modifica/reasigna registros de otros usuarios + reporte omitidos (Agosto 2026)
│   ├── feature-catalogos-globales-nueva-solicitud.md  # Catálogos globales en Nueva Solicitud: estados/segmentos de toda la aplicación (Agosto 2026)
│   ├── feature-excel-demo-video.md                   # Excel de datos demo (ficticios) para el video: docs/demo/archivox-datos-demo.xlsx (Agosto 2026)
│   ├── feature-filtros-buscador-movil-solicitudes.md # Vista móvil Solicitudes (v2): leyenda + filtros en una fila, fechas colapsables para todos, KPIs −20%, buscador + "Seleccionar todo" integrados al panel (32px) y fix crítico del menú ⋮ (transform retenido) (Agosto 2026)
│   ├── feature-rediseno-tarjeta-movil-solicitudes.md # Tarjeta móvil de Solicitudes rediseñada: compacta, Gestiones = historial del cliente, Completar/Editar fusionado, ⋮→🗑️ y link a la campaña (Agosto 2026)
│   ├── feature-login-movil-compacto.md               # Login móvil más pequeño y centrado (Agosto 2026)
│   ├── feature-grid-campanas-landing.md              # Landing de campañas: grid de tarjetas + selector hero (Agosto 2026)
│   ├── feature-admin-solicitudes-globales.md         # Superadmin: tab Solicitudes globales solo lectura + export CSV + filtros dinámicos desde la BD (Agosto 2026)
│   ├── fix-500-solicitudes-created_at.md             # Fix 500 en /api/admin/solicitudes: columna created_at + mecanismo SCHEMA_VERSION (Agosto 2026)
│   ├── feature-backup-dump-superadmin.md             # Superadmin: backup de BD con un clic (dump SQL portable PG/SQLite) (Agosto 2026)
│   ├── feature-admin-campanas-sistema.md             # Superadmin: campañas "Asignadas por el sistema" (checkbox + modal + badge es_sistema) (Agosto 2026)
│   ├── feature-calendario-recordatorios.md           # Calendario mes + lista del día de recordatorios v2: modal posponer, toast, swipe (Agosto 2026)
│   ├── feature-prioridad-tiempo-sin-seguimiento.md   # Prioridad por tiempo sin seguimiento en campañas: orden + toast + badge ⏱️ (Agosto 2026)
│   ├── feature-limite-texto-seguimiento-tarjetas.md  # Límite del texto de seguimiento en tarjetas de campaña: 2 líneas móvil (tap para expandir) / 4 líneas escritorio (Agosto 2026)
│   ├── feature-buscador-global-campanas.md           # Búsqueda global de solicitudes en todas las campañas (landing) + deep link ?card= en escritorio (Agosto 2026)
│   ├── feature-guia-clasificacion-campanas.md        # Guía didáctica de clasificación al entrar a campaña (una sola vez por usuario) (Agosto 2026)
│   ├── informe-correccion-flujo-seguimiento-campanas.md # Corrección del flujo de guardado de seguimientos en campañas: contador gestionadas, control de acceso, módulo GestionCampana (Agosto 2026)
│   ├── feature-rediseno-equipo-movil.md              # Rediseño del panel del líder móvil: 3 tabs, detalle de agente en pantalla completa, campañas clicables, actividad por día (Agosto 2026)
│   ├── feature-cedula-tarjeta-movil-solicitudes.md   # Cédula visible en la tarjeta móvil de Solicitudes (🆔 debajo del nombre) + nombre siempre en una línea con ellipsis (Agosto 2026)
│   ├── informe-auditoria-produccion-daviddlaa.md     # Auditoría de producción (solo lectura) de la gestión de daviddlaa: actividad, llamadas, embudo, ventas (Agosto 2026)
│   ├── plan-metricas-llamadas-semaforo.md            # Plan de instrumentación de métricas: temporizador de llamadas + historial de semáforo (Fase 1 implementada, Fases 2-3 pendientes) (Agosto 2026)
│   ├── demo/                                        # Archivos de ejemplo (Excel demo para video)
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
│   │   ├── estadisticas.controller.js      # Métricas por usuario (escalable)
│   │   └── plantillas.controller.js        # Plantillas de mensajes por usuario
│   │
│   ├── routes/                     # Definición de rutas Express
│   │   ├── auth.routes.js          # /api/auth/*
│   │   ├── excel.routes.js         # /api/excel/*
│   │   ├── admin.routes.js         # /api/admin/*
│   │   ├── equipos.routes.js       # /api/equipos/*
│   │   ├── relaciones.routes.js    # /api/relaciones/*
│   │   ├── relacionesGestion.routes.js  # /api/relaciones/gestiones/*│   │   ├── gestionesMaestro.routes.js   # /api/gestiones-maestro/* (incl. recordatorios)
│   │   ├── debug.routes.js              # /api/debug/* (diagnóstico)
│   │   └── plantillas.routes.js         # /api/plantillas/*
│   │
│   └── services/                   # Servicios (lógica reutilizable)
│       ├── excel.service.js        # Procesamiento de archivos Excel (solicitudes)
│       ├── relaciones.service.js   # Procesamiento de archivos Excel (relaciones)
│       ├── notificationBus.js      # SSE Bus - Notificaciones en tiempo real
│       └── recordatorioScheduler.js # Scheduler de recordatorios vencidos (cada 60s)
│       └── liberacionScheduler.js   # Scheduler semanal: campaña automática de liberación
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
│   │   ├── perfil.js               # Lógica de perfil de usuario
│   │   └── gestion-campana.js      # Guardado único de gestiones/recordatorios en campañas (gestion-lote desktop y móvil) (Agosto 2026)
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
│   │   ├── plantillas.html         # Plantillas de mensajes (escritorio)
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
│   │   │   ├── relaciones.css      # Relaciones
│   │   │   └── plantillas.css      # Plantillas
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
│   │       ├── equipo.js           # Panel líder
│   │       └── plantillas.js       # Plantillas
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
│       ├── plantillas.html         # Plantillas de mensajes (móvil)
│       │
│       ├── css/                    # Estilos específicos móvil
│       │   ├── estilos.css         # Estilos base móvil
│       │   ├── solicitudes-mobile.css  # Solicitudes móvil
│       │   ├── gestiones.css       # Gestiones móvil
│       │   ├── gestion-lote.css    # Gestión por lotes móvil
│       │   ├── equipo.css          # Panel del líder móvil (tabs, filas, detalle) (Agosto 2026)
│       │   ├── importar.css        # Importar móvil
│       │   └── plantillas.css      # Plantillas móvil
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
│           ├── equipo.js           # Panel líder
│           └── plantillas.js       # Plantillas
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
│   ├── 004_add_asignado_a_columna.js     # Columna asignado_a (script)
│   ├── 005_add_vendedor_to_gestiones.js  # Columna vendedor en gestiones (script)
│   ├── 006_add_vendedor_to_gestiones_relaciones.js # Columna vendedor en gestiones_relaciones (script)
│   ├── 007_add_vendedor_to_solicitudes.js # Columna vendedor en solicitudes (script)
│   ├── 008_remove_vendedor_from_gestiones.js # Elimina columna vendedor de gestiones (script)
│   ├── 009_add_campana_id_to_solicitudes.js   # Columna campana_id en solicitudes (script)
│   ├── 010_create_gestiones_maestro_solicitudes.js # Tabla puente gestiones_maestro_solicitudes (script)
│   └── 011_create_plantillas.pg.sql       # Tabla plantillas PostgreSQL (SQL)
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
- Registrar la función `translate()` en SQLite local (usada para
  normalizar acentos en búsquedas; PostgreSQL la trae nativa).

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
| duracion_seg | INTEGER | Duración de la llamada en segundos (Fase 1 métricas) |
| llamada_inicio | TIMESTAMP/TEXT | Inicio del temporizador de llamada |
| llamada_fin | TIMESTAMP/TEXT | Fin del temporizador de llamada |
| resultado | TEXT | Resultado estructurado: no_contesta, numero_invalido, no_interesado, interesado, derivado, venta, descalificado, seguimiento, otro |
| metodo_duracion | TEXT | Origen de la duración: temporizador, estimada, manual |

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

#### `plantillas`
| Columna | Tipo | Descripción |
|---------|------|-------------|
| id | SERIAL/INTEGER PK | ID único |
| usuario_id | INTEGER NOT NULL FK | Usuario propietario |
| nombre | TEXT NOT NULL | Nombre de la plantilla (≤ 100 caracteres) |
| contenido | TEXT NOT NULL | Mensaje (≤ 2000 caracteres, soporta variable `{nombre}`) |
| creada_en | TIMESTAMP/TEXT | Fecha de creación |
| actualizada_en | TIMESTAMP/TEXT | Fecha de actualización |

#### `recordatorios` (Agosto 2026)
| Columna | Tipo | Descripción |
|---------|------|-------------|
| id | SERIAL/INTEGER PK | ID único |
| solicitud_id | INTEGER NOT NULL | Solicitud asociada |
| gestion_maestro_id | INTEGER NOT NULL | Campaña asociada |
| usuario_id | INTEGER NOT NULL | Usuario que lo programó (destinatario de la notificación) |
| canal | TEXT NOT NULL | `Llamada` o `Mensaje` |
| fecha_recordatorio | TIMESTAMP/TEXT | Fecha/hora del recordatorio |
| nota | TEXT | Nota opcional |
| estado | TEXT DEFAULT 'pendiente' | `pendiente`, `hecho` o `cancelado` |
| notificado | INTEGER DEFAULT 0 | 0/1 — ya se generó la notificación |
| created_at | TIMESTAMP/TEXT | Fecha de creación |
| completed_at | TIMESTAMP/TEXT | Fecha en que se marcó hecho/cancelado |

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
- `plantillas` - Plantillas de mensajes por usuario (máx. 5, con variable `{nombre}`)
- `recordatorios` - Recordatorios de llamada/mensaje en campañas (Agosto 2026)

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
| `idx_plantillas_usuario` | plantillas | (usuario_id) | Plantillas por usuario |
| `idx_recordatorios_gestion_estado` | recordatorios | (gestion_maestro_id, estado) | Badges ⏰ por campaña |
| `idx_recordatorios_fecha_estado` | recordatorios | (fecha_recordatorio, estado) | Barrido del scheduler |

---

## 6. 🔧 Backend (API REST)

### 6.1 Punto de Entrada (`app.js`)

El servidor se inicia con Express.js y aplica el siguiente stack de middleware en orden:

1. **trust proxy** - Habilita confianza en proxies (Render, Nginx)
2. **helmet** - Headers de seguridad HTTP
3. **express.json/urlencoded** - Parseo de body
4. **Session** - Sesiones con cookies seguras (ANTES del rate limiter para contar por usuario)
5. **Rate Limiting General** - 600 req / 15 min por usuario (solo API, excluye estáticos y SSE)
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
| Catalogos Nueva Solicitud (estados/segmentos globales) | 60s | Importación, creación, edición, eliminación de solicitudes |
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
- Plantillas, Relaciones, Ventas, Historial, Panel del Líder

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
| `drawer.js` | Drawer de navegación lateral unificado (desktop y móvil) |
| `modal.js` | Sistema de modales reutilizables |
| `notificaciones-dashboard.js` | Widget de notificaciones en tiempo real (SSE) |
| `perfil.js` | Gestión de perfil de usuario |
| `guia-campana.js` | Guía didáctica de clasificación en campañas (una sola vez por usuario, `localStorage` `campana_guia_v1_<usuarioId>`) |
| `gestion-campana.js` | Guardado único de gestión/recordatorio en campañas (compartido por gestion-lote desktop y móvil): valida, aplica update local de la tarjeta, aísla el destacar y muestra toast por tipo (Agosto 2026) |

### 7.3 Características del Cliente

- **Caché cliente**: Las solicitudes se cachean en memoria (Map) con TTL 30s y la clave
  incluye **todas** las dimensiones de filtro (`q|estado|segmento|offset|fechaDesde|fechaHasta|vendedor`),
  de modo que un cambio de fechas o vendedor nunca devuelve resultados cacheados de otro filtro
  (ver `docs/informe-fix-filtros-fecha-solicitudes.md`).
- **AbortController**: Las peticiones fetch usan AbortController para cancelar peticiones obsoletas
- **SSE (Server-Sent Events)**: Notificaciones en tiempo real
- **Deep Link Router**: Navegación inteligente desde notificaciones
- **Drawer unificado**: Navegación lateral con menú hamburguesa ☰
  - **Escritorio:** botón flotante ☰ en la **esquina superior izquierda** (`public/css/drawer.css`, `.drawer-toggle` con `left: 15px`). El drawer se desliza desde la izquierda. Se reserva espacio en los headers de página (`.page-header`, `.equipo-header`) con `padding-left: 80px` para que el botón no tape títulos. En la página de Campañas (`gestion-lote`) el botón queda junto al borde derecho del sidebar fijo de campañas (`left: 355px`, o `315px` en pantallas ≤1200px), por lo que no se superpone con la columna lateral.
  - **Móvil:** la navegación usa `MobileMenu` (bottom sheet nativo); no hay botón flotante ☰ (se oculta con `@media (max-width: 768px)`).

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
| Rate limit API | 600 req / 15 min por usuario |
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

### 10.2.1 Reconexión del Cliente (Backoff Exponencial)

El cliente (`public/js/notificaciones-dashboard.js`) reconecta el SSE con **backoff exponencial**:

- Esperas: **5s → 10s → 20s → 40s → 60s (máx)**
- Si la pestaña está oculta, **no reconecta** hasta que vuelva a estar visible (evita tráfico inútil).
- Al reconectarse con éxito, el contador de backoff se reinicia.
- **Motivo**: antes reconectaba cada 3s fijos, lo que quemaba el cupo del rate limiter
  (100 req / 15 min) y bloqueaba usuarios legítimos.

### 10.3 Tipos de Eventos SSE

| Evento | Data | Propósito |
|--------|------|-----------|
| `connected` | `{clientId, timestamp}` | Confirmación de conexión |
| `ping` | `{time}` | Mantener conexión viva |
| `notification.created` | `{id, titulo, mensaje, tipo, ...}` | Nueva notificación |
| `notification.read` | `{id, usuarioId}` | Notificación leída |
| `notification.archived` | `{id, usuarioId}` | Notificación archivada |
| `count.updated` | `{no_leidas}` | Actualización de contador |

### 10.4 Centro de Novedades (🆕 Anuncios de funcionalidades)

Las notificaciones pueden marcarse como **Novedad** (`es_novedad = 1`), lo que las
convierte en anuncios destacados de nuevas funcionalidades visibles para **todos los
usuarios**:

- **Columna `es_novedad`** (INTEGER, default 0) en la tabla `notificaciones` — migrada
automáticamente al iniciar el servidor (SQLite y PostgreSQL, idempotente).
- **Panel admin:** checkbox "✨ Anunciar como Novedad" en el modal de crear notificación
(además del selector de módulo/deep link). Las novedades se marcan con badge "🆕 NUEVO"
en la tabla y las cards móviles.
- **Panel usuario:** las novedades se muestran en una **sección destacada "✨ Novedades"**
al inicio del centro de notificaciones, separadas de las notificaciones normales, con
header degradado (violeta→azul), badge "🆕 NUEVO" animado y borde lateral degradado.
- **Toast en tiempo real:** cuando llega una novedad por SSE, el toast usa estilo y
degradado propio (borde violeta, icono ✨).
- **Deep links:** las novedades usan el mismo `accion_modulo` del DeepLinkRouter, así que
el botón de acción lleva a la pantalla correcta según la plataforma del usuario.

### 10.5 Deep Link Router

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
| `plantillas` | `/plantillas` o `/m/plantillas` |
| `ventas` | `/equipo-ventas` o `/m/ventas` |
| `perfil` | `/perfil` |
| `perfil-config` | `/perfil?tab=config` |
| `perfil-ayuda` | `/perfil?tab=ayuda` |

### 10.6 Modelo coherente del menú (Activas / Archivadas)

El centro de notificaciones sigue un modelo único y predecible:

- **Activas = no leídas.** **Archivadas = consumidas** (leídas y/o archivadas).
- **Click en la card = leer + archivar** (`PUT /leer?archivar=1`). La notificación
  desaparece de Activas y pasa a Archivadas. **No navega.**
- **La navegación al destino solo ocurre por el botón de acción "→"** de la card
  (`abrirNotificacionAccion`), que primero consume y luego resuelve la URL con el
  `DeepLinkRouter` (correcto por plataforma).
- **Recordatorios:** los botones ✅ Hecho / ⏰ Posponer / ❌ Eliminar están disponibles
  tanto en Activas como en **Archivadas**, de modo que un recordatorio nunca se pierde
  aunque su notificación ya se haya consumido.
- **"✓ Marcar todas"** consume todo lo activo del usuario (leer + archivar).
- **Restaurar** (`PUT /:id/restaurar`) devuelve la notificación a Activas como no leída.
- El **badge** del header equivale al nº de Activas (no leídas).

#### Eventos SSE por usuario

- `notification.created`, `notification.read`, `notification.archived` y `count.updated`
  se emiten **solo al usuario destinatario** (`emitirAUsuario`) cuando la notificación
  es específica (`destinatario_id`). Para notificaciones globales (`destinatario_id NULL`)
  se emiten a todos (modelo de fila compartida).
- El cliente ignora los eventos generados por su propia acción (dedupe con `_isMarkingRead`).

#### Seguridad (scoping)

`marcarLeida`, `archivar` y `restaurar` validan el destinatario: un usuario no-admin solo
puede actuar sobre notificaciones suyas o globales (403 en otro caso).

#### API

- `GET /api/admin/notificaciones` admite `q` (búsqueda ILIKE título/mensaje) y `archivada`
  (`1` = solo archivadas, `0` = solo activas, ausente = activas).
- `PUT /api/admin/notificaciones/:id/leer?archivar=1` → consume en una sola operación.

#### Migración de limpieza (idempotente)

Al iniciar el servidor, las notificaciones ya leídas pasan a Archivadas
(`UPDATE ... SET archivada = 1 WHERE leida = 1`), limpiando el menú de las operativas.

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
- **Dashboard móvil en carrusel (Agosto 2026):** el contenido principal se desliza
  horizontalmente en 4 slides full-width con *scroll-snap* (`.dash-carousel`, `.dash-slide`,
  sin "peek" del siguiente): (1) herramientas de acceso rápido con subtítulo
  "Herramientas rápidas", (2) 4 KPIs en tarjeta 2×2 alineada con la altura del slide de
  herramientas, (3) gráfico de Estados, (4) gráfico de Segmentos. Indicadores de punto
  `.dash-dots` sincronizados con el scroll (`initDashCarousel`). Ambos carruseles usan
  **loop infinito por gesto táctil** (`configurarLoopTouch`): puedes quedarte en cualquier slide
  (incluido el último); solo un swipe extra hacia adelante desde el último regresa suave al
  primero, y un swipe hacia atrás desde el primero va al último. El retorno no se dispara por
  el simple hecho de llegar al final ni al tocar un dot.
- **Widgets en mini-carrusel (móvil):** debajo del carrusel principal, un segundo carrusel
  (`.dash-widget-carousel`, `.dash-widget-slide`, full-width sin "peek") con **3 slides**
  (campañas / solicitudes / gestiones) y dots `.dash-widget-dots` sincronizados
  (`initDashWidgetCarousel`). Los slides comparten la misma altura (igualador
  `igualarAlturaWidgetSlides()`, toma la del slide más alto tras renderizar, al cargar con
  `Promise.all` de las tres cargas y en `resize`; `min-height: 190px` como piso) y su
  contenido queda centrado verticalmente (`.dash-widget-slide .campanas-widget`
  usa `flex:1; justify-content:center`), replicando el comportamiento del carrusel principal:
  - **Nombres truncados (Agosto 2026):** nombre de campaña a 30 caracteres, nombre de cliente a
    26 y cédula a 15 (helper `truncarTexto()` con `…`); la cédula se envuelve en
    `.sol-widget-cedula` con ellipsis. Evita que el contenido desborde el slide y rompa el snap
    (ver `docs/informe-fix-widgets-dashboard-movil.md`).
  - **Campañas activas:** las campañas activas (`.campanas-widget`) con nombre,
    barra de progreso `completadas/total · %` y enlace "Ver todas" → `/m/gestion-lote`. Cada
    tarjeta navega a `/m/gestion-lote?id=ID`. Carga vía `GET /api/gestiones-maestro` en
    `cargarCampañasActivas()`; el contenedor se limita a **4 tarjetas visibles** (`max-height`).
  - **Últimas solicitudes:** las 4 solicitudes más recientes del usuario logueado
    (`cargarUltimasSolicitudes()` → `GET /api/excel/solicitudes?limite=4`), cada fila con nombre,
    badge de estado coloreado (`.sol-widget-badge`, colores del mapa de `solicitudes.js`) y cédula;
    enlace "Ver todas" y tarjetas → `/m/solicitudes`.
  - **Últimas gestiones (tarjeta unificada, Agosto 2026):** misma tarjeta que los otros
    widgets (📝 icono + nombre + detalle + chevron ›, `.campana-widget-item` con
    `min-height: 62px`), **4 registros** — los 3 slides de la pasarela quedaron armónicos.
    Detalle: `tipo · fecha` (líder, con nombre del agente) o `tipo · #solicitud · 🆔 cédula ·
    fecha` (resto de usuarios, con nombre del cliente). Carga: `GET /api/equipos/:id/gestiones?limite=4`
    (líder) o `GET /api/excel/gestiones/todas?limite=4`; "Ver todas" → `/m/equipo` o
    `/m/gestiones`. Se eliminó el timeline `.ges-widget-*` (CSS muerto). Los 3 widgets tienen
    **empty state con CTA potente** (`.campanas-widget-cta`). Ver
    `docs/informe-armonia-widgets-movil.md` y `docs/feature-widget-ultimas-gestiones-dashboard.md`.
- **Dashboard escritorio en carrusel (Agosto 2026):** mismo patrón que el móvil. El bloque de
  bienvenida con los botones ⚙️ Gestiones / 🔄 Historial se eliminó (las rutas siguen
  accesibles desde el menú lateral). El contenido se organiza en un carrusel de 4 slides
  compacto (~200px de alto, `.dashd-carousel`, grid `40px 1fr 40px` para las flechas,
  `.dashd-track` con *scroll-snap*, `.dashd-slide` full-width) navegado con dots `.dashd-dot`
  + flechas ‹ › con **loop** (`initDashdCarousel`): (1) Bienvenida — título con saludo
  personalizado "¡Bienvenido, {nombre}!" vía `/api/auth/sesion` (`personalizarBienvenida`),
  subtítulo y 3 chips de acceso rápido (📤 Importar Excel · 📋 Consultar solicitudes ·
  📊 Monitorear estados), (2) KPIs — tarjeta Mi Equipo si eres líder (tamaño natural,
  centrada) o las 4 stats (Total/Activadas/Rechazadas/Aprobadas) en grid 2×2 si no
  (`ajustarSlideEquipo`), (3) Estados, (4) Segmentos (gráficos más pequeños, 98px de alto,
  30% menos que los 140px originales). Altura uniforme y contenido centrado
  (`igualarAlturaDashdSlides`). Los accesos rápidos
  (Importar/Solicitudes/Ventas/Campañas/Relaciones/Nueva Solicitud/Gestión Equipo) siguen
  como fila fija encima del carrusel.
- **Pasarela de widgets (escritorio, Agosto 2026):** debajo del carrusel, los widgets se
  muestran en una **pasarela deslizable** (`.dashd-widgets-carousel`, grid `40px 1fr 40px` +
  fila de dots, idéntica al patrón del carrusel principal) con **3 tarjetas full-width**
  navegadas con flechas ‹ › con **loop** y dots (`.dashd-widgets-dot`,
  `initDashdWidgetsCarousel`); las tarjetas comparten altura
  (`igualarAlturaDashdWidgetsSlides()` tras cargar con `Promise.all` de las tres cargas y en
  `resize`). Reemplaza al antiguo grid de 2 columnas `.dashd-widgets-grid`:
  - **Últimas Campañas:** 3 campañas activas más recientes (`cargarCampañasActivas()` →
    `GET /api/gestiones-maestro`) con nombre, barra de progreso `completadas/total · %` y
    "Ver todas" → `/gestion-lote`; cada tarjeta → `/gestion-lote?id=ID`.
  - **Últimas Solicitudes:** 3 solicitudes más recientes del usuario (`cargarUltimasSolicitudes()`
    → `GET /api/excel/solicitudes?limite=3`), cada fila con nombre, badge de estado coloreado
    (`.sol-widget-badge`) y cédula; "Ver todas" y tarjetas → `/solicitudes`.
  - **Últimas Gestiones:** tarjeta unificada `.campana-widget-item` (igual a los otros 2
    widgets, con `min-height: 62px`): 📝 icono + nombre truncado + `#id · cliente` +
    píldora de tipo + `⏱️ fecha` + observación (máx. 2 líneas) + chevron ›. Líder: gestiones
    de su equipo con nombre del agente (`GET /api/equipos/:id/gestiones?limite=4`) y
    "Ver todas" → `/equipo`; resto de usuarios: sus propias gestiones
    (`GET /api/excel/gestiones/todas?limite=4`) y "Ver todas" → `/gestiones`. Se eliminó el
    timeline `.ges-widget-*`. (Ver `docs/informe-armonia-widgets-movil.md` y
    `docs/feature-widget-ultimas-gestiones-dashboard.md`.)

### 11.2 Solicitudes

**Ruta:** `/solicitudes` (desktop), `/m/solicitudes` (móvil)
**Archivos:** `excel.controller.js`, `public/desktop/js/solicitudes.js`, `public/movil/js/solicitudes.js`

- Listado paginado con scroll infinito
- Búsqueda en servidor con filtros (estado, segmento, cédula, nombre)
- Vista de tarjetas con información detallada
- **Tarjeta móvil rediseñada (Agosto 2026):** card compacta (padding 13/14 px,
  botones 40 px) con 5 botones `📞 Llamar · 📋 Gestiones · ✏️ Completar ·
  💬 WhatsApp · 🗑️ Eliminar` (sin menú ⋮). Gestiones abre **solo el historial**
  del cliente (timeline read-only con 🏷️ vendedor, vía `GET /api/excel/gestiones/:id`).
  Completar fusiona Editar (Estado + Segmento + info adicional + referencias) con
  guardado encadenado `PUT /editar` → `PUT /completar-info`. El botón `👎 No aplica`
  (solo icono) vive en la fila 4, junto al link `📢 {campaña}` →
  `/m/gestion-lote?id=X&card=Y` con salto y destello a la tarjeta (deep link).
  La fila 1 incluye un **checkbox circular de selección** (`[○]`, ✓ morado al
  seleccionar) y siempre se mantiene en una sola línea.
  Ver `docs/feature-rediseno-tarjeta-movil-solicitudes.md`.
- **Panel lateral de detalle/edición (escritorio):** hacer clic en una
  tarjeta abre un panel deslizante (drawer) desde la derecha con la vista
  de detalle (datos personales, ubicación, laboral/económico, detalles,
  observaciones, referencias y última gestión) y la edición unificada
  dentro del mismo panel. La selección de tarjetas solo se hace con el
  checkbox; la tarjeta ya no muestra botón ⋮ ni `#id`. El menú ⋮ fue
  reemplazado por el panel. Implementado en
  `public/desktop/js/solicitudes.js` (funciones `abrirPanelSolicitud`,
  `cargarPanelSolicitud`, `abrirEditarEnPanel`, `renderPanelEditar`,
  `guardarPanelEditarSolicitud`, `cerrarPanelSolicitud`, helpers
  `panelCampo/panelSeccion/panelEscapeHtml/estadoPanelColor/...`) y
  estilos en `public/desktop/css/solicitudes.css`.
- Edición de estado y segmento (con auditoría) — también desde el panel
  lateral vía `PUT /api/excel/solicitudes/:id/editar`
- Completar información: formulario completo en escritorio y móvil
  (código plus, dirección, dirección de trabajo, ocupación, correo,
  ingreso mensual, observaciones de texto libre y 3 referencias
  personales). En escritorio la edición se abre dentro del panel lateral
  (botón "✏️ Editar"); el guardado va a
  `PUT /api/excel/solicitudes/:id/completar-info`. La columna
  `solicitudes.observaciones` se crea automáticamente al iniciar el
  servidor (idempotente) en SQLite y PostgreSQL.
- Creación manual (Nueva Solicitud): incluye el campo opcional
  "Observaciones" (textarea) en la sección Información Principal, tanto
  en escritorio como en móvil; se guarda vía `POST /api/excel/solicitudes`.
  Los listados de **Estado** y **Segmento** del formulario muestran valores
  **globales de toda la aplicación** (todos los usuarios) vía
  `GET /api/catalogos/estados` y `GET /api/catalogos/segmentos` (Agosto
  2026). Ver `docs/feature-catalogos-globales-nueva-solicitud.md`.
- **Búsqueda por palabras sin orden:** la búsqueda por nombre/segmento
  separa el término en palabras y las combina con AND, de modo que
  "julia yepez" encuentra registros aunque en la DB estén como
  "YEPEZ GONZALEZ JULIA MARIA" (apellidos primero). Además normaliza
  acentos con `translate(lower(nombre), 'áéíóúüñ', 'aeiouun')` para
  que la búsqueda sea insensible a tildes. En SQLite local la función
  `translate()` se registra como `db.function(...)` en `src/config/db.js`
  porque el SQLite nativo no la incluye.
- Destacar solicitudes
- Gestión directa (crear gestión)
- Exportación de seleccionadas
- Eliminación individual/masiva
- **Tarjeta de solicitudes (escritorio, rediseño):** sin botón
  "📞 Llamar" (ni en la tarjeta ni en el panel lateral); fila nueva
  `card-fila-contacto` con cédula 🪪 y teléfono 📞 uno al lado del otro
  debajo del nombre; se corrigió el "checkbox duplicado" al seleccionar
  (el `::after` con ✓ del CSS compartido se oculta solo en escritorio con
  override `body .solicitud-card.seleccionada::after { display:none }`;
  en móvil se conserva porque no hay checkbox). Además se limpiaron ~155
  líneas de CSS muerto de `public/desktop/css/solicitudes.css`. Ver
  `docs/feature-tarjeta-solicitudes-escritorio.md`.
- **Convención de CSS de Solicitudes:** el CSS compartido
  (`public/css/solicitudes.css`) solo contiene la estructura de tarjeta
  que usan ambas plataformas; cada plataforma agrega su CSS propio y las
  reglas no se duplican. Regla de oro: nunca duplicar la misma regla en
  dos archivos, y los overrides usan mayor especificidad (ej. prefijo
  `body `) porque el CSS compartido se carga después. Ver
  `docs/convencion-css-solicitudes.md`.
- **Header unificado (escritorio, rediseño):** los KPIs (Total /
  Mostrando / Selecc) viven dentro del header como pills compactas
  (`.kpi-inline`); la campana 🔔 queda sola siempre visible; los botones
  Dashboard / Nueva Solicitud / Importar Excel se agruparon en un menú
  desplegable ⋮ (`toggleMenuAcciones`/`cerrarMenuAcciones`, se cierra con
  clic fuera o `Escape`). Los filtros de Estado y Segmento pasaron de
  botones chips a **selects** (`filtro-estado-select` /
  `filtro-segmento-select`) dentro de una toolbar única que también
  contiene el buscador, los filtros de líder (Desde/Hasta/Vendedor) y el
  botón Limpiar; **todo aplica automáticamente al cambiar** (selects y
  fechas con `onchange`, vendedor con debounce 400 ms). La vieja barra
  `acciones-unificado` (Exportar/Marcar) se eliminó. Ver
  `docs/feature-header-filtros-solicitudes-desktop.md`.
- **Filtros móviles (rediseño):** los chips de Estado/Segmento se
  reemplazaron por **selects** desplegables en una fila compacta con
  botón ✕ Limpiar; los filtros de líder usan un grid de 2 columnas
  (Desde/Hasta) + Vendedor a ancho completo; se eliminó el botón Aplicar
  porque **todo aplica en tiempo real** (selects/fechas con `onchange`,
  vendedor con debounce 400 ms). `limpiarFiltrosLider()` resetea todo
  (estado + segmento + fechas + vendedor + buscador) y cancela timers
  pendientes. Ver `docs/feature-filtros-movil-solicitudes.md`.
- **UX móvil de Solicitudes (v2, solo móvil):** leyenda "🔍 Filtros de
  búsqueda" encima de la fila única de filtros (Estado + Segmento +
  Limpiar); los filtros de **fecha (Desde/Hasta) quedan colapsables**
  detrás del toggle "📅 Más filtros (fecha)" y ahora están **disponibles
  para todos los usuarios** (el backend ya los aplicaba sin guard de rol;
  el filtro Vendedor sigue siendo solo Lider+ y se oculta para otros
  roles). KPIs **20% más compactos** (min-height 60→48 px), selects y
  buscador más pequeños; el buscador tiene **botón ✕** para limpiar y
  re-enfocar; "Seleccionar todo" quedó armónico. **Segunda iteración:**
  el **buscador + "Seleccionar todo" se integraron DENTRO del panel de
  filtros**, debajo del toggle colapsable, con alturas unificadas de
  32 px (misma altura que los selects). **Fix crítico del menú ⋮ de las
  tarjetas:** el `position: fixed` no se desplegaba porque la card
  retenía un `transform` (keyframe `fadeInUp` con `fill-mode: both` y el
  `:active`) que la convertía en **containing block** de los hijos
  fixed — se eliminó el `transform` del keyframe final y del `:active`;
  el menú abre hacia abajo si hay espacio o hacia arriba con clamp, y
  nunca se corta ni se desposiciona. Ver
  `docs/feature-filtros-buscador-movil-solicitudes.md`.
- **Filtros de fecha para todos (escritorio, Agosto 2026):** los inputs 📅 Desde / 📅 Hasta
  están **siempre visibles** para cualquier usuario: se movieron de `#filtrosLider` a un
  `#filtrosFecha` permanente, el JS los envía siempre en la búsqueda y el backend los aplica
  sin restricción de rol (`excel.controller.js`, `listarSolicitudes` + `buscarSolicitudes` +
  sus COUNTs). El filtro 👤 Vendedor sigue siendo **solo Líder+** (nivel ≥ 30), protegido en
  UI y servidor. Ver `docs/feature-filtros-fecha-todos-solicitudes.md`.
- **UX "Agregar a Campaña" (escritorio + móvil):** el modal de agregar
  solicitudes seleccionadas a una campaña existente tiene ahora el botón
  confirmar **arriba, junto al título** (misma posición en ambas
  plataformas) y la lista de campañas pasa por debajo con scroll propio.
  Tras enviar: toast `mostrarToastSimple` ("✅ N solicitudes enviadas a la
  campaña 'X'"), la selección se limpia y la lista de solicitudes se
  refresca en vivo (invalida la caché `queryCache` y vuelve a llamar a
  `buscarEnServidor(true)`), de modo que el badge de campaña en las cards
  se actualiza sin recargar la página. En móvil ya **no** redirige a
  `/m/gestion-lote`; se queda en Solicitudes con el mismo flujo que
  escritorio. Ver `docs/feature-ux-agregar-campana-solicitudes.md`.

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
- **Celdas con fórmula:** al importar se usa `extraerValorCelda()` en
  `src/services/excel.service.js`, que toma el valor **visible** de la
  celda (`result` o `text` de ExcelJS) en lugar del objeto crudo de la
  fórmula. Esto evita que se guarde en la base un JSON de fórmula
  (`{"formula":"C211&...","result":"..."}`) como contenido del registro.
- **Protección de datos entre usuarios (Agosto 2026):** al importar con
  `IDSOLICITUD` explícito, la búsqueda de existencia ahora incluye
  `usuario_id`; si la solicitud pertenece a **otro usuario**, la fila se
  **omite** (no se modifica ni se reasigna) y se reporta en la respuesta de
  `POST /api/excel/upload` como `omitidos`/`omisiones`, con aviso ⚠️ en la
  pantalla de importación (desktop y móvil). El `UPDATE` ya no escribe
  `usuario_id` y el dedupe por cédula sigue filtrando por el usuario actual.
  Ver `docs/fix-importacion-proteccion-datos-usuarios.md`.
- **Excel de datos demo (Agosto 2026):** `docs/demo/archivox-datos-demo.xlsx`
  contiene **28 solicitudes ficticias** (nombres, cédulas y celulares
  inventados) para grabar videos de demostración de la app. La columna
  `IDSOLICITUD` va **vacía** (IDs auto-generados al importar), los estados
  usan el catálogo del sistema (ACTIVADA, PENDIENTE, RECHAZADA, DEVUELTA,
  APROBADA PARA LIBERACIÓN) y los segmentos/vendedores son ficticios y
  variados. Ver `docs/feature-excel-demo-video.md`.

### 11.4 Gestiones

**Ruta:** `/gestiones` (desktop/móvil)
**Archivos:** `public/desktop/js/gestiones.js`, `public/movil/js/gestiones.js`

- Vista de campañas con progreso
- Creación y gestión de campañas (gestiones_maestro)
- Asignación de solicitudes a campañas
- Progreso: solicitudes gestionadas vs total

### 11.5 Gestión por Lotes

**Ruta:** `/gestion-lote` (desktop/móvil)
**Archivos:** `gestionesMaestro.controller.js`, `public/js/guia-campana.js`, `public/desktop/js/gestion-lote.js`, `public/desktop/gestion-lote.html`, `public/movil/js/gestion-lote.js`, `public/movil/gestion-lote.html`

- Asignar agentes a campañas
- Visualizar solicitudes de una campaña
- Gestionar solicitudes en lote dentro de una campaña
- **Indicador de Estado (Semáforo) v6:** Panel de tarjetas premium compactas por estado (desktop) con tonos suaves diferenciados (gris neutro, sage, ámbar dorado, coral), número protagonista centrado y etiqueta debajo; sin encabezado ni decoraciones. Paletas CSS totalmente desacopladas: `--sem-panel-*` para el panel y `--sem-sol-*` para las tarjetas de solicitud. Ver `docs/feature-rediseño-semaforo-campañas.md` para documentación completa (Agosto 2026).
- **Rediseño UX de comportamiento v2:** El panel de campaña muestra avance visible, solicitudes restantes, siguiente mejor acción, última actividad relativa y feedback de gestión. La recomendación prioriza seguimiento amarillo, clasificación pendiente y respeta la espera del estado rojo usando únicamente datos reales de la campaña. Ver `docs/feature-ux-comportamiento-campanas.md`.
- **Experiencia móvil de Campañas:** La versión móvil incorpora el mismo modelo de progreso y prioridad en un layout táctil propio, con selector de campaña por bottom sheet, filtros en una sola línea, carrusel de semáforo (1×4) en **orden fijo** (Sin clasificar · Seguimiento · Encaminadas · En espera), switch segmentado de semáforo inline en cada tarjeta, acciones secundarias agrupadas y tarjetas compactadas (gradientes alineados con desktop, sin ID ni botón WhatsApp redundante, destacado con borde dorado sutil). El orden fijo se fijó en `docs/fix-semaforo-movil-orden-fijo.md` (antes el carrusel se reordenaba por prioridad en runtime).
- **Campaña Completada sale del semáforo:** si `estado` de la campaña es `Completada`/`completada`, en gestion-lote (desktop + móvil) se oculta el semáforo y se muestra la nota "✅ Campaña completada — semáforo desactivado". Los filtros del semáforo no cuentan esas gestiones; búsqueda y filtro por tipo de gestión siguen activos. Al re-activar a `Activa` el semáforo vuelve con sus datos. Ver `docs/feature-semaforo-campana-completada.md`.
- **Historial general de campaña "🕘 Últimas gestiones":** botón único en móvil (header) y escritorio (píldora en el rail) que abre el historial completo de gestiones de la campaña vía `GET /api/gestiones-maestro/:id/historial`; cada gestión navega a su tarjeta. En escritorio reemplazó el widget "Prioridad / Seguimiento (N) / Ver" (`actualizarSiguienteAccion` eliminado). Ver `docs/feature-historial-campana.md`.
- **Jerarquía de tarjetas desktop:** El selector semafórico segmentado, el segmento junto al nombre y la última gestión clicable hacen más visible el contexto operativo; el historial se consulta con control de acceso contextual por campaña.
- **Orden de lista por prioridad (D3/M3):** La lista se ordena amarillo → sin clasificar → verde → rojo, con destacadas primero, en desktop y móvil; el carrusel móvil conserva su orden fijo (Sin clasificar → Seguimiento → Encaminadas → En espera).
- **Prioridad por tiempo sin seguimiento (Agosto 2026):** Al filtrar por semáforo (Encaminadas · Seguimiento · En espera) en gestion-lote, la lista prioriza las solicitudes con más tiempo sin una gestión: sin gestión primero, luego por fecha de última gestión más antigua; toast informativo y badge ⏱️ por tarjeta (móvil + escritorio). Sin filtro se conserva el orden por prioridad de semáforo. Ver `docs/feature-prioridad-tiempo-sin-seguimiento.md`.
- **Límite del texto de seguimiento en tarjetas (Agosto 2026):** el texto de la última gestión se limita a **2 líneas en móvil** (`.sol-obs`, con tap para expandir el texto completo) y **4 líneas en escritorio** (`.sol-ultima-gestion-obs`, el bloque sigue abriendo "Ver gestión"). Las tarjetas mantienen altura uniforme sin perder contexto. Ver `docs/feature-limite-texto-seguimiento-tarjetas.md`.
- **Búsqueda global en Campañas (Agosto 2026):** en el landing de campañas (móvil + escritorio) una barra busca la solicitud en **todas las campañas** vía `GET /api/excel/solicitudes/buscar` (reutiliza el alcance por usuario); los resultados muestran nombre, cédula, teléfono y un chip con la campaña; al hacer clic se navega a `?id=<campaña>&card=<solicitud>` y la tarjeta queda centrada y resaltada. El escritorio ahora procesa el parámetro `?card=` (antes solo móvil). Ver `docs/feature-buscador-global-campanas.md`.
- **Guía didáctica de clasificación (una sola vez por usuario, Agosto 2026):** al entrar a una campaña (y al crearla, ya que redirige a gestion-lote) se muestra un modal didáctico que explica el semáforo (Seguimiento = aún no responden, Encaminadas = interés, En espera = no quieren nada), prioriza llamar antes que mensaje y recomienda guardar el contacto con botón "Copiar nombre y cédula". Se persiste en `localStorage` (`campana_guia_v1_<usuarioId>`). Ver `docs/feature-guia-clasificacion-campanas.md`.
- **Atajos de teclado desktop (D3):** `/` busca, `j`/`k` navegan tarjetas, `Enter` abre la última gestión, `1-4` filtran semáforo, `0` limpia, `Esc` cierra; foco visual `.card-focused`.
- **Rail/workspace (D2):** Panel lateral de campañas colapsable con transición de `grid-template-columns` (0.28s) y fade-in de tarjetas (`railFadeIn`); el estado persiste en `localStorage`.
- **WhatsApp Directo con plantillas:** el envío de mensajes (botón "💬 Directo" en desktop e icono 💬 en las tarjetas móviles) usa las **plantillas del usuario** (ver §11.12); todos los modales de Campañas (WhatsApp, Gestionar, Ver gestión, Historial) escapan sus datos para evitar inyección HTML.

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

**Jerarquía del panel (desktop, `public/desktop/equipo.html`):** pasarela única (KPIs / Campañas) → feed de **Gestiones Recientes del Equipo** (destacado para el líder, sin scroll). La gestión de agentes vive en un **panel lateral** propio (ver abajo).

**Pasarela (desktop):** carrusel de **2 slides** con dots clicables + flechas ‹ › con loop, sin autoplay, colocado encima del feed de gestiones para que ningún bloque quede perdido al final:
- **Slide 1 — KPIs del Equipo:** los 4 stats (👥 Agentes, 📋 Asignaciones Activas, 📢 Campañas, 📝 Gestiones 7 días) en **una fila de 4 tarjetas verticales** (icono arriba, texto abajo, centrados) en pantallas anchas; vuelven a grilla 2×2 en pantallas angostas. IDs conservados (`totalAgentes`, `totalAsignaciones`, `totalCampanas`, `totalGestiones`) actualizados por `cargarDashboard()`.
- **Slide 2 — Campañas del Equipo:** tabla completa con progreso.

La pasarela es **compacta (~20% más baja)**: paddings/fuentes de headers, tablas, botones, flechas y dots reducidos únicamente dentro de los slides (`.equipo-slide`); el feed de gestiones no se ve afectado. La altura se iguala entre slides vía `igualarAlturaEquipoSlides()`; las tablas conservan su scroll horizontal. Al quitar el slide de agentes (Agosto 2026), la pasarela **ya no colapsa** aunque el equipo tenga muchos agentes.

**Panel Lateral de Agentes (desktop, Agosto 2026):** la gestión de agentes salió de la pasarela y se movió a un **panel deslizante desde la derecha** (mismo patrón que el panel de Solicitudes, ver §11.2). Ver `docs/feature-panel-lateral-agentes.md` para documentación completa.
- **Acceso:** botón **"👥 Agentes (n)"** en el header del equipo (junto a la campana) con contador en vivo → `abrirPanelAgentes()`.
- **Vista lista:** tarjetas por agente (avatar con inicial, usuario, nombre, badge de estado, switch activar/desactivar, 📋 asignadas, 📝 gestiones 7d, 📅 ingreso) y acciones **📋 Asignaciones** / **✏️ Editar**.
- **Vista crear (➕ Nuevo Agente):** formulario dentro del panel (usuario, nombre, email, contraseña con validaciones de 8+ chars, mayúscula y número) → `POST /api/equipos/:id/agentes`.
- **Vista editar (✏️ Editar):** nombre y email → `PUT /api/equipos/:id/agentes/:agenteId`; sección **🔑 Cambiar contraseña (opcional)** → `PUT /api/equipos/:id/agentes/:agenteId/reset-password`. La contraseña se valida **antes** de guardar (evita guardados parciales).
- **Switch activar/desactivar:** `PUT /api/equipos/:id/agentes/:agenteId/toggle-active` con confirmación y revert en fallo.
- **Asignaciones:** sub-vista dentro del panel (resumen 📋 / 📝 + enlace a las solicitudes del agente) con "← Volver a la lista"; usa los datos en memoria (sin fetch extra).
- **Cierre:** ✕, clic fuera o tecla **Escape**; el overlay se crea/elimina dinámicamente y bloquea el scroll del body mientras está abierto.
- Los modales antiguos (crear agente / ver asignaciones) fueron **eliminados**.

**Feed de gestiones (desktop):**
- Tarjetas tipo timeline: avatar del agente, nombre, **badge de tipo coloreado** (Completada=verde, Llamada=ámbar, Seguimiento=azul, Visita=púrpura, otros=gris), fecha/hora, `#solicitud · cliente` (enlaza a `/solicitudes?buscar=ID`) y observación recortada a 120 chars.
- Filtros rápidos por **agente** y por **tipo de gestión** (del lado del cliente, sobre las registros cargados).
- Botón **"Cargar más"** que incrementa el `limite` del endpoint `/api/equipos/:id/gestiones` en 20 (oculto cuando no quedan registros).
- La fila de botones grandes (Nuevo Agente / Importar / Ver Solicitudes) se eliminó: "Nuevo Agente" queda dentro del **panel lateral de agentes** (botón "👥 Agentes" del header); Importar/Solicitudes siguen en el menú lateral.

**Rediseño móvil del panel del líder (`/m/equipo`, Agosto 2026):** experiencia tipo app nativa, ver `docs/feature-rediseno-equipo-movil.md`.
- **Navegación por 3 pestañas internas** (`.eq-tabs`, sticky): **👥 Agentes** (default) / **📢 Campañas** / **📝 Actividad**. Se eliminó el scroll único con quick actions y el FAB de refresh (queda pull-to-refresh).
- **Pestaña Agentes:** KPI strip compacto de 3 métricas (activos / asignadas / gestiones 7d), buscador + chips de orden (Nombre / Asignadas / Actividad), filas compactas (avatar con inicial, dot de estado, stats inline) y botón "＋ Nuevo" en el header (acción primaria del líder; se oculta si `_esLider` es falso).
- **Detalle de agente en pantalla completa** (ya no bottom sheet): cabecera con estado, stats, **campañas asignadas con barra de progreso** (tap → `/m/gestion-lote?id=X`), **últimas gestiones del agente** (tap → `/m/solicitudes?buscar=ID`) y acciones Editar / Cambiar contraseña / Activar-Desactivar (reutilizan los `mm-sheet`). Volver conserva el scroll de la lista.
- **Pestaña Campañas:** chips de filtro (Todas / Activas / Completadas) y tarjetas **clicables** que abren la campaña.
- **Pestaña Actividad:** timeline **agrupado por día** (Hoy / Ayer / fecha), chips de filtro por agente y **paginación real** con `offset` (botón "Cargar más gestiones").
- **CSS dedicado:** `public/movil/css/equipo.css` (se vació el `<style>` inline del HTML y se eliminó la carga de `gestiones.css`, cuyas clases no se usaban). `viewport-fit=cover` sin `user-scalable=no`.
- **Sin cambios en backend:** se reutilizan `GET /api/equipos/mi-equipo`, `/dashboard`, `/campanas` y `/gestiones?limite&offset`. Se eliminó el fetch redundante de `verAsignacionesAgenteMovil` (usa datos en memoria) y los onclicks generados solo llevan IDs numéricos (sin usernames inline, evita ruptura por comillas).

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

### 11.12 Plantillas de Mensajes

**Ruta:** `/plantillas` (desktop), `/m/plantillas` (móvil)
**Archivos:** `plantillas.controller.js`, `plantillas.routes.js`, `public/desktop/js/plantillas.js`, `public/movil/js/plantillas.js`

- CRUD de plantillas de WhatsApp por usuario (máx. **5**, límite leído dinámicamente del campo `max` de la API y validado de forma **atómica** en el backend), con la variable `{nombre}` que se reemplaza con el nombre del cliente
- **Seguridad (v1.3):** todos los modales de Campañas (WhatsApp Directo, Gestionar, Ver gestión, Historial) escapan sus datos con `escaparParaHTML()`/`escaparParaAtributo()`
- Pantallas desktop (grid de tarjetas) y móvil (lista), modal crear/editar con contador de caracteres (2000) e inserción rápida de `{nombre}`
- Contador de uso con barra de progreso y empty state
- **Integración con WhatsApp Directo** de Gestión por Lotes: las plantillas del usuario reemplazan los mensajes fijos (fallback al mensaje predeterminado si no hay plantillas); la variable `{nombre}` se reemplaza al abrir el modal; en móvil el icono 💬 de cada tarjeta abre este modal (v1.3)
- **UX móvil (v1.4):** FAB flotante ✨ como acción de crear, campana 🔔 en el header, estado
  vacío con CTA potente, botón 📋 Copiar (clipboard + fallback) y **vista previa en vivo** en
  el modal (burbuja tipo WhatsApp que reemplaza `{nombre}` por "María Pérez" mientras
  escribes); botones ≥ 44px.
- **Rediseño móvil (v1.5):** el botón inline "✨ Nueva" se eliminó (el FAB es la única
  acción); bloque de uso con porcentaje (`limitePct`) + barra de progreso delgada; tarjetas
  tipo **burbuja WhatsApp** (fondo azul claro, esquinas asimétricas) con botones de borde
  suave (verde copiar / índigo editar / rojo eliminar).
- Navegación por drawer y deep link (`plantillas`)
- Ver `docs/feature-plantillas-mensajes.md` para documentación completa (Agosto 2026)

---

### 11.13 Calendario de Recordatorios

**Ruta:** `/calendario-recordatorios` (desktop), `/m/calendario-recordatorios` (móvil)
**Archivos:** `gestionesMaestro.controller.js` (`listarRecordatorios`), `public/desktop/js/calendario-recordatorios.js`, `public/movil/calendario-recordatorios.html`, `public/css/calendario-recordatorios.css`, `public/movil/css/calendario-recordatorios.css`

- Calendario **mensual** con conteos por día (puntos por canal / vencidos) y KPIs del mes
  (vencidos / hoy / próximos); al seleccionar un día se lista con secciones
  Vencidos / Hoy / Del día. Sin librería externa.
- Acciones: ✅ Hecho, ⏰ Posponer, ❌ Cancelar, Ir a campaña. Scope = campañas visibles
  (`buildGestionAccessWhere`).
- **UX v2 (Agosto 2026):** modal de posponer con atajos **+30 min / +1 hora / +1 día** +
  `datetime-local` precargado (reemplaza `prompt()`); toast `cal-toast` (reemplaza `alert()`);
  **auto-scroll suave** al panel del día (móvil); **swipe horizontal** para cambiar de mes
  (móvil, umbral 70px, `touch-action: pan-y`); badge 📅 Hoy; hover con elevación (desktop).
- API: `GET /api/gestiones-maestro/recordatorios?desde=&hasta=&estado=`, reutiliza
  `PUT /:id/recordatorios/:rid/estado` y `PUT /:id/recordatorios/:rid/posponer`.
- Ver `docs/feature-calendario-recordatorios.md` (Agosto 2026).

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
| GET | `/api/excel/solicitudes/buscar` | ✅ | Buscar solicitudes (palabras AND + sin acentos) |
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
| GET | `/api/gestiones-maestro/:id/solicitudes/:solicitudId/historial` | ✅ | Historial contextual de solicitud |
| GET | `/api/gestiones-maestro/:id/historial` | ✅ | Historial general de la campaña (todas las gestiones) |
| PUT | `/api/gestiones-maestro/:id/solicitudes/:solicitudId/destacar` | ✅ | Destacar solicitud con acceso a campaña |
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
| GET | `/api/admin/conexiones` | ✅ superadmin | Conexiones en tiempo real (SSE, pool BD, peticiones por usuario, bloqueos rate limit) |
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

### 12.13 Plantillas (`/api/plantillas`)

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| GET | `/api/plantillas` | ✅ | Listar plantillas del usuario autenticado (`{data, total, max}`) |
| POST | `/api/plantillas` | ✅ | Crear plantilla (valida nombre ≤100, contenido ≤2000 y máx. 5 por usuario; límite validado de forma atómica) |
| PUT | `/api/plantillas/:id` | ✅ | Actualizar plantilla propia |
| DELETE | `/api/plantillas/:id` | ✅ | Eliminar plantilla propia |

### 12.14 Liberación (`/api/liberacion`) — Reactivación sin compra (Agosto 2026)

Detecta solicitudes en `APROBADA PARA LIBERACIÓN` con más de 6 meses (desde `fecha_solicitud`),
sin relación activa (ALTA) y que **siguen aplicando para crédito** (`COALESCE(no_aplica_credito,1)=1`,
excluye las separadas con la bandera 👎). Banner + listado + campaña/activación en lote + scheduler
semanal que crea/reutiliza campaña automática y notifica con enlace. Ver `docs/feature-liberacion-reactivacion-sin-compra.md`.

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| GET | `/api/liberacion/contar` | ✅ | `{ total }` de solicitudes que cumplen el criterio (banner) |
| GET | `/api/liberacion` | ✅ | Listado paginado (`?limite=` máx 500, `?offset=`, `?q=` id/cédula/nombre/celular) |
| POST | `/api/liberacion/activar` | ✅ | `{ ids, crear_campana, nombre_campana }` → activa en lote (estado → `ACTIVADA` + historial); con `crear_campana:true` crea la campaña (`gestiones_maestro`) y devuelve `campana_id` |

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
| `/plantillas` | `/m/plantillas` | Plantillas |
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
| **005** | Columna vendedor en gestiones | ✅ Completa |
| **006** | Columna vendedor en gestiones_relaciones | ✅ Completa |
| **007** | Columna vendedor en solicitudes | ✅ Completa |
| **008** | Elimina columna vendedor de gestiones | ✅ Completa |
| **009** | Columna campana_id en solicitudes + índice | ✅ Completa |
| **010** | Tabla puente gestiones_maestro_solicitudes (semáforo) | ✅ Completa |
| **011** | Tabla plantillas de mensajes por usuario (SQL PostgreSQL) | ✅ Completa |

### 14.2 Migraciones Automáticas

Además de las migraciones explícitas, `initDb.js` y `initDb.pg.js` ejecutan migraciones automáticas al iniciar el servidor:

- Creación de tablas con `CREATE TABLE IF NOT EXISTS`
- Tabla `plantillas` (mensajes) creada automáticamente en SQLite y PostgreSQL
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

# Migración 011 (PostgreSQL, SQL puro)
psql -d tu_db -f migrations/011_create_plantillas.pg.sql

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
| Catálogos Nueva Solicitud (estados/segmentos globales) | 60s | Importación/creación/edición/eliminación de solicitudes (caché por usuario) |
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
| **Drawer** | Panel lateral deslizante: menú de navegación (móvil) o panel de detalle/edición de solicitudes (escritorio) |
| **Rate Limiting** | Límite de peticiones para prevenir abuso |
| **Plantilla** | Mensaje de WhatsApp reutilizable con variable `{nombre}`, máximo 5 por usuario |
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

> **Última actualización:** Agosto 2026  
> **Documentación generada automáticamente** con análisis del código fuente.
