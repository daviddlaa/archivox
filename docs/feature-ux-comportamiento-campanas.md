# Feature: Rediseño UX de Campañas con Progreso y Prioridad

**Versión:** 2.0

**Fecha:** Agosto 2026

**Estado:** Implementado

> **v2.0:** Incorpora los ajustes D2/D3 (desktop) y M3/M4 (mobile): orden de lista por
> prioridad, atajos de teclado, rail colapsable, focus ring, selector de campaña por bottom
> sheet, filtros en una línea, compactación de tarjetas móviles, switch segmentado de
> semáforo inline y scroll restoration en ambas vistas.

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
| `public/desktop/gestion-lote.html` | Estructura de avance, recomendación, actividad y copy del semáforo; `#gestion-estado` |
| `public/desktop/js/gestion-lote.js` | Cálculo de progreso, recomendación, actividad relativa, toast, atajos de teclado, orden por prioridad, rail, scroll restoration |
| `public/css/gestion-lote.css` | Jerarquía visual, responsive, transiciones, accesibilidad de movimiento, switch segmentado, `.card-focused`, animación del rail |
| `public/movil/gestion-lote.html` | Selector de campaña (bottom sheet), filtros, carrusel de semáforo, recomendación móvil |
| `public/movil/js/gestion-lote.js` | Bottom sheet de campañas, `cambiarSemaforoSolicitudMovil`, orden por prioridad, scroll restoration, conteos móviles |
| `public/movil/css/gestion-lote.css` | Header compacto, filtros en fila, carrusel sin scroll, switch segmentado móvil, gradientes de tarjeta, destacado sutil |

## Verificación

```bash
node --check public/desktop/js/gestion-lote.js
node --check public/movil/js/gestion-lote.js
git diff --check
```

Los tres comandos finalizaron correctamente.

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

- Selector de campañas en el header (botón con nombre de la campaña + chevron).
- Bottom sheets para acciones de campaña.
- Navegación inferior.
- Targets táctiles de al menos 44 px.
- Tarjetas de solicitud en una sola columna.

Se incorporan en `public/movil/gestion-lote.html`, `public/movil/css/gestion-lote.css` y `public/movil/js/gestion-lote.js`:

- Resumen de progreso con porcentaje y solicitudes restantes.
- Última actividad relativa dentro del resumen.
- Recomendación móvil de siguiente acción (`#siguiente-accion-mobile`).
- Semáforo en carrusel horizontal de 4 tarjetas con filtros táctiles.
- Selector de semáforo **inline segmentado** desde cada tarjeta.
- Estado rojo expresado como `En espera / No contactar ahora`.
- Acciones secundarias agrupadas bajo `Más opciones` para reducir la carga visual.
- Toast de confirmación después de completar una gestión.

### Selector de campañas (M4)

En lugar del selector horizontal de chips, el header móvil muestra un botón compacto
(`#btn-campana-selector` + `#campana-btn-label`) que abre un **bottom sheet**
(`#campanas-sheet`, `#campanas-sheet-overlay`, `#campanas-sheet-list`) con la lista de
campañas disponibles. El sheet se cierra con la X, con `Esc` o tocando el overlay.
Funciones: `cargarListaCampanas`, `toggleCampanasSheet`, `closeCampanasSheet`,
`actualizarBotonCampana`, `seleccionarCampaña`, `marcarCampañaActiva`.

### Filtros en una sola línea

La búsqueda (input `#busqueda`) y el filtro por tipo de gestión (select `#filtro-estado`)
viven en la misma fila flexible (`.filtros-mobile` con `display: flex`). El JS los muestra
con `style.display = 'flex'` para no romper la alineación horizontal.

### Semáforo móvil

El semáforo móvil es un **carrusel horizontal** (`#semaforo-mobile-scroll`) de cuatro
tarjetas `.semaforo-mobile-card` (una por estado, `data-semaforo`). Cada tarjeta muestra
su conteo (`#count-mobile-{amarillo,sin_clasificar,verde,rojo}`) y actúa como filtro
(`setFiltroSemaforoMovil`). El carrusel conserva el **orden fijo** del HTML
(Sin clasificar · Seguimiento · Encaminadas · En espera); antes de Agosto 2026 se reordenaba
automáticamente por prioridad (`reordenarCarruselSemaforoMovil`), comportamiento eliminado en
`docs/fix-semaforo-movil-orden-fijo.md`.

### Selector de semáforo inline por tarjeta

Cada tarjeta de solicitud muestra un **switch segmentado** (`.sol-semaforo-switch`) con los
cuatro estados (dot + texto completo: Sin clasificar · Verde · Amarillo · Rojo). El estado
activo se pinta con el tono correspondiente. El cambio se hace **en el lugar** mediante
`cambiarSemaforoSolicitudMovil(id, semaforo, event)`:

- `event.stopPropagation()` evita abrir el detalle.
- PUT al endpoint `PUT /api/gestiones-maestro/:id/solicitudes/:solicitudId/semaforo`.
- Actualiza `solicitudes` y `todasLasSolicitudes` **in-place** y re-renderiza sin recargar
  la página (se conserva el scroll).
- Actualiza los conteos del carrusel (`actualizarSemaforoMovil`) y muestra toast + flash en
  la tarjeta (`.sol-semaforo-flash`).

La lista se **reordena por prioridad** tras el cambio (`PRIORIDAD_SEMAFORO_MOVIL`:
amarillo → sin clasificar → verde → rojo), con destacadas primero, igual que desktop.

### Compactación móvil (M4)

Rediseño táctil de la pantalla móvil para maximizar el área de trabajo:

- **Header compacto**: `12px 16px`, tipografías reducidas (título 16px, subtítulo 12px),
  con el botón de campaña y el chevron alineados en una sola fila.
- **Filtros en una línea**: `#busqueda` y `#filtro-estado` comparten fila (`display: flex`).
- **Semáforo sin scroll interno**: las 4 tarjetas `.semaforo-mobile-card` se reparten el
  ancho (`flex: 1 1 0; min-width: 0`) con conteo a 17px y etiqueta a 9px.
- **Sin encabezado de sección**: se eliminó el bloque "Trabajo activo / Solicitudes por
  gestionar".
- **Colores de tarjeta alineados con desktop**: gradientes `linear-gradient(180deg, ...)`
  con los tonos de la paleta `--sem-sol-*` (sin borde lateral); `.gestionada` conserva un
  `border-top: 2px solid #22c55e`.
- **Sin ID de solicitud** en la tarjeta (el identificador es el nombre + cédula copiables).
- **Sin botón WhatsApp redundante**: el chat se abre desde el icono 💬 de la fila de datos.
- **Destacado sutil**: la tarjeta destacada usa un borde dorado + sombra (`.sol-card.destacada`),
  sin pintar el fondo.
- **Botones más pequeños**: `.btn-sol` a `min-height: 42px` y `font-size: 12px`;
  `.btn-sol-call` a `44px`.

Además, las solicitudes `Completada` se excluyen del semáforo móvil y se muestran en el acordeón `Solicitudes completadas`. Esta sección se abre automáticamente cuando no quedan solicitudes activas y no incluye un botón `Gestionar de nuevo`.

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

### Orden de lista por prioridad (D3)

La lista de solicitudes se ordena con `PRIORIDAD_SEMAFORO` (amarillo → sin clasificar →
verde → rojo), colocando primero las destacadas. El mismo criterio aplica al móvil
(`PRIORIDAD_SEMAFORO_MOVIL`).

### Atajos de teclado desktop (D3)

El handler global `keydown` (líneas 184-215 de `public/desktop/js/gestion-lote.js`) habilita:

| Tecla | Acción |
|-------|--------|
| `Esc` | Cierra menús abiertos o quita el foco de la tarjeta seleccionada |
| `/` o `Ctrl/Cmd+K` | Foco en el campo de búsqueda `#busqueda` |
| `j` / `k` | Navegar por las tarjetas (índice `_cardNavIndex`) |
| `Enter` | Abre la última gestión de la tarjeta enfocada |
| `1`/`2`/`3`/`4` | Filtro sin clasificar / amarillo / verde / rojo |
| `0` | Limpiar filtro de semáforo |

Los atajos se ignoran mientras el foco está en un input/textarea.

La tarjeta enfocada se resalta con `.card-focused` (outline `#6366f1` + sombra) y
`_cardSelect()` hace `scrollIntoView` para mantenerla visible.

### Rail/workspace colapsable (D2)

El panel izquierdo de campañas (`#campana-rail`) es colapsable con el botón
`#btn-rail-toggle` (`CampanaRail`). El workspace usa `grid-template-columns` con transición
de `0.28s` y las tarjetas hacen fade-in (`railFadeIn`). El estado colapsado persiste en
`localStorage` (`campana_rail_collapsed`) y se refleja con `.rail-collapsed` /
`.workspace-active`.

### Scroll restoration

Tras re-renderizar la lista (cambio de semáforo, filtro, etc.) se conserva la posición de
scroll tanto en desktop (guardado en línea 925, restaurado en 1073-1075) como en móvil.

### Estado textual de la campaña (fix)

El header desktop muestra debajo del título un estado textual `#gestion-estado` con
`data-estado` (`sin-iniciar`, `en-curso`, `casi-lista`, `completada`, `vacia`) calculado en
`actualizarEstadoCampanaTexto()`. El elemento faltaba en el HTML y se restituyó; en errores
o sin campaña cargada permanece oculto (`hidden`).

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

## Cierre del ciclo de campaña

Una solicitud cuyo último `tipo_gestion` es `Completada` deja de formar parte del trabajo activo:

- Se excluye de los conteos del semáforo.
- Se muestra en la sección `Solicitudes completadas`.
- Conserva su última gestión, fecha e historial.
- No muestra selector de semáforo.

La campaña solo se considera completada cuando todas sus solicitudes tienen estado `Completada`. Si posteriormente se registra una gestión distinta, la solicitud vuelve al trabajo activo.

## Centro de Recomendaciones Inteligentes

Desktop y móvil incluyen una sección discreta de `Recomendaciones` que combina:

- Una recomendación contextual basada en el semáforo, antigüedad de actividad y cierre de campaña.
- Buenas prácticas rotativas sobre llamadas, registro de gestiones y comunicación por WhatsApp.
- Control para contraer o expandir el contenido.

La sección no bloquea acciones ni presenta las sugerencias como reglas absolutas. Cuando existen solicitudes rojas, respeta la semántica operativa vigente: están en espera y la recomendación evita sugerir contacto inmediato.
