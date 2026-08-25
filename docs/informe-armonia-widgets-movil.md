# Informe: Armonía visual en los widgets del Dashboard Móvil (Campañas / Solicitudes / Gestiones)

**Fecha:** Agosto 2026
**Ámbito:** `public/movil/js/dashboard.js`, `public/movil/css/estilos.css`
**Síntoma reportado:** los 3 widgets de la pasarela móvil mostraban registros de **tamaños distintos**
(el de Últimas gestiones era más alto y variable por su timeline), rompiendo la armonía al
deslizar entre pasarelas; además el widget de gestiones mostraba **5 registros** mientras los
otros 2 mostraban 4.

---

## Resumen

Se unificaron los 3 widgets (`Campañas activas`, `Últimas solicitudes` y `Últimas gestiones`)
en un **único formato de tarjeta idéntico** (`.campana-widget-item`), con **`min-height`
uniforme de 62px** y **4 registros** cada uno. El widget de gestiones dejó su timeline
(`.ges-widget-*`) y ahora usa la misma tarjeta que los demás.

---

## 1. Antes — Estructuras distintas

| Widget | Estructura | Alto aprox. |
|--------|-----------|-------------|
| 🚀 Campañas | `.campana-widget-item`: icono 36px + nombre + semáforo + stats + chevron | ~58px |
| 📋 Solicitudes | `.campana-widget-item`: icono 36px + nombre + badge estado + cédula + chevron | ~58px |
| 🕘 Gestiones | `.ges-widget-item` **timeline**: dot + línea + nombre + meta + badges + observación (2 líneas) | ~76–90px (variable) |

El problema: **gestiones era más alto y variable** (observación multilínea + timeline), y
mostraba 5 registros, así que el salto de altura entre pasarelas se notaba al deslizar.

## 2. Solución

### 2.1 Render unificado en JS (`public/movil/js/dashboard.js`)

`cargarUltimasGestiones()` ahora genera la **misma tarjeta** que los otros widgets
(`📝 icono + nombre + detalle + chevron ›`), usando las clases compartidas
`.campana-widget-item` / `.campana-widget-icon` / `.campana-widget-info`:

| Rol | Principal (nombre) | Detalle |
|-----|--------------------|---------|
| Líder | Nombre del agente | `tipo_gestion · fecha` (icono con color del tipo) |
| Resto de usuarios | Nombre del cliente | `tipo_gestion · #solicitud_id · 🆔 cédula (truncada 15) · fecha` |

- **4 registros visibles en los 3 widgets:**
  - Campañas: renderiza las activas y limita el contenedor a la altura de 4 tarjetas
    (`container.style.maxHeight = item.offsetHeight * 4 + 8 * 3` px + `overflow-y: auto`).
  - Solicitudes: `GET /api/excel/solicitudes?limite=4`.
  - Gestiones: `GET /api/equipos/:id/gestiones?limite=4` (líder) o
    `GET /api/excel/gestiones/todas?limite=4` (resto).
- **Empty state con CTA potente** (`.campanas-widget-cta`): los 3 widgets muestran un estado
  vacío con icono, título, subtítulo y botones de acción (campañas → "➕ Crear campaña";
  solicitudes → "📤 Importar solicitudes" + "➕ Nueva solicitud"; gestiones →
  "📋 Ir a solicitudes" + "🚀 Crear campaña").
- Se conserva el enlace "Ver todas" (`#ultimas-gestiones-link`): líder → `/m/equipo`,
  resto → `/m/gestiones`.
- El helper `truncarTexto()` (30/26/15/40 caracteres) se mantiene de la iteración anterior.

### 2.2 CSS uniforme (`public/movil/css/estilos.css`)

| Regla | Cambio |
|-------|--------|
| `.campana-widget-item` | **`min-height: 62px`** fijo en todas las tarjetas de los 3 widgets |
| `.ges-widget-meta` | Se conserva como clase de detalle (se aplicó `display: block` para evitar el conflicto con `.sol-widget-meta`) |
| `.ges-widget-item`, `.ges-widget-rail`, `.ges-widget-dot`, `.ges-widget-line`, `.ges-widget-obs` | **Eliminadas** (CSS muerto del timeline) |

### 2.3 Detalle útil en el widget de gestiones

Para que la tarjeta no pierda información valiosa, el detalle muestra el **tipo de gestión**
siempre y, para usuarios no-líderes, también `#id de solicitud + cédula` (truncada), de modo
que se pueda identificar la solicitud sin abrir el historial.

---

## Verificación

- ✅ `node --check public/movil/js/dashboard.js` — sin errores de sintaxis.
- ✅ `grep` de `.ges-widget-item|rail|dot|line|obs` en JS y CSS: **0 coincidencias** (sin código muerto).
- ✅ Code-review aprobado (notas aplicadas: conflicto de `display` entre `ges-widget-meta` y
  `sol-widget-meta`; mostrar el tipo de gestión también a no-líderes).

## Documentación relacionada

- `docs/informe-fix-widgets-dashboard-movil.md` — iteración anterior (truncado de textos + slide).
- `docs/README.md` — §11.1 Dashboard (widgets en mini-carrusel móvil).
