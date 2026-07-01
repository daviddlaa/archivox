# Feature: selección masiva en la vista móvil de Solicitudes

## Contexto
La versión móvil de Solicitudes no contaba con un control equivalente al de escritorio para seleccionar de forma masiva las solicitudes de la lista actual. Esto dificultaba el flujo de gestión por lotes desde dispositivos móviles.

## Objetivo
Agregar una opción en la vista móvil para seleccionar todas las solicitudes visibles en la lista actual, con el mismo propósito que el control de escritorio, manteniendo el comportamiento con filtros y búsqueda.

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

## Comportamiento esperado
1. Entrar a la vista móvil de Solicitudes.
2. Ver el nuevo botón “Seleccionar todo” junto al buscador.
3. Al presionarlo, se marcarán o desmarcarán todas las cards visibles de la lista actual.
4. El contador de seleccionadas se actualizará automáticamente.

## Nota de aprobación
Esta implementación queda lista para revisión. Si apruebas, se puede dejar preparada para pruebas funcionales en dispositivo móvil.
