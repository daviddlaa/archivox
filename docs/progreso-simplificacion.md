# 📋 ARCHIVOX — SIMPLIFICACIÓN ORGANIZACIONAL

**Fecha:** 12 de Julio de 2026
**Estado:** ✅ COMPLETADO
**Objetivo:** Simplificar jerarquía organizacional: SuperAdmin → Líder → Agente

---

## 📊 NUEVA JERARQUÍA

```
ANTES:                           NUEVA:
superadmin (100)                 SuperAdmin (100) ← sin cambios
admin (50)                       ❌ ELIMINADO
lider (30)                       Líder (30) ← + permisos de gestión de agentes
agente (20)                      Agente (20) ← sin cambios
user (10)                        User (10) ← compatibilidad
```

## ✅ CAMBIOS REALIZADOS

### Backend (6 archivos)

| Archivo | Cambio |
|---------|--------|
| `src/config/permissions.js` | Eliminado rol `admin`, agregado `agentes:reset-password` a `lider` |
| `src/controllers/admin.controller.js` | + `promoverALider()` (auto-crea equipo), + `revocarLider()`, simplificadas reglas de seguridad |
| `src/routes/admin.routes.js` | `requiresRole('admin','superadmin')` → `requiresRole('superadmin')`, + rutas `promover-lider` y `revocar-lider` |
| `src/controllers/equipos.controller.js` | + `toggleActivoAgente()`, + `resetPasswordAgente()`, + `editarAgente()` |
| `src/routes/equipos.routes.js` | + Rutas de gestión de agentes para líder |
| `src/controllers/auth.controller.js` | `listarUsuarios` ahora verifica `is_superadmin` |

### Frontend (3 archivos)

| Archivo | Cambio |
|---------|--------|
| `public/admin/js/admin.js` | + Botones ⬆️ Convertir/👑 Revocar Líder en tabla usuarios, labels actualizados |
| `public/admin/index.html` | Filtro roles: eliminado `admin`, modal crear: eliminado `admin` |
| `public/admin/css/admin.css` | + Badge `.lider` (ámbar) y `.agente` (azul) |

### Otros (3 archivos)

| Archivo | Cambio |
|---------|--------|
| `public/js/perfil.js` | Labels: removido Admin, agregado Líder/Agente |
| `public/js/drawer.js` | Checks de acceso: `is_superadmin` en vez de `rol === 'admin'` |
| `src/middleware/auth.middleware.js` | Sin cambios (ya era agnóstico al rol) |

## 💿 TABLAS REUTILIZADAS (sin migraciones)

| Tabla | Uso en nuevo flujo |
|-------|-------------------|
| `equipos` | ✅ Auto-creados al promover a Líder |
| `equipo_usuarios` | ✅ `es_lider` determina liderazgo |
| `permisos_roles` | ✅ Permisos actualizados en seed |
| `asignaciones_solicitudes` | ✅ Para asignaciones futuras |

## 🔄 FLUJO NUEVO

```
SuperAdmin
  ├── Ver usuarios → tabla con roles
  ├── ⬆️ Convertir a Líder → auto-crea "Equipo de [username]"
  ├── 👑 Revocar Líder → quita es_lider, pasa a Agente
  ├── Activar/Desactivar usuarios
  └── Ver estadísticas globales

Líder
  ├── Crear Agentes (desde /equipo o admin)
  ├── Activar/Desactivar Agentes (desde admin equipos)
  ├── Resetear contraseñas de sus Agentes
  ├── Ver solo sus Agentes
  ├── Asignar solicitudes
  ├── Importar Excel
  └── Administrar campañas

Agente
  ├── Ver solo solicitudes asignadas
  ├── Gestionar clientes
  ├── Registrar gestiones
  └── Consultar historial propio
```

## 📝 NOTAS

- **0 migraciones nuevas** — todas las tablas ya existían
- **Rol `admin` legacy** — usuarios con `rol = 'admin'` en BD siguen funcionando, pero no se pueden crear nuevos
- **Backward compatible** — todos los endpoints existentes siguen funcionando
