# Feature: Selector de estados integrado en el hero (gestión por lote desktop)

> **Estado:** ✅ Implementada
> **Fecha:** 26/08/2026
> **Ámbito:** Escritorio — `public/desktop/gestion-lote.html`, `public/css/gestion-lote.css`, `public/desktop/js/gestion-lote.js`

---

## 1. Contexto

El selector de estados (filtro por tipo de gestión: Pendiente, Seguimiento, Cobranza, etc.) vivía en una fila separada `.filtros-row` debajo del buscador global, fuera del hero. Visualmente quedaba desconectado del resto de los controles del header.

## 2. Cambio

Se movió el `<select id="filtro-estado">` y el chip de semáforo (`#btn-filtro-semaforo-chip`) al `.hero-right`, integrándolos visualmente junto a los otros controles:

**Hero right (izq → der):**
1. 🔍 Búsqueda (oculta en landing)
2. 📋 Campañas (botón primario)
3. 📊 Estado (botón toggle rail)
4. 📋 **Filtro de estados** ← NUEVO
5. ⋯ Menú (tres puntos)
6. 🔔 Notificaciones

### Opciones del select (con emojis)

| Valor | Label |
|---|---|
| *(vacío)* | 📋 Todos |
| Pendiente | ⏳ Pendiente |
| Seguimiento | 🔄 Seguimiento |
| Cobranza | 💰 Cobranza |
| Completada | ✅ Completada |
| Recordatorio | 🔔 Recordatorio |

## 3. Detalle técnico

### HTML (`gestion-lote.html`)

- Nuevo contenedor `#hero-filtro-estado` dentro de `.hero-right`, con `display:none` por defecto
- El `<select id="filtro-estado">` se movió aquí (mismo ID → JS intacto)
- El `.filtros-row` original queda vacío y con `hidden` (referenciado por JS para show/hide)

### CSS (`gestion-lote.css`)

```css
.hero-filtro-estado { display: flex; align-items: center; gap: 6px; }
.hero-select-estado { /* look&feel de btn-header: border suave, hover índigo, focus ring */ }
```

- Flecha SVG personalizada vía `background-image` + `appearance: none`
- `min-width: 160px` para que no se vea apretado
- Responsive ≤640px: `min-width: 140px; flex: 1 1 auto`

### JS (`gestion-lote.js`)

- **Landing (sin campaña):** `hero-filtro-estado` se oculta
- **Campaña abierta:** `hero-filtro-estado` se muestra con `display: flex`
- Event listener `#filtro-estado` change → `renderizarSolicitudes()` **sin cambios** (mismo ID)
- Sticky de `filtros-row` → ya no aplica (div vacío), el select vive en el hero que es sticky por diseño

## 4. Archivos modificados

| Archivo | Cambio |
|---|---|
| `public/desktop/gestion-lote.html` | Select movido de `.filtros-row` a `.hero-right` |
| `public/css/gestion-lote.css` | Estilos `.hero-filtro-estado`, `.hero-select-estado`, responsive |
| `public/desktop/js/gestion-lote.js` | Show/hide de `#hero-filtro-estado` en landing vs campaña |

## 5. Compatibilidad

- **IDs preservados:** `#filtro-estado`, `#btn-filtro-semaforo-chip` → cero cambios en event listeners
- **Mobile no afectado:** móvil tiene su propio HTML (`public/movil/gestion-lote.html`) con selects independientes
- **Semáforo:** el chip `#btn-filtro-semaforo-chip` vive ahora dentro de `#hero-filtro-estado`, al lado del select
