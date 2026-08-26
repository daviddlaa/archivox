# 📋 Feature: Guía de Solicitudes — Tour Interactivo

**Estado:** ✅ Implementada  
**Fecha:** 26/08/2026  
**Ambito:** Desktop y Móvil — Página de Solicitudes

---

## Descripción

Tour interactivo de 6 pasos que se muestra **una sola vez por usuario** al entrar a la página de Solicitudes. Explica las partes clave de la interfaz: KPIs, búsqueda, filtros, vista tarjeta/tabla, y acciones de selección.

## Persistencia

- **Clave:** `localStorage` → `guia_solicitudes_v1_<usuarioId>`
- **Comportamiento:** Si el usuario ya vio el tour, no se vuelve a mostrar.
- **Patrón:** Idéntico al de `guia-campana.js` (guía de clasificación en campañas).

## Archivos

| Archivo | Propósito |
|---------|-----------|
| `public/js/guia-solicitudes.js` | Lógica del tour: pasos, navegación, renderizado |
| `public/css/guia-solicitudes.css` | Estilos del tour (compartido desktop/móvil) |

## Pasos del Tour

| # | Icono | Título | Descripción |
|---|-------|--------|-------------|
| 1 | 👋 | ¡Bienvenido a Solicitudes! | Introducción general a la pantalla |
| 2 | 📊 | Indicadores (KPIs) | Total, Mostrando, Seleccionadas |
| 3 | 🔍 | Búsqueda rápida | Buscar por ID, cédula, nombre o teléfono |
| 4 | 🎯 | Filtros inteligentes | Estado, Segmento, Campaña, Fecha, Vendedor |
| 5 | 🗂️ | Vista Tarjeta o Tabla | Toggle entre vistas |
| 6 | 🚀 | Seleccionar y crear campañas | Selección + acciones masivas |

## API

```javascript
// Mostrar tour si es la primera vez
window.mostrarGuiaSolicitudesSiPrimeraVez({ usuarioId: 123 })
// → true si se mostró, false si ya se vio
```

## Integración

- Se carga en `solicitudes.html` (desktop y móvil) como `<script>` después de `modal.js`.
- Se llama desde `solicitudes.js` en el `DOMContentLoaded`, después de `init()`.
- Usa `Modal.abrir()` (desktop) o `crearModal()` (móvil) para mostrar el tour.
- Obtiene el `usuarioId` de `/api/auth/sesion` (fetch asíncrono).

## Diseño Visual

- Header con icono 📋 y título "Tour de Solicitudes"
- Barra de progreso animada
- Icono + título + texto + ejemplo por paso
- Dots indicadores clickeables para saltar a cualquier paso
- Botones: Atrás / Saltar / Siguiente / ¡Entendido!
- Animación de fade-in al cambiar de paso
- Responsive: se adapta a móvil con tamaños menores
