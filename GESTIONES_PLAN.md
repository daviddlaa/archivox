# Plan: Convertir Tabla a Cards en Móvil - Gestiones

## Análisis del Problema
- En desktop, las gestines se muestran en tabla HTML (`.tabla-container`)
- En móvil, mostrar datos en tabla es poco práctico para los usuarios
- La página historial ya tiene解决这个问题 con cards para móvil

## Solución Implementar
Agregar estructura de cards para móvil, igual que historial.

---

## Paso 1: Modificar HTML (`public/desktop/gestiones.html`)

Agregar secciones de cards después de la tabla:

```html
<!-- Mobile Cards -->
<div class="gestiones-cards" id="cardsGestiones">
    <div class="loading">Cargando...</div>
</div>
```

---

## Paso 2: Modificar JS (`public/desktop/js/gestiones.js`)

Agregar función para renderizar cards:

```javascript
function renderizarCards(gestiones) {
    var container = document.getElementById('cardsGestiones');
    if (!gestiones || gestines.length === 0) {
        container.innerHTML = '<div class="empty">No hay gestines</div>';
        return;
    }
    var html = '';
    for (var i = 0; i < gestines.length; i++) {
        var g = gestines[i];
        html += '<div class="gestion-card">';
        html += '<div class="gestion-card-header">';
        html += '<span class="gestion-card-id">#' + g.solicitud_id + '</span>';
        html += '<span class="gestion-badge ' + g.tipo.toLowerCase() + '">' + g.tipo + '</span>';
        html += '</div>';
        html += '<div class="gestion-card-body">';
        html += '<p><strong>Cédula:</strong> ' + g.cedula + '</p>';
        html += '<p><strong>Nombre:</strong> ' + g.nombre + '</p>';
        html += '<p><strong>Obs:</strong> ' + g.observacion + '</p>';
        html += '</div>';
        html += '<div class="gestion-card-footer">';
        html += '📅 ' + g.fecha;
        html += '</div>';
        html += '</div>';
    }
    container.innerHTML = html;
}
```

Y llamar esta función junto con `renderizarTabla()`.

---

## Paso 3: Modificar CSS (`public/css/main.css`)

Agregar estilos para cards:

```css
/* Mobile Cards - hidden por defecto en desktop */
.gestiones-cards {
    display: none;
}

/* Estilos de card */
.gestion-card {
    background: white;
    border-radius: 12px;
    padding: 16px;
    margin-bottom: 12px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.08);
}

.gestion-card-header {
    display: flex;
    justify-content: space-between;
    margin-bottom: 12px;
}

.gestion-card-body p {
    margin: 4px 0;
    font-size: 14px;
}

.gestion-card-footer {
    font-size: 12px;
    color: #9ca3af;
    margin-top: 8px;
    padding-top: 8px;
    border-top: 1px solid #f3f4f6;
}
```

Agregar en media query:

```css
@media (max-width: 768px) {
    .tabla-container {
        display: none;
    }
    
    .gestiones-cards {
        display: flex;
        flex-direction: column;
    }
}
```

---

## Lista de Archivos a Editar

1. ✅ `public/desktop/gestiones.html` - Agregar HTML de cards
2. ✅ `public/desktop/js/gestiones.js` - Agregar función renderizarCards()
3. ✅ `public/css/main.css` - Agregar estilos CSS

## Orden de Implementación

1. Primero CSS (agregar estilos base)
2. Segundo HTML (agregar contenedor cards)
3. Tercero JS (agregar función y llamar ambas renderizaciones)

---

## Resultado Esperado

- **Desktop (>768px)**: Tabla tradicional
- **Móvil (<=768px)**: Cards amigables para tactil
