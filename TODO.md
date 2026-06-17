# TODO: Filtrado directo en servidor (Estado y Segmento)

## Objetivo
Hacer que los filtros de estado y segmento filtren directamente del servidor de base de datos, no del cache del navegador.

## Pasos completados:

- [x] 1. Análisis del código actual
- [x] 2. Plan de acción aprobado por el usuario
- [x] 3. Modificar `public/desktop/js/solicitudes.js`
      - Crear función `filtrarEnServidor()` 
      - Modificar `configurarEventosBotones()` para llamar al servidor

- [x] 4. Modificar `public/movil/js/solicitudes.js`
      - Ya tenía la función `filtrarEnServidor()` implementada
      - Funcionalidad verificada en `adjuntarEventos()`

## Pendiente:

- [ ] 5. Probar en escritorio y móvil

## Notas:
- La carga inicial de 50 resultados NO se ve afectada
- Infinite scroll sigue funcionando normalmente
- El buscador de texto ya usa el servidor
