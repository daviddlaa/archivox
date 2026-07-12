# 📊 ARCHIVOX - Sistema de Gestión de Solicitudes

**Versión:** 1.0.0  
**Stack:** Node.js + Express + SQLite/PostgreSQL  
**Frontend:** HTML5 + CSS3 + JavaScript vanilla (responsive: Desktop + Móvil)  
**Autor:** Equipo de Desarrollo

---

## 📑 Índice

1. [Descripción General](#1-description-general)
2. [Arquitectura del Sistema](#2-arquitectura-del-sistema)
3. [Base de Datos](#3-base-de-datos)
4. [Backend - API REST](#4-backend---api-rest)
5. [Frontend](#5-frontend)
6. [Módulos del Sistema](#6-módulos-del-sistema)
7. [Seguridad](#7-seguridad)
8. [Rendimiento](#8-rendimiento)
9. [Instalación y Despliegue](#9-instalación-y-despliegue)
10. [Scripts de Utilidad](#10-scripts-de-utilidad)
11. [Referencia de Rutas](#11-referencia-de-rutas)

---

## 1. Descripción General

**Archivox** es un sistema web de gestión de solicitudes crediticias diseñado para equipos de ventas y cobranza. Permite importar registros desde Excel, gestionar solicitudes individualmente o por lotes (campañas), hacer seguimiento mediante gestiones, controlar ventas del equipo, gestionar relaciones con clientes (altas/bajas), y mantener un historial completo de cambios.

### Funcionalidades Principales

| Módulo | Descripción |
|--------|-------------|
| **Dashboard** | Panel con estadísticas en tiempo real, gráficos de estados y segmentos |
| **Importación Excel** | Carga masiva de solicitudes desde archivos Excel |
| **Solicitudes** | CRUD completo con filtros, búsqueda, cards, edición rápida |
| **Gestiones** | Seguimiento de cada solicitud (llamadas, WhatsApp, citas, etc.) |
| **Campañas** | Gestión por lotes (agrupar solicitudes para campañas masivas) |
| **Control de Ventas** | Seguimiento de vendedores, bonos y metas del equipo |
| **Relaciones** | Gestión de relaciones comerciales (ALTAS/BAJAS de clientes) |
| **Historial** | Auditoría de todos los cambios realizados en solicitudes |
| **Notificaciones** | Centro de notificaciones con soporte SSE en tiempo real |
| **Panel Admin** | Gestión de usuarios, estadísticas del sistema y auditoría |
| **Perfil** | Configuración de cuenta, cambio de contraseña y email |

---

## 2. Arquitectura del Sistema

### 2.1 Stack Tecnológico

```
Frontend (HTML/CSS/JS)
       ↕  HTTP REST + SSE
Backend (Express.js)
       ↕  SQL
Base de Datos (SQLite local / PostgreSQL producción)
```

### 2.2 Estructura del Proyecto

```
archivox/
├── src/                          # Backend (Node.js)
│   ├── config/                   # Configuración global
│   │   ├── db.js                 # Pool unificado SQLite/PostgreSQL
│   │   ├── database.js           # Conexión directa SQLite
│   │   ├── database.pg.js        # Pool PostgreSQL
│   │   ├── initDb.js             # Schema inicial SQLite
│   │   ├── initDb.pg.js          # Schema inicial PostgreSQL
│   │   ├── permissions.js        # Sistema de roles y permisos
│   │   ├── multer.config.js      # Configuración de subida de archivos
│   │   └── auth.controller.js    # Legacy - auth con SQLite directo
│   ├── controllers/              # Controladores (lógica de negocio)
│   │   ├── auth.controller.js    # Autenticación (login, registro, sesión)
│   │   ├── excel.controller.js   # Solicitudes, gestiones, ventas, historial
│   │   ├── admin.controller.js   # Administración de usuarios y sistema
│   │   ├── estadisticas.controller.js  # Métricas por usuario
│   │   ├── gestionesMaestro.controller.js  # Campañas (gestión por lotes)
│   │   ├── notificaciones.controller.js  # Centro de notificaciones + SSE
│   │   ├── relaciones.controller.js      # Relaciones ALTAS/BAJAS
│   │   └── relacionesGestion.controller.js  # Gestiones de relaciones
│   ├── middleware/
│   │   └── auth.middleware.js    # Middleware de autenticación/autorización
│   ├── routes/                   # Rutas de la API
│   │   ├── excel.routes.js       # Ruta principal (solicitudes, gestiones, etc.)
│   │   ├── auth.routes.js        # Autenticación
│   │   ├── admin.routes.js       # Administración + notificaciones
│   │   ├── gestionesMaestro.routes.js  # Campañas
│   │   ├── relaciones.routes.js        # Relaciones
│   │   ├── relacionesGestion.routes.js # Gestiones de relaciones
│   │   └── debug.routes.js       # Debug (solo desarrollo)
│   └── services/
│       ├── excel.service.js      # Procesamiento de archivos Excel
│       ├── relaciones.service.js # Procesamiento Excel de relaciones
│       └── notificationBus.js    # Bus de eventos SSE en tiempo real
├── public/                       # Frontend
│   ├── admin/                    # Panel de administración
│   ├── desktop/                  # Versión escritorio
│   │   ├── css/                  # Estilos específicos
│   │   ├── js/                   # JavaScript específico
│   │   └── *.html                # Páginas
│   ├── movil/                    # Versión móvil
│   │   ├── css/                  # Estilos específicos
│   │   ├── js/                   # JavaScript específico
│   │   └── *.html                # Páginas
│   ├── css/                      # Estilos compartidos
│   └── js/                       # JS compartido (login, dashboard)
├── migrations/                   # Scripts de migración
├── scripts/                      # Scripts de utilidad
├── docs/                         # Documentación
│   └── anteriores/               # Documentación anterior
├── uploads/                      # Archivos subidos temporales
├── app.js                        # Punto de entrada del servidor
└── package.json                  # Dependencias
```

### 2.3 Flujo de Datos

```
Usuario → Navegador → app.js (Express) → Middleware (auth, rate-limit)
  → Rutas (routes/) → Controladores (controllers/)
    → Servicios (services/) → Base de Datos (SQLite/PostgreSQL)
  → Respuesta JSON → Frontend renderiza
  ↔ SSE (NotificationBus) para tiempo real
```

### 2.4 Detección de Dispositivo

El sistema usa detección automática de dispositivo (User-Agent) en `app.js` para servir la versión Desktop o Móvil. También soporta forzar versión móvil con `?movil=1`.

---

## 3. Base de Datos

### 3.1 Motor de Base de Datos

El sistema usa un **pool unificado** (`src/config/db.js`) que abstrae las diferencias entre:

| Entorno | Motor | Configuración |
|---------|-------|---------------|
| **Local/Desarrollo** | SQLite (better-sqlite3) | `database.db` |
| **Producción (Render)** | PostgreSQL | `DATABASE_URL` env var |

La migración entre motores es automática: `db.js` detecta `DATABASE_URL` y usa PostgreSQL; de lo contrario, usa SQLite. La capa de abstracción convierte placeholders (`$1` → `?`) y funciones de fecha automáticamente.

### 3.2 Esquema de Tablas

#### `usuarios`
| Columna | Tipo | Descripción |
|---------|------|-------------|
| id | SERIAL/INTEGER PK | ID único |
| username | TEXT UNIQUE NOT NULL | Nombre de usuario |
| password | TEXT NOT NULL | Hash bcrypt |
| nombre | TEXT | Nombre completo |
| email | TEXT UNIQUE | Correo electrónico |
| email_verified | BOOLEAN/INTEGER | Verificación de email |
| rol | TEXT (user/admin/superadmin) | Rol del usuario |
| is_active | BOOLEAN/INTEGER | Cuenta activa/inactiva |
| is_superadmin | BOOLEAN/INTEGER | Superadmin |
| failed_login_attempts | INTEGER | Intentos fallidos de login |
| locked_until | TIMESTAMP/TEXT | Bloqueo temporal |
| password_changed_at | TIMESTAMP/TEXT | Último cambio de contraseña |
| created_at | TIMESTAMP/TEXT | Fecha de registro |
| updated_at | TIMESTAMP/TEXT | Última actualización |
| last_login | TIMESTAMP/TEXT | Último inicio de sesión |

#### `solicitudes`
| Columna | Tipo | Descripción |
|---------|------|-------------|
| id | SERIAL/INTEGER PK | ID interno |
| id_solicitud | INTEGER UNIQUE | ID de la solicitud (visible) |
| estado | TEXT | Estado (ACTIVADA, RECHAZADA, etc.) |
| cedula | TEXT | Cédula de identidad |
| nombre | TEXT | Nombre del cliente |
| celular | TEXT | Número de celular |
| segmento | TEXT | Segmento del cliente |
| producto | TEXT | Producto solicitado |
| codigo_plus | TEXT | Código Plus |
| correo_electronico | TEXT | Email del cliente |
| direccion | TEXT | Dirección domiciliaria |
| direccion_trabajo | TEXT | Dirección laboral |
| ocupacion | TEXT | Ocupación |
| ingreso_mensual | DECIMAL/REAL | Ingreso mensual |
| fecha_solicitud | TEXT | Fecha de la solicitud |
| usuario_id | INTEGER FK → usuarios | Propietario de la solicitud |
| destacado | INTEGER 0/1 | Solicitud destacada |
| fecha_importacion | TIMESTAMP | Fecha de importación |
| fecha_actualizacion | TIMESTAMP | Última actualización |

#### `gestiones`
| Columna | Tipo | Descripción |
|---------|------|-------------|
| id | SERIAL/INTEGER PK | ID único |
| solicitud_id | INTEGER NOT NULL | Solicitud asociada |
| usuario_id | INTEGER NOT NULL FK | Usuario que gestionó |
| tipo_gestion | TEXT NOT NULL | Tipo (Seguimiento, Cobranza, WhatsApp, etc.) |
| observacion | TEXT | Notas de la gestión |
| gestion_maestro_id | INTEGER FK | Campaña asociada (opcional) |
| fecha_gestion | TIMESTAMP | Fecha de la gestión |
| created_at/updated_at | TIMESTAMP | Timestamps |

#### `gestiones_maestro` (Campañas)
| Columna | Tipo | Descripción |
|---------|------|-------------|
| id | SERIAL/INTEGER PK | ID único |
| nombre | TEXT NOT NULL | Nombre de la campaña |
| descripcion | TEXT | Descripción |
| usuario_id | INTEGER NOT NULL FK | Creador |
| estado | TEXT (activa/pausada/completada) | Estado |
| total_solicitudes | INTEGER | Total de solicitudes en la campaña |
| gestionadas | INTEGER | Solicitudes ya gestionadas |
| fecha_limite | DATE | Fecha límite |
| solicitudes_ids | TEXT | JSON array con IDs de solicitudes |

#### `historial_actualizaciones` (Auditoría)
| Columna | Tipo | Descripción |
|---------|------|-------------|
| id | SERIAL/INTEGER PK | ID único |
| solicitud_id | INTEGER NOT NULL | Solicitud modificada |
| usuario_id | INTEGER NOT NULL FK | Usuario que modificó |
| campo | TEXT NOT NULL | Campo modificado (estado, segmento, etc.) |
| valor_anterior | TEXT | Valor antes del cambio |
| valor_nuevo | TEXT | Valor después del cambio |
| fecha_actualizacion | TIMESTAMP | Fecha del cambio |

#### `audit_log` (Auditoría del sistema)
| Columna | Tipo | Descripción |
|---------|------|-------------|
| id | SERIAL/INTEGER PK | ID único |
| usuario_id | INTEGER NOT NULL FK | Usuario que ejecutó la acción |
| accion | TEXT NOT NULL | Acción (login.success, user.created, etc.) |
| target_type | TEXT | Tipo de objetivo (user, system) |
| target_id | INTEGER | ID del objetivo |
| detalle | JSONB/TEXT | Detalles adicionales |
| ip_address | TEXT | IP del cliente |
| user_agent | TEXT | User-Agent |
| created_at | TIMESTAMP | Fecha de la acción |

#### `notificaciones`
| Columna | Tipo | Descripción |
|---------|------|-------------|
| id | SERIAL/INTEGER PK | ID único |
| titulo | TEXT NOT NULL | Título de la notificación |
| mensaje | TEXT NOT NULL | Contenido |
| tipo | TEXT (info/warning/success/danger) | Tipo visual |
| prioridad | TEXT (baja/normal/alta/critica) | Prioridad |
| creador_id | INTEGER FK | Admin que la creó |
| destinatario_id | INTEGER FK | Usuario destino (NULL = todos) |
| leida | INTEGER 0/1 | Leída o no |
| leida_at | TIMESTAMP | Cuándo se leyó |
| archivada | INTEGER 0/1 | Archivada |
| accion_url | TEXT | Deep link de acción |
| accion_texto | TEXT | Texto del botón de acción |
| fecha_expiracion | TIMESTAMP | Fecha de expiración |
| created_at | TIMESTAMP | Fecha de creación |

#### Otras tablas:
- **`ventas_vendedores`** - Control de ventas por vendedor y mes
- **`config_bonos`** - Configuración de bonos por mes
- **`solicitudes_referencias`** - Referencias personales de solicitudes
- **`relaciones`** - Relaciones comerciales (ALTAS/BAJAS)
- **`gestiones_relaciones`** - Gestiones sobre relaciones

### 3.3 Índices

```sql
-- Usuarios
CREATE INDEX idx_usuarios_rol ON usuarios(rol);
CREATE INDEX idx_usuarios_is_active ON usuarios(is_active);
CREATE INDEX idx_usuarios_locked ON usuarios(locked_until) WHERE locked_until IS NOT NULL;

-- Auditoría
CREATE INDEX idx_audit_log_usuario ON audit_log(usuario_id);
CREATE INDEX idx_audit_log_accion ON audit_log(accion);
CREATE INDEX idx_audit_log_created_at ON audit_log(created_at);

-- Solicitudes
CREATE INDEX idx_solicitudes_referencias_solicitud ON solicitudes_referencias(id_solicitud);
CREATE INDEX idx_gestiones_relaciones_relacion_id ON gestiones_relaciones(relacion_id);
```

---

## 4. Backend - API REST

### 4.1 Middleware de Seguridad

| Middleware | Función |
|------------|---------|
| `helmet()` | Headers de seguridad HTTP |
| `express-rate-limit` (general) | 100 req/15 min global |
| `express-rate-limit` (login) | 5 intentos/15 min |
| `express-rate-limit` (admin) | 30 req/min |
| `express-session` | Sesiones httpOnly, secure, sameSite |
| `requiresAuth` | Protege rutas API (responde 401) |
| `requireAuthPage` | Protege páginas (redirige a login) |
| `requiresRole(roles...)` | Verifica rol específico |
| `requiresPermission(permiso)` | Verifica permiso específico |

### 4.2 Sistema de Roles y Permisos

| Rol | Nivel | Descripción |
|-----|-------|-------------|
| `user` | 10 | Usuario normal: gestiona sus datos |
| `admin` | 50 | Administrador: gestiona usuarios, ve auditoría |
| `superadmin` | 100 | Control total: puede crear admins, configurar sistema |

Los permisos siguen el formato `recurso:acción`:
- `users:*` - CRUD completo de usuarios
- `data:*` - Todos los datos del sistema
- `audit:*` - Logs de auditoría
- Soporta wildcards: `users:*` incluye `users:read`, `users:write`, etc.

### 4.3 Controladores

#### `auth.controller.js`
- Registro con validación de contraseña (8+ chars, mayúscula, número)
- Login con bloqueo por intentos fallidos (5 intentos → 15 min bloqueo)
- Verificación de cuenta activa
- Cambio de contraseña
- Actualización de perfil (nombre, email)
- Auditoría de todas las acciones de autenticación

#### `excel.controller.js` (Controlador principal)
- **Solicitudes**: CRUD completo, importación Excel, búsqueda, filtros
- **Dashboard**: Estadísticas, segmentos, estados, promedios, ventas mensuales
- **Gestiones**: Crear, listar, actualizar, eliminar, batch de últimas gestiones
- **Ventas**: Control de vendedores, configuración de bonos
- **Historial**: Auditoría de cambios con JOIN a solicitudes
- **Edición rápida**: Actualizar estado/segmento con auditoría
- **Completar Info**: Actualizar datos completos + referencias
- **Imágenes**: Subir/eliminar imágenes para gestiones WhatsApp

#### `gestionesMaestro.controller.js` (Campañas)
- Crear campañas con lotes de solicitudes
- Agregar/quitar solicitudes a campañas existentes
- Progreso de gestión por campaña
- Los IDs de solicitudes se almacenan como JSON en `solicitudes_ids`

#### `relaciones.controller.js`
- Importar relaciones desde Excel
- Listar con filtros (estado, búsqueda, fechas, operaciones)
- Estadísticas (totales, altas, bajas)
- Limpiar relaciones

#### `admin.controller.js`
- CRUD de usuarios con reglas de seguridad (admin no puede modificar admin)
- Estadísticas del sistema (usuarios, solicitudes, gestiones, relaciones)
- Logs de auditoría con filtros y paginación

#### `notificaciones.controller.js`
- CRUD de notificaciones
- SSE (Server-Sent Events) para tiempo real
- Contador de no leídas
- Marcar como leídas / archivar

### 4.4 Servicios

#### `excel.service.js`
- Procesa archivos Excel (formato .xlsx)
- Detecta encabezados automáticamente
- Auto-genera IDs cuando IDSOLICITUD viene vacío
- Normaliza fechas (serial Excel, Date, string DD/MM/YYYY, ISO)
- Detecta duplicados por ID o por CÉDULA
- Guarda auditoría de cambios en estado/segmento

#### `relaciones.service.js`
- Procesa Excel de relaciones con mapeo de columnas
- Detecta encabezados en fila 1 o 2
- Normaliza estados (ALTA/BAJA)
- Elimina registros anteriores y re-inserta

#### `notificationBus.js` (Tiempo Real)
- Sistema de eventos SSE (Server-Sent Events)
- Mantiene conexiones con keep-alive cada 30s
- Filtra notificaciones por destinatario
- Límite de 200 listeners concurrentes

---

## 5. Frontend

### 5.1 Versiones

El frontend tiene dos implementaciones completas:

| Versión | Ruta base | Características |
|---------|-----------|-----------------|
| **Desktop** | `/desktop/` | Cards, tablas, menú contextual, modales, drawer lateral |
| **Móvil** | `/movil/` | Bottom nav, drawer deslizante, cards adaptadas, hero actions |
| **Admin** | `/admin/` | Panel completo con tabs, tablas, modales, responsive |

### 5.2 Componentes Compartidos

- **Drawer.js** - Menú lateral unificado (desktop derecha, móvil izquierda)
- **Notificaciones** - Badge de notificaciones no leídas con SSE
- **Login** - Formulario de login/registro responsive
- **Estilos base** - `main.css` y `base.css` con variables y componentes reutilizables

### 5.3 Páginas

| Ruta | Desktop | Móvil | Descripción |
|------|---------|-------|-------------|
| `/` o `/m` | ✅ | ✅ | Dashboard principal |
| `/solicitudes` | ✅ | ✅ | Gestión de solicitudes |
| `/importar` | ✅ | ✅ | Importar Excel |
| `/gestiones` | ✅ | ✅ | Seguimiento de gestiones |
| `/gestion-lote` | ✅ | ✅ | Campañas por lotes |
| `/historial` | ✅ | ✅ | Historial de cambios |
| `/ventas` o `/equipo-ventas` | ✅ | ✅ | Control de ventas |
| `/relaciones` | ✅ | ✅ | Gestión de relaciones |
| `/perfil` | ✅ | ✅ | Perfil de usuario |
| `/admin` | ✅ | ✅ | Panel de administración |
| `/login` | ✅ | ✅ | Inicio de sesión |

### 5.4 Funcionalidades Clave del Frontend

**Solicitudes:**
- Cards con información del cliente
- Menú contextual (⋮) con opciones: Editar, Destacar, Completar Info, Gestiones, Eliminar
- Filtros por estado, segmento, búsqueda
- Paginación con infinite scroll
- Modal de edición rápida (estado + segmento)
- Modal de completar información (código plus, direcciones, referencias)
- Gestión de gestiones individuales

**Dashboard:**
- Cards con totales
- Gráficos Chart.js (barras horizontales para estados, doughnut para segmentos)
- Actualización automática cada 5 segundos

**Campañas:**
- Panel lateral con lista de campañas
- Creación de campañas con selección de solicitudes
- Progreso de gestión
- Editar/quitar solicitudes

---

## 6. Módulos del Sistema

### 6.1 Dashboard
```
GET /api/excel/dashboard       → Totales (total, activadas, rechazadas, pendientes)
GET /api/excel/dashboard/estados → Distribución por estado
GET /api/excel/dashboard/segmentos → Distribución por segmento
GET /api/excel/dashboard/ventas-mensuales → Ventas últimos 12 meses
GET /api/excel/dashboard/promedio/mes → Promedio mensual
GET /api/excel/dashboard/promedio/semana → Promedio semanal
```

### 6.2 Solicitudes
```
GET    /api/excel/solicitudes             → Listar con filtros y paginación
GET    /api/excel/solicitudes/buscar      → Búsqueda optimizada
GET    /api/excel/solicitudes/:id         → Obtener una solicitud
POST   /api/excel/solicitudes             → Crear solicitud manual
PUT    /api/excel/solicitudes/:id/editar  → Editar estado/segmento (con auditoría)
PUT    /api/excel/solicitudes/:id/destacar → Destacar/no destacar
DELETE /api/excel/solicitudes/:id         → Eliminar solicitud
DELETE /api/excel/limpiar                 → Limpiar todas las solicitudes
```

### 6.3 Completar Información
```
GET  /api/excel/solicitudes/:id/completa      → Obtener datos completos + referencias
PUT  /api/excel/solicitudes/:id/completar-info → Actualizar datos + referencias
PUT  /api/excel/solicitudes/:id/codigo-plus   → Actualizar código plus
```

### 6.4 Gestiones
```
GET    /api/excel/gestiones/:solicitud_id   → Gestiones de una solicitud
GET    /api/excel/gestiones/ultimas         → Últimas gestiones (batch)
GET    /api/excel/gestiones/todas           → Todas las gestiones con filtros globales
POST   /api/excel/gestiones                 → Crear gestión
PUT    /api/excel/gestiones/:id             → Actualizar gestión
DELETE /api/excel/gestiones/:id             → Eliminar gestión
```

### 6.5 Campañas (Gestión por Lotes)
```
GET    /api/excel/gestiones-maestro            → Listar campañas
GET    /api/excel/gestiones-maestro/:id        → Obtener campaña con solicitudes
POST   /api/excel/gestiones-maestro            → Crear campaña
PUT    /api/excel/gestiones-maestro/:id        → Actualizar campaña
DELETE /api/excel/gestiones-maestro/:id        → Eliminar campaña
PUT    /api/excel/gestiones-maestro/:id/agregar-solicitudes  → Agregar solicitudes
PUT    /api/excel/gestiones-maestro/:id/quitar-solicitud     → Quitar solicitud
```

### 6.6 Control de Ventas
```
GET  /api/excel/ventas-equipo    → Listar vendedores por mes
POST /api/excel/ventas-equipo    → Agregar/actualizar vendedor
DEL  /api/excel/ventas-equipo/:id → Eliminar vendedor
GET  /api/excel/config-bonos     → Configuración de bonos
POST /api/excel/config-bonos     → Guardar configuración de bonos
```

### 6.7 Relaciones
```
GET    /api/relaciones        → Listar relaciones con filtros
GET    /api/relaciones/stats  → Estadísticas (altas/bajas)
POST   /api/relaciones/upload → Importar Excel de relaciones
DELETE /api/relaciones        → Limpiar relaciones
```

### 6.8 Notificaciones
```
GET    /api/admin/notificaciones              → Listar notificaciones (con filtros)
GET    /api/admin/notificaciones/no-leidas    → Contar no leídas
GET    /api/admin/notificaciones/stream       → SSE stream (tiempo real)
POST   /api/admin/notificaciones              → Crear notificación (admin)
PUT    /api/admin/notificaciones/:id/leer     → Marcar como leída
PUT    /api/admin/notificaciones/marcar-todas-leidas → Marcar todas leídas
PUT    /api/admin/notificaciones/:id/archivar → Archivar
DELETE /api/admin/notificaciones/:id          → Eliminar
```

### 6.9 Administración
```
GET    /api/admin/usuarios                → Listar usuarios (filtros + paginación)
GET    /api/admin/usuarios/:id            → Obtener usuario
POST   /api/admin/usuarios                → Crear usuario
PUT    /api/admin/usuarios/:id            → Actualizar usuario
PUT    /api/admin/usuarios/:id/toggle-active → Activar/desactivar
PUT    /api/admin/usuarios/:id/reset-password → Resetear contraseña
PUT    /api/admin/usuarios/:id/unlock     → Desbloquear
GET    /api/admin/estadisticas            → Estadísticas globales
GET    /api/admin/estadisticas/usuario/:id → Estadísticas por usuario
GET    /api/admin/auditoria               → Logs de auditoría
```

### 6.10 Historial de Cambios
```
GET /api/excel/historial → Obtener historial con JOIN a solicitudes
```

### 6.11 Autenticación
```
POST /api/auth/registrar       → Registro de usuario
POST /api/auth/login           → Inicio de sesión
POST /api/auth/logout          → Cerrar sesión
GET  /api/auth/sesion          → Verificar sesión
GET  /api/auth/perfil          → Obtener perfil
PUT  /api/auth/perfil          → Actualizar perfil
PUT  /api/auth/cambiar-password → Cambiar contraseña
```

---

## 7. Seguridad

### 7.1 Autenticación
- Contraseñas hasheadas con bcrypt (10 rondas)
- Sesiones httpOnly, secure (HTTPS en producción), sameSite strict
- Bloqueo temporal tras 5 intentos fallidos (15 minutos)
- Validación de fortaleza de contraseña (8+ chars, mayúscula, número)
- Registro de todos los eventos de autenticación en auditoría

### 7.2 Autorización
- Sistema de roles (user/admin/superadmin) con niveles
- Middleware por rol y por permiso específico
- Protección contra escalamiento de privilegios (admin no puede modificar admin)
- Validación de permisos en cada operación crítica

### 7.3 Protección de Datos
- Rate limiting (global, login, admin)
- Helmet (headers de seguridad HTTP)
- SQL parametrizado (bind params) - sin concatenación de strings SQL
- Mapeo de columnas seguras para ORDER BY (evita SQL injection en ordenamiento)
- Sanitización de salida (escapeHtml en frontend)

### 7.4 Sesión
- Cookie maxAge: 24 horas
- httpOnly: true (no accesible por JavaScript)
- secure: true en producción (solo HTTPS)
- sameSite: strict (protección CSRF)

---

## 8. Rendimiento

### 8.1 Optimizaciones Backend
- **LATERAL JOIN** en lugar de subquery correlacionada para gestión más reciente
- **Promise.all** para consultas paralelas (datos + conteo)
- **Índices** en columnas de búsqueda frecuente (rol, estado, created_at)
- **WAL mode** en SQLite (mejor concurrencia)
- **Batch de últimas gestiones** (una sola query para múltiples solicitudes)
- **Capa de abstracción** db.js que unifica SQLite y PostgreSQL

### 8.2 Optimizaciones Frontend
- **Infinite scroll** en solicitudes (carga progresiva)
- **Búsqueda en servidor** evita cargar todos los datos
- **Debounce** en búsquedas (300ms)
- **Renderizado de cards** en batches
- **Chart.js** para gráficos ligeros

---

## 9. Instalación y Despliegue

### 9.1 Requisitos
- Node.js 18+
- npm

### 9.2 Instalación Local
```bash
# Clonar repositorio
git clone <url>
cd archivox

# Instalar dependencias
npm install

# Crear archivo .env (opcional para PostgreSQL)
# DATABASE_URL=postgresql://...

# Iniciar servidor
node app.js
# Servidor en http://localhost:3000
```

### 9.3 Despliegue en Producción (Render)

```bash
# Render automáticamente usa DATABASE_URL de PostgreSQL
# Build Command:
npm install

# Start Command:
node app.js
```

### 9.4 Variables de Entorno

| Variable | Descripción | Requerido |
|----------|-------------|-----------|
| `PORT` | Puerto del servidor (default: 3000) | No |
| `DATABASE_URL` | URL de conexión PostgreSQL | No (usa SQLite si no está) |
| `SESSION_SECRET` | Secreto de sesión | Recomendado |
| `NODE_ENV` | `production` para HTTPS en cookies | Recomendado |

---

## 10. Scripts de Utilidad

### `scripts/audit-funciones.js`
Audita que todas las funciones JavaScript llamadas desde eventos HTML (`onclick`, etc.) estén definidas en los archivos JS del proyecto. Útil para detectar funciones faltantes después de refactorizaciones.

### `scripts/audit-production-schema.js`
Verifica que el esquema de la base de datos en producción (PostgreSQL) coincida con el esperado. Revisa tablas, columnas, tipos de datos e índices.

### `scripts/fix-production-notificaciones.js`
Corrige problemas de migración de columnas en la tabla `notificaciones` (conversión BOOLEAN→INTEGER para compatibilidad PostgreSQL).

### `scripts/optimize-solicitudes-performance.js`
Crea índices adicionales en la tabla `solicitudes` para optimizar consultas de dashboard y búsquedas frecuentes.

---

## 11. Referencia de Rutas

### Archivo `app.js` - Mapeo de Rutas a Archivos HTML

```
Ruta Pública:
  /login        → public/desktop/login.html (o movil según User-Agent)
  /m/login      → public/movil/login.html
  /registro     → public/desktop/login.html

Rutas Protegidas (requireAuthPage):
  /             → public/desktop/index.html (o movil según User-Agent)
  /m            → public/movil/index.html
  /solicitudes  → Versión según dispositivo
  /importar     → Versión según dispositivo
  /gestiones    → Versión según dispositivo
  /historial    → Versión según dispositivo
  /ventas       → public/desktop/ventas.html
  /equipo-ventas → public/desktop/ventas.html
  /gestion-lote → public/desktop/gestion-lote.html
  /relaciones   → public/desktop/relaciones.html
  /perfil       → public/perfil.html
  /admin        → public/admin/index.html

Rutas API:
  /api/auth         → src/routes/auth.routes.js
  /api/excel        → src/routes/excel.routes.js
  /api/admin        → src/routes/admin.routes.js
  /api/gestiones-maestro → src/routes/gestionesMaestro.routes.js
  /api/relaciones   → src/routes/relaciones.routes.js
  /api/relaciones/gestiones → src/routes/relacionesGestion.routes.js
  /api/debug        → src/routes/debug.routes.js

Archivos Estáticos:
  / → public/ (express.static)
```

---

## Apéndice: Migraciones

### Migración 001 - Panel de Administración
- **Fecha:** Julio 2026
- **Descripción:** Agrega columnas de seguridad y administración a `usuarios`, crea `audit_log`, asigna usuario `daviddlaa` como superadmin.
- **Archivos:**
  - `migrations/001_add_admin_columns.sql` (PostgreSQL)
  - `migrations/001_add_admin_columns.sqlite.sql` (SQLite)
  - `migrations/001_add_admin_columns.js` (JavaScript)

---

> **Documentación generada para Archivox v1.0.0**
