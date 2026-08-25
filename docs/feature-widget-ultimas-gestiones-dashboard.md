# Feature: Widget "🕘 Últimas gestiones" en el Dashboard

**Fecha:** Agosto 2026
**Ámbito:** `public/desktop/index.html`, `public/desktop/js/dashboard.js`,
`public/desktop/css/dashboard.css`, `public/movil/index.html`,
`public/movil/js/dashboard.js`, `public/movil/css/estilos.css`
**Solicitud:** Mostrar en el dashboard las últimas gestiones registradas, tanto para el
usuario normal (sus propias gestiones) como para el líder (las de todo su equipo, con el
nombre del agente que las hizo). En escritorio, el grid de 2 widgets se convierte en una
**pasarela deslizable de 3 slides** siguiendo el mismo patrón del carrusel principal.

---

## 1. Resumen

Se añade un tercer widget al dashboard: **"🕘 Últimas gestiones"**, con estilo de timeline
"últimas actividades" (los mismos badges por tipo de gestión del historial de campaña).

- **Móvil:** el mini-carrusel de widgets pasa de **2 a 3 slides** (campañas / solicitudes /
  gestiones) con su tercer dot.
- **Escritorio:** el grid lado a lado (`.dashd-widgets-grid`) se **elimina** y se reemplaza
  por una pasarela deslizable `.dashd-widgets-carousel` con flechas ‹ › con loop y dots,
  idéntica al patrón del carrusel principal (`.dashd-carousel`).

## 2. Comportamiento por rol

| Rol | Datos mostrados | Enlace "Ver todas" |
|-----|-----------------|--------------------|
| **Líder** | Últimas 5 gestiones de su equipo (`GET /api/equipos/:id/gestiones?limite=5`) con `agente_nombre`/`agente_username` y `cliente_nombre` | `/equipo` (móvil) · `/equipo` (escritorio) |
| **Resto de usuarios** | Sus últimas 5 gestiones (`GET /api/excel/gestiones/todas?limite=5`) con `nombre` y `cedula` del cliente | `/m/gestiones` (móvil) · `/gestiones` (escritorio) |

El rol se detecta vía `GET /api/auth/sesion` (`usuario.es_lider`). Cada fila del timeline
muestra: punto + línea vertical, nombre principal, `#id_solicitud` (con cliente o cédula),
badge del tipo de gestión coloreado, fecha relativa (`Hoy`, `Ayer`, día de la semana, `Hace N
semanas/meses`) y observación truncada.

## 3. Cambios por archivo

### 3.1 Móvil

- **`public/movil/index.html`:** nuevo `<section class="dash-widget-slide" data-wslide="2">`
  con `#ultimas-gestiones-lista` y enlace `#ultimas-gestiones-link` ("Ver todas"); tercer
  botón `.dash-widget-dot` `data-wdot="2"`.
- **`public/movil/js/dashboard.js`:** nueva `cargarUltimasGestiones()` (análoga a
  `cargarUltimasSolicitudes`, sin bloqueo si el slide no existe), helpers `coloresTipoGestion`,
  `formatearFechaWidget()`, y se reutiliza `truncarTexto()` / `escapeHtmlMovil()`. El
  `Promise.all` inicial ahora incluye `cargarUltimasGestiones()` (los tres widgets se igualan
  de altura con `igualarAlturaWidgetSlides()` tras cargar y en `resize`).
- **`public/movil/css/estilos.css`:** bloque `.ges-widget-*` (timeline: `.ges-widget-item`,
  `.ges-widget-rail`, `.ges-widget-dot`, `.ges-widget-line`, `.ges-widget-name`,
  `.ges-widget-meta`, `.ges-widget-badges`, `.ges-widget-badge`, `.ges-widget-fecha`,
  `.ges-widget-obs`) y `#ultimas-gestiones-lista { max-height: 50vh; overflow-y: auto; }`.

### 3.2 Escritorio

- **`public/desktop/index.html`:** se elimina `.dashd-widgets-grid` y se sustituye por
  `.dashd-widgets-carousel#dashdWidgetsCarousel` con `.dashd-widgets-track`,
  `.dashd-widgets-arrow` (prev/next), `.dashd-widgets-dots` y 3 `.dashd-widget-card`
  (`data-dashd-widget="0|1|2"`). La tarjeta de gestiones usa `#ultimas-gestiones-lista` y
  `#ultimas-gestiones-link`.
- **`public/desktop/js/dashboard.js`:** `initDashdWidgetsCarousel()` (loop por flechas ‹ › +
  dots + `scroll-snap`, clon del patrón de `initDashdCarousel`) e
  `igualarAlturaDashdWidgetsSlides()`. Nueva `cargarUltimasGestiones()` con helpers propios
  (`coloresTipoGestion`, `truncarTexto`, `formatearFechaWidget`) reutilizando `escapeHtml()`.
  `iniciarDashboard()` ahora llama a `initDashdWidgetsCarousel()` y carga los tres widgets con
  `Promise.all([cargarCampañasActivas(), cargarUltimasSolicitudes(), cargarUltimasGestiones()])`
  y luego `igualarAlturaDashdWidgetsSlides()`.
- **`public/desktop/css/dashboard.css`:** estilos `.dashd-widgets-carousel` (grid `40px 1fr
  40px` + fila de dots, igual que `.dashd-carousel`), `.dashd-widgets-track`, `.dashd-widgets-
  arrow`, `.dashd-widgets-dot(.active)`, `.dashd-widget-card` ahora `flex: 0 0 100%` con
  `scroll-snap-align`, `#ultimas-gestiones-lista { max-height: 440px; overflow-y: auto; }` y el
  mismo bloque timeline `.ges-widget-*`. En `@media (max-width: 768px)` las flechas de la
  pasarela pasan a 30px (la regla `.dashd-widgets-grid { grid-template-columns: 1fr }` se
  elimina).

## 4. Qué NO cambió

| Elemento | Estado |
|----------|--------|
| `initDashdCarousel()` (carrusel principal) | Sin cambios |
| Widgets de campañas y solicitudes (HTML, cargas, estilos `.campana-widget-*`, `.sol-widget-*`) | Sin cambios |
| `cargarCampañasActivas()` / `cargarUltimasSolicitudes()` | Sin cambios |
| Endpoints backend (`/api/equipos/:id/gestiones`, `/api/excel/gestiones/todas`) | Sin cambios |

## Verificación

- ✅ `node --check` en `public/desktop/js/dashboard.js` y `public/movil/js/dashboard.js`.
- ✅ Sin referencias residuales a `.dashd-widgets-grid` en `public/`.
- ⏳ Prueba visual: abrir el dashboard móvil y deslizar al 3er slide; en escritorio navegar la
  pasarela con flechas/dots. Validar vista de líder (nombres de agentes) vs usuario normal.

## Documentación relacionada

- `docs/README.md` — estructura del proyecto (§7 Frontend, §11.1 Dashboard).
- `docs/feature-historial-campana.md` — historial de campaña con el que comparte estética.
- `docs/informe-fix-widgets-dashboard-movil.md` — truncado de nombres en los widgets móviles.
- `README.md` — tabla de Features Recientes.
