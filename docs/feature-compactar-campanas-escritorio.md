# 📋 Feature: Tarjetas Compactas de Campaña + Menú ⋯ (Escritorio)

**Estado:** ✅ Implementada  
**Fecha:** 26/08/2026  
**Ambito:** Desktop — Página de Gestión por Lotes (Campañas)

---

## Descripción

Rediseño de las tarjetas de solicitud en la vista de campañas (desktop) para optimizar el uso del espacio vertical. Las tarjetas eran demasiado altas por la acumulación de badges, semáforo, última gestión y 5-6 botones de acción.

## Cambios Realizados

### 1. Compactación General

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

### 2. Semáforo Switch Más Compacto

| Elemento | Antes | Después |
|----------|-------|---------|
| Min-height segmento | `32px` | `26px` |
| Padding segmento | `5px 4px` | `3px 4px` |
| Gap del switch | `3px` | `2px` |
| Font size segmento | `10px` | `9px` |
| Dot size | `7px` | `6px` |
| Border radius | `10px` | `8px` |
| Margen inferior | `14px` | `8px` |

### 3. Menú ⋯ de Acciones Secundarias

Los botones secundarios se movieron de estar visibles individualmente a un dropdown ⋯:

**Acciones primarias (siempre visibles):**
- 📋 Seguimiento
- 💬 Directo (WhatsApp)

**Menú ⋯ (dropdown):**
- 📋 Historial
- ⏰ Recordatorio (solo si tiene)
- 👍/👎 Aplica/No aplica crédito
- ❌ Quitar de campaña

### 4. Comportamiento del Menú

- Se abre con clic en el botón ⋯
- Se cierra con clic en cualquier opción del menú
- Se cierra con clic fuera del menú
- Animación de fade-in al abrir
- Posicionado arriba-derecha sobre la tarjeta (evita overflow)

## Archivos Modificados

| Archivo | Cambios |
|---------|---------|
| `public/css/gestion-lote.css` | Compactación + estilos del menú ⋯ |
| `public/desktop/js/gestion-lote.js` | Renderizado del menú + funciones `toggleSolMenu`, `closeSolMenus` |

## Funciones JS Nuevas

```javascript
// Toggle menú ⋯ de una tarjeta
toggleSolMenu(btn)

// Cerrar todos los menús abiertos
closeSolMenus()

// Se cierra automáticamente al hacer clic fuera (event listener en document)
```

## Notas

- El menú ⋯ usa `position: absolute` con `bottom: calc(100% + 4px)` para aparecer arriba del botón, evitando que se salga de la pantalla.
- Los botones del menú tienen `event.stopPropagation()` para no activar el click de la tarjeta.
- El botón de "Quitar" tiene estilo rojo diferenciado en el menú.
