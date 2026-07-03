# Feature: Botón "Ver Chat" en Gestión por Lotes

## 📝 Descripción

Se agregó un botón **"💬 Ver Chat"** en las tarjetas de gestión por lotes (campañas) que abre WhatsApp directamente con el número del cliente **sin guardar ningún dato en la base de datos**.

## 🎯 Comportamiento

- Al hacer clic en el botón, se abre WhatsApp (Web en escritorio, app nativa en móvil) con el número del cliente.
- **No abre ningún modal**, no pide mensaje, no guarda gestión.
- Es una acción puramente de navegación: solo abre el chat de WhatsApp.

## 📁 Archivos modificados

| Archivo | Cambio |
|---------|--------|
| `public/desktop/js/gestion-lote.js` | Se agregó botón `btn-ver-chat` en `renderizarSolicitudes()` que llama a `abrirWhatsAppDesktop(celular, '')` |
| `public/movil/js/gestion-lote.js` | Se agregó botón `btn-sol-ver-chat` en `renderizarSolicitudes()` que llama a `abrirWhatsAppMovil(celular, '')` |
| `public/css/gestion-lote.css` | Estilos para `.btn-accion.btn-ver-chat` (fondo verde WhatsApp `#25D366`) |
| `public/movil/gestion-lote.html` | Estilo inline para `.btn-sol-ver-chat` |

## 🔧 Funciones reutilizadas

| Función | Archivo | Propósito |
|---------|---------|-----------|
| `abrirWhatsAppDesktop(celular, mensaje)` | `public/desktop/js/gestion-lote.js` | Abre WhatsApp Web vía `wa.me` |
| `abrirWhatsAppMovil(celular, mensaje)` | `public/movil/js/gestion-lote.js` | Abre WhatsApp app vía deep link `whatsapp://send` con fallback a `api.whatsapp.com` |
| `formatearNumeroWhatsApp(celular)` | Ambos archivos | Formatea el número agregando código de país (+593 Ecuador) |

## ✅ Validación

- [ ] El botón aparece en todas las tarjetas de solicitudes
- [ ] Al hacer clic se abre WhatsApp con el número del cliente
- [ ] No se guarda ningún registro en la base de datos
- [ ] Funciona en escritorio (abre WhatsApp Web)
- [ ] Funciona en móvil (abre la app de WhatsApp)

## 🧪 Pruebas sugeridas

1. Abrir una campaña con solicitudes
2. Hacer clic en "💬 Ver Chat" en cualquier tarjeta
3. Verificar que se abre WhatsApp con el número correcto
4. Verificar que no aparece ningún mensaje de "gestión guardada"
5. Verificar en la BD que no se creó ningún registro nuevo
