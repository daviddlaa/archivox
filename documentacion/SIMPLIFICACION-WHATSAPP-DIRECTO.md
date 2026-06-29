# 💬 Simplificación: WhatsApp Directo (solo texto, sin imágenes)

## 🚨 Problema

La funcionalidad **"WhatsApp c/Imagen"** permitía seleccionar y subir una imagen al servidor para incluirla en el mensaje de WhatsApp. Esto generaba:

- **Duplicación de gestiones** (el Web Share API + fallback guardaban 2 veces)
- **Complejidad innecesaria** (subir imagen, preview, Web Share API, upload al servidor)
- **Problemas de UX** (la imagen no se enviaba directamente, solo un enlace)
- **Código difícil de mantener** (~80 líneas solo para enviar una imagen)

## ✅ Solución

Se eliminó completamente la funcionalidad de imágenes, dejando solo:

1. **Textarea** para escribir el mensaje
2. **Checkbox** para abrir WhatsApp automáticamente
3. **Botón Enviar** que: guarda la gestión → abre WhatsApp con el texto

## 🔧 Cambios realizados

### Archivos modificados

| Archivo | Cambios |
|---------|---------|
| `public/desktop/js/gestion-lote.js` | Simplificación completa (ver detalle abajo) |
| `public/movil/js/gestion-lote.js` | Simplificación completa (ver detalle abajo) |

### Funciones eliminadas

| Función | Motivo |
|---------|--------|
| `previsualizarWhatsAppImg()` | Ya no hay imagen que previsualizar |
| `quitarWhatsAppImg()` | Ya no hay imagen que quitar |
| `enviarWhatsAppImagen()` | Reemplazada por `enviarWhatsApp()` |
| `guardarGestionWhatsAppDesktop()` (desktop) | Lógica inline en `enviarWhatsApp()` |
| `guardarGestionWhatsApp()` (móvil) | Lógica inline en `enviarWhatsApp()` |

### Funciones simplificadas

| Función | Antes | Ahora |
|---------|-------|-------|
| `abrirGestionWhatsApp()` | Modal con: textarea + file input + preview + checkbox | Modal con: textarea + checkbox |
| `enviarWhatsApp()` (nueva) | No existía | Guarda texto → abre WhatsApp → recarga |

### Interfaz de usuario

| Elemento | Antes | Ahora |
|----------|-------|-------|
| Botón en card | `📷 WhatsApp c/Imagen` | `💬 WhatsApp Directo` |
| Título del modal | "📷 WhatsApp c/Imagen - Solicitud #X" | "💬 WhatsApp Directo - Solicitud #X" |
| Campos del modal | Textarea + Seleccionar imagen + Preview + Quitar imagen + Checkbox | Textarea + Checkbox |

## 📊 Código Antes vs Después

### Antes (~80 líneas para enviar)

```javascript
async function enviarWhatsAppImagen(solicitudId, celular) {
    var mensaje = ...;
    var file = ...;          // input file
    var checkbox = ...;
    
    if (!mensaje && !file) { ... }
    
    // Web Share API con imagen
    if (file && navigator.canShare) {
        await navigator.share({ files: [file], text: mensaje });
        await guardarGestionWhatsAppDesktop(...);
        // + flag shareCompletado
        // + guard post-share
        // + catch con AbortError
        return;
    }
    
    // Fallback: subir imagen al servidor
    var formData = new FormData();
    formData.append('imagen', file);
    var uploadResponse = await fetch('/api/excel/upload-imagen', ...);
    var uploadResult = await uploadResponse.json();
    var imagenUrl = uploadResult.url;
    
    // Guardar con URL de imagen
    await guardarGestionWhatsAppDesktop(solicitudId, mensaje, imagenUrl);
    
    // Abrir WhatsApp
    abrirWhatsAppDesktop(celular, textoConImagen);
}
```

### Después (~25 líneas para enviar)

```javascript
async function enviarWhatsApp(solicitudId, celular) {
    var mensaje = document.getElementById('whatsapp-img-mensaje').value.trim();
    var checkboxAbrir = document.getElementById('whatsapp-abrir-web');
    var abrirWeb = checkboxAbrir ? checkboxAbrir.checked : true;
    
    if (!mensaje) {
        alert('Escriba un mensaje para enviar');
        return;
    }
    
    var btn = document.getElementById('btn-whatsapp-img');
    btn.textContent = '⏳ Guardando...';
    btn.disabled = true;
    
    try {
        // Guardar gestión
        var response = await fetch('/api/excel/gestiones', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                solicitud_id: solicitudId,
                tipo_gestion: 'WhatsApp',
                observacion: mensaje,
                gestion_maestro_id: gestionId
            })
        });
        
        var resultado = await response.json();
        if (!response.ok || resultado.error) throw new Error(...);
        
        // Abrir WhatsApp
        if (abrirWeb) {
            abrirWhatsAppDesktop(celular, mensaje);
        }
        
        alert('✅ Gestión guardada');
        cerrarModal();
        await cargarDatosGestion();
        
    } catch (error) {
        alert('Error: ' + error.message);
    } finally {
        btn.textContent = '📤 Enviar';
        btn.disabled = false;
    }
}
```

## 🔄 Flujo corregido

```
┌──────────────────────────────────────┐
│      💬 WhatsApp Directo             │
├──────────────────────────────────────┤
│                                        │
│  1. Usuario escribe mensaje           │
│  2. Hace clic en "Enviar"             │
│  3. Se guarda la gestión (POST)       │
│  4. Se abre WhatsApp con el texto     │
│  5. Se recargan las cards             │
│                                        │
│  ✅ Simple, rápido, sin duplicados    │
│                                        │
└──────────────────────────────────────┘
```

## ✅ Beneficios

- **Código más simple** — de ~80 a ~25 líneas por función
- **Sin duplicación** — ya no hay Web Share + fallback
- **Sin uploads al servidor** — se eliminó la dependencia de `/api/excel/upload-imagen`
- **Mismo comportamiento** — WhatsApp se abre con el número y mensaje pre-llenado
- **Misma funcionalidad** — el usuario sigue pudiendo adjuntar imágenes manualmente en WhatsApp
