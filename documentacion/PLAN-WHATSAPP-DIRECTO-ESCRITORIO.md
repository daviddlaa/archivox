# Plan de acción — WhatsApp Directo en Gestión por Lotes (Escritorio)

## Objetivo
Permitir que, desde la tarjeta de una solicitud en la versión de escritorio de Gestión por Lotes, el usuario pueda abrir un botón de WhatsApp Directo que:
1. Abra un modal.
2. Permita escribir o editar un mensaje.
3. Al hacer clic en Enviar, guarde la gestión y abra WhatsApp con el número de la solicitud.

## Alcance
- Se aplicará en la vista de escritorio de la página de Gestión por Lotes.
- El flujo debe funcionar sobre la tarjeta de cada solicitud.
- El mensaje debe poder ser editado antes de enviarlo.

## Plan de acción
1. Confirmar que la tarjeta de la solicitud tenga un botón de acción para WhatsApp Directo.
2. Implementar un modal con:
   - campo de texto para el mensaje,
   - información del cliente y del celular,
   - botón de cancelar y botón de enviar.
3. Al enviar:
   - validar que el mensaje no esté vacío,
   - guardar la gestión con tipo WhatsApp,
   - abrir WhatsApp con el número formateado y el texto del mensaje.
4. Mantener el comportamiento compatible con la lógica actual de formateo de números.
5. Validar el flujo en navegador y corregir errores de UX si aparecen.

## Archivos involucrados
- [public/desktop/js/gestion-lote.js](../public/desktop/js/gestion-lote.js)
- [public/desktop/gestion-lote.html](../public/desktop/gestion-lote.html)
- [public/css/gestion-lote.css](../public/css/gestion-lote.css)

## Comportamiento esperado
- El usuario pulsa el botón de WhatsApp Directo en la tarjeta.
- Se abre un modal con el mensaje pre-cargado y editable.
- El saludo del mensaje usa el nombre y apellido completo del cliente cuando está disponible.
- Al pulsar Enviar, se guarda la gestión y se abre WhatsApp.

## Criterios de aceptación
- El modal se abre correctamente desde la tarjeta.
- El mensaje se envía al chat correspondiente.
- La gestión queda registrada en el sistema.
- El flujo funciona sin bloquear la interfaz.
