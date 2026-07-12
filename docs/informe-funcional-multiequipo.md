# 🏗️ INFORME FUNCIONAL COMPLETO — ARCHIVOX v3.0

**Evolución Multi-Equipo — Auditoría Funcional y Documentación Técnica**

**Fecha:** 12 de Julio de 2026
**Versión:** 3.0
**Auditor:** Buffy (AI Agent)

---

## 📋 ÍNDICE

1. [Resumen Ejecutivo](#1-resumen-ejecutivo)
2. [Arquitectura Actual](#2-arquitectura-actual)
3. [Comparación Antes/Después](#3-comparación-antesdespués)
4. [Sistema de Roles](#4-sistema-de-roles)
5. [Sistema de Permisos](#5-sistema-de-permisos)
6. [Equipos](#6-equipos)
7. [Líderes](#7-líderes)
8. [Agentes](#8-agentes)
9. [Solicitudes](#9-solicitudes)
10. [Campañas](#10-campañas)
11. [Gestiones](#11-gestiones)
12. [Importación Excel](#12-importación-excel)
13. [Flujo de Autenticación](#13-flujo-de-autenticación)
14. [Flujo de Asignaciones](#14-flujo-de-asignaciones)
15. [Flujo Completo de Trabajo](#15-flujo-completo-de-trabajo)
16. [Diagrama Textual de la Arquitectura](#16-diagrama-textual-de-la-arquitectura)
17. [Estado Real de la Implementación](#17-estado-real-de-la-implementación)
18. [Diferencias entre Diseño Original e Implementación](#18-diferencias-entre-diseño-original-e-implementación)
19. [Funcionalidades Pendientes](#19-funcionalidades-pendientes)
20. [Recomendaciones Técnicas para la Siguiente Fase](#20-recomendaciones-técnicas-para-la-siguiente-fase)

---

## 1. RESUMEN EJECUTIVO

### 1.1 ¿Qué se construyó?

Se implementó una **capa organizacional (multi-equipo)** sobre el sistema ARCHIVOX existente. Esta capa permite que un **SuperAdmin** cree **Equipos**, asigne **Líderes**, y que estos creen **Agentes** para gestionar solicitudes de forma organizada.

### 1.2 Estado General

| Componente | Estado | Detalle |
|------------|:------:|---------|
| **Tablas BD** | ✅ 6 nuevas creadas | equipos, equipo_usuarios, permisos_roles, permisos_equipo, asignaciones_solicitudes, campañas_equipo |
| **Migraciones** | ✅ Ejecutadas en producción | 003a (tablas) + 003b (seed data) |
| **Backend: Permisos** | ✅ Completo | Sistema híbrido: rol en BD + permisos en BD + permisos hardcodeados |
| **Backend: Equipos** | ✅ CRUD completo | Controlador + rutas + middleware |
| **Backend: Login** | ✅ Carga equipo en sesión | equipo_id, equipo_nombre, es_lider |
| **Frontend: Admin** | ✅ Gestión de equipos | Pestaña "Equipos" con CRUD completo |
| **Frontend: Líder** | ✅ Panel del Líder | Dashboard, agentes, campañas, gestiones |
| **Frontend: Dashboard** | ✅ Card "Mi Equipo" | Visible para todos los usuarios |
| **Asignaciones automáticas post-import** | ❌ NO implementado | Las solicitudes no se asignan automáticamente al equipo |
| **Filtro por equipo en campañas** | ❌ NO implementado | gestiones_maestro no filtra por equipo_id |
| **Campañas multi-equipo** | ⚠️ Parcial | Tabla campañas_equipo creada pero no usada |

### 1.3 Hallazgos Clave

1. **Los usuarios con `rol = 'user'` NO fueron migrados** a `rol = 'agente'` o `rol = 'lider'`. Es una decisión de arquitectura deliberada, NO una migración incompleta.
2. **Las asignaciones automáticas** (INSERT en `asignaciones_solicitudes` tras importar Excel) **NO se implementaron**. Las solicitudes siguen asociadas al usuario que las importó mediante `usuario_id`.
3. **El panel admin muestra correctamente** `rol = 'usuario'` porque ese es el valor real en la BD para usuarios no migrados.
4. **La tabla `asignaciones_solicitudes`** existe pero **no tiene datos** porque ninguna función la utiliza activamente.
5. **Los nuevos agentes** creados desde el panel del Líder o Admin sí reciben `rol = 'agente'`.

---

## 2. ARQUITECTURA ACTUAL

### 2.1 Stack Tecnológico

```
Frontend: HTML + CSS + JS Vanilla (Desktop + Mobile separados)
Backend:  Express.js 5 (CommonJS)
BD:       PostgreSQL (producción) / SQLite (local)
Auth:     express-session + bcryptjs
Tiempo real: SSE (Server-Sent Events)
Caché:    node-cache (servidor)
```

### 2.2 Capas de la Aplicación

```
Rutas (routes/)
  → Middleware (auth.middleware.js)
    → Controladores (controllers/)
      → Servicios (services/)
        → BD (config/db.js)
```

### 2.3 Tablas del Sistema Multi-Equipo

| # | Tabla | Propósito | Estado |
|:-:|-------|-----------|:------:|
| 1 | `equipos` | Catálogo de equipos | ✅ En uso |
| 2 | `equipo_usuarios` | Membresía de usuarios en equipos | ✅ En uso |
| 3 | `permisos_roles` | Permisos por rol (lider, agente, user) | ✅ En uso |
| 4 | `permisos_equipo` | Permisos extra por equipo | ✅ Creada, sin datos |
| 5 | `asignaciones_solicitudes` | Asignaciones de solicitudes | ⚠️ Creada, SIN DATOS |
| 6 | `campañas_equipo` | Asociación campaña ↔ equipo | ⚠️ Creada, SIN DATOS |

### 2.4 Modificaciones a Tablas Existentes

| Tabla | Cambio | Estado |
|-------|--------|:------:|
| `gestiones_maestro` | + `equipo_id` (INTEGER, nullable) | ✅ Columna agregada |

---

## 3. COMPARACIÓN ANTES/DESPUÉS

### 3.1 Estructura Organizacional

```
ANTES (v2.1):                      DESPUÉS (v3.0):
┌──────────────┐                   ┌─────────────────┐
│  SUPERADMIN   │                   │   SUPERADMIN     │
│      │        │                   └────────┬────────┘
│   USUARIOS   │                            │
│      │        │                   ┌────────┴────────┐
│  SOLICITUDES │                   │    EQUIPOS       │
│      │        │                   └────────┬────────┘
│   GESTIONES  │                     ┌───────┴───────┐
└──────────────┘                   ┌─┴──┐       ┌───┴─┐
                                   │LÍDER│       │LÍDER│
                                   └──┬──┘       └──┬──┘
                                   ┌──┴──┐     ┌───┴───┐
                                   │AGENT│     │ AGENT │
                                   └─────┘     └───────┘
```

### 3.2 Modelo de Datos

```
ANTES:                            DESPUÉS:
usuarios ──→ solicitudes          usuarios ──→ solicitudes
  │                                  │
  └──→ gestiones                     ├──→ equipo_usuarios ──→ equipos
                                     │
                                     ├──→ permisos_roles
                                     │
                                     └──→ asignaciones_solicitudes
                                            └──→ solicitudes (FK lógica)
```

### 3.3 Roles y Permisos

| Aspecto | Antes (v2.1) | Después (v3.0) |
|---------|---------------|-----------------|
| Roles disponibles | superadmin, admin, user | + lider, + agente |
| Permisos | Hardcodeados en código | En BD (`permisos_roles`) + hardcodeados |
| Equipos | No existían | Estructura completa |
| Asignaciones | No existían | Tabla dedicada (sin uso) |

---

## 4. SISTEMA DE ROLES

### 4.1 ¿La columna "rol" sigue utilizándose?

**SÍ, absolutamente.** La columna `usuarios.rol` es fundamental y se consulta en:

- **Login** (`auth.controller.js`): se almacena en `req.session.usuario.rol`
- **Middleware** (`auth.middleware.js`): `requiresRole()` verifica `req.session.usuario.rol`
- **Middlewares de permisos** (`requiresPermission`, `requiresPermissionAsync`): usan el rol para determinar permisos
- **Admin controller** (`admin.controller.js`): CRUD de usuarios lee y escribe `rol`
- **Admin panel frontend** (`admin.js`): muestra el rol en la tabla y filtros
- **Dashboard** (`equipo.js`, `dashboard.js`): muestra badge del rol

### 4.2 ¿Para qué se utiliza?

La columna `rol` determina:
1. **Qué puede hacer un usuario** (permisos base definidos en `ROLES` en `permissions.js`)
2. **A qué paneles puede acceder** (admin, líder, etc.)
3. **Qué middleware se aplica** (`requiresRole('admin')`, etc.)
4. **Qué información ve** (líder ve su equipo, agente ve sus asignaciones)
5. **El nivel jerárquico** (superadmin=100, admin=50, lider=30, agente=20, user=10)

### 4.3 ¿Qué valores puede tener actualmente?

| Valor | Level | Descripción |
|-------|:-----:|-------------|
| `'superadmin'` | 100 | Control total del sistema |
| `'admin'` | 50 | Panel de administración |
| `'lider'` | 30 | Gestiona un equipo y agentes |
| `'agente'` | 20 | Opera sobre solicitudes asignadas |
| `'user'` | 10 | Comportamiento actual (compatibilidad) |

### 4.4 ¿Cuál es el rol por defecto al crear un usuario?

**Depende de cómo se crea:**

| Método de creación | Rol asignado | Código |
|-------------------|:------------:|--------|
| Registro público (`/api/auth/registrar`) | `NULL` (default BD) | `INSERT INTO usuarios (...) VALUES (...) -- sin rol` |
| Admin crea usuario (`/api/admin/usuarios`) | `'user'` (default explícito) | `const { rol = 'user' } = req.body` |
| Admin/Líder crea agente (`/api/equipos/:id/agentes`) | `'agente'` (hardcodeado) | `rol: 'agente'` en el INSERT |

### 4.5 ¿Los usuarios antiguos fueron migrados?

**NO.** Los usuarios con `rol = 'user'` existentes antes de la migración multi-equipo conservan ese valor.

**Evidencia:**
- La migración `003_seed_team_data.js` asigna usuarios al equipo "Sistema" pero **NO modifica su columna `rol`**
- El seed asigna:
  - SuperAdmin como líder del equipo Sistema (por `is_superadmin = TRUE`)
  - Admins como miembros (por `rol = 'admin'`)
  - **Demás usuarios como miembros** (por `rol NOT IN ('admin', 'superadmin')`) — sin cambiar su rol

### 4.6 ¿Fue una decisión de arquitectura o migración incompleta?

**Fue una decisión de arquitectura deliberada y documentada.**

Del documento de diseño (`docs/informe-arquitectura-multi-equipo.md`):

> **Compatibilidad con Usuarios Legacy (`rol = 'user'`)**
> Los usuarios con `rol = 'user'` (comportamiento actual) **no se ven afectados**. Su flujo de trabajo sigue siendo idéntico:
> 1. Siguen viendo SOLO sus solicitudes (filtro por `usuario_id`)
> 2. Siguen creando campañas (sin `equipo_id` = NULL)
> 3. Siguen importando Excel
> 4. No ven cambios en la UI
> 
> La única diferencia es que ahora también pertenecen a un equipo (el equipo "Sistema"), lo que permite al SUPERADMIN moverlos a otros equipos en el futuro.

### 4.7 Flujo de Verificación de Rol

```
Solicitud HTTP
  │
  ▼
¿Tiene sesión? → NO → 401
  │
  SÍ
  ▼
requiresRole('admin', 'superadmin')
  │
  ▼
req.session.usuario.rol ∈ ['admin', 'superadmin']?
  │
  SÍ → Continúa
  NO → 403
```

---

## 5. SISTEMA DE PERMISOS

### 5.1 ¿El sistema autoriza por rol, por permisos, o por ambos?

**Por AMBOS.** El sistema implementa un sistema híbrido de 4 niveles:

### 5.2 Arquitectura de Verificación

```
┌──────────────────────────────────────────────────────┐
│              tienePermisoCompleto()                    │
│                    (permissions.js)                    │
├──────────────────────────────────────────────────────┤
│                                                       │
│  1. ¿El usuario es SUPERADMIN? → ✅ ACCESO TOTAL     │
│                                                       │
│  2. ¿Permiso hardcodeado en ROLES (memoria)?          │
│     → Verifica ROLES[rol].permissions                 │
│     → Ej: admin tiene 'users:read' en código         │
│                                                       │
│  3. ¿Permiso en BD (permisos_roles)?                  │
│     → SELECT 1 FROM permisos_roles                    │
│       WHERE rol = $1 AND permiso = $2                 │
│     → Para lider, agente, user dinámicos              │
│                                                       │
│  4. ¿Permiso extra del equipo (permisos_equipo)?      │
│     → SELECT 1 FROM permisos_equipo                   │
│       WHERE equipo_id = $1 AND permiso = $2           │
│     → Para permisos especiales concedidos por admin   │
│                                                       │
│  Si ALGUNO devuelve true → ✅ ACCESO CONCEDIDO        │
│  Si TODOS devuelven false → ❌ 403 DENEGADO            │
└──────────────────────────────────────────────────────┘
```

### 5.3 ¿Qué prioridad tiene cada uno?

| Nivel | Prioridad | Característica |
|:-----:|:---------:|---------------|
| 1. SuperAdmin | 🔴 Máxima | Siempre pasa, sin consultas adicionales |
| 2. Memoria (hardcodeado) | 🟡 Alta | Roles conocidos (superadmin, admin) |
| 3. BD (permisos_roles) | 🟢 Media | Roles dinámicos (lider, agente, user) |
| 4. BD (permisos_equipo) | 🔵 Baja | Permisos extra por equipo |

### 5.4 ¿Dónde se consulta?

**En el middleware `auth.middleware.js`:**

| Middleware | ¿Qué verifica? | ¿Dónde? |
|-----------|---------------|---------|
| `requiresAuth` | Sesión activa | `req.session.usuario` |
| `requiresRole(...roles)` | Rol del usuario | `req.session.usuario.rol` |
| `requiresPermission(permiso)` | Permiso hardcodeado | `ROLES` en `permissions.js` |
| `requiresPermissionAsync(permiso)` | Permiso completo | BD + memoria |
| `requiresLevel(minLevel)` | Nivel mínimo | `ROLES[rol].level` |
| `requiresEquipo(accion)` | Pertenencia a equipo | `req.session.usuario.equipo_id` |

### 5.5 ¿Qué middleware interviene? (Flujo completo)

```
Ejemplo: POST /api/equipos/:id/agentes (Crear agente)

1. requiresAuth()
   → Verifica req.session.usuario existe
   → Si no: 401

2. requiresPermissionAsync('agentes:crear')
   → Llama a tienePermisoCompleto(rol, equipoId, 'agentes:crear')
     → 1. ¿SuperAdmin? ✅
     → 2. ¿Hardcodeado? 'agentes:crear' no está en ROLES.admin.permissions
     → 3. ¿En permisos_roles? 
          SELECT 1 FROM permisos_roles WHERE rol='lider' AND permiso='agentes:crear'
          → Si el usuario es líder: ✅
     → 4. ¿En permisos_equipo?
          SELECT 1 FROM permisos_equipo WHERE equipo_id=X AND permiso='agentes:crear'
          → Si el equipo tiene permiso extra: ✅
   → Si ninguno: 403

3. equiposController.crearAgente()
   → Crea usuario con rol='agente'
   → Inserta en equipo_usuarios
   → Commit
```

### 5.6 Permisos por Rol (definidos en BD)

#### LÍDER (20 permisos)
```
equipo:ver, equipo:gestionar,
agentes:ver, agentes:crear, agentes:editar, agentes:desactivar,
campañas:ver, campañas:crear, campañas:gestionar, campañas:asignar,
solicitudes:importar, solicitudes:ver-equipo,
solicitudes:asignar, solicitudes:reasignar, solicitudes:ver-asignaciones,
gestiones:ver-equipo,
dashboard:ver-equipo, dashboard:ver-agentes,
relaciones:ver-equipo,
historial:ver-equipo
```

#### AGENTE (12 permisos)
```
campañas:ver-propias,
solicitudes:ver-asignadas, solicitudes:gestionar,
solicitudes:editar-estado, solicitudes:completar-info,
gestiones:crear, gestiones:ver-propias, gestiones:editar,
relaciones:gestionar,
historial:ver-propio,
perfil:ver, perfil:editar
```

#### USER (15 permisos)
```
solicitudes:importar, solicitudes:ver-propias, solicitudes:gestionar,
solicitudes:editar-estado, solicitudes:completar-info,
campañas:crear, campañas:gestionar,
gestiones:crear, gestiones:ver-propias, gestiones:editar,
relaciones:gestionar, ventas:gestionar,
historial:ver-propio,
perfil:ver, perfil:editar
```

---

## 6. EQUIPOS

### 6.1 ¿Quién crea un equipo?

**Solo el SUPERADMIN.** La ruta `POST /api/equipos` está protegida con `requiresRole('superadmin')`.

```javascript
// equipos.routes.js
router.post('/', requiresRole('superadmin'), equiposController.crear);
```

### 6.2 ¿Quién administra un equipo?

| Acción | ¿Quién puede hacerla? | Middleware |
|--------|----------------------|------------|
| Crear equipo | Solo superadmin | `requiresRole('superadmin')` |
| Actualizar equipo | Solo superadmin | `requiresRole('superadmin')` |
| Asignar líder | Solo superadmin | `requiresRole('superadmin')` |
| Mover usuarios | Solo superadmin | `requiresRole('superadmin')` |
| Remover miembros | Solo superadmin | `requiresRole('superadmin')` |
| Crear agentes | Superadmin o Líder (de su equipo) | `requiresPermissionAsync('agentes:crear')` |
| Ver equipo | Superadmin, Admin, o miembros del equipo | `requiresEquipo('ver')` |

### 6.3 ¿Qué ocurre cuando un usuario cambia de equipo?

**Proceso (`equipos.controller.moverUsuario`):**

```
1. Se marca la membresía actual como inactiva:
   UPDATE equipo_usuarios
   SET fecha_salida = CURRENT_TIMESTAMP, motivo_salida = 'transferido'
   WHERE usuario_id = X AND fecha_salida IS NULL

2. Se crea nueva membresía:
   INSERT INTO equipo_usuarios (equipo_id, usuario_id, es_lider)
   VALUES (nuevo_equipo_id, X, 0)
```

### 6.4 ¿Qué ocurre con su historial?

**El historial se conserva.** `equipo_usuarios` usa `fecha_salida` en lugar de DELETE, por lo que el historial completo de membresías se preserva.

### 6.5 ¿Qué ocurre con sus gestiones?

**Nada.** Las gestiones están vinculadas a `usuario_id`, no a `equipo_id`. El agente conserva todas sus gestiones históricas.

### 6.6 ¿Qué ocurre con sus campañas?

**Nada.** Las campañas en `gestiones_maestro` que pertenecían al agente (por `usuario_id`) siguen siendo visibles para él. Las campañas que tenían `equipo_id` del equipo anterior quedan huérfanas (siguen existiendo pero el equipo anterior ya no puede gestionarlas).

**Importante:** El código actual de `gestionesMaestro.controller.js` **NO utiliza `equipo_id`** al crear o listar campañas. Las campañas se filtran por `usuario_id`, no por equipo.

---

## 7. LÍDERES

### 7.1 ¿Quién puede ser líder?

Un usuario designado como líder por el SuperAdmin, mediante:
- Creación de equipo con líder asignado
- `PUT /api/equipos/:id/asignar-lider` (cambia `es_lider = 1` en `equipo_usuarios`)

### 7.2 ¿Qué puede hacer un líder?

Basado en permisos de `permisos_roles`:
1. **Ver su equipo** (dashboard, miembros, estadísticas)
2. **Gestionar su equipo** (editar nombre/descripción)
3. **Crear agentes** dentro de su equipo
4. **Ver agentes** de su equipo
5. **Ver/crear/gestionar campañas** del equipo
6. **Importar Excel** (solicitudes asociadas a su `usuario_id`)
7. **Ver solicitudes del equipo**
8. **Asignar/reasignar solicitudes** a agentes
9. **Ver gestiones del equipo**
10. **Ver dashboard del equipo**

### 7.3 Limitaciones del Líder

- **NO puede ver información de otros equipos** (restringido por `requiresEquipo()`)
- **NO puede crear otros líderes** (solo SuperAdmin)
- **NO puede mover agentes a otro equipo** (solo SuperAdmin)
- **NO puede eliminar el equipo** (solo SuperAdmin)

### 7.4 Panel del Líder

Ruta: `/equipo` → `public/desktop/equipo.html`

El panel incluye:
- **Header**: Nombre del equipo, badge "Líder"
- **Stats cards**: Total agentes, asignaciones activas, campañas activas
- **Tabla de agentes**: Usuario, nombre, solicitudes asignadas, gestiones (7d), acciones
- **Tabla de campañas**: Nombre, total solicitudes, gestionadas, estado
- **Últimas gestiones del equipo**: Filtradas por equipo
- **Modal crear agente**: Crea usuario con rol 'agente' y lo asigna al equipo

---

## 8. AGENTES

### 8.1 ¿Quién puede ser agente?

- Creado por un **Líder** (desde su panel `/equipo`)
- Creado por un **SuperAdmin** (desde admin o panel de equipo)
- Un **usuario existente** movido a un equipo por el SuperAdmin

### 8.2 ¿Qué puede hacer un agente?

Basado en permisos de `permisos_roles`:
1. **Ver campañas donde tiene asignaciones**
2. **Ver solicitudes asignadas a él**
3. **Gestionar solicitudes** (crear gestiones, cambiar estado, completar info)
4. **Ver sus propias gestiones**
5. **Gestionar relaciones**
6. **Ver su perfil y editarlo**
7. **Ver su historial**

### 8.3 Limitaciones del Agente

- **NO puede ver información de otros agentes**
- **NO puede ver dashboard del equipo completo**
- **NO puede crear campañas**
- **NO puede importar Excel**
- **NO puede asignar solicitudes**

### 8.4 Creación de Agente (flujo técnico)

```
POST /api/equipos/:id/agentes
  │
  ├── Verificar: requiresAuth + requiresPermissionAsync('agentes:crear')
  │
  ├── BEGIN TRANSACTION
  │
  ├── INSERT INTO usuarios (username, password, nombre, email, rol)
  │   VALUES (..., 'agente')  ← Rol hardcodeado a 'agente'
  │
  ├── INSERT INTO equipo_usuarios (equipo_id, usuario_id, es_lider)
  │   VALUES (id, nuevo_agente.id, 0)  ← es_lider = 0
  │
  └── COMMIT
```

---

## 9. SOLICITUDES

### 9.1 ¿Quién es el propietario real de una solicitud?

**El Sistema.** Según el diseño arquitectónico:

> "Las solicitudes son propiedad del Sistema. Nunca pertenecen a un usuario, líder o equipo."

En la práctica actual:
- Las solicitudes tienen un `usuario_id` = quien las importó
- NO existe aún la asignación automática al equipo via `asignaciones_solicitudes`

### 9.2 ¿El Sistema, el Equipo, el Líder o el Agente?

| Concepto | Realidad | ¿Implementado? |
|----------|----------|:--------------:|
| **Sistema** | La solicitud existe en la tabla `solicitudes` | ✅ Sí |
| **Equipo** | Debería tener una asignación vía `asignaciones_solicitudes` | ❌ No |
| **Líder** | El líder importa y asigna | ⚠️ Parcial (importa, pero no asigna) |
| **Agente** | Debería recibir asignaciones | ❌ No (no hay asignaciones en la tabla) |

### 9.3 ¿Cómo se asigna?

**Actualmente NO se asigna mediante el nuevo sistema.** Las solicitudes se vinculan al usuario que las importó mediante `usuario_id` en la tabla `solicitudes`.

El diseño original contemplaba:
```sql
INSERT INTO asignaciones_solicitudes (solicitud_id, equipo_id, usuario_id, asignado_por, tipo_asignacion)
SELECT id_solicitud, $1, NULL, $2, 'importacion'
FROM solicitudes
WHERE usuario_id = $2 AND fecha_importacion >= $3
```

**Esto NO fue implementado.**

### 9.4 ¿Cómo cambia de responsable?

Actualmente no hay un mecanismo para cambiar el responsable de una solicitud. El campo `usuario_id` en `solicitudes` solo se asigna en la importación y no se modifica después.

### 9.5 ¿Dónde queda registrado?

- **Dueño actual:** `solicitudes.usuario_id` (quien importó)
- **Asignaciones históricas:** Deberían ir a `asignaciones_solicitudes` (tabla vacía actualmente)
- **Gestiones realizadas:** `gestiones.usuario_id` (quien gestionó)

---

## 10. CAMPAÑAS

### 10.1 ¿Cómo funciona una campaña en la nueva arquitectura?

Una campaña (registro en `gestiones_maestro`) es un conjunto de solicitudes que se gestionan como lote.

**Actualmente:** Las campañas se crean sin relación con equipos. El `equipo_id` en `gestiones_maestro` existe (columna nullable) pero **no se usa en la creación ni en los listados**.

### 10.2 ¿Cómo se relaciona con un Equipo?

Debería relacionarse mediante:
- `gestiones_maestro.equipo_id` (columna agregada, no usada)
- `campañas_equipo` (tabla creada, no usada)

**Código actual de creación (`gestionesMaestro.controller.createGestionMaestro`):**
```javascript
INSERT INTO gestiones_maestro (nombre, descripcion, usuario_id, total_solicitudes, ...)
VALUES (?, ?, ?, ?, ...)
// No incluye equipo_id
```

**Código actual de listado (`getGestionesMaestro`):**
```javascript
SELECT * FROM gestiones_maestro WHERE usuario_id = ? ORDER BY created_at DESC
// No filtra por equipo
```

### 10.3 ¿Cómo llegan las solicitudes a una campaña?

Mediante `solicitudes_ids` (campo JSON en `gestiones_maestro`). Las solicitudes se agregan manualmente:
- Al crear la campaña se pasan los IDs
- Mediante `PUT /:id/agregar-solicitudes`
- Mediante `PUT /:id/quitar-solicitud`

### 10.4 ¿Cómo se distribuyen a los Agentes?

**Actualmente no hay distribución automática.** El líder debería asignar solicitudes individualmente a los agentes usando la tabla `asignaciones_solicitudes`, pero esta funcionalidad de asignación **no tiene UI implementada**.

---

## 11. GESTIONES

### 11.1 ¿Quién puede gestionar una solicitud?

**Actualmente:** Cualquier usuario autenticado puede gestionar solicitudes que tengan su `usuario_id`.

El filtro actual:
```sql
WHERE solicitud_id = $1 AND usuario_id = $2
```

**Diseñado:** Solo el agente al que fue asignada la solicitud (vía `asignaciones_solicitudes`).

### 11.2 ¿Quién puede verla?

**Actualmente:** Solo el usuario que importó la solicitud (filtro por `usuario_id`).

**Diseñado:** 
- Líder: ve solicitudes de todo su equipo
- Agente: ve solo sus asignaciones
- SuperAdmin: todas

### 11.3 ¿Qué ocurre cuando un Agente cambia de Equipo?

**Las gestiones se conservan.** La tabla `gestiones` no tiene `equipo_id`, solo `usuario_id`. El historial de gestiones permanece vinculado al agente.

### 11.4 ¿Se pierde o se reasigna?

- **No se pierde**: las gestiones quedan registradas con el `usuario_id` del agente original
- **No se reasigna**: las gestiones permanecen asociadas al agente que las realizó

---

## 12. IMPORTACIÓN EXCEL

### 12.1 ¿Qué ocurre cuando un Líder importa un Excel?

**Flujo actual (`excel.service.procesarExcel`):**

```
1. Se lee el archivo Excel
2. Por cada fila:
   a. Se verifica si existe por ID o cédula
   b. Si existe → UPDATE (actualiza datos)
   c. Si no existe → INSERT con usuario_id = quien importa
3. Se elimina el archivo temporal
```

### 12.2 ¿Las solicitudes se crean directamente?

**Sí.** Se insertan directamente en la tabla `solicitudes` con `usuario_id = quien_importa`.

### 12.3 ¿Pertenecen al Sistema?

**Técnicamente sí** (la tabla es global), pero **prácticamente pertenecen al usuario** que las importó (filtro por `usuario_id` en todas las consultas).

### 12.4 ¿Se asignan automáticamente?

**NO.** No hay código que inserte registros en `asignaciones_solicitudes` después de la importación.

### 12.5 ¿Quedan libres?

**Quedan asignadas al usuario importador** (por `usuario_id`), pero **no tienen asignación de equipo** en `asignaciones_solicitudes`.

### 12.6 ¿Quién las distribuye?

**Actualmente nadie.** No hay interfaz para distribuir solicitudes a agentes mediante el nuevo sistema de asignaciones.

---

## 13. FLUJO DE AUTENTICACIÓN

### 13.1 ¿Qué ocurre durante el inicio de sesión?

```
POST /api/auth/login
  │
  ├── Rate Limiter: max 5 intentos/15 min
  │
  ├── Buscar usuario: SELECT * FROM usuarios WHERE username = $1
  │
  ├── Verificaciones de seguridad:
  │   ├── ¿Cuenta bloqueada? (locked_until > now) → 423
  │   ├── ¿Cuenta activa? (is_active = false) → 403
  │   └── ¿Contraseña válida? (bcrypt.compareSync)
  │       ├── No → incrementar failed_login_attempts
  │       │   └── Si ≥ 5 → bloquear cuenta 15 min
  │       └── Sí → continuar
  │
  ├── Resetear contadores: failed_login_attempts = 0, locked_until = NULL
  │
  ├── Cargar datos de equipo:
  │   SELECT e.id, e.nombre, eu.es_lider
  │   FROM equipo_usuarios eu
  │   INNER JOIN equipos e ON eu.equipo_id = e.id
  │   WHERE eu.usuario_id = $1 AND eu.fecha_salida IS NULL
  │   LIMIT 1
  │   ├── Si existe: equipo_id, equipo_nombre, es_lider
  │   └── Si falla: null (migración pendiente)
  │
  ├── Guardar sesión:
  │   req.session.usuario = {
  │     id, username, nombre, email,
  │     rol, is_active, is_superadmin,
  │     equipo_id, equipo_nombre, es_lider  ← NUEVO multi-equipo
  │   }
  │
  └── Registrar auditoría: INSERT INTO audit_log
```

### 13.2 ¿Qué datos carga la sesión?

| Dato | Fuente | ¿Siempre presente? |
|------|--------|:------------------:|
| `id` | `usuarios.id` | ✅ Sí |
| `username` | `usuarios.username` | ✅ Sí |
| `nombre` | `usuarios.nombre` | ✅ Sí |
| `email` | `usuarios.email` | ✅ Sí |
| `rol` | `usuarios.rol` | ✅ Sí (default 'user') |
| `is_active` | `usuarios.is_active` | ✅ Sí |
| `is_superadmin` | `usuarios.is_superadmin` | ✅ Sí |
| `equipo_id` | `equipo_usuarios.equipo_id` | ⚠️ Puede ser null |
| `equipo_nombre` | `equipos.nombre` | ⚠️ Puede ser null |
| `es_lider` | `equipo_usuarios.es_lider` | ⚠️ Puede ser false |

### 13.3 ¿Qué información del Equipo se almacena?

- `equipo_id`: ID del equipo al que pertenece
- `equipo_nombre`: Nombre del equipo (ej: "Sistema", "Ventas")
- `es_lider`: Booleano que indica si es líder del equipo

### 13.4 ¿Qué permisos se cargan?

**No se cargan permisos en la sesión.** Los permisos se verifican bajo demanda:

- **Síncronos** (`requiresPermission`): verifican contra `ROLES` en memoria
- **Asíncronos** (`requiresPermissionAsync`): consultan BD en cada request

### 13.5 ¿Cómo sabe el sistema qué puede hacer ese usuario?

Mediante el middleware, en cada request protegido:
1. El rol está en `req.session.usuario.rol`
2. El equipo está en `req.session.usuario.equipo_id`
3. `requiresPermissionAsync` consulta `permisos_roles` en BD
4. `requiresEquipo` verifica `equipo_id` de la sesión

---

## 14. FLUJO DE ASIGNACIONES

### 14.1 Estado Actual

**El flujo de asignaciones NO está operativo.** La tabla `asignaciones_solicitudes` fue creada pero:

1. **No hay código** que inserte datos en ella después de importar Excel
2. **No hay UI** para que el líder asigne solicitudes a agentes
3. **No hay consultas** que la utilicen para filtrar solicitudes

### 14.2 Flujo Diseñado (NO implementado)

```
1. LÍDER importa Excel → solicitudes (usuario_id = líder)
       │
       ▼
2. Asignación automática al equipo del líder
   INSERT INTO asignaciones_solicitudes (solicitud_id, equipo_id, asignado_por, tipo_asignacion)
   VALUES (..., equipo_del_lider, lider_id, 'importacion')
       │
       ▼
3. LÍDER asigna solicitudes a AGENTES (desde UI)
   INSERT INTO asignaciones_solicitudes (solicitud_id, equipo_id, usuario_id, asignado_por)
   VALUES (..., equipo_id, agente_id, lider_id)
       │
       ▼
4. AGENTE ve solicitudes asignadas
   SELECT s.* FROM solicitudes s
   INNER JOIN asignaciones_solicitudes a ON s.id_solicitud = a.solicitud_id
   WHERE a.usuario_id = $1 AND a.fecha_desasignacion IS NULL
```

---

## 15. FLUJO COMPLETO DE TRABAJO

### 15.1 Flujo Actual (lo que funciona ahora)

```
SUPERADMIN
  │
  ├── Crea equipo → POST /api/equipos (nombre, descripción)
  │
  ├── Asigna líder → PUT /api/equipos/:id/asignar-lider
  │   └── UPDATE equipo_usuarios SET es_lider = 1
  │
  └── (Opcional) Crea agente → POST /api/equipos/:id/agentes
      └── INSERT usuario (rol='agente') + INSERT equipo_usuarios

LÍDER
  │
  ├── Ve dashboard del equipo → GET /api/equipos/:id/dashboard
  │
  ├── Crea agentes → POST /api/equipos/:id/agentes
  │
  ├── Importa Excel → POST /api/excel/upload
  │   └── Solicitudes quedan con usuario_id = líder
  │
  ├── Crea campaña → POST /api/gestiones-maestro
  │   └── solicitudes_ids = [1, 2, 3, ...]
  │
  ├── Ve campañas → GET /api/gestiones-maestro
  │   └── Filtradas por usuario_id del líder
  │
  └── Ve gestiones del equipo → GET /api/equipos/:id/gestiones

AGENTE
  │
  ├── Inicia sesión → Ve dashboard con card "Mi Equipo"
  │
  ├── (Si el líder le compartió acceso) Gestiona solicitudes
  │   └── En el sistema ACTUAL: ve solicitudes con su usuario_id
  │
  └── NO ve las solicitudes que el líder importó
      └── Porque están filtradas por usuario_id del líder
```

### 15.2 Problema Crítico en el Flujo

Actualmente, cuando un Líder importa Excel, las solicitudes se asignan a su `usuario_id`. Los agentes NO pueden ver ni gestionar esas solicitudes porque todas las consultas filtran por `usuario_id` (el del agente es diferente al del líder).

**Esto rompe el flujo multi-equipo:** el líder importa solicitudes pero no hay mecanismo para que los agentes las vean.

---

## 16. DIAGRAMA TEXTUAL DE LA ARQUITECTURA

### 16.1 Diagrama de Capas

```
┌─────────────────────────────────────────────────────────────────────┐
│                        FRONTEND                                      │
│                                                                       │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────┐  ┌───────────┐  │
│  │  Admin       │  │  Líder       │  │  Agente      │  │  Usuario  │  │
│  │  /admin      │  │  /equipo     │  │  /           │  │  /        │  │
│  └──────┬──────┘  └──────┬───────┘  └──────┬──────┘  └─────┬─────┘  │
│         │                │                 │               │         │
└─────────┼────────────────┼─────────────────┼───────────────┼─────────┘
          │                │                 │               │
          ▼                ▼                 ▼               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        API REST (Express.js)                         │
│                                                                       │
│  ┌──────────┐ ┌──────────┐ ┌────────┐ ┌────────┐ ┌───────────────┐ │
│  │ /api/     │ │ /api/    │ │ /api/  │ │ /api/  │ │ /api/         │ │
│  │ equipos   │ │ excel    │ │ admin  │ │ auth   │ │ gestiones-    │ │
│  │           │ │          │ │        │ │        │ │ maestro       │ │
│  └─────┬─────┘ └────┬─────┘ └───┬────┘ └───┬────┘ └──────┬────────┘ │
└────────┼────────────┼────────────┼──────────┼─────────────┼──────────┘
         │            │            │          │             │
         ▼            ▼            ▼          ▼             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    MIDDLEWARE (auth.middleware.js)                    │
│                                                                       │
│  requiresAuth → requiresRole → requiresPermissionAsync → requiresEquipo │
└─────────────────────────────────────────────────────────────────────┘
         │            │            │          │             │
         ▼            ▼            ▼          ▼             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    CONTROLADORES (controllers/)                       │
│                                                                       │
│  ┌──────────┐ ┌──────────┐ ┌────────┐ ┌────────┐ ┌───────────────┐ │
│  │ equipos  │ │ excel    │ │ admin  │ │ auth   │ │ gestiones-    │ │
│  │ .ctrl    │ │ .ctrl    │ │ .ctrl  │ │ .ctrl  │ │ maestro.ctrl  │ │
│  └─────┬────┘ └────┬────┘ └───┬────┘ └───┬────┘ └──────┬────────┘ │
└────────┼───────────┼──────────┼──────────┼───────────────┼──────────┘
         │           │          │          │               │
         ▼           ▼          ▼          ▼               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        PERMISOS (permissions.js)                      │
│                                                                       │
│  ROLES = { superadmin, admin, lider, agente, user }                  │
│  tienePermiso() → memoria                                            │
│  tienePermisoBD() → permisos_roles                                   │
│  tienePermisoEquipo() → permisos_equipo                              │
│  tienePermisoCompleto() → combinación                                 │
└─────────────────────────────────────────────────────────────────────┘
         │           │          │          │               │
         ▼           ▼          ▼          ▼               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    BASE DE DATOS (PostgreSQL)                          │
│                                                                       │
│  ┌────────────┐  ┌────────────┐  ┌─────────────┐  ┌──────────────┐ │
│  │  usuarios   │  │  equipos   │  │  solicitudes │  │ asignaciones │ │
│  │            │  │            │  │              │  │ _solicitudes │ │
│  ├────────────┤  ├────────────┤  ├──────────────┤  ├──────────────┤ │
│  │ id         │  │ id         │  │ id_solicitud │  │ solicitud_id │ │
│  │ username   │  │ nombre     │  │ usuario_id   │  │ equipo_id    │ │
│  │ password   │  │ descripcion│  │ cedula       │  │ usuario_id   │ │
│  │ rol        │  │ activo     │  │ nombre       │  │ asignado_por │ │
│  │ ...        │  │ ...        │  │ estado       │  │ ...          │ │
│  └────────────┘  └────────────┘  │ ...          │  └──────────────┘ │
│                                  └──────────────┘                    │
│  ┌────────────────┐  ┌─────────────────┐  ┌───────────────────────┐ │
│  │ equipo_usuarios │  │  permisos_roles│  │ gestiones_maestro     │ │
│  ├────────────────┤  ├─────────────────┤  ├───────────────────────┤ │
│  │ equipo_id      │  │ rol             │  │ id                    │ │
│  │ usuario_id     │  │ permiso         │  │ usuario_id            │ │
│  │ es_lider       │  │ ...             │  │ equipo_id (nullable)  │ │
│  │ fecha_salida   │  └─────────────────┘  │ solicitudes_ids (JSON)│ │
│  └────────────────┘                       └───────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
```

### 16.2 Diagrama de Relaciones entre Tablas

```
                    ┌──────────────┐
                    │   equipos     │
                    ├──────────────┤
                    │ id           │──┐
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
              │ equipo_id (FK)  │  │ equipo_id (FK)       │
              │ usuario_id (FK) │  │ permiso              │
              │ es_lider        │  └──────────────────────┘
              │ fecha_salida    │
              └────────┬────────┘
                       │ N
                       │
              ┌────────┴────────┐
              │   usuarios      │
              ├─────────────────┤
              │ id              │──┐
              │ username        │  │  ┌──────────────────────┐
              │ password        │  │  │  permisos_roles      │
              │ rol             │  ├──│──────────────────────┤
              │ ...             │  │  │ rol                  │
              └─────────────────┘  │  │ permiso              │
                                   │  └──────────────────────┘
                                   │
              ┌────────────────────┘
              │
              ▼
┌──────────────────────────┐
│  asignaciones_solicitudes │
├──────────────────────────┤
│ solicitud_id             │──→ solicitudes (lógica)
│ equipo_id (FK)           │
│ usuario_id (FK)          │
│ asignado_por (FK)        │
│ fecha_desasignacion      │
└──────────────────────────┘

┌──────────────────────┐
│ gestiones_maestro     │ (MODIFICADA)
├──────────────────────┤
│ ...                  │
│ + equipo_id (NUEVO)  │──→ equipos
└──────────────────────┘

┌──────────────────────┐
│ campañas_equipo       │ (SIN USO)
├──────────────────────┤
│ campaña_id           │──→ gestiones_maestro (lógica)
│ equipo_id (FK)       │
└──────────────────────┘
```

---

## 17. ESTADO REAL DE LA IMPLEMENTACIÓN

### 17.1 Matriz de Implementación por Componente

| Componente | Archivo(s) | Estado | Funcional |
|:-----------|:-----------|:------:|:---------:|
| **Tablas BD** | migraciones/003_* | ✅ Creadas | ✅ Sí |
| **Seed data** | migraciones/003_seed_team_data.js | ✅ Ejecutado | ✅ Sí |
| **ROLES definición** | src/config/permissions.js | ✅ Completo | ✅ Sí |
| **tienePermisoCompleto** | src/config/permissions.js | ✅ Completo | ✅ Sí |
| **tienePermisoBD** | src/config/permissions.js | ✅ Completo | ✅ Sí |
| **tienePermisoEquipo** | src/config/permissions.js | ✅ Completo | ✅ Sí |
| **requiresPermissionAsync** | src/middleware/auth.middleware.js | ✅ Completo | ✅ Sí |
| **requiresEquipo** | src/middleware/auth.middleware.js | ✅ Completo | ✅ Sí |
| **Login con datos de equipo** | src/controllers/auth.controller.js | ✅ Completo | ✅ Sí |
| **CRUD equipos** | src/controllers/equipos.controller.js | ✅ Completo | ✅ Sí |
| **Crear agente** | src/controllers/equipos.controller.js | ✅ Completo | ✅ Sí |
| **Dashboard equipo** | src/controllers/equipos.controller.js | ✅ Completo | ✅ Sí |
| **Rutas equipos** | src/routes/equipos.routes.js | ✅ Completo | ✅ Sí |
| **Panel Admin equipos** | public/admin/index.html + admin.js | ✅ Completo | ✅ Sí |
| **Panel Líder** | public/desktop/equipo.html + .js + .css | ✅ Completo | ✅ Sí |
| **Card Mi Equipo** | public/desktop/index.html + dashboard.js | ✅ Completo | ✅ Sí |
| **Drawer enlace equipo** | public/js/drawer.js | ✅ Completo | ✅ Sí |
| **Auto-asignación post-import** | NO IMPLEMENTADO | ❌ | ❌ No |
| **Asignación manual a agentes** | NO IMPLEMENTADO | ❌ | ❌ No |
| **Filtro campañas por equipo** | src/controllers/gestionesMaestro.controller.js | ❌ | ❌ No |
| **UI asignación líder→agente** | NO IMPLEMENTADO | ❌ | ❌ No |
| **UI agente: ver asignaciones** | NO IMPLEMENTADO | ❌ | ❌ No |
| **Campañas multi-equipo** | campañas_equipo (tabla) | ⚠️ | ❌ No |

### 17.2 Datos Actuales en BD

| Tabla | Datos esperados | Estado |
|-------|:---------------:|:------:|
| `equipos` | 1 (Sistema) + creados por SuperAdmin | ✅ Poblada |
| `equipo_usuarios` | Todos los usuarios + líderes/agentes | ✅ Poblada |
| `permisos_roles` | 47 permisos (20 líder + 12 agente + 15 user) | ✅ Poblada |
| `permisos_equipo` | 0 (solo si SuperAdmin concede extras) | ✅ Vacía (correcto) |
| `asignaciones_solicitudes` | Debería tener registros tras importaciones | ❌ Vacía |
| `campañas_equipo` | Debería tener asociaciones | ❌ Vacía |
| `gestiones_maestro.equipo_id` | Debería tener valores | ❌ Null |

---

## 18. DIFERENCIAS ENTRE DISEÑO ORIGINAL E IMPLEMENTACIÓN

### 18.1 Funcionalidades No Implementadas

| # | Funcionalidad | Diseño Original | Implementación | Brecha |
|:-:|---------------|-----------------|:--------------:|:------:|
| 1 | **Auto-asignación tras importar Excel** | `excel.service.js` debía insertar en `asignaciones_solicitudes` después de importar | No se agrega código de asignación | ❌ **CRÍTICA** |
| 2 | **Filtro campañas por equipo** | `gestionesMaestro.controller.js` debía filtrar por `equipo_id` según el rol | Filtra solo por `usuario_id` (antiguo) | ❌ **CRÍTICA** |
| 3 | **Crear campaña con equipo_id** | `createGestionMaestro` debía incluir `equipo_id` del líder | No incluye `equipo_id` | ❌ **CRÍTICA** |
| 4 | **UI líder: asignar solicitudes** | Panel con selector de agente y solicitudes | No implementado | ❌ **ALTA** |
| 5 | **UI agente: ver asignaciones** | Lista de solicitudes filtrada por `asignaciones_solicitudes.usuario_id` | No implementado | ❌ **ALTA** |
| 6 | **Campañas multi-equipo** | Tabla `campañas_equipo` con asociación campaña↔equipo | Tabla creada pero sin uso | ❌ **MEDIA** |
| 7 | **Migración usuarios a lider/agente** | Seed data debía cambiar rol de usuarios | Solo asigna al equipo, no cambia rol | ⚠️ **DECISIÓN** |
| 8 | **Dashboard de equipo (backend)** | Controlador con estadísticas por equipo | Implementado solo en `equipos.controller.js` | ✅ **OK** |

### 18.2 Funcionalidades Implementadas Correctamente

| # | Funcionalidad | Estado |
|:-:|---------------|:------:|
| 1 | Creación de tablas BD (6 nuevas + 1 modificación) | ✅ |
| 2 | Seed data (equipo Sistema + usuarios + permisos) | ✅ |
| 3 | Sistema de permisos híbrido (memoria + BD) | ✅ |
| 4 | Middleware de autorización completo | ✅ |
| 5 | Login con carga de datos de equipo | ✅ |
| 6 | CRUD completo de equipos (backend) | ✅ |
| 7 | Creación de agentes (transaccional) | ✅ |
| 8 | Panel Admin con pestaña Equipos | ✅ |
| 9 | Panel del Líder con dashboard, agentes, campañas | ✅ |
| 10 | Card "Mi Equipo" en dashboard principal | ✅ |
| 11 | Drawer con enlace a gestión de equipo | ✅ |
| 12 | Historial de membresías (fecha_salida) | ✅ |
| 13 | Restricción de acceso por equipo (requiresEquipo) | ✅ |
| 14 | Auditoría de operaciones de equipo | ✅ |

---

## 19. FUNCIONALIDADES PENDIENTES

### 19.1 Críticas (Bloquean el flujo multi-equipo)

| # | Funcionalidad | Impacto | Archivos a modificar |
|:-:|---------------|:-------:|----------------------|
| 1 | **Auto-asignar solicitudes al equipo tras importar Excel** | Sin esto, las solicitudes quedan con `usuario_id` del líder y los agentes no pueden verlas | `excel.service.js` → agregar INSERT en `asignaciones_solicitudes` |
| 2 | **Filtrar campañas por equipo** | El líder debe ver solo campañas de su equipo | `gestionesMaestro.controller.js` → agregar filtro por `equipo_id` |
| 3 | **Asignar equipo_id al crear campaña** | La campaña debe pertenecer al equipo del creador | `createGestionMaestro` → incluir `equipo_id` |
| 4 | **UI para que líder asigne solicitudes a agentes** | Sin UI, los agentes no reciben trabajo | Nuevo frontend en panel del líder |
| 5 | **Filtrar solicitudes para agente (por asignaciones)** | El agente debe ver solo lo que le asignaron | `excel.controller.listarSolicitudes` → JOIN con `asignaciones_solicitudes` |

### 19.2 Altas

| # | Funcionalidad | Impacto | Archivos a modificar |
|:-:|---------------|:-------:|----------------------|
| 6 | **Dashboard del líder: conteo real de asignaciones** | Actualmente el conteo usa `asignaciones_solicitudes` (vacía) | Poblar asignaciones + arreglar consultas |
| 7 | **Reasignación de solicitudes entre agentes** | El líder necesita reasignar trabajo | `equipos.controller.js` + UI |
| 8 | **Notificar al agente cuando recibe asignación** | El agente debe saber que tiene trabajo nuevo | Sistema de notificaciones + SSE |

### 19.3 Medias

| # | Funcionalidad | Impacto | Archivos a modificar |
|:-:|---------------|:-------:|----------------------|
| 9 | **Campañas multi-equipo via campañas_equipo** | Permitir campañas compartidas entre equipos | Usar tabla `campañas_equipo` |
| 10 | **Permisos por equipo (permisos_equipo)** | Conceder permisos extras a equipos completos | UI en admin + lógica de verificación |
| 11 | **Dashboard de rendimiento por agente** | El líder ve métricas individuales | `equipos.controller.dashboardEquipo` → + stats |

---

## 20. RECOMENDACIONES TÉCNICAS PARA LA SIGUIENTE FASE

### 20.1 Prioridad 🔴 Crítica — Habilitar el Flujo Multi-Equipo

#### 1. Auto-asignación post-importación

**Dónde:** `services/excel.service.js` — al final de `procesarExcel()`

**Qué hacer:** Después de insertar/actualizar solicitudes, insertar en `asignaciones_solicitudes`:
```javascript
// Después del bucle de procesamiento
if (inserts > 0 && usuarioId) {
    // Obtener el equipo del usuario importador
    const equipoRes = await pool.query(
        'SELECT equipo_id FROM equipo_usuarios WHERE usuario_id = $1 AND fecha_salida IS NULL',
        [usuarioId]
    );
    if (equipoRes.rows.length > 0) {
        const equipoId = equipoRes.rows[0].equipo_id;
        // Asignar las nuevas solicitudes al equipo
        await pool.query(`
            INSERT INTO asignaciones_solicitudes (solicitud_id, equipo_id, asignado_por, tipo_asignacion)
            SELECT s.id_solicitud, $1, $2, 'importacion'
            FROM solicitudes s
            WHERE s.usuario_id = $2
              AND NOT EXISTS (
                SELECT 1 FROM asignaciones_solicitudes a
                WHERE a.solicitud_id = s.id_solicitud AND a.fecha_desasignacion IS NULL
              )
        `, [equipoId, usuarioId]);
    }
}
```

#### 2. Filtrar campañas por equipo

**Dónde:** `controllers/gestionesMaestro.controller.js`

**Qué hacer:** Modificar `getGestionesMaestro()` para filtrar por equipo si el usuario es líder:
```javascript
// En getGestionesMaestro
const user = req.session.usuario;
let sql = 'SELECT * FROM gestiones_maestro WHERE 1=1';
const params = [];

if (user.rol === 'lider' && user.equipo_id) {
    sql += ' AND equipo_id = $1';
    params.push(user.equipo_id);
} else if (user.rol === 'agente' && user.equipo_id) {
    sql += ' AND (equipo_id = $1 OR usuario_id = $2)';
    params.push(user.equipo_id, user.id);
} else {
    sql += ' AND usuario_id = $1';
    params.push(user.id);
}
```

#### 3. Asignar `equipo_id` al crear campaña

**Dónde:** `controllers/gestionesMaestro.controller.js` — `createGestionMaestro()`

**Qué hacer:** Incluir `equipo_id` del usuario si es líder:
```javascript
const user = req.session.usuario;
const equipoId = (user.rol === 'lider' || user.rol === 'agente') ? user.equipo_id : null;

const resultGM = await pool.query(`
    INSERT INTO gestiones_maestro (nombre, descripcion, usuario_id, equipo_id, total_solicitudes, ...)
    VALUES (?, ?, ?, ?, ?, ...)
`, [nombre, descripcion, usuarioId, equipoId, ...]);
```

### 20.2 Prioridad 🟡 Alta — UI de Asignaciones

#### 4. UI para que el líder asigne solicitudes a agentes

**Dónde:** `public/desktop/equipo.html` + `public/desktop/js/equipo.js`

**Qué implementar:**
- Selector de solicitudes no asignadas (disponibles en el equipo)
- Tabla de agentes con botón "Asignar"
- Modal de asignación masiva de solicitudes
- Modal de asignación individual

**API necesaria:**
```javascript
// Nuevo endpoint o extender existente
PUT /api/equipos/:id/asignar
Body: { solicitud_id, usuario_id }

// O asignación masiva
PUT /api/equipos/:id/asignar-masivo
Body: { solicitud_ids: [], usuario_id }
```

#### 5. UI para que el agente vea sus asignaciones

**Dónde:** Modificar consultas en `excel.controller.listarSolicitudes()` y `buscarSolicitudes()`

**Qué cambiar:** Para usuarios con rol `agente`, las consultas deben JOIN con `asignaciones_solicitudes`:
```sql
SELECT s.*
FROM solicitudes s
INNER JOIN asignaciones_solicitudes a ON s.id_solicitud = a.solicitud_id
WHERE a.usuario_id = $1 AND a.fecha_desasignacion IS NULL
```

### 20.3 Prioridad 🟢 Media — Mejoras

| # | Mejora | Esfuerzo | Beneficio |
|:-:|--------|:--------:|:---------:|
| 6 | Dashboard de rendimiento por agente en panel del líder | 2h | Visibilidad de productividad |
| 7 | Historial de asignaciones por solicitud | 1h | Auditoría completa |
| 8 | Permisos extra por equipo (UI en admin) | 3h | Flexibilidad organizacional |
| 9 | Crear líder desde panel admin (sin código) | 1h | UX para SuperAdmin |
| 10 | Dashboard admin: estadísticas por equipo | 2h | Visibilidad global |

### 20.4 Resumen de Esfuerzo Estimado

| Prioridad | Funcionalidades | Esfuerzo estimado |
|:---------:|:---------------:|:-----------------:|
| 🔴 Crítica | 3 (auto-asignación + filtro campañas + equipo_id) | 4-6 horas |
| 🟡 Alta | 2 (UI asignación líder + UI agente) | 8-12 horas |
| 🟢 Media | 5 (mejoras) | 8-10 horas |
| **Total** | **10** | **20-28 horas** |

---

## ANEXO A: Referencia de Archivos Clave

| Archivo | Propósito | Líneas |
|:--------|-----------|:------:|
| `src/config/permissions.js` | Definición de roles y permisos, funciones de verificación | ~150 |
| `src/middleware/auth.middleware.js` | Middleware de autenticación y autorización | ~200 |
| `src/controllers/auth.controller.js` | Login con carga de equipo en sesión | ~470 |
| `src/controllers/equipos.controller.js` | CRUD de equipos, agentes, dashboard | ~450 |
| `src/controllers/gestionesMaestro.controller.js` | Campañas (sin filtro por equipo) | ~380 |
| `src/services/excel.service.js` | Importación Excel (sin auto-asignación) | ~250 |
| `src/routes/equipos.routes.js` | Rutas API de equipos | ~60 |
| `migrations/003_create_team_tables.js` | Creación de tablas multi-equipo | ~200 |
| `migrations/003_seed_team_data.js` | Seed data (equipo Sistema + permisos) | ~200 |
| `public/admin/js/admin.js` | Panel Admin con gestión de equipos | ~600 |
| `public/desktop/js/equipo.js` | Panel del Líder | ~350 |
| `public/desktop/equipo.html` | HTML del Panel del Líder | ~250 |
| `public/js/drawer.js` | Drawer con enlace a gestión de equipo | ~200 |

## ANEXO B: Comandos de Verificación

```bash
# Verificar usuarios y sus roles
psql $DATABASE_URL -c "SELECT id, username, rol, is_superadmin FROM usuarios ORDER BY id;"

# Verificar equipos
psql $DATABASE_URL -c "SELECT * FROM equipos;"

# Verificar miembros de equipos
psql $DATABASE_URL -c "
  SELECT e.nombre as equipo, u.username, eu.es_lider, eu.fecha_ingreso, eu.fecha_salida
  FROM equipo_usuarios eu
  INNER JOIN equipos e ON eu.equipo_id = e.id
  INNER JOIN usuarios u ON eu.usuario_id = u.id
  ORDER BY e.nombre, eu.es_lider DESC, u.username;
"

# Verificar permisos de roles
psql $DATABASE_URL -c "SELECT rol, COUNT(*) as total FROM permisos_roles GROUP BY rol ORDER BY rol;"

# Verificar asignaciones (debería estar vacía)
psql $DATABASE_URL -c "SELECT COUNT(*) as total FROM asignaciones_solicitudes WHERE fecha_desasignacion IS NULL;"

# Verificar campañas con/sin equipo
psql $DATABASE_URL -c "
  SELECT COUNT(*) as total,
         SUM(CASE WHEN equipo_id IS NULL THEN 1 ELSE 0 END) as sin_equipo,
         SUM(CASE WHEN equipo_id IS NOT NULL THEN 1 ELSE 0 END) as con_equipo
  FROM gestiones_maestro;
"
```

---

*Documento generado por Buffy (AI Agent) — 12 de Julio de 2026*
*Proyecto: ARCHIVOX v3.0 — Auditoría Funcional de la Evolución Multi-Equipo*
*Basado en análisis completo del código fuente, documentación de diseño y estado de la base de datos.*
