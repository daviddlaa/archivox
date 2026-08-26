# 📋 Feature: Rediseño Escritorio Campañas — Hero Compacto + Tarjetas + Menú ⋯

**Estado:** ✅ Implementada  
**Fecha:** 26/08/2026  
**Ambito:** Desktop — Página de Gestión por Lotes (Campañas)

---

## Descripción

Rediseño completo de la página de gestión por lotes en escritorio:
1. **Hero compacto de una sola fila** — nunca cambia de tamaño
2. **Búsqueda integrada en el hero** — input inline en el header
3. **Tarjetas de solicitud compactas** — menos padding y espacios
4. **Menú ⋯ de acciones secundarias** — dropdown en lugar de botones sueltos

---

## 1. Hero Compacto (Una Fila)

### Antes
- Hero apilado verticalmente: título + badge + estado + KPI strip (3 textos + barra) + última actividad (bloque de 76px)
- Al seleccionar campaña el hero crecía ~120px
- Búsqueda separada como bloque full-width debajo del hero

### Después
```
┌──────────────────────────────────────────────────────────────────────┐
│ 🚀 Campañas  │  Devueltos  🤖 Sistema  En curso  │  47% · 9/19 ·   │
│              │                                  │  10 pendientes    │
│              │                                  │  ████████░░  ⏸️   │
├──────────────────────────────────────────────────────────────────────┤
│ 📝 Seguimiento registrada en la campaña · Hace 18 días              │
└──────────────────────────────────────────────────────────────────────┘
```

- **Fila principal (`.hero-row`):** título + KPIs + búsqueda + botones — todo en una línea
- **Fila de actividad (`.hero-activity`):** línea sutil debajo del hero, solo visible con campaña seleccionada
- **El hero nunca cambia de tamaño** — en landing muestra "Selecciona una campaña", al seleccionar misma altura

### Estructura HTML

```html
<div class="page-header page-header-campana">
  <div class="hero-row">
    <div class="hero-left">          <!-- Título + badge -->
    <div class="hero-center">        <!-- KPIs inline -->
    <div class="hero-right">         <!-- Búsqueda + botones -->
  </div>
  <div class="hero-activity">        <!-- Actividad sutil -->
  </div>
</div>
```

### Búsqueda Integrada

- Input de 200px en el hero-right (se expande a 280px al enfocar)
- Solo visible cuando hay campaña seleccionada
- Botón ✕ para limpiar
- En landing se oculta (no hay nada que buscar)

---

## 2. Compactación de Tarjetas

| Elemento | Antes | Después |
|----------|-------|---------|
| Padding tarjeta | `14px 16px` | `10px 12px` |
| Gap del grid | `16px` | `12px` |
| Margen inferior header | `10px` | `6px` |
| Margen inferior info | `10px` | `6px` |
| Tamaño nombre | `15px` | `14px` |
| Tamaño datos | `13px` | `12px` |
| Padding última gestión | `12px 13px` | `8px 10px` |
| Botones acción padding | `8px 12px` | `5px 10px` |
| Botones acción font | `13px` | `12px` |

### Semáforo Switch Más Compacto

| Elemento | Antes | Después |
|----------|-------|---------|
| Min-height segmento | `32px` | `26px` |
| Padding segmento | `5px 4px` | `3px 4px` |
| Gap del switch | `3px` | `2px` |
| Font size segmento | `10px` | `9px` |
| Dot size | `7px` | `6px` |
| Border radius | `10px` | `8px` |
| Margen inferior | `14px` | `8px` |

---

## 3. Menú ⋯ de Acciones Secundarias

Los botones secundarios se movieron de estar visibles individualmente a un dropdown ⋯:

**Acciones primarias (siempre visibles):**
- 📋 Seguimiento
- 💬 Directo (WhatsApp)

**Menú ⋯ (dropdown):**
- 📋 Historial
- ⏰ Recordatorio (solo si tiene)
- 👍/👎 Aplica/No aplica crédito
- ❌ Quitar de campaña

### Comportamiento
- Se abre con clic en el botón ⋯
- Se cierra con clic en cualquier opción del menú
- Se cierra con clic fuera del menú
- Animación de fade-in al abrir
- Posicionado arriba-derecha sobre la tarjeta (evita overflow)

---

## Archivos Modificados

| Archivo | Cambios |
|---------|---------|
| `public/desktop/gestion-lote.html` | Hero reestructurado a una fila + búsqueda integrada |
| `public/css/gestion-lote.css` | Estilos hero compacto + compactación tarjetas + menú ⋯ + responsive |
| `public/desktop/js/gestion-lote.js` | Mostrar/ocultar hero-search + `limpiarBusquedaHero()` + `configurarHeroSearch()` |

## Funciones JS Nuevas

```javascript
// Búsqueda integrada en el hero
limpiarBusquedaHero()      // Limpia el input y re-renderiza
configurarHeroSearch()     // Configura el botón clear del hero search

// Menú ⋯ de tarjetas
toggleSolMenu(btn)         // Toggle menú ⋯ de una tarjeta
closeSolMenus()            // Cerrar todos los menús abiertos
```

## Comportamiento Landing vs Campaña

| Elemento | Landing (sin ID) | Campaña seleccionada |
|----------|-------------------|---------------------|
| Título | "Selecciona una campaña" | Nombre de la campaña |
| Badge sistema | Oculto | Visible si `es_sistema` |
| Estado pill | Oculto | Visible con color |
| KPI strip | Oculto | Visible (%, resumen, barra, pausa) |
| Hero search | Oculto | Visible |
| Actividad | Oculto | Visible (línea sutil) |
| Botón ⋯ | Oculto | Visible |
| Botón Estado (rail) | Oculto | Visible |
| Grid cards | Landing grid | Lista de solicitudes |
| Rail semáforo | Oculto | Visible |

## Responsive

- **≤900px:** hero-row se envuelve, KPIs pasan a nueva fila, search se reduce
- **≤640px:** hero-row en columna, search full-width
