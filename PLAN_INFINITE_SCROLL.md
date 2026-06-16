# 📋 Plan de Acción - Infinite Scroll para Solicitudes

## Situación Actual

El código actualmente:
- Carga TODOS los datos (límite 10000) en una sola petición al iniciar
- Aplica filtros localmente
- Carga gestionessolo en batches de 25

**Problema identificado:**
- El usuario quiere que carguen todas las solicitudes pero con un sistema como TikTok: al hacer scroll se van cargando más datos progresivamente
- Actualmente muestra todo de una vez o solo 50 registros

---

## Plan de Implementación

### 1. Backend (excel.controller.js)

**Modificaciones necesarias:**
- Modificar `listarSolicitudes` endpoint para soportar paginación dinámica
- Agregar soporte para parámetros `limite` y `offset`
- Por defecto: primera carga 50, siguientes cargas 100

**Endpoint actual:**
```
GET /api/excel/solicitudes?limite=50&offset=0
```

### 2. Frontend Desktop (public/desktop/js/solicitudes.js)

**Modificaciones necesarias:**
- Agregar Intersection Observer para detectar cuando el usuario llega al final
- Implementar función para cargar más datos al hacer scroll
- Mostrar indicador de carga (spinner/texto)
- Mantener compatibilidad con filtros actuales

**Nueva lógica:**
- `init()`: Carga inicial de 50 registros
- `cargarMas()`: Carga 100 más al hacer scroll
- `aplicarFiltros()`: Aplica filtros locales y resetea la lista

### 3. Frontend Móvil (public/movil/js/solicitudes.js)

**Modificaciones necesarias:**
- Mismo sistema de infinite scroll
- Ajustar para viewport móvil
- Mantener funcionaliddes de tarjetas

### 4. Archivo de Documentación

**Crear:** `INFINITE_SCROLL.md`
- Explica la implementación
- Uso de Intersection Observer
- Configuración de paginación

---

## Archivos a Editar

| Archivo | Acción |
|---------|--------|
| `src/controllers/excel.controller.js` | Modificar `listarSolicitudes` |
| `public/desktop/js/solicitudes.js` | Agregar infinite scroll |
| `public/movil/js/solicitudes.js` | Agregar infinite scroll |
| `INFINITE_SCROLL.md` | Crear documentación |

---

## Pendiente

- ✅ Plan creado
- ⏳ Aprobación del usuario
- ⏳ Implementación backend
- ⏳ Implementación frontend desktop
- ⏳ Implementación frontend móvil
- ⏳ Documentation
- ⏳ Commit y push a GitHub
