# Plan de Acción: WhatsApp Web - Correcciones

## Problemas Identificados:

### 1. WhatsApp Web pantalla negra
**Causa**: Se usa `web.whatsapp.com/send?phone=...` que a veces no funciona bien con números nuevos
**Solución**: Usar `wa.me` que es más confiable para abrir WhatsApp

### 2. Escanear QR para WhatsApp
**Problema**: El servidor usa `whatsapp-web.js` que requiere escanear código QR la primera vez
**Solución**: Necesita iniciar el servidor y mostrar el QR en un panel del frontend

### 3. Modal duplicado (WhatsApp c/Imagen)
**Problema**: Hay dos flujos para WhatsApp:
- "WhatsApp Masivo" - configura mensaje/imagen para toda la campaña
- "WhatsApp c/Imagen" en cada solicitud - redundante
**Solución**: Simplificar - usar solo el flujo Masivo y el botón "Enviar" en cada tarjeta

### 4. No hay informe/estado de WhatsApp
**Problema**: No se puede ver si WhatsApp está conectado
**Solución**: Agregar indicador de estado en el panel

---

## Plan de Implementación:

### Paso 1: Corregir función abrirWhatsAppWeb()
- Cambiar `web.whatsapp.com` por `wa.me` 
- Mejorar formato del número

### Paso 2: Agregar Panel de Estado de WhatsApp
- Crear función para obtener estado del servidor (`/api/whatsapp/status`)
- Mostrar indicador verde/rojo en el HTML
- Agregar botón para mostrar QR si no está conectado

### Paso 3: Simplificar flujo de WhatsApp
- Eliminar modal redundante de "WhatsApp c/Imagen" 
- El botón en cada tarjeta debe usar la config guardada de Masivo
- Agregar confirmación antes de enviar (confirm())

### Paso 4: Inicializar WhatsApp al iniciar servidor
- Asegurar que `initWhatsAppServer()` se llama en app.js

---

## Archivos a modificar:
1. `public/desktop/js/gestion-lote.js` - corregir abrirWhatsAppWeb(), agregar panel estado
2. `public/desktop/gestion-lote.html` - agregar indicador de estado
3. `public/desktop/css/gestion-lote.css` - estilos para el indicador
4. `app.js` - verificar que initWhatsAppServer() se llama

---

##Pendiente: Confirmación del usuario antes de proceder
