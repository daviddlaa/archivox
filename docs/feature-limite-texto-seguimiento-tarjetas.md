# Feature: Límite de líneas del texto de seguimiento en tarjetas de campaña

**Fecha:** Agosto 2026
**Ámbito:** `public/css/gestion-lote.css`, `public/movil/css/gestion-lote.css`,
`public/movil/js/gestion-lote.js`
**Solicitud:** En las tarjetas que renderizan solicitudes dentro de una campaña
(`gestion-lote`), limitar el texto de seguimiento (última gestión / observación) a
**2 líneas en móvil** y **4 líneas en escritorio**, para que las tarjetas tengan altura
uniforme y coherencia visual. Se evaluó si convenía prescindir del texto; se decidió
**conservarlo limitado**, porque es el contexto que permite decidir la siguiente acción.

---

## 1. Resumen

Se aplicó `-webkit-line-clamp` al bloque de texto de seguimiento de las tarjetas de
solicitud dentro de una campaña:

| Plataforma | Selector | Límite | Interacción |
|------------|----------|--------|-------------|
| **Móvil** | `.sol-obs` (observación de la última gestión) | **2 líneas** | Tocar el texto lo expande/contrae (texto completo) |
| **Escritorio** | `.sol-ultima-gestion-obs` (dentro del bloque "Última gestión") | **4 líneas** | El bloque completo ya abre "Ver gestión" (detalle completo) |

Resultado: las tarjetas ya no crecen según la longitud de la observación; la lista se
vuelve uniforme y escaneable, sin perder acceso al texto completo.

---

## 2. Detalle de la implementación

### 2.1 Móvil — 2 líneas + tap para expandir

**CSS** (`public/movil/css/gestion-lote.css`):

```css
.sol-obs {
    /* ...estilos previos... */
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    cursor: pointer;
}

/* Texto de seguimiento expandido al tocar (móvil) */
.sol-obs.expandido {
    -webkit-line-clamp: unset;
    display: block;
}
```

**JS** (`public/movil/js/gestion-lote.js`):

- El `<div class="sol-obs">` ahora se renderiza con `onclick="toggleObsMovil(this)"`,
  `title="Toca para ver el texto completo"` y `aria-expanded="false"`.
- Nueva función:

```js
function toggleObsMovil(el) {
    if (!el) return;
    var expandido = el.classList.toggle('expandido');
    el.setAttribute('aria-expanded', String(expandido));
}
```

Notas:
- La tarjeta móvil no tiene `onclick` propio, por lo que el tap en `.sol-obs` no interfiere
  con ninguna otra acción (no requiere `stopPropagation`).
- Al expandirse (`display: block` + `-webkit-line-clamp: unset`), el `overflow: hidden`
  heredado de la regla base no recorta porque la altura crece con el contenido.

### 2.2 Escritorio — 4 líneas

**CSS** (`public/css/gestion-lote.css`):

```css
.sol-ultima-gestion-obs {
    color: #64748b;
    font-size: 12px;
    line-height: 1.4;
    /* Límite de 4 líneas: tarjetas uniformes; el bloque abre "Ver gestión" con el detalle completo */
    display: -webkit-box;
    -webkit-line-clamp: 4;
    -webkit-box-orient: vertical;
    overflow: hidden;
}
```

No hubo cambios en JS de escritorio: el bloque `.sol-ultima-gestion` ya es un `<button>`
que abre el modal "Ver gestión" con la observación completa.

---

## 3. Qué NO cambió

| Elemento | Estado |
|----------|--------|
| Estructura de la tarjeta (badges, semáforo, datos, acciones) | Sin cambios |
| Badges del header (destacado, segmento, ⏱️ tiempo sin seguimiento, recordatorio, no aplica) | Sin cambios |
| Botones de acción (Seguimiento / Directo / Historial / Recordatorio / Quitar / No aplica) | Sin cambios |
| Bloque "Última gestión" de escritorio (sigue siendo clickeable → "Ver gestión") | Sin cambios |
| API `/api/gestiones-maestro/:id` | Sin cambios |
| `node --check` en `public/movil/js/gestion-lote.js` | ✅ Pasa |

---

## 4. Evaluación descartada: prescindir del texto de seguimiento

Se consideró eliminar el texto de seguimiento de las tarjetas (dejándolo solo en el modal
"Ver gestión"). Se descartó porque:

- El texto de la última gestión es el **contexto operativo** que explica por qué una
  solicitud está en amarillo/rojo y qué conviene hacer a continuación.
- El `line-clamp` resuelve la incoherencia visual (alturas desiguales) **sin perder**
  información: en móvil se expande al tocar y en escritorio se abre el detalle completo.
- Quedó documentada como alternativa futura si se quiere compactar aún más la tarjeta.

---

## Verificación

- ✅ `node --check` en `public/movil/js/gestion-lote.js`.
- ✅ Revisión de código: sin conflictos de eventos, sin código muerto; la clase
  `.expandido` no requiere re-declarar `overflow`.
- ⏳ Prueba visual: abrir una campaña con observaciones largas y confirmar que móvil
  muestra 2 líneas (expandible al tocar) y escritorio 4 líneas (bloque abre "Ver gestión").

## Documentación relacionada

- `docs/README.md` — estructura del proyecto (§12.6 Campañas v2).
- `docs/feature-prioridad-tiempo-sin-seguimiento.md` — badge ⏱️ y orden por tiempo sin
  seguimiento (misma vista `gestion-lote`).
- `docs/feature-guia-clasificacion-campanas.md` — guía didáctica de clasificación.
- `README.md` — tabla de Features Recientes.
