# Feature: Login móvil compacto y centrado

**Fecha:** Agosto 2026  
**Ámbito:** `public/movil/login.html`  
**Estado:** Implementado

## Resumen

Se redujo el tamaño visual del formulario de login en móvil y se reforzó el centrado vertical/horizontal en el viewport, sin tocar el login de escritorio ni la lógica de autenticación.

## Cambios

- Override CSS inline en `public/movil/login.html` (no altera `public/css/login.css` desktop).
- Contenedor: `max-width: 300px`, padding reducido, bordes más compactos.
- Logo: `max-width: 160px`.
- Inputs/botones/gaps más pequeños.
- `min-height: 100dvh` + flex center del body para centrado real en móviles modernos.
- `autocomplete` en campos de login/registro.

## Criterios de prueba

1. Abrir `/m/login` en viewport móvil: tarjeta centrada y más pequeña que antes.
2. Login y registro siguen funcionando.
3. Desktop `/login` sin cambios visuales.
