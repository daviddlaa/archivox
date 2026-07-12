# 🏗️ ARQUITECTURA MULTI-EQUIPO — Documento de Diseño

**Proyecto:** ARCHIVOX v3.0  
**Fase:** 1 — Diseño de Arquitectura  
**Fecha:** 12 de Julio de 2026  
**Precedido por:** FASE 0 — Auditoría Completa del Sistema  
**Autor:** Buffy (AI Agent) — Arquitecto de Software

---

## 📋 ÍNDICE

1. [Resumen Ejecutivo](#1-resumen-ejecutivo)
2. [Principios de Diseño](#2-principios-de-diseño)
3. [Arquitectura Organizacional](#3-arquitectura-organizacional)
4. [Modelo de Datos — Nuevas Tablas](#4-modelo-de-datos)
5. [Modelo de Datos — Modificaciones a Tablas Existentes](#5-modificaciones-a-tablas-existentes)
6. [Sistema de Permisos Escalable](#6-sistema-de-permisos-escalable)
7. [Flujo de Autenticación](#7-flujo-de-autenticación)
8. [Flujo de Campañas Multi-Equipo](#8-flujo-de-campañas-multi-equipo)
9. [Flujo de Asignaciones](#9-flujo-de-asignaciones)
10. [Flujo de Solicitudes](#10-flujo-de-solicitudes)
11. [Estrategia de Migración](#11-estrategia-de-migración)
12. [Compatibilidad con Sistema Actual](#12-compatibilidad)
13. [Diagrama de Arquitectura](#13-diagrama-de-arquitectura)
14. [Glosario](#14-glosario)

---

## 1. RESUMEN EJECUTIVO

### ¿Qué estamos construyendo?

Una **capa organizacional** sobre el sistema existente que permite:

```
ANTES (v2.1):               DESPUÉS (v3.0):
                            ┌─────────────────┐
┌──────────────┐            │   SUPERADMIN     │
│  SUPERADMIN   │            └────────┬────────┘
│     │         │                     │
│  USUARIOS    │            ┌────────┴────────┐
│     │         │            │    EQUIPOS      │
│  SOLICITUDES │            └────────┬────────┘
│     │         │              ┌─────┴─────┐
│  GESTIONES   │            ┌─┴──┐     ┌──┴─┐
└──────────────┘            │LÍDER│     │LÍDER│
                            └──┬──┘     └──┬──┘
                            ┌──┴──┐     ┌──┴──┐
                            │AGENT│     │AGENT│
                            └─────┘     └─────┘
```

### Filosofía: Separación de Conceptos

| Concepto | Qué determina | Dónde se almacena |
|----------|---------------|-------------------|
| **ROL** | Quién es el usuario | `usuarios.rol` (existente) |
| **EQUIPO** | Con quién trabaja | `equipo_usuarios` (NUEVA) |
| **PERMISOS** | Qué puede hacer | `permisos_roles` (NUEVA) |
| **ASIGNACIONES** | Sobre qué solicitudes trabaja | `asignaciones_solicitudes` (NUEVA) |

**Regla de oro:** Nunca mezclar estos cuatro conceptos.

---

## 2. PRINCIPIOS DE DISEÑO

### P1 — Compatibilidad Absoluta
Ningún usuario actual debe perder funcionalidades. Todas las tablas nuevas son adiciones. Las columnas nuevas en tablas existentes tienen valores por defecto.

### P2 — La Solicitud es la Única Fuente de Verdad
Las solicitudes no pertenecen a usuarios ni a equipos. Nunca se duplican. Solo se asignan.

### P3 — Separación de Conceptos
Rol ≠ Equipo ≠ Permisos ≠ Asignaciones. Nunca mezclarlos.

### P4 — Equipo Transitorio "Sistema"
Todos los usuarios actuales se asignan automáticamente al equipo "Sistema" durante la migración.

### P5 — Crecimiento Incremental
Cada fase se completa y documenta antes de avanzar. No se genera deuda técnica.

### P6 — Dual DB Compatible
Toda modificación funciona en PostgreSQL (producción) y SQLite (local).

---

## 3. ARQUITECTURA ORGANIZACIONAL

### 3.1 Estructura Jerárquica

```
                    ┌─────────────────────┐
                    │     SUPERADMIN       │
                    │  (Control total del  │
                    │       sistema)       │
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
    │ AGENTE: Ana       │  │AGENTE: Luis  │   (sin equipo
    └───────────────────┘  └──────────────┘   específico)
```

### 3.2 Roles del Sistema

| Rol | Level | ¿Puede crear? | ¿Puede asignar? | ¿Qué ve? |
|-----|:-----:|---------------|-----------------|----------|
| **superadmin** | 100 | Equipos, Líderes, Admins | Todo | Todo el sistema |
| **admin** | 50 | Usuarios (no admins) | No | Sistema completo (excepto superadmin) |
| **lider** | 30 | Agentes (solo en su equipo) | Solicitudes a sus agentes | Solo su equipo |
| **agente** | 20 | Nada | Nada | Sus campañas, solicitudes, gestiones |
| **user** | 10 | Nada | Nada | Sus propios datos |

### 3.3 Responsabilidades por Rol

#### SUPERADMIN
- Crear equipos
- Crear líderes
- Mover usuarios entre equipos
- Modificar permisos
- Acceder a toda la información
- Gestionar campañas globales

#### ADMIN (existente, sin cambios)
- Panel de administración
- Gestión de usuarios (excepto superadmin)
- Ver estadísticas y auditoría

#### LÍDER (NUEVO)
- Pertenece a un único equipo
- Crea agentes solo dentro de su equipo
- Importa Excel
- Crea campañas (automáticamente asignadas a su equipo)
- Asigna solicitudes a sus agentes
- Reasigna solicitudes entre sus agentes
- Ve dashboard de su equipo
- **No accede a información de otros equipos**

#### AGENTE (evolución de "user")
- Pertenece a un único equipo
- Ve solo sus campañas, solicitudes y gestiones
- Conserva todas las funcionalidades actuales (gestión individual, lote, llamadas, mensajería, historial, seguimiento)

---

## 4. MODELO DE DATOS — NUEVAS TABLAS

### 4.1 Tabla: `equipos`

```sql
CREATE TABLE equipos (
    id              SERIAL PRIMARY KEY,          -- PostgreSQL
    -- id          INTEGER PRIMARY KEY AUTOINCREMENT,  -- SQLite
    nombre          TEXT UNIQUE NOT NULL,
    descripcion     TEXT,
    activo          INTEGER DEFAULT 1,           -- 0 = desactivado (no eliminar)
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

| Columna | Tipo | Descripción |
|---------|------|-------------|
| `id` | SERIAL/INTEGER | Identificador único |
| `nombre` | TEXT UNIQUE | Nombre del equipo (ej: "Ventas", "COB", "Sistema") |
| `descripcion` | TEXT | Descripción opcional |
| `activo` | INTEGER | 1=activo, 0=inactivo (no se eliminan para preservar historial) |
| `created_at` | TIMESTAMP | Fecha de creación |
| `updated_at` | TIMESTAMP | Última modificación |

**Seed inicial:** `INSERT INTO equipos (nombre, descripcion) VALUES ('Sistema', 'Equipo por defecto para migración de usuarios actuales');`

### 4.2 Tabla: `equipo_usuarios`

```sql
CREATE TABLE equipo_usuarios (
    id              SERIAL PRIMARY KEY,
    equipo_id       INTEGER NOT NULL REFERENCES equipos(id),
    usuario_id      INTEGER NOT NULL REFERENCES usuarios(id),
    es_lider        INTEGER DEFAULT 0,           -- 1 = es líder del equipo
    fecha_ingreso   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_salida    TIMESTAMP,                    -- NULL = activo, != NULL = historial
    UNIQUE(equipo_id, usuario_id, fecha_salida)  -- Un usuario en un equipo (activo)
);
```

| Columna | Tipo | Descripción |
|---------|------|-------------|
| `equipo_id` | INTEGER FK→equipos | Equipo al que pertenece |
| `usuario_id` | INTEGER FK→usuarios | Usuario miembro |
| `es_lider` | INTEGER | 1=es líder del equipo, 0=agente |
| `fecha_ingreso` | TIMESTAMP | Cuándo se unió |
| `fecha_salida` | TIMESTAMP | NULL=activo, fecha=historial |

**Restricciones:**
- Un usuario puede pertenecer a un solo equipo activo a la vez (controlado por `fecha_salida IS NULL` + UNIQUE parcial)
- Un equipo puede tener múltiples líderes (opcional, para equipos grandes)
- `fecha_salida` permite mantener historial de membresía

**Índices recomendados:**
```sql
CREATE INDEX IF NOT EXISTS idx_equipo_usuarios_usuario 
ON equipo_usuarios(usuario_id, fecha_salida);

CREATE INDEX IF NOT EXISTS idx_equipo_usuarios_equipo 
ON equipo_usuarios(equipo_id, es_lider);
```

### 4.3 Tabla: `permisos_roles`

```sql
CREATE TABLE permisos_roles (
    id              SERIAL PRIMARY KEY,
    rol             TEXT NOT NULL,               -- 'superadmin', 'admin', 'lider', 'agente', 'user'
    permiso         TEXT NOT NULL,               -- 'campañas:crear', 'importar:excel', etc.
    UNIQUE(rol, permiso)
);
```

| Columna | Tipo | Descripción |
|---------|------|-------------|
| `rol` | TEXT | Nombre del rol |
| `permiso` | TEXT | Identificador del permiso |

**Seed inicial — Permisos por rol:**

```sql
-- SUPERADMIN (todos los permisos implícitamente)
-- No necesita registros en permisos_roles (el código les da todo)

-- LÍDER
INSERT INTO permisos_roles (rol, permiso) VALUES
    ('lider', 'equipo:ver'),
    ('lider', 'equipo:gestionar'),
    ('lider', 'agentes:crear'),
    ('lider', 'agentes:ver'),
    ('lider', 'campañas:crear'),
    ('lider', 'campañas:ver'),
    ('lider', 'campañas:gestionar'),
    ('lider', 'solicitudes:importar'),
    ('lider', 'solicitudes:asignar'),
    ('lider', 'solicitudes:reasignar'),
    ('lider', 'solicitudes:ver-equipo'),
    ('lider', 'gestiones:ver-equipo'),
    ('lider', 'dashboard:ver-equipo');

-- AGENTE
INSERT INTO permisos_roles (rol, permiso) VALUES
    ('agente', 'campañas:ver-propias'),
    ('agente', 'solicitudes:ver-asignadas'),
    ('agente', 'solicitudes:gestionar'),
    ('agente', 'gestiones:crear'),
    ('agente', 'gestiones:ver-propias'),
    ('agente', 'historial:ver-propio');

-- USER (existente, funcionalidad actual)
INSERT INTO permisos_roles (rol, permiso) VALUES
    ('user', 'solicitudes:importar'),
    ('user', 'solicitudes:gestionar'),
    ('user', 'campañas:crear'),
    ('user', 'campañas:gestionar'),
    ('user', 'gestiones:crear'),
    ('user', 'gestiones:ver-propias'),
    ('user', 'relaciones:gestionar'),
    ('user', 'ventas:gestionar'),
    ('user', 'historial:ver-propio');
```

**Sistema de permisos en código:** Se agrega una función `tienePermisoPorRol(rol, permisoRequerido)` que:
1. Si el rol es `superadmin`, devuelve `true` siempre
2. Si el rol es `admin`, verifica permisos hardcodeados (como ahora) + consulta BD
3. Para `lider`, `agente`, `user`: consulta `permisos_roles`

### 4.4 Tabla: `permisos_equipo`

```sql
CREATE TABLE permisos_equipo (
    id              SERIAL PRIMARY KEY,
    equipo_id       INTEGER NOT NULL REFERENCES equipos(id),
    permiso         TEXT NOT NULL,               -- Misma nomenclatura que permisos_roles
    UNIQUE(equipo_id, permiso)
);
```

| Columna | Tipo | Descripción |
|---------|------|-------------|
| `equipo_id` | INTEGER FK→equipos | Equipo |
| `permiso` | TEXT | Permiso extra concedido |

**Propósito:** Permite que un SUPERADMIN conceda permisos especiales a un equipo completo (ej: "Este equipo puede importar Excel aunque su rol base no lo permita").

### 4.5 Tabla: `asignaciones_solicitudes`

```sql
CREATE TABLE asignaciones_solicitudes (
    id              SERIAL PRIMARY KEY,
    solicitud_id    INTEGER NOT NULL,            -- FK lógica → solicitudes.id_solicitud
    equipo_id       INTEGER NOT NULL REFERENCES equipos(id),
    usuario_id      INTEGER REFERENCES usuarios(id),  -- NULL = asignada al equipo, sin agente específico
    asignado_por    INTEGER NOT NULL REFERENCES usuarios(id),
    fecha_asignacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_desasignacion TIMESTAMP,               -- NULL = activa
    motivo_desasignacion TEXT,
    UNIQUE(solicitud_id, equipo_id, fecha_desasignacion)
);
```

| Columna | Tipo | Descripción |
|---------|------|-------------|
| `solicitud_id` | INTEGER | ID de la solicitud (no es FK formal, es lógica) |
| `equipo_id` | INTEGER FK→equipos | Equipo asignado |
| `usuario_id` | INTEGER FK→usuarios | Agente específico (NULL = sin agente) |
| `asignado_por` | INTEGER FK→usuarios | Quién asignó |
| `fecha_asignacion` | TIMESTAMP | Cuándo se asignó |
| `fecha_desasignacion` | TIMESTAMP | NULL=activa, fecha=desasignada |
| `motivo_desasignacion` | TEXT | Por qué se desasignó |

**Restricciones:**
- Una solicitud puede estar asignada a un solo equipo activo a la vez
- Puede tener un agente específico o estar asignada al equipo general
- `fecha_desasignacion` preserva historial de asignaciones

**Índices recomendados:**
```sql
CREATE INDEX IF NOT EXISTS idx_asignaciones_solicitud 
ON asignaciones_solicitudes(solicitud_id, fecha_desasignacion);

CREATE INDEX IF NOT EXISTS idx_asignaciones_usuario 
ON asignaciones_solicitudes(usuario_id, fecha_desasignacion);

CREATE INDEX IF NOT EXISTS idx_asignaciones_equipo 
ON asignaciones_solicitudes(equipo_id, fecha_desasignacion);
```

### 4.6 Tabla: `campañas_equipo`

```sql
CREATE TABLE campañas_equipo (
    id              SERIAL PRIMARY KEY,
    campaña_id      INTEGER NOT NULL,            -- FK → gestiones_maestro.id
    equipo_id       INTEGER NOT NULL REFERENCES equipos(id),
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(campaña_id, equipo_id)
);
```

| Columna | Tipo | Descripción |
|---------|------|-------------|
| `campaña_id` | INTEGER | ID de la campaña (gestión maestro) |
| `equipo_id` | INTEGER FK→equipos | Equipo dueño de la campaña |

---

## 5. MODIFICACIONES A TABLAS EXISTENTES

### 5.1 Tabla: `usuarios` — Sin cambios estructurales

La tabla `usuarios` **NO se modifica**. Sin nuevas columnas.

La relación usuario↔equipo se maneja mediante `equipo_usuarios`.
El rol del usuario se mantiene en `usuarios.rol`.

**Nuevos valores de `usuarios.rol`:**
- `'superadmin'` (existente)
- `'admin'` (existente)
- `'lider'` (NUEVO)
- `'agente'` (NUEVO — evoluciona el concepto de `'user'`)
- `'user'` (existente, para compatibilidad)

### 5.2 Tabla: `solicitudes` — Sin cambios

Las solicitudes no se modifican. No se agrega `equipo_id`.

Las asignaciones se gestionan mediante `asignaciones_solicitudes`.

### 5.3 Tabla: `gestiones_maestro` (campañas) — Columna opcional

```sql
ALTER TABLE gestiones_maestro ADD COLUMN equipo_id INTEGER REFERENCES equipos(id);
```

`equipo_id` es NULLable. Si es NULL, la campaña es global (comportamiento actual).

### 5.4 Tabla: `gestiones` — Sin cambios

Las gestiones siguen vinculadas a `solicitud_id` y `usuario_id`. No se modifica.

---

## 6. SISTEMA DE PERMISOS ESCALABLE

### 6.1 Arquitectura

```
                  ┌─────────────────────────────┐
                  │    VERIFICACIÓN DE PERMISOS   │
                  │                               │
                  │  1. ¿Es SUPERADMIN? → ✅ Todo │
                  │                               │
                  │  2. Buscar en permisos_roles  │
                  │     para el rol del usuario   │
                  │                               │
                  │  3. Buscar en permisos_equipo │
                  │     para el equipo del user  │
                  │                               │
                  │  4. Combinar resultados       │
                  │     (OR lógico)               │
                  └─────────────────────────────┘
```

### 6.2 Nomenclatura de Permisos

```
<recurso>:<acción>

Recursos:
  equipo          → Gestión del equipo
  agentes         → Gestión de agentes
  campañas        → Campañas (gestión por lotes)
  solicitudes     → Solicitudes/importaciones
  gestiones       → Gestiones/operaciones
  dashboard       → Dashboard y estadísticas
  relaciones      → Módulo de relaciones
  ventas          → Control de ventas
  historial       → Historial de actualizaciones
  usuarios        → Gestión de usuarios (admin+)
  sistema         → Configuración del sistema
  auditoria       → Logs de auditoría

Acciones:
  *              → Todas las acciones
  crear          → Crear nuevo
  ver            → Ver/leer
  ver-propias    → Ver solo las propias
  ver-equipo     → Ver las del equipo
  gestionar      → Modificar/editar
  asignar        → Asignar recursos
  reasignar      → Reasignar recursos
  importar       → Importar Excel
  eliminar       → Eliminar
```

### 6.3 Función de verificación (`src/config/permissions.js` — EXTENDIDA)

```javascript
// NUEVA: Verificar permiso en BD (para roles dinámicos como lider y agente)
async function tienePermisoBD(rol, permisoRequerido) {
    // superadmin siempre tiene todo
    if (rol === 'superadmin') return true;
    
    // admin tiene permisos hardcodeados + BD
    if (rol === 'admin') {
        // Verificar hardcodeados (existente)
        if (tienePermiso(rol, permisoRequerido)) return true;
    }
    
    // Consultar BD
    const result = await pool.query(
        'SELECT 1 FROM permisos_roles WHERE rol = $1 AND permiso = $2 LIMIT 1',
        [rol, permisoRequerido]
    );
    return result.rows.length > 0;
}

// NUEVA: Verificar permiso de equipo
async function tienePermisoEquipo(equipoId, permisoRequerido) {
    const result = await pool.query(
        'SELECT 1 FROM permisos_equipo WHERE equipo_id = $1 AND permiso = $2 LIMIT 1',
        [equipoId, permisoRequerido]
    );
    return result.rows.length > 0;
}
```

### 6.4 Middleware de permisos (EXTENDIDO)

```javascript
// NUEVO: Middleware requiresPermissionAsync para permisos en BD
function requiresPermissionAsync(permiso) {
    return async (req, res, next) => {
        if (!req.session?.usuario) {
            return res.status(401).json({ error: 'No autenticado' });
        }
        
        const userRole = req.session.usuario.rol;
        
        // Verificar en BD (async)
        const tiene = await tienePermisoBD(userRole, permiso);
        if (tiene) return next();
        
        return res.status(403).json({
            error: 'Acceso denegado: permiso insuficiente',
            permiso_requerido: permiso,
            tu_rol: userRole
        });
    };
}
```

---

## 7. FLUJO DE AUTENTICACIÓN

### 7.1 Flujo Actual (sin cambios)

```
POST /api/auth/login → Verificar credenciales → Crear sesión
GET /api/auth/sesion → Devolver usuario
```

### 7.2 Flujo Extendido (cambios en sesión)

La sesión del usuario ahora incluye información de equipo:

```javascript
// En login exitoso:
req.session.usuario = {
    id: usuario.id,
    username: usuario.username,
    nombre: usuario.nombre,
    email: usuario.email,
    rol: usuario.rol,
    is_superadmin: usuario.is_superadmin,
    equipo_id: usuarioEquipo?.equipo_id || null,     // NUEVO
    equipo_nombre: usuarioEquipo?.nombre || null,     // NUEVO
    es_lider: usuarioEquipo?.es_lider || false        // NUEVO
};
```

### 7.3 Endpoints NUEVOS

| Método | Ruta | Propósito | Protección |
|--------|------|-----------|:----------:|
| GET | `/api/equipos` | Listar equipos (admin+) | requiresRole('admin', 'superadmin') |
| POST | `/api/equipos` | Crear equipo | requiresRole('superadmin') |
| GET | `/api/equipos/:id` | Ver equipo con miembros | requiresPermission('equipo:ver') |
| PUT | `/api/equipos/:id` | Actualizar equipo | requiresRole('superadmin') |
| POST | `/api/equipos/:id/agentes` | Crear agente en equipo | requiresPermission('agentes:crear') |
| POST | `/api/equipos/:id/asignar` | Asignar solicitud | requiresPermission('solicitudes:asignar') |
| GET | `/api/equipos/:id/estadisticas` | Dashboard del equipo | requiresPermission('dashboard:ver-equipo') |
| GET | `/api/mi-equipo` | Info del equipo del usuario autenticado | requiresAuth |

---

## 8. FLUJO DE CAMPAÑAS MULTI-EQUIPO

### 8.1 Flujo Actual (v2.1)

```
1. Usuario (rol 'user') importa Excel → solicitudes
2. Usuario crea campaña (gestiones_maestro) con solicitudes_ids
3. Usuario gestiona las solicitudes de su campaña
4. Las gestiones se registran en tabla gestiones
```

### 8.2 Flujo Multi-Equipo (v3.0)

```
1. LÍDER importa Excel → solicitudes (asignadas automáticamente a su equipo o al sistema)
2. LÍDER crea CAMPAÑA → asociada a su equipo (equipo_id en gestiones_maestro)
3. LÍDER asigna solicitudes de la campaña a sus AGENTES
4. AGENTE ve solo las campañas de su equipo
5. AGENTE gestiona las solicitudes que le fueron asignadas
6. LÍDER ve el progreso de TODO su equipo
7. SUPERADMIN ve TODAS las campañas de TODOS los equipos
```

### 8.3 Reglas de Visibilidad de Campañas

| Rol | ¿Qué campañas ve? |
|-----|-------------------|
| **superadmin** | Todas (equipo_id IS NULL OR equipo_id = cualquier) |
| **admin** | Todas |
| **lider** | Solo las de su equipo (equipo_id = su equipo) |
| **agente** | Solo las de su equipo donde tiene solicitudes asignadas |
| **user** | Solo las suyas (equipo_id IS NULL, comportamiento actual) |

### 8.4 Consulta de Campañas (EXTENDIDA)

```javascript
// Para LIDER: solo su equipo
async function getGestionesMaestro(req, res) {
    const usuario = req.session.usuario;
    
    let sql = 'SELECT * FROM gestiones_maestro WHERE 1=1';
    const params = [];
    
    if (usuario.rol === 'lider') {
        sql += ' AND equipo_id = $1';
        params.push(usuario.equipo_id);
    } else if (usuario.rol === 'agente') {
        // Ver campañas del equipo donde tiene solicitudes asignadas
        sql += ` AND equipo_id = $1 AND id IN (
            SELECT gestion_maestro_id FROM asignaciones_solicitudes 
            WHERE usuario_id = $2 AND fecha_desasignacion IS NULL
        )`;
        params.push(usuario.equipo_id, usuario.id);
    }
    
    sql += ' ORDER BY created_at DESC';
    const result = await pool.query(sql, params);
    res.json(result.rows);
}
```

---

## 9. FLUJO DE ASIGNACIONES

### 9.1 Ciclo de Vida de una Asignación

```
1. LÍDER importa Excel o crea solicitud manual
       │
       ▼
2. Solicitud existe en el sistema (sin dueño original)
       │
       ▼
3. LÍDER asigna solicitud a un AGENTE de su equipo
       │
       ├── INSERT INTO asignaciones_solicitudes (solicitud_id, equipo_id, usuario_id, asignado_por)
       │
       ▼
4. AGENTE ve la solicitud en su listado
       │
       ▼
5. AGENTE realiza gestiones sobre la solicitud
       │
       ▼
6. (Opcional) LÍDER reasigna a otro agente
       │
       ├── UPDATE asignaciones SET fecha_desasignacion = NOW()
       ├── INSERT INTO asignaciones (nueva asignación)
       │
       ▼
7. (Opcional) LÍDER desasigna (solicitud vuelve al pool del equipo)
       │
       ├── UPDATE asignaciones SET fecha_desasignacion = NOW()
```

### 9.2 Asignación por Campaña

El LÍDER puede:
1. Crear una campaña
2. Agregar solicitudes a la campaña (existente)
3. Asignar TODA la campaña a un agente (asignación masiva)
4. Asignar solicitudes individuales dentro de la campaña

### 9.3 Visualización de Solicitudes (Agente)

```sql
-- Query para AGENTE: solo solicitudes asignadas a él
SELECT s.*, a.fecha_asignacion, eu.equipo_id
FROM solicitudes s
INNER JOIN asignaciones_solicitudes a ON s.id_solicitud = a.solicitud_id
WHERE a.usuario_id = $1          -- El ID del agente
  AND a.fecha_desasignacion IS NULL   -- Asignación activa
ORDER BY a.fecha_asignacion DESC;
```

### 9.4 Visualización de Solicitudes (Líder)

```sql
-- Query para LÍDER: solicitudes asignadas a cualquier agente de su equipo
SELECT s.*, a.usuario_id as agente_id, u.nombre as agente_nombre,
       a.fecha_asignacion
FROM solicitudes s
INNER JOIN asignaciones_solicitudes a ON s.id_solicitud = a.solicitud_id
INNER JOIN usuarios u ON a.usuario_id = u.id
WHERE a.equipo_id = $1            -- El equipo del líder
  AND a.fecha_desasignacion IS NULL
ORDER BY a.fecha_asignacion DESC;
```

---

## 10. FLUJO DE SOLICITUDES

### 10.1 Principio Fundamental

**Las solicitudes son propiedad del Sistema.** Nunca pertenecen a un usuario, líder o equipo.

```
SOLICITUDES (tabla) — Fuente de verdad
       │
       ├── ASIGNADAS A (asignaciones_solicitudes) — Solo la asignación
       │       ├── Equipo X
       │       └── Agente Y (opcional)
       │
       └── GESTIONADAS POR (gestiones) — Solo registro de actividad
               └── usuario_id = quien gestionó
```

### 10.2 Reglas de Consulta

| Rol | Criterio de visibilidad |
|-----|------------------------|
| **superadmin** | Todas las solicitudes (sin filtro) |
| **admin** | Todas las solicitudes |
| **lider** | Solicitudes pertenecientes a asignaciones de su equipo |
| **agente** | Solicitudes asignadas a él (activas) |
| **user** | Solicitudes con `usuario_id = su ID` (comportamiento actual) |

### 10.3 Importación de Excel (Líder)

Cuando un LÍDER importa un Excel:
1. Las solicitudes se insertan en `solicitudes` (como siempre)
2. Se asignan automáticamente al equipo del líder
3. Quedan sin agente específico (el líder las distribuye después)

```javascript
// Después de importar Excel:
const result = await pool.query(
    `INSERT INTO asignaciones_solicitudes 
     (solicitud_id, equipo_id, asignado_por)
     SELECT id_solicitud, $1, $2 FROM solicitudes 
     WHERE usuario_id = $2 
       AND fecha_importacion >= $3
       AND id_solicitud NOT IN (
         SELECT solicitud_id FROM asignaciones_solicitudes 
         WHERE fecha_desasignacion IS NULL
       )`,
    [equipoId, usuarioId, fechaInicioImportacion]
);
```

---

## 11. ESTRATEGIA DE MIGRACIÓN

### 11.1 Principios

1. **Nunca dejar usuarios huérfanos** — todo usuario debe tener un equipo
2. **Nunca perder datos** — las asignaciones históricas se preservan
3. **Cero downtime** — el sistema sigue funcionando durante la migración
4. **Rollback disponible** — cada migración tiene su reversión

### 11.2 Fase 3 — Migraciones

**Migración 01: Crear tablas de equipos**

```sql
-- PostgreSQL
CREATE TABLE IF NOT EXISTS equipos (...);
CREATE TABLE IF NOT EXISTS equipo_usuarios (...);
CREATE TABLE IF NOT EXISTS permisos_roles (...);
CREATE TABLE IF NOT EXISTS permisos_equipo (...);
CREATE TABLE IF NOT EXISTS asignaciones_solicitudes (...);
CREATE TABLE IF NOT EXISTS campañas_equipo (...);
```

```sql
-- Rollback 01
DROP TABLE IF EXISTS campañas_equipo;
DROP TABLE IF EXISTS asignaciones_solicitudes;
DROP TABLE IF EXISTS permisos_equipo;
DROP TABLE IF EXISTS permisos_roles;
DROP TABLE IF EXISTS equipo_usuarios;
DROP TABLE IF EXISTS equipos;
```

**Migración 02: Seed de datos**

```sql
-- Crear equipo "Sistema"
INSERT INTO equipos (nombre, descripcion) 
VALUES ('Sistema', 'Equipo por defecto del sistema');

-- Asignar SUPERADMIN al equipo Sistema
INSERT INTO equipo_usuarios (equipo_id, usuario_id, es_lider)
SELECT e.id, u.id, 1
FROM equipos e, usuarios u
WHERE e.nombre = 'Sistema' AND u.is_superadmin = 1;

-- Asignar ADMIN al equipo Sistema
INSERT INTO equipo_usuarios (equipo_id, usuario_id, es_lider)
SELECT e.id, u.id, 0
FROM equipos e, usuarios u
WHERE e.nombre = 'Sistema' AND u.rol = 'admin' AND u.is_superadmin = 0;

-- Asignar todos los demás usuarios al equipo Sistema
INSERT INTO equipo_usuarios (equipo_id, usuario_id)
SELECT e.id, u.id
FROM equipos e, usuarios u
WHERE e.nombre = 'Sistema' 
  AND u.rol NOT IN ('admin', 'superadmin')
  AND u.id NOT IN (
    SELECT usuario_id FROM equipo_usuarios WHERE fecha_salida IS NULL
  );

-- Insertar permisos de roles
INSERT INTO permisos_roles (rol, permiso) VALUES
    ('lider', 'equipo:ver'),
    ('lider', 'agentes:crear'),
    ('lider', 'campañas:crear'),
    ('lider', 'solicitudes:asignar'),
    ('lider', 'solicitudes:importar'),
    ('lider', 'dashboard:ver-equipo'),
    ('agente', 'solicitudes:ver-asignadas'),
    ('agente', 'solicitudes:gestionar'),
    ('agente', 'gestiones:crear');
```

```sql
-- Rollback 02
DELETE FROM permisos_roles;
DELETE FROM equipo_usuarios WHERE equipo_id IN (SELECT id FROM equipos WHERE nombre = 'Sistema');
DELETE FROM equipos WHERE nombre = 'Sistema';
```

**Migración 03: Agregar columna equipo_id a gestiones_maestro**

```sql
ALTER TABLE gestiones_maestro ADD COLUMN equipo_id INTEGER REFERENCES equipos(id);
```

```sql
-- Rollback 03
ALTER TABLE gestiones_maestro DROP COLUMN equipo_id;
```

### 11.3 Migración de Usuarios Actuales

```
ESTADO INICIAL:
┌──────────┐    ┌──────────┐
│  usuario 1 │    │  usuario 2 │    ... (usuarios sin equipo)
└──────────┘    └──────────┘

MIGRACIÓN:
     │
     ▼
┌────────────────────────────────────────────┐
│           EQUIPO "SISTEMA"                   │
│                                              │
│  SUPERADMIN (líder) → daviddlaa              │
│  ADMIN → admin1                              │
│  USER → user1, user2, user3, ...            │
└────────────────────────────────────────────┘

POST-MIGRACIÓN (cuando el SUPERADMIN quiera):
     │
     ▼
┌─────────────────┐    ┌─────────────────┐
│ EQUIPO "VENTAS"  │    │ EQUIPO "COB"     │
│                  │    │                  │
│ LÍDER: líder1    │    │ LÍDER: líder2    │
│ AGENTE: agente1  │    │ AGENTE: agente3  │
│ AGENTE: agente2  │    └─────────────────┘
└─────────────────┘
```

### 11.4 Compatibilidad con Usuarios Legacy (`rol = 'user'`)

Los usuarios con `rol = 'user'` (comportamiento actual) **no se ven afectados**. Su flujo de trabajo sigue siendo idéntico:

1. Siguen viendo SOLO sus solicitudes (filtro por `usuario_id`)
2. Siguen creando campañas (sin `equipo_id` = NULL)
3. Siguen importando Excel
4. No ven cambios en la UI

La única diferencia es que ahora también pertenecen a un equipo (el equipo "Sistema"), lo que permite al SUPERADMIN moverlos a otros equipos en el futuro.

---

## 12. COMPATIBILIDAD CON SISTEMA ACTUAL

### 12.1 Matriz de Compatibilidad

| Componente | ¿Se rompe? | Explicación |
|------------|:----------:|-------------|
| **Desktop** (`public/desktop/`) | ❌ NO | Sin cambios en HTML/CSS/JS actual |
| **Mobile** (`public/movil/`) | ❌ NO | Sin cambios en HTML/CSS/JS actual |
| **Admin** (`public/admin/`) | ❌ NO | Se agregan secciones de equipos, pero nada se elimina |
| **Login** (`public/*/login.html`) | ❌ NO | Sin cambios |
| **Campañas** (`gestiones_maestro`) | ❌ NO | Columna `equipo_id` nullable = NULL = comportamiento actual |
| **Gestiones** (`gestiones`) | ❌ NO | Sin cambios en tabla |
| **Solicitudes** (`solicitudes`) | ❌ NO | Sin cambios en tabla |
| **Notificaciones** | ❌ NO | Sin cambios |
| **SSE** | ❌ NO | Sin cambios |
| **PostgreSQL** | ❌ NO | Migraciones ADD TABLE/COLUMN, no modifican existentes |
| **SQLite** | ❌ NO | Mismas migraciones, sintaxis compatible |

### 12.2 Garantías

1. **Ningún endpoint actual cambia su firma**
2. **Ninguna tabla actual se modifica** (solo se agregan nuevas)
3. **Solo 1 columna nueva** en tabla existente (`gestiones_maestro.equipo_id` nullable)
4. **Los usuarios `rol = 'user'`** siguen funcionando exactamente igual
5. **Las campañas sin equipo** siguen siendo visibles globalmente

---

## 13. DIAGRAMA DE ARQUITECTURA

### 13.1 Diagrama de Entidad-Relación

```
                    ┌──────────────┐
                    │   equipos     │
                    ├──────────────┤
                    │ id (PK)      │──┐
                    │ nombre       │  │
                    │ descripcion  │  │
                    │ activo       │  │
                    └──────────────┘  │
                         │            │
                         │ 1         N│
                         ▼            ▼
              ┌─────────────────┐  ┌──────────────────────┐
              │ equipo_usuarios  │  │  permisos_equipo     │
              ├─────────────────┤  ├──────────────────────┤
              │ id (PK)         │  │ id (PK)              │
              │ equipo_id (FK)  │  │ equipo_id (FK)       │
              │ usuario_id (FK) │  │ permiso              │
              │ es_lider        │  └──────────────────────┘
              │ fecha_ingreso   │
              │ fecha_salida    │
              └────────┬────────┘
                       │ N
                       │
              ┌────────┴────────┐
              │   usuarios      │
              ├─────────────────┤
              │ id (PK)         │──┐
              │ username        │  │
              │ password        │  │
              │ rol             │  │  ┌──────────────────────┐
              │ ...             │  │  │  permisos_roles      │
              └─────────────────┘  │  ├──────────────────────┤
                                   │  │ id (PK)              │
                                   │  │ rol                  │
                                   │  │ permiso              │
                                   │  └──────────────────────┘
                                   │
              ┌────────────────────┘
              │
              ▼
┌──────────────────────────┐
│  asignaciones_solicitudes │
├──────────────────────────┤
│ id (PK)                  │
│ solicitud_id             │──→ solicitudes (lógica, no FK)
│ equipo_id (FK)           │
│ usuario_id (FK)          │
│ asignado_por (FK)        │
│ fecha_asignacion         │
│ fecha_desasignacion      │
└──────────────────────────┘

┌──────────────────────┐
│ campañas_equipo       │
├──────────────────────┤
│ id (PK)              │
│ campaña_id           │──→ gestiones_maestro
│ equipo_id (FK)       │
└──────────────────────┘

┌──────────────────────┐
│ gestiones_maestro     │ (MODIFICADA)
├──────────────────────┤
│ ... (existente)      │
│ + equipo_id (NUEVO)  │──→ equipos
└──────────────────────┘
```

### 13.2 Diagrama de Flujo de Permisos

```
                ┌─────────────────────────┐
                │   Petición del usuario   │
                └───────────┬─────────────┘
                            │
                ┌───────────▼─────────────┐
                │  Middleware: requiresAuth│
                │  ¿Hay sesión?            │
                └───────────┬─────────────┘
                            │
               ┌────────────┴────────────┐
               │                         │
           NO (401)                  SÍ (continúa)
               │                         │
               ▼                         ▼
        ┌──────────────┐      ┌───────────▼──────────┐
        │ Redirigir /  │      │ ¿Requiere permiso     │
        │ login (HTML) │      │ específico?           │
        │ o 401 (API)  │      └───────────┬──────────┘
        └──────────────┘                  │
                                   ┌──────┴──────┐
                                   │             │
                               NO (pasa)    SÍ (verificar)
                                               │
                                    ┌──────────▼──────────┐
                                    │ ¿Usuario es          │
                                    │ SUPERADMIN?          │
                                    └──────────┬──────────┘
                                               │
                                   ┌────────────┴──────────┐
                                   │                       │
                                SÍ (✅ pasa)          NO (consulta)
                                                       │
                                              ┌────────▼────────┐
                                              │ Buscar en        │
                                              │ permisos_roles   │
                                              │ (según su rol)   │
                                              └────────┬────────┘
                                                       │
                                              ┌────────┴────────┐
                                              │ Buscar en        │
                                              │ permisos_equipo  │
                                              │ (según su equipo)│
                                              └────────┬────────┘
                                                       │
                                              ┌────────┴────────┐
                                              │ ¿Tiene permiso?  │
                                              └────────┬────────┘
                                                       │
                                          ┌────────────┴──────────┐
                                          │                       │
                                      SÍ (✅ pasa)          NO (403)
```

### 13.3 Diagrama de Flujo de Asignaciones

```
                LÍDER
                  │
                  ▼
    ┌─────────────────────────────┐
    │ Importa Excel / Crear       │
    │ solicitud manual            │
    └─────────────┬───────────────┘
                  │
                  ▼
    ┌─────────────────────────────┐
    │ Solicitud INSERT en DB      │
    │ (usuario_id = líder)        │
    └─────────────┬───────────────┘
                  │
                  ▼
    ┌─────────────────────────────┐
    │ Asignación automática       │
    │ al equipo del líder         │
    │ (sin agente específico)     │
    └─────────────┬───────────────┘
                  │
        ┌─────────┴─────────┐
        │                   │
        ▼                   ▼
┌───────────────┐   ┌───────────────┐
│ LÍDER asigna  │   │ LÍDER crea    │
│ directamente  │   │ campaña con   │
│ a un agente   │   │ solicitudes   │
└───────┬───────┘   └───────┬───────┘
        │                   │
        ▼                   ▼
┌───────────────┐   ┌───────────────┐
│ INSERT INTO   │   │ LÍDER asigna  │
│ asignaciones  │   │ campaña a     │
│ (solicitud,   │   │ agente(s)     │
│  agente)      │   └───────┬───────┘
└───────┬───────┘           │
        │                   ▼
        │           ┌───────────────┐
        │           │ INSERT INTO   │
        │           │ asignaciones  │
        │           │ (masivo)      │
        │           └───────┬───────┘
        │                   │
        └─────────┬─────────┘
                  │
                  ▼
    ┌─────────────────────────────┐
    │ AGENTE ve solicitud en su   │
    │ listado "Mis asignaciones" │
    └─────────────────────────────┘
                  │
                  ▼
    ┌─────────────────────────────┐
    │ AGENTE realiza gestiones    │
    │ (insert en tabla gestiones) │
    └─────────────────────────────┘
                  │
                  ▼
    ┌─────────────────────────────┐
    │ LÍDER monitorea progreso    │
    │ desde dashboard del equipo  │
    └─────────────────────────────┘
```

---

## 14. GLOSARIO

| Término | Definición |
|---------|-----------|
| **Equipo** | Unidad organizacional con uno o más líderes y agentes |
| **Líder** | Usuario con permisos para gestionar un equipo y asignar trabajo |
| **Agente** | Usuario operativo que recibe asignaciones y realiza gestiones |
| **Asignación** | Vínculo entre una solicitud y un usuario/equipo para su gestión |
| **Campaña** | Gestión por lotes (gestiones_maestro) — conjunto de solicitudes a gestionar |
| **Solicitud** | Fuente de verdad del sistema — registro único que no pertenece a nadie |
| **Permiso** | Acción específica que un rol puede realizar (ej: `solicitudes:asignar`) |
| **Rol** | Categoría del usuario que determina sus permisos base |
| **Equipo "Sistema"** | Equipo por defecto creado durante la migración para usuarios legacy |

---

## RESUMEN DE CAMBIOS PROPUESTOS

| # | Cambio | Tipo | Archivos afectados |
|---|--------|:----:|--------------------|
| 1 | Nueva tabla `equipos` | 🗄️ BD | `initDb.pg.js`, `initDb.js` |
| 2 | Nueva tabla `equipo_usuarios` | 🗄️ BD | `initDb.pg.js`, `initDb.js` |
| 3 | Nueva tabla `permisos_roles` | 🗄️ BD | `initDb.pg.js`, `initDb.js` |
| 4 | Nueva tabla `permisos_equipo` | 🗄️ BD | `initDb.pg.js`, `initDb.js` |
| 5 | Nueva tabla `asignaciones_solicitudes` | 🗄️ BD | `initDb.pg.js`, `initDb.js` |
| 6 | Nueva tabla `campañas_equipo` | 🗄️ BD | `initDb.pg.js`, `initDb.js` |
| 7 | Columna `equipo_id` en `gestiones_maestro` | 🗄️ BD | `initDb.pg.js`, `initDb.js` |
| 8 | Seed "Equipo Sistema" + permisos iniciales | 📦 BD | Migración 02 |
| 9 | Actualizar `permissions.js` | 🔧 Backend | `src/config/permissions.js` |
| 10 | Actualizar `auth.middleware.js` | 🔧 Backend | `src/middleware/auth.middleware.js` |
| 11 | Nuevo controlador `equipos.controller.js` | 🔧 Backend | `src/controllers/` |
| 12 | Nuevas rutas `/api/equipos` | 🔧 Backend | `src/routes/` |
| 13 | Modificar `gestionesMaestro.controller.js` | 🔧 Backend | Filtrar por equipo |
| 14 | Modificar `excel.controller.js` | 🔧 Backend | Asignación automática post-import |
| 15 | Modificar `dashboard.controller.js` | 🔧 Backend | Dashboard por equipo |
| 16 | Nuevo Panel de Líder | 🎨 Frontend | `public/lider/` |
| 17 | Sección Equipos en Panel Admin | 🎨 Frontend | `public/admin/` |
| 18 | Filtros por equipo en vistas existentes | 🎨 Frontend | `public/desktop/`, `public/movil/` |

---

*Documento generado por Buffy (AI Agent) — 12 de Julio de 2026*
*Proyecto: ARCHIVOX v3.0 — Evolución a Plataforma Multi-Equipo*
*Siguiente fase: FASE 2 — Diseño detallado del modelo de datos con diagramas y especificaciones completas*
