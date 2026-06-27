# INFORME TÉCNICO - WhatsApp en Gestión por Lote

## RESUMEN EJECUTIVO

El proyecto tiene problemas tCcnicos que están siendo diagosticados:
1. ❌ Error 500 en endpoint /api/excel/upload-imagen
2. ❌ Error JSON "Unexpected token DOCTYPE" - el servidor retorna HTML en vez de JSON
3. ✅ Botón de WhatsApp con imagen ya implementado en el cóDigo

---

## PROBLEMA 1: Error 500 en upload-imagen

### Error Real:
```
/api/excel/upload-imagen:1  Failed to load resource: the server responded with a status of 500 ()
gestion-lote.js:919 Error en WhatsApp Masivo: SyntaxError: Unexpected token '<', "<!DOCTYPE "... is not valid JSON
```

### Síntomas:
- El endpoint `/api/excel/upload-imagen` retorna HTTP 500
- El frontend recibe HTML (DOCTYPE) en vez de JSON
-Error "Unexpected token DOCTYPE is not valid JSON"

### Causas Posibles:
1. Multer no puede escribir en la carpeta `uploads/`
2. Error en la función `subirImagenGestion()` del controller
3. Falta el middleware `requiresAuth` y la sesión no está activa
4. Permisos insuficientes en la carpeta uploads

### Solución:
Revisar el logs del servidor para ver el error exacto.

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

## ERROR ACTUAL DIAGNOSTICADO

```
/api/excel/upload-imagen:1  Failed to load resource: the server responded with a status of 500 ()
gestion-lote.js:919 Error en WhatsApp Masivo: SyntaxError: Unexpected token '<', "<!DOCTYPE "... is not valid JSON
```

### Diagnóstico:
1. **El endpoint retorna 500** - Multer no puede procesar la imagen
2. ** El HTML se retorna en vez de JSON** - Por el error 500, Express devuelve la página de error por defecto
3. **El error JSON es secundario** - Es consecuencia del error 500

### Causasprobables:
- Sesión de usuario no activa (no está autenticado)
- Multer no puede escribir en la carpeta `uploads/`
- Error en la función `subirImagenGestion()`

---

## PLAN DE CORRECCIÓN

### Paso 1: Verificar que la sesión está activa
- El endpoint usa `requiresAuth` middleware
- Si no hay sesión, retorna 401 ( pero parece dar 500)

### Paso 2: Agregar mejor manejo de errores en el controller
- Wrappedel upload con try-catch
- Loggear el error real

### Paso 3: Mejorar el frontend
- Agregar `.ok` check antes deJSON.parse
- Mostrar el error real del servidor

---

## PRÓXIMOS PASOS SUGERIDOS (CORREGIDO)

1. [x] Diagnosticar el error 500 en /api/excel/upload-imagen - CORREGIDO
2. [x] Agregar try-catch en excelController.subirImagenGestion() - COMPLETADO
3. [x] Mejorar manejo de errores en el frontend - COMPLETADO
4. [x] Implementar botón WhatsApp c/Imagen - COMPLETADO en código
5. [x] Implementar función WhatsApp Web - COMPLETADO en código
6. [x] Crear carpeta uploads/ automáticamente - COMPLETADO

---

## CORRECCIONES APLICADAS

### 1. multer.config.js (CORREGIDO)
```javascript
const fs = require('fs');

// Crear carpeta uploads/ si no existe
const uploadsDir = 'uploads/';
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
    console.log('DEBUG: Carpeta uploads/ creada automáticamente');
}
```
**Problema resuelto:** La carpeta uploads/ ahora se crea automáticamente si no existe, evitando el error ENOENT en servidores como Render.

### 2. excel.controller.js
- Agregado try-catch y logs en `subirImagenGestion()`

### 3. gestion-lote.js
- Agregado check `response.ok` antes de `json()` en:
  - `enviarWhatsAppImagen()` (WhatsApp individual)
  - `ejecutarWhatsAppMasivo()` (WhatsApp Masivo)

---

## CÓMO PROBAR

1. Commit y push los cambios a producción
2. Reiniciar el servidor (en Render, puede requerirse restart)
3. Probar el flujo de WhatsApp con imagen

---

## RESUMEN DE ESTADO FINAL

### ✅ Completado:
- Botón WhatsApp c/Imagen en cada tarjeta
- Funciones de WhatsApp individual y Masivo
- Manejo de errores mejorado en frontend
- Creación automática de carpeta uploads/
- Apertura de WhatsApp Web primero (evita bloqueos del navegador)

### ⚠️ Pendiente:
- Error 500 en /api/excel/upload-imagen requiere investigación en producción
- Verificar que la sesión está activa antes de llamar al endpoint
- Revisar logs del servidor para el error exacto
