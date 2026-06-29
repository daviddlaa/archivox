# Feature: Exportar Campaña a Excel

## Objetivo
Permitir exportar los datos de una campaña (gestión por lotes) a un archivo Excel (.xlsx) desde las vistas de escritorio y móvil, con los campos: **Cédula, Nombre, Teléfono, Segmento, Estado y Observación**.

## Archivos modificados

### Escritorio (Desktop)
| Archivo | Cambio |
|---------|--------|
| `public/desktop/gestion-lote.html` | Se añadió la librería **SheetJS (XLSX)** y un botón **📥 Exportar Excel** en el header, junto al botón "Volver a Solicitudes". |
| `public/desktop/js/gestion-lote.js` | Se añadió la función `exportarExcelGestionLote()`. El botón se muestra automáticamente al cargar una campaña. |

### Móvil
| Archivo | Cambio |
|---------|--------|
| `public/movil/gestion-lote.html` | Se añadió la librería **SheetJS (XLSX)** y un botón **📥 Exportar Excel** de ancho completo entre los filtros y la lista de solicitudes. |
| `public/movil/js/gestion-lote.js` | Se añadió la función `exportarExcelGestionLote()`. El botón se muestra automáticamente al cargar una campaña. |

## Columnas exportadas

| Columna | Campo origen | Descripción |
|---------|-------------|-------------|
| Cédula | `solicitud.cedula` | Número de cédula del cliente |
| Nombre | `solicitud.nombre` | Nombre completo del cliente |
| Teléfono | `solicitud.celular` | Número de teléfono/celular |
| Segmento | `solicitud.segmento` | Segmento asignado (ej: A, B, C) |
| Estado | `solicitud.tipo_gestion` | Estado de la gestión (Pendiente, Llamada, WhatsApp, etc.) |
| Observación | `solicitud.gestion_obs` | Observación registrada en la última gestión |

## Comportamiento

1. El botón **📥 Exportar Excel** está oculto inicialmente.
2. Cuando el usuario selecciona o carga una campaña, el botón se muestra automáticamente.
3. Al hacer clic, se genera un archivo `.xlsx` con **todos los registros de la campaña** (no solo los filtrados).
4. El nombre del archivo incluye el nombre de la campaña y la fecha actual: `campaña_NOMBRE_YYYY-MM-DD.xlsx`.
5. Se muestra un alert con la cantidad de registros exportados.

## Dependencia
- **SheetJS (XLSX)**: Librería CDN `xlsx@0.18.5` cargada desde jsDelivr.
  - URL: `https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js`

## Código de la función

```javascript
function exportarExcelGestionLote() {
    var datos = todasLasSolicitudes;
    
    if (!datos || datos.length === 0) {
        alert('No hay datos para exportar');
        return;
    }
    
    var datosAExportar = [];
    for (var i = 0; i < datos.length; i++) {
        var sol = datos[i];
        datosAExportar.push({
            'Cédula': sol.cedula || '',
            'Nombre': sol.nombre || '',
            'Teléfono': sol.celular || '',
            'Segmento': sol.segmento || '',
            'Estado': sol.tipo_gestion || 'Pendiente',
            'Observación': sol.gestion_obs || ''
        });
    }
    
    var wb = XLSX.utils.book_new();
    var ws = XLSX.utils.json_to_sheet(datosAExportar);
    XLSX.utils.book_append_sheet(wb, ws, 'Campaña');
    XLSX.writeFile(wb, nombreArchivo);
}
```
