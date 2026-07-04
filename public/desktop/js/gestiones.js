console.log('Cargando gestiones.js...');

var todosDatos = [];
var currentOffset = 0;
var currentLimit = 50;
var isLoading = false;
var hasMoreData = true;

// ================== FIN SELECCIÓN MÚLTIPLE (ELIMINADA - SOLO LECTURA) ==================

function getFechaHoraActual() {
    var ahora = new Date();
    var dia = String(ahora.getDate()).padStart(2, '0');
    var mes = String(ahora.getMonth() + 1).padStart(2, '0');
    var anio = ahora.getFullYear();
    var hora = String(ahora.getHours()).padStart(2, '0');
    var minuto = String(ahora.getMinutes()).padStart(2, '0');
    var segundo = String(ahora.getSeconds()).padStart(2, '0');
    return dia + '/' + mes + '/' + anio + ' ' + hora + ':' + minuto + ':' + segundo;
}

function formatFechaGestion(fecha) {
    if (!fecha) return '';
    var d = new Date(fecha);
    var dia = String(d.getDate()).padStart(2, '0');
    var mes = String(d.getMonth() + 1).padStart(2, '0');
    var anio = d.getFullYear();
    var hora = String(d.getHours()).padStart(2, '0');
    var minuto = String(d.getMinutes()).padStart(2, '0');
    return dia + '/' + mes + '/' + anio + ' ' + hora + ':' + minuto;
}

async function buscarGestiones() {
    var q = document.getElementById('busqueda-general')?.value || '';
    var tipo = document.getElementById('tipo-gestion')?.value || '';
    
    currentOffset = 0;
    todosDatos = [];
    
try {
        var url = '/api/excel/gestiones/todas?limite=' + currentLimit + '&offset=0';
        // Búsqueda unificada - el backend maneja la búsqueda en múltiples campos
        if (q) url += '&q=' + encodeURIComponent(q);
        if (tipo) url += '&tipo_gestion=' + encodeURIComponent(tipo);
        
        var response = await fetch(url);
        
        // Check if response is OK (status 200-299)
        if (!response.ok) {
            console.error('Error HTTP:', response.status, response.statusText);
            if (response.status === 401) {
                alert('Sesión expirada. Por favor inicie sesión nuevamente.');
                window.location.href = '/desktop/login.html';
            } else {
                alert('Error al buscar gestiones: ' + response.status);
            }
            return;
        }
        
        var result = await response.json();
        
        // Check for API error in response body
        if (result && result.error) {
            console.error('API Error:', result.error);
            if (result.error === 'No autenticado') {
                alert('Sesión expirada. Por favor inicie sesión nuevamente.');
                window.location.href = '/desktop/login.html';
            } else {
                alert('Error: ' + result.error);
            }
            return;
        }
        
        var datosRecibidos = Array.isArray(result) ? result : (result.data || []);
        todosDatos = datosRecibidos;
        currentOffset = datosRecibidos.length;
        
        var total = Array.isArray(result) ? result.length : (result.total || 0);
        hasMoreData = currentOffset < total;
        
        document.getElementById('total-registros').textContent = total;
        document.getElementById('mostrando').textContent = datosRecibidos.length;
        
        renderizarTabla(datosRecibidos);
        
        console.log('Búsqueda de gestiones:', datosRecibidos.length, 'resultados');
} catch (error) {
        console.error('Error en búsqueda:', error);
        
        // Better error handling for different error types
        var errorMessage = 'Error al buscar gestiones';
        
        if (error.name === 'TypeError' && error.message === 'Failed to fetch') {
            errorMessage = 'No se puede conectar al servidor. Asegúrese de que el servidor esté iniciado.';
        } else if (error.name === 'AbortError') {
            errorMessage = 'La solicitud fue cancelada. Intente de nuevo.';
        }
        
        alert(errorMessage);
    }
}

async function cargarMas() {
    if (isLoading || !hasMoreData) return;
    
    isLoading = true;
    
    var sentinel = document.getElementById('infinite-scroll-sentinel');
    if (sentinel) sentinel.innerHTML = '⏳ Cargando más...';
    
    var q = document.getElementById('busqueda-general')?.value || '';
    var tipo = document.getElementById('tipo-gestion')?.value || '';
    
    var offset = currentOffset;
    
    try {
        var url = '/api/excel/gestiones/todas?limite=' + currentLimit + '&offset=' + offset;
        if (q) url += '&q=' + encodeURIComponent(q);
        if (tipo) url += '&tipo_gestion=' + encodeURIComponent(tipo);
        
        var response = await fetch(url);
        var result = await response.json();
        
        var nuevosDatos = Array.isArray(result) ? result : (result.data || []);
        
        if (nuevosDatos.length > 0) {
            for (var i = 0; i < nuevosDatos.length; i++) {
                todosDatos.push(nuevosDatos[i]);
            }
            currentOffset += nuevosDatos.length;
            
            var total = document.getElementById('total-registros').textContent;
            hasMoreData = currentOffset < total;
            
            renderizarTabla(todosDatos);
            
            console.log('Más datos cargados:', nuevosDatos.length, 'total:', todosDatos.length);
        } else {
            hasMoreData = false;
        }
    } catch (error) {
        console.error('Error cargando más:', error);
    } finally {
        isLoading = false;
        
        if (sentinel) {
            sentinel.innerHTML = hasMoreData ? '📜 Desliza para cargar más...' : '✅ No hay más registros';
        }
    }
}

function renderizarTabla(datos) {
    var tabla = document.getElementById('tabla-gestiones');
    
    if (!tabla) {
        console.log('DEBUG: tabla no encontrada');
        return;
    }
    
    if (!datos.length) {
        tabla.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:20px;">No se encontraron gestiones</td></tr>';
        return;
    }
    
    var html = '';
    var coloresTipo = {
        'Seguimiento': '#dbeafe',
        'Cobranza': '#fee2e2',
        'Llamada': '#d1fae5',
        'WhatsApp': '#dcfce7',
        'Reclamo': '#fef3c7',
        'Cita': '#e0e7ff',
        'Otro': '#f3f4f6'
    };
    
    for (var i = 0; i < datos.length; i++) {
        var g = datos[i];
        var color = coloresTipo[g.tipo_gestion] || '#f3f4f6';
        var fechaFormateada = formatFechaGestion(g.fecha_gestion);
        
        html += '<tr>';
        html += '<td>' + (g.solicitud_id || '') + '</td>';
        html += '<td>' + (g.cedula || '') + '</td>';
        html += '<td>' + (g.nombre || '') + '</td>';
        html += '<td><span style="background:' + color + ';padding:4px 8px;border-radius:4px;font-size:12px;">' + (g.tipo_gestion || '') + '</span></td>';
        html += '<td>' + (g.observacion || '') + '</td>';
        html += '<td>' + fechaFormateada + '</td>';
        html += '<td>';
        html += '<button class="btn-accion" onclick="verGestion(\'' + g.id + '\')" title="Ver">👁️</button>';
        html += '</td>';
        html += '</tr>';
    }
    
    tabla.innerHTML = html;
    
    // Renderizar cards para móvil
    renderizarCards(datos);
}

// Función para renderizar cards en móvil
function renderizarCards(datos) {
    var container = document.getElementById('cardsGestiones');
    
    if (!container) {
        return;
    }
    
    if (!datos.length) {
        container.innerHTML = '<div class="gestiones-empty"><div class="gestiones-empty-icon">📭</div><p>No se encontraron gestiones</p></div>';
        return;
    }
    
    var coloresTipo = {
        'Seguimiento': '#dbeafe',
        'Cobranza': '#fee2e2',
        'Llamada': '#d1fae5',
        'WhatsApp': '#dcfce7',
        'Reclamo': '#fef3c7',
        'Cita': '#e0e7ff',
        'Otro': '#f3f4f6'
    };
    
    var html = '';
    
    for (var i = 0; i < datos.length; i++) {
        var g = datos[i];
        var color = coloresTipo[g.tipo_gestion] || '#f3f4f6';
        var fechaFormateada = formatFechaGestion(g.fecha_gestion);
        
        html += '<div class="gestion-card">';
        html += '<div class="gestion-card-header">';
        html += '<span class="gestion-card-id">#' + (g.solicitud_id || '') + '</span>';
        html += '<span class="gestion-badge" style="background:' + color + ';">' + (g.tipo_gestion || '') + '</span>';
        html += '</div>';
        html += '<div class="gestion-card-body">';
        html += '<p><strong>Nombre:</strong> ' + (g.nombre || '-') + '</p>';
        html += '<p><strong>Cédula:</strong> ' + (g.cedula || '-') + '</p>';
        html += '<p><strong>Obs:</strong> ' + (g.observacion || '-') + '</p>';
        html += '</div>';
        html += '<div class="gestion-card-footer">';
        html += '<span>📅 ' + fechaFormateada + '</span>';
        html += '<div class="gestion-card-acciones">';
        html += '<button class="btn-accion" onclick="verGestion(\'' + g.id + '\')" title="Ver">👁️</button>';
        html += '</div>';
        html += '</div>';
        html += '</div>';
    }
    
    container.innerHTML = html;
}

function verGestion(id) {
    var gestion = todosDatos.find(function(g) { return g.id == id; });
    if (!gestion) {
        alert('Gestión no encontrada');
        return;
    }
    
    var contenido = '';
    contenido += '<div style="padding:20px;">';
    contenido += '<h2 style="margin-top:0;">📋 Gestión #' + id + '</h2>';
    contenido += '<div style="background:#f3f4f6;padding:15px;border-radius:8px;">';
    contenido += '<p><strong>Solicitud:</strong> ' + gestion.solicitud_id + '</p>';
    contenido += '<p><strong>Cédula:</strong> ' + gestion.cedula + '</p>';
    contenido += '<p><strong>Nombre:</strong> ' + (gestion.nombre || '') + '</p>';
    contenido += '<p><strong>Celular:</strong> ' + (gestion.celular || '') + '</p>';
    contenido += '<p><strong>Tipo:</strong> ' + gestion.tipo_gestion + '</p>';
    contenido += '<p><strong>Fecha:</strong> ' + formatFechaGestion(gestion.fecha_gestion) + '</p>';
    contenido += '<p><strong>Observación:</strong></p>';
    contenido += '<div style="background:white;padding:10px;border-radius:4px;margin-top:5px;">' + (gestion.observacion || 'Sin observación') + '</div>';
    contenido += '</div>';
    contenido += '<div style="margin-top:20px;text-align:right;">';
    contenido += '<button onclick="cerrarModal()" style="padding:10px 20px;background:#6b7280;color:white;border:none;border-radius:8px;cursor:pointer;">Cerrar</button>';
    contenido += '</div>';
    contenido += '</div>';
    
    crearModal(contenido);
}

function crearModal(contenido) {
    var modalExistente = document.getElementById('modal-gestiones');
    if (modalExistente) {
        modalExistente.remove();
    }
    
    var overlay = document.createElement('div');
    overlay.id = 'modal-gestiones';
    overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);z-index:9999;display:flex;align-items:center;justify-content:center;';
    
    var modal = document.createElement('div');
    modal.style.cssText = 'background:white;border-radius:16px;max-width:600px;width:95%;max-height:90vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,0.4);';
    modal.innerHTML = contenido;
    
    overlay.onclick = function(e) {
        if (e.target === overlay) {
            cerrarModal();
        }
    };
    
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
}

function cerrarModal() {
    var modal = document.getElementById('modal-gestiones');
    if (modal) {
        modal.remove();
    }
}

function limpiarFiltros() {
    var el = document.getElementById('busqueda-general');
    if (el) el.value = '';
    document.getElementById('fecha-desde').value = '';
    document.getElementById('fecha-hasta').value = '';
    document.getElementById('tipo-gestion').selectedIndex = 0;
    buscarGestiones();
}

// Debounce helper
function debounce(fn, wait) {
    var timeout;
    return function() {
        var ctx = this, args = arguments;
        clearTimeout(timeout);
        timeout = setTimeout(function() { fn.apply(ctx, args); }, wait);
    };
}

function initSearchListeners() {
    var input = document.getElementById('busqueda-general');
    if (input) {
        input.addEventListener('input', debounce(function() {
            currentOffset = 0;
            buscarGestiones();
        }, 400));
    }
    var tipo = document.getElementById('tipo-gestion');
    if (tipo) {
        tipo.addEventListener('change', function() {
            currentOffset = 0;
            buscarGestiones();
        });
    }
}

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
    
    // Crear libro de Excel con SheetJS
    var wb = XLSX.utils.book_new();
    var ws = XLSX.utils.json_to_sheet(datosAExportar);
    
    // Ancho de columnas automático
    ws['!cols'] = [
        {wch: 14},  // ID Solicitud
        {wch: 12},  // Cédula
        {wch: 30},  // Nombre
        {wch: 16},  // Tipo Gestión
        {wch: 50},  // Observación
        {wch: 18}   // Fecha Gestión
    ];
    
    XLSX.utils.book_append_sheet(wb, ws, 'Gestiones');
    
    // Generar nombre de archivo con fecha
    var fecha = getFechaHoraActual().replace(/[\s:]/g, '-');
    var nombreArchivo = 'gestiones_' + fecha + '.xlsx';
    
    // Descargar archivo Excel
    XLSX.writeFile(wb, nombreArchivo);
    
    alert('Se exportaron ' + todosDatos.length + ' registros a Excel');
}

// Infinite scroll setup
function initInfiniteScroll() {
    var sentinel = document.getElementById('infinite-scroll-sentinel');
    if (!sentinel) {
        sentinel = document.createElement('div');
        sentinel.id = 'infinite-scroll-sentinel';
        sentinel.style.cssText = 'height:60px;display:flex;align-items:center;justify-content:center;color:#6b7280;font-size:14px;';
        sentinel.innerHTML = '📜 Desliza para cargar más...';
        
        var container = document.getElementById('tabla-container');
        if (container) {
            container.appendChild(sentinel);
        }
    }
    
    if ('IntersectionObserver' in window) {
        var observer = new IntersectionObserver(function(entries) {
            var entry = entries[0];
            if (entry.isIntersecting && hasMoreData && !isLoading) {
                cargarMas();
            }
        }, {
            rootMargin: '100px'
        });
        
        observer.observe(sentinel);
    }
}



// Inicializar
buscarGestiones();
initInfiniteScroll();
initSearchListeners();
