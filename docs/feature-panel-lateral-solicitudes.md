# 📋 Feature: Panel Lateral de Detalle/Edición en Solicitudes (Escritorio)

**Fecha:** Agosto 2026  
**Módulo:** Solicitudes (escritorio)  
**Archivos principales:** `public/desktop/js/solicitudes.js`, `public/desktop/css/solicitudes.css`  
**Relacionado con:** `docs/informe-drawer-movil.md` (drawer móvil de navegación, distinto)

---

## 📑 Índice

1. [Resumen](#1-resumen)
2. [Problema](#2-problema)
3. [Solución](#3-solución)
4. [Funcionamiento del Panel](#4-funcionamiento-del-panel)
5. [Vista Detalle](#5-vista-detalle)
6. [Vista Edición](#6-vista-edición)
7. [Tarjeta Limpia](#7-tarjeta-limpia)
8. [Arquitectura y Funciones](#8-arquitectura-y-funciones)
9. [Endpoints Utilizados](#9-endpoints-utilizados)
10. [Estilos CSS](#10-estilos-css)
11. [Pruebas de Validación](#11-pruebas-de-validación)
12. [Compatibilidad](#12-compatibilidad)
13. [Corrección de Búsqueda (endpoint compartido)](#13-corrección-de-búsqueda-endpoint-compartido)
14. [Corrección de Importación (fórmulas Excel)](#14-corrección-de-importación-fórmulas-excel)

---

## 1. Resumen

Se rediseñó la interacción con las tarjetas de solicitudes en **escritorio**:

- **Antes:** el clic en una tarjeta la **seleccionaba** (checkbox); para ver el detalle había que usar el menú ⋮ y un modal; el botón "✏️ Completar" abría un modal aparte.
- **Ahora:** el clic en una tarjeta abre un **panel lateral deslizante (drawer)** desde la derecha con la vista de **detalle**, y dentro del mismo panel se puede pasar a la **edición unificada** (estado, segmento, código plus, direcciones, ocupación, correo, ingreso, observaciones y 3 referencias).
- **La tarjeta quedó más limpia:** se eliminó el botón ⋮ y el `#id`. La selección solo se hace con el checkbox.

---

## 2. Problema

1. El detalle de una solicitud exigía un modal aparte, separado de la edición.
2. La tarjeta tenía demasiados elementos: `#id`, botón ⋮, botón "✏️ Completar", haciendo confuso el clic (¿selecciona o abre?).
3. Completar información y editar estado/segmento eran flujos distintos con modales distintos.

---

## 3. Solución

Unificar detalle + edición en un **único panel deslizante** y dejar la tarjeta con una sola acción por clic:

| Elemento | Antes | Ahora |
|----------|-------|-------|
| Clic en tarjeta | Selecciona (checkbox) | Abre el panel lateral de detalle |
| Selección | Clic en tarjeta o checkbox | Solo checkbox |
| Detalle | Modal aparte (⋮) | Panel lateral (sección "Detalle") |
| Completar info | Modal aparte (✏️ Completar) | Panel lateral → botón "✏️ Editar" |
| Editar estado/segmento | Modal aparte (⋮ → Editar) | Panel lateral → "✏️ Editar" |
| `#id` en la tarjeta | Visible | Eliminado |
| Botón ⋮ | Presente | Eliminado |

---

## 4. Funcionamiento del Panel

- `toggleCardDesktop(id, event)` ahora detecta si el clic fue sobre el checkbox o la zona de selección; si no, llama a `abrirPanelSolicitud(id)`.
- El panel es un `<aside>` fijo a la derecha dentro de un overlay (`#panel-solicitud-overlay`). El overlay se construye dinámicamente con `crearEstructuraPanel()`.
- **Cierre:** botón ✕, clic fuera del panel, o tecla **Escape**.
- **Navegación:** dentro del panel se puede ir de Detalle → Editar → Guardar (vuelve a `init()`), o "← Volver" (regresa a la vista Detalle).

---

## 5. Vista Detalle

Contenido renderizado por `renderPanelDetalle(datos, info)`:

- **Header:** avatar con iniciales, nombre, badge de estado (coloreado según `estadoPanelColor`), botón ✕.
- **Acciones:** botones 📞 Llamar y 💬 WhatsApp (`llamarClienteDesktop` / `whatsAppClienteDesktop`).
- **Secciones:**
  - 👤 Datos Personales: cédula, celular, correo
  - 📍 Ubicación: dirección, dirección de trabajo
  - 💼 Laboral/Económico: ocupación, ingreso mensual (formateado `es-EC`)
  - 📦 Detalles: producto, código plus, segmento, fecha; vendedor (solo si `_esLider`) y campaña si existen
  - 📝 Observaciones
  - 👥 Referencias (`renderPanelReferencias`)
  - 🕐 Última Gestión (`renderPanelUltimaGestion`)
- **Footer:** botón "✏️ Editar" (`abrirEditarEnPanel`) y "🗑️ Eliminar" (`confirmarEliminarDesdePanel` — cierra el panel antes del confirm de eliminación existente).

Los datos se cargan con `GET /api/excel/solicitudes/:id/completa`; si falla, se renderiza el detalle solo con los datos del listado.

---

## 6. Vista Edición

Renderizada por `renderPanelEditar(id, datos, info)`:

- **Estado y Segmento:** selects alimentados de `GET /api/excel/dashboard/estados` y `GET /api/excel/dashboard/segmentos`.
- **Información Adicional:** código plus, dirección, dirección de trabajo, ocupación, correo, ingreso mensual, observaciones (textarea).
- **Referencias Personales:** 3 formularios (nombre, teléfono, relación) con opciones Amigo/Familiar/Vecino/Compañero/Otro; rellena las existentes y completa con vacías hasta 3.
- **Footer:** "← Volver" (`cargarPanelSolicitud`) y "💾 Guardar" (`guardarPanelEditarSolicitud`).

**Guardado** (`guardarPanelEditarSolicitud`):
1. Si hay estado o segmento → `PUT /api/excel/solicitudes/:id/editar`
2. Siempre → `PUT /api/excel/solicitudes/:id/completar-info` (con referencias)
3. Alerta de éxito, cierra el panel y llama a `init()` para refrescar el listado.

---

## 7. Tarjeta Limpia

En `renderSolicitudDesktop`:
- **FILA 1:** solo checkbox + segmento + estado (se eliminó el `#id`).
- **FILA 3:** solo "📋 Gestiones · 📞 Llamar · 💬 WhatsApp" (se eliminó el botón "✏️ Completar" y todo el bloque ⋮/dropdown).
- El ítem "Editar" del antiguo menú ⋮ ahora llama a `abrirEditarEnPanel(id)`.

---

## 8. Arquitectura y Funciones

Todo vive en `public/desktop/js/solicitudes.js` (Vanilla JS, mismo patrón del resto del módulo):

| Función | Responsabilidad |
|---------|-----------------|
| `crearEstructuraPanel()` | Construye overlay + aside + header/body/footer; anima apertura |
| `abrirPanelSolicitud(id)` | Abre el panel en vista Detalle |
| `cargarPanelSolicitud(id)` | Carga `/completa` y renderiza Detalle + footer |
| `abrirEditarEnPanel(id)` | Abre el panel en vista Edición |
| `renderPanelEditar(id, datos, info)` | Construye el formulario de edición |
| `guardarPanelEditarSolicitud(id)` | Valida y envía edición + completar-info |
| `cerrarPanelSolicitud()` | Cierra con animación y elimina el overlay |
| `actualizarPanelHeader(datos)` | Avatar, nombre y badge de estado |
| `panelCampo(label, valor)` | Par label/valor de una fila de detalle |
| `panelSeccion(titulo, contenido, grid)` | Sección con título (grid opcional) |
| `renderPanelDetalle(datos, info)` | Vista Detalle completa |
| `renderPanelReferencias(referencias)` | Lista de referencias |
| `renderPanelUltimaGestion(datos)` | Última gestión registrada |
| `renderPanelFooterDetalle(id)` | Footer Detalle (Editar/Eliminar) |
| `confirmarEliminarDesdePanel(id)` | Cierra panel y delega en eliminación |
| `panelEscapeHtml(texto)` | Escapado de HTML (XSS) |
| `estadoPanelColor(estado)` | Color del badge según estado |
| `formatIngreso(valor)` | Formato numérico `es-EC` |
| `panelFormCampo(label, inputHtml)` | Campo de formulario |

Estado global: `_panelSolicitudId` (id activo) y `_panelSolicitudEscAttached` (listener Escape único).

---

## 9. Endpoints Utilizados

| Método | Ruta | Uso |
|--------|------|-----|
| GET | `/api/excel/solicitudes/:id/completa` | Detalle completo (incluye referencias) |
| PUT | `/api/excel/solicitudes/:id/editar` | Guardar estado/segmento |
| PUT | `/api/excel/solicitudes/:id/completar-info` | Guardar info adicional + referencias |
| GET | `/api/excel/dashboard/estados` | Opciones de estado (select) |
| GET | `/api/excel/dashboard/segmentos` | Opciones de segmento (select) |

Todos los endpoints ya existían en `src/routes/excel.routes.js`; no se añadieron rutas nuevas.

---

## 10. Estilos CSS

Añadidos al final de `public/desktop/css/solicitudes.css`:

- `.panel-solicitud-overlay` — overlay oscuro fijo, `z-index` por encima del contenido.
- `.panel-solicitud` — aside fijo a la derecha, ancho ~430px, transición `transform`.
- `.abierto` / `.abierto-overlay` — clases que activan las transiciones de entrada.
- Header (avatar, nombre, estado, ✕), secciones, grid de campos, referencias, última gestión.
- Formulario (inputs, selects, textarea, grupos de referencia).
- Footer con botones primario/secundario/peligro.
- `@media (max-width: 600px)` — panel a ancho completo.

---

## 11. Pruebas de Validación

- [x] Clic en tarjeta abre el panel (no selecciona).
- [x] Checkbox sigue seleccionando sin abrir el panel.
- [x] Detalle carga desde `/completa`.
- [x] Edición carga estados/segmentos y referencias.
- [x] Guardar actualiza estado/segmento + completar-info y refresca.
- [x] "← Volver" regresa a Detalle.
- [x] Cierre por ✕, clic fuera y Escape.
- [x] Eliminar desde el panel cierra y ejecuta el flujo de confirmación.
- [x] `node --check` pasa en `solicitudes.js`.

---

## 12. Compatibilidad

- **Solo escritorio:** el panel lateral es exclusivo de la vista desktop. El móvil no se modificó (mantiene su propio flujo de detalle/edición).
- El ítem "Editar" del antiguo menú ⋮ fue reemplazado por la edición en el panel; no quedan referencias rotas a modales eliminados.
- Sin cambios de esquema de BD ni de rutas del backend.

---

## 13. Corrección de Búsqueda (endpoint compartido)

Dentro del mismo ciclo se corrigió la búsqueda en `src/controllers/excel.controller.js` (`buscarSolicitudes`), que beneficia a escritorio y móvil:

- **Antes:** se buscaba la frase completa con un solo `LIKE '%...%'`. Como la DB guarda los nombres con apellidos primero (ej. `YEPEZ GONZALEZ JULIA MARIA`), buscar "julia yepez" no encontraba nada por el orden de las palabras.
- **Ahora:** el término se separa en palabras y cada una debe coincidir (AND) en cédula, nombre, celular o id, **sin importar el orden**. Ejemplo: "julia yepez" encuentra `YEPEZ GONZALEZ JULIA MARIA`.
- **Acentos:** el nombre se normaliza con `translate(lower(nombre), 'áéíóúüñ', 'aeiouun')` para que la búsqueda sea insensible a tildes ("yepez" encuentra "YEPEZ").
- **SQLite local:** la función `translate()` no existe en SQLite nativo, por lo que se registró como `db.function('translate', ...)` en `src/config/db.js` (PostgreSQL la trae nativa).
- La consulta de conteo (`COUNT(*)`) usa el mismo filtro para que el total coincida.

**Verificación en producción (PostgreSQL):** "julia yepez" 0→2 resultados, "de la a gonzalez" 5, "david triana" 1, "martinez" 8.

---

## 14. Corrección de Importación (fórmulas Excel)

Se corrigió la importación en `src/services/excel.service.js`:

- **Problema:** al leer un archivo Excel donde una celda contiene una fórmula, ExcelJS devuelve un objeto `{ formula, result }`. El importador guardaba el objeto crudo, dejando en `solicitudes.nombre` un JSON como `{"formula":"C211&...","result":"..."}`.
- **Solución:** nueva función `extraerValorCelda(valor)` que toma el valor **visible** (`result`, o `text` para hipervínculos/richText) y descarta el objeto. Se aplica en `row.eachCell` al construir cada registro.
- **Limpieza en producción:** 213 solicitudes del usuario 13 con `nombre` JSON fueron corregidas con una transacción (solo se actualizó `nombre`, sin borrar registros). Verificado: 0 JSON restantes, 1679 solicitudes intactas, el usuario 13 conserva sus 213 con nombres limpios.

---

> **Repositorio:** ARCHIVOX — Sistema de Gestión de Solicitudes
