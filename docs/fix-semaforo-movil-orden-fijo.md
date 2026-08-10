# Fix: Semáforo móvil con orden fijo (Sin clasificar · Seguimiento · Encaminadas · En espera)

**Fecha:** Agosto 2026
**Ámbito:** `public/movil/js/gestion-lote.js`, `public/movil/css/gestion-lote.css`
**Solicitud:** Los botones del semáforo móvil deben quedar siempre en el orden acordado
**Sin clasificar · Seguimiento · Encaminadas · En espera**; aunque el orden estaba bien en el
HTML, en pantalla aparecían reordenados.

---

## 1. Resumen

El orden estático del HTML (`public/movil/gestion-lote.html`) ya era correcto:
`sin_clasificar → amarillo → verde → rojo`. Sin embargo, `actualizarSemaforoMovil()`
llamaba a `reordenarCarruselSemaforoMovil(conteo)`, que en **tiempo de ejecución** movía al
frente la tarjeta del estado prioritario (amarillo primero, luego sin clasificar, verde y rojo
según `PRIORIDAD_SEMAFORO_MOVIL`). Por eso, con seguimientos pendientes, los botones se veían
como **Seguimiento · Sin clasificar · Encaminadas · En espera**, ignorando el orden fijo.

Este reordenamiento existía desde `9799a85` y anulaba visualmente el cambio de orden hecho en
`330e4ac`.

---

## 2. Cambios

### 2.1 JS (`public/movil/js/gestion-lote.js`)

- Se eliminó la llamada `reordenarCarruselSemaforoMovil(conteo);` dentro de
  `actualizarSemaforoMovil()`.
- Se eliminaron las funciones ahora huérfanas:
  - `prioridadSemaforoMovil(conteo)`
  - `reordenarCarruselSemaforoMovil(conteo)`

Con esto el DOM del carrusel conserva el orden del HTML y **nunca** se reordena. Las tarjetas
siguen actualizando su conteo (`count-mobile-*`), el estado activo (`.active`) y el estado
vacío (`.is-empty`) sin cambios.

### 2.2 CSS (`public/movil/css/gestion-lote.css`)

- Se eliminó la regla muerta `.semaforo-mobile-carousel .semaforo-mobile-card.is-priority`
  (ya nadie asigna la clase `is-priority`).

---

## 3. Qué NO cambió (no se rompe nada)

| Elemento | Estado |
|----------|--------|
| `setFiltroSemaforoMovil(valor)` | Sin cambios (filtro, highlight y re-render intactos) |
| `obtenerConteoSemaforoMovil()` | Sin cambios |
| `SEMAFORO_MOVIL` (orden de iteración de conteos) | Sin cambios |
| FLIP / `bump` de la tarjeta destino al cambiar semáforo (línea ~719) | Sin cambios |
| Sticky del semáforo (`#semaforo-mobile` sticky, top ajustado por JS) | Sin cambios |
| Orden de la **lista** de solicitudes por prioridad (D3/M3) | Sin cambios (feature separada) |
| Auto-scroll al estado prioritario | Se elimina (formaba parte del reordenamiento) |

El único comportamiento eliminado es el reordenamiento del carrusel y su auto-scroll.

---

## 4. Orden resultante

```
1. Sin clasificar
2. Seguimiento
3. Encaminadas
4. En espera
```

Fijo, sin importar los conteos de cada estado.

---

## Verificación

- ✅ `node --check public/movil/js/gestion-lote.js` — sin errores de sintaxis.
- ✅ `grep` de `reordenarCarruselSemaforoMovil|prioridadSemaforoMovil|is-priority` en
  `public/movil/` — sin resultados.
- ⏳ Prueba visual en navegador móvil: abrir una campaña con conteos variados y confirmar el
  orden fijo y el filtro al tocar cada botón.

## Documentación relacionada

- `docs/README.md` — estructura del proyecto (§11.5 Gestión por Lotes, §12.6 Campañas v2).
- `docs/feature-historial-campana.md` — botón "🕘 Últimas gestiones" (historial de campaña).
- `docs/feature-rediseño-semaforo-campañas.md` — diseño del indicador de estado.
- `README.md` — tabla de Features Recientes.
