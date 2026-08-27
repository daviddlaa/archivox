# Fix: Reasignación de constante rompía la creación de campañas + equipo_id obsoleto

> **Estado:** ✅ Implementada
> **Fecha:** 28/08/2026
> **Ámbito:** Backend — `src/controllers/gestionesMaestro.controller.js`, `src/config/initDb.js`, `src/services/liberacion.service.js`, `src/utils/equipo.js` · Frontend — `public/desktop/js/solicitudes.js`, `public/movil/js/solicitudes.js`

---

## 1. Problema

### 1.1 Causa raíz en producción: `TypeError: Assignment to constant variable`

En **producción no se podía crear campañas** (ni desde escritorio ni desde móvil, con varios usuarios). Curiosamente borrar/listar campañas sí funcionaba.

El commit `89a815f` (normalización de IDs de campañas) introdujo una reasignación sobre un `const` en dos endpoints:

```javascript
const { solicitudes_ids } = req.body;   // destructuring → const
solicitudes_ids = normalizarIdsSolicitud(solicitudes_ids); // 🔴 TypeError
```

JavaScript lanza `TypeError: Assignment to constant variable`. El `try/catch` del controlador lo convierte en 500:

```json
{ "error": "Error al crear gestión", "detalle": "Assignment to constant variable." }
```

Y el frontend solo mostraba `resultado.error` (sin `detalle`), por lo que el usuario veía el error genérico **"Error: Error al crear gestión"** sin pista de la causa.

Afectaba a **todos** los roles por igual: el `POST /api/gestiones-maestro` (crear) y el `PUT /api/gestiones-maestro/:id/agregar-solicitudes` (agregar a campaña) ambos reasignaban el `const`.

### 1.2 Equipo obsoleto en sesión podía romper la FK

`createGestionMaestro` insertaba `gestiones_maestro.equipo_id` usando el valor de la **sesión** (calculado al login). Si el equipo fue borrado o la membresía dada de baja, el INSERT violaría `gestiones_maestro_equipo_id_fkey` en PostgreSQL → 500. **Todos los usuarios, indistintos de rol o membresía, deben poder crear una campaña.**

### 1.3 Esquema SQLite local desactualizado

`src/config/initDb.js` no tenía la columna `asignado_a` en `gestiones_maestro` (ni migración), por lo que en BD locales viejas el INSERT fallaba **en silencio** (el wrapper SQLite traga errores de escritura): la campaña no se creaba pero el endpoint respondía sin `id`.

---

## 2. Cambios aplicados

### 2.1 Backend — Fix del `const`→`let` (`gestionesMaestro.controller.js`)

En **`createGestionMaestro`** y **`agregarSolicitudesACampana`** el destructuring de `solicitudes_ids` pasa de `const` a `let` para permitir la reasignación de `normalizarIdsSolicitud()`:

```javascript
// Antes
const { solicitudes_ids } = req.body;
solicitudes_ids = normalizarIdsSolicitud(solicitudes_ids); // TypeError

// Después
let { solicitudes_ids } = req.body;
solicitudes_ids = normalizarIdsSolicitud(solicitudes_ids);
```

### 2.2 Backend — Resolver de equipo válido (`src/utils/equipo.js`)

Nuevo módulo `obtenerEquipoIdValido(usuarioId, equipoIdSesion)`:
1. Si el equipo de la sesión existe y el usuario mantiene membresía activa → se usa.
2. Si no, recalcula desde `equipo_usuarios` (misma lógica del login, priorizando `es_lider`).
3. Si el usuario no tiene equipo → `null` (columna nullable en ambos motores).

Se usa en:
- `createGestionMaestro` (`gestionesMaestro.controller.js`).
- `activarSinCompra` (`liberacion.service.js`) al crear la campaña de activación.

Con esto la creación nunca queda bloqueada por un `equipo_id` obsoleto, y un agente sin equipo crea con `equipo_id = NULL` sin violar FKs.

### 2.3 Backend — Esquema SQLite (`src/config/initDb.js`)

- La tabla `gestiones_maestro` ahora incluye `equipo_id`, `asignado_a` y `es_sistema` en la definición para BD nuevas.
- Migración idempotente `ALTER TABLE gestiones_maestro ADD COLUMN asignado_a INTEGER` para BD existentes (al arrancar).

### 2.4 Frontend — Mostrar `detalle` del error

Los alerts de creación ahora incluyen `resultado.detalle` (antes oculto), para que cualquier error futuro sea reportable:

- `public/desktop/js/solicitudes.js` (`crearGestionLote`).
- `public/movil/js/solicitudes.js` (`crearGestionLoteMovil`).

---

## 3. Verificación

- `node --check` OK en todos los archivos modificados.
- Prueba end-to-end local (SQLite, `DATABASE_URL= NODE_ENV=development`): usuario **sin equipo** (rol `user`) crea campaña → respuesta `{"id":16,...}`, la campaña se abre (`GET /api/gestiones-maestro/:id`) y aparece en el listado.
- Resolver probado con 4 escenarios: sin membresía+equipo obsoleto → `null`; con membresía → recupera el equipo real; membresía removida → `null`.
- Artefactos de prueba eliminados de la BD local. Nota: durante la verificación, un comando que debía apuntar a SQLite cargó el `.env` y creó por error un usuario `test_noteam` en la PG de **producción**; se eliminó de inmediato y se re-verificó que la tabla quedó vacía de ese usuario. Ningún dato existente de producción fue modificado.