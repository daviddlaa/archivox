# 📱 Rediseño: Gestión de Equipo Móvil (vista Líder) — Plan y Ejecución

**Fecha:** Agosto 2026
**Módulo:** Equipos (Móvil)
**Archivos afectados:**
- `public/movil/equipo.html` (reestructuración)
- `public/movil/css/equipo.css` (nuevo — CSS dedicado del módulo)
- `public/movil/js/equipo.js` (reescritura de lógica y render)

**Backend: SIN cambios** — los endpoints existentes cubren todo:
- `GET /api/equipos/mi-equipo`
- `GET /api/equipos/:id/dashboard` (agentes con `asignadas`, `gestiones_7d`, `is_active` + totales)
- `GET /api/equipos/:id/campanas` (con `asignado_a`, `asignado_username`, `estado`)
- `GET /api/equipos/:id/gestiones?limite&offset` (paginación ya soportada)

---

## 1. Diagnóstico (por qué la experiencia actual es mala)

| # | Problema | Evidencia |
|---|---|---|
| 1 | Página única de scroll infinito (KPIs → acciones → agentes → campañas → gestiones) sin foco | Orden de secciones en `equipo.html` |
| 2 | KPIs genéricos no accionables; "Gestiones 7d" del equipo no revela quién está flojo | `kpiGestiones` = suma de todo el equipo |
| 3 | Quick actions de bajo valor: "Actualizar" duplica FAB + pull-to-refresh; "Ver Solicitudes" ya está en el bottom nav | Grid 2×2 `equipo-quick-actions` |
| 4 | Sin buscador ni orden en agentes; con 20+ agentes es inmanejable | `renderizarAgentesCards` sin filtro/sort |
| 5 | Campañas NO clicables: no abren la campaña | `renderizarCampanas` sin `onclick` |
| 6 | Gestiones recientes: solo 10, sin paginación (backend ya soporta `offset`), sin filtro por agente | `gestiones?limite=10` |
| 7 | Detalle de agente = sheet con 5 acciones; "Ver Asignaciones" re-llama el dashboard (fetch redundante) | `verAsignacionesAgenteMovil` |
| 8 | FAB solo refresca; la acción primaria (crear agente) queda escondida | `equipo-fab` |
| 9 | Header oscuro pesado + emojis por todas partes; no parece app nativa | `header` gradiente + emoji 🏢 |
| 10 | CSS repartido en 3 sitios (`<style>` inline, `estilos.css`, `gestiones.css`); la convención exige CSS de módulo | `docs/convencion-css-solicitudes.md` |
| 11 | `user-scalable=no` + `maximum-scale=1.0` → falla de accesibilidad | meta viewport |
| 12 | `_esLider` se calcula pero no se usa | `equipo.js` |

**Se conserva (ya funciona bien):** pull-to-refresh, sistema `mm-sheet`, toasts, shimmer, animaciones de entrada.

---

## 2. Decisiones de diseño (aprobadas por el usuario)

1. **Navegación: 3 pestañas internas** (segmented control sticky): **Agentes** (default) / **Campañas** / **Actividad**.
2. **Detalle de agente: pantalla completa** (no bottom sheet), con campañas asignadas + últimas gestiones + acciones.
3. **Acción principal "＋ Nuevo Agente" como botón en el header de la pestaña Agentes** (sin FAB).

---

## 3. Arquitectura nueva

### Pestaña AGENTES (default)
- **KPI strip compacto de 3 métricas**: agentes activos · asignaciones · gestiones 7d (se elimina la 4ª tarjeta y el grid de acciones rápidas).
- **Buscador** + **chips de orden**: Nombre / Más asignadas / Más activas.
- **Filas compactas** (avatar, nombre, @username, dot de estado, 2 stats inline, chevron) en vez de cards pesadas.
- **Botón "＋ Nuevo"** en el header de sección → sheet de creación (se mantiene `mostrarSheetMovil`).
- **Detalle de agente en pantalla completa**:
  - Cabecera: avatar, nombre, estado, stats.
  - Sección **Campañas asignadas** con progreso (tap → `/m/gestion-lote?id=X`).
  - Sección **Últimas gestiones del agente** (tap → `/m/solicitudes?buscar=id`).
  - Acciones: Editar / Cambiar contraseña / Activar-Desactivar (sheets + confirm modal existentes).

### Pestaña CAMPAÑAS
- Chips de filtro: **Todas / Activas / Completadas**.
- Tarjetas **clicables** con progreso, agente asignado y dot de estado → `location.href = '/m/gestion-lote?id=' + id`.

### Pestaña ACTIVIDAD
- Chips de filtro **por agente** (Todos + uno por agente).
- Timeline **agrupado por día** (Hoy / Ayer / dd/mm).
- Botón **"Cargar más"** con paginación real (`offset`).

---

## 4. Sistema de diseño

- **CSS dedicado**: `public/movil/css/equipo.css` (se vacía el `<style>` inline del HTML y se elimina el link a `gestiones.css`).
- **Paleta**: indigo `#6366f1` (consistente con `--primary-color` de `estilos.css`).
- **Naming**: clases `eq-*` para la nueva UI del módulo.
- **Accesibilidad**: `viewport-fit=cover` sin `user-scalable=no`, targets ≥ 44px, safe-areas iOS.
- **Micro-interacciones**: press states, transición de tabs, shimmer, empty states por sección.

---

## 5. Plan de pruebas

1. Cargar `/m/equipo` como líder → 3 tabs visibles, KPIs correctos.
2. Buscar y ordenar agentes → lista se filtra/ordena sin recargar.
3. Abrir detalle de agente → campañas asignadas y gestiones del agente correctas; volver conserva búsqueda/orden/scroll.
4. Crear / editar / reset password / toggle agente → sheets y toasts funcionan; datos refrescan.
5. Pestaña Campañas: filtros + tap en tarjeta abre `/m/gestion-lote?id=X`.
6. Pestaña Actividad: agrupación por día, filtro por agente, "Cargar más" (offset).
7. Pull-to-refresh, estados vacíos, shimmer.
8. `node --check` sobre `equipo.js` + prueba en navegador (emulación móvil).

---

## 6. Estado de implementación (Agosto 2026) — ✅ COMPLETADO

- ✅ `public/movil/css/equipo.css` creado: tabs sticky (header global fluye), KPI strip de 3, buscador, chips, filas de agente, tarjetas de campaña, timeline por día, detalle pantalla completa, sheets, toasts, PTR, shimmer. Llaves balanceadas 153/153.
- ✅ `public/movil/equipo.html` reestructurado: 3 tabs, panes por pestaña, sin `<style>` inline (movido al CSS), sin quick actions ni FAB, `viewport-fit=cover` sin `user-scalable=no`, se eliminó el link a `gestiones.css` (clases no usadas).
- ✅ `public/movil/js/equipo.js` reescrito:
  - Tabs Agentes/Campañas/Actividad con lazy render.
  - Búsqueda + orden (nombre/asignadas/actividad) en agentes.
  - Detalle de agente en **pantalla completa** (campañas asignadas con progreso clicable → `/m/gestion-lote`, últimas 5 gestiones clicables → `/m/solicitudes?buscar=`, acciones Editar/Reset/Toggle con sheets existentes).
  - Campañas clicables con chips de filtro (Todas/Activas/Completadas).
  - Actividad agrupada por día (Hoy/Ayer/fecha), chips por agente (por índice → **sin usernames inline en onclick**, evita ruptura por comillas), paginación con `offset`.
  - Seguridad: onclicks con solo IDs numéricos (`buscarAgente` resuelve el resto); `_esLider` oculta el botón ＋ Nuevo si no aplica.
  - Sin fetch redundante (se eliminó `verAsignacionesAgenteMovil` que re-llamaba el dashboard).
- ✅ Validación: `node --check` OK, CSS balanceado, servidor arranca sin errores, referencias cruzadas HTML↔JS verificadas.
- ✅ Revisión de código: corregidos botón "Cargar más" (texto se restablece), escaping de usernames en onclick, lógica muerta en `cambiarTab`, media query dañina de desktop, CSS muerto.

**Pendiente (manual):** prueba visual en navegador con emulación móvil y datos reales (requiere login de líder).

