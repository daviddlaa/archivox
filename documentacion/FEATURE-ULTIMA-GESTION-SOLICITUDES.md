# Feature: Última Gestión visible en tarjetas de Solicitudes

## 📝 Descripción

Se agregó la visualización de la **última gestión realizada** directamente en las tarjetas de la página de Solicitudes, tanto en la versión móvil como en la de escritorio.

Anteriormente, para ver la última gestión de una solicitud, el usuario debía hacer clic en el botón "📋 Gestiones" y esperar a que se abriera el modal con el historial. Ahora la información de la última gestión se muestra directamente en la card.

## 🎯 Comportamiento

- Cada tarjeta de solicitud muestra ahora un resumen de la **última gestión** realizada
- Se muestra: **tipo de gestión** (badge con color), **fecha** y **observación** (truncada a 60 caracteres)
- Si la solicitud **no tiene gestión**, se muestra el texto _"Sin gestiones"_ en gris
- No requiere clics adicionales ni apertura de modales

## Visualización

**Escritorio:**
```
┌──────────────────────────────────────┐
│  #12345          [ACTIVADA]          │
│  Juan Pérez                          │
│  📍 1234567890   📱 0987654321      │
│  ────────────────────────────        │
│  📋 WhatsApp • 15/06/2026 14:30     │ ← NUEVO
│  "Hola Juan, le confirmamos..."      │ ← NUEVO
│  ────────────────────────────        │
│  🏷️ Segmento  📦 Producto  📅 Fecha │
│  [📋 Gestiones] [✏️ Completar]      │
└──────────────────────────────────────┘
```

**Móvil:**
```
┌─────────────────────┐
│ #12345  [ACTIVADA]  │
│ Juan Pérez          │
│ 📱 0987654321       │
│ 📋 WhatsApp 15/06   │ ← NUEVO
│ ──────────────────  │
│ [📞] [💬] [📋]      │
└─────────────────────┘
```

## 📁 Archivos modificados

### Backend
| Archivo | Cambio |
|---------|--------|
| `src/controllers/excel.controller.js` | Modificadas las funciones `listarSolicitudes` y `buscarSolicitudes` para incluir `LEFT JOIN` a la tabla `gestiones` y obtener la última gestión (tipo, observación, fecha) |

### Frontend - Escritorio
| Archivo | Cambio |
|---------|--------|
| `public/desktop/js/solicitudes.js` | Agregada sección de última gestión en `renderizarCards()` con badge de tipo, fecha y observación truncada |
| `public/desktop/css/solicitudes.css` | Nuevos estilos: `.cliente-ultima-gestion`, `.ultima-gestion-badge`, `.ultima-gestion-fecha`, `.ultima-gestion-obs` |

### Frontend - Móvil
| Archivo | Cambio |
|---------|--------|
| `public/movil/js/solicitudes.js` | Agregada sección de última gestión en el template de renderizado de cards |

## 🔧 Detalle técnico

### Backend SQL
Se utiliza `LEFT JOIN` con una subconsulta para obtener solo la última gestión (ORDER BY fecha_gestion DESC LIMIT 1) de cada solicitud:

```sql
SELECT s.*,
       g.tipo_gestion as ultima_gestion_tipo,
       g.observacion as ultima_gestion_obs,
       g.fecha_gestion as ultima_gestion_fecha
FROM solicitudes s
LEFT JOIN gestiones g ON g.id = (
    SELECT g2.id FROM gestiones g2 
    WHERE g2.solicitud_id = s.id_solicitud AND g2.usuario_id = s.usuario_id
    ORDER BY g2.fecha_gestion DESC LIMIT 1
)
WHERE s.usuario_id = $1
```

### Frontend
Los campos `ultima_gestion_tipo`, `ultima_gestion_obs` y `ultima_gestion_fecha` llegan desde el backend y se renderizan condicionalmente en cada card.

## ✅ Validación

- [ ] Las tarjetas de Solicitudes muestran la última gestión (tipo, fecha, observación)
- [ ] Las solicitudes sin gestión muestran "Sin gestiones"
- [ ] Funciona correctamente con búsqueda y filtros (estado/segmento)
- [ ] Funciona con infinite scroll (carga de más datos)
- [ ] La observación se trunca adecuadamente a 60 caracteres
- [ ] Funciona en escritorio y móvil
