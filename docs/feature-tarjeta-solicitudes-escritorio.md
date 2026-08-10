# 🃏 Feature: Tarjeta de Solicitudes en Escritorio — Limpieza y Fixes

**Fecha:** Agosto 2026  
**Módulo:** Solicitudes (escritorio)  
**Archivos principales:** `public/desktop/js/solicitudes.js`, `public/desktop/css/solicitudes.css`  
**Relacionado con:** `docs/feature-panel-lateral-solicitudes.md` (panel lateral de detalle)

---

## 📑 Índice

1. [Resumen](#1-resumen)
2. [Problemas detectados](#2-problemas-detectados)
3. [Cambio 1: Botón Llamar eliminado en escritorio](#3-cambio-1-botón-llamar-eliminado-en-escritorio)
4. [Cambio 2: Cédula y teléfono visibles en la tarjeta](#4-cambio-2-cédula-y-teléfono-visibles-en-la-tarjeta)
5. [Cambio 3: Fix del "checkbox duplicado"](#5-cambio-3-fix-del-checkbox-duplicado)
6. [Archivos involucrados](#6-archivos-involucrados)
7. [Verificación](#7-verificación)
8. [Compatibilidad](#8-compatibilidad)

---

## 1. Resumen

Se hicieron 3 ajustes a la tarjeta de solicitudes de **escritorio**:

- **Se eliminó el botón "📞 Llamar"** en toda la versión escritorio (tarjeta **y** panel lateral de detalle). El móvil **conserva** su botón.
- **La cédula y el teléfono ahora se muestran explícitos** en la tarjeta, uno al lado del otro, debajo del nombre (antes solo se veían abriendo el panel de detalle).
- **Se corrigió el "checkbox duplicado"**: al marcar una tarjeta aparecía un ✓ morado en la esquina superior derecha (además del checkbox real a la izquierda). Se ocultó **solo en escritorio**.

---

## 2. Problemas detectados

1. El botón "📞 Llamar" era redundante en escritorio (el usuario quería ver el número, no un botón de llamada).
2. La cédula y el teléfono no eran visibles en la tarjeta sin abrir el panel de detalle.
3. Al marcar el checkbox (izquierda), aparecía un **✓ en círculo morado** en la esquina superior **derecha** de la tarjeta. Se percibía como "otro checkbox del otro lado de la tarjeta".

---

## 3. Cambio 1: Botón Llamar eliminado en escritorio

Se eliminó el botón en **dos lugares** de `public/desktop/js/solicitudes.js`:

### 3.1 En la tarjeta (`renderizarCards`)

Antes (3 botones):

```javascript
// FILA 3: Botones de acción
html += '  <div class="card-fila-3">';
html += '    <button class="card-btn btn-gestiones" ...>📋 Gestiones</button>';
html += '    <button class="card-btn btn-llamar" onclick="...llamarClienteDesktop(...)">📞 Llamar</button>'; // ❌ eliminado
html += '    <button class="card-btn btn-whatsapp" ...>💬 WhatsApp</button>';
html += '  </div>';
```

Después (2 botones: Gestiones y WhatsApp, que se reparten el ancho con `flex: 1`):

```javascript
html += '  <div class="card-fila-3">';
html += '    <button class="card-btn btn-gestiones" ...>📋 Gestiones</button>';
html += '    <button class="card-btn btn-whatsapp" ...>💬 WhatsApp</button>';
html += '  </div>';
```

### 3.2 En el panel lateral de detalle (`renderPanelDetalle`)

Antes:

```javascript
html += '<div class="panel-acciones">';
html += '  <button class="panel-accion-btn" onclick="llamarClienteDesktop(...)">📞 <span>Llamar</span></button>'; // ❌ eliminado
html += '  <button class="panel-accion-btn" onclick="whatsAppClienteDesktop(...)">💬 <span>WhatsApp</span></button>';
html += '</div>';
```

Después (queda solo WhatsApp, ocupa el ancho completo de la fila):

```javascript
html += '<div class="panel-acciones">';
html += '  <button class="panel-accion-btn" onclick="whatsAppClienteDesktop(...)">💬 <span>WhatsApp</span></button>';
html += '</div>';
```

### 3.3 Limpieza de código muerto

La función `llamarClienteDesktop()` quedó **sin usos** tras eliminar los dos botones, por lo que se eliminó por completo:

```javascript
// ❌ Eliminada (ya no hay ninguna referencia)
function llamarClienteDesktop(celular) {
    if (!celular) { alert('No hay número de celular'); return; }
    var numeroLimpio = celular.replace(/\D/g, '');
    if (!numeroLimpio) { alert('No hay número de celular'); return; }
    window.open('tel:' + numeroLimpio, '_self');
}
```

Verificado con `grep` que no queda ninguna referencia a `llamarClienteDesktop` ni a `btn-llamar` en `public/desktop/`.

---

## 4. Cambio 2: Cédula y teléfono visibles en la tarjeta

Se agregó una **nueva fila** (2.5) en `renderizarCards()` justo debajo del nombre, con los números **uno al lado del otro**:

```javascript
// FILA 2.5: Cédula + Teléfono (números explícitos, uno al lado del otro)
html += '  <div class="card-fila-contacto">';
html += '    <span class="card-contacto-item" title="Cédula: ' + (item.cedula || '') + '">🪪 <span>' + (item.cedula || '—') + '</span></span>';
html += '    <span class="card-contacto-item" title="Teléfono: ' + (item.celular || '') + '">📞 <span>' + (item.celular || '—') + '</span></span>';
html += '  </div>';
```

### Estilos nuevos en `public/desktop/css/solicitudes.css`

```css
.card-fila-contacto {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 10px;
    flex-wrap: nowrap;
    overflow: hidden;
    min-width: 0;
}

.card-fila-contacto .card-contacto-item {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    background: #f8fafc;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    padding: 4px 10px;
    font-size: 12px;
    font-weight: 600;
    color: #1f2937;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    min-width: 0;
    flex: 1 1 auto;   /* ambos items pueden encoger si el número es largo */
}

.card-fila-contacto .card-contacto-item span {
    font-weight: 700;
    color: #111827;
}
```

Ambos items usan `flex: 1 1 auto` + `min-width: 0` para que, si la cédula o el teléfono son largos, se repartan el espacio y se recorten con elipsis en lugar de desbordar la tarjeta.

---

## 5. Cambio 3: Fix del "checkbox duplicado"

### Causa raíz

El CSS **compartido** `public/css/solicitudes.css` define un pseudo-elemento que pinta un **✓ en círculo morado** en la esquina superior derecha de la tarjeta cuando está seleccionada:

```css
.solicitud-card.seleccionada::after {
    content: '✓';
    position: absolute;
    top: 8px;
    right: 8px;
    width: 22px;
    height: 22px;
    border-radius: 50%;
    background: #4f46e5;
    color: white;
    display: flex;              /* ← re-declara display */
    ...
}
```

En **escritorio** esto se veía como "otro checkbox al otro lado de la tarjeta", redundante con el checkbox real (izquierda) y el borde azul.

⚠️ **Importante:** en **móvil no existe checkbox** — la selección se hace tocando la tarjeta, por lo que ese ✓ es el **único indicador visual de selección**. No se puede borrar del CSS compartido sin romper móvil.

### Solución

Override **solo en escritorio** (`public/desktop/css/solicitudes.css`), con especificidad mayor para ganarle al CSS compartido (que se carga después):

```css
/* FIX: Ocultar el checkmark superpuesto (::after) solo en escritorio.
   El checkbox real a la izquierda + el borde azul ya indican la selección.
   En móvil se mantiene porque ahí la selección es tocando la tarjeta (sin checkbox). */
body .solicitud-card.seleccionada::after {
    display: none;
}
```

- Especificidad del override: `body .solicitud-card.seleccionada::after` = **(0,2,2)**.
- Especificidad de la regla compartida: `.solicitud-card.seleccionada::after` = **(0,2,1)**.
- El override gana **independientemente del orden de carga** de los CSS (el compartido se carga después en el HTML y re-declara `display: flex`, pero con menor especificidad).

### Resultado visual en escritorio

Al seleccionar una tarjeta queda indicado por:
1. Checkbox real marcado (izquierda) ✔
2. Borde azul `#4f46e5` ✔
3. Fondo claro `#f8faff` ✔

Ya **no** aparece el ✓ superpuesto en la esquina derecha.

---

## 6. Archivos involucrados

| Archivo | Cambio |
|---------|--------|
| `public/desktop/js/solicitudes.js` | Botón Llamar eliminado (tarjeta + panel), fila cédula/teléfono agregada, función `llamarClienteDesktop()` eliminada |
| `public/desktop/css/solicitudes.css` | Nuevos estilos `.card-fila-contacto` / `.card-contacto-item` y override `body .solicitud-card.seleccionada::after { display: none; }` |

### Limpieza de CSS legacy (misma sesión)

Se eliminaron ~150 líneas de CSS **muerto** de `public/desktop/css/solicitudes.css` (vista de tabla antigua, tarjeta vieja duplicada y layout antiguo de página). Verificado con `grep` que ninguna clase eliminada se usa en el HTML, el JS de la página ni los JS compartidos. Ver `docs/convencion-css-solicitudes.md` para la convención de propiedad de archivos CSS.

**No modificados:** `public/movil/` (móvil intacto), `public/css/solicitudes.css` (CSS compartido intacto).

---

## 7. Verificación

- `node --check public/desktop/js/solicitudes.js` → sin errores de sintaxis.
- `grep` sobre `public/desktop/` → sin referencias residuales a `llamarClienteDesktop`, `btn-llamar` ni al botón Llamar.
- Revisión de código: especificidad del override CSS confirmada correcta; selección visual no se pierde (checkbox + borde + fondo).
- ⏳ Pendiente: prueba visual en navegador (requiere servidor local con sesión iniciada).

---

## 8. Compatibilidad

| Plataforma | Botón Llamar | Cédula/Teléfono en tarjeta | ✓ superpuesto al seleccionar |
|------------|:---:|:---:|:---:|
| **Escritorio** | ❌ Eliminado | ✅ Visible | ❌ Oculto (fix) |
| **Móvil** | ✅ Conserva | No aplica (estructura propia) | ✅ Se mantiene (indicador de selección) |
