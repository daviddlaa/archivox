# TODO - WhatsApp con Imagen en Gestión por Lote (Escritorio)

## Objetivo:
Agregar botón global de WhatsApp en la página de gestión por lote que permita subir imagen y enviarla a través de WhatsApp Web.

---

## Estado: ✅ COMPLETADO

### 1. Configurar Multer para Imágenes
- [x] Modificar `src/config/multer.config.js` para aceptar imágenes (jpg, png, webp)
- [x] Máximo 5MB por imagen

### 2. Nueva Ruta API para Subir Imágenes
- [x] Crear ruta `POST /api/excel/upload-imagen` en `src/routes/excel.routes.js`
- [x] Guardar imagen en carpeta `uploads/` y retornar URL

### 3. Actualizar Controlador de Gestión
- [x] Modificar `crearGestion` en `src/controllers/excel.controller.js` para guardar `imagen_url`

### 4. Modificar UI de Gestión por Lote
- [x] **gestion-lote.html**: Agregar botón global de WhatsApp arriba de la lista
- [x] **gestion-lote.js**: 
  - ✅ Botón global de WhatsApp Masivo agregado
  - ✅ Modal para subir imagen + escribir mensaje
  - ✅ Preview de imagen antes de enviar
  - ✅ Envío masivo a todas las solicitudes pendientes

### 5. Bug Corregido
- [x] **PROBLEMA**: La función `mostrarFilaWhatsApp()` no se estaba llamando
- [x] **SOLUCIÓN**: Agregada llamada en `cargarGestion()` después de mostrar panel de progreso

---

## Flujo de Usuario:

1. ✅ Usuario entra a Gestión por Lote → ve botón "💬 WhatsApp Masivo" arriba
2. ✅ Toca botón → modal pide: seleccionar imagen + escribir mensaje
3. ✅ Preview de imagen se muestra antes de enviar
4. ✅ Al enviar → crea gestión para TODAS las solicitudes pendientes
5. ✅ La URL de la imagen se guarda en la observación

---

## Notas:
- WhatsApp Web no permite envío programático de imágenes
- El agente debe arrastrar la imagen manualmente a WhatsApp Web
- Solo versión de escritorio (no móvil)
