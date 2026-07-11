# Informe Técnico - Panel de Administración Archivox

**Fecha:** Julio 2026  
**Sesión:** Evolución del Panel de Administración  
**Objetivo:** Corrección de inconsistencias, unificación de navegación, implementación de estadísticas y centro de notificaciones.

---

## Problemas Corregidos

### 1. Panel Admin no carga en escritorio

**Descripción:** El servidor fallaba al iniciar con `SQLITE_ERROR: no such column: is_active`, impidiendo que el panel de administración cargara tanto en escritorio como en móvil.

**Causa Raíz:** La base de datos existente tenía un esquema antiguo de la tabla `usuarios` (columnas: `id, username, password, nombre, rol, created_at, ultimo_login`). El archivo `initDb.js` usaba `CREATE TABLE IF NOT EXISTS` que no modifica tablas existentes, e intentaba crear un índice en `is_active` que no existía, causando el crash.

**Solución:** 
- Se agregó lógica de migración automática en `initDb.js` que detecta el esquema existente, agrega columnas faltantes mediante `ALTER TABLE ADD COLUMN`, y migra datos de `ultimo_login` a `last_login`.
- Se protegieron los `CREATE INDEX` con try-catch para que no detengan el servidor si la columna no existe.
- Se agregó verificación de existencia de tabla (`PRAGMA table_info`) antes de intentar migraciones en instalaciones nuevas.

**Archivos modificados:** `src/config/initDb.js`, `src/config/db.js`

### 2. Menú de navegación duplicado

**Descripción:** Existían dos sistemas de menú: uno legacy con `toggleMenu()` + `sidebar`/`menu-overlay`, y otro moderno con `Drawer` + `drawer.js`. Ambos sistemas tenían botones de logout duplicados.

**Causa Raíz:** Los archivos `dashboard.js`, `solicitudes.js` e `importar.js` (versión escritorio) definían una función `toggleMenu()` que hacía referencia a elementos `sidebar` y `menu-overlay` que ya no existían en las páginas actuales. Además, cada archivo tenía su propio listener de `btnLogout` duplicando el logout del drawer.

**Solución:**
- Se eliminaron las funciones `toggleMenu()` legacy de `public/desktop/js/dashboard.js`, `public/desktop/js/solicitudes.js` y `public/desktop/js/importar.js`.
- Se eliminaron los listeners duplicados de `btnLogout` en `public/desktop/js/dashboard.js`.
- El sistema de logout se unificó en `drawer.js` (función `cerrarSesion()`).

**Archivos modificados:** `public/desktop/js/dashboard.js`, `public/desktop/js/solicitudes.js`, `public/desktop/js/importar.js`

### 3. Auditoría no funciona en móvil

**Descripción:** La pestaña de Auditoría cargaba datos pero no se mostraban en dispositivos móviles.

**Causa Raíz:** El CSS del panel admin ocultaba `.admin-table-wrapper` en móvil (`@media max-width: 768px`) sin proporcionar una alternativa mobile-friendly. La tabla de auditoría (y sus datos) permanecía invisible.

**Solución:** Se modificó el CSS para que en móvil la tabla se muestre con scroll horizontal (`overflow-x: auto`) en lugar de ocultarse, permitiendo que todos los tabs (usuarios, estadísticas, auditoría, notificaciones) sean funcionales en cualquier dispositivo.

**Archivos modificados:** `public/admin/css/admin.css`

---

## Mejoras Realizadas

### 4. Sistema de Estadísticas por Usuario (Arquitectura Escalable)

**Arquitectura:** Se implementó un sistema de métricas basado en un registro extensible (`METRICAS`) en `estadisticas.controller.js`. Cada métrica es una función independiente registrada con su metadata (label, icon, description, query). Para agregar una nueva métrica:
1. Crear la función que ejecuta la consulta SQL
2. Agregarla al objeto `METRICAS` con su metadata

**Métricas implementadas:**
| Métrica | Descripción |
|---------|-------------|
| Total solicitudes | Cantidad de registros importados por el usuario |
| Clientes registrados | Clientes únicos (por cédula) registrados |
| Operaciones realizadas | Gestiones realizadas por el usuario |
| Relaciones activas | Relaciones en estado ALTA |
| Ventas registradas | Vendedores en control de ventas |
| Modificaciones | Actualizaciones de datos realizadas |
| Actividad 7 días | Gestiones en los últimos 7 días |
| Actividad 30 días | Gestiones en el último mes |

**Endpoints:**
- `GET /api/admin/estadisticas/usuario/:id` - Estadísticas detalladas por usuario
- `GET /api/admin/estadisticas/listado` - Resumen de todos los usuarios

**Frontend:** Botón "📊 Estadísticas" en cada fila de la tabla de usuarios y en las cards móviles. Modal con métricas visuales, barras de porcentaje y comparativas con el total del sistema.

### 5. Centro de Notificaciones

**Arquitectura:** Sistema de notificaciones con tabla `notificaciones` en la base de datos, controlador REST completo, y UI en el panel de administración.

**Estructura de la tabla:**
```sql
notificaciones (
    id, titulo, mensaje, tipo (info/warning/success/danger),
    creador_id, destinatario_id (NULL = todos),
    leida, leida_at, created_at
)
```

**Endpoints:**
- `GET /api/admin/notificaciones` - Listar con filtros (tipo, leída, paginación)
- `POST /api/admin/notificaciones` - Crear (admin/superadmin)
- `PUT /api/admin/notificaciones/:id/leer` - Marcar como leída
- `GET /api/admin/notificaciones/no-leidas` - Contador no leídas
- `DELETE /api/admin/notificaciones/:id` - Eliminar

**Primera implementación:** Al iniciar el servidor, se crea automáticamente una notificación de tipo `warning` dirigida a todos los usuarios recordando actualizar su correo electrónico por razones de seguridad y recuperación de contraseña.

**UI:** 
- Campana 🔔 en el header del panel admin con badge de notificaciones no leídas
- Pestaña "Notificaciones" en el panel con tabla, filtros y paginación
- Modal para crear notificaciones con selector de destinatario
- Botones para marcar como leída y eliminar

### 6. Compatibilidad SQLite/PostgreSQL

Se agregaron patrones regex faltantes en `db.js` para la conversión de sintaxis PostgreSQL a SQLite:
- `CURRENT_TIMESTAMP - INTERVAL 'X days'` → `datetime('now', '-X days')`
- `CURRENT_TIMESTAMP - INTERVAL 'X hours'` → `datetime('now', '-X hours')`
- `CURRENT_TIMESTAMP - INTERVAL 'X minutes'` → `datetime('now', '-X minutes')`

### 7. Asignación automática de Superadmin

Se agregó lógica en `initDb.js` que asigna automáticamente al usuario `daviddlaa` como Super Admin del sistema durante la migración inicial, replicando el comportamiento del script de migración SQL original.

---

## Archivos Modificados

| Archivo | Cambio |
|---------|--------|
| `src/config/initDb.js` | Migración automática + superadmin + semilla notificaciones |
| `src/config/db.js` | Nuevos regex de conversión INTERVAL para SQLite |
| `src/controllers/notificaciones.controller.js` | **NUEVO** - CRUD de notificaciones |
| `src/controllers/estadisticas.controller.js` | **NUEVO** - Métricas por usuario (arquitectura extensible) |
| `src/routes/admin.routes.js` | Rutas de notificaciones + estadísticas por usuario |
| `public/admin/js/admin.js` | UI de notificaciones + estadísticas por usuario |
| `public/admin/css/admin.css` | CSS notificaciones + stats + responsive audit |
| `public/admin/index.html` | Tabs + modals de notificaciones y estadísticas |
| `public/desktop/js/dashboard.js` | Removido toggleMenu() + btnLogout duplicado |
| `public/desktop/js/solicitudes.js` | Removido toggleMenu() |
| `public/desktop/js/importar.js` | Removido toggleMenu() |

---

## Pruebas Realizadas

### Pruebas de Base de Datos
- ✅ Migración de esquema antiguo a nuevo (columnas faltantes agregadas correctamente)
- ✅ Asignación de superadmin al usuario daviddlaa
- ✅ Creación de tabla notificaciones
- ✅ Creación de semilla de notificación de email
- ✅ Conversión SQLite/PostgreSQL de INTERVAL

### Pruebas de Servidor
- ✅ Servidor inicia sin errores
- ✅ Panel admin responde en `/admin`
- ✅ Panel admin responde en `/m/admin`
- ✅ API de usuarios funcional (GET, POST, PUT)
- ✅ API de estadísticas globales funcional
- ✅ API de estadísticas por usuario funcional
- ✅ API de notificaciones funcional (CRUD completo)
- ✅ API de auditoría funcional

### Pruebas de Frontend
- ✅ Panel admin carga usuarios en escritorio
- ✅ Panel admin carga usuarios en móvil
- ✅ Tabs funcionales (Usuarios, Estadísticas, Auditoría, Notificaciones)
- ✅ Tabla de auditoría visible en móvil (scroll horizontal)
- ✅ Modal de creación de notificaciones con selector de destinatario
- ✅ Modal de estadísticas por usuario con métricas y porcentajes
- ✅ Campana de notificaciones con badge de no leídas
- ✅ Drawer unificado sin duplicación de menú
- ✅ Logout funcional desde el drawer
- ✅ Sin errores de `toggleMenu()` en consola

---

## Pendientes para Próximas Sesiones

1. **Centro de Notificaciones - Fase 2:**
   - Notificaciones push/tiempo real (WebSockets)
   - Historial de notificaciones enviadas
   - Notificaciones programadas
   - Tipos adicionales: mantenimiento, nuevas funciones, alertas de seguridad

2. **Estadísticas - Fase 2:**
   - Exportación de estadísticas a PDF/CSV
   - Tabla comparativa entre usuarios
   - Gráficos de tendencia temporal
   - Dashboard de KPIs en tiempo real

3. **Seguridad:**
   - Implementar verificación de email real
   - Sistema de recuperación de contraseña por email
   - 2FA para administradores

4. **UX/UI:**
   - Notificaciones toast en el panel admin
   - Animaciones suaves en transiciones de tabs
   - Tema oscuro para el panel admin
