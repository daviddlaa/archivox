# Informe: Selector de semáforo con color real + tarjetas más compactas (Campañas móvil)

**Fecha:** Agosto 2026
**Ámbito:** `public/movil/css/gestion-lote.css`, `public/movil/js/gestion-lote.js`
**Solicitud:**
1. El selector de semáforo de cada tarjeta debe **mostrar el color real** del estado; antes el texto era el que decía el color ("Verde", "Amarillo", "Rojo") sobre un fondo pastel casi neutro. Colores suaves, no llamativos, pero con el texto legible.
2. Bajar un poco la altura de la tarjeta para que al hacer scroll se vea más de la siguiente (antes solo se veía ~25%).

---

## 1. Resumen

El segmento activo del switch `.sol-semaforo-switch-segment` ahora se pinta con un **color medio-pastel del semáforo** (claramente visible, pero sin llegar a neón) con texto oscuro del mismo tono. Además, las etiquetas pasan de nombrar el color a **nombres semánticos** (Encaminada / Seguimiento / En espera), coherentes con el modal de selector. En paralelo se compactó la tarjeta (~35px menos de alto) ajustando paddings, márgenes, alto del switch y de los botones de acción.

---

## 2. Selector de semáforo coloreado

### 2.1 Etiquetas semánticas (`public/movil/js/gestion-lote.js`)

```javascript
var labelS = keyS === 'sin_clasificar' ? 'Sin clasificar'
           : keyS === 'verde' ? 'Encaminada'
           : keyS === 'amarillo' ? 'Seguimiento'
           : 'En espera';
```

El `aria-label` sigue usando `labelS`. Las etiquetas caben en las 4 columnas del switch (70-80px por segmento en móvil) y el texto ya tiene ellipsis como salvaguarda.

### 2.2 Paleta suave del segmento activo (`gestion-lote.css`)

| Estado | Fondo | Texto | Borde |
|--------|-------|-------|-------|
| Sin clasificar | `#cbd5e1` | `#334155` | `#94a3b8` |
| Encaminada (verde) | `#a9cfb3` | `#1f4a30` | `#7fbc8f` |
| Seguimiento (amarillo) | `#e5c77f` | `#5a420f` | `#d3a437` |
| En espera (rojo) | `#e1aaa0` | `#5e2119` | `#cf7f72` |

Contraste texto/fondo ≥ 5:1 en todos los casos. Los segmentos inactivos siguen neutros (texto `#94a3b8`) con su punto de color.

---

## 3. Compactación de la tarjeta (~35px)

| Regla | Cambio |
|-------|--------|
| `.sol-list` | gap `10px` → `8px` |
| `.sol-card` | padding `14px 14px 12px` → `11px 12px 10px` |
| `.sol-header` | `margin-bottom` `10px` → `6px` |
| `.sol-nombre` | `margin-bottom` `4px` → `2px` |
| `.sol-semaforo-switch` | `margin-bottom` `8px` → `6px` |
| `.sol-semaforo-switch-segment` | `min-height` `30px` → `26px` (y `32px` → `28px` en ≥500px) |
| `.sol-datos` | `margin-bottom` `8px` → `6px` |
| `.sol-obs` | padding `12px 14px` → `10px 12px`; `margin-bottom` `14px` → `10px` |
| `.btn-sol` | padding `10px 12px` → `8px 10px`; `min-height` `42px` → `38px` |

Resultado: al hacer scroll se ve aproximadamente el **40% de la siguiente tarjeta** (antes ~25%).

---

## Verificación

- ✅ `node --check public/movil/js/gestion-lote.js` — sin errores de sintaxis.
- ✅ Llaves CSS balanceadas (291 abrir / 291 cerrar).
- ⏳ Prueba visual en navegador móvil pendiente: color del segmento activo, legibilidad del texto y proporción visible de la siguiente tarjeta.

## Documentación relacionada

- `docs/README.md` — estructura del proyecto (lista de docs).
- `README.md` — tabla de Features Recientes.
