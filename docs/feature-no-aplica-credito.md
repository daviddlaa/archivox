# 👍👎 Feature: Flag "Ya no aplica para crédito"

> **Agosto 2026**

## Propósito

Cuando un agente precalifica con el cliente en el **sistema madre** (externo) y el cliente **ya no tiene crédito**, la solicitud debe:
1. Marcarse con un flag binario (`no_aplica_credito = 0`).
2. **Salir de la campaña** activa (dejar de llamarse).
3. Conservar su historial de gestiones.

El marcado se hace con un botón **👎** (pulgar abajo) en las tarjetas, **sin texto adicional** (las cards ya están cargadas). Es **reversible** (👍), pero la solicitud revertida **no vuelve a ninguna campaña** automáticamente.

## Modelo de datos

| Columna | Tabla | Tipo | Default | Significado |
|---|---|---|---|---|
| `no_aplica_credito` | `solicitudes` | `INTEGER NOT NULL DEFAULT 1` | `1` | `1` = aplica para crédito · `0` = ya no aplica |

- **Todas las solicitudes existentes migran a `1`** (aplica). Solo el 👎 las pasa a `0`.
- Sin texto, sin estados nuevos: es un flag ortogonal al `estado` del flujo.

### Migración
- `migrations/011_add_no_aplica_credito.js` — `ALTER TABLE solicitudes ADD COLUMN no_aplica_credito INTEGER NOT NULL DEFAULT 1` + índice `idx_solicitudes_no_aplica_credito`.
- `src/config/initDb.js` y `src/config/initDb.pg.js` — columna en `CREATE TABLE` + `ALTER` para BD existentes + índice.

## Backend

### Endpoints
| Método | Ruta | Función | Descripción |
|---|---|---|---|
| `PUT` | `/api/gestiones-maestro/:id/solicitudes/:solicitudId/no-aplica-credito` | `marcarNoAplicaCreditoSolicitud` | Marca/desmarca con validación de acceso a la campaña. Al marcar (`0`) **quita la solicitud de la campaña** (reutiliza `quitarSolicitudDeCampanaDb`). |
| `PUT` | `/api/excel/solicitudes/:id/no-aplica-credito` | `marcarNoAplicaCredito` | Marca/desmarca desde el listado general (la solicitud debe ser del usuario). Si está en una campaña (`campana_id`), también sale de ella. |

Body: `{ "no_aplica_credito": 0 | 1 }`.

### Reglas
- Al marcar `0`: flag = 0 + **sale de la campaña** (gestiones se conservan).
- Al desmarcar `1`: flag = 1, **no** se re-agrega a ninguna campaña.
- **Auditoría**: cada cambio se registra en `historial_actualizaciones` (campo `no_aplica_credito`, con etiqueta "No aplica crédito" en el módulo Historial).
- **Agregar a campañas**: `agregarSolicitudesACampana` **rechaza** solicitudes con flag = 0 (`400` con la lista de IDs).
- Selector "agregar solicitudes a campaña" (desktop y móvil): excluye las marcadas.

### Refactor
- Se extrajo `quitarSolicitudDeCampanaDb(gestionId, solicitudIdNum)` (lógica de BD reutilizable) del handler `quitarSolicitudDeCampana`, exportada para el listado general.

## Frontend

| Pantalla | Acción |
|---|---|
| Campañas desktop (`gestion-lote.js`) | Botón **👎/👍** en `sol-acciones` + modal de confirmación ("será quitada de esta campaña") |
| Campañas móvil (`gestion-lote.js`) | Botón **👎/👍** en `sol-acciones-secundarias` + bottom-sheet de confirmación |
| Solicitudes desktop (`solicitudes.js`) | Botón **👎/👍** en `card-fila-3`; confirmación solo si está en campaña |
| Solicitudes móvil (`solicitudes.js`) | Botón **👎** de solo icono en `card-fila-4` (junto al link de campaña): si está marcada revierte directo; si no, modal de confirmación. El menú ⋮ fue eliminado (Agosto 2026) |

- Estado visual **sin texto**: `filter: grayscale(.75)` + `opacity: .78` en las tarjetas marcadas (`.no-aplica-credito`).
- CSS compartido: `public/css/no-aplica-credito.css` (incluido en las 4 páginas).
- Tras marcar en campaña: se recarga la campaña (la solicitud desaparece) y el listado lateral.

## Filtro en el selector de estado (solicitudes)

- El selector de estado de la página de solicitudes (desktop y móvil) incluye la opción **"👎 No aplica para crédito"** (valor especial `__no_aplica_credito__`).
- **Backend** (`listarSolicitudes` y `buscarSolicitudes`, consulta y conteo): el sentinel se traduce a `AND s.no_aplica_credito = 0`.
- **Frontend**: desktop inserta la opción tras "Todos" (respeta `sessionStorage`); móvil la inserta en `renderizarFiltros` y la maneja en `aplicarFiltros`. El resumen muestra "No aplica para crédito".

## Badge pequeño en tarjetas marcadas

- Las tarjetas marcadas (flag = 0) muestran el badge **"👎 No aplica"** en pequeño (clase `noaplica-mini-badge`, 11px) en: solicitudes **desktop** (fila 1), campañas desktop (header) y campañas móvil (header).
- **Excepción móvil Solicitudes (Agosto 2026):** con el rediseño de la tarjeta se eliminó el mini-badge de la fila 1; el estado se representa con `filter: grayscale` en la card y el control es el botón 👎 de solo icono en `card-fila-4` (ver `docs/feature-rediseno-tarjeta-movil-solicitudes.md`).
- CSS en `public/css/no-aplica-credito.css` (incluido en las 4 páginas) + `flex-wrap` para que la fila de badges no se recorte en pantallas angostas.

## Fuera de alcance (fase 2 si se desea)
- Importación por Excel del flag.
- KPIs nuevos en el dashboard (contador de "no aplican").
- Tabla de estados formal.
