# Plan de reestructuración de tarjetas - Gestión por Lotes

## Objetivo
Reorganizar las tarjetas de la página de gestión por lotes para que el flujo principal sea el seguimiento, reduciendo la saturación visual de botones y dejando un acceso más práctico para llamadas directas en móvil, copia de datos y acciones rápidas.

## Cambios propuestos

### 1. Reducción de botones en la tarjeta
Se eliminarán de la vista de tarjetas los botones de:
- Llamada
- WhatsApp
- Cobranza
- Completar

Estos accesos quedarán concentrados en el botón principal de seguimiento, que será el punto central para abrir el modal y registrar la observación correspondiente.

### 2. Botón principal de seguimiento
Se mantendrá un botón principal de seguimiento visible en todas las tarjetas con el texto:
- Seguimiento

Al pulsarlo se abrirá el modal de gestión con el tipo de gestión preseleccionado en Seguimiento y el campo de observación listo para escribir.

### 3. Botón de llamada directa solo en móvil
Se añadirá un botón de llamada directa únicamente en la vista móvil, con comportamiento de apertura del dialer del teléfono.

Este botón será el único acceso rápido de llamada y no aparecerá en la versión de escritorio.

### 4. Acciones auxiliares de copia
Se dejarán espacios visuales para acciones útiles de copia rápida:
- Copiar cédula
- Copiar teléfono

Estas acciones serán accesibles desde la tarjeta para facilitar uso en llamadas y mensajes.

### 5. Reordenación visual
La tarjeta quedará más limpia con:
- encabezado con ID y estado
- datos del cliente
- observación visible
- botones compactos y de prioridad menor

### 6. Comportamiento del modal
El modal de gestión seguirá siendo el punto de registro principal, pero se simplificará para que el usuario entre por seguimiento y complete la observación.

## Implementación prevista

### Desktop
- Se eliminarán los botones de llamada, WhatsApp, cobranza y completar de la tarjeta.
- Se dejará un botón principal de seguimiento.
- Se incorporarán botones compactos para copiar cédula y teléfono.
- Se mantendrá el historial y la visualización de gestión existente.

### Móvil
- Se eliminarán los botones de llamada, WhatsApp, cobranza y completar de la tarjeta.
- Se añadirá un botón de llamada directa que abra el dialer.
- Se dejará un botón principal de seguimiento.
- Se incorporarán botones compactos para copiar cédula y teléfono.

## Criterios de aceptación
- La tarjeta se ve menos saturada visualmente.
- El seguimiento es el botón principal de la tarjeta.
- En móvil existe un acceso claro para llamar directamente.
- Se pueden copiar cédula y teléfono desde la tarjeta.
- El flujo sigue siendo claro para registrar observaciones.

## Notas de implementación
- El cambio debe aplicarse en ambos renderizados de tarjetas: escritorio y móvil.
- El comportamiento del modal debe mantenerse consistente con el tipo de gestión seleccionada.
- Se recomienda usar botones compactos y colores suaves para evitar saturación.
