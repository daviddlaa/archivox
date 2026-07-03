# FIX - Página Importar Móvil

## Objetivo
Adaptar la página de importación de archivos Excel en la versión móvil para que deje de ser una copia de escritorio y use la UI móvil del resto de la aplicación.

## Archivos modificados
- `public/movil/importar.html`
- `public/movil/css/importar.css`
- `public/movil/js/importar.js`

## Cambios realizados
- `public/movil/importar.html`
  - Se agregó un header móvil con botón de menú.
  - Se reorganizó el contenido en una tarjeta móvil con texto descriptivo.
  - Se mantuvo la navegación inferior (`nav-bottom`) propia del mobile.
  - Se corrigieron rutas internas a la versión móvil (`/m/solicitudes`).

- `public/movil/css/importar.css`
  - Se creó un archivo de estilos específico para la página de importación móvil.
  - Se diseñaron estilos para el input de archivo, botón de subida y mensajes.
  - Se aseguró el comportamiento responsive para pantallas pequeñas.

- `public/movil/js/importar.js`
  - Se limpió el código heredado de escritorio.
  - Se mantuvo la lógica de selección de archivos y envío de formulario.
  - Se mantuvieron los reportes de éxito y actualización con enlaces móviles.

## Resultado
- La página de importar móvil tiene diseño y navegación coherente con la versión móvil.
- El usuario puede seleccionar archivos Excel, ver el estado de carga y navegar a solicitudes desde móvil.

## Cómo verificar
1. Abrir `/m/importar` en la versión móvil.
2. Verificar que el header y la navegación sean móviles.
3. Seleccionar archivos `.xlsx` o `.xls` y enviar.
4. Confirmar que el formulario muestra el estado y habilita el enlace a `/m/solicitudes`.
