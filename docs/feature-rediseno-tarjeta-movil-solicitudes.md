# Feature: Rediseño de la tarjeta móvil de Solicitudes — compacta, Gestiones = historial, Completar/Editar fusionado, ⋮ → 🗑️ y link de campaña

**Fecha:** Agosto 2026
**Ámbito:** solo móvil — `public/movil/js/solicitudes.js`, `public/movil/css/solicitudes-mobile.css`, `public/movil/js/gestion-lote.js`
**Escritorio:** sin cambios.

---

## 📑 Índice

1. [Resumen](#1-resumen)
2. [La tarjeta nueva (diagrama)](#2-la-tarjeta-nueva-diagrama)
3. [Cambios por archivo](#3-cambios-por-archivo)
4. [Detalles técnicos importantes](#4-detalles-técnicos-importantes)
5. [Verificación](#5-verificación)
6. [Documentación relacionada](#6-documentación-relacionada)

---

## 1. Resumen

Se rediseñó la **tarjeta de Solicitudes en la vista móvil** siguiendo el plan v3
(con la **Opción 1** confirmada para el botón "No aplica"): una tarjeta **más
compacta** que muestra solo información general, donde:

- El botón **📋 Gestiones ya NO ingresa gestiones**: abre el **historial del
  cliente** en timeline (estilo "últimas actividades" de campaña), de solo lectura.
- El bloque de **última gestión desaparece** de la tarjeta y, en su lugar, hay un
  **link a la campaña** donde está indexada la solicitud (`📢 {campaña} →`), que
  navega a esa campaña y **salta a esa tarjeta** con un destello.
- El **menú ⋮ se elimina por completo** y se reemplaza por un botón directo
  **🗑️ Eliminar** en la fila de botones (con confirmación). Esto también elimina de
  raíz toda la complejidad del menú contextual (que venía dando problemas).
- **Editar se fusiona dentro del modal de Completar**: un solo modal con Estado +
  Segmento + información adicional + referencias.
- La bandera **👎 No aplica** queda **fuera del modal**, como **botón de solo icono
  👎 en la fila 4** (junto al link de campaña), para no recargar la fila 1: si la
  solicitud está marcada, al tocarlo revierte directo; si no, abre el modal de
  confirmación existente.
- **📞 Llamar se queda en la fila** pero **cambia de posición** (pasa primero).

### Decisiones del plan aplicadas

| Decisión | Resultado |
|----------|-----------|
| Botón Gestiones | Abre **solo historial** del cliente (timeline read-only, sin formulario ➕) |
| Editar | Se fusiona en el modal **Completar/Editar** (menos espacio perdido) |
| ⋮ → 🗑️ | Botón **Eliminar directo** en la fila; el menú ⋮ se elimina (HTML, JS, CSS, listener) |
| "No aplica" | **Botón 👎 de solo icono en la fila 4** (junto al link de campaña) — fuera del modal y de la fila 1, sin toques accidentales (stopPropagation + confirmación) |
| Llamar | Se queda en la fila, **pasa a la primera posición** |
| Link de campaña | `📢 {campaña} →` → `/m/gestion-lote?id=X&card=Y` (deep link con scroll + destello) |

---

## 2. La tarjeta nueva (diagrama)

### Antes

```
┌────────────────────────────────────────┐
│ [SEGMENTO] [ESTADO] 👎 noaplica         │  fila 1
│ Nombre del cliente 📋                   │  fila 2
│ [📋Gestiones][📞Llamar]                 │  fila 3 (5 controles: 4 botones + ⋮)
│ [✏️Completar][💬WhatsApp][⋮]           │
│ 📋 Seguimiento · fecha                  │  fila 4: ÚLTIMA GESTIÓN (se eliminó)
│   observación...                        │
│ 📦 Producto 📅 Fecha 👤 Vend. 📢 Camp.  │  fila 5
└────────────────────────────────────────┘
```

### Después (compacta)

```
┌────────────────────────────────────────┐
│ [○] [SEGMENTO] [ESTADO]                │  fila 1: checkbox selección (siempre 1 fila)
│ Nombre del cliente 📋                   │  fila 2
│ [📞][📋Gestiones][✏️Completar]         │  fila 3: 5 botones compactos (40 px)
│ [💬WhatsApp][🗑️Eliminar]              │
│ 📢 {Campaña} →                  [👎]   │  fila 4: link campaña + botón no aplica
│ 📦 Producto 📅 Fecha 👤 Vendedor        │  fila 5
└────────────────────────────────────────┘
```

Resultado: **~2 tarjetas más visibles por pantalla**, sin bloque de última gestión
y con acceso directo a la campaña donde está indexada la solicitud.

---

## 3. Cambios por archivo

### 3.1 `public/movil/js/solicitudes.js` — `renderizarCards`

- **Fila 1:** **checkbox circular de selección `[○]`** + segmento + estado,
  siempre en **una sola fila** (`flex-wrap: nowrap !important`; el segmento trunca
  con ellipsis y el badge de estado queda fijo a la derecha). El checkbox
  (30 px, 26 px en pantallas ≤340 px) llama a `toggleCard(id)` con
  `stopPropagation`; su estado visual (relleno morado + ✓) lo maneja el CSS
  mediante la clase `.seleccionada` de la card, sin tocar la lógica de
  `toggleCard`. Todos los demás controles de la card hacen
  `event.stopPropagation()` para no disparar la selección.
- **Fila 3:** 5 botones en orden **📞 Llamar · 📋 Gestiones · ✏️ Completar ·
  💬 WhatsApp · 🗑️ Eliminar**. El botón Eliminar llama a
  `confirmarEliminarSolicitudMovil(id)` (confirmación nativa + `DELETE`).
- **Fila 4:** fila en flex con dos elementos: el **link de campaña** (si
  `item.campana_id && item.nombre_campana`, `<a class="campana-link">` hacia
  `/m/gestion-lote?id={campana_id}&card={id}`, nombre escapado y ellipsis) y el
  **botón 👎 "No aplica" de solo icono** (`noaplica-icon-btn`, 34 px, siempre
  presente aunque no haya campaña). Si `no_aplica_credito == 0` (marcada) la clase
  `activo` lo resalta en rojo y el tap **revierte directo**; si no, abre el modal
  de confirmación (`confirmarNoAplicaCreditoMovil`). Se **eliminó** el bloque de
  última gestión (seguimiento) y su estado vacío "Sin gestiones".
- **Fila 5:** producto + fecha + vendedor (líder+). Se quitó el badge de campaña
  (ahora es el link de la fila 4).

### 3.2 `public/movil/js/solicitudes.js` — Gestiones = historial del cliente

`abrirGestionesMovil(id)` ahora abre **SOLO el historial** (sin el formulario
"➕ Nueva Gestión", sin fecha/tipo/observación ni botón guardar):

- Encabezado: `📋 Historial · {nombre del cliente}` + `#solicitud`, cédula y celular.
- `cargarHistorialGestionesMovil(id)` renderiza un **timeline** idéntico al patrón
  "últimas actividades" de campaña: punto de color + línea vertical, badge de tipo
  (`Seguimiento`, `Cobranza`, `Llamada`, `WhatsApp`, `Cita`, `Completada`,
  `Recordatorio`…), **🏷️ vendedor** (si existe), ⏱️ fecha y caja de observación.
- **Solo lectura**: se quitaron los botones ✏️ Editar / 🗑️ Eliminar de cada gestión.
- Datos: `GET /api/excel/gestiones/:id` (existe; devuelve `SELECT *` → el badge de
  vendedor se renderiza condicionalmente, sin cambio de backend).
- Estado vacío: `📭 Sin gestiones registradas para este cliente`.
- Se añadió el helper `escaparParaHTMLMovil()` y se escapan tipo, vendedor y
  observación (antes se insertaban crudos).

### 3.3 `public/movil/js/solicitudes.js` — Completar/Editar fusionado

`abrirCompletarInfoMovil(id)` (botón ✏️ Completar) ahora incluye todo lo que antes
hacían dos modales separados:

1. Datos del cliente (solo lectura).
2. **📝 Estado y Segmento** (antes modal "Editar"): selects cargados de
   `GET /api/excel/dashboard/estados` y `GET /api/excel/dashboard/segmentos`,
   con el valor actual preseleccionado.
3. **📋 Información Adicional** (código plus, dirección, trabajo, ocupación,
   correo, ingreso mensual, observaciones) — cargada con
   `GET /api/excel/solicitudes/:id/completa`.
4. **👥 Referencias Personales** (3 slots).
5. Un solo botón **💾 Guardar**.

`guardarCompletarInfoMovil(id)` encadena en una promesa:

1. `PUT /api/excel/solicitudes/:id/editar` (solo si cambió estado/segmento).
2. `PUT /api/excel/solicitudes/:id/completar-info` (resto de campos + referencias).

Al terminar cierra el modal y refresca la lista (`init()`) para ver el nuevo
estado/segmento en las tarjetas.

### 3.4 Eliminación del menú ⋮ y código muerto

- Se eliminaron del HTML de la card el botón ⋮ y el dropdown; y del JS:
  `toggleCardMenuMovil`, `devolverMenuMovil`, `cerrarTodosLosMenusMovil`, el
  listener global de cierre y las funciones `abrirEditarSolicitudMovil` /
  `guardarEditarSolicitudMovil`.
- Código muerto eliminado: `guardarGestionMovil`, `editarGestionMovil`,
  `guardarEdicionGestionMovil`, `confirmarEliminarGestionMovil` y el arreglo
  `opcionesTipoGestion` (quedaron huérfanos al quitar el formulario y los botones
  del historial). `getFechaHoraActual` se conserva (lo usa la exportación a Excel).

### 3.5 `public/movil/css/solicitudes-mobile.css` — compactación y nuevos estilos

| Elemento | Antes | Ahora |
|----------|-------|-------|
| Padding de la card | 18/18/16 px | **13/14/12 px** (radius 16 px) |
| Gap del grid de cards | 14 px | 12 px |
| Fila 1 | margin-bottom 10 px | 8 px (min-height 28 px) |
| Fila 2 (nombre) | 17 px | 16 px (margin-bottom 10 px) |
| Botones (fila 3) | min-height 48 px | **40 px** (gap 6 px, icono 16 px, label 9 px) |
| Fila 5 | — | se quitó el CSS de `campana-badge` |

Nuevos estilos:
- `.noaplica-icon-btn` (y `.noaplica-icon-btn.activo` resaltado en rojo) en la
  fila 4 junto al link de campaña; `.card-fila-4` pasa a `display: flex` con el
  link `flex: 1` y el botón `flex-shrink: 0`.
- `.card-check-movil` (checkbox circular de selección en fila 1): el ✓ blanco y el
  relleno morado en degradado los dispara la clase `.seleccionada` de la card.
- Se oculta en móvil el ✓ morado de la esquina del CSS compartido
  (`body .solicitud-card.seleccionada::after { display: none !important }`) para
  no duplicar el indicador de selección (igual que hace escritorio). El único
  ✓ visible al seleccionar es el del checkbox circular de la fila 1.
- `.btn-eliminar` (rojo suave: fondo `#fef2f2`, borde `#fecaca`).
- `.campana-link` (chip azul índigo con `<span>` interno con ellipsis).
- Breakpoint `≤340 px`: chip y badge de estado aún más compactos para no cortarse.

Se eliminó todo el CSS del menú contextual (`.card-actions-more-movil`,
`.btn-more-movil`, `.card-dropdown-menu-movil`, `.dropdown-item*`,
`.dropdown-divider`) y el CSS del bloque de seguimiento (`.card-fila-4`
seguimiento, `.seguimiento-*`).

### 3.6 `public/movil/js/gestion-lote.js` — deep link `?card=Y`

En `init()`, tras cargar la campaña, se lee el parámetro `card` de la URL y se
llama a `navegarACardMovil(cardTarget)` (función existente que resetea filtros,
hace `scrollIntoView` y aplica la clase de destello `sol-card-nav-flash`), con un
`setTimeout` de 300 ms para dejar asentar el render. Después se **limpia el
parámetro `card`** de la URL con `history.replaceState` para que un refresh no
vuelva a saltar a la tarjeta.

---

## 4. Detalles técnicos importantes

- **Semántica invertida de "No aplica":** en BD `no_aplica_credito = 0` significa
  "ya no aplica" (`noAplica = item.no_aplica_credito == 0`). El botón 👎 pasa
  `(noAplica ? 1 : 0)` a `confirmarNoAplicaCreditoMovil`, coherente con el
  comportamiento previo del menú ⋮ (si está marcada → revierte directo; si no →
  confirmación). El tercer argumento (¿tiene campaña?) se mantiene para el aviso
  "será quitada de su campaña actual".
- **Escritorio intacto:** `public/desktop/*` no se tocó; el rediseño es exclusivo
  de la vista móvil.
- **Sin containing blocks:** al eliminar el menú `position: fixed` de la card, ya
  no importa que la card tenga `transform` (hover/animation) o `filter`
  (`grayscale` en cards "no aplica").
- **XSS:** el nombre de campaña del link y el nombre del cliente del historial se
  escapan con `escaparParaHTMLMovil`; el historial escapa tipo/vendedor/observación.
- **Deep link:** solo se dispara si el parámetro `card` está presente; si la
  solicitud ya no está en la campaña, `navegarACardMovil` muestra el aviso
  existente. Maneja campañas completadas (abre la sección de completadas).

---

## 5. Verificación

- ✅ `node --check public/movil/js/solicitudes.js` — sin errores de sintaxis.
- ✅ `node --check public/movil/js/gestion-lote.js` — sin errores de sintaxis.
- ✅ Sin referencias huérfanas: grep de `toggleCardMenuMovil`, `devolverMenuMovil`,
  `cerrarTodosLosMenusMovil`, `abrirEditarSolicitudMovil`, `guardarEditarSolicitudMovil`,
  `guardarGestionMovil`, `editarGestionMovil`, `confirmarEliminarGestionMovil`,
  `noaplica-mini-badge`, `seguimiento-*`, `campana-badge` → vacío.
- ✅ Revisión de código: se aplicaron los hallazgos (eliminar código muerto,
  escapado XSS, limpiar el parámetro `card` tras el deep link, ellipsis real en el
  link con `<span>`, chip/badge más compactos en pantallas ≤340 px).
- ⏳ Prueba manual (móvil, tras refresh forzado): card compacta; tocar el ○ de la
  fila 1 (o una zona neutra) selecciona la tarjeta con ✓ morado; tap en 🗑️ →
  confirmación y eliminación; 📋 Gestiones → timeline del cliente; ✏️ Completar →
  Estado/Segmento + info + referencias; 📢 {campaña} → salta a la tarjeta con
  destello; botón 👎 No aplica (junto al link de campaña) → confirmación (o
  reversión directa); fila 1 siempre en una sola línea en pantallas angostas.

---

## 6. Documentación relacionada

- `docs/feature-filtros-buscador-movil-solicitudes.md` — UX móvil previa (filtros,
  KPIs, buscador integrado). El menú ⋮ que documentaba quedó **obsoleto** (fue
  eliminado por este rediseño).
- `docs/feature-tarjeta-solicitudes-escritorio.md` — tarjeta de Solicitudes en
  escritorio (panel lateral, sin Llamar).
- `docs/feature-historial-campana.md` — patrón de timeline "últimas actividades"
  de campaña que se replicó para el historial del cliente.
- `docs/README.md` — estructura del proyecto (§4) y módulo Solicitudes (§11.2).
- `README.md` — tabla de Features Recientes.
