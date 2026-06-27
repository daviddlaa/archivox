# INFORME TÉCNICO - WhatsApp en Gestión por Lote

## RESUMEN EJECUTIVO

El proyecto tiene dos problemas principales que deben resolverse:
1. ❌ Error JSON "Unexpected token DOCTYPE" - el servidor retorna HTML en vez de JSON
2. ❌ Falta botón de WhatsApp en cada tarjeta individual

---

## PROBLEMA 1: Error JSON DOCTYPE

### Síntomas:
- Al intentar usar el modal de WhatsApp, aparece error "Unexpected token DOCTYPE is not valid JSON"
- El servidor retorna una página HTML en vez de JSON

### Posible Causa:
- Alguna ruta no está retornando JSON correcto
- Puede ser que haya un error 404 o 500 que retorna página de error HTML

### Solución Propuesta:
- Revisar las rutas API que se llaman desde el modal
- Agregar mejor manejo de errores en el frontend

---

## PROBLEMA 2: Botón WhatsApp en Cada Tarjeta

### Estado Actual:
- ✅ Solo existe botón "WhatsApp Masivo" en la fila superior
- ❌ NO hay botón de WhatsApp en cada tarjeta individual para enviar imagen

### Requisito del Usuario:
El usuario quiere que en cada tarjeta de solicitud haya un botón que:
1. Permita seleccionar una imagen
2. Al hacer clic, abra WhatsApp Web con la imagen lista para enviar
3. Guarde la gestión en la base de datos

### Solución Propuesta:
Agregar un nuevo botón en cada tarjeta individual que haga lo siguiente:

```javascript
// En la función renderizarSolicitudes(), agregar botón:
html += '<button class="btn-accion btn-whatsapp-img" onclick="abrirGestionWhatsApp(\'' + sol.id_solicitud + '\', \'' + (sol.celular || '') + '\')">📷 WhatsApp c/Imagen</button>';
```

Nueva función `abrirGestionWhatsApp()` que:
1. Permita seleccionar imagen del dispositivo
2. Abra WhatsApp Web con链接 wa.me/ numero ?text=... ?media=...
3. Guarde la gestión

---

## PLAN DE IMPLEMENTACIÓN

### Paso 1: Agregar botón WhatsApp con Imagen en cada tarjeta
- Modificar `renderizarSolicitudes()` en gestion-lote.js
- Agregar nuevo botón "📷 WhatsApp c/Imagen"
- Nueva función `abrirGestionWhatsApp(solicitudId, celular)`

### Paso 2: Función para abrir WhatsApp Web
- Usar API: `https://wa.me/${numero}?text=${mensaje}&media=${urlImagen}`
- O usar `whatsapp-web.js` para integración más avanzada

### Paso 3: Subir imagen al servidor
- Ya existe endpoint `/api/excel/upload-imagen`
- Guardar imagen primero, luego usar URL para WhatsApp

### Paso 4: Manejo de errores JSON
- Mejorar try-catch en las llamadas fetch
- Mostrar mensajes de error más claros

---

## ARCHIVOS RELATIVOS

| Archivo | Estado | Descripción |
|---------|--------|-------------|
| `public/desktop/js/gestion-lote.js` | ⚠️ | Falta botón individual |
| `public/css/gestion-lote.css` | ✅ | Input ahora visible |
| `src/controllers/excel.controller.js` | ✅ | Endpoint funciona |
| `src/routes/excel.routes.js` | ✅ | Rutas definidas |

---

## DEPENDENCIAS INSTALADAS

```json
{
  "better-sqlite3": "^11.7.0",
  "exceljs": "^3.4.0",
  "express": "^5.2.1",
  "multer": "^2.1.1"
}
```

### Opciones Futuras (no instaladas):
- `whatsapp-web.js` - para envío directo sin abrir navegador
- `twilio` - para API oficial de WhatsApp

---

## ESTADO ACTUAL (ACTUALIZADO)

### Implementaciones Completadas ✅

| Tarea | Estado | Notas |
|-------|--------|-------|
| Botón WhatsApp c/Imagen en cada tarjeta | ✅Completado | Botón agregado en renderizarSolicitudes() |
| Función abrirGestionWhatsApp() | ✅Completado | Modal con selector de imagen |
| Función enviarWhatsAppImagen() | ✅Completado | Sube imagen + guarda gestión + abre WhatsApp Web |
| WhatsApp Masivo con imagen | ✅Completado | Envío masivo con opción de imagen |
| Endpoint /api/excel/upload-imagen | ✅Completado | Sube imágenes al servidor |

### CáDigo Implementado

```javascript
// Botón en cada tarjeta (gestion-lote.js ~272)
html += '<button class="btn-accion btn-whatsapp-img" onclick="abrirGestionWhatsApp(\'' + sol.id_solicitud + '\', \'' + (sol.celular || '') + '\')">📷 WhatsApp c/Imagen</button>';

// Funciones implementadas:
// - abrirGestionWhatsApp(solicitudId, celular)
// - previsualizarWhatsAppImg(event)
// - quitarWhatsAppImg()
// - enviarWhatsAppImagen(solicitudId, celular)
// - previsualizarImagenWhatsApp(event)
// - ejecutarWhatsAppMasivo()
```

---

## PRÓXIMOS PASOS SUGERIDOS

1. [ ] Probar el flujo completo de WhatsApp con imagen
2. [x] Implementar botón WhatsApp c/Imagen - COMPLETADO
3. [x] Implementar función WhatsApp Web - COMPLETADO
4. [ ] Monitorear errores JSON en producción

---

¿Deseas que proceda con alguna otra mejora o que pruebe el flujo completo?
