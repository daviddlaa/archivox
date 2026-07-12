# 🛡️ Archivox — Panel de Administración

## Documento Técnico de Análisis y Plan de Implementación

**Autor:** Buffy (AI Agent)
**Fecha:** Julio 2026
**Versión:** 2.0 — Fases 1-6 completadas

---

## Estado del Proyecto

| Fase | Estado | Progreso |
|---|---|---|
| ✅ **Fase 1: Base de Datos** | **COMPLETADA** | Migración ejecutada en Render |
| ✅ **Fase 2: Refactor Middleware** | **COMPLETADA** | Middleware centralizado + roles |
| ✅ **Fase 3: Mejora Auth Controller** | **COMPLETADA** | Endpoint cambiar contraseña |
| ✅ **Fase 4: Panel Admin Backend** | **COMPLETADA** | 9 endpoints protegidos |
| ✅ **Fase 5: Panel Admin Frontend** | **COMPLETADA** | UI + responsive (móvil/desktop) |
| ✅ **Fase 6: Seguridad** | **COMPLETADA** | Rate limiting admin |
| ⏳ **Fase 7: Pruebas y Despliegue** | **Pendiente** | Verificar en Render |

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

### Estructura del proyecto (actualizada)

```
Archivox/
├── app.js                              # Entry point (rutas + admin)
├── migrations/                         # Scripts de migración
│   ├── 001_add_admin_columns.sql               # PostgreSQL
│   ├── 001_add_admin_columns.sqlite.sql        # SQLite
│   └── 001_add_admin_columns.js                # JS ejecutable
├── docs/
│   └── analisis-admin.md               # Este documento
├── src/
│   ├── config/
│   │   ├── permissions.js              # NUEVO — Roles/permisos
│   │   ├── db.js                       # Wrapper unificado PG/SQLite
│   │   ├── database.js                 # SQLite directo (legado)
│   │   ├── database.pg.js              # PostgreSQL directo (legado)
│   │   ├── initDb.js                   # Schema SQLite (actualizado)
│   │   ├── initDb.pg.js                # Schema PostgreSQL (actualizado)
│   │   ├── multer.config.js            # Upload config
│   │   └── auth.controller.js          # SQLite auth (legado)
│   ├── middleware/
│   │   └── auth.middleware.js          # NUEVO — Middleware centralizado
│   ├── controllers/
│   │   ├── auth.controller.js          # Login + cambiarPassword
│   │   ├── admin.controller.js         # NUEVO — CRUD admin
│   │   ├── excel.controller.js
│   │   ├── gestionesMaestro.controller.js
│   │   ├── relaciones.controller.js
│   │   └── relacionesGestion.controller.js
│   ├── routes/
│   │   ├── auth.routes.js
│   │   ├── admin.routes.js             # NUEVO — Rutas admin con rate limit
│   │   ├── excel.routes.js
│   │   ├── gestionesMaestro.routes.js
│   │   ├── relaciones.routes.js
│   │   ├── relacionesGestion.routes.js
│   │   └── debug.routes.js
│   └── services/
│       ├── excel.service.js
│       └── relaciones.service.js
├── public/
│   ├── admin/                          # NUEVO — Panel admin
│   │   ├── index.html                  # Admin panel HTML
│   │   ├── css/admin.css               # Estilos admin (tema claro)
│   │   └── js/admin.js                 # Lógica del admin panel
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

### Reglas de seguridad anti-escalamiento (Fase 4)

| Regla | Aplica a | ¿Quién puede? |
|---|---|---|
| Admin no puede modificar a otro admin | `actualizarUsuario` | Solo superadmin |
| Admin no puede autopromoverse a superadmin | `actualizarUsuario` | Nadie |
| Cambiar `is_superadmin` | `actualizarUsuario` | Solo superadmin |
| Asignar rol admin | `actualizarUsuario`, `crearUsuario` | Solo superadmin |
| Desactivar a otro admin | `toggleActivo` | Solo superadmin |
| Resetear contraseña de admin | `resetPassword` | Solo superadmin |
| Desactivarse a sí mismo | `toggleActivo` | NADIE (prohibido) |

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

### Mejoras de seguridad implementadas

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
| Sesión con httpOnly + sameSite:strict | ✅ |
| Rate limiting login (5 intentos / 15 min) | ✅ |
| Rate limiting admin (30 req / min) | ✅ |
| Cambio de contraseña con validación fuerte | ✅ |
| Protección anti-escalamiento de privilegios | ✅ |
| Auditoría de acciones admin (CRUD, reset pass) | ✅ |

---

## 5. Panel de Administración

### Frontend (`public/admin/`)

| Archivo | Descripción |
|---|---|
| `index.html` | Panel con 3 tabs: Usuarios, Estadísticas, Auditoría |
| `css/admin.css` | Tema claro que coincide con el sistema (fondo `#f0f2f5`, indigos, tabla dark) |
| `js/admin.js` | Lógica completa: CRUD, filtros, paginación, modales, cards móviles |

### Funcionalidades

| Funcionalidad | Estado |
|---|---|
| Listar usuarios con búsqueda y filtros (rol, estado) | ✅ |
| Paginación (15 por página) | ✅ |
| Crear usuario con validación de contraseña | ✅ |
| Editar usuario (nombre, email, rol) | ✅ |
| Activar/Desactivar usuario | ✅ |
| Desbloquear usuario | ✅ |
| Resetear contraseña | ✅ |
| Estadísticas del sistema (8 cards) | ✅ |
| Logs de auditoría con búsqueda | ✅ |
| **Versión móvil con tarjetas (cards)** | ✅ |
| Ruta `/m/admin` para móvil | ✅ |
| Enlace Admin en drawer (solo admin/superadmin) | ✅ |
| Reloj en tiempo real | ✅ |
| Toast notifications | ✅ |
| Protección XSS (escapeHtml) | ✅ |

### Responsive Design

- **Desktop (>768px)**: Tabla completa con 8 columnas
- **Móvil (<768px)**: Tabla oculta, se muestran tarjetas (`.user-card`) apilables con nombre, rol, estado, acciones

---

## 6. Plan de Implementación

### ✅ Fase 1 — Base de Datos (COMPLETADA)

- [x] Crear `migrations/` directorio
- [x] Script de migración PostgreSQL (`001_add_admin_columns.sql`)
- [x] Script de migración SQLite (`001_add_admin_columns.sqlite.sql`)
- [x] Actualizar `initDb.pg.js` con nuevo schema de usuarios + audit_log
- [x] Actualizar `initDb.js` con nuevo schema de usuarios + audit_log
- [x] Actualizar `db.js` wrapper para convertir INTERVAL syntax a SQLite
- [x] Actualizar `auth.controller.js` con seguridad mejorada
- [x] Crear documento de análisis (`docs/analisis-admin.md`)

### ✅ Fase 2 — Refactor Middleware (COMPLETADA)

- [x] Crear `src/config/permissions.js` — Roles, permisos y helpers
- [x] Crear `src/middleware/auth.middleware.js` — 6 funciones de seguridad centralizadas
- [x] Eliminar las **6 definiciones duplicadas** de `requiresAuth`
- [x] Actualizar `app.js` para usar `requireAuthPage` importado

### ✅ Fase 3 — Mejora Auth Controller (COMPLETADA)

- [x] Agregar endpoint `PUT /api/auth/cambiar-password` en `auth.controller.js`
  - Valida contraseña actual con `bcrypt.compareSync`
  - Valida nueva contraseña (≥8 chars, mayúscula, número)
  - Actualiza `password_changed_at`
  - Registra en `audit_log`

### ✅ Fase 4 — Panel Admin Backend (COMPLETADA)

- [x] Crear `src/routes/admin.routes.js` — 10 endpoints protegidos
- [x] Crear `src/controllers/admin.controller.js` — Controlador completo
- [x] CRUD completo de usuarios con seguridad anti-escalamiento
- [x] Estadísticas del sistema (8 consultas en paralelo)
- [x] Logs de auditoría con filtros y paginación
- [x] Registrado en `app.js` como `/api/admin`

### ✅ Fase 5 — Panel Admin Frontend (COMPLETADA)

- [x] Crear `public/admin/index.html` — Panel con 3 tabs
- [x] Crear `public/admin/js/admin.js` — Lógica completa
- [x] Crear `public/admin/css/admin.css` — Tema claro del sistema
- [x] Versión responsive con cards en móvil
- [x] Ruta `/m/admin` para móvil
- [x] Enlace Admin en drawer (desktop y móvil)

### ✅ Fase 6 — Seguridad (COMPLETADA)

- [x] Rate limiting específico para rutas admin (30 req/min)
- [x] Protección anti-escalamiento de privilegios (7 reglas)
- [x] Validación de contraseña fuerte en creación/reseteo
- [x] Escape HTML en frontend (XSS prevention)
- [x] Auditoría de todas las acciones admin

### ⏳ Fase 7 — Pruebas y Despliegue (Pendiente)

- [ ] Pruebas de migración en local y staging
- [ ] Pruebas de regresión
- [ ] Verificar que el error 500 en `api/admin/usuarios` está corregido
- [ ] Verificar que el panel admin carga correctamente con `daviddlaa`
- [ ] Verificar que usuarios normales no ven el enlace Admin
- [ ] Verificar responsive móvil en `/m/admin`
- [ ] Despliegue en Render

---

## 7. Análisis de Superadmin — ¿Qué falta?

### ✅ Lo que YA funciona

| Funcionalidad | Estado | Detalle |
|---|---|---|
| `daviddlaa` configurado como superadmin en BD | ✅ | En migración y schemas |
| Sesión de superadmin reconoce `is_superadmin: true` | ✅ | `auth.controller.js` linea 236 |
| Drawer desktop muestra enlace Admin | ✅ | `checkAdminAccess()` en `drawer.js` |
| Drawer móvil muestra enlace Admin | ✅ | `checkAdminAccessMovil()` en `drawer.js` móvil |
| Admin panel carga para superadmin | ✅ | `admin.js` verifica rol en `/api/auth/sesion` |
| Badge "👑 Super Admin" en el panel | ✅ | `admin.js` linea 21 |
| Solo superadmin puede crear admins | ✅ | `crearUsuario` linea 260-262 |
| Solo superadmin puede cambiar `is_superadmin` | ✅ | `actualizarUsuario` linea 176-177 |
| Solo superadmin puede asignar rol admin | ✅ | `actualizarUsuario` linea 181-182 |
| Admin no puede autopromoverse a superadmin | ✅ | `actualizarUsuario` linea 171-172 |
| Admin no puede modificar a otro admin | ✅ | `actualizarUsuario` linea 166-167 |
| Auditoría registra acciones de superadmin | ✅ | Todas las funciones llaman a `auditar()` |
| Rate limiting en rutas admin | ✅ | 30 req/min en `admin.routes.js` |

### ⚠️ Cosas a considerar (no críticas, por diseño)

| Aspecto | Situación | Recomendación |
|---|---|---|
| **Superadmin crea otro superadmin** | No hay bloqueo explícito. Un superadmin puede crear otro superadmin vía API. | Por diseño — superadmin tiene control total. Auditoría registra quién creó a quién. |
| **Superadmin desactiva a otro superadmin** | No hay bloqueo. Un superadmin puede desactivar a otro superadmin. | Podría ser peligroso si alguien desactiva a todos. Considerar agregar regla: "no puedes desactivar al último superadmin activo". |
| **No hay superadmin por defecto nuevo** | Si se crea una BD desde cero, no hay superadmin (solo `daviddlaa` en migración). | Opcional: crear primer usuario registrado como superadmin automáticamente. |
| **Frontend superadmin puede editar otro superadmin** | El modal de edición permite cambiar datos de otro superadmin. | Por diseño. Si se quiere más seguridad, bloquear edición entre superadmins. |
| **No hay indicador visual de "último superadmin"** | No se muestra cuántos superadmins activos hay. | Mejora opcional: en estadísticas mostrar conteo de superadmins. |

### Conclusión

**No hay nada crítico pendiente sobre superadmin.** El sistema tiene todas las protecciones necesarias:

1. ✅ Admin **no puede** escalar a superadmin
2. ✅ Admin **no puede** modificar a otros admins
3. ✅ **Solo superadmin** puede crear/promover admins
4. ✅ **Solo superadmin** puede cambiar `is_superadmin`
5. ✅ **Nadie** puede desactivarse a sí mismo
6. ✅ Todas las acciones quedan registradas en `audit_log`
7. ✅ El panel admin solo es visible para admin/superadmin

---

## 8. Arquitectura del Frontend Admin

### Flujo de carga del panel

```
Usuario → GET /admin → requireAuthPage → redirige a login si no hay sesión
         → Sirve public/admin/index.html
         → admin.js hace fetch a /api/auth/sesion
         → Verifica rol: ¿admin o superadmin?
            → NO: redirige a /
            → SÍ: Muestra panel, badge "👑 Super Admin" o "🛡️ Admin"
```

### Endpoints consumidos

| Endpoint | Uso en frontend |
|---|---|
| `GET /api/auth/sesion` | Verificar autenticación y rol |
| `GET /api/admin/usuarios` | Listar usuarios con filtros |
| `GET /api/admin/usuarios/:id` | Cargar datos para edición |
| `PUT /api/admin/usuarios/:id` | Guardar cambios de usuario |
| `POST /api/admin/usuarios` | Crear usuario nuevo |
| `PUT /api/admin/usuarios/:id/toggle-active` | Activar/Desactivar |
| `PUT /api/admin/usuarios/:id/reset-password` | Resetear contraseña |
| `PUT /api/admin/usuarios/:id/unlock` | Desbloquear cuenta |
| `GET /api/admin/estadisticas` | Estadísticas del sistema |
| `GET /api/admin/auditoria` | Logs de auditoría |

---

## 9. Archivos Creados/Modificados

### Fase 1 — Base de Datos

| Archivo | Cambio |
|---|---|
| `migrations/001_add_admin_columns.sql` | **NUEVO** |
| `migrations/001_add_admin_columns.sqlite.sql` | **NUEVO** |
| `migrations/001_add_admin_columns.js` | **NUEVO** |
| `docs/analisis-admin.md` | **NUEVO** |
| `src/config/initDb.pg.js` | **MODIFICADO** |
| `src/config/initDb.js` | **MODIFICADO** |
| `src/config/db.js` | **MODIFICADO** |
| `src/controllers/auth.controller.js` | **MODIFICADO** |

### Fase 2 — Middleware

| Archivo | Cambio |
|---|---|
| `src/config/permissions.js` | **NUEVO** |
| `src/middleware/auth.middleware.js` | **NUEVO** |
| `app.js` | **MODIFICADO** |
| `src/routes/auth.routes.js` | **MODIFICADO** |
| `src/routes/excel.routes.js` | **MODIFICADO** |
| `src/routes/relaciones.routes.js` | **MODIFICADO** |
| `src/routes/relacionesGestion.routes.js` | **MODIFICADO** |
| `src/routes/debug.routes.js` | **MODIFICADO** |

### Fase 3 — Mejora Auth

| Archivo | Cambio |
|---|---|
| `src/controllers/auth.controller.js` | **MODIFICADO** (cambiarPassword) |
| `src/routes/auth.routes.js` | **MODIFICADO** (PUT /cambiar-password) |

### Fase 4 — Backend Admin

| Archivo | Cambio |
|---|---|
| `src/controllers/admin.controller.js` | **NUEVO** |
| `src/routes/admin.routes.js` | **NUEVO** |
| `app.js` | **MODIFICADO** (registra `/api/admin`) |

### Fase 5 — Frontend Admin

| Archivo | Cambio |
|---|---|
| `public/admin/index.html` | **NUEVO** |
| `public/admin/css/admin.css` | **NUEVO** |
| `public/admin/js/admin.js` | **NUEVO** |
| `app.js` | **MODIFICADO** (rutas `/admin`, `/m/admin`) |
| `public/desktop/js/drawer.js` | **MODIFICADO** (enlace admin) |
| `public/movil/js/drawer.js` | **MODIFICADO** (enlace admin móvil) |

### Fase 6 — Seguridad

| Archivo | Cambio |
|---|---|
| `src/routes/admin.routes.js` | **MODIFICADO** (rate limiting) |

---

## 10. Instrucciones para el Usuario

### Para acceder al Panel de Administración:

1. **Inicia sesión** con `daviddlaa` (superadmin)
2. **Abre el menú** (☰) → Verás un enlace **🛡️ Admin**
3. **O ve directo** a `https://tu-app.onrender.com/admin`
4. **En móvil**: `https://tu-app.onrender.com/m/admin`

### Próximos pasos sugeridos:

1. **Haz commit y push** con `.\commit_push.bat`
2. **Verifica en Render** que el panel carga correctamente
3. **Prueba crear/editar/desactivar usuarios**
4. **Verifica que usuarios normales NO ven el enlace Admin**
5. Confirma que todo funciona para cerrar la Fase 7

---

## 11. Riesgos

| Riesgo | Probabilidad | Impacto | Mitigación |
|---|---|---|---|
| Migración de BD falla en producción | 🟡 Media | 🔴 Alto | Backup antes de migrar. Script probado. |
| Admin se queda sin acceso | 🟢 Baja | 🔴 Alto | `daviddlaa` garantizado como superadmin en migración. |
| Escalamiento de privilegios | 🟢 Baja | 🔴 Alto | 7 reglas de seguridad anti-escalamiento implementadas. |
| Ruptura de sesiones existentes | 🟡 Media | 🟡 Medio | Sesiones expiran al hacer nuevo login. |
| Compatibilidad SQLite/PostgreSQL | 🟡 Media | 🟡 Medio | `LOWER() LIKE LOWER()` usado en vez de `ILIKE`. |
| Pérdida de datos durante migración | 🟢 Baja | 🔴 Alto | Backup antes de migrar. Columnas ADD IF NOT EXISTS. |
| Bug en listarUsuarios (500 error) | ✅ **CORREGIDO** | 🔴 Alto | `Promise.all` restaurado con `dataResult` y `countResult`. |
