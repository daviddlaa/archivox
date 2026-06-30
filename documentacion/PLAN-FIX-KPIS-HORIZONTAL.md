# Plan de Corrección - KPIs en Horizontal (No apiladas)

## 📊 Problema Actual

Las 3 KPIs (Total Registros, Mostrando, Seleccionadas) deberían estar en una sola fila horizontal, pero actualmente se muestran como:
- 2 encima
- 1 debajo

Esto sucede porque el contenedor `stats-row` usa `flex-wrap: wrap`, lo que permite que las tarjetas se envuelvan a otra línea cuando el espacio es insuficiente.

## 🔧 Solución Propuesta

### Cambios en el HTML
Mover las 3 stat-cards fuera del `stats-row` y `stats-column` actuales, y ponerlas directamente en el `stats-grid` como elementos independientes.

### Cambios en el CSS
- Eliminar `flex-wrap: wrap` del `stats-row` o eliminarlo completamente
- O usar CSS Grid en lugar de flexbox para las stats

## 📁 Archivos a Editar

| Archivo | Cambios |
|---------|---------|
| `public/desktop/solicitudes.html` | Reorganizar estructura de stats |
| `public/desktop/css/solicitudes.css` | Ajustar estilos de stats-grid |

## ✅ Pendiente de Autorización

¿Das tu autorización para aplicar esta corrección?
