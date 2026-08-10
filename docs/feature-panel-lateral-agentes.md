# 👥 Feature: Panel Lateral de Gestión de Agentes en el Equipo (Escritorio)

**Fecha:** Agosto 2026
**Módulo:** Equipo / Panel del Líder (escritorio)
**Archivos principales:** `public/desktop/equipo.html`, `public/desktop/js/equipo.js`, `public/desktop/css/equipo.css`
**Relacionado con:** `docs/feature-panel-lateral-solicitudes.md` (mismo patrón de panel lateral en Solicitudes)

---

## 📑 Índice

1. [Resumen](#1-resumen)
2. [Problema](#2-problema)
3. [Solución](#3-solución)
4. [Funcionamiento del Panel](#4-funcionamiento-del-panel)
5. [Vista Lista](#5-vista-lista)
6. [Vista Crear](#6-vista-crear)
7. [Vista Editar](#7-vista-editar)
8. [Activar / Desactivar](#8-activar--desactivar)
9. [Vista Asignaciones](#9-vista-asignaciones)
10. [Arquitectura y Funciones](#10-arquitectura-y-funciones)
11. [Endpoints Utilizados](#11-endpoints-utilizados)
12. [Estilos CSS](#12-estilos-css)
13. [Pruebas de Validación](#13-pruebas-de-validación)
14. [Compatibilidad](#14-compatibilidad)

---

## 1. Resumen

Se rediseñó la gestión de agentes en la página **`/equipo`** (escritorio):

- **Antes:** la tabla "Agentes del Equipo" era el **Slide 2 de la pasarela** (carrusel de 3 slides), con el botón "+ Nuevo" en el encabezado del slide y modales aparte para crear agentes y ver asignaciones.
- **Ahora:** la gestión de agentes vive en un **panel lateral deslizante desde la derecha** con **gestión completa**: listado en tarjetas, crear, editar, activar/desactivar, reset de contraseña y asignaciones — todo dentro del panel. La pasarela queda con 2 slides (KPIs / Campañas) y un botón **"👥 Agentes (n)"** en el header abre el panel.
- **La pasarela ya no colapsa:** al quitar la tabla del carrusel, la altura de los slides se mantiene estable sin importar cuántos agentes tenga el equipo.

---

## 2. Problema

1. La tabla de agentes era un slide del carrusel. El carrusel **iguala la altura de todos los slides al más alto** (`igualarAlturaEquipoSlides()`), así que con muchos agentes el slide crecía muchísimo y el **botón "+ Nuevo"** (en el encabezado del slide) quedaba fuera de vista; el contenido se comprimía/desbordaba ("colapsaba") e impedía ver los controles.
2. Crear agentes y ver asignaciones usaban **modales aparte**, separados de la tabla.
3. La tabla tenía demasiadas columnas (Usuario, Nombre, Estado, Asignadas, Gestionadas 7d, Ingreso, Acciones), poco cómodas con muchos registros.

---

## 3. Solución

Sacar la gestión de agentes de la pasarela y unificarla en un **único panel lateral deslizante**, dejando la pasarela ligera:

| Elemento | Antes | Ahora |
|----------|-------|-------|
| Listado de agentes | Slide 2 de la pasarela (tabla) | Panel lateral (tarjetas) |
| Crear agente | Modal aparte (botón "+ Nuevo" del slide) | Panel lateral → vista "➕ Nuevo Agente" |
| Editar agente | — | Panel lateral → vista "✏️ Editar" (nombre, email) |
| Activar/Desactivar | — | Switch en cada tarjeta (confirmación) |
| Reset de contraseña | — | Sección "🔑 Cambiar contraseña (opcional)" en la vista Editar |
| Ver asignaciones | Modal aparte (botón 📋 de la fila) | Panel lateral → sub-vista "📋 Asignaciones" |
| Acceso al listado | Slide del carrusel | Botón **"👥 Agentes (n)"** en el header |
| Pasarela | 3 slides (KPIs / Agentes / Campañas) | 2 slides (KPIs / Campañas) |
| Modales (crear / asignaciones) | Presentes | Eliminados |

**Sin cambios de backend:** todos los endpoints ya existían en `src/routes/equipos.routes.js`; no se añadieron rutas nuevas ni migraciones.

---

## 4. Funcionamiento del Panel

- `abrirPanelAgentes()` construye dinámicamente un overlay (`#panel-agentes-overlay`) + `<aside class="panel-agentes">` fijo a la derecha, lo agrega al `body` con `document.body.insertAdjacentHTML('beforeend', html)` y anima su entrada (`requestAnimationFrame`).
- **Corrección de inserción (Agosto 2026):** inicialmente el overlay se insertaba con `wrapper.firstChild`, que resultó ser un **nodo de texto** (el salto de línea inicial del template literal), por lo que el overlay nunca entraba al DOM y el clic en el botón lanzaba `Cannot set properties of null (setting 'innerHTML')` sin abrir nada. Se reemplazó por `insertAdjacentHTML('beforeend', ...)`, el mismo mecanismo que usa el panel de Solicitudes (`panel-solicitud`).
- **Cierre:** botón ✕, clic fuera del panel, o tecla **Escape** (`cerrarPanelAgentes()`). Al cerrar se quita la animación, se restaura el scroll del body y el overlay se elimina del DOM después de 300ms (si no fue reabierto en ese lapso).
- **Scroll lock:** mientras el panel está abierto, `document.body.style.overflow = 'hidden'`.
- **Navegación:** el panel tiene vistas intercambiables en su body: Lista → Crear / Editar / Asignaciones, todas con botón "← Volver a la lista".
- **Datos:** al abrir el panel se cargan en paralelo `GET /api/equipos/:id/dashboard` (stats) y `GET /api/equipos/:id/miembros` (email + fecha de ingreso), se fusionan por `id` y se guardan en `_agentesData`. Las vistas de Asignaciones y Editar **reutilizan esa memoria** (sin fetchs extra).

---

## 5. Vista Lista

Renderizada por `renderPanelAgentesLista()`:

- **Botón "➕ Nuevo Agente"** fijo arriba del listado.
- **Tarjetas por agente** (`panel-agente-card`):
  - Avatar con la inicial (verde si activo, rojo si inactivo).
  - Usuario + nombre completo.
  - **Badge de estado** (● activo / ○ inactivo) y **switch** de activar/desactivar.
  - Stats: 📋 Asignadas y 📝 Gestiones (7 días).
  - 📅 Ingreso.
  - Acciones: **📋 Asignaciones** (primario) y **✏️ Editar** (secundario).
- Estado vacío con CTA "➕ Nuevo Agente" cuando el equipo no tiene agentes.

---

## 6. Vista Crear

Renderizada por `renderPanelFormAgente('nuevo', null)` (botón "➕ Nuevo Agente"):

- Campos: **Usuario \***, Nombre, Email (opcional), **Contraseña \***.
- Validaciones idénticas a las del backend: mínimo 8 caracteres, al menos una mayúscula y un número; errores mostrados como toast (no `alert`).
- El botón muestra estado "⏳ Creando..." y se deshabilita durante la petición.
- Éxito → toast "✅ Agente creado" y recarga lista + KPIs del dashboard.

---

## 7. Vista Editar

Renderizada por `renderPanelFormAgente('editar', agente)` (botón "✏️ Editar"):

- Campos: **Nombre** y **Email** (pre-rellenados).
- Sección **🔑 Cambiar contraseña (opcional)**: si se llena, se ejecuta `PUT .../reset-password` después del `PUT` de edición.
- **La contraseña se valida ANTES de cualquier guardado** para evitar guardados parciales (si es inválida, no se persiste el nombre/email y se muestra el toast de error).
- Éxito → toast "✅ Agente actualizado" y recarga lista + KPIs.

---

## 8. Activar / Desactivar

`toggleActivoAgente(agenteId, checkbox)`:

- Confirmación (`¿Seguro que deseas activar/desactivar al agente X?`).
- `PUT /api/equipos/:id/agentes/:agenteId/toggle-active`.
- Si falla, el switch **revierte** su estado.
- En éxito se actualiza `_agentesData` en memoria y se re-renderiza la lista sin recargar el panel completo.

---

## 9. Vista Asignaciones

`verAsignacionesAgente(agenteId, username)`:

- Sub-vista dentro del panel con "← Volver a la lista".
- Tarjeta del agente: resumen de **📋 Solicitudes Asignadas** y **📝 Gestiones (7 días)**.
- Enlace "📋 Ver todas las solicitudes de {agente}" → `/solicitudes?usuario={id}` (nueva pestaña).
- Usa `_agentesData` en memoria (sin fetch adicional).

---

## 10. Arquitectura y Funciones

Todo vive en `public/desktop/js/equipo.js` (Vanilla JS, mismo patrón del resto del módulo):

| Función | Responsabilidad |
|---------|-----------------|
| `crearEstructuraPanelAgentes()` | Construye overlay + aside + header/body; anima apertura; listener Escape (único) |
| `abrirPanelAgentes()` | Crea estructura, carga dashboard + miembros, fusiona y renderiza la lista |
| `cerrarPanelAgentes()` | Cierra con animación, restaura scroll y elimina el overlay |
| `renderPanelAgentesLista()` | Vista Lista (botón nuevo + tarjetas) |
| `nuevoAgenteEnPanel()` | Abre la vista Crear |
| `editarAgenteEnPanel(id)` | Abre la vista Editar con los datos en memoria |
| `renderPanelFormAgente(modo, agente)` | Construye el formulario Nuevo/Editar |
| `crearAgente()` | Valida y envía `POST .../agentes` |
| `guardarAgenteEdicion(id)` | Valida contraseña, envía `PUT .../agentes/:id` y opcionalmente `reset-password` |
| `toggleActivoAgente(id, checkbox)` | Activa/desactiva con confirmación y revert en fallo |
| `verAsignacionesAgente(id, username)` | Sub-vista de asignaciones dentro del panel |
| `mostrarToast(mensaje, tipo)` | Toast (verde éxito / rojo error); ahora acepta `tipo` |

Estado global: `_agentesData` (lista fusionada), `_panelAgentesAbierto`, `_panelAgentesEscAttached`. El contador del botón del header (`#agentesHeaderCount`) se actualiza desde `cargarAgentes()` (init) y desde `abrirPanelAgentes()`.

---

## 11. Endpoints Utilizados

| Método | Ruta | Uso |
|--------|------|-----|
| GET | `/api/equipos/:id/dashboard` | Stats de agentes (asignadas, gestiones 7d, estado) |
| GET | `/api/equipos/:id/miembros` | Email y fecha de ingreso por agente (enriquecimiento) |
| POST | `/api/equipos/:id/agentes` | Crear agente |
| PUT | `/api/equipos/:id/agentes/:agenteId` | Editar nombre/email |
| PUT | `/api/equipos/:id/agentes/:agenteId/toggle-active` | Activar/desactivar |
| PUT | `/api/equipos/:id/agentes/:agenteId/reset-password` | Cambiar contraseña |

Todos los endpoints ya existían en `src/routes/equipos.routes.js`; no se añadieron rutas nuevas.

---

## 12. Estilos CSS

Añadidos al final de `public/desktop/css/equipo.css`:

- `.equipo-agentes-btn` (+ count) — botón del header con contador.
- `.panel-agentes-overlay` / `.panel-agentes` / `.abierto` / `.abierto-overlay` — overlay oscuro + aside fijo a la derecha (440px, `max-width: 94vw`), transición `right` y `opacity`.
- Header del panel, título con icono, botón ✕.
- `.panel-agentes-nuevo` — CTA "➕ Nuevo Agente" (verde).
- `.panel-agente-card` (+ `.activo`/`.inactivo` con borde izquierdo de color), avatar, badge de estado, **switch** (`.panel-agente-switch`), stats, ingreso, acciones.
- `.panel-agentes-volver`, `.panel-agentes-form`, `.panel-agentes-seccion` (contraseña), `.panel-agentes-submit`.
- `.panel-agentes-vacio`, `.panel-agentes-loading`, `.panel-agentes-asignaciones`, `.panel-agentes-link-solicitudes`.
- `@media (max-width: 768px)` — panel a ancho completo; el texto del botón del header se oculta (solo icono + contador).

---

## 13. Pruebas de Validación

- [x] Botón del header muestra el contador de agentes y abre el panel.
- [x] La lista carga desde dashboard + miembros (fusionados por id).
- [x] Crear agente valida contraseña y refresca lista + KPIs.
- [x] Editar guarda nombre/email; contraseña inválida **no** guarda nada (validación previa).
- [x] Switch activar/desactivar con confirmación y revert en fallo.
- [x] Asignaciones se abren como sub-vista con "← Volver".
- [x] Cierre por ✕, clic fuera y Escape; scroll del body bloqueado mientras está abierto.
- [x] La pasarela quedó con 2 slides y dots sincronizados (con muchos agentes ya no colapsa).
- [x] `node --check` pasa en `equipo.js`.
- [x] Sin referencias rotas a los modales/ids eliminados.
- [x] **Verificación end-to-end en navegador real** (login como líder + Puppeteer): el clic en el botón abre el panel; se probaron lista de tarjetas, formulario "➕ Nuevo Agente", edición ("✅ Agente actualizado"), switch activar/desactivar con confirmación ("✅ Agente desactivado"), sub-vista de asignaciones y cierre con Escape — **0 errores de consola**.
- [x] Bug corregido: el overlay se inserta con `insertAdjacentHTML` (robusto ante whitespace inicial); antes `wrapper.firstChild` insertaba un nodo de texto y el panel no abría.

---

## 14. Compatibilidad

- **Solo escritorio:** el panel lateral de agentes es exclusivo de `/equipo` (desktop). La versión móvil (`/m/equipo`) no se modificó (ya usa tarjetas, no pasarela).
- Se eliminaron los modales `createAgenteModal` y `verAsignacionesModal` y sus funciones asociadas (`abrirModalCrearAgente`, `cerrarModalCrearAgente`, `cerrarModalAsignaciones`) junto con el tbody `agentesTableBody`; no quedan referencias rotas.
- Sin cambios de esquema de BD ni de rutas del backend.
- **Nota local (SQLite):** el endpoint `POST /api/equipos/:id/agentes` usa `pool.connect()` (sintaxis PostgreSQL), que la capa de abstracción SQLite local no implementa; por eso la creación de agentes solo puede verificarse de punta a punta en **producción (PostgreSQL)**. Es una limitación pre-existente del backend, ajena a este feature (el modal antiguo usaba el mismo endpoint).

---

> **Repositorio:** ARCHIVOX — Sistema de Gestión de Solicitudes
