# 🗄️ MODELO DE DATOS MULTI-EQUIPO — Especificación Completa

**Proyecto:** ARCHIVOX v3.0  
**Fase:** 2 — Diseño del Modelo de Datos  
**Fecha:** 12 de Julio de 2026  
**Precedido por:** FASE 1 — Diseño de Arquitectura  
**Autor:** Buffy (AI Agent) — Arquitecto de Software / DBA

---

## 📋 ÍNDICE

1. [Resumen de Cambios](#1-resumen-de-cambios)
2. [Nueva Tabla: equipos](#2-tabla-equipos)
3. [Nueva Tabla: equipo_usuarios](#3-tabla-equipo_usuarios)
4. [Nueva Tabla: permisos_roles](#4-tabla-permisos_roles)
5. [Nueva Tabla: permisos_equipo](#5-tabla-permisos_equipo)
6. [Nueva Tabla: asignaciones_solicitudes](#6-tabla-asignaciones_solicitudes)
7. [Nueva Tabla: campañas_equipo](#7-tabla-campañas_equipo)
8. [Modificación: gestiones_maestro.equipo_id](#8-modificación-gestiones_maestro)
9. [Diagrama Entidad-Relación](#9-diagrama-entidad-relación)
10. [Seed Data y Permisos Iniciales](#10-seed-data)
11. [Índices — Resumen Completo](#11-índices)
12. [Migraciones — Especificación SQL](#12-migraciones-sql)

---

## 1. RESUMEN DE CAMBIOS

### 1.1 Tablas Nuevas

| # | Tabla | Propósito | Filas esperadas |
|---|-------|-----------|:---------------:|
| 1 | `equipos` | Catálogo de equipos organizacionales | ~5-20 |
| 2 | `equipo_usuarios` | Membresía de usuarios en equipos | ~100-200 |
| 3 | `permisos_roles` | Permisos asignados a cada rol | ~30-50 |
| 4 | `permisos_equipo` | Permisos extra asignados a equipos | ~0-10 |
| 5 | `asignaciones_solicitudes` | Asignaciones de solicitudes a usuarios/equipos | ~10K-100K |
| 6 | `campañas_equipo` | Asociación campaña ↔ equipo | ~50-200 |

### 1.2 Modificaciones a Tablas Existentes

| Tabla | Cambio | Tipo | Default |
|-------|--------|:----:|:-------:|
| `gestiones_maestro` | + `equipo_id` (INTEGER, nullable) | 🟢 Aditiva | `NULL` = comportamiento actual |

### 1.3 Tablas que NO se modifican

| Tabla | Razón |
|-------|-------|
| `usuarios` | La relación usuario↔equipo va en `equipo_usuarios` |
| `solicitudes` | **Son la fuente de verdad**. No pertenecen a nadie |
| `gestiones` | Ya registran `usuario_id` que gestionó |
| `relaciones` | Módulo independiente, sin cambios |
| `notificaciones` | Sistema global, no se segmenta por equipos |
| `audit_log` | Log global del sistema |
| `ventas_vendedores` | Módulo independiente |
| `config_bonos` | Módulo independiente |
| `historial_actualizaciones` | Ya registra `usuario_id` |
| `solicitudes_referencias` | No requiere cambios |

---

## 2. TABLA: `equipos`

### 2.1 Propósito

Catálogo de equipos organizacionales. Un equipo agrupa líderes y agentes.

### 2.2 Especificación

#### PostgreSQL

```sql
CREATE TABLE IF NOT EXISTS equipos (
    id              SERIAL PRIMARY KEY,
    nombre          VARCHAR(100) UNIQUE NOT NULL,
    descripcion     TEXT,
    activo          INTEGER DEFAULT 1 NOT NULL
                    CHECK (activo IN (0, 1)),
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### SQLite

```sql
CREATE TABLE IF NOT EXISTS equipos (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre          TEXT UNIQUE NOT NULL,
    descripcion     TEXT,
    activo          INTEGER DEFAULT 1 NOT NULL,
    created_at      TEXT DEFAULT (datetime('now')),
    updated_at      TEXT DEFAULT (datetime('now'))
);
```

### 2.3 Columnas — Detalle

| Columna | PG Type | SQLite Type | Restricciones | Descripción |
|---------|---------|-------------|---------------|-------------|
| `id` | `SERIAL` | `INTEGER PK AUTOINCREMENT` | `PRIMARY KEY` | ID único del equipo |
| `nombre` | `VARCHAR(100)` | `TEXT` | `UNIQUE NOT NULL` | Nombre del equipo (ej: "Ventas", "COB", "Sistema") |
| `descripcion` | `TEXT` | `TEXT` | — | Descripción opcional del equipo |
| `activo` | `INTEGER` | `INTEGER` | `DEFAULT 1 NOT NULL CHECK (activo IN (0,1))` | 1=activo, 0=inactivo (no se eliminan para preservar historial) |
| `created_at` | `TIMESTAMP` | `TEXT` | `DEFAULT CURRENT_TIMESTAMP` | Fecha de creación |
| `updated_at` | `TIMESTAMP` | `TEXT` | `DEFAULT CURRENT_TIMESTAMP` | Última modificación |

### 2.4 Índices

| Índice | Tipo | Columnas | Justificación |
|--------|:----:|----------|---------------|
| `equipos_nombre_unique` | UNIQUE | `nombre` | No pueden existir dos equipos con el mismo nombre |
| `idx_equipos_activo` | B-tree | `activo` | Filtrar solo equipos activos en selectores |

### 2.5 Seed Data

```sql
-- Equipo por defecto para migración
INSERT INTO equipos (nombre, descripcion) 
VALUES ('Sistema', 'Equipo por defecto creado durante la migración. Todos los usuarios actuales pertenecen aquí inicialmente.');
```

### 2.6 Restricciones y Reglas de Negocio

- `nombre` debe ser único (case-insensitive en la aplicación)
- No se eliminan equipos físicamente → `activo = 0` para desactivar
- El equipo "Sistema" no puede desactivarse

---

## 3. TABLA: `equipo_usuarios`

### 3.1 Propósito

Registra la membresía de usuarios en equipos. Soporta historial (fecha de salida).

### 3.2 Especificación

#### PostgreSQL

```sql
CREATE TABLE IF NOT EXISTS equipo_usuarios (
    id              SERIAL PRIMARY KEY,
    equipo_id       INTEGER NOT NULL REFERENCES equipos(id)
                    ON DELETE CASCADE,
    usuario_id      INTEGER NOT NULL REFERENCES usuarios(id)
                    ON DELETE CASCADE,
    es_lider        INTEGER DEFAULT 0 NOT NULL
                    CHECK (es_lider IN (0, 1)),
    fecha_ingreso   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_salida    TIMESTAMP,
    motivo_salida   TEXT,
    UNIQUE(usuario_id, fecha_salida)  -- Un usuario activo a la vez
);
```

#### SQLite

```sql
CREATE TABLE IF NOT EXISTS equipo_usuarios (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    equipo_id       INTEGER NOT NULL,
    usuario_id      INTEGER NOT NULL,
    es_lider        INTEGER DEFAULT 0 NOT NULL,
    fecha_ingreso   TEXT DEFAULT (datetime('now')),
    fecha_salida    TEXT,
    motivo_salida   TEXT,
    FOREIGN KEY (equipo_id) REFERENCES equipos(id) ON DELETE CASCADE,
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
    UNIQUE(usuario_id, fecha_salida)
);
```

### 3.3 Columnas — Detalle

| Columna | PG Type | SQLite Type | Restricciones | Descripción |
|---------|---------|-------------|---------------|-------------|
| `id` | `SERIAL` | `INTEGER PK AUTOINCREMENT` | `PRIMARY KEY` | ID único |
| `equipo_id` | `INTEGER` | `INTEGER` | `NOT NULL FK→equipos(id) ON DELETE CASCADE` | Equipo al que pertenece |
| `usuario_id` | `INTEGER` | `INTEGER` | `NOT NULL FK→usuarios(id) ON DELETE CASCADE` | Usuario miembro |
| `es_lider` | `INTEGER` | `INTEGER` | `DEFAULT 0 NOT NULL CHECK (es_lider IN (0,1))` | 1=es líder, 0=es agente/miembro |
| `fecha_ingreso` | `TIMESTAMP` | `TEXT` | `DEFAULT CURRENT_TIMESTAMP` | Cuándo se unió al equipo |
| `fecha_salida` | `TIMESTAMP` | `TEXT` | — | NULL=activo, con fecha=historial |
| `motivo_salida` | `TEXT` | `TEXT` | — | Opcional: por qué salió (ej: "cambio de equipo", "desactivación") |

### 3.4 Índices

```sql
-- PG
CREATE INDEX IF NOT EXISTS idx_equipo_usuarios_usuario_activo 
ON equipo_usuarios(usuario_id, fecha_salida);

CREATE INDEX IF NOT EXISTS idx_equipo_usuarios_equipo 
ON equipo_usuarios(equipo_id, es_lider, fecha_salida);

CREATE INDEX IF NOT EXISTS idx_equipo_usuarios_lider 
ON equipo_usuarios(equipo_id, es_lider) WHERE es_lider = 1 AND fecha_salida IS NULL;

-- SQLite
CREATE INDEX IF NOT EXISTS idx_equipo_usuarios_usuario_activo 
ON equipo_usuarios(usuario_id, fecha_salida);

CREATE INDEX IF NOT EXISTS idx_equipo_usuarios_equipo 
ON equipo_usuarios(equipo_id, es_lider, fecha_salida);

CREATE INDEX IF NOT EXISTS idx_equipo_usuarios_lider 
ON equipo_usuarios(equipo_id, es_lider);
```

### 3.5 Restricciones y Reglas de Negocio

| Restricción | Implementación | Explicación |
|-------------|---------------|-------------|
| Un usuario activo en un solo equipo | `UNIQUE(usuario_id, fecha_salida)` + en app validar que no exista registro activo | `fecha_salida IS NULL` = registro activo. Un usuario no puede tener 2 activos |
| FK bidireccional | `FOREIGN KEY` con `ON DELETE CASCADE` | Si se elimina un equipo/usuario, se limpia la membresía |
| Un equipo puede tener múltiples líderes | Sin restricción única en `equipo_id + es_lider` | Equipos grandes pueden necesitar varios líderes |
| Historial preservado | `fecha_salida` en lugar de DELETE | Permite auditoría: quién estuvo en qué equipo y cuándo |

### 3.6 Seed Data

```sql
-- SUPERADMIN como líder del equipo Sistema
INSERT INTO equipo_usuarios (equipo_id, usuario_id, es_lider)
SELECT e.id, u.id, 1
FROM equipos e, usuarios u
WHERE e.nombre = 'Sistema' 
  AND (u.is_superadmin = 1 OR u.is_superadmin = TRUE);

-- ADMIN como miembros del equipo Sistema
INSERT INTO equipo_usuarios (equipo_id, usuario_id, es_lider)
SELECT e.id, u.id, 0
FROM equipos e, usuarios u
WHERE e.nombre = 'Sistema' 
  AND u.rol = 'admin'
  AND (u.is_superadmin IS NULL OR u.is_superadmin = 0 OR u.is_superadmin = FALSE);

-- Todos los demás usuarios como miembros del equipo Sistema
INSERT INTO equipo_usuarios (equipo_id, usuario_id)
SELECT e.id, u.id
FROM equipos e, usuarios u
WHERE e.nombre = 'Sistema' 
  AND (u.rol IS NULL OR u.rol NOT IN ('admin', 'superadmin'))
  AND u.id NOT IN (
    SELECT usuario_id FROM equipo_usuarios WHERE fecha_salida IS NULL
  );
```

### 3.7 Consultas Típicas

```sql
-- Obtener equipo activo de un usuario
SELECT e.*, eu.es_lider
FROM equipos e
INNER JOIN equipo_usuarios eu ON e.id = eu.equipo_id
WHERE eu.usuario_id = $1 AND eu.fecha_salida IS NULL;

-- Listar agentes de un equipo
SELECT u.id, u.username, u.nombre, eu.fecha_ingreso
FROM usuarios u
INNER JOIN equipo_usuarios eu ON u.id = eu.usuario_id
WHERE eu.equipo_id = $1 AND eu.es_lider = 0 AND eu.fecha_salida IS NULL;

-- Listar líderes de un equipo
SELECT u.id, u.username, u.nombre
FROM usuarios u
INNER JOIN equipo_usuarios eu ON u.id = eu.usuario_id
WHERE eu.equipo_id = $1 AND eu.es_lider = 1 AND eu.fecha_salida IS NULL;
```

---

## 4. TABLA: `permisos_roles`

### 4.1 Propósito

Define qué permisos tiene cada rol del sistema. Sistema extensible: agregar un nuevo permiso es solo un INSERT.

### 4.2 Especificación

#### PostgreSQL

```sql
CREATE TABLE IF NOT EXISTS permisos_roles (
    id              SERIAL PRIMARY KEY,
    rol             VARCHAR(20) NOT NULL,
    permiso         VARCHAR(100) NOT NULL,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(rol, permiso)
);
```

#### SQLite

```sql
CREATE TABLE IF NOT EXISTS permisos_roles (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    rol             TEXT NOT NULL,
    permiso         TEXT NOT NULL,
    created_at      TEXT DEFAULT (datetime('now')),
    UNIQUE(rol, permiso)
);
```

### 4.3 Columnas — Detalle

| Columna | PG Type | SQLite Type | Restricciones | Descripción |
|---------|---------|-------------|---------------|-------------|
| `id` | `SERIAL` | `INTEGER PK AUTOINCREMENT` | `PRIMARY KEY` | ID único |
| `rol` | `VARCHAR(20)` | `TEXT` | `NOT NULL` | Nombre del rol: `superadmin`, `admin`, `lider`, `agente`, `user` |
| `permiso` | `VARCHAR(100)` | `TEXT` | `NOT NULL` | Identificador del permiso (ej: `solicitudes:asignar`) |
| `created_at` | `TIMESTAMP` | `TEXT` | `DEFAULT CURRENT_TIMESTAMP` | Cuándo se asignó el permiso |

### 4.4 Índices

| Índice | Tipo | Columnas | Justificación |
|--------|:----:|----------|---------------|
| `permisos_roles_rol_permiso_unique` | UNIQUE | `(rol, permiso)` | Evita duplicados |
| `idx_permisos_roles_rol` | B-tree | `rol` | Filtrar permisos por rol (consulta más frecuente) |

### 4.5 Catálogo Completo de Permisos

#### Convención de Nomenclatura

```
<recurso>:<acción>

Recursos:   equipo, agentes, campañas, solicitudes, gestiones, dashboard,
            relaciones, ventas, historial, usuarios, sistema, importar
Acciones:   ver, crear, gestionar, eliminar, asignar, reasignar, *
            ver-propias, ver-equipo (filtros de visibilidad)
```

#### Permisos por Rol

##### `superadmin` (level 100)
No necesita registros en `permisos_roles`. El código le otorga todos los permisos automáticamente.

##### `admin` (level 50)
No necesita registros. El código existente en `permissions.js` ya maneja sus permisos hardcodeados + consulta BD como fallback.

##### `lider` (level 30)

| Permiso | Descripción |
|---------|-------------|
| `equipo:ver` | Ver información de su equipo |
| `equipo:gestionar` | Editar nombre/descripción de su equipo |
| `agentes:ver` | Ver lista de agentes del equipo |
| `agentes:crear` | Crear nuevos agentes dentro del equipo |
| `agentes:editar` | Editar datos de agentes del equipo |
| `agentes:desactivar` | Desactivar agentes del equipo |
| `campañas:ver` | Ver campañas del equipo |
| `campañas:crear` | Crear nuevas campañas |
| `campañas:gestionar` | Editar/cerrar campañas |
| `campañas:asignar` | Asignar campaña completa a un agente |
| `solicitudes:importar` | Importar Excel |
| `solicitudes:ver-equipo` | Ver solicitudes del equipo |
| `solicitudes:asignar` | Asignar solicitudes a agentes |
| `solicitudes:reasignar` | Reasignar solicitudes entre agentes |
| `solicitudes:ver-asignaciones` | Ver historial de asignaciones |
| `gestiones:ver-equipo` | Ver gestiones de todo el equipo |
| `dashboard:ver-equipo` | Ver dashboard de rendimiento del equipo |
| `dashboard:ver-agentes` | Ver dashboard individual de cada agente |
| `relaciones:ver-equipo` | Ver relaciones del equipo (si aplica) |
| `historial:ver-equipo` | Ver historial de cambios del equipo |

##### `agente` (level 20)

| Permiso | Descripción |
|---------|-------------|
| `campañas:ver-propias` | Ver campañas donde tiene asignaciones |
| `solicitudes:ver-asignadas` | Ver solo solicitudes asignadas a él |
| `solicitudes:gestionar` | Realizar gestiones sobre solicitudes asignadas |
| `solicitudes:editar-estado` | Cambiar estado/segmento |
| `solicitudes:completar-info` | Completar información de solicitudes |
| `gestiones:crear` | Crear nuevas gestiones |
| `gestiones:ver-propias` | Ver sus propias gestiones |
| `gestiones:editar` | Editar gestiones propias |
| `relaciones:gestionar` | Gestionar relaciones (si aplica) |
| `historial:ver-propio` | Ver su propio historial |
| `perfil:ver` | Ver su perfil |
| `perfil:editar` | Editar su perfil |

##### `user` (level 10 — comportamiento actual, sin cambios)

| Permiso | Descripción |
|---------|-------------|
| `solicitudes:importar` | Importar Excel |
| `solicitudes:ver-propias` | Ver solicitudes propias |
| `solicitudes:gestionar` | Gestionar solicitudes propias |
| `campañas:crear` | Crear campañas |
| `campañas:gestionar` | Gestionar campañas propias |
| `gestiones:crear` | Crear gestiones |
| `gestiones:ver-propias` | Ver gestiones propias |
| `relaciones:gestionar` | Gestionar relaciones |
| `ventas:gestionar` | Gestionar control de ventas |
| `historial:ver-propio` | Ver historial propio |
| `perfil:ver` | Ver perfil |
| `perfil:editar` | Editar perfil |

### 4.6 Seed Data — Inserts

```sql
-- LÍDER
INSERT INTO permisos_roles (rol, permiso) VALUES
    ('lider', 'equipo:ver'),
    ('lider', 'equipo:gestionar'),
    ('lider', 'agentes:ver'),
    ('lider', 'agentes:crear'),
    ('lider', 'agentes:editar'),
    ('lider', 'agentes:desactivar'),
    ('lider', 'campañas:ver'),
    ('lider', 'campañas:crear'),
    ('lider', 'campañas:gestionar'),
    ('lider', 'campañas:asignar'),
    ('lider', 'solicitudes:importar'),
    ('lider', 'solicitudes:ver-equipo'),
    ('lider', 'solicitudes:asignar'),
    ('lider', 'solicitudes:reasignar'),
    ('lider', 'solicitudes:ver-asignaciones'),
    ('lider', 'gestiones:ver-equipo'),
    ('lider', 'dashboard:ver-equipo'),
    ('lider', 'dashboard:ver-agentes'),
    ('lider', 'relaciones:ver-equipo'),
    ('lider', 'historial:ver-equipo');

-- AGENTE
INSERT INTO permisos_roles (rol, permiso) VALUES
    ('agente', 'campañas:ver-propias'),
    ('agente', 'solicitudes:ver-asignadas'),
    ('agente', 'solicitudes:gestionar'),
    ('agente', 'solicitudes:editar-estado'),
    ('agente', 'solicitudes:completar-info'),
    ('agente', 'gestiones:crear'),
    ('agente', 'gestiones:ver-propias'),
    ('agente', 'gestiones:editar'),
    ('agente', 'relaciones:gestionar'),
    ('agente', 'historial:ver-propio'),
    ('agente', 'perfil:ver'),
    ('agente', 'perfil:editar');

-- USER (comportamiento actual)
INSERT INTO permisos_roles (rol, permiso) VALUES
    ('user', 'solicitudes:importar'),
    ('user', 'solicitudes:ver-propias'),
    ('user', 'solicitudes:gestionar'),
    ('user', 'solicitudes:editar-estado'),
    ('user', 'solicitudes:completar-info'),
    ('user', 'campañas:crear'),
    ('user', 'campañas:gestionar'),
    ('user', 'gestiones:crear'),
    ('user', 'gestiones:ver-propias'),
    ('user', 'gestiones:editar'),
    ('user', 'relaciones:gestionar'),
    ('user', 'ventas:gestionar'),
    ('user', 'historial:ver-propio'),
    ('user', 'perfil:ver'),
    ('user', 'perfil:editar');
```

---

## 5. TABLA: `permisos_equipo`

### 5.1 Propósito

Permite que un SUPERADMIN conceda permisos extras a un equipo completo, por encima de los permisos de su rol base.

### 5.2 Especificación

#### PostgreSQL

```sql
CREATE TABLE IF NOT EXISTS permisos_equipo (
    id              SERIAL PRIMARY KEY,
    equipo_id       INTEGER NOT NULL REFERENCES equipos(id)
                    ON DELETE CASCADE,
    permiso         VARCHAR(100) NOT NULL,
    concedido_por   INTEGER REFERENCES usuarios(id),
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(equipo_id, permiso)
);
```

#### SQLite

```sql
CREATE TABLE IF NOT EXISTS permisos_equipo (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    equipo_id       INTEGER NOT NULL,
    permiso         TEXT NOT NULL,
    concedido_por   INTEGER,
    created_at      TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (equipo_id) REFERENCES equipos(id) ON DELETE CASCADE,
    FOREIGN KEY (concedido_por) REFERENCES usuarios(id),
    UNIQUE(equipo_id, permiso)
);
```

### 5.3 Columnas — Detalle

| Columna | PG Type | SQLite Type | Restricciones | Descripción |
|---------|---------|-------------|---------------|-------------|
| `id` | `SERIAL` | `INTEGER PK AUTOINCREMENT` | `PRIMARY KEY` | ID único |
| `equipo_id` | `INTEGER` | `INTEGER` | `NOT NULL FK→equipos(id) ON DELETE CASCADE` | Equipo beneficiario |
| `permiso` | `VARCHAR(100)` | `TEXT` | `NOT NULL` | Permiso concedido (misma nomenclatura) |
| `concedido_por` | `INTEGER` | `INTEGER` | `FK→usuarios(id)` | Quién concedió el permiso (auditoría) |
| `created_at` | `TIMESTAMP` | `TEXT` | `DEFAULT CURRENT_TIMESTAMP` | Cuándo se concedió |

### 5.4 Índices

| Índice | Tipo | Columnas |
|--------|:----:|----------|
| `permisos_equipo_equipo_permiso_unique` | UNIQUE | `(equipo_id, permiso)` |
| `idx_permisos_equipo_equipo` | B-tree | `equipo_id` |

### 5.5 Ejemplos de Uso

```sql
-- Conceder permiso de importación a un equipo que por su rol no lo tiene
INSERT INTO permisos_equipo (equipo_id, permiso, concedido_por)
VALUES (2, 'solicitudes:importar', 1);

-- Conceder permiso de creación de agentes
INSERT INTO permisos_equipo (equipo_id, permiso, concedido_por)
VALUES (2, 'agentes:crear', 1);
```

---

## 6. TABLA: `asignaciones_solicitudes`

### 6.1 Propósito

Corazón del sistema multi-equipo. Registra qué solicitudes están asignadas a qué equipo y opcionalmente a qué agente específico.

### 6.2 Especificación

#### PostgreSQL

```sql
CREATE TABLE IF NOT EXISTS asignaciones_solicitudes (
    id                  SERIAL PRIMARY KEY,
    solicitud_id        INTEGER NOT NULL,
    equipo_id           INTEGER NOT NULL REFERENCES equipos(id),
    usuario_id          INTEGER REFERENCES usuarios(id),
    asignado_por        INTEGER NOT NULL REFERENCES usuarios(id),
    desde_campaña_id    INTEGER,                              -- Opcional: ID de campaña origen
    tipo_asignacion     VARCHAR(20) DEFAULT 'manual'
                        CHECK (tipo_asignacion IN ('manual', 'automatica', 'campaña', 'importacion')),
    fecha_asignacion    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_desasignacion TIMESTAMP,
    motivo_desasignacion TEXT,
    UNIQUE(solicitud_id, fecha_desasignacion)
);
```

#### SQLite

```sql
CREATE TABLE IF NOT EXISTS asignaciones_solicitudes (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    solicitud_id        INTEGER NOT NULL,
    equipo_id           INTEGER NOT NULL,
    usuario_id          INTEGER,
    asignado_por        INTEGER NOT NULL,
    desde_campaña_id    INTEGER,
    tipo_asignacion     TEXT DEFAULT 'manual',
    fecha_asignacion    TEXT DEFAULT (datetime('now')),
    fecha_desasignacion TEXT,
    motivo_desasignacion TEXT,
    FOREIGN KEY (equipo_id) REFERENCES equipos(id),
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id),
    FOREIGN KEY (asignado_por) REFERENCES usuarios(id),
    UNIQUE(solicitud_id, fecha_desasignacion)
);
```

### 6.3 Columnas — Detalle

| Columna | PG Type | SQLite Type | Restricciones | Descripción |
|---------|---------|-------------|---------------|-------------|
| `id` | `SERIAL` | `INTEGER PK AUTOINCREMENT` | `PRIMARY KEY` | ID único |
| `solicitud_id` | `INTEGER` | `INTEGER` | `NOT NULL` | ID de la solicitud (FK lógica, no formal — las solicitudes no se eliminan) |
| `equipo_id` | `INTEGER` | `INTEGER` | `NOT NULL FK→equipos(id)` | Equipo al que está asignada |
| `usuario_id` | `INTEGER` | `INTEGER` | `FK→usuarios(id)` — NULLable | Agente específico (NULL = asignada al equipo, sin agente) |
| `asignado_por` | `INTEGER` | `INTEGER` | `NOT NULL FK→usuarios(id)` | Quién realizó la asignación |
| `desde_campaña_id` | `INTEGER` | `INTEGER` | — | ID de campaña origen (si se asignó desde una campaña) |
| `tipo_asignacion` | `VARCHAR(20)` | `TEXT` | `DEFAULT 'manual' CHECK(...)` | Cómo se asignó: `manual`, `automatica`, `campaña`, `importacion` |
| `fecha_asignacion` | `TIMESTAMP` | `TEXT` | `DEFAULT CURRENT_TIMESTAMP` | Cuándo se asignó |
| `fecha_desasignacion` | `TIMESTAMP` | `TEXT` | — | NULL=asignación activa, con fecha=historial |
| `motivo_desasignacion` | `TEXT` | `TEXT` | — | Por qué se desasignó (ej: "reasignado", "completado", "devuelto al equipo") |

### 6.4 Índices

```sql
-- PG
CREATE INDEX IF NOT EXISTS idx_asignaciones_solicitud_activa 
ON asignaciones_solicitudes(solicitud_id, fecha_desasignacion);

CREATE INDEX IF NOT EXISTS idx_asignaciones_usuario_activas 
ON asignaciones_solicitudes(usuario_id, fecha_desasignacion) 
WHERE usuario_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_asignaciones_equipo_activas 
ON asignaciones_solicitudes(equipo_id, fecha_desasignacion);

CREATE INDEX IF NOT EXISTS idx_asignaciones_campaña 
ON asignaciones_solicitudes(desde_campaña_id, fecha_desasignacion);

CREATE INDEX IF NOT EXISTS idx_asignaciones_fecha 
ON asignaciones_solicitudes(fecha_asignacion DESC);

-- SQLite
CREATE INDEX IF NOT EXISTS idx_asignaciones_solicitud_activa 
ON asignaciones_solicitudes(solicitud_id, fecha_desasignacion);

CREATE INDEX IF NOT EXISTS idx_asignaciones_usuario_activas 
ON asignaciones_solicitudes(usuario_id, fecha_desasignacion);

CREATE INDEX IF NOT EXISTS idx_asignaciones_equipo_activas 
ON asignaciones_solicitudes(equipo_id, fecha_desasignacion);

CREATE INDEX IF NOT EXISTS idx_asignaciones_campaña 
ON asignaciones_solicitudes(desde_campaña_id, fecha_desasignacion);

CREATE INDEX IF NOT EXISTS idx_asignaciones_fecha 
ON asignaciones_solicitudes(fecha_asignacion DESC);
```

### 6.5 Restricciones y Reglas de Negocio

| Regla | Implementación | Explicación |
|-------|---------------|-------------|
| Una solicitud asignada a un solo equipo activo | Control por app: verificar que no exista registro activo para `solicitud_id` antes de insertar | Evita doble asignación |
| `usuario_id` NULL = asignada al equipo, no a un agente específico | CHECK no requerido, la app lo valida | El líder puede asignar al equipo y luego distribuir |
| Historial preservado | `fecha_desasignacion` en lugar de DELETE | Permite auditoría completa de asignaciones |
| FK no formal a `solicitudes` | No se crea FOREIGN KEY formal porque `solicitudes.id_solicitud` no es PK | La consistencia se maneja a nivel aplicación |

### 6.6 Consultas Típicas

```sql
-- Obtener asignación activa de una solicitud
SELECT * FROM asignaciones_solicitudes 
WHERE solicitud_id = $1 AND fecha_desasignacion IS NULL;

-- Solicitudes asignadas a un agente específico
SELECT s.*, a.fecha_asignacion 
FROM solicitudes s
INNER JOIN asignaciones_solicitudes a ON s.id_solicitud = a.solicitud_id
WHERE a.usuario_id = $1 AND a.fecha_desasignacion IS NULL
ORDER BY a.fecha_asignacion DESC;

-- Solicitudes del equipo (sin agente específico) — disponibles para asignar
SELECT s.* 
FROM solicitudes s
INNER JOIN asignaciones_solicitudes a ON s.id_solicitud = a.solicitud_id
WHERE a.equipo_id = $1 
  AND a.usuario_id IS NULL 
  AND a.fecha_desasignacion IS NULL;

-- Contar solicitudes activas de un equipo
SELECT COUNT(*) as total_asignadas
FROM asignaciones_solicitudes
WHERE equipo_id = $1 AND fecha_desasignacion IS NULL;

-- Historial de asignaciones de una solicitud
SELECT a.*, u_asigno.username as asignado_por_nombre,
       u_agente.username as agente_nombre,
       e.nombre as equipo_nombre
FROM asignaciones_solicitudes a
LEFT JOIN usuarios u_asigno ON a.asignado_por = u_asigno.id
LEFT JOIN usuarios u_agente ON a.usuario_id = u_agente.id
LEFT JOIN equipos e ON a.equipo_id = e.id
WHERE a.solicitud_id = $1
ORDER BY a.fecha_asignacion DESC;

-- Dashboard del líder: agentes con conteo de asignaciones activas
SELECT u.id, u.username, u.nombre, COUNT(a.id) as solicitudes_activas
FROM usuarios u
LEFT JOIN asignaciones_solicitudes a ON u.id = a.usuario_id AND a.fecha_desasignacion IS NULL
INNER JOIN equipo_usuarios eu ON u.id = eu.usuario_id
WHERE eu.equipo_id = $1 AND eu.es_lider = 0 AND eu.fecha_salida IS NULL
GROUP BY u.id, u.username, u.nombre
ORDER BY solicitudes_activas DESC;
```

### 6.7 Al eliminar una solicitud

```sql
-- Marcar todas las asignaciones activas como desasignadas
UPDATE asignaciones_solicitudes 
SET fecha_desasignacion = CURRENT_TIMESTAMP, 
    motivo_desasignacion = 'solicitud_eliminada'
WHERE solicitud_id = $1 AND fecha_desasignacion IS NULL;
```

---

## 7. TABLA: `campañas_equipo`

### 7.1 Propósito

Asocia campañas (gestiones_maestro) a equipos. Una campaña puede pertenecer a un solo equipo o ser global.

### 7.2 Especificación

#### PostgreSQL

```sql
CREATE TABLE IF NOT EXISTS campañas_equipo (
    id              SERIAL PRIMARY KEY,
    campaña_id      INTEGER NOT NULL,
    equipo_id       INTEGER NOT NULL REFERENCES equipos(id)
                    ON DELETE CASCADE,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(campaña_id)
);
```

#### SQLite

```sql
CREATE TABLE IF NOT EXISTS campañas_equipo (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    campaña_id      INTEGER NOT NULL,
    equipo_id       INTEGER NOT NULL,
    created_at      TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (equipo_id) REFERENCES equipos(id) ON DELETE CASCADE,
    UNIQUE(campaña_id)
);
```

### 7.3 Columnas — Detalle

| Columna | PG Type | SQLite Type | Restricciones | Descripción |
|---------|---------|-------------|---------------|-------------|
| `id` | `SERIAL` | `INTEGER PK AUTOINCREMENT` | `PRIMARY KEY` | ID único |
| `campaña_id` | `INTEGER` | `INTEGER` | `UNIQUE NOT NULL` | ID de la campaña (FK → gestiones_maestro.id) |
| `equipo_id` | `INTEGER` | `INTEGER` | `NOT NULL FK→equipos(id) ON DELETE CASCADE` | Equipo propietario |
| `created_at` | `TIMESTAMP` | `TEXT` | `DEFAULT CURRENT_TIMESTAMP` | Cuándo se asoció |

### 7.4 Índices

| Índice | Tipo | Columnas |
|--------|:----:|----------|
| `campañas_equipo_campaña_unique` | UNIQUE | `campaña_id` |
| `idx_campañas_equipo_equipo` | B-tree | `equipo_id` |

### 7.5 Alternativa: Columna directa en `gestiones_maestro`

Como alternativa a esta tabla separada, se puede usar la columna `equipo_id` directamente en `gestiones_maestro` (ya definida en la modificación de la FASE 1). La tabla `campañas_equipo` es útil cuando se necesita:
- Soporte para múltiples equipos por campaña (no es el caso actual)
- Auditoría separada de la asociación
- Sin modificar la tabla existente

**Decisión de diseño:** Usar **ambos**:
- `gestiones_maestro.equipo_id` para la asociación principal (más simple, evita JOIN)
- `campañas_equipo` se crea pero no se usa en esta fase (reservado para futuras extensiones)

---

## 8. MODIFICACIÓN: `gestiones_maestro` + `equipo_id`

### 8.1 Especificación

#### PostgreSQL

```sql
ALTER TABLE gestiones_maestro 
ADD COLUMN IF NOT EXISTS equipo_id INTEGER REFERENCES equipos(id);
```

#### SQLite

```sql
ALTER TABLE gestiones_maestro 
ADD COLUMN equipo_id INTEGER;
```

### 8.2 Detalle de la Columna

| Columna | PG Type | SQLite Type | Default | Descripción |
|---------|---------|-------------|:-------:|-------------|
| `equipo_id` | `INTEGER` | `INTEGER` | `NULL` | Equipo propietario de la campaña |

### 8.3 Comportamiento

| Valor de `equipo_id` | Significado | Visibilidad |
|:--------------------:|-------------|-------------|
| `NULL` | Campaña global (comportamiento actual) | Visible para `user`, `admin`, `superadmin` |
| `1` (equipo Sistema) | Campaña del equipo Sistema | Visible para miembros del equipo Sistema |
| `2` (equipo Ventas) | Campaña del equipo Ventas | Visible solo para miembros de Ventas |

### 8.4 Migración de Datos

```sql
-- Campañas existentes: se quedan sin equipo (NULL) = comportamiento actual
-- No se modifica ningún registro existente
```

### 8.5 Índice

```sql
-- PG
CREATE INDEX IF NOT EXISTS idx_gestiones_maestro_equipo 
ON gestiones_maestro(equipo_id);

-- SQLite
CREATE INDEX IF NOT EXISTS idx_gestiones_maestro_equipo 
ON gestiones_maestro(equipo_id);
```

---

## 9. DIAGRAMA ENTIDAD-RELACIÓN

### 9.1 Diagrama de Tablas Nuevas

```
                    ┌──────────────────────────────────────────────┐
                    │                   equipos                     │
                    ├──────────────────────────────────────────────┤
                    │ PK │ id                        SERIAL        │
                    │    │ nombre                    VARCHAR(100)   │ ← UNIQUE
                    │    │ descripcion               TEXT           │
                    │    │ activo                    INTEGER(1)     │ ← DEFAULT 1
                    │    │ created_at                TIMESTAMP      │
                    │    │ updated_at                TIMESTAMP      │
                    └──────────────────┬───────────────────────────┘
                                       │ 1
                                       │
                    ┌──────────────────┴───────────────────────────┐
                    │               equipo_usuarios                 │
                    ├──────────────────────────────────────────────┤
                    │ PK │ id                        SERIAL        │
               ┌────│ FK │ equipo_id                  INTEGER       │────→ equipos.id
               │    │ FK │ usuario_id                 INTEGER       │────→ usuarios.id
               │    │    │ es_lider                  INTEGER(1)     │ ← DEFAULT 0
               │    │    │ fecha_ingreso              TIMESTAMP      │
               │    │    │ fecha_salida               TIMESTAMP      │ ← NULL = activo
               │    │    │ motivo_salida              TEXT           │
               │    │    │ UNIQUE(usuario_id, fecha_salida)         │
               │    └──────────────────────────────────────────────┘
               │
               │    ┌──────────────────────────────────────────────┐
               │    │               permisos_roles                  │
               │    ├──────────────────────────────────────────────┤
               │    │ PK │ id                        SERIAL        │
               │    │    │ rol                       VARCHAR(20)    │
               │    │    │ permiso                   VARCHAR(100)   │
               │    │    │ created_at                TIMESTAMP      │
               │    │    │ UNIQUE(rol, permiso)                    │
               │    └──────────────────────────────────────────────┘
               │
               │    ┌──────────────────────────────────────────────┐
               │    │              permisos_equipo                  │
               │    ├──────────────────────────────────────────────┤
               │    │ PK │ id                        SERIAL        │
               └────│ FK │ equipo_id                  INTEGER       │────→ equipos.id
                    │    │ permiso                   VARCHAR(100)   │
               ┌────│ FK │ concedido_por              INTEGER       │────→ usuarios.id
               │    │    │ created_at                TIMESTAMP      │
               │    │    │ UNIQUE(equipo_id, permiso)               │
               │    └──────────────────────────────────────────────┘
               │
               │    ┌─────────────────────────────────────────────────────────────┐
               │    │              asignaciones_solicitudes                        │
               │    ├─────────────────────────────────────────────────────────────┤
               │    │ PK │ id                           SERIAL                    │
               │    │    │ solicitud_id                 INTEGER                    │
               └────│ FK │ equipo_id                    INTEGER                    │────→ equipos.id
               ┌────│ FK │ usuario_id                   INTEGER                    │────→ usuarios.id (NULLable)
               │    │ FK │ asignado_por                 INTEGER                    │────→ usuarios.id
               │    │    │ desde_campaña_id             INTEGER                    │
               │    │    │ tipo_asignacion              VARCHAR(20)                │
               │    │    │ fecha_asignacion             TIMESTAMP                  │
               │    │    │ fecha_desasignacion          TIMESTAMP                  │ ← NULL = activa
               │    │    │ motivo_desasignacion         TEXT                       │
               │    │    │ UNIQUE(solicitud_id, fecha_desasignacion)               │
               │    └─────────────────────────────────────────────────────────────┘
               │
               │    ┌──────────────────────────────────────────────┐
               │    │              campañas_equipo                  │
               │    ├──────────────────────────────────────────────┤
               │    │ PK │ id                        SERIAL        │
               │    │    │ campaña_id                INTEGER        │ ← UNIQUE
               └────│ FK │ equipo_id                  INTEGER       │────→ equipos.id
                    │    │ created_at                TIMESTAMP      │
                    └──────────────────────────────────────────────┘
```

### 9.2 Diagrama de Relaciones entre Tablas (Visión General)

```
┌──────────┐    1:N    ┌──────────────────┐     N:1    ┌──────────┐
│ equipos   │──────────│  equipo_usuarios   │──────────│ usuarios │
└──────────┘           └──────────────────┘           └──────────┘
     │ 1:N                                                  │
     │                                                      │
     │              ┌──────────────────────┐                │
     ├─────────────│  asignaciones_solicitudes│─────────────┘
     │              └──────────────────────┘
     │                        │ (solicitud_id — lógica)
     │                        ▼
     │              ┌──────────────────────┐
     │              │     solicitudes       │
     │              └──────────────────────┘
     │
     │ 1:N    ┌──────────────────┐
     ├───────│   permisos_equipo  │
     │       └──────────────────┘
     │
     │ 1:N    ┌──────────────────┐
     └───────│  campañas_equipo   │
             └────────┬─────────┘
                      │ (campaña_id)
                      ▼
             ┌──────────────────────┐
             │  gestiones_maestro    │ ← + equipo_id (NUEVA COLUMNA)
             └──────────────────────┘
```

### 9.3 Mapa de Relaciones Completo

| Tabla A | Relación | Tabla B | Columna FK | Tipo FK |
|---------|:--------:|---------|------------|:-------:|
| `equipo_usuarios` | N:1 | `equipos` | `equipo_id` | Formal (CASCADE) |
| `equipo_usuarios` | N:1 | `usuarios` | `usuario_id` | Formal (CASCADE) |
| `permisos_equipo` | N:1 | `equipos` | `equipo_id` | Formal (CASCADE) |
| `permisos_equipo` | N:1 | `usuarios` | `concedido_por` | Formal |
| `asignaciones_solicitudes` | N:1 | `equipos` | `equipo_id` | Formal |
| `asignaciones_solicitudes` | N:1 | `usuarios` | `usuario_id` | Formal (NULLable) |
| `asignaciones_solicitudes` | N:1 | `usuarios` | `asignado_por` | Formal |
| `asignaciones_solicitudes` | — | `solicitudes` | `solicitud_id` | **Lógica** (no FK formal) |
| `campañas_equipo` | N:1 | `equipos` | `equipo_id` | Formal (CASCADE) |
| `campañas_equipo` | — | `gestiones_maestro` | `campaña_id` | **Lógica** (no FK formal) |
| `gestiones_maestro` | N:1 | `equipos` | `equipo_id` | Formal (NULLable) |

---

## 10. SEED DATA

### 10.1 Migración 01 — Crear Equipo Sistema

```sql
-- PostgreSQL
INSERT INTO equipos (nombre, descripcion)
SELECT 'Sistema', 'Equipo por defecto creado durante la migración. Todos los usuarios actuales pertenecen aquí inicialmente.'
WHERE NOT EXISTS (SELECT 1 FROM equipos WHERE nombre = 'Sistema');

-- SQLite
INSERT OR IGNORE INTO equipos (nombre, descripcion)
VALUES ('Sistema', 'Equipo por defecto creado durante la migración. Todos los usuarios actuales pertenecen aquí inicialmente.');
```

### 10.2 Migración 02 — Asignar Usuarios al Equipo Sistema

```sql
-- Superadmin como líder
INSERT INTO equipo_usuarios (equipo_id, usuario_id, es_lider)
SELECT e.id, u.id, 1
FROM equipos e, usuarios u
WHERE e.nombre = 'Sistema'
  AND (u.is_superadmin = 1 OR u.is_superadmin = TRUE)
  AND NOT EXISTS (
    SELECT 1 FROM equipo_usuarios eu 
    WHERE eu.usuario_id = u.id AND eu.fecha_salida IS NULL
  );

-- Admins como miembros
INSERT INTO equipo_usuarios (equipo_id, usuario_id, es_lider)
SELECT e.id, u.id, 0
FROM equipos e, usuarios u
WHERE e.nombre = 'Sistema'
  AND u.rol = 'admin'
  AND (u.is_superadmin IS NULL OR u.is_superadmin = 0 OR u.is_superadmin = FALSE)
  AND NOT EXISTS (
    SELECT 1 FROM equipo_usuarios eu 
    WHERE eu.usuario_id = u.id AND eu.fecha_salida IS NULL
  );

-- Demás usuarios como miembros
INSERT INTO equipo_usuarios (equipo_id, usuario_id, es_lider)
SELECT e.id, u.id, 0
FROM equipos e, usuarios u
WHERE e.nombre = 'Sistema'
  AND (u.rol IS NULL OR u.rol NOT IN ('admin', 'superadmin'))
  AND u.id NOT IN (
    SELECT eu.usuario_id FROM equipo_usuarios eu WHERE eu.fecha_salida IS NULL
  );
```

### 10.3 Migración 03 — Insertar Permisos de Roles

```sql
-- LÍDER
INSERT INTO permisos_roles (rol, permiso)
SELECT 'lider', permiso FROM (VALUES
    ('equipo:ver'), ('equipo:gestionar'),
    ('agentes:ver'), ('agentes:crear'), ('agentes:editar'), ('agentes:desactivar'),
    ('campañas:ver'), ('campañas:crear'), ('campañas:gestionar'), ('campañas:asignar'),
    ('solicitudes:importar'), ('solicitudes:ver-equipo'),
    ('solicitudes:asignar'), ('solicitudes:reasignar'), ('solicitudes:ver-asignaciones'),
    ('gestiones:ver-equipo'),
    ('dashboard:ver-equipo'), ('dashboard:ver-agentes'),
    ('relaciones:ver-equipo'),
    ('historial:ver-equipo')
) AS p(permiso)
WHERE NOT EXISTS (SELECT 1 FROM permisos_roles WHERE rol = 'lider' AND permiso = p.permiso);

-- AGENTE
INSERT INTO permisos_roles (rol, permiso)
SELECT 'agente', permiso FROM (VALUES
    ('campañas:ver-propias'),
    ('solicitudes:ver-asignadas'), ('solicitudes:gestionar'),
    ('solicitudes:editar-estado'), ('solicitudes:completar-info'),
    ('gestiones:crear'), ('gestiones:ver-propias'), ('gestiones:editar'),
    ('relaciones:gestionar'),
    ('historial:ver-propio'),
    ('perfil:ver'), ('perfil:editar')
) AS p(permiso)
WHERE NOT EXISTS (SELECT 1 FROM permisos_roles WHERE rol = 'agente' AND permiso = p.permiso);

-- USER (mantener compatibilidad)
INSERT INTO permisos_roles (rol, permiso)
SELECT 'user', permiso FROM (VALUES
    ('solicitudes:importar'), ('solicitudes:ver-propias'), ('solicitudes:gestionar'),
    ('solicitudes:editar-estado'), ('solicitudes:completar-info'),
    ('campañas:crear'), ('campañas:gestionar'),
    ('gestiones:crear'), ('gestiones:ver-propias'), ('gestiones:editar'),
    ('relaciones:gestionar'),
    ('ventas:gestionar'),
    ('historial:ver-propio'),
    ('perfil:ver'), ('perfil:editar')
) AS p(permiso)
WHERE NOT EXISTS (SELECT 1 FROM permisos_roles WHERE rol = 'user' AND permiso = p.permiso);
```

---

## 11. ÍNDICES — RESUMEN COMPLETO

### 11.1 Nuevos Índices (6 tablas nuevas)

| # | Tabla | Índice | Columnas | PG | SQLite |
|:-:|-------|--------|----------|:--:|:------:|
| 1 | `equipos` | `equipos_nombre_unique` | `nombre` | ✅ | ✅ |
| 2 | `equipos` | `idx_equipos_activo` | `activo` | ✅ | ✅ |
| 3 | `equipo_usuarios` | `idx_equipo_usuarios_usuario_activo` | `(usuario_id, fecha_salida)` | ✅ | ✅ |
| 4 | `equipo_usuarios` | `idx_equipo_usuarios_equipo` | `(equipo_id, es_lider, fecha_salida)` | ✅ | ✅ |
| 5 | `equipo_usuarios` | `idx_equipo_usuarios_lider` | `(equipo_id, es_lider)` WHERE | ✅ | ✅ (sin WHERE) |
| 6 | `permisos_roles` | `permisos_roles_rol_permiso_unique` | `(rol, permiso)` | ✅ | ✅ |
| 7 | `permisos_roles` | `idx_permisos_roles_rol` | `rol` | ✅ | ✅ |
| 8 | `permisos_equipo` | `permisos_equipo_equipo_permiso_unique` | `(equipo_id, permiso)` | ✅ | ✅ |
| 9 | `permisos_equipo` | `idx_permisos_equipo_equipo` | `equipo_id` | ✅ | ✅ |
| 10 | `asignaciones_solicitudes` | `idx_asignaciones_solicitud_activa` | `(solicitud_id, fecha_desasignacion)` | ✅ | ✅ |
| 11 | `asignaciones_solicitudes` | `idx_asignaciones_usuario_activas` | `(usuario_id, fecha_desasignacion)` | ✅ (partial) | ✅ |
| 12 | `asignaciones_solicitudes` | `idx_asignaciones_equipo_activas` | `(equipo_id, fecha_desasignacion)` | ✅ | ✅ |
| 13 | `asignaciones_solicitudes` | `idx_asignaciones_campaña` | `(desde_campaña_id, fecha_desasignacion)` | ✅ | ✅ |
| 14 | `asignaciones_solicitudes` | `idx_asignaciones_fecha` | `fecha_asignacion DESC` | ✅ | ✅ |
| 15 | `campañas_equipo` | `campañas_equipo_campaña_unique` | `campaña_id` | ✅ | ✅ |
| 16 | `campañas_equipo` | `idx_campañas_equipo_equipo` | `equipo_id` | ✅ | ✅ |

### 11.2 Nuevos Índices (tablas modificadas)

| # | Tabla | Índice | Columnas | PG | SQLite |
|:-:|-------|--------|----------|:--:|:------:|
| 17 | `gestiones_maestro` | `idx_gestiones_maestro_equipo` | `equipo_id` | ✅ | ✅ |

### 11.3 Total de Índices

| Tipo | Cantidad |
|:----:|:--------:|
| Índices existentes en el sistema | 26 |
| Nuevos índices (FASE 2) | 17 |
| **Total después de migración** | **43** |

---

## 12. MIGRACIONES SQL

### 12.1 Migración 01: Crear Tablas Nuevas

#### PostgreSQL (`migrations/003_create_team_tables.pg.sql`)

```sql
-- ============================================================================
-- MIGRACIÓN 003: Crear tablas del sistema multi-equipo
-- ============================================================================
-- Fecha: Julio 2026
-- Descripción: Agrega 6 nuevas tablas para soportar la arquitectura
--              organizacional basada en equipos.
-- Rollback: docs/rollback/003_rollback_team_tables.sql
-- ============================================================================

BEGIN;

-- 1. equipos
CREATE TABLE IF NOT EXISTS equipos (
    id              SERIAL PRIMARY KEY,
    nombre          VARCHAR(100) UNIQUE NOT NULL,
    descripcion     TEXT,
    activo          INTEGER DEFAULT 1 NOT NULL CHECK (activo IN (0, 1)),
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_equipos_activo ON equipos(activo);

-- 2. equipo_usuarios
CREATE TABLE IF NOT EXISTS equipo_usuarios (
    id              SERIAL PRIMARY KEY,
    equipo_id       INTEGER NOT NULL REFERENCES equipos(id) ON DELETE CASCADE,
    usuario_id      INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    es_lider        INTEGER DEFAULT 0 NOT NULL CHECK (es_lider IN (0, 1)),
    fecha_ingreso   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_salida    TIMESTAMP,
    motivo_salida   TEXT,
    UNIQUE(usuario_id, fecha_salida)
);

CREATE INDEX IF NOT EXISTS idx_equipo_usuarios_usuario_activo 
    ON equipo_usuarios(usuario_id, fecha_salida);
CREATE INDEX IF NOT EXISTS idx_equipo_usuarios_equipo 
    ON equipo_usuarios(equipo_id, es_lider, fecha_salida);
CREATE INDEX IF NOT EXISTS idx_equipo_usuarios_lider 
    ON equipo_usuarios(equipo_id, es_lider) WHERE es_lider = 1 AND fecha_salida IS NULL;

-- 3. permisos_roles
CREATE TABLE IF NOT EXISTS permisos_roles (
    id              SERIAL PRIMARY KEY,
    rol             VARCHAR(20) NOT NULL,
    permiso         VARCHAR(100) NOT NULL,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(rol, permiso)
);

CREATE INDEX IF NOT EXISTS idx_permisos_roles_rol ON permisos_roles(rol);

-- 4. permisos_equipo
CREATE TABLE IF NOT EXISTS permisos_equipo (
    id              SERIAL PRIMARY KEY,
    equipo_id       INTEGER NOT NULL REFERENCES equipos(id) ON DELETE CASCADE,
    permiso         VARCHAR(100) NOT NULL,
    concedido_por   INTEGER REFERENCES usuarios(id),
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(equipo_id, permiso)
);

CREATE INDEX IF NOT EXISTS idx_permisos_equipo_equipo ON permisos_equipo(equipo_id);

-- 5. asignaciones_solicitudes
CREATE TABLE IF NOT EXISTS asignaciones_solicitudes (
    id                  SERIAL PRIMARY KEY,
    solicitud_id        INTEGER NOT NULL,
    equipo_id           INTEGER NOT NULL REFERENCES equipos(id),
    usuario_id          INTEGER REFERENCES usuarios(id),
    asignado_por        INTEGER NOT NULL REFERENCES usuarios(id),
    desde_campaña_id    INTEGER,
    tipo_asignacion     VARCHAR(20) DEFAULT 'manual'
                        CHECK (tipo_asignacion IN ('manual', 'automatica', 'campaña', 'importacion')),
    fecha_asignacion    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_desasignacion TIMESTAMP,
    motivo_desasignacion TEXT,
    UNIQUE(solicitud_id, fecha_desasignacion)
);

CREATE INDEX IF NOT EXISTS idx_asignaciones_solicitud_activa 
    ON asignaciones_solicitudes(solicitud_id, fecha_desasignacion);
CREATE INDEX IF NOT EXISTS idx_asignaciones_usuario_activas 
    ON asignaciones_solicitudes(usuario_id, fecha_desasignacion) WHERE usuario_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_asignaciones_equipo_activas 
    ON asignaciones_solicitudes(equipo_id, fecha_desasignacion);
CREATE INDEX IF NOT EXISTS idx_asignaciones_campaña 
    ON asignaciones_solicitudes(desde_campaña_id, fecha_desasignacion);
CREATE INDEX IF NOT EXISTS idx_asignaciones_fecha 
    ON asignaciones_solicitudes(fecha_asignacion DESC);

-- 6. campañas_equipo
CREATE TABLE IF NOT EXISTS campañas_equipo (
    id              SERIAL PRIMARY KEY,
    campaña_id      INTEGER NOT NULL,
    equipo_id       INTEGER NOT NULL REFERENCES equipos(id) ON DELETE CASCADE,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(campaña_id)
);

CREATE INDEX IF NOT EXISTS idx_campañas_equipo_equipo ON campañas_equipo(equipo_id);

-- 7. Modificar gestiones_maestro
ALTER TABLE gestiones_maestro 
ADD COLUMN IF NOT EXISTS equipo_id INTEGER REFERENCES equipos(id);

CREATE INDEX IF NOT EXISTS idx_gestiones_maestro_equipo 
    ON gestiones_maestro(equipo_id);

COMMIT;
```

#### SQLite (`migrations/003_create_team_tables.sqlite.sql`)

```sql
-- ============================================================================
-- MIGRACIÓN 003: Crear tablas del sistema multi-equipo (SQLite)
-- ============================================================================

-- 1. equipos
CREATE TABLE IF NOT EXISTS equipos (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre          TEXT UNIQUE NOT NULL,
    descripcion     TEXT,
    activo          INTEGER DEFAULT 1 NOT NULL,
    created_at      TEXT DEFAULT (datetime('now')),
    updated_at      TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_equipos_activo ON equipos(activo);

-- 2. equipo_usuarios
CREATE TABLE IF NOT EXISTS equipo_usuarios (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    equipo_id       INTEGER NOT NULL,
    usuario_id      INTEGER NOT NULL,
    es_lider        INTEGER DEFAULT 0 NOT NULL,
    fecha_ingreso   TEXT DEFAULT (datetime('now')),
    fecha_salida    TEXT,
    motivo_salida   TEXT,
    FOREIGN KEY (equipo_id) REFERENCES equipos(id) ON DELETE CASCADE,
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
    UNIQUE(usuario_id, fecha_salida)
);

CREATE INDEX IF NOT EXISTS idx_equipo_usuarios_usuario_activo 
    ON equipo_usuarios(usuario_id, fecha_salida);
CREATE INDEX IF NOT EXISTS idx_equipo_usuarios_equipo 
    ON equipo_usuarios(equipo_id, es_lider, fecha_salida);
CREATE INDEX IF NOT EXISTS idx_equipo_usuarios_lider 
    ON equipo_usuarios(equipo_id, es_lider);

-- 3. permisos_roles
CREATE TABLE IF NOT EXISTS permisos_roles (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    rol             TEXT NOT NULL,
    permiso         TEXT NOT NULL,
    created_at      TEXT DEFAULT (datetime('now')),
    UNIQUE(rol, permiso)
);

CREATE INDEX IF NOT EXISTS idx_permisos_roles_rol ON permisos_roles(rol);

-- 4. permisos_equipo
CREATE TABLE IF NOT EXISTS permisos_equipo (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    equipo_id       INTEGER NOT NULL,
    permiso         TEXT NOT NULL,
    concedido_por   INTEGER,
    created_at      TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (equipo_id) REFERENCES equipos(id) ON DELETE CASCADE,
    FOREIGN KEY (concedido_por) REFERENCES usuarios(id),
    UNIQUE(equipo_id, permiso)
);

CREATE INDEX IF NOT EXISTS idx_permisos_equipo_equipo ON permisos_equipo(equipo_id);

-- 5. asignaciones_solicitudes
CREATE TABLE IF NOT EXISTS asignaciones_solicitudes (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    solicitud_id        INTEGER NOT NULL,
    equipo_id           INTEGER NOT NULL,
    usuario_id          INTEGER,
    asignado_por        INTEGER NOT NULL,
    desde_campaña_id    INTEGER,
    tipo_asignacion     TEXT DEFAULT 'manual',
    fecha_asignacion    TEXT DEFAULT (datetime('now')),
    fecha_desasignacion TEXT,
    motivo_desasignacion TEXT,
    FOREIGN KEY (equipo_id) REFERENCES equipos(id),
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id),
    FOREIGN KEY (asignado_por) REFERENCES usuarios(id),
    UNIQUE(solicitud_id, fecha_desasignacion)
);

CREATE INDEX IF NOT EXISTS idx_asignaciones_solicitud_activa 
    ON asignaciones_solicitudes(solicitud_id, fecha_desasignacion);
CREATE INDEX IF NOT EXISTS idx_asignaciones_usuario_activas 
    ON asignaciones_solicitudes(usuario_id, fecha_desasignacion);
CREATE INDEX IF NOT EXISTS idx_asignaciones_equipo_activas 
    ON asignaciones_solicitudes(equipo_id, fecha_desasignacion);
CREATE INDEX IF NOT EXISTS idx_asignaciones_campaña 
    ON asignaciones_solicitudes(desde_campaña_id, fecha_desasignacion);
CREATE INDEX IF NOT EXISTS idx_asignaciones_fecha 
    ON asignaciones_solicitudes(fecha_asignacion DESC);

-- 6. campañas_equipo
CREATE TABLE IF NOT EXISTS campañas_equipo (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    campaña_id      INTEGER NOT NULL,
    equipo_id       INTEGER NOT NULL,
    created_at      TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (equipo_id) REFERENCES equipos(id) ON DELETE CASCADE,
    UNIQUE(campaña_id)
);

CREATE INDEX IF NOT EXISTS idx_campañas_equipo_equipo ON campañas_equipo(equipo_id);

-- 7. Modificar gestiones_maestro
ALTER TABLE gestiones_maestro ADD COLUMN equipo_id INTEGER;

CREATE INDEX IF NOT EXISTS idx_gestiones_maestro_equipo 
    ON gestiones_maestro(equipo_id);
```

### 12.2 Migración 02: Seed Data

#### PostgreSQL (`migrations/003_seed_team_data.pg.sql`)

```sql
-- ============================================================================
-- MIGRACIÓN 003b: Seed data para el sistema multi-equipo
-- ============================================================================
-- Debe ejecutarse DESPUÉS de 003_create_team_tables
-- ============================================================================

BEGIN;

-- 1. Crear equipo Sistema
INSERT INTO equipos (nombre, descripcion)
SELECT 'Sistema', 'Equipo por defecto creado durante la migración. Todos los usuarios actuales pertenecen aquí inicialmente.'
WHERE NOT EXISTS (SELECT 1 FROM equipos WHERE nombre = 'Sistema');

-- 2. Asignar SUPERADMIN como líder
INSERT INTO equipo_usuarios (equipo_id, usuario_id, es_lider)
SELECT e.id, u.id, 1
FROM equipos e, usuarios u
WHERE e.nombre = 'Sistema'
  AND (u.is_superadmin = TRUE)
  AND NOT EXISTS (
    SELECT 1 FROM equipo_usuarios eu 
    WHERE eu.usuario_id = u.id AND eu.fecha_salida IS NULL
  );

-- 3. Asignar ADMIN como miembros
INSERT INTO equipo_usuarios (equipo_id, usuario_id, es_lider)
SELECT e.id, u.id, 0
FROM equipos e, usuarios u
WHERE e.nombre = 'Sistema'
  AND u.rol = 'admin'
  AND (u.is_superadmin IS NULL OR u.is_superadmin = FALSE)
  AND NOT EXISTS (
    SELECT 1 FROM equipo_usuarios eu 
    WHERE eu.usuario_id = u.id AND eu.fecha_salida IS NULL
  );

-- 4. Asignar demás usuarios como miembros
INSERT INTO equipo_usuarios (equipo_id, usuario_id, es_lider)
SELECT e.id, u.id, 0
FROM equipos e, usuarios u
WHERE e.nombre = 'Sistema'
  AND (u.rol IS NULL OR u.rol NOT IN ('admin', 'superadmin'))
  AND u.id NOT IN (
    SELECT eu.usuario_id FROM equipo_usuarios eu WHERE eu.fecha_salida IS NULL
  );

-- 5. Insertar permisos de líder
INSERT INTO permisos_roles (rol, permiso)
SELECT v.rol, v.permiso FROM (VALUES
    ('lider', 'equipo:ver'), ('lider', 'equipo:gestionar'),
    ('lider', 'agentes:ver'), ('lider', 'agentes:crear'),
    ('lider', 'agentes:editar'), ('lider', 'agentes:desactivar'),
    ('lider', 'campañas:ver'), ('lider', 'campañas:crear'),
    ('lider', 'campañas:gestionar'), ('lider', 'campañas:asignar'),
    ('lider', 'solicitudes:importar'), ('lider', 'solicitudes:ver-equipo'),
    ('lider', 'solicitudes:asignar'), ('lider', 'solicitudes:reasignar'),
    ('lider', 'solicitudes:ver-asignaciones'),
    ('lider', 'gestiones:ver-equipo'),
    ('lider', 'dashboard:ver-equipo'), ('lider', 'dashboard:ver-agentes'),
    ('lider', 'relaciones:ver-equipo'),
    ('lider', 'historial:ver-equipo')
) AS v(rol, permiso)
WHERE NOT EXISTS (
    SELECT 1 FROM permisos_roles pr 
    WHERE pr.rol = v.rol AND pr.permiso = v.permiso
);

-- 6. Insertar permisos de agente
INSERT INTO permisos_roles (rol, permiso)
SELECT v.rol, v.permiso FROM (VALUES
    ('agente', 'campañas:ver-propias'),
    ('agente', 'solicitudes:ver-asignadas'), ('agente', 'solicitudes:gestionar'),
    ('agente', 'solicitudes:editar-estado'), ('agente', 'solicitudes:completar-info'),
    ('agente', 'gestiones:crear'), ('agente', 'gestiones:ver-propias'),
    ('agente', 'gestiones:editar'),
    ('agente', 'relaciones:gestionar'),
    ('agente', 'historial:ver-propio'),
    ('agente', 'perfil:ver'), ('agente', 'perfil:editar')
) AS v(rol, permiso)
WHERE NOT EXISTS (
    SELECT 1 FROM permisos_roles pr 
    WHERE pr.rol = v.rol AND pr.permiso = v.permiso
);

-- 7. Insertar permisos de user (mantener compatibilidad)
INSERT INTO permisos_roles (rol, permiso)
SELECT v.rol, v.permiso FROM (VALUES
    ('user', 'solicitudes:importar'), ('user', 'solicitudes:ver-propias'),
    ('user', 'solicitudes:gestionar'), ('user', 'solicitudes:editar-estado'),
    ('user', 'solicitudes:completar-info'),
    ('user', 'campañas:crear'), ('user', 'campañas:gestionar'),
    ('user', 'gestiones:crear'), ('user', 'gestiones:ver-propias'),
    ('user', 'gestiones:editar'),
    ('user', 'relaciones:gestionar'), ('user', 'ventas:gestionar'),
    ('user', 'historial:ver-propio'),
    ('user', 'perfil:ver'), ('user', 'perfil:editar')
) AS v(rol, permiso)
WHERE NOT EXISTS (
    SELECT 1 FROM permisos_roles pr 
    WHERE pr.rol = v.rol AND pr.permiso = v.permiso
);

COMMIT;
```

#### SQLite (`migrations/003_seed_team_data.sqlite.sql`)

```sql
-- ============================================================================
-- MIGRACIÓN 003b: Seed data para el sistema multi-equipo (SQLite)
-- ============================================================================

-- 1. Crear equipo Sistema
INSERT OR IGNORE INTO equipos (nombre, descripcion)
VALUES ('Sistema', 'Equipo por defecto creado durante la migración.');

-- 2. Asignar SUPERADMIN como líder
INSERT OR IGNORE INTO equipo_usuarios (equipo_id, usuario_id, es_lider)
SELECT e.id, u.id, 1
FROM equipos e, usuarios u
WHERE e.nombre = 'Sistema'
  AND (u.is_superadmin = 1);

-- 3. Asignar ADMIN como miembros
INSERT OR IGNORE INTO equipo_usuarios (equipo_id, usuario_id, es_lider)
SELECT e.id, u.id, 0
FROM equipos e, usuarios u
WHERE e.nombre = 'Sistema'
  AND u.rol = 'admin'
  AND (u.is_superadmin IS NULL OR u.is_superadmin = 0);

-- 4. Asignar demás usuarios como miembros
INSERT OR IGNORE INTO equipo_usuarios (equipo_id, usuario_id, es_lider)
SELECT e.id, u.id, 0
FROM equipos e, usuarios u
WHERE e.nombre = 'Sistema'
  AND (u.rol IS NULL OR u.rol NOT IN ('admin', 'superadmin'))
  AND u.id NOT IN (
    SELECT eu.usuario_id FROM equipo_usuarios eu WHERE eu.fecha_salida IS NULL
  );

-- 5-7. Insertar permisos (con INSERT OR IGNORE para evitar duplicados)
INSERT OR IGNORE INTO permisos_roles (rol, permiso) VALUES
    ('lider', 'equipo:ver'), ('lider', 'equipo:gestionar'),
    ('lider', 'agentes:ver'), ('lider', 'agentes:crear'),
    ('lider', 'agentes:editar'), ('lider', 'agentes:desactivar'),
    ('lider', 'campañas:ver'), ('lider', 'campañas:crear'),
    ('lider', 'campañas:gestionar'), ('lider', 'campañas:asignar'),
    ('lider', 'solicitudes:importar'), ('lider', 'solicitudes:ver-equipo'),
    ('lider', 'solicitudes:asignar'), ('lider', 'solicitudes:reasignar'),
    ('lider', 'solicitudes:ver-asignaciones'),
    ('lider', 'gestiones:ver-equipo'),
    ('lider', 'dashboard:ver-equipo'), ('lider', 'dashboard:ver-agentes'),
    ('lider', 'relaciones:ver-equipo'), ('lider', 'historial:ver-equipo'),
    ('agente', 'campañas:ver-propias'),
    ('agente', 'solicitudes:ver-asignadas'), ('agente', 'solicitudes:gestionar'),
    ('agente', 'solicitudes:editar-estado'), ('agente', 'solicitudes:completar-info'),
    ('agente', 'gestiones:crear'), ('agente', 'gestiones:ver-propias'),
    ('agente', 'gestiones:editar'),
    ('agente', 'relaciones:gestionar'),
    ('agente', 'historial:ver-propio'),
    ('agente', 'perfil:ver'), ('agente', 'perfil:editar'),
    ('user', 'solicitudes:importar'), ('user', 'solicitudes:ver-propias'),
    ('user', 'solicitudes:gestionar'), ('user', 'solicitudes:editar-estado'),
    ('user', 'solicitudes:completar-info'),
    ('user', 'campañas:crear'), ('user', 'campañas:gestionar'),
    ('user', 'gestiones:crear'), ('user', 'gestiones:ver-propias'),
    ('user', 'gestiones:editar'),
    ('user', 'relaciones:gestionar'), ('user', 'ventas:gestionar'),
    ('user', 'historial:ver-propio'),
    ('user', 'perfil:ver'), ('user', 'perfil:editar');
```

### 12.3 Rollback Completo

#### PostgreSQL (`migrations/003_rollback_team_tables.sql`)

```sql
-- ============================================================================
-- ROLLBACK 003: Revertir tablas del sistema multi-equipo
-- ============================================================================
-- ADVERTENCIA: Esto eliminará TODOS los datos de equipos y asignaciones.
-- Solo ejecutar si es necesario revertir completamente la migración.
-- ============================================================================

BEGIN;

-- Eliminar columna de gestiones_maestro
DROP INDEX IF EXISTS idx_gestiones_maestro_equipo;
ALTER TABLE gestiones_maestro DROP COLUMN IF EXISTS equipo_id;

-- Eliminar tablas nuevas (orden inverso por foreign keys)
DROP TABLE IF EXISTS campañas_equipo;
DROP TABLE IF EXISTS asignaciones_solicitudes;
DROP TABLE IF EXISTS permisos_equipo;
DROP TABLE IF EXISTS permisos_roles;
DROP TABLE IF EXISTS equipo_usuarios;
DROP TABLE IF EXISTS equipos;

COMMIT;
```

#### SQLite (`migrations/003_rollback_team_tables.sqlite.sql`)

```sql
-- ============================================================================
-- ROLLBACK 003: Revertir tablas del sistema multi-equipo (SQLite)
-- ============================================================================

DROP INDEX IF EXISTS idx_gestiones_maestro_equipo;
ALTER TABLE gestiones_maestro DROP COLUMN equipo_id;

DROP TABLE IF EXISTS campañas_equipo;
DROP TABLE IF EXISTS asignaciones_solicitudes;
DROP TABLE IF EXISTS permisos_equipo;
DROP TABLE IF EXISTS permisos_roles;
DROP TABLE IF EXISTS equipo_usuarios;
DROP TABLE IF EXISTS equipos;
```

---

## RESUMEN FINAL

| Ítem | Cantidad |
|:----|:--------:|
| **Tablas nuevas** | **6** |
| **Tablas modificadas** | **1** (`gestiones_maestro` + columna) |
| **Tablas sin cambios** | **10** |
| **Columnas nuevas** | **38** (6 tablas × ~6 columnas promedio) |
| **Índices nuevos** | **17** |
| **FKs nuevas** | **10** formales + 2 lógicas |
| **Permisos de rol definidos** | **47** (20 líder + 12 agente + 15 user) |
| **Scripts SQL generados** | **6** (create PG, create SQLite, seed PG, seed SQLite, rollback PG, rollback SQLite) |
| **Migraciones para FASE 3** | **2 migraciones** (create tables + seed data) |

---

*Documento generado por Buffy (AI Agent) — 12 de Julio de 2026*
*Proyecto: ARCHIVOX v3.0 — Evolución a Plataforma Multi-Equipo*
*Siguiente fase: FASE 3 — Generación de migraciones ejecutables + scripts de rollback*
