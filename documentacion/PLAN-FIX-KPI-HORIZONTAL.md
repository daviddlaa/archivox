# Plan de Corrección - Todo en Horizontal (KPIs + Filtros)

## 📊 Problema Actual

Las KPIs están bien pero los filtros de Estado y Segmento están en columnas separadas, no junto a las KPIs.

## 🎯 Solución Propuesta

Hacer todo esté en UNA sola fila horizontal:
```
[KPIs compactas] [Filtro Estado] [Filtro Segmento]
```

### Cambios en CSS:

1. **KPIs aún más pequeñas:**
   - Padding: 12px → 8px
   - Font-size valor: 24px → 18px
   - Font-size label: 11px → 9px
   - Min-width: 100px → 80px

2. **stats-grid layout:**
   - Cambiar a 4 columnas: KPIs (3) + Estado + Segmento
   - O usar flexbox con gap pequeño

3. **Alinear todo en una fila horizontal**

---

## 📁 Archivos a Editar

| Archivo | Cambios |
|---------|---------|
| `public/desktop/solicitudes.html` | Reorganizar estructura |
| `public/desktop/css/solicitudes.css` | Reducir tamaño KPIs y realinear |

---

## ✅ Pendiente de Autorización

¿Das tu autorización para proceder?
