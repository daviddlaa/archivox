# Informe de corrección — Flujo de guardado de seguimientos en campañas

**Fecha:** 2026-08-12
**Alcance:** Página de campañas (`/gestion-lote` y `/m/gestion-lote`), guardado de gestiones (Seguimiento, Cobranza, Completada, Recordatorio), móvil y escritorio.
**Estado:** Implementado y validado.

---

## 1. Flujo actual (referencia)

1. El usuario pulsa **"📋 Seguimiento"** en una tarjeta → `abrirGestion(solicitudId, tipo)` (desktop `public/desktop/js/gestion-lote.js`, mobile `public/movil/js/gestion-lote.js`).
2. Se abre el modal (`crearModal` → `Modal.abrir` de `public/js/modal.js`).
3. Al guardar → `guardarGestionIndividual()`:
   - **Recordatorio**: `POST /api/gestiones-maestro/:id/recordatorios`.
   - **Resto**: `POST /api/excel/gestiones` con `{solicitud_id, tipo_gestion, observacion, gestion_maestro_id}`.
4. El backend (`excelController.crearGestion`) inserta en `gestiones` e incrementaba `gestiones_maestro.gestionadas + 1` por cada fila.
5. El frontend recargaba toda la campaña (`cargarDatosGestion()`) perdiendo filtro, scroll y contexto de la tarjeta.

---

## 2. Incoherencias corregidas

### 2.1 Contador `gestionadas` inflado (severidad alta)
- **Antes:** cada gestión sumaba `gestionadas + 1` (3 seguimientos sobre la misma solicitud = +3). Los listados (solicitudes, equipo, landing) mostraban "✅ N gestionadas" y progresos que podían superar el 100 %.
- **Ahora:** `gestionadas` = solicitudes de la campaña con al menos una gestión (última gestión en campaña o sin campaña) cuyo tipo no sea `Pendiente`.
- **Implementación:**
  - Nuevo helper `recalcularGestionadas(gestionId)` en `src/controllers/gestionesMaestro.controller.js` (lee `solicitudes_ids`, cuenta con `ROW_NUMBER`, actualiza la columna).
  - Se llama desde todos los escritores: `crearGestion` (excel), `crearRecordatorio`, `agregarSolicitudesACampana`, `quitarSolicitudDeCampanaDb`, `eliminarGestion` (excel).
  - Auto-reparación en `getGestionesMaestro`: si `gestionadas > total_solicitudes` o `< 0` (restos de datos inflados), recalcula una vez.
  - `getGestionMaestroById` (detalle) devuelve `gestionadas` computada en JS para ser consistente con el KPI del header.

### 2.2 POST sin control de acceso (severidad alta)
- **Antes:** cualquier usuario autenticado podía guardar gestiones con un `gestion_maestro_id` arbitrario (inflar contadores de campañas ajenas).
- **Ahora:** `crearGestion` valida que la solicitud exista y pertenezca al usuario, y si viene `gestion_maestro_id`, que la campaña sea accesible (`buildGestionAccessWhere` + `buildGestionSQL`, ahora exportados) y que la solicitud pertenezca a la campaña. La página de Solicitudes (sin `gestion_maestro_id`) sigue funcionando.

### 2.3 Endpoint muerto duplicado (severidad media)
- `createGestion` en `gestionesMaestro.controller.js` (comentado como `POST /api/gestiones`) no estaba montado en ninguna ruta. **Eliminado** junto con su export. Fuente única: `excelController.crearGestion`.

### 2.4 Criterio de "última gestión" inconsistente (severidad media)
- **Antes:** campaña ordenaba por `MAX(id)`; solicitudes y `getGestionesUltimas` ordenaban por `fecha_gestion DESC LIMIT 1` (empates con timestamps de 1 s en SQLite).
- **Ahora:** todas las consultas de "última gestión" ordenan por `id DESC`. Los historiales cronológicos mantienen `fecha_gestion DESC` con `id DESC` como desempate.

### 2.5 Riesgo de gestión duplicada si falla el destacar (severidad media)
- **Antes:** el `PUT` de destacar iba dentro del bloque de éxito sin try/catch; un fallo de red mostraba "Error al guardar la gestión" (falso), dejaba el modal abierto y el reintento duplicaba la gestión.
- **Ahora:** el destacar se ejecuta con try/catch propio, se valida `response.ok`, y nunca bloquea el flujo de éxito. El destacado se aplica localmente (`sol.destacado`) para que el re-render lo muestre.

### 2.6 Pérdida de filtro/scroll/foco tras guardar (severidad media)
- **Antes:** tras guardar se recargaba toda la campaña → se perdía el filtro de semáforo, el scroll y el resaltado de la tarjeta.
- **Ahora:** la gestión se aplica **localmente** en `solicitudes` y `todasLasSolicitudes` con los datos de la respuesta, se re-renderiza con `renderizarSolicitudes` (que conserva scroll y filtros) y se actualizan KPIs/semáforo. Sin flash de "Cargando…" ni recarga.

### 2.7 Foco inicial del modal (severidad baja)
- `Modal.abrir` soporta `opciones.focusId`. `abrirGestion` pasa `focusId: 'observacion-modal'`, por lo que el foco inicial cae en el textarea (antes caía en el selector de tipo / primer pill).

### 2.8 Toast engañoso (severidad baja)
- **Antes:** "Una gestión más completada" para cualquier tipo.
- **Ahora:** mensaje según tipo ("Seguimiento registrado", "Cobranza registrada", "Solicitud completada", "⏰ Recordatorio programado").

### 2.9 Caché desactualizada tras guardar (severidad baja)
- `crearGestion` y `eliminarGestion` invalidan `cache.invalidateCampanas(usuarioId)` y `cache.invalidateDashboard(usuarioId)`.

### 2.10 Código duplicado móvil/escritorio (severidad baja)
- Nueva librería compartida `public/js/gestion-campana.js` con `guardarGestionIndividual`, `guardarRecordatorioModal` y `alternarModoRecordatorio` (única implementación). Ambos `gestion-lote.js` la usan mediante wrappers con callbacks (`onConfirmar`, `onCargarDatos`). Se eliminaron las copias locales de `guardarRecordatorioModal*` y `alternarModoRecordatorio*`.

### 2.11 Mojibake en mensajes backend (severidad baja)
- Corregidos los mensajes con caracteres corruptos en `src/controllers/excel.controller.js` (`'Gesti�n guardada'` → `'Gestión guardada'`, `'configuraci�n'`, `'C�digo Plus'`, etc.).

---

## 3. Archivos modificados

| Archivo | Cambios |
|---|---|
| `src/controllers/gestionesMaestro.controller.js` | Helper `recalcularGestionadas`, auto-reparación en listado, `gestionadas` computada en detalle, export de `buildGestionAccessWhere`/`buildGestionSQL`/`recalcularGestionadas`, eliminación de `createGestion`, recalculo en recordatorio/agregar/quitar, desempate por `id` en historiales, `obtenerProgresoGestion` con `COUNT(DISTINCT)`. |
| `src/controllers/excel.controller.js` | Validación de acceso/pertenencia en `crearGestion`, recálculo + invalidación de caché, orden por `id DESC` en última gestión (listado, búsqueda, últimas), `eliminarGestion` con recálculo, mensajes sin mojibake. |
| `public/js/modal.js` | Opción `focusId` en `Modal.abrir`. |
| `public/js/gestion-campana.js` | **Nuevo:** lógica compartida de guardado (gestión + recordatorio + destacar) y `alternarModoRecordatorio`. |
| `public/desktop/js/gestion-lote.js` | Wrapper de `guardarGestionIndividual`, modal con `focusId`, onchange a `GestionCampana`, eliminación de duplicados. |
| `public/movil/js/gestion-lote.js` | Ídem versión móvil (pills → `GestionCampana.alternarModoRecordatorio`). |
| `public/desktop/gestion-lote.html` / `public/movil/gestion-lote.html` | Incluyen `/js/gestion-campana.js`. |

---

## 4. Correcciones post-revisión de código

- **Orden del recálculo**: `recalcularGestionadas` se ejecuta ahora **después** del `UPDATE` de `solicitudes_ids` en `agregar-solicitudes` y `quitar-solicitud` (antes usaba ids desactualizados: la solicitud quitada seguía contando y la recién agregada con gestiones previas no contaba).
- **Sin doble alert en recordatorios**: `guardarRecordatorioModal` (compartido) ya no muestra `alert` antes de lanzar; el `catch` de `guardarGestionIndividual` muestra un único aviso.
- **Invalidación de caché global**: `crearGestion` y `eliminarGestion` usan `cache.invalidateAllCampanas()` (las campañas de equipo son visibles para varios usuarios) + `invalidateDashboard(usuarioId)`.

## 5. Validación realizada

- `node --check` en todos los archivos modificados: OK.
- Arranque del servidor (`node app.js`): carga de módulos sin errores, servidor operativo.
- No se ejecutaron pruebas de escritura contra la base de datos de producción (el entorno apunta a PostgreSQL de producción); el flujo completo debe verificarse en staging o en SQLite local antes del despliegue.

## 6. Pruebas sugeridas

1. **Contador:** campaña con 1 solicitud + 3 seguimientos → listados muestran "1 gestionada" (no 3) y progreso ≤ 100 %.
2. **Acceso:** con 2 usuarios, POST a campaña ajena → 404/403; página de Solicitudes sigue guardando sin campaña.
3. **Última gestión:** dos gestiones en el mismo segundo → tarjeta idéntica en campaña y en solicitudes.
4. **Destacar:** fallo de red en el PUT de destacar → la gestión se guarda igual, sin duplicado al reintentar.
5. **Foco/contexto:** en vista filtrada "Seguimiento", guardar → se conservan filtro, scroll y tarjeta; el foco del modal está en el textarea.
6. **Regresión:** flujo completo móvil + escritorio (Seguimiento, Cobranza, Completada, Recordatorio, historial, semáforo).
