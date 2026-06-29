# PLAN: Página Relaciones — Versión Cards

> **Versión:** 2.0 (cambio de tabla a cards)
> **Cambio:** Reemplazar la tabla por tarjetas visuales que muestren todos los campos del cliente de forma ordenada. Mismo layout para escritorio y móvil.

---

## 1. ¿Por qué cards y no tabla?

El Excel de Relaciones tiene **11 columnas**. En una tabla es impracticable:
- Horizontal scroll molesto
- Mucha información comprimida en celdas
- Difícil de leer en móvil
- No se aprovecha el espacio visual

Con **cards**, cada cliente es una tarjeta individual con sus datos bien organizados, etiquetados y coloreados por estado (ALTA/BAJA).

---

## 2. Diseño visual de cada card

Cada cliente se muestra como una card compacta con este layout:

```
┌──────────────────────────────────────────┐
│ 🔵 ALTA       [identificación]     # 1   │
├──────────────────────────────────────────┤
│ 👤 Juan Pérez López                      │
│ 📱 0991234567                            │
├──────────────────────────────────────────┤
│ 📅 Inicio:  2024-01-15                   │
│ 🏁 Fin Crédito: 2025-06-30              │
│ ⏳ Próx. Baja: 2025-03-15               │
│ 🔄 Fidelización: 2025-12-31             │
├──────────────────────────────────────────┤
│ 💬 Motivo: -                             │
└──────────────────────────────────────────┘
```

### Elementos de cada card:

| Sección | Contenido |
|---|---|
| **Header** | Badge de estado (🔵 ALTA / 🔴 BAJA) + cédula + # operaciones |
| **Nombre** | Nombre completo + teléfono con iconos |
| **Fechas** | Inicio relación, fin crédito, próxima baja, fidelización |
| **Footer** | Motivo ruptura (solo visible si es BAJA) |

### Estados con color:

- **ALTA** → Badge azul (`#3b82f6`), borde izquierdo azul
- **BAJA** → Badge rojo (`#ef4444`), borde izquierdo rojo

---

## 3. Layout de la página

### Escritorio: Grid responsive

```
┌─────────────────────────────────────────────────────┐
│ 📋 Relaciones                                       │
│ 📤 [Subir Excel]  [📥 Exportar]  [Subir nuevo]     │
├─────────────────────────────────────────────────────┤
│ Stats: [📄 Total: 165] [🔵 ALTA: 120] [🔴 BAJA: 45]│
├─────────────────────────────────────────────────────┤
│ Filtros:                                            │
│ [📋 Todas] [🔵 ALTA] [🔴 BAJA]                     │
│ [🔍 Buscar cédula, nombre...]                       │
│ [📅 Desde] [📅 Hasta]                              │
├─────────────────────────────────────────────────────┤
│                                                     │
│ ┌──────────┐ ┌──────────┐ ┌──────────┐             │
│ │ 🔵 ALTA  │ │ 🔵 ALTA  │ │ 🔴 BAJA  │             │
│ │ 12345678 │ │ 87654321 │ │ 11223344 │             │
│ │ 👤 Juan  │ │ 👤 María │ │ 👤 Pedro │             │
│ │ 📱 099.. │ │ 📱 098.. │ │ 📱 097.. │             │
│ └──────────┘ └──────────┘ └──────────┘             │
│                                                     │
│ ┌──────────┐ ┌──────────┐ ┌──────────┐             │
│ │ ...      │ │ ...      │ │ ...      │             │
│ └──────────┘ └──────────┘ └──────────┘             │
│                                                     │
│ ← Anterior  Página 1 de 5  Siguiente →              │
└─────────────────────────────────────────────────────┘

Grid: 3 columnas en desktop, 2 en tablet, 1 en móvil
```

### Móvil: Mismo diseño, 1 columna

```
┌──────────────────────┐
│ 📋 Relaciones        │
├──────────────────────┤
│ 📤 [Subir Excel]     │
├──────────────────────┤
│ Stats compactos      │
│ [Total:165][ALTA:120]│
│ [BAJA:45]  [Ops:200] │
├──────────────────────┤
│ Filtros              │
│ [📋 Todas][🔵 ALTA] │
│ [🔍 Buscar...]       │
├──────────────────────┤
│ ┌──────────────────┐ │
│ │ 🔵 ALTA   # 1    │ │
│ │ 👤 Juan Pérez    │ │
│ │ 📱 0991234567    │ │
│ │ 📅 Inicio: 2024  │ │
│ └──────────────────┘ │
│ ┌──────────────────┐ │
│ │ 🔴 BAJA   # 0    │ │
│ │ ...              │ │
│ └──────────────────┘ │
└──────────────────────┘
```

---

## 4. Archivos a modificar

Solo Frontend — el **backend NO cambia** (API, service, controller, routes quedan igual)

| Archivo | Cambio |
|---|---|
| `public/desktop/relaciones.html` | Reemplazar tabla por grid de cards |
| `public/desktop/css/relaciones.css` | Nuevos estilos de cards (grid, card, badges) |
| `public/desktop/js/relaciones.js` | Función `renderizarCards()` reemplaza `renderizarTabla()` |
| `public/movil/relaciones.html` | Mismo cambio: cards en lugar de tabla |
| `public/movil/js/relaciones.js` | Función `renderizarCardsMovil()` |

---

## 5. Funcionalidades que se mantienen

| Funcionalidad | Estado |
|---|---|
| Upload drag & drop | ✅ Se mantiene |
| Stats (total, ALTA, BAJA, ops) | ✅ Se mantiene |
| Filtros por píldoras (Todas/ALTA/BAJA) | ✅ Se mantiene |
| Búsqueda por cédula/nombre | ✅ Se mantiene |
| Filtro por rango de fechas | ✅ Se mantiene |
| Exportar a Excel | ✅ Se mantiene |
| Botón "Subir nuevo Excel" | ✅ Se mantiene |
| Paginación | ✅ Se mantiene |
| Carga inicial automática | ✅ Se mantiene |

---

## 6. Maqueta de card (HTML)

```html
<div class="relacion-card estado-ALTA">
    <div class="card-header">
        <span class="card-badge badge-ALTA">🔵 ALTA</span>
        <span class="card-identificacion">0928492123</span>
        <span class="card-ops"># 3</span>
    </div>
    <div class="card-body">
        <div class="card-field card-nombre">
            <span class="field-icon">👤</span>
            <span class="field-value">COBOS MENOSCAL ALEXANDRA LUCIA</span>
        </div>
        <div class="card-field card-telefono">
            <span class="field-icon">📱</span>
            <span class="field-value">0991234567</span>
        </div>
        <div class="card-dates">
            <div class="card-date">
                <span class="date-label">📅 Inicio</span>
                <span class="date-value">2024-01-15</span>
            </div>
            <div class="card-date">
                <span class="date-label">🏁 Fin Crédito</span>
                <span class="date-value">2025-06-30</span>
            </div>
            <div class="card-date">
                <span class="date-label">⏳ Próx. Baja</span>
                <span class="date-value">2025-03-15</span>
            </div>
            <div class="card-date">
                <span class="date-label">🔄 Fidelización</span>
                <span class="date-value">2025-12-31</span>
            </div>
        </div>
    </div>
    <div class="card-footer">
        <span class="motivo-label">💬 Motivo ruptura:</span>
        <span class="motivo-value">—</span>
    </div>
</div>
```

---

## 7. Preguntas para aprobación

1. ✅ **Cards en lugar de tabla** — Cada cliente es una card visual con todos sus campos
2. ✅ **Mismos datos que el Excel** — Sin perder información
3. ✅ **Backend intacto** — Solo cambia el frontend
4. ✅ **Escritorio y móvil** — Mismo diseño responsive (3 cols → 2 cols → 1 col)
5. ✅ **Filtros y búsqueda igual** — Se mantienen todas las funcionalidades actuales
6. ✅ **Borde de color** — ALTA borde azul, BAJA borde rojo
7. ❓ **¿Quieres algún campo adicional en la card?** — ¿Algo más que mostrar/ocultar?
8. ❓ **Orden de las cards** — ¿Por nombre, por fecha, o por estado primero?

---

¿Aprobado? ✅
