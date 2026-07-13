# INFORME DE AUDITORÍA — Flujo Multi-Equipo para Asignación de Campañas

## ARCHIVOX v3.0 — Auditoría Funcional Completa

**Fecha:** Julio 2026
**Objetivo:** Auditoría completa del flujo actual antes de implementar la distribución de trabajo del Líder hacia sus Agentes.

---

## 📋 TABLA DE CONTENIDOS

1. [Arquitectura Actual](#1-arquitectura-actual)
2. [Flujo Real del Código: Creación de Campaña](#2-flujo-real-del-código-creación-de-campaña)
3. [Flujo de Solicitudes](#3-flujo-de-solicitudes)
4. [Flujo de Gestiones](#4-flujo-de-gestiones)
5. [Sistema Multi-Equipo Actual](#5-sistema-multi-equipo-actual)
6. [Tablas Involucradas](#6-tablas-involucradas)
7. [Endpoints Involucrados](#7-endpoints-involucrados)
8. [Consultas SQL Involucradas](#8-consultas-sql-involucradas)
9. [Frontend Involucrado](#9-frontend-involucrado)
10. [Backend Involucrado](#10-backend-involucrado)
11. [Componentes Reutilizables](#11-componentes-reutilizables)
12. [Problemas y Conflictos Encontrados](#12-problemas-y-conflictos-encontrados)
13. [Estrategia de Integración Recomendada](#13-estrategia-de-integración-recomendada)

---

## 1. ARQUITECTURA ACTUAL

### 1.1 Modelo de Datos Actual

```
usuarios (rol: 'user' | 'lider' | 'agente' | 'admin' | 'superadmin')
  ├── id, username, nombre, email, is_superadmin, is_active
  ├── equipo_id, equipo_nombre, es_lider (en sesión, NO en tabla)
  └── ─ → gestiones_maestro (usuario_id = dueño de la campaña)
  
equipos
  ├── id, nombre, descripcion, activo
  └── ─ → equipo_usuarios

equipo_usuarios
  ├── equipo_id, usuario_id, es_lider, fecha_ingreso, fecha_salida
  └── (un usuario activo pertenece a EXACTAMENTE un equipo)

gestiones_maestro (campañas)
  ├── id, nombre, descripcion, usuario_id, equipo_id (nullable)
  ├── total_solicitudes, gestionadas, estado, fecha_limite
  └── solicitudes_ids (JSON array de IDs)

solicitudes
  └── id_solicitud, usuario_id, estado, segmento, cedula, nombre, ...

gestiones
  └── id, solicitud_id, usuario_id, tipo_gestion, observacion, gestion_maestro_id

asignaciones_solicitudes
  ├── solicitud_id, equipo_id, usuario_id (nullable)
  ├── asignado_por, fecha_asignacion, fecha_desasignacion
  └── (soporta asignación a equipo + agente opcional)

campañas_equipo
  └── campaña_id, equipo_id

permisos_roles / permisos_equipo
  └── (no utilizados actualmente en el flujo operativo)
```

### 1.2 Jerarquía de Roles (Niveles)

| Rol | Nivel | Descripción |
|-----|-------|-------------|
| superadmin | 100 | Control total del sistema |
| admin | 50 | Administración del sistema |
| lider | 30 | Gestiona su equipo y agentes |
| agente | 20 | Opera sobre asignaciones |
| user | 10 | Compatibilidad (herencia) |

### 1.3 Estado Actual de la Implementación Multi-Equipo

**YA FUNCIONA:**
✅ Registro con equipo_id/es_lider en sesión
✅ Login con migración automática de líderes
✅ Gestión de equipos (CRUD)
✅ Gestión de agentes (crear, editar, activar/desactivar, reset password)
✅ Asignación de líderes
✅ Dashboard de equipo
✅ Panel de administración multi-equipo
✅ `equipo_id` en `gestiones_maestro` (columna creada pero NO USADA)

**NO FUNCIONA / PENDIENTE:**
❌ `usuario_id` en `gestiones_maestro` sigue siendo el dueño individual (NO el equipo)
❌ `equipo_id` en `gestiones_maestro` existe pero NO se asigna al crear campaña
❌ Las solicitudes NO se filtran por equipo
❌ Los agentes NO ven campañas de su equipo
❌ No existe asignación de campañas a agentes
❌ `asignaciones_solicitudes` tabla creada pero NO USADA
❌ `campañas_equipo` tabla creada pero NO USADA

---

## 2. FLUJO REAL DEL CÓDIGO: CREACIÓN DE CAMPAÑA

### 2.1 Proceso Completo (Paso a Paso)

#### PASO 1: Selección de solicitudes (Frontend)
**Archivo:** `public/desktop/js/solicitudes.js`
**Función:** `abrirModalNuevaGestion()` → `crearGestionLote()`

1. Usuario selecciona solicitudes con checkboxes → `filasSeleccionadas` (array de `id_solicitud`)
2. Hace clic en "Crear Campaña" → modal con informe + formulario
3. Completa nombre, descripción, tipo, fecha límite
4. Llama a `fetch('/api/gestiones-maestro', { method: 'POST', body: { nombre, descripcion, fecha_limite, solicitudes_ids } })`

#### PASO 2: Creación en Backend
**Archivo:** `src/controllers/gestionesMaestro.controller.js`
**Función:** `createGestionMaestro()`

```javascript
// SQL ejecutado:
INSERT INTO gestiones_maestro 
  (nombre, descripcion, usuario_id, total_solicitudes, gestionadas, fecha_limite, solicitudes_ids)
VALUES (?, ?, ?, ?, 0, ?, ?)
```

**Detalles críticos:**
- `usuario_id` = el ID del usuario que crea la campaña (puede ser líder o user legacy)
- **`equipo_id` NO se asigna** aunque la columna existe en la tabla
- Las solicitudes se guardan como JSON (`solicitudes_ids`) dentro del registro
- NO se insertan registros en `gestiones` al crear (optimización implementada)

#### PASO 3: Redirección
El frontend redirige a: `window.location.href = '/gestion-lote?id=' + resultado.id`

### 2.2 ¿Cómo se obtienen solicitudes disponibles?

**Endpoint:** `GET /api/excel/solicitudes` o `GET /api/excel/solicitudes/buscar?q=...`

**Archivo:** `src/controllers/excel.controller.js`
**Función:** `listarSolicitudes()` o `buscarSolicitudes()`

```sql
SELECT s.*, g.tipo_gestion, g.observacion, g.fecha_gestion
FROM solicitudes s
LEFT JOIN LATERAL (
    SELECT g2.tipo_gestion, g2.observacion, g2.fecha_gestion
    FROM gestiones g2
    WHERE g2.solicitud_id = s.id_solicitud 
      AND g2.usuario_id = s.usuario_id
    ORDER BY g2.fecha_gestion DESC
    LIMIT 1
) g ON TRUE
WHERE s.usuario_id = $1
```

**CRÍTICO:** Las solicitudes se filtran por `s.usuario_id`.  
Esto significa:
- Un Líder solo ve SUS solicitudes (las que él importó)
- Un Agente solo ve SUS solicitudes
- **NO existe un pool de solicitudes compartidas por equipo**

### 2.3 ¿Cómo se obtienen las campañas del usuario?

**Endpoint:** `GET /api/gestiones-maestro`

```sql
SELECT * FROM gestiones_maestro WHERE usuario_id = ? ORDER BY created_at DESC
```

**CRÍTICO:** Filtra por `usuario_id`, no por `equipo_id`.  
Un agente NO ve las campañas del líder.  
Un líder NO ve las campañas de sus agentes.

### 2.4 ¿Cómo se visualiza una campaña?

**Endpoint:** `GET /api/gestiones-maestro/:id`

**Archivo:** `src/controllers/gestionesMaestro.controller.js`
**Función:** `getGestionMaestroById()`

```sql
-- Validación de propietario:
SELECT * FROM gestiones_maestro WHERE id = ? AND usuario_id = ?

-- Luego obtiene solicitudes por los IDs en solicitudes_ids:
SELECT s.*, COALESCE(g.tipo_gestion, 'Pendiente'), COALESCE(g.observacion, 'Por gestionar'), ...
FROM solicitudes s
LEFT JOIN gestiones g ON g.id = (SELECT MAX(g2.id) FROM gestiones g2 WHERE g2.solicitud_id = s.id_solicitud ...)
WHERE s.id_solicitud IN (${placeholders})
```

**CRÍTICO:** La validación `usuario_id = ?` impide que un agente vea campañas del líder.

---

## 3. FLUJO DE SOLICITUDES

### 3.1 Ciclo de Vida de una Solicitud

```
Importación Excel (POST /api/excel/upload)
    ↓
Solicitud creada con usuario_id = usuario importador
    ↓
Aparece en listado del usuario (GET /api/excel/solicitudes?usuario_id=X)
    ↓
Usuario la selecciona + crea campaña → solicitudes_ids en gestiones_maestro
    ↓
Líder/Agente gestiona la solicitud (POST /api/excel/gestiones)
```

### 3.2 ¿Quién puede ver qué solicitudes?

| Rol | Solicitudes visibles | Filtro SQL |
|-----|---------------------|------------|
| superadmin | Todas (vía admin panel) | Sin filtro |
| líder | Solo las que él importó | `usuario_id = líder.id` |
| agente | Solo las que él importó | `usuario_id = agente.id` |
| user legacy | Solo las que él importó | `usuario_id = user.id` |

**PROBLEMA:** Las solicitudes son **propiedad individual** de quien las importó.  
No hay concepto de "solicitudes del equipo".

### 3.3 Tablas y Campos Relevantes

**Tabla `solicitudes`:**
- `id_solicitud` (PK)
- `usuario_id` → dueño de la solicitud
- `estado`, `segmento`, `cedula`, `nombre`, `celular`, `producto`
- `fecha_solicitud`, `fecha_actualizacion`
- `codigo_plus`, `correo_electronico`, `direccion`, etc.

**NO tiene:** `equipo_id`, ni referencia a asignaciones.

---

## 4. FLUJO DE GESTIONES

### 4.1 ¿Cómo se crea una gestión individual?

**Endpoint:** `POST /api/excel/gestiones`

```sql
INSERT INTO gestiones (solicitud_id, usuario_id, tipo_gestion, observacion, gestion_maestro_id)
VALUES (?, ?, ?, ?, ?)

-- Si tiene gestion_maestro_id, actualizar contador:
UPDATE gestiones_maestro SET gestionadas = gestionadas + 1 WHERE id = ?
```

### 4.2 ¿Quién puede gestionar qué?

Actualmente:
- Cualquier usuario puede gestionar cualquier solicitud que tenga `usuario_id = su ID`
- Las gestiones quedan vinculadas a `usuario_id` del gestor
- Las gestiones se vinculan a `gestion_maestro_id` (campaña)

**Visualización de gestiones de un equipo:**
**Endpoint:** `GET /api/equipos/:id/gestiones`

```sql
SELECT g.*, u.username as agente_username, ...
FROM gestiones g
INNER JOIN usuarios u ON g.usuario_id = u.id
INNER JOIN equipo_usuarios eu ON u.id = eu.usuario_id
LEFT JOIN solicitudes s ON g.solicitud_id = s.id_solicitud
WHERE eu.equipo_id = ? AND eu.fecha_salida IS NULL
```

Esto YA FUNCIONA — el líder puede ver las gestiones de todos los agentes de su equipo.

---

## 5. SISTEMA MULTI-EQUIPO ACTUAL

### 5.1 ¿Qué funciona del multi-equipo?

#### Login / Sesión
**Archivo:** `src/controllers/auth.controller.js`

En el login se asignan propiedades multi-equipo:
```javascript
req.session.usuario = {
    ...,
    equipo_id,      // ID del equipo al que pertenece
    equipo_nombre,  // Nombre del equipo
    es_lider        // true/false
}
```

#### Equipos (CRUD)
**Archivo:** `src/controllers/equipos.controller.js`

| Endpoint | Función | Descripción |
|----------|---------|-------------|
| `GET /api/equipos` | `listar` | Lista equipos (filtrados por rol) |
| `GET /api/equipos/:id` | `obtener` | Equipo con miembros, campañas, asignaciones |
| `POST /api/equipos` | `crear` | Crear equipo (superadmin) |
| `PUT /api/equipos/:id` | `actualizar` | Actualizar equipo |
| `DELETE /api/equipos/:id` | `eliminar` | Eliminar equipo (CASCADE) |
| `GET /api/equipos/mi-equipo` | `miEquipo` | Equipo del usuario autenticado |
| `GET /api/equipos/:id/dashboard` | `dashboardEquipo` | Dashboard del líder |
| `GET /api/equipos/:id/gestiones` | `gestionesEquipo` | Gestiones de agentes del equipo |
| `GET /api/equipos/:id/campanas` | `campanasEquipo` | Campañas del equipo |

#### Agentes
**Archivo:** `src/controllers/equipos.controller.js`

| Endpoint | Función | Descripción |
|----------|---------|-------------|
| `POST /api/equipos/:id/agentes` | `crearAgente` | Crear agente en equipo |
| `PUT /api/equipos/:id/agentes/:agenteId` | `editarAgente` | Editar datos del agente |
| `PUT /api/equipos/:id/agentes/:agenteId/toggle-active` | `toggleActivoAgente` | Activar/desactivar |
| `PUT /api/equipos/:id/agentes/:agenteId/reset-password` | `resetPasswordAgente` | Resetear contraseña |

### 5.2 ¿Qué NO funciona aún?

#### 1. `equipo_id` en campañas NO se asigna
```sql
-- En createGestionMaestro():
INSERT INTO gestiones_maestro (nombre, descripcion, usuario_id, ...)
-- NOTA: equipo_id no se incluye aunque la columna existe
```

#### 2. No hay filtrado por equipo en consultas
Las campañas se filtran por `usuario_id`, no por `equipo_id`.

#### 3. `asignaciones_solicitudes` no se utiliza
Tabla creada en migración 003 pero sin inserts ni consultas.

#### 4. `campañas_equipo` no se utiliza
Tabla creada pero vacía.

#### 5. Agentes no pueden ver campañas
El endpoint `GET /api/gestiones-maestro` filtra por `usuario_id`, por lo que un agente solo ve campañas que él mismo creó.

#### 6. No existe asignación de campañas a agentes
No hay endpoint ni lógica para que un líder asigne una campaña a un agente.

---

## 6. TABLAS INVOLUCRADAS

### 6.1 Tablas Existentes y su Estado

| Tabla | Estado | Uso en flujo campañas |
|-------|--------|----------------------|
| `solicitudes` | ✅ En uso | Almacena solicitudes importadas |
| `gestiones_maestro` | ✅ En uso | Almacena campañas (gestiones por lote) |
| `gestiones` | ✅ En uso | Almacena gestiones individuales |
| `usuarios` | ✅ En uso | Almacena usuarios con roles |
| `equipos` | ✅ En uso | Catálogo de equipos |
| `equipo_usuarios` | ✅ En uso | Membresía usuarios en equipos |
| `asignaciones_solicitudes` | ⚠️ Creada, NO USADA | Asignación de solicitudes a equipos/agentes |
| `campañas_equipo` | ⚠️ Creada, NO USADA | Relación campaña ↔ equipo |
| `permisos_roles` | ⚠️ Creada, NO USADA | Permisos por rol |
| `permisos_equipo` | ⚠️ Creada, NO USADA | Permisos extra por equipo |
| `historial_actualizaciones` | ✅ En uso | Auditoría de cambios en solicitudes |
| `audit_log` | ✅ En uso | Log de auditoría del sistema |
| `notificaciones` | ✅ En uso | Sistema de notificaciones |
| `solicitudes_referencias` | ✅ En uso | Referencias de solicitudes |
| `ventas_vendedores` | ✅ En uso | Módulo de ventas |
| `config_bonos` | ✅ En uso | Configuración de bonos |

### 6.2 Campos Clave en `gestiones_maestro`

```sql
id                  INTEGER PRIMARY KEY -- AUTOINCREMENT
nombre              VARCHAR(100)        -- Nombre de la campaña
descripcion         TEXT                -- Descripción opcional
usuario_id          INTEGER             -- CREADOR de la campaña (NO asignado)
equipo_id           INTEGER NULL        -- 🆕 COLUMNA EXISTENTE PERO NO USADA
total_solicitudes   INTEGER             -- Cantidad de solicitudes en la campaña
gestionadas         INTEGER             -- Solicitudes gestionadas
estado              VARCHAR(20)         -- Estado (Activa, Completada, etc.)
fecha_limite        DATE                -- Fecha límite opcional
solicitudes_ids     TEXT                -- JSON array de IDs de solicitudes
created_at          TIMESTAMP
updated_at          TIMESTAMP
```

---

## 7. ENDPOINTS INVOLUCRADOS

### 7.1 Endpoints Existentes Relacionados

#### Campañas (Gestiones Maestro)
```
GET    /api/gestiones-maestro              → Listar campañas (filtra por usuario_id)
POST   /api/gestiones-maestro              → Crear campaña (asigna usuario_id)
GET    /api/gestiones-maestro/:id          → Ver campaña (filtra por usuario_id)
PUT    /api/gestiones-maestro/:id          → Actualizar campaña
DELETE /api/gestiones-maestro/:id          → Eliminar campaña (CASCADE gestiones)
GET    /api/gestiones-maestro/:id/progreso → Progreso de campaña
PUT    /api/gestiones-maestro/:id/agregar-solicitudes    → Agregar solicitudes
PUT    /api/gestiones-maestro/:id/quitar-solicitud       → Quitar solicitud
```

#### Solicitudes
```
GET    /api/excel/solicitudes                → Listar solicitudes (filtra por usuario_id)
GET    /api/excel/solicitudes/buscar         → Buscar solicitudes
POST   /api/excel/solicitudes                → Crear solicitud manual
PUT    /api/excel/solicitudes/:id/editar     → Editar estado/segmento
PUT    /api/excel/solicitudes/:id/destacar   → Destacar solicitud
DELETE /api/excel/solicitudes/:id            → Eliminar solicitud
DELETE /api/excel/limpiar                    → Limpiar todas
```

#### Gestiones
```
POST   /api/excel/gestiones                → Crear gestión
GET    /api/excel/gestiones/:solicitud_id   → Gestiones de una solicitud
GET    /api/excel/gestiones/ultimas         → Últimas gestiones (batch)
PUT    /api/excel/gestiones/:id             → Actualizar gestión
DELETE /api/excel/gestiones/:id             → Eliminar gestión
GET    /api/excel/gestiones/todas           → Todas las gestiones con filtros
```

#### Equipos (ya implementado)
```
GET    /api/equipos                         → Listar equipos
GET    /api/equipos/:id                     → Ver equipo
POST   /api/equipos                         → Crear equipo
PUT    /api/equipos/:id                     → Actualizar equipo
DELETE /api/equipos/:id                     → Eliminar equipo
GET    /api/equipos/:id/dashboard           → Dashboard del equipo
GET    /api/equipos/:id/gestiones           → Gestiones del equipo
GET    /api/equipos/:id/campanas            → Campañas del equipo
POST   /api/equipos/:id/agentes             → Crear agente
PUT    /api/equipos/:id/agentes/:agenteId   → Editar agente
```

---

## 8. CONSULTAS SQL INVOLUCRADAS

### 8.1 Listar Campañas (Actual)
```sql
SELECT * FROM gestiones_maestro WHERE usuario_id = ? ORDER BY created_at DESC
```
❌ No incluye `equipo_id`. No permite ver campañas del equipo.

### 8.2 Ver Campaña (Actual)
```sql
SELECT * FROM gestiones_maestro WHERE id = ? AND usuario_id = ?
```
❌ Bloquea que agentes vean campañas del líder.

### 8.3 Crear Campaña (Actual)
```sql
INSERT INTO gestiones_maestro 
  (nombre, descripcion, usuario_id, total_solicitudes, gestionadas, fecha_limite, solicitudes_ids)
VALUES (?, ?, ?, ?, 0, ?, ?)
```
❌ No asigna `equipo_id`.

### 8.4 Listar Solicitudes (Actual)
```sql
SELECT s.*, ... FROM solicitudes s ... WHERE s.usuario_id = ?
```
❌ No considera equipo. Cada usuario ve solo sus propias solicitudes.

### 8.5 Dashboard del Equipo (Actual)
```sql
-- Agentes con asignaciones
SELECT u.id, u.username, u.nombre, u.is_active,
       (SELECT COUNT(*) FROM asignaciones_solicitudes a WHERE a.usuario_id = u.id ...) as asignadas,
       (SELECT COUNT(*) FROM gestiones g WHERE g.usuario_id = u.id ...) as gestiones_7d
FROM equipo_usuarios eu
INNER JOIN usuarios u ON eu.usuario_id = u.id
WHERE eu.equipo_id = ? AND eu.fecha_salida IS NULL AND eu.es_lider = 0

-- Campañas del equipo
SELECT gm.id, gm.nombre, gm.total_solicitudes, gm.gestionadas, gm.estado, gm.created_at
FROM gestiones_maestro gm
WHERE gm.equipo_id = ? AND gm.estado = 'activa'
```
✅ El dashboard del equipo YA consulta `gm.equipo_id`.

### 8.6 Campañas del Equipo (Actual)
```sql
SELECT gm.id, gm.nombre as nombre_campana, gm.total_solicitudes, gm.gestionadas,
       gm.estado, gm.created_at, u.username as agente_username
FROM gestiones_maestro gm
LEFT JOIN usuarios u ON gm.usuario_id = u.id
WHERE gm.equipo_id = ?
```
✅ Endpoint `campanasEquipo` YA existe y filtra por `equipo_id`.

---

## 9. FRONTEND INVOLUCRADO

### 9.1 Desktop

| Archivo | Función | Relación con campañas |
|---------|---------|----------------------|
| `public/desktop/js/solicitudes.js` | Selección de solicitudes, creación de campañas, agregar a campaña existente | ✅ CORE |
| `public/desktop/js/gestion-lote.js` | Visualización y gestión de campañas, sidebar, progreso | ✅ CORE |
| `public/desktop/js/gestiones.js` | Historial de gestiones | Indirecto |
| `public/desktop/equipo.html` + `equipo.js` | Panel del líder (NO implementado completamente) | ⚠️ Parcial |

### 9.2 Móvil

| Archivo | Función | Relación con campañas |
|---------|---------|----------------------|
| `public/movil/js/solicitudes.js` | Selección + creación campañas + agregar a existente | ✅ CORE |
| `public/movil/js/gestiones.js` | Historial de gestiones | Indirecto |
| `public/movil/gestion-lote.html` | Vista de campaña específica | ✅ CORE |

### 9.3 Admin

| Archivo | Función |
|---------|---------|
| `public/admin/js/admin.js` | Gestión completa de equipos, usuarios, agentes |

### 9.4 Funcionalidades Clave del Frontend para Campañas

En `public/desktop/js/solicitudes.js`:
1. **Selector de solicitudes** con checkboxes + cards de 5 filas
2. **Modal de creación de campaña** con informe (estado, segmento, producto) y plan de acción
3. **Agregar a campaña existente** con selector visual de campañas
4. **Búsqueda en servidor** con AbortController y cache

En `public/desktop/js/gestion-lote.js`:
1. **Sidebar de campañas** con cards, progreso, estado
2. **Lista de solicitudes** de la campaña con filtros
3. **Modal de gestión** (WhatsApp, tipo, observación)
4. **Agregar solicitudes** con búsqueda dinámica y exclusión de duplicados
5. **Editar campaña** (nombre, descripción, fecha, estado)
6. **Quitar solicitud** de campaña
7. **Eliminar campaña** con confirmación
8. **WhatsApp integrado** con plantillas de mensajes

---

## 10. BACKEND INVOLUCRADO

### 10.1 Controladores

| Archivo | Funciones clave | Líneas |
|---------|----------------|--------|
| `src/controllers/gestionesMaestro.controller.js` | CRUD campañas + agregar/quitar solicitudes | ~400 |
| `src/controllers/excel.controller.js` | CRUD solicitudes + gestiones + dashboard | ~800 |
| `src/controllers/dashboard.controller.js` | Dashboard/KPIs | ~200 |
| `src/controllers/equipos.controller.js` | CRUD equipos + agentes + dashboard equipo | ~550 |
| `src/controllers/admin.controller.js` | Admin usuarios + promover líder | ~400 |
| `src/controllers/auth.controller.js` | Login con asignación equipo | ~300 |

### 10.2 Middleware

| Archivo | Funciones |
|---------|-----------|
| `src/middleware/auth.middleware.js` | `requiresAuth`, `requiresRole`, `requiresPermission`, `requiresPermissionAsync`, `requiresEquipo` |

### 10.3 Servicios

| Archivo | Función |
|---------|---------|
| `src/services/excel.service.js` | Procesamiento de Excel para solicitudes |
| `src/services/relaciones.service.js` | Procesamiento de Excel para relaciones |

---

## 11. COMPONENTES REUTILIZABLES

### 11.1 Selector de Solicitudes
**Ubicación:** `public/desktop/js/solicitudes.js` y `public/movil/js/solicitudes.js`
**Funciones clave:** `abrirModalNuevaGestion()`, `buscarEnServidor()`, `renderizarCards()`, `toggleCardDesktop()`
**Reutilizable para:** Seleccionar solicitudes para asignar a agentes

### 11.2 Selector de Campañas
**Ubicación:** `public/desktop/js/solicitudes.js`
**Funciones clave:** `abrirModalAgregarCampana()`, `renderizarListaCampanas()`, `seleccionarCampana()`
**Reutilizable para:** Seleccionar campaña para asignar a agente

### 11.3 Sidebar de Campañas
**Ubicación:** `public/desktop/js/gestion-lote.js`, `SidebarCampanas` object
**Reutilizable para:** Navegación entre campañas

### 11.4 Modal Genérico
**Ubicación:** `public/js/modal.js` (referenciado vía `crearModal()`)
**Reutilizable para:** Todos los modales del sistema

### 11.5 Dashboard de Equipo
**Ubicación:** `public/desktop/equipo.js` + `src/controllers/equipos.controller.js::dashboardEquipo`
**Reutilizable para:** Mostrar asignaciones de agentes en equipo

### 11.6 Sistema de Gestiones
**Ubicación:** Todo el flujo POST/GET gestiones con adjuntar a `gestion_maestro_id`
**Reutilizable para:** Agentes gestionando solicitudes asignadas

### 11.7 Enlace Profundo (DeepLinkRouter)
**Ubicación:** `public/js/deep-link-router.js`
**Función:** Resuelve URLs según plataforma
**Reutilizable para:** Redirigir a la vista correcta (desktop/móvil) al hacer clic en notificaciones

---

## 12. PROBLEMAS Y CONFLICTOS ENCONTRADOS

### 🔴 PROBLEMA 1: `usuario_id` como Propietario Único
**Archivo:** `src/controllers/gestionesMaestro.controller.js`
**Impacto:** CRÍTICO

```javascript
// listar: solo campañas del usuario
'SELECT * FROM gestiones_maestro WHERE usuario_id = ?'

// crear: solo asigna usuario_id, no equipo_id
INSERT INTO gestiones_maestro (..., usuario_id, ...) VALUES (..., ?, ...)

// ver: solo si el usuario es el dueño
'SELECT * FROM gestiones_maestro WHERE id = ? AND usuario_id = ?'
```

**¿Qué significa?**
- Las campañas son "propiedad individual" del `usuario_id` que las creó
- Un Agente nunca podrá ver campañas de su Líder (ni viceversa)
- La columna `equipo_id` existe en la tabla pero nunca se asigna

**Solución propuesta:**
1. Al crear campaña, asignar `equipo_id` automáticamente desde la sesión del usuario
2. Al listar campañas, incluir tanto las propias como las del equipo
3. El líder debe poder ver campañas de sus agentes y viceversa (con permisos)

---

### 🔴 PROBLEMA 2: Solicitudes como Propiedad Individual
**Archivo:** `src/controllers/excel.controller.js`
**Impacto:** CRÍTICO

```sql
WHERE s.usuario_id = $1  -- Cada usuario ve SOLO sus solicitudes
```

**¿Qué significa?**
- Cuando un agente importa solicitudes, son SOLO SUYAS
- El líder no puede ver las solicitudes que importó su agente
- No hay un "pool de solicitudes del equipo"

**Solución propuesta (múltiples opciones):**

**Opción A (Recomendada):** Las solicitudes que importa un agente se asignan automáticamente al equipo. El líder ve todas las solicitudes del equipo.

**Opción B (Mínima):** Al crear campaña, permitir seleccionar solicitudes de cualquier miembro del equipo.

---

### 🟡 PROBLEMA 3: Sistema de Asignaciones No Implementado
**Tabla:** `asignaciones_solicitudes`
**Impacto:** ALTO

La tabla existe con:
```sql
CREATE TABLE asignaciones_solicitudes (
    solicitud_id, equipo_id, usuario_id (nullable), 
    asignado_por, desde_campaña_id, tipo_asignacion,
    fecha_asignacion, fecha_desasignacion
);
```

Pero **nunca se insertan registros** ni se consultan.

**Potencial conflicto:** Si implementamos asignación de campañas a agentes sin usar esta tabla, duplicaríamos la lógica de asignación.

---

### 🟡 PROBLEMA 4: `campañas_equipo` No Utilizada
**Tabla:** `campañas_equipo`
**Impacto:** MEDIO

```sql
CREATE TABLE campañas_equipo (
    campaña_id, equipo_id
);
```

Esta tabla es **redundante** si usamos `gestiones_maestro.equipo_id`.  
La relación campaña ↔ equipo debe mantenerse en una sola dirección.

**Recomendación:** No usar `campañas_equipo`. Usar directamente `gestiones_maestro.equipo_id`.

---

### 🟡 PROBLEMA 5: Permisos No Implementados
**Tablas:** `permisos_roles`, `permisos_equipo`
**Impacto:** MEDIO

Existen pero no se usan. El sistema actual usa permisos hardcodeados en `src/config/permissions.js`.

---

### 🟢 PROBLEMA 6: Dashboard de Equipo ya Filtra por equipo_id
**Archivo:** `src/controllers/equipos.controller.js`
**Impacto:** BAJO (ya resuelto)

```sql
SELECT gm.id, gm.nombre, gm.total_solicitudes, gm.gestionadas, ...
FROM gestiones_maestro gm
WHERE gm.equipo_id = ?
```

El dashboard del equipo YA consulta `equipo_id`. El problema es que ningún registro tiene `equipo_id` asignado.

---

### 🟢 PROBLEMA 7: `campanasEquipo` Endpoint ya Existe
**Archivo:** `src/controllers/equipos.controller.js` - `campanasEquipo()`
**Impacto:** BAJO (ya resuelto)

Endpoint funcional que lista campañas por equipo_id. Solo requiere que las campañas tengan `equipo_id` asignado.

---

## 13. ESTRATEGIA DE INTEGRACIÓN RECOMENDADA

### 13.1 Filosofía ARCHIVOX v3.0

```
SuperUsuario → Administra el sistema
    ↓
Líder → Administra su equipo y agentes
    ↓
Agente → Trabaja SOLO con lo que el Líder le asigna
```

### 13.2 Principios de Diseño

1. **Mínima modificación a tablas existentes** — No crear nuevas tablas si las actuales sirven
2. **Reutilizar columnas existentes** — `equipo_id` en `gestiones_maestro` ya existe
3. **No duplicar lógica** — Reutilizar selectores, modales, y componentes del frontend
4. **Capas de visibilidad** — superadmin > líder > agente (cada nivel ve más arriba)
5. **Asignación sobre herencia** — El líder asigna campañas, no las "comparte"

### 13.3 Plan de Implementación (Fases)

---

#### FASE 1: 🏗️ Asignar `equipo_id` al Crear Campaña (3 líneas de código)

**Archivos a modificar:**
1. `src/controllers/gestionesMaestro.controller.js` — `createGestionMaestro()`

**Cambio:**
```javascript
// ANTES:
const resultGM = await pool.query(`
    INSERT INTO gestiones_maestro (nombre, descripcion, usuario_id, total_solicitudes, ...)
    VALUES (?, ?, ?, ?, ...)
`, [nombre, descripcion || '', usuario_id, ...]);

// DESPUÉS:
const equipo_id = req.session.usuario.equipo_id || null;
const resultGM = await pool.query(`
    INSERT INTO gestiones_maestro (nombre, descripcion, usuario_id, equipo_id, total_solicitudes, ...)
    VALUES (?, ?, ?, ?, ?, ...)
`, [nombre, descripcion || '', usuario_id, equipo_id, ...]);
```

**Duración:** 5 minutos  
**Riesgo:** Ninguno (columna nullable, BC total)

---

#### FASE 2: 👁️ Filtrar Campañas por Equipo en Listado

**Archivos a modificar:**
1. `src/controllers/gestionesMaestro.controller.js` — `getGestionesMaestro()`
2. `src/controllers/gestionesMaestro.controller.js` — `getGestionMaestroById()`

**Cambio en listado:**
```javascript
// ANTES:
'SELECT * FROM gestiones_maestro WHERE usuario_id = ? ORDER BY created_at DESC'

// DESPUÉS (el líder ve campañas propias + de su equipo):
let sql;
let params;
if (req.session.usuario.es_lider) {
    sql = `SELECT gm.* FROM gestiones_maestro gm 
           LEFT JOIN equipo_usuarios eu ON eu.equipo_id = gm.equipo_id 
           WHERE gm.usuario_id = ? OR (eu.usuario_id = ? AND eu.es_lider = 1)
           GROUP BY gm.id ORDER BY gm.created_at DESC`;
    params = [usuario_id, usuario_id];
} else {
    sql = 'SELECT * FROM gestiones_maestro WHERE usuario_id = ? ORDER BY created_at DESC';
    params = [usuario_id];
}
```

**Cambio en detalle:**
```javascript
// ANTES:
'SELECT * FROM gestiones_maestro WHERE id = ? AND usuario_id = ?'

// DESPUÉS (el líder ve cualquier campaña de su equipo):
// Para líder: permitir acceso si usuario_id = ? O equipo_id está en su equipo
```

---

#### FASE 3: 📋 Mostrar Campañas del Equipo al Líder

**Archivo:** `public/desktop/equipo.html` + `public/desktop/js/equipo.js`

Reutilizar componente de sidebar de campañas (`gestion-lote.js`) para mostrar:
- Campañas activas del equipo
- Asignaciones a cada agente
- Progreso general

---

#### FASE 4: 🔗 Asignar Campañas a Agentes (NUEVA FUNCIONALIDAD)

**Backend — Nuevo endpoint:**
```
PUT /api/gestiones-maestro/:id/asignar-agente
Body: { agente_id: number }
```

**Lógica:**
1. Validar que el usuario es líder del equipo al que pertenece la campaña
2. Validar que el agente pertenece al mismo equipo
3. Asignar `agente_id` a la campaña (nuevo campo o tabla)

**Opción A (Recomendada):** Agregar columna `asignado_a` en `gestiones_maestro`
```sql
ALTER TABLE gestiones_maestro ADD COLUMN asignado_a INTEGER REFERENCES usuarios(id);
```

**Opción B:** Usar `asignaciones_solicitudes` (más compleja pero más granular)

**Frontend — Nuevo modal:**
- En la vista de campaña (`gestion-lote.js`), agregar botón "Asignar a agente"
- Modal con lista de agentes del equipo
- Al seleccionar, la campaña queda asignada

---

#### FASE 5: 🎯 Visibilidad del Agente

**Archivo:** `src/controllers/gestionesMaestro.controller.js`

**Cambio en listado para agente:**
```javascript
// El agente ve:
// 1. Campañas propias (las que él creó)
// 2. Campañas asignadas a él (asignado_a = su ID)
sql = `SELECT * FROM gestiones_maestro 
       WHERE usuario_id = ? OR asignado_a = ? 
       ORDER BY created_at DESC`;
```

---

#### FASE 6: 📊 Dashboard de Equipo Enriquecido

El dashboard del equipo (`/api/equipos/:id/dashboard`) ya existe y funciona.  
Requiere que las campañas tengan `equipo_id` asignado (FASE 1).

Mejoras adicionales:
- Mostrar campañas asignadas a cada agente
- Progreso individual por agente
- Totales consolidados del equipo

---

### 13.4 Tabla Resumen de Cambios

| Fase | Archivos | Cambio | Dependencias |
|------|----------|--------|-------------|
| 1 | `gestionesMaestro.controller.js` | Asignar `equipo_id` al crear campaña | Ninguna |
| 2 | `gestionesMaestro.controller.js` | Filtrar campañas por equipo en listado | Fase 1 |
| 3 | `public/desktop/equipo.js` | Mostrar campañas del equipo al líder | Fase 2 |
| 4 | Nuevo endpoint + `gestionesMaestro.controller.js` | Asignar campaña a agente | Fase 1 |
| 5 | `gestionesMaestro.controller.js` | Agente ve campañas asignadas | Fase 4 |
| 6 | `equipos.controller.js` | Dashboard enriquecido | Fase 1-5 |

### 13.5 Lo que NO se debe modificar

1. ❌ **No modificar `solicitudes`** — No agregar `equipo_id` a solicitudes. Usar asignaciones.
2. ❌ **No usar `campañas_equipo`** — Es redundante con `gestiones_maestro.equipo_id`
3. ❌ **No modificar `asignaciones_solicitudes`** — Para asignación de campañas, es más simple usar `gestiones_maestro.asignado_a`
4. ❌ **No romper el flujo legacy** — `user` rol (sin equipo) debe seguir funcionando como antes

### 13.6 Componentes del Frontend a Reutilizar

| Componente | Archivo | Para qué sirve |
|-----------|---------|---------------|
| Selector de solicitudes | `solicitudes.js` | Asignar solicitudes a campaña |
| Selector de campañas | `solicitudes.js` | Seleccionar campaña destino |
| Sidebar de campañas | `gestion-lote.js` | Navegar entre campañas |
| Modal de gestión | `gestion-lote.js` | Gestionar solicitud individual |
| Cards de solicitudes | `solicitudes.js` | Mostrar solicitudes en lista |
| Selector de agentes | `admin.js` (equipos) | Seleccionar agente para asignar |

---

### 13.7 Resumen Ejecutivo

**Estado actual:** La arquitectura multi-equipo está implementada a nivel organizacional (equipos, agentes, líderes), pero las campañas y solicitudes siguen siendo "propiedad individual". La columna `equipo_id` existe en `gestiones_maestro` pero no se utiliza.

**La asignación de campañas a agentes requiere SOLO:**
1. Asignar `equipo_id` al crear campaña (Fase 1 — 3 líneas)
2. Agregar columna `asignado_a` a `gestiones_maestro` (Fase 4 — 1 ALTER TABLE)
3. Crear endpoint PUT de asignación (Fase 4 — ~50 líneas)
4. Ajustar consultas de visibilidad (Fases 2 y 5 — ~20 líneas)
5. Agregar UI de asignación en frontend (Fase 4 — reutilizando componentes existentes)

**Tiempo estimado total:** 2-4 horas de implementación  
**Riesgo:** Bajo (la mayoría son adiciones, no modificaciones)
**Backward Compatibility:** Total — todos los cambios son aditivos y `user` legacy sigue funcionando igual.
