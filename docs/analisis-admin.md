# 🛡️ Archivox — Panel de Administración

## Documento Técnico de Análisis y Plan de Implementación

**Autor:** Buffy (AI Agent)
**Fecha:** Julio 2026
**Versión:** 1.0 — Fase 1 completada

---

## Estado del Proyecto

| Fase | Estado |
|---|---|
| ✅ **Fase 1: Base de Datos** | **COMPLETADA** |
| ✅ **Fase 2: Refactor Middleware** | **COMPLETADA** |
| ⏳ Fase 3: Mejora Auth Controller | Pendiente |
| ✅ **Fase 4: Panel Admin Backend** | **COMPLETADA** |
| ⏳ Fase 5: Panel Admin Frontend | Pendiente |
| ⏳ Fase 6: Seguridad | Pendiente |
| ⏳ Fase 7: Pruebas y Despliegue | Pendiente |

---

## 1. Arquitectura Actual

| Componente | Tecnología |
|---|---|
| Backend | **Express.js 5** (CommonJS) |
| Frontend | HTML5 + CSS3 + Vanilla JS (Desktop & Mobile separados) |
| Base de Datos | **PostgreSQL** (producción/Render) / **SQLite** (local) |
| Autenticación | **express-session** + **bcryptjs** |
| Seguridad | **helmet**, **express-rate-limit** |
| Despliegue | **Render** |

### Estructura del proyecto
```
Archivox/
├── app.js                          # Entry point
├── migrations/                     # Scripts de migración (NUEVO)
│   ├── 001_add_admin_columns.sql           # PostgreSQL
│   └── 001_add_admin_columns.sqlite.sql    # SQLite
├── docs/                           # Documentación (NUEVO)
│   └── analisis-admin.md           # Este documento
├── src/
│   ├── config/
│   │   ├── db.js                   # Wrapper unificado PG/SQLite
│   │   ├── database.js             # SQLite directo (legado)
│   │   ├── database.pg.js          # PostgreSQL directo (legado)
│   │   ├── initDb.js               # Schema SQLite (actualizado Fase 1)
│   │   ├── initDb.pg.js            # Schema PostgreSQL (actualizado Fase 1)
│   │   ├── multer.config.js        # Upload config
│   │   └── auth.controller.js      # SQLite auth controller (legado)
│   ├── controllers/
│   │   ├── auth.controller.js      # (actualizado Fase 1)
│   │   ├── excel.controller.js
│   │   ├── gestionesMaestro.controller.js
│   │   ├── relaciones.controller.js
│   │   └── relacionesGestion.controller.js
│   ├── routes/
│   │   ├── auth.routes.js
│   │   ├── excel.routes.js
│   │   ├── gestionesMaestro.routes.js
│   │   ├── relaciones.routes.js
│   │   ├── relacionesGestion.routes.js
│   │   └── debug.routes.js
│   └── services/
│       ├── excel.service.js
│       └── relaciones.service.js
├── public/
│   ├── desktop/ (HTML + JS + CSS)
│   └── movil/   (HTML + JS + CSS)
└── package.json
```

---

## 2. Modelo de Base de Datos

### Tabla `usuarios` (actualizada Fase 1)

```sql
CREATE TABLE usuarios (
    id                     SERIAL PRIMARY KEY,
    username               TEXT UNIQUE NOT NULL,
    password               TEXT NOT NULL,
    nombre                 TEXT,
    email                  TEXT UNIQUE,           -- NUEVO
    email_verified         BOOLEAN DEFAULT FALSE, -- NUEVO
    rol                    TEXT DEFAULT 'user',
    is_active              BOOLEAN DEFAULT TRUE,  -- NUEVO
    is_superadmin          BOOLEAN DEFAULT FALSE, -- NUEVO
    failed_login_attempts  INTEGER DEFAULT 0,     -- NUEVO
    locked_until           TIMESTAMP,              -- NUEVO
    password_changed_at    TIMESTAMP DEFAULT NOW(),-- NUEVO
    created_at             TIMESTAMP DEFAULT NOW(),
    updated_at             TIMESTAMP DEFAULT NOW(),-- NUEVO
    last_login             TIMESTAMP              -- ANTES: ultimo_login
);
```

### Columnas nuevas — Justificación

| Columna | Tipo | Default | Justificación |
|---|---|---|---|
| **`email`** | `TEXT UNIQUE` | `NULL` | Comunicación con el usuario. Permitirá en el futuro recuperación de contraseña y notificaciones. |
| **`email_verified`** | `BOOLEAN` | `FALSE` | Seguridad: evitar registros con emails falsos o temporales. |
| **`is_active`** | `BOOLEAN` | `TRUE` | Control de acceso: permite desactivar usuarios sin eliminar datos. Un usuario `is_active = false` no puede iniciar sesión. |
| **`is_superadmin`** | `BOOLEAN` | `FALSE` | Seguridad: solo el superadmin puede promover/deponer admins. Previene escalamiento de privilegios. |
| **`failed_login_attempts`** | `INTEGER` | `0` | Seguridad: contador de intentos fallidos consecutivos. Al llegar a 5, bloquea la cuenta. |
| **`locked_until`** | `TIMESTAMP` | `NULL` | Seguridad: cuándo se desbloquea la cuenta automáticamente tras un bloqueo por intentos fallidos. |
| **`password_changed_at`** | `TIMESTAMP` | `NOW()` | Seguridad: permite detectar cuentas con contraseñas antiguas y forzar cambio. |
| **`updated_at`** | `TIMESTAMP` | `NOW()` | Trazabilidad: saber cuándo se modificó un usuario por última vez. |
| **`last_login`** | `TIMESTAMP` | `NULL` | Antes `ultimo_login`. Renombrado para consistencia. Auditoría de acceso. |

### Índices creados

```sql
CREATE INDEX idx_usuarios_rol ON usuarios(rol);
CREATE INDEX idx_usuarios_is_active ON usuarios(is_active);
CREATE INDEX idx_usuarios_locked ON usuarios(locked_until) WHERE locked_until IS NOT NULL;
CREATE INDEX idx_audit_log_usuario ON audit_log(usuario_id);
CREATE INDEX idx_audit_log_accion ON audit_log(accion);
CREATE INDEX idx_audit_log_created_at ON audit_log(created_at);
```

### Tabla `audit_log` (nueva)

```sql
CREATE TABLE audit_log (
    id              SERIAL PRIMARY KEY,
    usuario_id      INTEGER NOT NULL REFERENCES usuarios(id),
    accion          TEXT NOT NULL,
    target_type     TEXT,
    target_id       INTEGER,
    detalle         JSONB,
    ip_address      TEXT,
    user_agent      TEXT,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## 3. Sistema de Roles

### Roles definidos

| Rol | Nivel | Descripción | Permisos |
|---|---|---|---|
| `superadmin` | 100 | Control total del sistema. Puede promover/deponer admins. | `users:*`, `system:*`, `audit:*`, `data:*` |
| `admin` | 50 | Panel de administración, gestión de usuarios, estadísticas. | `users:read`, `users:write`, `system:read`, `audit:read`, `data:*` |
| `user` | 10 | Funciones normales del sistema. | `data:read`, `data:write` |

### Estructura de permisos (para Fase 2)

```javascript
const ROLES = {
    superadmin: {
        permissions: ['users:*', 'system:*', 'audit:*', 'data:*'],
        label: 'Super Administrador'
    },
    admin: {
        permissions: ['users:read', 'users:write', 'system:read', 'audit:read', 'data:*'],
        label: 'Administrador'
    },
    user: {
        permissions: ['data:read', 'data:write'],
        label: 'Usuario'
    }
};
```

El sistema está diseñado para ser **extensible**: para agregar un nuevo rol (ej. `supervisor`, `auditor`, `vendedor`), solo se agrega a la configuración de permisos.

---

## 4. Estrategia de Autenticación y Autorización

### Flujo de Login (mejorado en Fase 1)

```
Usuario → POST /api/auth/login →
  1. ✅ Rate limiting (por IP + username)
  2. ✅ Buscar usuario por username
  3. ✅ Verificar is_active = true
  4. ✅ Verificar locked_until < NOW
  5. ✅ Verificar password (bcrypt.compareSync)
  6. ✅ Si password incorrecto → failed_login_attempts++
     - Si >= 5 → locked_until = NOW + 15 min
  7. ✅ Si password correcto → reset failed_login_attempts = 0
  8. ✅ Actualizar last_login
  9. ✅ Guardar sesión con datos completos
  10. ✅ Registrar en audit_log
```

### Mejoras de seguridad implementadas en Fase 1

| Medida | Estado |
|---|---|
| Validación de contraseña (≥8 chars, mayúscula, número) | ✅ |
| Bloqueo por intentos fallidos (5 intentos → 15 min) | ✅ |
| Verificación de cuenta activa (`is_active`) | ✅ |
| Verificación de bloqueo temporal (`locked_until`) | ✅ |
| Auditoría de login (éxito, fallido, bloqueo) | ✅ |
| Captura de IP y User-Agent en auditoría | ✅ |
| No revelar existencia del usuario en errores | ✅ |
| Contraseña hasheada con bcrypt (10 rounds) | ✅ |
| Sesión con httpOnly + sameSite:strict | ✅ (ya existía) |

### Pendiente para Fase 2 (Middleware centralizado)

```javascript
// src/middleware/auth.middleware.js (PLAN)
function requiresAuth(req, res, next) { ... }
function requiresRole(...roles) { ... }
function requiresPermission(permission) { ... }
```

---

## 5. Comparativa de Alternativas de Login

### Alternativa 1: Login único + redirección automática ✅ **RECOMENDADA**

| Aspecto | Evaluación |
|---|---|
| **Experiencia de usuario** | Óptima. Un solo punto de entrada. |
| **Complejidad** | Baja. Un formulario. Backend detecta rol y redirige. |
| **Seguridad** | Alta. Menos superficie de ataque (1 endpoint vs 2). |
| **Mantenimiento** | Excelente. Cambias una cosa y afecta a todos. |
| **Riesgos** | Mínimos. |

### Alternativa 2: Dos logins independientes
| Aspecto | Evaluación |
|---|---|
| **Experiencia** | Mala. Usuarios pueden confundirse de entrada. |
| **Seguridad** | Media. Dos endpoints = más superficie. |
| **Complejidad** | Alta. Dos formularios, dos sesiones, confusión de rutas. |
| **Mantenimiento** | Malo. Duplicar lógica. |

### Alternativa 3: Login único + rutas protegidas por permisos
| Aspecto | Evaluación |
|---|---|
| **Experiencia** | Igual que Alternativa 1. |
| **Seguridad** | Alta. |
| **Flexibilidad** | Máxima. Cualquier rol con permisos puede acceder a lo que corresponda. |

**Decisión: Alternativa 1** — Login único con detección de rol automática.

---

## 6. Plan de Implementación

### ✅ Fase 1 — Base de Datos (COMPLETADA)

- [x] Crear `migrations/` directorio
- [x] Script de migración PostgreSQL (`001_add_admin_columns.sql`)
- [x] Script de migración SQLite (`001_add_admin_columns.sqlite.sql`)
- [x] Actualizar `initDb.pg.js` con nuevo schema de usuarios + audit_log
- [x] Actualizar `initDb.js` con nuevo schema de usuarios + audit_log
- [x] Actualizar `db.js` wrapper para convertir INTERVAL syntax a SQLite
- [x] Actualizar `auth.controller.js` con seguridad mejorada:
  - [x] Validación de contraseña
  - [x] Bloqueo por intentos fallidos
  - [x] Verificación de cuenta activa
  - [x] Verificación de bloqueo temporal
  - [x] Auditoría de eventos de autenticación
  - [x] Nuevos campos en sesión (`email`, `is_active`, `is_superadmin`)
- [x] Crear documento de análisis (`docs/analisis-admin.md`)

### ✅ Fase 2 — Refactor Middleware (COMPLETADA)

- [x] Crear `src/config/permissions.js` — Roles, permisos y helpers (`tienePermiso`, `tieneNivelMinimo`)
- [x] Crear `src/middleware/auth.middleware.js` — Middleware centralizado con:
  - `requiresAuth` (API → 401)
  - `requireAuthPage` (HTML → redirect login)
  - `requiresRole(...roles)`
  - `requiresPermission(permiso)`
  - `requiresLevel(nivel)`
  - `getUsuarioId(req)`
  - `getRol(req)`
- [x] Eliminar las **6 definiciones duplicadas** de `requiresAuth` (app.js, auth.routes.js, excel.routes.js, relaciones.routes.js, relacionesGestion.routes.js, debug.routes.js)
- [x] Actualizar `app.js` para usar `requireAuthPage` importado

### ⏳ Fase 3 — Mejora Auth Controller (Pendiente)

- [ ] Mejorar registro con email y verificación
- [ ] Agregar endpoint de cambio de contraseña
- [ ] Agregar endpoint de recuperación de contraseña
- [ ] Forzar cambio de contraseña periódico

### ✅ Fase 4 — Panel Admin Backend (COMPLETADA)

- [x] Crear `src/routes/admin.routes.js` — 10 endpoints protegidos con `requiresRole('admin', 'superadmin')`
- [x] Crear `src/controllers/admin.controller.js` — Controlador completo
- [x] CRUD completo de usuarios con seguridad anti-escalamiento
- [x] Estadísticas del sistema (usuarios, solicitudes, relaciones, gestiones)
- [x] Logs de auditoría con filtros
- [x] Registrado en `app.js` como `/api/admin`

**Endpoints creados:**
| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/admin/usuarios` | Listar usuarios (búsqueda, filtros, paginación) |
| GET | `/api/admin/usuarios/:id` | Detalle de usuario |
| POST | `/api/admin/usuarios` | Crear usuario |
| PUT | `/api/admin/usuarios/:id` | Actualizar usuario |
| PUT | `/api/admin/usuarios/:id/toggle-active` | Activar/Desactivar |
| PUT | `/api/admin/usuarios/:id/reset-password` | Resetear contraseña |
| PUT | `/api/admin/usuarios/:id/unlock` | Desbloquear |
| GET | `/api/admin/estadisticas` | Estadísticas del sistema |
| GET | `/api/admin/auditoria` | Logs de auditoría |

### ⏳ Fase 5 — Panel Admin Frontend (Pendiente)

- [ ] Crear `public/admin/index.html`
- [ ] Crear `public/admin/js/admin.js`
- [ ] Crear `public/admin/css/admin.css`
- [ ] Tabla de usuarios con búsqueda/filtros
- [ ] Modal de edición de usuario
- [ ] Panel de estadísticas
- [ ] Panel de auditoría

### ⏳ Fase 6 — Seguridad (Pendiente)

- [ ] Rate limiting específico para rutas admin
- [ ] Logging de intentos de acceso no autorizado
- [ ] Headers de seguridad adicionales
- [ ] Pruebas de escalamiento de privilegios

### ⏳ Fase 7 — Pruebas y Despliegue (Pendiente)

- [ ] Pruebas de migración en local y staging
- [ ] Pruebas de regresión
- [ ] Despliegue en Render
- [ ] Verificación post-despliegue

---

## 7. Seguridad — Recomendaciones

| Medida | Prioridad | Estado |
|---|---|---|
| Middleware centralizado de roles | 🔴 Alta | ✅ Fase 2 |
| Eliminar código duplicado (6x requiresAuth) | 🔴 Alta | ✅ Fase 2 |
| Account Lockout (5 intentos → 15 min) | 🔴 Alta | ✅ Fase 1 |
| Validación de contraseña fuerte | 🔴 Alta | ✅ Fase 1 |
| Auditoría de autenticación | 🟡 Media | ✅ Fase 1 |
| Auditoría de acciones admin | 🟡 Media | ⏳ Fase 2 |
| CSRF Protection | 🟡 Media | ⏳ Fase 6 |
| CSP con nonces | 🟡 Media | ⏳ Fase 6 |
| Rate limiting rutas admin | 🟡 Media | ⏳ Fase 6 |
| Protección escalamiento privilegios | 🔴 Alta | ✅ Fase 4 |
| Sanitización de inputs | 🟡 Media | ⏳ Fase 6 |

---

## 8. Riesgos

| Riesgo | Probabilidad | Impacto | Mitigación |
|---|---|---|---|
| Migración de BD falla en producción | 🟡 Media | 🔴 Alto | Backup antes de migrar. Probar migración en local primero. |
| Admin se queda sin acceso | 🟢 Baja | 🔴 Alto | Script de migración garantiza que `daviddlaa` sea superadmin. |
| Escalamiento de privilegios | 🟢 Baja | 🔴 Alto | Middleware verifica que admin no pueda autopromoverse a superadmin. |
| Ruptura de sesiones existentes | 🟡 Media | 🟡 Medio | Sesiones actuales no tienen nuevos campos. Se pierden al hacer login de nuevo. |
| Compatibilidad SQLite/PostgreSQL | 🟡 Media | 🟡 Medio | Wrapper `db.js` actualizado para convertir INTERVAL syntax. |
| Pérdida de datos durante migración | 🟢 Baja | 🔴 Alto | Backup antes de migrar. Transacciones con ROLLBACK. |

---

## 9. Archivos Creados/Modificados

### Fase 1

| Archivo | Cambio |
|---|---|
| `migrations/001_add_admin_columns.sql` | **NUEVO** — Script de migración PostgreSQL |
| `migrations/001_add_admin_columns.sqlite.sql` | **NUEVO** — Script de migración SQLite |
| `migrations/001_add_admin_columns.js` | **NUEVO** — Script de migración JS ejecutable |
| `docs/analisis-admin.md` | **NUEVO** — Este documento |
| `src/config/initDb.pg.js` | **MODIFICADO** — Nuevo schema usuarios + audit_log |
| `src/config/initDb.js` | **MODIFICADO** — Nuevo schema usuarios + audit_log |
| `src/config/db.js` | **MODIFICADO** — Nuevas conversiones INTERVAL→SQLite |
| `src/controllers/auth.controller.js` | **MODIFICADO** — Seguridad mejorada + auditoría |

### Fase 2

| Archivo | Cambio |
|---|---|
| `src/config/permissions.js` | **NUEVO** — Definición de roles y permisos |
| `src/middleware/auth.middleware.js` | **NUEVO** — Middleware centralizado |
| `app.js` | **MODIFICADO** — Usa `requireAuthPage` importado, elimina definición local |
| `src/routes/auth.routes.js` | **MODIFICADO** — Usa middleware centralizado |
| `src/routes/excel.routes.js` | **MODIFICADO** — Usa middleware centralizado |
| `src/routes/relaciones.routes.js` | **MODIFICADO** — Usa middleware centralizado |
| `src/routes/relacionesGestion.routes.js` | **MODIFICADO** — Usa middleware centralizado |
| `src/routes/debug.routes.js` | **MODIFICADO** — Usa middleware centralizado |

### Fase 4

| Archivo | Cambio |
|---|---|
| `src/controllers/admin.controller.js` | **NUEVO** — CRUD usuarios, estadísticas, auditoría |
| `src/routes/admin.routes.js` | **NUEVO** — 10 endpoints protegidos |
| `app.js` | **MODIFICADO** — Registra `/api/admin` |

| Archivo | Cambio |
|---|---|
| `migrations/001_add_admin_columns.sql` | **NUEVO** — Script de migración PostgreSQL |
| `migrations/001_add_admin_columns.sqlite.sql` | **NUEVO** — Script de migración SQLite |
| `docs/analisis-admin.md` | **NUEVO** — Este documento |
| `src/config/initDb.pg.js` | **MODIFICADO** — Nuevo schema usuarios + audit_log |
| `src/config/initDb.js` | **MODIFICADO** — Nuevo schema usuarios + audit_log |
| `src/config/db.js` | **MODIFICADO** — Nuevas conversiones INTERVAL→SQLite |
| `src/controllers/auth.controller.js` | **MODIFICADO** — Seguridad mejorada + auditoría |

---

## 10. Instrucciones para el Usuario

### Para ejecutar la migración en PostgreSQL (Render):

```bash
# Conectarse a la BD de Render y ejecutar:
psql $(DATABASE_URL) -f migrations/001_add_admin_columns.sql
```

O manualmente desde pgAdmin o consola de Render, copiar y pegar el contenido de `migrations/001_add_admin_columns.sql`.

### Para ejecutar la migración en SQLite (local):

```bash
sqlite3 database.db < migrations/001_add_admin_columns.sqlite.sql
```

### Próximos pasos (sugeridos):

1. **Ejecutar la migración** en tu BD de Render
2. **Hacer login** con `daviddlaa` para verificar que todo funciona
3. **Confirmarme** para continuar con la **Fase 2: Middleware centralizado**
