# Plan de Mejora - Página de Solicitudes (Escritorio)

## 📊 Análisis del Estado Actual

He analizó los siguientes archivos:
- `public/desktop/solicitudes.html` - Estructura HTML
- `public/desktop/css/solicitudes.css` - Estilos CSS
- `public/desktop/js/solicitudes.js` - Funcionalidad JavaScript

### Componentes actuales identificados:

1. **Stats/KPIs** (3 tarjetas):
   - Padding: 20px
   - Font-size valor: 32px
   - Font-size label: 13px
   - Min-width: 120px
   - Layout: horizontal en fila

2. **Filtros de Estado y Segmento**:
   - Padding botones: 10px 18px
   - Font-size: 14px
   - Border-radius: 20px
   - Gap entre botones: 10px
   - Ubicación: 2 columnas separadas (stats-grid con 3 columnas)

3. **Panel Lateral de Acciones**:
   - Botones en layout vertical (width 100%)
   - Padding: 12px
   - Font-size: 14px
   - Incluye: Exportar, Marcar Todas, Limpiar, Borrar Todo

4. **Toolbar Inline**:
   - Aparece al seleccionar registros
   - Botón de Gestión por Lotes

---

## 🎯 Plan de Acción Propuesto

### 1. REDUCIR TAMAÑO DE KPIs/STAT CARDS

| Propiedad | Valor Actual | Valor Nuevo |
|-----------|-------------|-------------|
| Padding | 20px | 12px |
| Font-size valor | 32px | 24px |
| Font-size label | 13px | 11px |
| Min-width | 120px | 100px |
| Gap entre tarjetas | 16px | 10px |

### 2. COMPACTAR BOTONES DE FILTROS

| Propiedad | Valor Actual | Valor Nuevo |
|-----------|-------------|-------------|
| Padding | 10px 18px | 6px 12px |
| Font-size | 14px | 12px |
| Border-radius | 20px | 6px |
| Gap entre botones | 10px | 6px |
| Border | 2px solid | 1px solid |

### 3. REORGANIZAR BOTONES DE ACCIONES

**Cambios propuestos:**
- Cambiar de layout vertical a horizontal (en una fila)
- Reducir padding y tamaño de botones
- Agregar iconos más pequeños
- Hacerlos más accesibles y compactos

### 4. NUEVO LAYOUT GENERAL

**Estructura propuesta:**
```
├── Fila 1: Stats/KPIs compactas (en una sola fila)
├── Filtros: Estado y Segmento en una línea horizontal
├── Buscador: Input compacto
└── Acciones: Botones horizontales junto al buscador
```

---

## 📁 Archivos a Editar

| Archivo | Cambios |
|---------|---------|
| `public/desktop/solicitudes.html` | Reorganizar estructura HTML para nuevo layout |
| `public/desktop/css/solicitudes.css` | Ajustar estilos de botones, KPIs y layout |

### No requiere cambios:
- `public/desktop/js/solicitudes.js` - La lógica permanece igual, solo se modifican estilos visuales

---

## ⚠️ Notas Importantes

1. **Funcionalidad preservada**: Todos los IDs y classes usados en JavaScript se mantendrán iguales
2. **Responsive**: El diseño será más compacto pero seguirá siendo responsive
3. **Sin cambios en backend**: No se toca la lógica del servidor

---

## ✅ Pendiente de Autorización

Este plan requiere tu aprobación para proceder con la implementación.
