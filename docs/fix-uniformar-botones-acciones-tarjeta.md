# Fix: Uniformar botones de acciones en tarjetas de campañas (escritorio)

> **Estado:** ✅ Implementada
> **Fecha:** 27/08/2026
> **Ámbito:** Escritorio — `public/desktop/js/gestion-lote.js`, `public/css/gestion-lote.css`

---

## 1. Contexto

En las tarjetas de campañas (gestión por lote), los botones de la barra de acciones tenían dos estilos visuales diferentes:

- **Botones de texto plano** (`btn-accion`): Seguimiento y Directo — diseño horizontal con fondo coloreado, sin icono propio.
- **Botones de icono vertical** (`sol-accion-icon-btn`): Historial, No aplica, Quitar — diseño vertical con icono arriba y label abajo.

Además, el botón de **abrir chat WhatsApp** (💬) estaba ubicado en la sección de datos de la solicitud (`sol-datos`), junto al teléfono, como un simple ícono sin etiqueta. Esto lo hacía poco discoverable y visualmente inconsistente con el resto de acciones.

## 2. Cambio

### Antes
```
Datos: [🆔 cédula] [📱 teléfono] [💬]  ← icono suelto sin label

Acciones: [📋 Seguimiento] [💬 Directo] [📋 Historial] [👎 No aplica] [❌ Quitar]
           ──────────────────           ────────────────────────────────────────────
           estilo horizontal             estilo vertical (icono + label)
```

### Después
```
Datos: [🆔 cédula] [📱 teléfono]          ← sin ícono WhatsApp suelto

Acciones: [📋 Seguimiento] [💬 Directo] [📱 Chat] [📋 Historial] [👎 No aplica] [❌ Quitar]
           ───────────────────────────────────────────────────────────────────────────────────
           todos con estilo vertical uniforme (icono arriba + label abajo)
```

## 3. Detalle técnico

### CSS (`public/css/gestion-lote.css`)

**`.btn-accion.btn-seguimiento`** — convertido de horizontal a vertical:
- `flex-direction: column`, `align-items: center`, `gap: 2px`
- `font-size: 10px`, `min-width: 44px` (mismo que `sol-accion-icon-btn`)
- Fondo azul claro `#eff6ff`, texto `#1d4ed8`
- Nuevo sub-selector `.btn-seguimiento .sol-accion-icon` con `font-size: 16px`

**`.btn-accion.btn-whatsapp-img`** — convertido de horizontal a vertical:
- Mismo layout vertical que Seguimiento
- Fondo verde claro `#f0fdf4`, texto `#16a34a` (tono WhatsApp)
- Hover: `#dcfce7` fondo, `#15803d` texto

**Nuevo `.sol-accion-icon-btn.btn-chat-whatsapp`:**
- Hereda de `sol-accion-icon-btn` (layout vertical existente)
- Color verde WhatsApp: fondo `#f0fdf4`, texto `#16a34a`
- Hover: `#dcfce7` fondo, `#15803d` texto

**Eliminado `.sol-datos .sol-chat-icon`:**
- Se reemplazó por el nuevo botón `.btn-chat-whatsapp` en la cinta de acciones

### JS (`public/desktop/js/gestion-lote.js`)

**En `renderizarSolicitudes()` (tarjetas activas):**

1. **Removido** el `<span class="sol-chat-icon">` de la sección `.sol-datos` (junto al teléfono)

2. **Seguimiento** ahora se renderiza como:
   ```html
   <button class="btn-accion btn-seguimiento">
     <span class="sol-accion-icon">📋</span><span>Seguimiento</span>
   </button>
   ```

3. **Directo** ahora se renderiza como:
   ```html
   <button class="btn-accion btn-whatsapp-img">
     <span class="sol-accion-icon">💬</span><span>Directo</span>
   </button>
   ```

4. **Chat** se agregó como nuevo botón en `.sol-acciones`:
   ```html
   <button class="sol-accion-icon-btn btn-chat-whatsapp"
           onclick="abrirWhatsAppDesktop(celular, '')">
     <span class="sol-accion-icon">📱</span><span>Chat</span>
   </button>
   ```
   - Llama a `abrirWhatsAppDesktop()` (mismo handler que el ícono anterior)

## 4. Orden de la cinta de acciones

```
📋 Seguimiento → 💬 Directo → 📱 Chat → 📋 Historial → 👎 No aplica → ❌ Quitar → [⏰]*

* ⏰ solo aparece si la solicitud tiene recordatorio activo
```

## 5. Archivos modificados

| Archivo | Cambio |
|---|---|
| `public/css/gestion-lote.css` | `btn-seguimiento` y `btn-whatsapp-img` convertidos a estilo vertical; nuevo `btn-chat-whatsapp`; eliminado `.sol-chat-icon` |
| `public/desktop/js/gestion-lote.js` | Movido ícono WhatsApp de `sol-datos` a `sol-acciones`; botones Seguimiento/Directo reestructurados con `<span class="sol-accion-icon">` |

## 6. Compatibilidad

- **Mobile no afectado:** la versión móvil (`public/movil/js/gestion-lote.js`) tiene su propio renderizado y usa `.sol-chat-icon` de forma independiente
- **Funciones intactas:** `abrirGestion()`, `abrirGestionWhatsApp()`, `abrirWhatsAppDesktop()` se llaman con los mismos parámetros
- **CSS compartido:** los cambios están en `gestion-lote.css` (compartido), pero las clases `.btn-seguimiento`, `.btn-whatsapp-img` y `.btn-chat-whatsapp` solo se generan desde el JS de desktop
- **`sol-accion-icon-btn` reutilizado:** el botón Chat hereda la clase existente, no se creó un componente nuevo
