# Feature: Landing de campañas con grid de tarjetas + selector hero

**Fecha:** Agosto 2026  
**Ámbito:**  
- `public/desktop/js/gestion-lote.js`, `public/css/gestion-lote.css`  
- `public/movil/js/gestion-lote.js`, `public/movil/css/gestion-lote.css`  
**Estado:** Implementado

## Resumen

Al entrar a Campañas **sin** `?id=`, el cuerpo muestra un **grid/lista de tarjetas** de campañas. Al hacer click se navega al detalle (`?id=`). El **selector del hero** (popover desktop / bottom sheet móvil) permanece siempre visible.

## Comportamiento

| URL | UI |
|-----|----|
| `/gestion-lote` o `/m/gestion-lote` | Hero + grid de tarjetas |
| `?id=N` | Detalle de campaña (sin regresión) |
| `?id=N&card=X` | Deep link a tarjeta intacto |

## Implementación

- Desktop: `renderizarGridCampanasLanding()` reutiliza datos de `GET /api/gestiones-maestro` y el estilo `.campaña-card`.
- Móvil: `renderizarGridCampanasLandingMovil()` con cards táctiles y menú ⋯ (bottom sheet de acciones).
- CSS: `.campanas-landing-grid` / `.campanas-landing-grid-movil`.
- Sin API nueva.

## Criterios de prueba

1. Entrar a Campañas sin id → ver tarjetas.
2. Click tarjeta → detalle de esa campaña.
3. Selector hero usable con y sin campaña abierta.
4. Deep link `?card=` sigue saltando a la solicitud.
