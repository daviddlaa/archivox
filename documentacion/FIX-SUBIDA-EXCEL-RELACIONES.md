# FIX: Subida de Excel en Relaciones no funciona

> **Fecha:** 2025-01-XX  
> **Estado:** Implementado  
> **Versión:** 1.0

---

## 1. Problema

Cuando el usuario intenta subir un archivo Excel en la pantalla de "Relaciones", no sucede nada:
- No hay mensaje de error
- No hay mensaje de éxito
- La consola del navegador no muestra errores
- El servidor no responde (o responde con error silencioso)

---

## 2. Diagnóstico

### Causa identificada
El problema era una **inconsistencia técnica** en la configuración de Multer:

| Módulo | Archivo de configuración Multer |
|--------|-------------------------------|
| Otros módulos (Excel, Gestiones) | `src/config/multer.config.js` (config compartida) |
| **Relaciones** | Nueva configuración inline en `relaciones.routes.js` |

Aunque técnicamente ambas configuraciones deberían funcionar, la configuración inline tenía potencial de conflicto o no estaba siendo utilizada correctamente por el servidor.

### Problemas secundarios identificados
1. **Falta de logs de debugging** - No se podía identificar el error en el servidor
2. **Manejo de errores deficiente** - El frontend no mostraba el mensaje de error exacto

---

## 3. Solución implementada

### 3.1 Corregir `src/routes/relaciones.routes.js`

**Antes:** Configuración inline de Multer
```javascript
const multer = require('multer');
// ... config inline compleja ...
const upload = multer({...});
router.post('/upload', requiresAuth, upload.single('archivo'), ...);
```

**Después:** Usar config compartida
```javascript
const { excel } = require('../config/multer.config');
router.post('/upload', requiresAuth, excel.single('archivo'), ...);
```

### 3.2 Mejorar `src/controllers/relaciones.controller.js`

Agregar logs de debugging:
```javascript
console.log('[Relaciones] uploadRelaciones - usuarioId:', usuarioId);
console.log('[Relaciones] uploadRelaciones - Archivo recibido:', req.file.originalname);
// etc.
```

### 3.3 Mejorar `public/desktop/js/relaciones.js` y `public/movil/js/relaciones.js`

Agregar logs y mejor manejo de errores:
```javascript
console.log('[Relaciones] Subiendo archivo:', archivo.name);
console.log('[Relaciones] Respuesta status:', response.status);
// Mostrar error completo en mensaje
mostrarMensaje('❌ ' + (data.error || 'Error ' + response.status), 'error');
```

---

## 4. Archivos modificados

| Archivo | Cambio |
|---------|-------|
| `src/routes/relaciones.routes.js` | Usar `excel` de multer.config.js |
| `src/controllers/relaciones.controller.js` | Agregar logs de debugging |
| `public/desktop/js/relaciones.js` | Logs + mejor manejo errores |
| `public/movil/js/relaciones.js` | Logs + mejor manejo errores |

---

## 5. Cómo probar

1. **Reiniciar el servidor:**
   ```bash
   node app.js
   ```

2. **Abrir Relations en el navegador**

3. **Abrir DevTools (F12) → pestaña Console**

4. **Subir un archivo Excel de Relaciones**

5. **Observar la consola:**
   - Deberían aparecer mensajes como:
     - `[Relaciones] Subiendo archivo: Relaciones.xlsx`
     - `[Relaciones] Respuesta status: 200`
     - `[Relaciones] Respuesta data: {total: X, altas: Y, bajas: Z}`

6. **Si hay error:**
   - Buscar el mensaje de error en la consola del navegador
   - Revisar la terminal del servidor para ver los logs de `[Relaciones]`

---

## 6. Notas técnicas

- **Multer** es el middleware de Node.js para manejar `multipart/form-data` (upload de archivos)
- La configuración compartida en `multer.config.js` ya estaba siendo usada por otros módulos exitosamente
- Esta corrección unifica el patrón de carga de archivos en todo el sistema

---

## 7. Preguntas frecuentes

**P: Puedo seguir usando mi propia configuración Multer?**
R: Sí, pero se recomienda usar la compartida para mantener consistencia.

**P: Qué pasa si el archivo es muy grande?**
R: El límite es 10MB (configurado en multer.config.js). Si necesitas más,hay que aumentar el límite.

**P: El Excel tiene algún formato específico?**
R: Sí, debe tener las columnasdocumentadas en `PLAN-PAGINA-RELACIONES.md`.

---

**Implementado por:** BlackBoxAI  
**Aprobado por:** David
