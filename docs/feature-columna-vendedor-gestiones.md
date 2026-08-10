# ~~Feature: Columna "vendedor" en gestiones~~ → MOVIDO A SOLICITUDES

> **⚠️ ESTE DOCUMENTO ESTÁ OBSOLETO.** El campo `vendedor` fue movido de `gestiones` a `solicitudes`.
> Ver documentación actualizada: [`feature-columna-vendedor-solicitudes.md`](feature-columna-vendedor-solicitudes.md)

**Fecha original:** Julio 2026
**Versión:** Archivox v3.0
**Estado:** ❌ Eliminado — la columna `vendedor` ya no existe en `gestiones` ni `gestiones_relaciones`

---

## Resumen del cambio arquitectónico

**¿Por qué se movió?** `vendedor` es un atributo de la **solicitud** (la oportunidad de negocio), no de cada **gestión** (acción individual sobre esa solicitud). Tenerlo en `gestiones` causaba:

- Redundancia: el mismo vendedor se repetía en cada gestión de una solicitud
- Inconsistencia: podía cambiarse el vendedor por gestión, creando confusión
- complejidad innecesaria en queries

### Migraciones ejecutadas

| Migración | Acción | Estado |
|-----------|--------|--------|
| 005 | `ALTER TABLE gestiones ADD COLUMN vendedor TEXT` | ❌ Revertida (DROP COLUMN en 008) |
| 006 | `ALTER TABLE gestiones_relaciones ADD COLUMN vendedor TEXT` | ❌ Revertida (DROP COLUMN en 008) |
| 007 | `ALTER TABLE solicitudes ADD COLUMN vendedor TEXT` | ✅ Activa |
| 008 | `ALTER TABLE gestiones DROP COLUMN vendedor` | ✅ Ejecutada |
| 008 | `ALTER TABLE gestiones_relaciones DROP COLUMN vendedor` | ✅ Ejecutada |

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

---

## Migraciones

```bash
# Migración 005: Columna vendedor en gestiones
node migrations/005_add_vendedor_to_gestiones.js

# Migración 006: Columna vendedor en gestiones_relaciones
node migrations/006_add_vendedor_to_gestiones_relaciones.js
```

Ambas migraciones son **idempotentes**: no fallan si la columna ya existe.

---

## Lógica de validación (Backend — case-insensitive)

```javascript
// En cada controlador que inserta/actualiza gestiones:
const rolNormalizado = (req.session.usuario?.rol || '').toLowerCase();
const nivelMap = { superadmin: 100, admin: 50, lider: 30, agente: 20, user: 10 };
const nivel = nivelMap[rolNormalizado] || 0;
const vendedorValue = nivel >= 30 ? (vendedor || null) : null;
```

---

## Archivos modificados

### Backend — Controladores

| Archivo | Función | Cambio |
|---------|---------|--------|
| `src/controllers/excel.controller.js` | `crearGestion` | Recibe `vendedor` del body, validación de rol case-insensitive |
| `src/controllers/excel.controller.js` | `actualizarGestion` | Recibe `vendedor` del body, validación de rol case-insensitive |
| `src/controllers/excel.controller.js` | `getTodasGestiones` | SELECT incluye `g.vendedor` |
| `src/controllers/excel.controller.js` | `getGestionesUltimas` | SELECT incluye `g.vendedor` |
| `src/controllers/gestionesMaestro.controller.js` | `createGestion` | Recibe `vendedor` del body, validación de rol case-insensitive |
| `src/controllers/relacionesGestion.controller.js` | `crearGestion` | Recibe `vendedor` del body, validación de rol case-insensitive |
| `src/controllers/relacionesGestion.controller.js` | `getGestionesUltimas` | SELECT incluye `g.vendedor` |

### Backend — Migraciones

| Archivo | Tabla | Columna |
|---------|-------|---------|
| `migrations/005_add_vendedor_to_gestiones.js` | `gestiones` | `vendedor TEXT` |
| `migrations/006_add_vendedor_to_gestiones_relaciones.js` | `gestiones_relaciones` | `vendedor TEXT` |

### Frontend — Formularios (creación de gestiones)

| Archivo | Cambio |
|---------|--------|
| `public/desktop/js/solicitudes.js` | Input "Vendedor" visible solo para Líder+. Incluido en POST body |
| `public/movil/js/solicitudes.js` | Mismo cambio para móvil |
| `public/desktop/js/gestion-lote.js` | Input "Vendedor" en gestión individual de campañas |
| `public/movil/js/gestion-lote.js` | Mismo cambio para móvil |

### Frontend — Visualización

| Archivo | Cambio |
|---------|--------|
| `public/desktop/gestiones.html` | Columna "Vendedor" en tabla (th + colspan) |
| `public/desktop/js/gestiones.js` | Vendedor en tabla, cards, modal y exportación Excel |
| `public/movil/js/gestiones.js` | Vendedor en cards y modal |
| `public/desktop/js/solicitudes.js` | Vendedor en historial de gestiones |
| `public/movil/js/solicitudes.js` | Vendedor en historial de gestiones |
| `public/desktop/js/gestion-lote.js` | Vendedor en timeline de historial |
| `public/movil/js/gestion-lote.js` | Vendedor en timeline de historial |

---

## API

El campo `vendedor` se incluye en las siguientes operaciones:

| Operación | Endpoint | Método |
|-----------|----------|--------|
| Crear gestión | `/api/excel/gestiones` | POST |
| Actualizar gestión | `/api/excel/gestiones/:id` | PUT |
| Crear gestión (desde campaña) | `/api/gestiones-maestro` | POST |
| Crear gestión de relación | `/api/relaciones/gestiones` | POST |

El campo se devuelve en los SELECTs al listar gestiones.

---

## Frontend — Comportamiento

1. **Creación:** El campo "Vendedor" aparece como input de texto en los formularios de creación de gestiones, pero **solo se muestra** si el usuario tiene rol Líder, Admin o SuperAdmin.

2. **Visualización:** Se muestra en:
   - Tabla de gestiones (columna "Vendedor")
   - Cards de gestiones
   - Modal de detalle de gestión
   - Historial de gestiones en solicitudes y campañas
   - Exportación a Excel (columna "Vendedor")

3. **Valores null:** Los registros históricos (anteriores a la migración) tienen `vendedor = NULL`. En la UI se muestra como `-` o se omite el campo.

---

## Pruebas de validación

| Caso | Resultado esperado |
|------|--------------------|
| SuperAdmin crea gestión con vendedor "Test" | Se guarda "Test" en BD |
| Líder crea gestión con vendedor "Juan" | Se guarda "Juan" en BD |
| Agente intenta crear gestión con vendedor "Pedro" (inyectado) | Se guarda NULL en BD |
| Rol en BD como "SuperAdmin" (mayúsculas) | Se reconoce correctamente (case-insensitive) |
| Líder no envía vendedor | Se guarda NULL |
| Importar Excel con columna "Vendedor" (Líder) | Se guarda |
| Importar Excel con columna "Vendedor" (Agente) | Se guarda NULL |
| Listar gestiones | Vendedor aparece en tabla/cards/modal |
| Exportar Excel | Columna "Vendedor" incluida |
| Crear gestión de relación (Líder) | Vendedor se guarda en `gestiones_relaciones` |
