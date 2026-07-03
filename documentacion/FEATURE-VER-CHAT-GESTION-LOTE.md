# Feature: Botón "Ver Chat" en Gestión por Lotes

## 📝 Descripción

Se agregó un icono **💬** (Ver Chat) en las tarjetas de gestión por lotes (campañas) que abre WhatsApp directamente con el número del cliente **sin guardar ningún dato en la base de datos**.

El icono está ubicado **junto al número de teléfono** en la sección de datos de cada tarjeta.

## 🎯 Comportamiento

- Al hacer clic en el icono **💬** (junto al celular), se abre WhatsApp (Web en escritorio, app nativa en móvil) con el número del cliente.
- **No abre ningún modal**, no pide mensaje, no guarda gestión.
- Es una acción puramente de navegación: solo abre el chat de WhatsApp.

## Ubicación visual

```
┌──────────────────────────────────────┐
│  #12345                    [WhatsApp]│
│  Juan Pérez                          │
│  🆔 1234567890  📱 0987654321  💬   │  ← Icono junto al teléfono
│  📝 Observación                      │
│                                      │
│  [Seguimiento] [Directo]             │
│  [Ver] [Historial]                   │
└──────────────────────────────────────┘
```

## 📁 Archivos modificados

| Archivo | Cambio |
|---------|--------|
| `public/desktop/js/gestion-lote.js` | Se quitó el botón `btn-ver-chat` de `sol-acciones` y se agregó icono `sol-chat-icon` en `sol-datos` junto al celular |
| `public/movil/js/gestion-lote.js` | Se quitó el botón `btn-sol-ver-chat` de `sol-botones` y se agregó icono `sol-chat-icon` en `sol-datos` junto al celular |
| `public/css/gestion-lote.css` | Se reemplazaron los estilos de `.btn-accion.btn-ver-chat` por `.sol-chat-icon` (icono inline) |
| `public/movil/gestion-lote.html` | Se reemplazó `.btn-sol-ver-chat` por `.sol-chat-icon` (icono inline) |

## 🔧 Funciones reutilizadas

| Función | Archivo | Propósito |
|---------|---------|-----------|
| `abrirWhatsAppDesktop(celular, mensaje)` | `public/desktop/js/gestion-lote.js` | Abre WhatsApp Web vía `wa.me` |
| `abrirWhatsAppMovil(celular, mensaje)` | `public/movil/js/gestion-lote.js` | Abre WhatsApp app vía deep link `whatsapp://send` con fallback a `api.whatsapp.com` |
| `formatearNumeroWhatsApp(celular)` | Ambos archivos | Formatea el número agregando código de país (+593 Ecuador) |

## ✅ Validación

- [ ] El icono 💬 aparece junto al número de teléfono en cada tarjeta
- [ ] Al hacer clic se abre WhatsApp con el número del cliente
- [ ] No se guarda ningún registro en la base de datos
- [ ] Funciona en escritorio (abre WhatsApp Web)
- [ ] Funciona en móvil (abre la app de WhatsApp)
- [ ] Los botones de acción ya no muestran el botón "Ver Chat" duplicado
