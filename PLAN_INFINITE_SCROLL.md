# 📋 Infinite Scroll para Solicitudes - Implementado

## Resumen

Sistema de carga progresiva de solicitudes similar a TikTok.
Al hacer scroll, se cargan más datos automáticamente.

## Configuración

- **Carga inicial:** 50 registros
- **Carga adicional:** 100 registros por scroll
- **Tecnología:** Intersection Observer API

## Archivos Modificados

| Archivo | Descripción |
|---------|-------------|
| `src/controllers/excel.controller.js` | Endpoint con paginación (limite=50 por defecto) |
| `public/desktop/js/solicitudes.js` | Infinite scroll con Intersection Observer |
| `public/movil/js/solicitudes.js` | Infinite scroll para móvil |

## Comportamiento

1. Al cargar la página se muestran 50 solicitudes
2. Cuando el usuario hace scroll y llega al final, se cargan 100 más
3. El proceso se repite hasta que no hay más datos
4. Se muestra indicador de carga: "📜 Scroll para cargar más..."

## Endpoints

```
GET /api/excel/solicitudes?limite=50&offset=0
GET /api/excel/solicitudes?limite=100&offset=50
GET /api/excel/solicitudes?limite=100&offset=150
```

## Estados del Sentinel

- `📜 Scroll para cargar más...` - Hay más datos por cargar
- `⏳ Cargando más...` - Cargando datos
- `✅ No hay más registros` - Se cargaron todos los datos
