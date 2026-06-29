# Fix: Botones de acción siempre visibles en tarjetas de Gestión por Lote

## 📅 Fecha
29 de junio de 2026

## 🐛 Problema

En las tarjetas de gestión por lote (tanto desktop como móvil), los botones de acción:
- 📞 Llamada
- 💬 WhatsApp
- 💬 WhatsApp Directo
- 📋 Seguimiento
- 💰 Cobranza
- ✅ Completar

**desaparecían** cuando la solicitud ya tenía una gestión registrada (estado !== 'Pendiente'), reemplazándose por un único botón "👁️ Ver Gestión".

### ❌ Comportamiento actual

```javascript
// renderizarSolicitudes()
var gestionada = estado !== 'Pendiente';

// ...

if (!gestionada) {
    // Muestra: Llamada, WhatsApp, WhatsApp Directo, Seguimiento, Cobranza, Completar
} else {
    // Muestra SOLO: Ver Gestión
}
// Muestra: Historial (siempre visible)
```

### ✅ Comportamiento esperado

Los botones de acción deben estar **siempre visibles** para todas las solicitudes, independientemente de su estado. Una solicitud puede recibir múltiples gestiones a lo largo del tiempo (llamada → seguimiento → cobranza → WhatsApp, etc.), por lo que no tiene sentido ocultar los botones cuando ya hay una gestión previa.

Además, el botón "👁️ Ver Gestión" también puede mostrarse siempre para consultar la última gestión registrada.

## 🔧 Cambios requeridos

### Archivo 1: `public/desktop/js/gestion-lote.js`
**Función:** `renderizarSolicitudes()`

**Cambio:** En la sección de acciones (`sol-acciones`), reemplazar el bloque `if (!gestionada) { ... } else { ... }` por:
1. Los 6 botones de acción siempre visibles
2. El botón "👁️ Ver Gestión" siempre visible (para consultar la última gestión)
3. El botón "📋 Historial" siempre visible

### Archivo 2: `public/movil/js/gestion-lote.js`
**Función:** `renderizarSolicitudes()`

Mismo cambio que en desktop.

### Código resultante aplicado (desktop):

```javascript
html += '<div class="sol-acciones">';

// Botones de acción SIEMPRE visibles
html += '<button class="btn-accion btn-llamar" onclick="abrirGestion(\'' + sol.id_solicitud + '\', \'Llamada\')">📞 Llamada</button>';
html += '<button class="btn-accion btn-whatsapp" onclick="abrirGestion(\'' + sol.id_solicitud + '\', \'WhatsApp\')">💬 WhatsApp</button>';
html += '<button class="btn-accion btn-whatsapp-img" onclick="abrirGestionWhatsApp(\'' + sol.id_solicitud + '\', \'' + (sol.celular || '') + '\')">💬 WhatsApp Directo</button>';
html += '<button class="btn-accion btn-seguimiento" onclick="abrirGestion(\'' + sol.id_solicitud + '\', \'Seguimiento\')">📋 Seguimiento</button>';
html += '<button class="btn-accion btn-cobranza" onclick="abrirGestion(\'' + sol.id_solicitud + '\', \'Cobranza\')">💰 Cobranza</button>';
html += '<button class="btn-accion btn-completar" onclick="abrirGestion(\'' + sol.id_solicitud + '\', \'Completada\')">✅ Completar</button>';

// Botón ver gestión SIEMPRE visible (si tiene gestión registrada)
if (gestionada) {
    html += '<button class="btn-accion btn-ver" onclick="verGestion(\'' + sol.id_solicitud + '\')">👁️ Ver Gestión</button>';
}

// Botón historial SIEMPRE visible
html += '<button class="btn-accion btn-historial" onclick="verHistorial(\'' + sol.id_solicitud + '\')">📋 Historial</button>';

html += '</div>';
```

## 📁 Archivos afectados

| Archivo | Descripción |
|---------|-------------|
| `public/desktop/js/gestion-lote.js` | Versión desktop - función `renderizarSolicitudes()` |
| `public/movil/js/gestion-lote.js` | Versión móvil - función `renderizarSolicitudes()` |

## 🧪 Validación

Después del cambio, verificar:
1. [ ] Las tarjetas con estado **Pendiente** muestran los 6 botones + Historial
2. [ ] Las tarjetas con estado **Llamada/WhatsApp/Seguimiento/Cobranza/Completada** muestran los 6 botones + (opcional) Ver Gestión + Historial
3. [ ] Al hacer clic en cualquier botón, se abre el modal de gestión correctamente
4. [ ] Al guardar una gestión, se recargan los datos y los botones siguen visibles
5. [ ] La versión móvil se comporta igual que la versión desktop
