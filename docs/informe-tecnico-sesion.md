# Informe Técnico - Evolución del Sistema de Notificaciones

**Fecha:** Julio 2026
**Versión:** 2.0
**Objetivo:** Transformar el sistema de notificaciones en un Centro de Notificaciones moderno, escalable y en tiempo real.

---

## 1. Mejoras Implementadas

### 1.1 Cards modernas en lugar de lista simple
- Las notificaciones ahora se renderizan como **cards visuales** con íconos, prioridad, tipo y acciones.
- Cada card incluye: título, mensaje, fecha relativa, prioridad (con indicador de color), tipo (con badge), botón de acción, y botón de archivar.
- Diseño limpio con sombras sutiles, bordes redondeados y transiciones suaves.

### 1.2 Actualización en tiempo real (SSE)
- Implementado **Server-Sent Events (SSE)** para notificaciones en vivo.
- Cuando el admin publica una notificación, todos los usuarios conectados la reciben sin recargar la página.
- La campana actualiza automáticamente el contador de no leídas.
- El cambio se refleja tanto en escritorio como en dispositivos móviles.
- **Fallback:** Polling cada 30 segundos si la conexión SSE falla.

### 1.3 Contador inteligente
- Badge con animación `badgePopIn` cuando llegan nuevas notificaciones.
- Disminuye automáticamente al marcar como leída.
- Se reinicia cuando todas están leídas.
- Sincronizado entre escritorio y móvil mediante SSE.

### 1.4 Notificaciones con acciones
- Cada notificación puede incluir un **botón de acción** (ej: "Actualizar ahora").
- Arquitectura extensible: `accion_url` + `accion_texto` en la base de datos.
- Al hacer clic: marca como leída y redirige a la URL correspondiente.
- Ejemplos soportados: `/perfil`, `/admin`, `/importar`, URLs externas.

### 1.5 Estados de notificaciones
- **No leída** - fondo azul claro + dot indicador + animación de entrada.
- **Leída** - estilo atenuado, sin dot.
- **Archivada** - opción de archivar individualmente (📦).
- **Expirada** - visualmente atenuada con texto tachado si pasó `fecha_expiracion`.

### 1.6 Experiencia de usuario mejorada
- Animación de entrada (`notifSlideIn`) para notificaciones nuevas.
- Destello (`notifGlow`) en notificaciones recién llegadas.
- Toast flotante con animación cuando llega una nueva notificación.
- Diferenciación clara entre leídas (fondo blanco) y no leídas (fondo azul).
- Orden automático: no leídas primero, luego por fecha descendente.
- Botón **"Marcar todas como leídas"** en el header del panel.
- Botón de archivar individual (visible al hover).
- Scroll personalizado y optimizado en el panel.

### 1.7 Escalabilidad
- Arquitectura preparada para:
  - Notificaciones individuales (ya soportado vía `destinatario_id`).
  - Notificaciones por roles (extensible en el backend).
  - Grupos específicos (tabla puente preparada).
  - Avisos programados (campo `fecha_expiracion`).
  - Recordatorios automáticos (arquitectura de eventos).
  - Alertas del sistema, novedades, mantenimiento, seguridad (campo `tipo` extensible).

---

## 2. Cambios en la Arquitectura

### 2.1 Base de Datos

**Tabla `notificaciones` - Nuevas columnas:**

| Columna | Tipo | Descripción |
|---------|------|-------------|
| `prioridad` | TEXT | 'baja', 'normal', 'alta', 'critica' |
| `accion_url` | TEXT | URL de acción para el botón |
| `accion_texto` | TEXT | Texto del botón de acción |
| `fecha_expiracion` | TIMESTAMP | Fecha de expiración de la notificación |
| `archivada` | BOOLEAN | Indica si está archivada |

### 2.2 Nuevo Servicio: NotificationBus

**`src/services/notificationBus.js`**
- Sistema de eventos basado en `EventEmitter`.
- Mantiene un `Map` de clientes SSE conectados con su `usuarioId`.
- Métodos: `addClient`, `emitir` (con filtro por destinatario), `emitirAUsuario`.
- Keep-alive mediante pings cada 30 segundos.
- Limpieza automática de clientes desconectados con manejo de intervalos.

### 2.3 SSE Flow

```
Admin crea notificación → Controller INSERT → notificationBus.emitir()
                                              ↓
                                   ¿destinatario_id?
                                   ├── null → broadcast a TODOS los clientes
                                   └── set  → solo al usuario específico
                                              ↓
                                   Cliente SSE recibe 'notification.created'
                                              ↓
                                   Actualiza badge + recarga panel + toast
```

### 2.4 Endpoints REST

| Método | Ruta | Acceso | Descripción |
|--------|------|--------|-------------|
| `GET` | `/api/admin/notificaciones` | Auth | Listar (filtrado por usuario) |
| `GET` | `/api/admin/notificaciones/no-leidas` | Auth | Contar no leídas |
| `GET` | `/api/admin/notificaciones/stream` | Auth | **NUEVO** SSE endpoint |
| `PUT` | `/api/admin/notificaciones/:id/leer` | Auth | Marcar como leída |
| `PUT` | `/api/admin/notificaciones/marcar-todas-leidas` | Auth | **NUEVO** Marcar todas |
| `PUT` | `/api/admin/notificaciones/:id/archivar` | Auth | **NUEVO** Archivar |
| `POST` | `/api/admin/notificaciones` | Admin | Crear |
| `DELETE` | `/api/admin/notificaciones/:id` | Admin | Eliminar |

### 2.5 Frontend - Componentes

```
notificaciones-dashboard.js       → Panel deslizable (Compartido desktop/móvil)
notificaciones.css                → Estilos modernos con cards y animaciones
admin.js                          → Admin panel con nuevos campos
admin/index.html                  → Modal de creación con prioridad y acción
desktop/index.html                → Inicialización SSE
movil/index.html                  → Inicialización SSE
```

---

## 3. Archivos Modificados/Creados

### Nuevos archivos:
| Archivo | Descripción |
|---------|-------------|
| `src/services/notificationBus.js` | **NUEVO** - Bus de eventos SSE |

### Archivos modificados:
| Archivo | Cambio |
|---------|--------|
| `src/config/initDb.js` | Migración nuevas columnas notificaciones (SQLite) |
| `src/config/initDb.pg.js` | Migración nuevas columnas notificaciones (PostgreSQL) |
| `src/controllers/notificaciones.controller.js` | SSE, nuevos campos, marcar todas, archivar |
| `src/routes/admin.routes.js` | Rutas SSE, marcar todas, archivar |
| `public/css/notificaciones.css` | Rediseño completo con cards y animaciones |
| `public/js/notificaciones-dashboard.js` | Reescribo completo con SSE y cards |
| `public/admin/js/admin.js` | Nuevos campos en creación, archivar admin |
| `public/admin/index.html` | Columnas prioridad/acción en tabla + modal extendido |
| `public/desktop/index.html` | Inicialización SSE |
| `public/movil/index.html` | Inicialización SSE |
| `docs/informe-tecnico-sesion.md` | **NUEVO** - Este informe |

---

## 4. Validaciones Ejecutadas

### 4.1 Carga de módulos
- ✅ `db.js` (SQLite y PostgreSQL) cargado sin errores
- ✅ `notificationBus.js` cargado sin errores
- ✅ `notificaciones.controller.js` exporta 8 funciones correctamente
- ✅ Todas las rutas SSR resuelven correctamente

### 4.2 Code Review
- ✅ Migración BD con detección de columnas existentes (compatible con SQLite y PostgreSQL)
- ✅ SSE con filtrado por destinatario
- ✅ Limpieza correcta de conexiones SSE (intervalos y Map)
- ✅ Race condition resuelta en botón de acción (await fetch antes de navegar)
- ✅ URLs escapadas con data attributes para prevenir XSS
- ✅ Arquitectura extensible para futuros tipos de notificaciones

### 4.3 Verificaciones de diseño
- ✅ Cards responsivas (breakpoint 480px para móvil)
- ✅ Panel ocupa 100% en móvil, 400px en desktop
- ✅ Badge se actualiza por SSE + fallback polling
- ✅ Marcar todas funciona tanto para admin como usuario regular
- ✅ Acciones marcan como leída antes de redirigir

---

## 5. Recomendaciones para Futuras Mejoras

### 5.1 Corto plazo
- **Notificaciones por roles:** Agregar columna `rol_destinatario` para enviar a todos los admins, usuarios, etc.
- **Grupos:** Crear tabla `grupos_notificaciones` y `notificaciones_grupos` para enviar a grupos específicos.
- **Notificaciones programadas:** Usar `node-cron` o similar para enviar notificaciones automáticas en fecha/hora específica.
- **Sonido:** Agregar un beep sutil cuando llegue una notificación crítica.

### 5.2 Mediano plazo
- **Notificaciones push nativas:** Reemplazar SSE con WebSockets (Socket.io) para mejor compatibilidad móvil y reconexión automática.
- **Service Workers:** Notificaciones push del navegador incluso cuando la app no está abierta.
- **Preferencias de usuario:** Permitir que cada usuario configure qué tipos/prioridades de notificaciones desea recibir.
- **Historial completo:** Pestaña de "Archivadas" en el panel para ver notificaciones pasadas.

### 5.3 Largo plazo
- **Template de notificaciones:** Sistema de plantillas con variables dinámicas (`{username}`, `{fecha}`, etc.).
- **Notificaciones por email/SMS:** Integrar con servicio de email (SendGrid, etc.) para notificaciones fuera de la app.
- **Analíticas:** Reportes de cuántos usuarios leyeron cada notificación, tasa de acción, etc.
- **Internacionalización:** Soporte multi-idioma para títulos y mensajes.

---

## 6. Resumen del Entregable

El Sistema de Notificaciones ha evolucionado de una implementación básica a un **verdadero centro de comunicación** con:

```
✅ Cards modernas con prioridades y acciones
✅ Tiempo real mediante SSE
✅ Contador inteligente sincronizado
✅ Notificaciones con acciones navegables
✅ 4 estados: No leída, Leída, Archivada, Expirada
✅ Animaciones y micro-interacciones
✅ Arquitectura preparada para escalar
✅ Completamente responsive (desktop + móvil)
```
