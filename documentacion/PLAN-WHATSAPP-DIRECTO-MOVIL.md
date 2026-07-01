# Plan de acción — WhatsApp Directo en Gestión por Lotes (Móvil)

## Objetivo
Permitir que, desde la tarjeta de una solicitud en la versión móvil de Gestión por Lotes, el usuario pueda abrir un botón de WhatsApp Directo que:
1. Abra un modal.
2. Permita escribir o editar un mensaje.
3. Al hacer clic en Enviar, guarde la gestión y abra WhatsApp con el número de la solicitud.

## Alcance
- Se aplicará en la vista móvil de la página de Gestión por Lotes.
- El flujo debe funcionar sobre la tarjeta de cada solicitud.
- El mensaje debe poder ser editado antes de enviarlo.

## Plan de acción
1. Reutilizar el patrón del flujo de escritorio para mantener consistencia.
2. Implementar un modal adaptado a pantallas pequeñas con:
   - textarea para el mensaje,
   - información del cliente y del celular,
   - acciones de cancelar y enviar.
3. Al enviar:
   - validar que el mensaje no esté vacío,
   - guardar la gestión con tipo WhatsApp,
   - abrir WhatsApp mediante deep link o fallback compatible con móvil.
4. Ajustar el diseño para que el modal sea cómodo en pantallas reducidas.
5. Validar el flujo en navegador móvil o emulación.

## Archivos involucrados
- [public/movil/js/gestion-lote.js](../public/movil/js/gestion-lote.js)
- [public/movil/gestion-lote.html](../public/movil/gestion-lote.html)
- [public/movil/css/gestion-lote.css](../public/movil/css/gestion-lote.css)

## Comportamiento esperado
- El usuario pulsa el botón de WhatsApp Directo en la tarjeta.
- Se abre un modal con el mensaje pre-cargado y editable.
- El modal muestra tres opciones rápidas de mensaje para elegir una plantilla y rellenar automáticamente el textarea.
- El saludo del mensaje usa el nombre y apellido completo del cliente cuando está disponible.
- Al pulsar Enviar, se guarda la gestión y se abre WhatsApp.

## Criterios de aceptación
- El modal se abre correctamente desde la tarjeta móvil.
- El mensaje se envía correctamente al chat de WhatsApp.
- La gestión queda registrada en el sistema.
- La experiencia es funcional en pantallas pequeñas.
