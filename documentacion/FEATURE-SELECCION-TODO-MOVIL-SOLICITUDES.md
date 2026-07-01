# Feature: selección masiva en la vista móvil de Solicitudes

## Contexto
La versión móvil de Solicitudes no contaba con un control equivalente al de escritorio para seleccionar de forma masiva las solicitudes de la lista actual. Esto dificultaba el flujo de gestión por lotes desde dispositivos móviles.
Además, en la vista de escritorio se detectó que el botón inline de campañas presentaba alineación visual y texto poco claro, por lo que se ajustó para un mejor uso del flujo de creación de campañas.

## Objetivo
Agregar una opción en la vista móvil para seleccionar todas las solicitudes visibles en la lista actual, con el mismo propósito que el control de escritorio, manteniendo el comportamiento con filtros y búsqueda.
También mejorar la experiencia en la vista de escritorio del botón inline de campañas, corrigiendo su alineación visual y renombrando la acción a “Crear campaña”.

## Solución implementada
- Se añadió un botón de selección global en la barra de búsqueda de la vista móvil.
- El botón permite:
  - seleccionar todas las solicitudes visibles en la lista actual;
  - deseleccionar todas si ya estaban seleccionadas;
- La lógica respeta el estado actual de la vista filtrada/buscada y actualiza el contador de solicitudes seleccionadas.
- La selección se mantiene consistente con las cards renderizadas y con los botones de acción de gestión.

## Archivos modificados
- public/movil/solicitudes.html
- public/movil/js/solicitudes.js
- public/desktop/solicitudes.html
- public/desktop/css/solicitudes.css
- public/desktop/js/solicitudes.js

## Comportamiento esperado
1. Entrar a la vista móvil de Solicitudes.
2. Ver el nuevo botón “Seleccionar todo” junto al buscador.
3. Al presionarlo, se marcarán o desmarcarán todas las cards visibles de la lista actual.
4. El contador de seleccionadas se actualizará automáticamente.

## Nota de aprobación
Esta implementación queda lista para revisión. Si apruebas, se puede dejar preparada para pruebas funcionales en dispositivo móvil.

## Ajuste adicional aplicado en escritorio
- Se corrigió el alineado del botón inline de campañas en la vista de escritorio para que el icono quede centrado dentro del círculo/botón.
- Se cambió la etiqueta visible a “Crear campaña” y el tooltip al mismo texto para mayor claridad.
- Se ajustó el texto del encabezado del modal asociado para reflejar el nuevo nombre de la acción.

## Ajuste adicional aplicado en móvil
- Se ajustó el botón flotante de la vista móvil para mostrar la etiqueta “Crear campaña” junto al icono.
- Se corrigió la alineación del cohete para que quede centrado visualmente dentro del botón.
- Se actualizó el encabezado del modal móvil para usar el mismo nombre de acción.
- Verificación realizada: no se reportaron errores en los archivos modificados.

## Solicitud de aprobación
¿Aprobas este ajuste para dejarlo listo en la rama de trabajo?
