# Fix: Exportar a Excel (.xlsx) en página de Gestiones

## 📅 Fecha
29 de junio de 2026

## 🐛 Problema

El botón **📥 Exportar** en la página de gestiones (`public/desktop/gestiones.html`) exportaba a **CSV**, no a Excel (.xlsx).

### Código ELIMINADO en `exportarExcel()` (`public/desktop/js/gestiones.js`)

```javascript
// ❌ Generaba CSV manual con comas, BOM, escapes...
var csvContent = '\uFEFF';
csvContent += 'ID Solicitud,Cédula,Nombre,Tipo Gestión,Observación,Fecha Gestión\n';
for (var i = 0; i < todosDatos.length; i++) {
    var g = todosDatos[i];
    var row = [...].join(',');
    csvContent += row + '\n';
}
var blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
// ... descarga como .csv
```

## ✅ Solución Aplicada

Usar **SheetJS (XLSX library)** para generar un archivo Excel real (.xlsx), mismo enfoque que ya funciona en la página de Solicitudes.

### 1. Agregar SheetJS CDN a `public/desktop/gestiones.html`

```html
<!-- Librería SheetJS para exportar Excel -->
<script src="https://cdn.sheetjs.com/xlsx-0.20.1/package/dist/xlsx.full.min.js"></script>
```

### 2. Reemplazar `exportarExcel()` en `public/desktop/js/gestiones.js`

**ANTES:** Generaba CSV manualmente.

**AHORA:** Usa `XLSX.utils.json_to_sheet()` para crear un Excel real:

```javascript
function exportarExcel() {
    if (todosDatos.length === 0) {
        alert('No hay datos para exportar');
        return;
    }
    
    // Convertir datos al formato que espera SheetJS
    var datosAExportar = [];
    for (var i = 0; i < todosDatos.length; i++) {
        var g = todosDatos[i];
        datosAExportar.push({
            'ID Solicitud': g.solicitud_id || '',
            'Cédula': g.cedula || '',
            'Nombre': g.nombre || '',
            'Tipo Gestión': g.tipo_gestion || '',
            'Observación': g.observacion || '',
            'Fecha Gestión': formatFechaGestion(g.fecha_gestion)
        });
    }
    
    var wb = XLSX.utils.book_new();
    var ws = XLSX.utils.json_to_sheet(datosAExportar);
    
    ws['!cols'] = [
        {wch: 14}, {wch: 12}, {wch: 30},
        {wch: 16}, {wch: 50}, {wch: 18}
    ];
    
    XLSX.utils.book_append_sheet(wb, ws, 'Gestiones');
    
    var fecha = getFechaHoraActual().replace(/[\s:]/g, '-');
    XLSX.writeFile(wb, 'gestiones_' + fecha + '.xlsx');
    
    alert('Se exportaron ' + todosDatos.length + ' registros a Excel');
}
```

## 📁 Archivos modificados

| Archivo | Cambio |
|---------|--------|
| `public/desktop/gestiones.html` | + SheetJS CDN script |
| `public/desktop/js/gestiones.js` | `exportarExcel()` reemplazada de CSV a XLSX |

## 📊 Resultado

| Antes | Después |
|-------|---------|
| Descargaba archivo `.csv` (texto plano) | Descarga archivo `.xlsx` (Excel real) |
| Sin formato, columnas sin ancho | Columnas con ancho automático |
| Los acentos/ñ podían corromperse | Unicode correcto (Excel nativo) |
| No se podía abrir directamente en Excel | Se abre directamente en Excel |
