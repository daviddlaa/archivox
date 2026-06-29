# 🐛 Fix: Duplicación de Gestiones al usar WhatsApp con Imagen

## 🚨 Problema

Al hacer clic en **"📷 WhatsApp c/Imagen"** en Gestión por Lotes, cada solicitud se guardaba **2 veces** en lugar de 1. El contador de gestiones aumentaba de a 2 por cada solicitud procesada.

### Síntomas en consola

```
Solicitudes recibidas: 10         ← 10 gestiones pendientes
[WhatsApp Desktop] Usando Web Share API
Solicitudes recibidas: 11         ← 1ª save (bien)
[WhatsApp Desktop] Número original: 0986896385 → formateado: 593986896385
[WhatsApp Desktop] Abriendo: https://wa.me/593986896385?text=hola
Solicitudes recibidas: 12         ← 2ª save (mal - duplicado!)
```

El progreso llegaba a **133%** porque se estaban contando más gestiones de las que debería.

## 🔍 Causa Raíz

La función `enviarWhatsAppImagen()` tiene dos rutas de ejecución:

```
┌──────────────────────────────────────────────────┐
│               enviarWhatsAppImagen()              │
├──────────────────────────────────────────────────┤
│                                                    │
│   ┌─ PASO 1: Web Share API ──────────────────┐    │
│   │  navigator.share({ files: [imagen] })     │    │
│   │  ↓                                         │    │
│   │  guardarGestionWhatsApp()  ← 1ª SAVE      │    │
│   │  alert()                                   │    │
│   │  cerrarModal()                             │    │
│   │  cargarDatosGestion()  ← sin await ❌      │    │
│   │  return                                    │    │
│   └────────────────────────────────────────────┘    │
│                    │                                 │
│                    ▼                                 │
│   ┌─ PASO 2: Fallback ───────────────────────┐    │
│   │  abrirWhatsApp()                          │    │
│   │  subir imagen al servidor                 │    │
│   │  guardarGestionWhatsApp()  ← 2ª SAVE ❌   │    │
│   │  cargarDatosGestion()                     │    │
│   └────────────────────────────────────────────┘    │
│                                                    │
└──────────────────────────────────────────────────┘
```

**Causa:** Aunque había un `return` dentro del bloque de éxito de Web Share, en ciertas condiciones el flujo caía al **PASO 2 (Fallback)**, causando un segundo guardado de la misma gestión.

**Factores que contribuían:**
1. `cargarDatosGestion()` se llamaba **sin `await`** — iniciaba async pero no se esperaba su finalización
2. Si ocurría cualquier excepción después del `await navigator.share()`, el `catch (shareError)` la atrapaba y, al no ser un `AbortError`, **dejaba caer el flujo al fallback**
3. No había ninguna barrera que impidiera que el fallback se ejecutara después de un share exitoso

## ✅ Solución

### Cambio 1: Flag `shareCompletado`

```javascript
var shareCompletado = false;

// En el bloque de éxito de Web Share:
if (navigator.canShare(shareData)) {
    await navigator.share(shareData);
    await guardarGestionWhatsAppDesktop(solicitudId, mensaje, null);
    shareCompletado = true;  // ← Se marca ANTES de cualquier operación posterior
    ...
    return;
}
```

### Cambio 2: Guard post-Share

```javascript
// Si Web Share ya completó, salir sin ejecutar fallback
if (shareCompletado) {
    btn.textContent = '📤 Enviar';
    btn.disabled = false;
    return;
}
```

### Cambio 3: `await` en `cargarDatosGestion()`

```javascript
// Antes (causaba race condition):
cargarDatosGestion();    // sin await ❌
return;

// Después:
await cargarDatosGestion();  // con await ✅
btn.textContent = '📤 Enviar';
btn.disabled = false;
return;
```

## 📁 Archivos modificados

| Archivo | Cambio |
|---------|--------|
| `public/desktop/js/gestion-lote.js` | Flag `shareCompletado`, guard post-Share, `await cargarDatosGestion()` |
| `public/movil/js/gestion-lote.js` | Mismo fix: flag `shareCompletado`, guard, `await cargarDatosGestionMovil()` |

## 📊 Flujo corregido

```
┌──────────────────────────────────────────────────┐
│               enviarWhatsAppImagen()              │
├──────────────────────────────────────────────────┤
│                                                    │
│   shareCompletado = false                          │
│                                                    │
│   ┌─ Web Share API ─────────────────────────────┐ │
│   │  navigator.share()                           │ │
│   │  guardarGestionWhatsApp()  ← SAVE única      │ │
│   │  shareCompletado = true                      │ │
│   │  alert() + cerrarModal()                     │ │
│   │  await cargarDatosGestion()                  │ │
│   │  return                                      │ │
│   └──────────────────────────────────────────────┘ │
│                                                    │
│   ┌─ ¿shareCompletado? → SÍ → return ──────────┐  │
│   └──────────────────────────────────────────────┘  │
│                                                    │
│   ┌─ Fallback (solo si share NO funcionó) ──────┐  │
│   │  abrirWhatsApp()                             │  │
│   │  guardarGestionWhatsApp()                    │  │
│   └──────────────────────────────────────────────┘  │
│                                                    │
└──────────────────────────────────────────────────┘
```

## ✅ Resultado

- Cada solicitud se guarda **1 sola vez**
- El progreso muestra el porcentaje correcto
- No más 133% de progreso
- Compatible con desktop y móvil

## 📝 Notas adicionales

- El flag `shareCompletado` se setea **antes** del `alert()` y `cerrarModal()` para que incluso si esas funciones causan una excepción, el flag ya esté marcado
- El guard `if (shareCompletado) { return; }` actúa como una **barrera de seguridad** entre el Web Share y el fallback
- El `await` en `cargarDatosGestion()` evita race conditions entre el renderizado de cards y la recarga de datos
