# FEATURE - Copiar Nombre Completo + Cédula en Gestión por Lotes

## Objetivo
Permitir que el usuario copie al portapapeles el nombre completo del cliente junto con su cédula directamente desde la tarjeta de gestión por lotes, tanto en escritorio como en móvil.

## Archivos modificados
- `public/desktop/js/gestion-lote.js`
- `public/movil/js/gestion-lote.js`
- `public/css/gestion-lote.css`
- `public/movil/gestion-lote.html`

## Cambios realizados
- Se agregó un comportamiento click en el elemento del nombre del cliente (`sol-nombre`) dentro de las tarjetas de gestión por lotes.
- Al tocar/clickear el nombre, se copia al portapapeles el texto:
  - `Nombre Completo - Cédula`
- Se agregó la función `copiarNombreCedula(nombre, cedula)` a los scripts de gestión por lotes.
- Se mantuvo la funcionalidad existente de copiar cédula y teléfono de forma independiente.
- Se añadió estilo visual de botón clicable para el nombre:
  - cursor pointer
  - color azul
  - underline al hover

## Resultado
- En escritorio y móvil, el usuario puede copiar rápidamente el nombre completo y la cédula.
- El mensaje de confirmación indica que el contenido fue copiado al portapapeles.

## Cómo verificar
1. Abrir la página de gestión por lotes.
2. Seleccionar una campaña y mostrar las tarjetas de solicitudes.
3. Hacer clic o tocar el nombre del cliente.
4. Verificar que se copia el valor `Nombre Completo - Cédula`.
5. Probar también los botones individuales de copiar cédula y teléfono para confirmar que no se rompió ninguna funcionalidad.
