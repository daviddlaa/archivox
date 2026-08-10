# 🎨 Feature: Rediseño del Indicador de Estado (Semáforo) de Campañas

**Versión:** 6.1
**Fecha:** Agosto 2026
**Estado:** Implementado ✅

---

## 📋 Resumen

Rediseño completo del panel de estado visual (semáforo) utilizado en las campañas de gestión por lotes (**desktop**). El componente evolucionó desde bloques industriales hasta un conjunto de **tarjetas estadísticas premium compactas** completamente pintadas con tonos suaves, inspirado en Apple Wallet, Apple Reminders, Notion, Linear y Arc Browser.

**V6 (Actual):** Tarjetas compactas por estado (~30% más pequeñas que V5), colores mejor diferenciados y **paletas CSS totalmente desacopladas** del componente de solicitudes (modificable sin efectos colaterales).

**V6.1:** El **móvil** incorpora el mismo selector segmentado de semáforo dentro de cada tarjeta de solicitud (switch inline con dot + texto), reemplazando el modal de selección anterior. La lista móvil se reordena por prioridad (amarillo → sin clasificar → verde → rojo); el carrusel del semáforo conserva el **orden fijo** Sin clasificar · Seguimiento · Encaminadas · En espera (el reordenamiento automático por prioridad se eliminó en `docs/fix-semaforo-movil-orden-fijo.md`).

---

## 🎯 Historia del Diseño

| Versión | Descripción | Problemas |
|---------|-------------|-----------|
| **Original** | Border-left industrial de 5px, colores saturados, chips grandes | Rompía la armonía visual, parecía alerta permanente |
| **V2** | Banda horizontal 4px en la parte superior de la tarjeta | Banda decorativa, colores aún saturados |
| **V3** | Gradiente sutil + bloques horizontales con dot y número + chips integrados | El panel seguía pareciendo un bloque administrativo |
| **V4** | Colores vivos de semáforo real + banda superior de 8px | Colores saturados, banda y puntos sobraban |
| **V5** | Tarjetas premium pintadas con tonos suaves | Tarjetas demasiado grandes; rojo y amarillo poco diferenciados; paleta compartida con las solicitudes (efectos colaterales) |
| **V6 (Actual)** | Tarjetas compactas, colores diferenciados, paletas desacopladas | — |

---

## ✅ Solución Implementada (V6)

### 1. Encabezado Eliminado

Se eliminó completamente:

- ❌ El label **"Semáforo de la campaña"**
- ❌ El contador **"Total: XX"**

El usuario entiende el contexto por la propia pantalla. El contador total se conserva **oculto** en el DOM (`#total-solicitudes`, `display:none`) para no romper el JS existente.

### 2. Tarjetas Completamente Pintadas (sin banda) y Desacopladas

Se eliminó la **banda superior de color** (`::before`). Cada tarjeta está **completamente pintada** con tonos suaves y elegantes (no saturados), con **identidad clara por estado**:

| Estado | Fondo (surface) | Texto | Acento (borde activo) | Nombre del tono |
|--------|-----------------|-------|------------------------|-----------------|
| Sin clasificar | `#eceff3` | `#4b5563` | `#94a3b8` | Gris neutro |
| Verde | `#d8e9de` | `#2f6b45` | `#6b9e78` | Verde salvia |
| Amarillo | `#f6e7c4` | `#7c5a22` | `#d3a437` | Ámbar dorado |
| Rojo | `#f2d2cc` | `#a03d35` | `#cf6657` | Coral / terracota |

**Diferenciación corregida:** En V5 el rojo se confundía con un amarillo oscuro. En V6 el amarillo es **dorado-crema** (`#f6e7c4`) y el rojo es **coral/terracota rosado** (`#f2d2cc`); ambos acentos (`#d3a437` vs `#cf6657`) y textos (`#7c5a22` vs `#a03d35`) también se distinguen claramente.

### 3. Paletas CSS Desacopladas (sin efectos colaterales)

**Problema detectado en V5:** el panel y las tarjetas de solicitud compartían las mismas variables `--sem-*`, por lo que modificar los colores del panel alteraba también las solicitudes.

**Solución V6:** dos paletas independientes en `:root` de `gestion-lote.css`:

| Paleta | Variables | Uso | Al cambiar... |
|--------|-----------|-----|---------------|
| **Panel del semáforo** | `--sem-panel-*` (`-surface`, `-text`, acento, `-bg`) | `.semaforo-panel-*` (tarjetas del panel), `.semaforo-fly` | No afecta a las solicitudes |
| **Solicitudes** | `--sem-sol-*` (`-surface`, `-text`, acento, `-bg`) | `.sol-card.sol-semaforo-*` (gradientes), `.sol-semaforo-pill*` (pills) | No afecta al panel |

Reglas CSS exclusivas por componente (sin selectores compartidos entre ambos):

- **Panel:** `.semaforo-panel-card`, `.semaforo-panel-{sin,verde,amarillo,rojo}`, `.semaforo-panel-label`
- **Solicitudes:** `.sol-semaforo-*`, `.sol-semaforo-pill*` (sin cambios visuales respecto a V5)

### 4. Diseño Interno de las Tarjetas (compactas)

Cada estado se ve como una **tarjeta rectangular con esquinas redondeadas** (12px), ~30% más pequeña que en V5 (sin perder legibilidad):

```
┌───────────────┐
│               │
│      63       │  ← Número protagonista (30px, centrado)
│               │
│ Sin clasificar│  ← Etiqueta debajo (11px)
└───────────────┘
```

**Reglas:**
- ✅ El número va **arriba** y es el protagonista visual
- ✅ Centrado horizontal y verticalmente (flex column)
- ✅ El texto va **debajo** (con `white-space: nowrap` para no partirse)
- ✅ Sin puntos de color al lado del texto
- ✅ Sin líneas decorativas
- ✅ Espaciado equilibrado (`gap: 6px`)

```css
.semaforo-panel-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 6px;
    border: 1.5px solid transparent;
    border-radius: 12px;
    padding: 16px 12px 14px;
    min-height: 88px;
    text-align: center;
    user-select: none;
}
```

### 5. Cuadrícula Uniforme

Las cuatro tarjetas comparten **exactamente** el mismo tamaño:

- Mismo ancho (`grid-template-columns: repeat(4, 1fr)`)
- Misma altura (`min-height: 88px` — se iguala por la cuadrícula)
- Mismo radio de borde (`12px`)
- Mismo padding (`16px 12px 14px`)
- Misma separación (`gap: 10px`)

```css
.semaforo-barra {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 10px;
    width: 100%;
}
```

### 6. Interacción

Las tarjetas **siguen siendo botones de filtro** (sin cambios de JS).

| Estado | Efecto |
|--------|--------|
| **Hover** | Elevación ligera `translateY(-2px)` + sombra muy suave `0 6px 14px rgba(15,23,42,.08)` |
| **Seleccionado** (`.active`) | Borde más marcado del color del estado + pequeña elevación `translateY(-1px)` + sombra |
| **Vacío** (`.is-empty`) | Opacidad `0.45` |
| **Foco** (`:focus-visible`) | Outline del color primario (accesibilidad) |

Transiciones fluidas de `0.2s` — sin animaciones exageradas.

### 7. Botón "Ver todas"

El botón `#btn-semaforo-todos` ("Ver todas") se reubicó **debajo de las tarjetas**, centrado, y solo es visible cuando hay un filtro activo (lo controla el JS existente vía `display: inline-flex`).

### 8. Elementos Eliminados

Se eliminó toda decoración que ya no aportaba valor:

- ❌ Banda superior de color (`::before`)
- ❌ Puntos de color (`semaforo-seg-dot`)
- ❌ Leyenda inferior (`.semaforo-legend`)
- ❌ Encabezado con label y total
- ❌ Estilos heredados que no aplicaban
- ❌ Variables `--sem-*` compartidas con las solicitudes (reemplazadas por `--sem-panel-*` / `--sem-sol-*`)

### 9. Coherencia Visual Mantenida

- Ambos componentes (panel y solicitudes) comparten la **misma filosofía de diseño** (tonos suaves, bordes redondeados, sombras sutiles).
- Las **tarjetas de solicitud** (`.sol-card.sol-semaforo-*`) conservan su degradado suave original (paleta `--sem-sol-*`), **sin verse afectadas** por cambios en el panel.
- Los **pills** (`.sol-semaforo-pill`) usan la paleta `--sem-sol-*`.
- Las **partículas voladoras** (`.semaforo-fly`) usan la paleta `--sem-panel-*`.

---

## 📁 Archivos Modificados (V6 / V6.1)

| Archivo | Cambios |
|---------|---------|
| `public/css/gestion-lote.css` | Dos paletas desacopladas (`--sem-panel-*` / `--sem-sol-*`), tarjetas compactas `.semaforo-panel-*`, colores diferenciados, `user-select: none` |
| `public/desktop/gestion-lote.html` | Clases exclusivas del panel (`semaforo-panel-card`, `semaforo-panel-{sin,verde,amarillo,rojo}`, `semaforo-panel-label`) manteniendo los hooks del JS |
| `public/movil/js/gestion-lote.js` | **V6.1:** switch segmentado `.sol-semaforo-switch` en cada tarjeta y `cambiarSemaforoSolicitudMovil` (cambio in-place) |
| `public/movil/css/gestion-lote.css` | **V6.1:** estilos del switch móvil, flash de tarjeta, responsive ≥500px |

> **Nota:** En la implementación original de V6 el JS (`public/desktop/js/gestion-lote.js`) no fue modificado. En la versión actual los mismos ids y clases se conservan intactos (`#count-*`, `.semaforo-seg[data-semaforo]`, `#btn-semaforo-todos`, `#total-solicitudes`, `.semaforo-seg-count`, animaciones `bump`/`bump-num`, `.semaforo-fly.{estado}`), y el JS añade la recomendación de prioridad, el progreso visible y la actividad contextual. `.semaforo-seg` queda como **hook exclusivo del JS** (sin reglas CSS propias).

---

## ♿ Accesibilidad

| Criterio | Implementación |
|----------|----------------|
| **Contraste** | Texto oscuro (`-text`) sobre fondos suaves con excelente legibilidad |
| **Roles ARIA** | `role="group"` y `aria-label` en la barra de tarjetas |
| **Tooltips** | Todas las tarjetas tienen `title` |
| **No solo color** | Número + etiqueta + fondo proporcionan información redundante |
| **Foco visible** | `:focus-visible` con outline del color primario |
| **Selección** | `user-select: none` evita seleccionar texto al hacer clic rápido |

---

## 🧪 Testing Recomendado

1. **Visual:** Verificar que las 4 tarjetas se ven uniformes, compactas y con colores claramente diferenciados (ámbar dorado vs coral)
2. **Desacoplamiento:** Cambiar un color `--sem-panel-*` y verificar que las tarjetas de solicitud NO cambian; al revés con `--sem-sol-*`
3. **Interacción:** Hover (elevación) y selección (borde marcado) en cada tarjeta
4. **Filtrado:** Clic en tarjeta filtra; "Ver todas" aparece debajo y limpia el filtro
5. **Responsive:** En pantallas <768px las tarjetas pasan a 2 columnas (número 26px)
6. **Accesibilidad:** Navegar con teclado y verificar tooltips
7. **Sin regresión JS:** Cambiar semáforo desde una tarjeta de solicitud (fly particle + bump + conteos)

---

## 📊 Comparación Visual

### V5 (tarjetas grandes, colores poco diferenciados)
```
┌─────────────────┬─────────────────┬─────────────────┬─────────────────┐
│                 │                 │                 │                 │
│       63        │       0         │       1         │       1         │  ← Número 42px
│                 │                 │                 │                 │
│  Sin clasificar │      Verde      │    Amarillo     │      Rojo       │
└─────────────────┴─────────────────┴─────────────────┴─────────────────┘
    (gris claro)     (sage)         (ámbar suave)   (rojo coral — se     │
                                                       confundía con el   │
                                                       amarillo)          │
```

### V6 (actual — tarjetas compactas, paletas desacopladas)
```
┌───────────────┬───────────────┬───────────────┬───────────────┐
│               │               │               │               │
│      63       │      0        │      1        │      1        │  ← Número 30px
│               │               │               │               │
│ Sin clasificar│    Verde      │   Amarillo    │     Rojo      │  ← Etiqueta 11px
└───────────────┴───────────────┴───────────────┴───────────────┘
    (gris neutro)   (sage)      (ámbar dorado)   (coral)  ← distinguibles
```

---

## 🔗 Relacionado

- **Módulo:** Gestión por Lotes (`/gestion-lote`) — Desktop
- **Controlador:** `gestionesMaestro.controller.js`
- **API:** `PUT /api/gestiones-maestro/:id/solicitudes/:solicitud_id/semaforo`

---

## 📝 Notas para Desarrolladores

1. **Variables CSS:** Dos paletas en `:root` de `gestion-lote.css` — `--sem-panel-*` (panel) y `--sem-sol-*` (solicitudes). **No las mezcles.**
2. **Clases CSS del panel:** `.semaforo-barra`, `.semaforo-panel-card`, `.semaforo-panel-label`, `.semaforo-clear`
3. **Clases por estado del panel:** `.semaforo-panel-sin`, `.semaforo-panel-verde`, `.semaforo-panel-amarillo`, `.semaforo-panel-rojo`
4. **Hooks del JS (no eliminar):** `.semaforo-seg` (en cada botón, junto a `semaforo-panel-card`), `.semaforo-seg-count` (span del número, estilado por CSS), `data-semaforo`, `#count-*`, `#btn-semaforo-todos`, `#total-solicitudes`
5. **Selección:** `.semaforo-panel-card.active` (border del color) e `.is-empty` (opacidad) los gestiona el JS existente
6. **Animaciones:** `.semaforo-panel-card.bump` (escala de tarjeta) y `.semaforo-seg-count.bump-num` (pop del número) las dispara el JS
7. **Responsive:** En pantallas <768px, las tarjetas pasan a 2 columnas (padding 14px 10px 12px, min-height 76px, número 26px, etiqueta 10px)
8. **Mobile (V6.1):** El móvil no usa el panel de tarjetas del desktop, pero cada `.sol-card` incluye un **switch segmentado** `.sol-semaforo-switch` (mismo markup y paleta que desktop, adaptado a touch):

   - CSS en `public/movil/css/gestion-lote.css` (`.sol-semaforo-switch`, `.sol-semaforo-switch-segment`, `.sol-semaforo-switch-dot`, `.sol-semaforo-switch-text`).
   - Grid de 4 columnas (`repeat(4, minmax(0,1fr))`), segmentos `min-height: 30px`, texto a `8px`; en pantallas ≥500px sube a `32px` / `9px`.
   - Orden `SEMAFORO_MOVIL`: `['sin_clasificar', 'verde', 'amarillo', 'rojo']` (misma que desktop).
   - Cambio en el lugar vía `cambiarSemaforoSolicitudMovil(id, semaforo, event)` con `stopPropagation()`, actualización in-place y flash `.sol-semaforo-flash-movil`.
   - El modal legacy `abrirSelectorSemaforoMovil` queda como código muerto por compatibilidad.
