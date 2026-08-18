# 🎯 Plan — Instrumentación de métricas de gestión: temporizador de llamadas + historial de semáforo

> **Contexto:** derivado de `docs/informe-auditoria-produccion-daviddlaa.md`. La auditoría mostró que el sistema **no registra duración de llamadas, ni resultado estructurado, ni ventas vinculadas**; el embudo hoy se reconstruye clasificando texto libre. Este plan instrumenta las métricas para que se midan solas.
> **Estado:** ✅ **Fase 1 v2 implementada y verificada (17/08/2026):** el frontend de la Fase 1 v1 (temporizador dentro del modal de gestión) se reemplazó por un **popup de llamada desde el botón 📞 de cada tarjeta** (sección 8). Backend y migraciones de la v1 se mantienen. Fases 2–4 pendientes.

---

## 1. 🕐 Opción 1 — Temporizador de llamada con diseño psicológico

### 1.1 Objetivo
Que cada llamada quede registrada con **duración real en segundos** y **resultado estructurado**, sin depender de la memoria del operador.

### 1.2 Esquema (extender tabla `gestiones` — mínimo y suficiente)

| Columna | Tipo | Descripción |
|---|---|---|
| `duracion_seg` | INTEGER NULL | Duración de la llamada en segundos |
| `llamada_inicio` | TIMESTAMP NULL | Momento en que se presionó "Iniciar llamada" |
| `llamada_fin` | TIMESTAMP NULL | Momento en que se presionó "Finalizar llamada" |
| `resultado` | TEXT NULL | Bucket estructurado del embudo: `no_contesta`, `numero_invalido`, `no_interesado`, `interesado`, `derivado`, `venta`, `descalificado`, `seguimiento`, `otro` |
| `metodo_duracion` | TEXT NULL | `temporizador` \| `estimada` \| `manual` (auditoría de calidad del dato) |

**Alternativa considerada:** tabla `llamadas` separada (útil si una solicitud recibe varias llamadas). Se descarta por ahora: en el flujo actual 1 gestión = 1 contacto, y columnas en `gestiones` evitan duplicar el INSERT.

**Migración:** SQLite (`initDb.js` / `migrations/0XX_*.sqlite.sql`) y PostgreSQL (`initDb.pg.js` / `migrations/0XX_*.pg.sql`), siguiendo la convención `ADD COLUMN IF NOT EXISTS`.

### 1.3 API
- `POST /api/excel/gestiones` (`excel.controller.js` → `crearGestion`, línea ~465): acepta `duracion_seg`, `llamada_inicio`, `llamada_fin`, `resultado`, `metodo_duracion` y los persiste en el INSERT (línea ~518).
- No se necesita endpoint nuevo: el guardado de la gestión **es** el evento de finalización de llamada.

### 1.4 Flujo del modal (web y móvil)
1. Botón **"📞 Iniciar llamada"** (secundario) → registra `llamada_inicio` y muestra cronómetro en vivo.
2. Botón **"✓ Finalizar llamada"** → se vuelve el **botón primario y fijo**; al pulsarlo calcula `duracion_seg` y muestra "Llamada de 03:24".
3. Select de **Resultado** (estructurado, con los buckets del embudo).
4. "Guardar gestión" envía todo junto.

### 1.5 🧠 Diseño psicológico para garantizar el click en "Finalizar"

| # | Mecanismo | Principio psicológico |
|---|---|---|
| 1 | **Fricción por diseño:** mientras el cronómetro corre, "Guardar gestión" está **deshabilitado**. La única forma de guardar es finalizar la llamada. | *Enforcement*: no se puede registrar una gestión de llamada sin duración; el click no depende de la voluntad, depende del flujo. |
| 2 | **Cronómetro visible y "presión"**: timer grande en rojo con "🔴 EN LLAMADA". Al intentar cerrar el modal con timer activo → confirmación "Llamada en curso (00:42): ¿finalizar y guardar?" | *Loss aversion / aversión a dejar el timer corriendo*: ver el tiempo correr empuja a cerrarlo. |
| 3 | **Refuerzo positivo:** toast "✅ Llamada de 03:24 registrada" + contador diario en el header/dashboard ("Hoy: 23 llamadas · 1h 12m"). | *Gamificación ligera*: el acumulado del día motiva a completar cada registro. |
| 4 | **Redundancia anti-olvido:** si se guarda una gestión tipo "Llamada" sin usar el temporizador, el sistema pide "¿Cuánto duró?" con preselección del tiempo transcurrido (se guarda con `metodo_duracion='estimada'`). | *Recuperación de fallos*: la duración nunca se pierde silenciosamente. |
| 5 | **Accountability:** el panel del líder muestra por agente "llamadas sin duración" (contador) y % de cumplimiento. | *Lo que se mide se mejora*: la tasa de finalización se vuelve una métrica visible. |

---

## 2. 🚦 Historial de cambios del semáforo (selector de la tarjeta)

### 2.1 Esquema — tabla `semaforo_historial`

| Columna | Tipo | Descripción |
|---|---|---|
| `id` | SERIAL PK | |
| `gestion_maestro_id` | INTEGER NOT NULL | FK → `gestiones_maestro(id)` ON DELETE CASCADE |
| `id_solicitud` | INTEGER NOT NULL | |
| `semaforo_anterior` | TEXT NULL | NULL si es la primera clasificación |
| `semaforo_nuevo` | TEXT NOT NULL | `sin_clasificar` \| `rojo` \| `amarillo` \| `verde` |
| `usuario_id` | INTEGER NOT NULL | Quién cambió el semáforo |
| `origen` | TEXT DEFAULT 'tarjeta' | `tarjeta` \| `lote` \| `panel` \| `auto` |
| `changed_at` | TIMESTAMP DEFAULT CURRENT_TIMESTAMP | |

Índices: `(gestion_maestro_id, id_solicitud)`, `(gestion_maestro_id, changed_at)`, `(usuario_id, changed_at)`.

### 2.2 Dónde se implementa
En `gestionesMaestro.controller.js` → `actualizarSemaforoSolicitud` (línea ~1605):
- El SELECT previo pasa de `SELECT id FROM gestiones_maestro_solicitudes ...` a `SELECT id, semaforo ...` (para conocer `semaforo_anterior`).
- En la **misma transacción** que el UPDATE/INSERT del puente (líneas ~1607-1622), se inserta una fila en `semaforo_historial`.
- El endpoint PUT existente (`/api/gestiones-maestro/:id/solicitudes/:solicitudId/semaforo`) queda igual para el frontend: **cero cambios de UI**.

### 2.3 Métricas que habilita
- Tiempo hasta **primera clasificación** por solicitud (creación de campaña → primer cambio).
- **Nº de cambios por solicitud** (estabilidad; >3 cambios sugiere datos ruidosos o indecisión).
- Cambios por usuario/día/campaña (carga de trabajo de clasificación).
- Distribución y evolución del semáforo por campaña.
- ⭐ **Correlación semáforo → resultado comercial** (¿las "verdes" convierten más?), cruzando con `gestiones.resultado` y ventas.

---

## 3. 🤔 ¿Es necesaria la métrica del semáforo? — Evaluación honesta

**Hallazgo de la auditoría:** el semáforo hoy está prácticamente sin uso operativo (751 de 895 filas = 84 % en `sin_clasificar`; en las campañas de `daviddlaa` no hay semáforos asociados a gestiones). Es una funcionalidad construida pero no adoptada.

**Veredicto:** la métrica del semáforo es **útil pero de prioridad 2**:
- Es **barata** (una tabla + un INSERT en un endpoint existente, sin tocar UI).
- Es la única forma de **validar si el semáforo predice conversión** — dato clave para decidir si vale la pena impulsar su uso en campañas.
- Pero **no mueve el modelo de negocio sola**: sin duración de llamada ni ventas vinculadas, el semáforo no demuestra ROI.

→ Recomendación: implementarla **después** de la duración + resultado + ventas, y **en paralelo a una decisión de producto** sobre si el semáforo será obligatorio en las campañas (si no se va a usar, la métrica sobra).

---

## 4. 📋 Otras métricas necesarias según la auditoría (prioridad)

| # | Métrica | Por qué (evidencia de la auditoría) | Cómo |
|---|---|---|---|
| P0 | **Duración de llamadas + resultado estructurado** | Hoy no existe ningún campo de duración; el embudo se lee de texto libre (411 gestiones clasificadas a mano). | Sección 1 de este plan |
| P1 | **Ventas vinculadas a gestión** | `ventas_vendedores` es manual, sin FK a solicitud/gestión; las 15 ventas de daviddlaa solo existen en texto. | Tabla `ventas`: `gestion_id` FK, `solicitud_id` FK, `usuario_id` (gestor), `vendedor`, `monto`, `fecha_cierre`, `comision`, `estado` |
| P1 | **Derivación estructurada** | "se la asigno a Jenny / Angelica / Rosita" está en texto libre (59 gestiones). | Columnas `vendedor_derivado`, `fecha_derivacion` en `gestiones` |
| P2 | **Historial del semáforo** | Ver sección 2-3. | Sección 2 |
| P3 | **Origen del lead / motivo de no interés** | Solo se infiere por `segmento`; los rechazos no tienen motivo. | Columna `motivo` en gestiones con resultado `no_interesado`/`descalificado` |

**Métricas que NO se necesitan implementar (ya existen):** fecha/hora de gestión, usuario, solicitud, campaña, observación, historial de estados (`historial_actualizaciones`), recordatorios.

---

## 5. 🗂️ Implementación en las campañas

### 5.1 Modal de gestión de campaña (gestion-lote desktop y móvil)
- El temporizador y el select de **Resultado** se agregan al modal existente; `gestion_maestro_id` ya viaja en el POST → **las métricas se agregan por campaña sin esfuerzo extra**.
- Los buckets de resultado usan los mismos valores que el embudo → el panel de campaña puede calcular embudo por campaña en vivo.

### 5.2 Tarjeta de solicitud (semáforo)
- El switch/selector inline existente (`cambiarSemaforoSolicitud` / `cambiarSemaforoSolicitudMovil`) no cambia: el endpoint PUT registra el historial automáticamente.

### 5.3 Gestión por lotes
- Cada fila del lote guarda `resultado`; el lote queda identificable como evento de campaña (mismo `gestion_maestro_id`).

### 5.4 Panel de métricas por campaña (nuevo)
Por campaña: gestiones/día · contactados · interesados · derivados · ventas · **duración promedio de llamada** · tiempo a primera gestión · % del semáforo clasificado en 24 h · comparativa con el embudo global. Exportable a Excel (excel.service.js ya existe).

### 5.5 Dashboard del líder
Contador diario por agente: llamadas, minutos hablados, % con duración registrada, semáforos cambiados, ventas del día.

---

## 6. 🚧 Fases y esfuerzo estimado

| Fase | Contenido | Esfuerzo |
|---|---|---|
| **1 (P0)** | Columnas en `gestiones` + temporizador con nudges + resultado estructurado (web y móvil) | ✅ Implementada |
| **2 (P1)** | Tabla `ventas` + derivación estructurada (modal y listados) | 2–3 días |
| **3 (P2)** | `semaforo_historial` + panel de métricas por campaña + dashboard líder | 2–3 días |
| **4** | Export Excel de métricas por campaña | 1–2 días |

**Criterio de éxito de la Fase 1:** ≥90 % de las gestiones tipo "Llamada" con `duracion_seg` y `resultado` completos a las 2 semanas de desplegada (medible con `metodo_duracion` y el contador de "llamadas sin duración" del líder).

---

## 7. Estado de implementación

### ✅ Fase 1 — Implementada (17/08/2026)

**Migración** (idempotente, aditiva):
- SQLite: `src/config/initDb.js` (`ALTER TABLE gestiones ADD COLUMN` con guard `PRAGMA table_info`).
- PostgreSQL: `src/config/initDb.pg.js` (`SCHEMA_VERSION` 6→7, `ADD COLUMN IF NOT EXISTS` × 5).

**Backend:** `src/controllers/excel.controller.js` → `crearGestion` (`POST /api/excel/gestiones`) persiste y valida `duracion_seg` (entero ≥0), `llamada_inicio`, `llamada_fin`, `resultado` (whitelist de 9 buckets) y `metodo_duracion` (temporizador|estimada|manual). Un valor inválido se descarta, nunca rompe el guardado.

**Frontend:** nuevo módulo compartido `public/js/temporizador-llamada.js` (incluido tras `modal.js` en `public/desktop/gestion-lote.html`, `public/movil/gestion-lote.html` y `public/desktop/solicitudes.html`), integrado en:
- Modal de campaña desktop (`abrirGestion` en `public/desktop/js/gestion-lote.js`): opción 📞 Llamada añadida + bloque temporizador.
- Modal de campaña móvil (`abrirGestion` en `public/movil/js/gestion-lote.js`): pill 📞 Llamada + bloque temporizador.
- Modal de Solicitudes desktop (`abrirGestionesCard`/`guardarGestionDesktop` en `public/desktop/js/solicitudes.js`).
- Guardado compartido de campañas: `public/js/gestion-campana.js` (`guardarGestionIndividual`).

**Nudges implementados:** ① fricción (Guardar/Cancelar deshabilitados con llamada en curso), ② cronómetro en vivo + guardia sobre `cerrarModal`/`Modal.cerrar` (confirmación al cerrar con llamada activa, cubre Cancelar/overlay/Escape), ③ refuerzo positivo (mensaje "📞 Llamada registrada (MM:SS)" al guardar), ④ anti-olvido (gestión tipo Llamada sin duración → prompt de minutos estimados, `metodo_duracion='estimada'`).

**Verificación:** `node --check` en los 8 archivos JS modificados · migración + INSERT validados sobre copia de la BD · smoke test end-to-end local (app forzada a SQLite — nunca conectó a producción —, login real + `POST /api/excel/gestiones` con los 5 campos → fila persistida correctamente) · BD local restaurada a su estado original y producción intacta.

### ⏳ Pendiente
- Contador diario del nudge ③ ("Hoy: X llamadas · Y min" en dashboard) y accountability del líder: se entregan con el panel de métricas de la **Fase 3**.
- Fases 2 (ventas vinculadas + derivación estructurada), 3 (`semaforo_historial` + métricas por campaña) y 4 (export Excel): pendientes de aprobación.

---

## 8. 🔄 Rediseño (v2) — SweetAlert de llamada desde el botón 📞 de la tarjeta

> Decisión del dueño del producto (17/08/2026): el temporizador no va dentro del modal de gestión. Va en un **SweetAlert** que se abre al presionar el botón **📞 Llamar de cada tarjeta**: el contador corre mientras se hace la llamada (fuera del navegador) y, al volver, en ese mismo SweetAlert se detiene, se escoge el **resultado de la gestión telefónica** y se guarda.

### 8.1 Puntos de entrada (botones 📞 existentes) — decisiones cerradas (17/08/2026)

| Tarjeta | Hoy | Cambio |
|---|---|---|
| Campaña móvil (`btn-sol-call` → `llamarDesdeGestionLote(celular)`) | marca `tel:` directo | ✅ Reemplazar por el popup de llamada (recibe `id_solicitud` + `celular` + `gestionId` global) |
| Solicitudes móvil (`btn-llamar` → `llamarCliente(celular)`) | marca `tel:` directo | ✅ Reemplazar por el popup de llamada (recibe `id_solicitud` + `celular`) |
| Campaña escritorio | **no tiene botón 📞** (la función `llamarDesdeGestionLoteDesktop` existe sin uso) | ❌ Sin cambios (decisión: solo móvil) |
| Solicitudes escritorio | botón 📞 eliminado por decisión previa (`feature-tarjeta-solicitudes-escritorio.md`) | ❌ Sin cambios (decisión) |

### 8.2 Flujo

```
[📞 en la tarjeta]
      │
      ▼
SweetAlert abierto: nombre + teléfono + contador en vivo (00:00)
      │  (se dispara tel: automáticamente — la llamada ocurre fuera del navegador)
      │
[usuario vuelve al navegador]  → el contador se refresca con el tiempo REAL
      │                          (wall-clock: Date.now() − inicio, sin depender de setInterval)
      ▼
[✓ Terminar llamada]  → contador se detiene · muestra "Duración: 03:24"
      ▼
Resultado (pills de los 9 buckets) + observación opcional
      ▼
[💾 Guardar]  → POST /api/excel/gestiones { tipo_gestion:'Llamada', duracion_seg,
                    resultado, observacion, gestion_maestro_id, metodo_duracion:'temporizador' }
      ▼
Toast "📞 Llamada de 03:24 registrada" → cierra → la tarjeta se marca como gestionada
```

### 8.3 Detalles técnicos

- **Componente (decisión cerrada):** popup tipo SweetAlert (overlay + diálogo centrado) construido por el **propio módulo** (`temporizador-llamada.js`), sin depender de `modal.js` ni de `crearModalMovil` — las páginas móviles no cargan `modal.js`. **No** se agrega SweetAlert2 CDN.
- **Módulo:** se reescribió `public/js/temporizador-llamada.js` → API: `abrirLlamada({ solicitudId, celular, nombre, gestionId, onGuardada })` (abre el popup, arranca el contador y marca `tel:`), `finalizar()` (detiene el contador y muestra duración + resultado + observación), `elegirResultado(valor)`, `guardar()` (POST y cierra), `cancelar()` (confirma antes de cerrar con llamada en curso). Se conservan los buckets de `resultado`, el formateo y la guardia de confirmación al cerrar.
- **Contador por wall-clock:** `duracion = Date.now() − inicio` en cada render (setInterval cada 1s + refresco en `visibilitychange`/`pageshow`). Así el tiempo es correcto aunque el navegador suspenda el `setInterval` en segundo plano.
- **Backend:** sin cambios — `POST /api/excel/gestiones` ya acepta y valida `duracion_seg`, `llamada_inicio`, `llamada_fin`, `resultado`, `metodo_duracion` (sección 7).
- **Migraciones:** sin cambios — las 5 columnas de `gestiones` ya existen (sección 7).
- **Revertir de la v1:** bloque temporizador dentro de los modales de gestión (campaña desktop/móvil y Solicitudes desktop), el código nudge en `guardarGestionIndividual`/`guardarGestionDesktop`. La opción 📞 Llamada **se elimina del modal de campaña móvil** (en móvil las llamadas solo se registran por el popup de la tarjeta, con temporizador y resultado) y **se conserva en el modal de campaña escritorio** (única vía para registrar llamadas, sin temporizador).
- **Opcional (v2.1):** persistir "llamada en curso" en `sessionStorage` para restaurar el SweetAlert si la página recarga durante la llamada.

### 8.4 ✅ Implementación v2 (17/08/2026)

- **Botones 📞 conectados (solo móvil):** `llamarDesdeGestionLote(id, celular, nombre)` en `public/movil/js/gestion-lote.js` (Campaña móvil, `gestionId` global de la campaña; al guardar refresca con `cargarDatosGestionMovil()`) y `llamarCliente(id, celular, nombre)` en `public/movil/js/solicitudes.js` (Solicitudes móvil, `gestionId = campana_id` de la solicitud si existe; al guardar refresca con `buscarEnServidor(true)`). Ambos con `tel:` como fallback si el módulo no está cargado.
- **Revertido de la v1:** bloque temporizador dentro de los modales de gestión (campaña desktop/móvil y Solicitudes desktop), código nudge en `guardarGestionIndividual` (`public/js/gestion-campana.js`) y `guardarGestionDesktop` (`public/desktop/js/solicitudes.js`), e includes del script en `public/desktop/gestion-lote.html` y `public/desktop/solicitudes.html`.
- **Opción 📞 Llamada en el modal (decisión 17/08/2026):** se **eliminó del modal de campaña móvil** (en móvil las llamadas se registran solo por el popup de la tarjeta, con temporizador y resultado — evita el segundo camino que se guardaría sin métricas). Se **conserva en el modal de campaña escritorio**, que es la única vía para registrar una llamada (el escritorio no tiene botón 📞 en las tarjetas).
- **Corrección de bug detectada en verificación:** `duracion_seg: actual.seg || null` convertía 0 (llamada de <1 s) en `null`; ahora se envía 0 como número.
- **Verificación:** `node --check` en los 6 archivos JS · cero referencias residuales a la API v1 (`html(`, `estaActivo`, `obtenerPayload`) · **smoke test funcional del popup con DOM simulado**: abrir → `tel:` marcado → finalizar → elegir resultado → POST `/api/excel/gestiones` con los 5 campos de métrica correctos → `onGuardada` ejecutado → overlay cerrado (`✅ SMOKE TEST POPUP OK`). Producción intacta.

### 8.5 Criterios de aceptación

1. Al tocar 📞 en una tarjeta se abre el SweetAlert con contador corriendo y se marca el número.
2. Al volver al navegador, el contador muestra el tiempo real transcurrido (no se pierde por estar en segundo plano).
3. "Terminar llamada" muestra la duración y el selector de resultado (9 buckets).
4. "Guardar" crea la gestión `Llamada` con `duracion_seg`, `resultado` y `metodo_duracion='temporizador'`, y la tarjeta se actualiza.
5. Cerrar/cancelar con llamada en curso pide confirmación.
6. Verificación: `node --check`, smoke test local (SQLite forzada, producción intacta) y prueba manual del flujo del SweetAlert.

*Documento de planificación — Fase 1 v2 implementada (17/08/2026); Fases 2–4 pendientes de aprobación.*
