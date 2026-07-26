# Feature: Columna "vendedor" en solicitudes (movida desde gestiones)

**Fecha:** Julio 2026
**Versión:** Archivox v3.0
**Estado:** Implementado y en producción

---

## Descripción

El campo `vendedor` fue **movido de la tabla `gestiones` a la tabla `solicitudes`**. La razón: `vendedor` es un atributo de la solicitud (la oportunidad), no de cada gestión (acción individual). Esto evita redundancia y inconsistencias (un vendedor diferente por gestión de la misma solicitud).

### Historial de cambios

| Migración | Tabla | Columna | Estado |
|-----------|-------|---------|--------|
| 005 | `gestiones` | `vendedor TEXT` | ❌ Eliminada |
| 006 | `gestiones_relaciones` | `vendedor TEXT` | ❌ Eliminada |
| **007** | **`solicitudes`** | **`vendedor TEXT`** | ✅ Activa |
| 008 | `gestiones` | `vendedor` | ✅ Ejecutada (DROP COLUMN) |
| 008 | `gestiones_relaciones` | `vendedor` | ✅ Ejecutada (DROP COLUMN) |

---

## Migraciones ejecutadas en producción

```bash
# Migración 007: Agregar vendedor a solicitudes
node migrations/007_add_vendedor_to_solicitudes.js

# Migración 008: Eliminar vendedor de gestiones y gestiones_relaciones
node migrations/008_remove_vendedor_from_gestiones.js
```

Ambas migraciones son **idempotentes**: no fallan si la columna ya existe/fue eliminada.

---

## Seguridad

| Rol | Nivel | ¿Puede guardar vendedor? |
|-----|-------|--------------------------|
| SuperAdmin | 100 | Sí |
| Admin | 50 | Sí |
| Líder | 30 | Sí |
| Agente | 20 | No (se fuerza a NULL) |
| User | 10 | No (se fuerza a NULL) |

La validación se realiza en el **backend** (servidor), no en el frontend. Incluso si un Agente intenta inyectar el campo vendedor vía request HTTP, el servidor lo descarta y guarda `NULL`.

El mapeo de roles es **case-insensitive** (`toLowerCase()`) para evitar que un SuperAdmin con rol `"SuperAdmin"` en la BD quede bloqueado.

```javascript
// En cada controlador que inserta/actualiza solicitudes:
const rolNormalizado = (req.session.usuario?.rol || '').toLowerCase();
const nivelMap = { superadmin: 100, admin: 50, lider: 30, agente: 20, user: 10 };
const nivel = nivelMap[rolNormalizado] || 0;
const vendedorValue = nivel >= 30 ? (vendedor || null) : null;
```

---

## Archivos modificados (Sesión de limpieza)

### Backend — Controladores (gestiones: limpieza)

| Archivo | Función | Cambio |
|---------|---------|--------|
| `src/controllers/excel.controller.js` | `crearGestion` | ❌ Eliminado `vendedor` del INSERT, role validation, body destructuring |
| `src/controllers/excel.controller.js` | `actualizarGestion` | ❌ Eliminado `vendedor` del UPDATE, role validation, body destructuring |
| `src/controllers/excel.controller.js` | `getGestionesUltimas` | ❌ Eliminado `g.vendedor` del SELECT, eliminado `vendedor` del objeto respuesta |
| `src/controllers/excel.controller.js` | `getTodasGestiones` | ✅ Cambiado `g.vendedor` → `s.vendedor` (via JOIN con solicitudes) |
| `src/controllers/gestionesMaestro.controller.js` | `createGestion` | ❌ Eliminado `vendedor` del INSERT, role validation, body destructuring |
| `src/controllers/relacionesGestion.controller.js` | `crearGestion` | ❌ Eliminado `vendedor` del INSERT, role validation, body destructuring |
| `src/controllers/relacionesGestion.controller.js` | `getGestionesUltimas` | ❌ Eliminado `g.vendedor` del SELECT, eliminado `vendedor` del objeto respuesta |

### Backend — Controladores (solicitudes: funcional)

| Archivo | Función | Cambio |
|---------|---------|--------|
| `src/controllers/excel.controller.js` | `crearSolicitudManual` | ✅ Recibe `vendedor` del body, validación de rol, incluido en INSERT PG y SQLite |
| `src/controllers/excel.controller.js` | `actualizarSolicitudEditar` | ✅ Recibe `vendedor` del body, validación de rol, SET dinámico |

### Backend — Servicios

| Archivo | Función | Cambio |
|---------|---------|--------|
| `src/services/excel.service.js` | `uploadExcel` | ✅ Mapeo de columna Excel `VENDEDOR` → `solicitudes.vendedor` en UPDATE e INSERT (PG y SQLite) |

### Backend — Migraciones

| Archivo | Tabla | Columna | Estado |
|---------|-------|---------|--------|
| `migrations/005_add_vendedor_to_gestiones.js` | `gestiones` | `vendedor TEXT` | ❌ Obsoleta |
| `migrations/006_add_vendedor_to_gestiones_relaciones.js` | `gestiones_relaciones` | `vendedor TEXT` | ❌ Obsoleta |
| `migrations/007_add_vendedor_to_solicitudes.js` | `solicitudes` | `vendedor TEXT` | ✅ Ejecutada |
| `migrations/008_remove_vendedor_from_gestiones.js` | `gestiones`, `gestiones_relaciones` | DROP `vendedor` | ✅ Ejecutada |

### Frontend — Formularios (solicitudes: creación)

| Archivo | Cambio |
|---------|--------|
| `public/desktop/js/solicitudes.js` | ✅ Input "Vendedor" en modal "Nueva Solicitud", visible solo para Líder+. Incluido en POST body |
| `public/movil/js/solicitudes.js` | ✅ Mismo cambio para móvil |

### Frontend — Formularios (gestiones: limpieza)

| Archivo | Cambio |
|---------|--------|
| `public/desktop/js/solicitudes.js` | ❌ Eliminado input "Vendedor" del modal de creación de gestión |
| `public/movil/js/solicitudes.js` | ❌ Eliminado input "Vendedor" del modal de creación de gestión |
| `public/desktop/js/gestion-lote.js` | ❌ Eliminado input "Vendedor", role check, y lógica de guardado |
| `public/movil/js/gestion-lote.js` | ❌ Eliminado input "Vendedor", role check, y lógica de guardado |

### Frontend — Visualización

| Archivo | Cambio |
|---------|--------|
| `public/desktop/js/solicitudes.js` | ❌ Eliminado vendedor del historial de gestiones (detalle solicitud) |
| `public/movil/js/solicitudes.js` | ❌ Eliminado vendedor del historial de gestiones (detalle solicitud) |
| `public/desktop/js/gestiones.js` | ✅ Mantiene `g.vendedor` — funciona via `getTodasGestiones` JOIN con `solicitudes.s.vendedor` |
| `public/movil/js/gestiones.js` | ✅ Mantiene `g.vendedor` — funciona via JOIN |
| `public/desktop/js/gestion-lote.js` | ✅ Mantiene `g.vendedor` en timeline historial — funciona via JOIN |
| `public/movil/js/gestion-lote.js` | ✅ Mantiene `g.vendedor` en timeline historial — funciona via JOIN |

---

## API

### Solicitudes (con vendedor)

| Operación | Endpoint | Método | vendedor |
|-----------|----------|--------|----------|
| Crear solicitud manual | `/api/excel/solicitudes` | POST | ✅ Opcional |
| Editar solicitud | `/api/excel/solicitudes/:id` | PUT | ✅ Opcional |
| Importar Excel | `/api/excel/upload` | POST | ✅ Columna `VENDEDOR` |

### Gestiones (sin vendedor)

| Operación | Endpoint | Método | vendedor |
|-----------|----------|--------|----------|
| Crear gestión | `/api/excel/gestiones` | POST | ❌ No aplica |
| Actualizar gestión | `/api/excel/gestiones/:id` | PUT | ❌ No aplica |
| Listar todas las gestiones | `/api/excel/gestiones/todas` | GET | ✅ Retorna `s.vendedor` via JOIN |
| Últimas gestiones (batch) | `/api/excel/gestiones/ultimas` | GET | ❌ No incluye vendedor |
| Crear gestión (campaña) | `/api/gestiones-maestro` | POST | ❌ No aplica |
| Crear gestión de relación | `/api/relaciones/gestiones` | POST | ❌ No aplica |

---

## Frontend — Comportamiento

### Creación de solicitud ("Nueva Solicitud")

1. El campo "Vendedor" aparece en la sección "Más Información (Opcional)" del modal
2. **Solo se muestra** si el usuario tiene rol Líder, Admin o SuperAdmin
3. Al enviar, se incluye en el body `{ vendedor: "valor" }` y el backend valida el rol

### Visualización de vendedor

- **Tabla de gestiones** (`gestiones.js`): Muestra `s.vendedor` via JOIN con solicitudes
- **Cards de gestiones**: Muestra vendedor si existe
- **Exportación a Excel**: Incluye columna "Vendedor"
- **Historial de gestiones en solicitudes**: Ya NO muestra vendedor (era del campo eliminado de gestiones)

### Valores null

Los registros históricos (anteriores a la migración 007) tienen `vendedor = NULL`. En la UI se muestra como `-` o se omite el campo.

---

## Pruebas de validación

| Caso | Resultado esperado |
|------|--------------------|
| SuperAdmin crea solicitud con vendedor "Test" | Se guarda "Test" en BD |
| Líder crea solicitud con vendedor "Juan" | Se guarda "Juan" en BD |
| Agente intenta crear solicitud con vendedor "Pedro" (inyectado) | Se guarda NULL en BD |
| Rol en BD como "SuperAdmin" (mayúsculas) | Se reconoce correctamente (case-insensitive) |
| Líder no envía vendedor | Se guarda NULL |
| Importar Excel con columna "VENDEDOR" (Líder) | Se guarda en `solicitudes.vendedor` |
| Importar Excel con columna "VENDEDOR" (Agente) | Se guarda NULL |
| Crear gestión | NO se envía vendedor (ya no existe en gestiones) |
| Listar gestiones | Vendedor aparece via JOIN con solicitudes |
| Crear solicitud manual | Campo vendedor visible solo para Líder+ |
| Editar solicitud | Campo vendedor visible solo para Líder+ |
