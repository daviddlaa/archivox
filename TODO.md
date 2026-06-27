# TODO - WhatsApp con Imagen en Gestión por Lote (Escritorio)

## Objetivo:
Agregar botón global de WhatsApp en la página de gestión por lote que permita subir imagen y enviarla.

---

## Estado: 🟡 EN PROGRESO

### Historico (Ya Implementado):
- [x] Multer configurado para imágenes (5MB, jpg/png/webp)
- [x] Ruta API `/api/excel/upload-imagen`
- [x] Botón WhatsApp Masivo en UI
- [x] Modal de WhatsApp Masivo
- [x] Input de archivo ahora visible (antes oculto con display:none)

### Ahora: Bugfix - Input de imagen no era visible

**PROBLEMA ENCONTRADO:**
- El CSS tenía `#whatsapp-file-input { display: none; }` lo cual ocultaba el botón de subir imagen
- El usuario no podía ver ni hacer clic para seleccionar una imagen

**SOLUCIÓN APLICADA:**
- Actualizado el CSS para mostrar el input como un botón visible con estilo de frontera punteada
- Ahora el usuario puede:
  1. Ver el botón "Seleccionar archivo"
  2. Hacer clic para elegir imagen
  3. Ver la previsualización después de seleccionar

---

## Flujo de Usuario (Ahora funciona):

1. ✅ Usuario entra a Gestión por Lote → ve botón "💬 WhatsApp Masivo"
2. ✅ Hace clic en el botón → se abre el modal
3. ✅ Ve el botón de "Adjuntar Imagen" visible y puede hacer clic
4. ✅ Selecciona una imagen → ve la previsualización
5. ✅ Escribe mensaje y hace clic en "Enviar"
6. ✅ La imagen se sube al servidor y se guarda en la gestión

---

## Pendiente / Futuras Mejoras:

- [ ] Integración con WhatsApp API real (whatsapp-web.js o Twilio)
  - Por ahora, la imagen se guarda como URL en la observación
  - El usuario debe abrir WhatsApp manualmente paraenviar

---

## Notas:
- El servidor debe estar corriendo para probar
- La imagen se guarda en la carpeta `/uploads/`
- La URL de la imagen se guarda en la observación de cada gestión
