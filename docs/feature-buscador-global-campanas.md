# Feature: Búsqueda global de solicitudes en todas las campañas (landing)

**Fecha:** Agosto 2026
**Ámbito:**
- `public/desktop/gestion-lote.html`, `public/desktop/js/gestion-lote.js`, `public/css/gestion-lote.css`
- `public/movil/gestion-lote.html`, `public/movil/js/gestion-lote.js`, `public/movil/css/gestion-lote.css`
**Solicitud:** En la página de Campañas (modo landing, sin `?id=`), una barra de búsqueda que
encuentre una **solicitud en todas las campañas**; al hacer clic en el resultado se entra a la
campaña "con todo lo que implica" y se salta a la tarjeta de la solicitud.

---

## 1. Resumen

Se agregó una **barra de búsqueda global** al landing de Campañas (móvil y escritorio):

1. Al escribir (≥ 2 caracteres, con debounce de 280 ms) se consulta
   `GET /api/excel/solicitudes/buscar?q=...&limite=50`, que **ya existía** y devuelve cada
   solicitud con `campana_id` y `nombre_campana` (LEFT JOIN con `gestiones_maestro`).
2. El cliente filtra los resultados a las solicitudes que **pertenecen a una campaña**
   (`campana_id` presente) y las muestra en un dropdown: nombre, cédula, teléfono y un chip
   con la campaña `📢 <nombre>`.
3. Al hacer clic se navega a `?id=<campaña>&card=<solicitud>`:
   - **Móvil** ya procesaba el parámetro `?card=` (salta a la tarjeta y la resalta).
   - **Escritorio no lo procesaba**: se agregó en `init()` (mismo patrón que móvil:
     `navegarACardDesktop(card)` tras 300 ms + limpieza del parámetro con
     `history.replaceState` para que recargar no vuelva a saltar). Esto además arregla los
     links `?card=` que ya generaba el calendario de recordatorios en escritorio.

No hubo cambios de backend: se reutiliza el endpoint existente.

---

## 2. Detalle de la implementación

### 2.1 HTML

Bloque nuevo (idéntico en móvil y escritorio, visible solo en modo landing):

```html
<div class="campanas-buscador-global" id="campanas-buscador-global" style="display:none;">
    <div class="campanas-buscador-field">
        <span class="campanas-buscador-icon" aria-hidden="true">🔍</span>
        <input type="search" id="campanas-buscador-input" placeholder="Buscar solicitud en todas las campañas…" autocomplete="off" enterkeyhint="search" aria-label="Buscar solicitud en todas las campañas">
        <button type="button" class="campanas-buscador-clear" id="campanas-buscador-clear" onclick="limpiarBusquedaGlobalCampanas()" aria-label="Limpiar búsqueda" hidden>✕</button>
    </div>
    <div class="campanas-buscador-results" id="campanas-buscador-results" hidden></div>
</div>
```

- Escritorio: dentro de `#campana-main`, antes de `#filtros-row`.
- Móvil: antes de `#lista-solicitudes`.

### 2.2 JS (mismo código en `public/desktop/js/gestion-lote.js` y `public/movil/js/gestion-lote.js`)

| Función | Rol |
|---------|-----|
| `initBuscadorGlobalCampanas()` | Bind de eventos una sola vez (`_buscadorGlobalInit`); cierra el dropdown al hacer clic fuera; `Escape` limpia |
| `onInputBusquedaGlobalCampanas()` | Debounce 280 ms; muestra el ✕; mínimo 2 caracteres |
| `buscarGlobalCampanas(q)` | Fetch a `/api/excel/solicitudes/buscar` con `AbortController` (cancela la búsqueda anterior); estados de carga/error |
| `renderResultadosBusquedaGlobal(lista)` | Filtra por `campana_id`, pinta el dropdown (count + tarjetas) |
| `irACampanaDesdeBusqueda(campanaId, solicitudId)` | Navega a `?id=&card=` (base `/gestion-lote` u `/m/gestion-lote` según `pathname`) |
| `resetBusquedaGlobalCampanas()` / `limpiarBusquedaGlobalCampanas()` | Limpian input + resultados (+ foco para el botón ✕) |

**Mostrar/ocultar según modo:**
- `renderizarGridCampanasLanding()` / `renderizarGridCampanasLandingMovil()` → `display: block` + init + reset.
- `cargarDatosGestion()` / `cargarDatosGestionMovil()` → `display: none` + reset (al entrar a una campaña).

### 2.3 Deep link `?card=` en escritorio (nuevo)

En `init()` (desktop), tras `cargarDatosGestion()`:

```js
var urlParamsDL = new URLSearchParams(window.location.search);
var cardTarget = urlParamsDL.get('card');
if (cardTarget) {
    setTimeout(function() { navegarACardDesktop(cardTarget); }, 300);
    urlParamsDL.delete('card'); // recargar no vuelve a saltar
    history.replaceState(null, '', window.location.pathname + (urlParamsDL.toString() ? '?' + urlParamsDL.toString() : ''));
}
```

`navegarACardDesktop` reutiliza el flujo del historial: limpia filtros, re-renderiza, hace
`scrollIntoView` centrado y aplica el destello `.sol-semaforo-flash` (maneja también tarjetas
en la sección de completadas).

### 2.4 CSS

| Archivo | Estilos |
|---------|---------|
| `public/css/gestion-lote.css` | `.campanas-buscador-global`, `.campanas-buscador-field`, `.campanas-buscador-icon`, `.campanas-buscador-clear`, `.campanas-buscador-results` (dropdown absoluto, max-height 420px), `.campanas-buscar-resultado` (hover `#f5f3ff`), `.campanas-buscar-resultado-campana` (chip índigo), `.campanas-buscador-state`, `.campanas-buscador-error` |
| `public/movil/css/gestion-lote.css` | Igual pero compacto: input 16px (evita zoom iOS), resultados max-height 60vh |

---

## 3. Qué NO cambió

| Elemento | Estado |
|----------|--------|
| Backend / API (`buscarSolicitudes` ya existía y devolvía `campana_id` + `nombre_campana`) | Sin cambios |
| Búsqueda dentro de una campaña abierta (`#busqueda` + `filtro-estado` del semáforo) | Sin cambios |
| Landing grid de campañas | Sin cambios |
| Deep link `?card=` en móvil | Ya existía, sin cambios |
| Historial / calendario (generan `?card=`) | Sin cambios (desktop ahora funciona) |

---

## 4. Alcance y limitación conocida

La búsqueda reutiliza el alcance de `/api/excel/solicitudes/buscar` (solo solicitudes del
usuario autenticado, `s.usuario_id = $1`). Una solicitud de otro agente que esté dentro de una
campaña compartida del equipo **no** aparecería en esta búsqueda v1; el deep link sí funciona
porque la campaña carga todas sus solicitudes.

---

## Verificación

- ✅ `node --check` en `public/desktop/js/gestion-lote.js` y `public/movil/js/gestion-lote.js`.
- ⏳ Prueba visual: entrar a Campañas sin `?id=` → barra visible; buscar cédula/nombre →
  dropdown con la campaña; clic → campaña abierta con la tarjeta centrada y con destello;
  al recargar ya no se salta (parámetro `card` limpio).

## Documentación relacionada

- `docs/feature-grid-campanas-landing.md` — landing de campañas (grid + selector hero).
- `docs/feature-buscador-inline-campanas-movil.md` — búsqueda dentro de campaña (móvil).
- `docs/feature-calendario-recordatorios.md` — genera links `?card=` (desktop ahora soportados).
- `README.md` — tabla de Features Recientes.
