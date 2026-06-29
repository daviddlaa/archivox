# Feature: Botón "📋 Historial" en Tarjetas de Gestión por Lotes

## 📋 Descripción

Se agregó un botón **"📋 Historial"** a cada tarjeta de solicitud en la página de Gestión por Lotes (desktop y móvil) que muestra un **modal con línea de tiempo (timeline)** de todas las gestiones históricas realizadas para esa solicitud.

## 🎯 ¿Qué hace?

1. El usuario hace clic en **"📋 Historial"** en cualquier card
2. Aparece un modal de carga mientras se obtienen los datos
3. Se llama al endpoint `GET /api/excel/gestiones/{solicitud_id}`
4. Se muestra un **timeline vertical** con:
   - **Dot de color** según el tipo de gestión
   - **Badge** con el tipo (WhatsApp, Llamada, Pendiente, etc.)
   - **Fecha** formateada en español
   - **Observación** de cada gestión
5. Ordenado de más reciente a más antigua

## 🖼️ Estructura visual del modal

```
📋 Historial - Solicitud #170617
📊 Total: 4 gestione(s)

● [WhatsApp] 28/6/2026 10:30     ← Más reciente
  ┃ se envio un mensaje en espera
  ┃
● [Llamada]  28/6/2026 09:15
  ┃ se realizo la llamda
  ┃
● [WhatsApp] 27/6/2026 16:00
  ┃ hola
  ┃
● [Pendiente] 27/6/2026 08:00    ← Más antigua
  ┃ Por gestionar
```

## 🔧 Archivos modificados

| Archivo | Cambio |
|---------|--------|
| `public/desktop/js/gestion-lote.js` | Botón "📋 Historial" + función `verHistorial()` con timeline |
| `public/movil/js/gestion-lote.js` | Mismo botón + función `verHistorial()` adaptada para móvil |

## 💻 Código agregado

### Botón en las cards (sección de acciones)

```javascript
// Botón historial para TODAS las cards
html += '<button class="btn-accion btn-historial" onclick="verHistorial(\'' + sol.id_solicitud + '\')">📋 Historial</button>';
```

Aparece en **todas las cards**, tanto las gestionadas como las pendientes, ya que incluso las pendientes pueden tener historial de gestiones previas.

### Función `verHistorial()`

```javascript
async function verHistorial(solicitudId) {
    try {
        // 1. Modal de carga
        crearModal('<div>⏳ Cargando...</div>');
        
        // 2. Obtener historial del backend
        var response = await fetch('/api/excel/gestiones/' + solicitudId);
        var gestiones = await response.json();
        
        // 3. Construir timeline HTML
        if (gestiones.length === 0) {
            // Mostrar "No hay gestiones registradas"
        } else {
            // Renderizar timeline con dots, líneas, badges y fechas
            for (var i = 0; i < gestiones.length; i++) {
                // Dot ● → línea ┃ → contenido (badge + fecha + observación)
            }
        }
        
        // 4. Reemplazar modal de carga con el timeline
        cerrarModal();
        crearModal(contenido);
        
    } catch (error) {
        cerrarModal();
        alert('Error al cargar el historial');
    }
}
```

## 🔌 Endpoint utilizado

**Ya existía** — no se modificó el backend:

- `GET /api/excel/gestiones/{solicitud_id}` → devuelve todas las gestiones de una solicitud
- Ruta: `src/routes/excel.routes.js`
- Controlador: `src/controllers/excel.controller.js` → `exports.getGestiones`
- Orden: `ORDER BY fecha_gestion DESC`

## 📱 Versión móvil

La versión móvil tiene el mismo comportamiento pero con:
- Tamaños de fuente más pequeños (12px en vez de 13px)
- Padding reducido
- Altura máxima del timeline: 350px (vs 450px en desktop)
- Misma estructura de timeline visual

## 🎨 Colores por tipo de gestión

| Tipo | Color |
|------|-------|
| Pendiente | `#fef3c7` (amarillo claro) |
| Llamada | `#d1fae5` (verde claro) |
| WhatsApp | `#dcfce7` (verde) |
| Seguimiento | `#dbeafe` (azul claro) |
| Cobranza | `#fee2e2` (rojo claro) |
| Cita | `#e0e7ff` (índigo claro) |
| Completada | `#bbf7d0` (verde intenso) |
