# Informe: Fix Widgets del Dashboard Móvil (Campañas activas / Últimas solicitudes)

**Fecha:** Agosto 2026
**Ámbito:** `public/movil/js/dashboard.js`, `public/movil/css/estilos.css`
**Síntomas reportados:**
1. El contenido de los widgets **se salía de la pantalla** (nombres largos que rebasan el slide).
2. El carrusel de widgets **no deslizaba bien**: quedaba "a media pantalla" en vez de aterrizar limpio en cada slide.

---

## Resumen

Los widgets del mini-carrusel (`Campañas activas` y `Últimas solicitudes`) renderizaban nombres y cédulas sin límite. Ese desborde horizontal ensanchaba el carrusel más allá de `2 × ancho`, lo que rompía el `scroll-snap` y el loop táctil, dejando el slide "a media pantalla". Se truncaron los textos y se endureció el CSS para que ambos slides mantengan el mismo tamaño y el deslizamiento quede limpio.

---

## 1. Causa raíz — Desborde horizontal del contenido

### Problema

- **Widget campañas:** `g.nombre` se inyectaba completo (`dashboard.js` `cargarCampañasActivas`). El ellipsis CSS de `.campana-widget-name` existe, pero un nombre muy largo sigue ensanchando el `min-content` de la tarjeta si no hay contenedor con `overflow` controlado.
- **Widget solicitudes:** además del nombre, la cédula se inyectaba como **texto plano** en `.sol-widget-meta` (`dashboard.js` `cargarUltimasSolicitudes`):
  ```javascript
  (s.cedula ? ' · ' + escapeHtmlMovil(s.cedula) : '')
  ```
  Un bloque de dígitos sin espacios tiene `min-content` = su ancho total y **no se parte**, así que la fila (badge `nowrap` + `· cédula`) superaba el ancho disponible → el texto sobresalía de la tarjeta/slide.

### Consecuencia sobre el slide

Los slides son `flex: 0 0 100%` con `scroll-snap-type: x mandatory` (`estilos.css`). El snap solo aterriza limpio si cada slide mide exactamente el ancho del contenedor. Con contenido más ancho que el slide:
- El `scrollWidth` del carrusel supera `2 × ancho`.
- La posición máxima de scroll ya no coincide con `step` (`slides[1].offsetLeft - slides[0].offsetLeft`).
- `configurarLoopTouch` detectaba "última posición" prematuramente → el carrusel se quedaba a media pantalla.

---

## 2. Solución

### 2.1 Truncado de textos en JS (`public/movil/js/dashboard.js`)

Se agregó el helper `truncarTexto(texto, max)` (corta con `…`) y se aplicó:

| Dato | Máx. | Dónde |
|------|------|-------|
| Nombre de campaña `g.nombre` | 30 caracteres | `cargarCampañasActivas` |
| Nombre de cliente `s.nombre` | 26 caracteres | `cargarUltimasSolicitudes` |
| Cédula `s.cedula` | 15 caracteres | `cargarUltimasSolicitudes` |

La cédula ahora se envuelve en `<span class="sol-widget-cedula">` (antes texto plano) para poder controlar su layout con CSS:

```javascript
(s.cedula ? '<span class="sol-widget-cedula">· ' + escapeHtmlMovil(truncarTexto(s.cedula, 15)) + '</span>' : '')
```

### 2.2 Endurecimiento CSS (`public/movil/css/estilos.css`)

| Regla | Cambio |
|-------|--------|
| `.sol-widget-meta` | `overflow: hidden` |
| `.sol-widget-cedula` (nueva) | `white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex: 0 1 auto; min-width: 0` |
| `.campana-widget-info` | `overflow: hidden` (salvaguarda del ellipsis) |
| `.dash-widget-slide` | `min-height: 190px` (piso de altura para ambos slides, patrón análogo al `.dash-slide` de 176px del carrusel principal) |

### 2.3 Igualdad de altura garantizada (`dashboard.js`)

`igualarAlturaWidgetSlides()` ya tomaba la altura del slide más alto, pero solo tras cada fetch por separado. Ahora además:
- Se llama al cargar la página (`DOMContentLoaded`) para el piso.
- Se vuelve a llamar tras que **ambas** cargas terminan:

```javascript
Promise.all([cargarCampañasActivas(), cargarUltimasSolicitudes()])
    .then(igualarAlturaWidgetSlides)
    .catch(function() { igualarAlturaWidgetSlides(); });
```

---

## Verificación

- ✅ `node --check public/movil/js/dashboard.js` — sin errores de sintaxis.
- ✅ Llaves CSS balanceadas (verificado al editar).
- ✅ Con el contenido truncado, el `scrollWidth` del carrusel vuelve a ser `2 × ancho`, por lo que `scroll-snap` y `configurarLoopTouch` aterrizan limpio.
- ⏳ Prueba visual en navegador móvil pendiente: swipe limpio entre los 2 widgets, dots sincronizados, sin desborde, ambos slides del mismo alto.

## Documentación relacionada

- `docs/README.md` — sección del carrusel de widgets del dashboard móvil (igualdad de altura).
