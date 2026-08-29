# Fix: botón "Activar notificaciones" del banner push no hacía nada

**Fecha:** 29/08/2026
**Ámbito:** `public/js/push-suscripcion.js`
**Síntoma:** El banner del dashboard ("Activa las notificaciones push…") y el contextual
tras guardar un recordatorio mostraban su botón de activación, pero al hacer clic **no
ocurría nada** (ni siquiera pedía permiso).

---

## 1. Causa raíz

`crearBanner(html, claves)` enlaza los handlers de acción **solo** a elementos con el
atributo `data-accion="<clave>"`:

```js
var el = contenedor.querySelector('[data-accion="' + k + '"]');
if (el) el.addEventListener('click', claves[k]);
```

Pero el HTML de ambos banners declaraba el botón de activación **sin** ese atributo:

```html
<button type="button" class="push-banner-btn">Activar notificaciones</button>
```

El `querySelector('[data-accion="solicitar"]')` devolvía `null` → `if (el)` falso → el
listener jamás se registraba. El clic no tenía ningún handler que ejecutar.
(El CSS y la lógica de `solicitar()` eran correctos; el flujo real de suscripción ya se había
validado con Chromium vía `page.evaluate`.)

## 2. Cambios

1. `data-accion="solicitar"` añadido al botón de **ambos** banners (dashboard y contextual).
2. Endurecimiento en `botonAccion().solicitar`: los estados `error` / `no-soporte` ahora
   **rehabilitan el botón** y muestran un mensaje en `.push-banner-info` en vez de dejar el
   botón deshabilitado en silencio (antes devolvía el estado sin rama en el handler).

## 3. Verificación E2E (local, Chromium headless + SQLite)

- Login real → dashboard → banner renderizado con permiso `default`.
- `overridePermissions` concede el permiso en vivo → **clic real en `.push-banner-btn`**:
  permiso `granted`, suscripción creada en el navegador, `POST /api/push/subscribe`
  guarda la fila (BD pasa 0 → 1) y el banner se elimina. ✓
- `node --check public/js/push-suscripcion.js` ✓.

(Se reutilizó el usuario de prueba `pushtest`, creado y eliminado de la BD local; sin cambios
en producción.)