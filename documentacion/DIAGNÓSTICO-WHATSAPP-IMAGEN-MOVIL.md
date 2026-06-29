# 📱 Diagnóstico: WhatsApp con Imagen en Móvil

## 🚨 Problema

Al hacer clic en **"📷 WhatsApp c/Imagen"** en la versión móvil de Gestión por Lotes, se abre una página en el navegador en lugar de abrir la aplicación de WhatsApp directamente para enviar la imagen y el texto.

## 🔍 Causa Raíz

El código actual de `public/movil/js/gestion-lote.js` usa esta función para abrir WhatsApp:

```javascript
function abrirWhatsAppWeb(celular, mensaje) {
    var urlWhatsApp = 'https://web.whatsapp.com/send?phone=' + numeroLimpio;
    // o fallback
    window.open('https://wa.me/' + numeroLimpio + '?text=...', '_blank');
}
```

**Problema:** Ambas URLs están diseñadas para escritorio:
| URL | Comportamiento en móvil |
|-----|------------------------|
| `https://web.whatsapp.com/send` | Abre WhatsApp Web en el navegador (mala UX en móvil) |
| `https://wa.me/` | Redirige a WhatsApp Web o a una página intermedia de WhatsApp, no a la app |

## 📊 URLs correctas para móvil

| Esquema | Comportamiento |
|---------|----------------|
| `whatsapp://send?phone=...&text=...` | **Deep link** — abre la app de WhatsApp directamente (Android/iOS) |
| `https://api.whatsapp.com/send?phone=...&text=...` | **Universal link** — abre la app si está instalada, fallback al navegador |

## 🧩 Problema adicional: Enviar imágenes

No es posible **adjuntar una imagen automáticamente** mediante una URL de WhatsApp. Las limitaciones son:

1. `whatsapp://send` solo permite texto pre-llenado, no imágenes
2. `wa.me` solo permite texto
3. La API de WhatsApp Business requiere un backend aprobado

**Alternativas para compartir la imagen:**

| Alternativa | Funciona en | Cómo |
|-------------|-------------|------|
| **Web Share API** (`navigator.share()`) | Chrome Android, Safari iOS | Abre el share sheet del sistema y el usuario elige WhatsApp — **soporta imágenes** |
| **Incluir URL en texto** | Todos | Se sube la imagen al servidor y se incluye el enlace en el mensaje de texto |

## ✅ Solución Propuesta

```
┌──────────────────────────────────────────────────┐
│          FLUJO CORREGIDO (MÓVIL)                  │
├──────────────────────────────────────────────────┤
│                                                    │
│  Usuario selecciona imagen y escribe texto         │
│         │                                          │
│         ▼                                          │
│  ┌─────────────────────────────┐                   │
│  │ ¿El navegador soporta       │                   │
│  │ navigator.share con files?  │                   │
│  └──────────┬──────────┬───────┘                   │
│             │ SÍ       │ NO                        │
│             ▼          ▼                            │
│  ┌──────────────┐  ┌──────────────────────┐        │
│  │ Compartir     │  │ Subir imagen al      │        │
│  │ vía Share API │  │ servidor → obtener   │        │
│  │ → Usuario     │  │ URL → incluir en     │        │
│  │ elige WhatsApp│  │ el mensaje de texto  │        │
│  │ (con imagen)  │  │                      │        │
│  └──────────────┘  └──────────┬───────────┘        │
│                               │                     │
│                               ▼                     │
│                    ┌──────────────────────┐         │
│                    │ Abrir WhatsApp App   │         │
│                    │ vía whatsapp:// o    │         │
│                    │ api.whatsapp.com     │         │
│                    │ con texto pre-llenado│         │
│                    └──────────────────────┘         │
│                                                    │
└──────────────────────────────────────────────────┘
```

## 📁 Archivos a modificar

1. **`public/movil/js/gestion-lote.js`**
   - `abrirWhatsAppWeb()` → Usar `whatsapp://send` en móvil con fallback a `https://api.whatsapp.com/send`
   - `enviarWhatsAppImagen()` → Agregar Web Share API para compartir imagen directamente
   - Mejorar mensajes y detección de móvil

## 📝 Notas adicionales

- `whatsapp://send` requiere que WhatsApp esté instalado
- `navigator.share()` solo funciona en HTTPS o localhost (producción en Render ya usa HTTPS ✅)
- La imagen subida al servidor se incluye como URL en el texto como plan B
