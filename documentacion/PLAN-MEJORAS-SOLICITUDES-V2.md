# Plan de Mejora V2 - Página de Solicitudes (Escritorio)

## 🎯 Objetivo

Reorganizar la página de solicitudes según el feedback del usuario:
- Eliminar el panel lateral (info-panel)
- Mover "Resumen" y "Acciones Rápidas" debajo de los filtros
- Las cards se ampliarán a 3 columnas

---

## 📊 Análisis del Layout Actual

### Estructura HTML actual:
```
├── Header Actions (título + botones)
├── Stats Grid (3 columnas):
│   ├── Columna 1: Stats/KPIs + botón Gestión
│   ├── Columna 2: Filtros Estado
│   └── Columna 3: Filtros Segmento
├── Search Row (input búsqueda)
├── Main Content Grid (2 columnas):
│   ├── Aside Info Panel (300px) ← ELIMINAR
│   │   ├── Resumen
│   │   └── Acciones Rápidas
│   └── Table Panel (cards) ← se amplía
```

### Nuevo Layout Propuesto:
```
├── Header Actions (título + botones)
├── Stats Grid (3 columnas):
│   ├── Columna 1: Stats/KPIs + botón Gestión
│   ├── Columna 2: Filtros Estado
│   └── Columna 3: Filtros Segmento
├── Nueva Fila: Resumen + Acciones Rápidas (debajo de filtros)
├── Search Row (input búsqueda)
├── Main Content Grid (1 columna):
│   └── Cards Container (3 columnas)
```

---

## 📝 Plan de Acción

### 1. Modificar HTML (`solicitudes.html`)

- [ ] **Eliminar:** `<aside class="info-panel">` del `main-content-grid`
- [ ] **Agregar:** Nueva fila con Resumen + Acciones Rápidas debajo de filtros (search-row)
- [ ] **Modificar:** `main-content-grid` de 2 columnas a 1 columna (cards ocupan todo el ancho)

### 2. Modificar CSS (`solicitudes.css`)

- [ ] **Eliminar:** Estilos de `.main-content-grid` con 2 columnas
- [ ] **Agregar:** Nuevo layout para fila de Resumen + Acciones Rápidas (horizontal)
- [ ] **Modificar:** `.cards-container` para 3 columnas
- [ ] **Estilos para nuevos componentes:**
  - `.resumen-acciones-row` (nueva fila)
  - `.resumen-compacto` (resumen pequeño)
  - `.acciones-fila` (botones en horizontal)

---

## 🎨 Detalles de Nuevos Estilos

### Resumen + Acciones (debajo de filtros):
- Layout: horizontal, en una fila
- Padding reducido: 12px
- Font-size reducido: 12px
- Gap entre elementos: 12px
- Background: white con padding

### Cards (3 columnas):
- Grid: `grid-template-columns: repeat(3, 1fr)`
- Gap: 12px

---

## 📁 Archivos a Editar

| Archivo | Acción |
|---------|--------|
| `public/desktop/solicitudes.html` | Reorganizar estructura |
| `public/desktop/css/solicitudes.css` | Nuevos estilos |

---

## ⚠️ IMPORTANTE

El JavaScript (`solicitudes.js`) **NO requiere cambios** ya que:
- Los IDs de botones y elementos se mantendrán
- Solo se reorganiza el layout visual
- La funcionalidad permanece igual

---

## ✅ Pendiente de Autorización

¿Das tu aprobación para proceder con esta implementación?
