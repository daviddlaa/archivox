# Fix: "push service error" en móvil — detección iOS/iPadOS, reintentos y reset del SW

**Fecha:** 30/08/2026
**Ámbito:** `public/js/push-suscripcion.js`, `public/js/perfil.js`
**Síntoma:** En producción el escritorio se suscribe bien (fila en
`push_subscriptions`, `plataforma='desktop'`), pero la versión móvil muestra
"No se pudo activar: …push service error" (equivalente al mensaje técnico
`Registration failed - push service error` de Chrome). Revisando la BD de
producción **no aparece ninguna fila** del teléfono: el navegador falla al
crear la suscripción (local, vía FCM) antes de hablar con el servidor.

---

## Causas raíz tratadas en la app

1. **iPadOS no se detectaba como Apple.** El iPadOS 13+ envía user-agent de
   escritorio (`Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) …`). La
   detección previa solo miraba `iPhone|iPad|iPod` y además estaba condicionada
   a `soportado()`, por lo que un iPad en pestaña intentaba `subscribe` (que
   iOS rechaza si la app no está instalada) y la guía PWA ni aparecía.
2. **iOS 16.4+ en pestaña normal.** Expone `PushManager`/`Notification` pero
   **rechaza el `subscribe`** con "push service error" si la app no está
   instalada. El flujo debe ir SIEMPRE a la guía "Compartir → Añadir a Pantalla
   de Inicio", no al intento de suscripción.
3. **Suscripción vieja con otra `applicationServerKey`** (mismo SW/scope): Chrome
   lanza "push service error". Había que dar de baja la vieja y reintentar.
4. **Registración del service worker "rota"** en el navegador del dispositivo
   (típica tras varios despliegues): sin fila en la BD, sin suscripción en el
   navegador (`getSubscription() → null`) y `subscribe` fallando siempre.
5. **Errores crudos al usuario.** Perfil y banner mostraban el mensaje técnico
   del navegador sin contexto accionable.

## Cambios

### `public/js/push-suscripcion.js`

- `esApple()`: UA `iPhone|iPad|iPod` **o** UA `Macintosh` + `maxTouchPoints > 1`
  (iPadOS). `esIOSEnPestana() = esApple() && !esPWAInstalada()`.
- `solicitar()` comprueba `esIOSEnPestana()` **antes** de `soportado()` →
  devuelve `ios-pestana`.
- `suscribirseConReintento(registration, vapidKey)`:
  1. intento → 2º intento (250 ms) → si sigue fallando, limpia una suscripción
     obsoleta con otra clave (`unsubscribe()`) → reintento.
  2. si aún falla: `registration.unregister()` → `registrarSW()` →
     `navigator.serviceWorker.ready` → intento final ("borrar y rehacer").
  3. Solo entra en esta senda si el error es `push service error` /
     `registration failed`; si es otra cosa, se propaga el error original.
- `mensajeErrorSuscripcion(msg)` (público como `errorLegible`): traduce el error
  técnico a un mensaje accionable en español, con **variante móvil**
  (`detectarPlataforma() === 'movil'`: revisar conexión, actualizar Chrome y
  servicios de Google, probar otra red).
- `bannerDashboard()` / `bannerTrasRecordatorio()`: muestran la guía iOS también
  cuando `!soportado()` (antes quedaban en `return null`).
- `solicitar()` pide `Notification.requestPermission()` **antes** de cualquier
  `await` (dentro del gesto del clic).

### `public/js/perfil.js`

- `renderizar()` evalúa `PushNotif.esIOSEnPestana()` **antes** que
  `no-soporte` → en iPad/iOS pestaña muestra la guía PWA (no "no soporta").
- El botón Activar muestra `PushNotif.errorLegible(r.error)` (mensaje accionable,
  no el texto crudo del navegador).

## Verificación

- `node --check public/js/push-suscripcion.js` y `perfil.js` ✓.
- Detección iOS con Chromium headless (UA + `maxTouchPoints` emulados):
  iPad→`true`, iPhone→`true`, Android→`false`, desktop→`false` ✓.
- Flujo Android completo emulado (Pixel 5, permiso concedido, sin suscripción
  previa): `PushNotif.solicitar()` → `ya-suscrito` con fila en la BD local ✓
  (regresión tras el cambio de `suscribirseConReintento`).
- Producción: **revisada la BD (solo lectura)** — únicamente existe la fila
  `desktop` del escritorio; confirmado que el móvil no genera fila.

## Hallazgo final (dispositivo)

Con Chrome y Brave en el mismo Android (ambos sobre FCM) el `subscribe` falla
siempre: permiso `default`→concedido, `getSubscription()→null`, y aun tras el
reset del SW, el error persiste. Todo actualizado y fallando igual con datos y
WiFi. **Conclusión: en ese teléfono el dispositivo/ROM/red no puede alcanzar
FCM; no es un fallo de la app.** La prueba concluyente es probar en otro
dispositivo o navegador. Pasos recomendados en el teléfono: cuenta de Google
iniciada en Chrome, probar `https://fcm.googleapis.com` en el navegador,
desactivar DNS privado/VPN, y/o limpiar datos del sitio (`chrome://settings/siteData`).