# Feature: Mensaje Predeterminado en WhatsApp Directo

## Objetivo
Al abrir el modal de **WhatsApp Directo** en la página de gestión por lotes (campañas), el textarea del mensaje se pre-carga automáticamente con un mensaje predeterminado que incluye el **primer nombre** del cliente extraído del nombre completo.

## Problema resuelto
El nombre del cliente está almacenado en un solo campo (`nombre` = nombre completo, ej: "Juan Pérez García"). Se necesitaba mostrar solo el **primer nombre** (ej: "Juan") en el saludo del mensaje de WhatsApp.

## Solución implementada
Se crearon dos funciones auxiliares:

### 1. `obtenerPrimerNombre(nombreCompleto)`
Extrae la primera palabra del nombre completo:
```javascript
function obtenerPrimerNombre(nombreCompleto) {
    if (!nombreCompleto) return '';
    var partes = nombreCompleto.trim().split(' ');
    return partes[0] || '';
}
```
- Si el nombre es `"Juan Pérez García"` → retorna `"Juan"`
- Si el nombre es `"María"` → retorna `"María"`
- Si está vacío → retorna `""`

### 2. `generarMensajeWhatsApp(nombreCompleto)`
Genera el mensaje completo con el saludo personalizado:
```javascript
function generarMensajeWhatsApp(nombreCompleto) {
    var primerNombre = obtenerPrimerNombre(nombreCompleto);
    var saludo = primerNombre ? 'Hola ' + primerNombre + ' 👋' : 'Hola 👋';
    return saludo + '\nResuelve Crédito Resuelve a las órdenes 💳✨\n\n...';
}
```

### Mensaje generado
```
Hola Juan 👋
Resuelve Crédito Resuelve a las órdenes 💳✨

Tu crédito rescate puede estar aprobado con solo el 15% de entrada 🙌
Pregúntanos qué necesitas para tu hogar y te ayudamos a hacerlo posible 📲
```

## Archivos modificados

| Archivo | Cambio |
|---------|--------|
| `public/desktop/js/gestion-lote.js` | Se añadieron `obtenerPrimerNombre()` y `generarMensajeWhatsApp()`. Se modificó `abrirGestionWhatsApp()` para pre-cargar el mensaje. |
| `public/movil/js/gestion-lote.js` | Mismos cambios que en escritorio. |

## Comportamiento

1. El usuario hace clic en **💬 WhatsApp Directo** en cualquier tarjeta de solicitud.
2. Se abre el modal con el textarea del mensaje **pre-cargado** con el mensaje predeterminado.
3. El mensaje incluye el primer nombre del cliente (`"Hola Juan 👋 ..."`).
4. El usuario puede **editar** el mensaje antes de enviarlo si lo desea.
5. Al hacer clic en "📤 Enviar", se guarda la gestión con el mensaje como observación y se abre WhatsApp.

## Notas
- El textarea cambió de `rows="3"` a `rows="5"` para dar más espacio al mensaje predeterminado.
- Si no hay nombre disponible, el saludo muestra solo `"Hola 👋"`.
