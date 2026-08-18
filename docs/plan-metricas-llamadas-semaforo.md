# 🎯 Plan — Instrumentación de métricas de gestión: temporizador de llamadas + historial de semáforo

> **Contexto:** derivado de `docs/informe-auditoria-produccion-daviddlaa.md`. La auditoría mostró que el sistema **no registra duración de llamadas, ni resultado estructurado, ni ventas vinculadas**; el embudo hoy se reconstruye clasificando texto libre. Este plan instrumenta las métricas para que se midan solas.
> **Estado:** propuesta para revisión — NO implementado aún.

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
| **1 (P0)** | Columnas en `gestiones` + temporizador con nudges + resultado estructurado (web y móvil) | 1–2 días |
| **2 (P1)** | Tabla `ventas` + derivación estructurada (modal y listados) | 2–3 días |
| **3 (P2)** | `semaforo_historial` + panel de métricas por campaña + dashboard líder | 2–3 días |
| **4** | Export Excel de métricas por campaña | 1–2 días |

**Criterio de éxito de la Fase 1:** ≥90 % de las gestiones tipo "Llamada" con `duracion_seg` y `resultado` completos a las 2 semanas de desplegada (medible con `metodo_duracion` y el contador de "llamadas sin duración" del líder).

---

*Documento de planificación — pendiente de aprobación para pasar a implementación.*
