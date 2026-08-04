# Feature: Rediseño UX de Campañas con Progreso y Prioridad

**Versión:** 1.0  
**Fecha:** Agosto 2026  
**Estado:** Implementado

## Objetivo

La pantalla de Campañas (`/gestion-lote`) fue reorganizada para ayudar al gestor a avanzar durante su jornada sin añadir métricas inventadas ni acciones forzadas.

El diseño prioriza cuatro objetivos:

- Hacer visible cuánto se ha avanzado y cuánto falta.
- Responder qué debería hacer el usuario a continuación.
- Convertir el semáforo en un resumen operativo, no solo en un filtro.
- Confirmar cada gestión con una recompensa visual breve y profesional.

## Auditoría UX

### Problemas detectados

- El progreso estaba calculado en el cliente, pero sus elementos principales permanecían ocultos.
- El semáforo mostraba cuatro conteos equivalentes y no indicaba prioridad.
- Los filtros y controles técnicos competían con el objetivo principal de gestionar solicitudes.
- La última gestión mostraba una fecha completa, sin contexto temporal relativo.
- No existía una confirmación visual específica después de guardar una gestión.
- No había datos confiables para mostrar gestiones del día, metas diarias o rachas.

### Principios aplicados

| Problema | Principio | Solución |
|----------|-----------|----------|
| Incertidumbre sobre el avance | Progreso visible y feedback inmediato | Porcentaje, gestionadas, barra y solicitudes restantes |
| Fatiga de decisión | Reconocimiento de la próxima acción | Bloque `Tu siguiente mejor acción` |
| Conteos sin significado | Jerarquía semántica | Copy orientado a acción en cada estado |
| Falta de cierre de ciclo | Refuerzo positivo no invasivo | Toast de confirmación tras guardar |
| Fechas difíciles de interpretar | Cognición contextual | Tiempo relativo y alerta discreta por inactividad |
| Riesgo de métricas ficticias | Honestidad del producto | No se muestran metas, rachas ni actividad diaria sin fuente de datos |

## Jerarquía visual implementada

La lectura esperada de arriba hacia abajo es:

1. Nombre y estado de la campaña.
2. Avance general.
3. Siguiente mejor acción.
4. Panel semáforo.
5. Filtros secundarios.
6. Lista de solicitudes.
7. Acciones de cada solicitud.

## Componentes

### Resumen de avance

Markup principal en `public/desktop/gestion-lote.html`:

- `.avance-campana`
- `#avance-porcentaje`
- `#avance-resumen`
- `.avance-track`
- `#avance-fill`
- `#avance-restante`

La barra utiliza el progreso real calculado como `gestionadas / total_solicitudes * 100`.

El copy restante sigue estas reglas:

- Si hay pendientes: `Faltan solamente X solicitudes`.
- Si no hay pendientes: `Campaña completada`.
- Si no hay solicitudes: `Aún no hay solicitudes en esta campaña`.

### Siguiente mejor acción

La recomendación se genera en `actualizarSiguienteAccion()` y se recalcula cuando cambian los conteos del semáforo.

Prioridad aplicada:

1. `amarillo`: gestionar solicitudes que necesitan seguimiento.
2. `sin_clasificar`: clasificar solicitudes pendientes de revisión.
3. `rojo`: respetar el tiempo de espera antes de volver a contactar.
4. Solicitud pendiente sin prioridad de semáforo: registrar la siguiente gestión.
5. Sin pendientes: informar que la campaña está al día.

El botón `Ver prioridad` activa el filtro correspondiente y desplaza la vista hasta la lista. No crea una acción nueva ni modifica datos.

### Panel semáforo

Las tarjetas mantienen sus hooks funcionales y agregan copy operativo:

| Clave | Copy principal | Apoyo |
|-------|----------------|-------|
| `sin_clasificar` | Sin clasificar | Por revisar |
| `verde` | Ya encaminadas | En buen curso |
| `amarillo` | Necesitan seguimiento | Prioridad media |
| `rojo` | En espera | No contactar ahora |

Las tarjetas siguen funcionando como filtros mediante `setFiltroSemaforo()`. Los conteos provienen de `semaforo_conteos` o del cálculo local sobre las solicitudes cargadas.

### Última actividad

`actualizarResumenCampana()` busca la fecha `fecha_gestion` más reciente entre las solicitudes cargadas y la presenta como `Hace un momento`, `Hace X minutos`, `Hace X horas` o `Hace X días`.

Si la última actividad supera ocho horas, se añade una señal discreta: `Campaña en pausa`. Si no hay fecha disponible, se muestra `Sin actividad registrada`.

### Confirmación de gestión

Después de guardar una gestión individual aparece el toast `✓ Una gestión más completada`. La actualización de estado y progreso continúa usando `cargarDatosGestion()`.

## Fuentes de datos

La interfaz utiliza únicamente datos existentes en `GET /api/gestiones-maestro/:id`:

| Campo | Uso |
|-------|-----|
| `total_solicitudes` | Total y cálculo de avance |
| `gestionadas` | Estado general y progreso del backend |
| `solicitudes` | Lista y cálculo actual del cliente |
| `solicitudes[].gestion_id` | Determinar si existe gestión |
| `solicitudes[].tipo_gestion` | Determinar pendientes y actividad |
| `solicitudes[].fecha_gestion` | Última actividad relativa |
| `solicitudes[].semaforo` | Conteos y recomendación |
| `semaforo_conteos` | Conteos oficiales del panel cuando están disponibles |

No se muestran actualmente:

- Meta diaria.
- Gestiones realizadas durante el día.
- Racha de gestiones consecutivas.
- Tiempo exacto de permanencia en rojo o amarillo.

Para implementar esas funciones será necesario agregar una fuente de datos explícita y definir su alcance temporal y por usuario.

## Animaciones y accesibilidad

- Cambio de semáforo: partícula y actualización visual limitadas a 500 ms.
- Barra de progreso: transición suave de 450 ms.
- Toast: fade y scale sutil, sin rebotes.
- `prefers-reduced-motion`: desactiva animaciones no esenciales.
- Barra de progreso con atributos ARIA de progreso.
- Resumen y recomendación con `aria-live="polite"`.
- El semáforo conserva `role="group"`, labels y foco visible.

## Archivos modificados

| Archivo | Responsabilidad |
|---------|-----------------|
| `public/desktop/gestion-lote.html` | Estructura de avance, recomendación, actividad y copy del semáforo |
| `public/desktop/js/gestion-lote.js` | Cálculo de progreso, recomendación, actividad relativa y toast |
| `public/css/gestion-lote.css` | Jerarquía visual, responsive, transiciones y accesibilidad de movimiento |

## Verificación

```bash
node --check public/desktop/js/gestion-lote.js
git diff --check
```

Ambos comandos finalizaron correctamente.

## Evolución futura

Antes de incorporar “Hoy”, metas o rachas se debe definir:

1. Si la métrica pertenece al usuario, equipo o campaña.
2. Qué tabla y timestamp son la fuente oficial.
3. Cómo se comporta con cambios de zona horaria.
4. Qué ocurre con gestiones editadas o eliminadas.
5. Qué objetivo se muestra cuando no existe una meta configurada.

## Implementación móvil

La versión móvil mantiene una experiencia específica para touch y no reutiliza el layout de escritorio.

Se conservan:

- Selector horizontal de campañas.
- Bottom sheets para acciones de campaña.
- Navegación inferior.
- Targets táctiles de al menos 44 px.
- Tarjetas de solicitud en una sola columna.

Se incorporan en `public/movil/gestion-lote.html` y `public/movil/js/gestion-lote.js`:

- Resumen vertical de progreso con porcentaje y solicitudes restantes.
- Última actividad relativa dentro del resumen.
- Recomendación móvil de siguiente acción.
- Semáforo en cuadrícula 2x2 con filtros táctiles.
- Selector de semáforo desde cada tarjeta.
- Estado rojo expresado como `En espera / No contactar ahora`.
- Acciones secundarias agrupadas bajo `Más opciones` para reducir la carga visual.
- Toast de confirmación después de completar una gestión.

La búsqueda y el filtro por tipo de gestión permanecen disponibles debajo del semáforo como controles secundarios. El cambio de semáforo móvil usa el mismo endpoint que escritorio:

```text
PUT /api/gestiones-maestro/:id/solicitudes/:solicitudId/semaforo
```

## Ajuste posterior de tarjetas desktop

La tarjeta desktop de Gestión por Lotes fue refinada para mejorar la jerarquía operativa:

- El semáforo pasó de pills discretos a un selector segmentado de cuatro partes con color y estado activo visible.
- El segmento se muestra junto al nombre del cliente.
- La última gestión tiene un bloque separado, con fecha relativa y clic sobre todo el bloque para abrir el detalle.
- Se eliminó el botón redundante `Ver`.
- `Historial` conserva su acción independiente.

### Historial contextual de campaña

El historial de una solicitud dentro de una campaña usa ahora:

```text
GET /api/gestiones-maestro/:gestionId/solicitudes/:solicitudId/historial
```

El endpoint valida que el usuario tenga acceso a la campaña y que la solicitud pertenezca a ella. Después obtiene las gestiones asociadas a esa campaña o las gestiones generales de la solicitud (`gestion_maestro_id IS NULL`). Esto evita que un usuario normal vea una última gestión en la tarjeta pero reciba un historial vacío por un filtro exclusivo de `usuario_id`.

El destacado dentro de una campaña usa el endpoint contextual:

```text
PUT /api/gestiones-maestro/:gestionId/solicitudes/:solicitudId/destacar
```

La ruta general `PUT /api/excel/solicitudes/:id/destacar` mantiene la restricción de propietario para la pantalla global de Solicitudes. La ruta contextual permite la acción a usuarios con acceso operativo a la campaña, después de validar que la solicitud pertenezca a ella.
