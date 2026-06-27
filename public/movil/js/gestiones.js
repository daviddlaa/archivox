console.log('Gestiones mobile.js cargado');

var todosDatos = [];
var currentOffset = 0;
var currentLimit = 30;
var isLoading = false;
var hasMoreData = true;

function getFechaHoraActual() {
    var ahora = new Date();
    var dia = String(ahora.getDate()).padStart(2, '0');
    var mes = String(ahora.getMonth() + 1).padStart(2, '0');
    var anio = ahora.getFullYear();
    var hora = String(ahora.getHours()).padStart(2, '0');
    var minuto = String(ahora.getMinutes()).padStart(2, '0');
    return dia + '/' + mes + '/' + anio + ' ' + hora + ':' + minuto;
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
    var cedula = q;
    var nombre = q;
    var telefono = q;
    var observacion = q;
    var tipo = document.getElementById('tipo-gestion')?.value || '';
    
    currentOffset = 0;
    todosDatos = [];
    
    try {
        var url = '/api/excel/gestiones/todas?limite=' + currentLimit + '&offset=0';
        if (cedula) url += '&cedula=' + encodeURIComponent(cedula);
        if (nombre) url += '&nombre=' + encodeURIComponent(nombre);
        if (telefono) url += '&telefono=' + encodeURIComponent(telefono);
        if (observacion) url += '&observacion=' + encodeURIComponent(observacion);
        if (tipo) url += '&tipo_gestion=' + encodeURIComponent(tipo);
        
        var response = await fetch(url);
        
        if (!response.ok) {
            console.error('Error HTTP:', response.status);
            if (response.status === 401) {
                alert('Sesión expirada');
                window.location.href = '/movil/login.html';
            }
            return;
        }
        
        var result = await response.json();
        
        if (result && result.error) {
            console.error('API Error:', result.error);
            if (result.error === 'No autenticado') {
                alert('Sesión expirada');
                window.location.href = '/movil/login.html';
            }
            return;
        }
        
        var datosRecibidos = Array.isArray(result) ? result : (result.data || []);
        todosDatos = datosRecibidos;
        
        var total = Array.isArray(result) ? result.length : (result.total || 0);
        hasMoreData = datosRecibidos.length < total;
        
        document.getElementById('total-registros').textContent = total;
        document.getElementById('mostrando').textContent = datosRecibidos.length;
        
        renderizarLista(datosRecibidos);
        
        console.log('Gestiones encontradas:', datosRecibidos.length);
    } catch (error) {
        console.error('Error en búsqueda:', error);
        alert('Error al buscar gestines');
    }
}

function renderizarLista(datos) {
    var lista = document.getElementById('lista-gestiones');
    
    if (!lista) return;
    
    if (!datos.length) {
        lista.innerHTML = '<div class="empty-state">No se encontraron gestines</div>';
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
        
        html += '<div class="gestion-card" onclick="verGestion(\'' + g.id + '\')">';
        html += '<div class="gestion-header">';
        html += '<span class="gestion-id">#' + g.solicitud_id + '</span>';
        html += '<span class="gestion-badge" style="background:' + color + ';">' + g.tipo_gestion + '</span>';
        html += '</div>';
        html += '<div class="gestion-body">';
        html += '<p><strong>' + (g.nombre || 'Sin nombre') + '</strong></p>';
        html += '<p class="gestion-cedula">Cédula: ' + (g.cedula || '-') + '</p>';
        html += '<p class="gestion-obs">' + (g.observacion || 'Sin observación') + '</p>';
        html += '</div>';
        html += '<div class="gestion-footer">';
        html += '<span class="gestion-fecha">' + fechaFormateada + '</span>';
        html += '<div class="gestion-actions">';
        html += '<button class="btn-icon" onclick="event.stopPropagation(); agregarSeguimiento(\'' + g.solicitud_id + '\')">➕</button> ';
        html += '<button class="btn-icon" onclick="event.stopPropagation(); eliminarGestion(\'' + g.id + '\')">🗑️</button>';
        html += '</div>';
        html += '</div>';
        html += '</div>';
    }
    
    lista.innerHTML = html;
}

function verGestion(id) {
    var gestion = todosDatos.find(function(g) { return g.id == id; });
    if (!gestion) {
        alert('Gestión no encontrada');
        return;
    }
    
    var contenido = '';
    contenido += '<div class="modal-content">';
    contenido += '<h2>📋 Gestión #' + id + '</h2>';
    contenido += '<div class="modal-body">';
    contenido += '<p><strong>Solicitud:</strong> ' + gestion.solicitud_id + '</p>';
    contenido += '<p><strong>Cédula:</strong> ' + gestion.cedula + '</p>';
    contenido += '<p><strong>Nombre:</strong> ' + (gestion.nombre || '') + '</p>';
    contenido += '<p><strong>Celular:</strong> ' + (gestion.celular || '') + '</p>';
    contenido += '<p><strong>Tipo:</strong> ' + gestion.tipo_gestion + '</p>';
    contenido += '<p><strong>Fecha:</strong> ' + formatFechaGestion(gestion.fecha_gestion) + '</p>';
    contenido += '<p><strong>Observación:</strong></p>';
    contenido += '<div class="obs-box">' + (gestion.observacion || 'Sin observación') + '</div>';
    contenido += '</div>';
    contenido += '<div class="modal-footer">';
    contenido += '<button onclick="cerrarModal()" class="btn btn-secondary">Cerrar</button>';
    contenido += '</div>';
    contenido += '</div>';
    
    crearModal(contenido);
}

function agregarSeguimiento(solicitudId) {
    // Similar a desktop pero adaptado para móvil
    var opcionesTipo = '';
    var tipos = ['Seguimiento', 'Cobranza', 'Llamada', 'WhatsApp', 'Reclamo', 'Cita', 'Otro'];
    for (var j = 0; j < tipos.length; j++) {
        opcionesTipo += '<option value="' + tipos[j] + '">' + tipos[j] + '</option>';
    }
    
    var contenido = '';
    contenido += '<div class="modal-content">';
    contenido += '<h2>➕ Nuevo Seguimiento</h2>';
    contenido += '<div class="modal-body">';
    contenido += '<p><strong>Solicitud:</strong> ' + solicitudId + '</p>';
    contenido += '<label>Tipo:</label>';
    contenido += '<select id="seguimiento-tipo" class="form-select">' + opcionesTipo + '</select>';
    contenido += '<label>Observación:</label>';
    contenido += '<textarea id="seguimiento-observacion" class="form-textarea" rows="4" placeholder="Escriba su observación..."></textarea>';
    contenido += '</div>';
    contenido += '<div class="modal-footer">';
    contenido += '<button onclick="cerrarModal()" class="btn btn-secondary">Cancelar</button>';
    contenido += '<button onclick="guardarSeguimiento(\'' + solicitudId + '\')" class="btn btn-primary">Guardar</button>';
    contenido += '</div>';
    contenido += '</div>';
    
    crearModal(contenido);
}

function guardarSeguimiento(solicitudId) {
    var tipoSelect = document.getElementById('seguimiento-tipo');
    var observacionInput = document.getElementById('seguimiento-observacion');
    
    var tipo_gestion = tipoSelect ? tipoSelect.value : '';
    var observacion = observacionInput ? observacionInput.value.trim() : '';
    
    if (!tipo_gestion) {
        alert('Seleccione un tipo');
        return;
    }
    
    if (!observacion) {
        alert('Escriba una observación');
        return;
    }
    
    fetch('/api/excel/gestiones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            solicitud_id: solicitudId,
            tipo_gestion: tipo_gestion,
            observacion: observacion,
            gestion_maestro_id: campanhaAtual && campanhaAtual !== 0 ? campanhaAtual : null
        })
    })
    .then(function(res) { return res.json(); })
    .then(function(resultado) {
        if (resultado && !resultado.error) {
            alert('Seguimiento guardado');
            cerrarModal();
            buscarGestiones();
        } else {
            alert('Error: ' + (resultado.error || 'Error desconocido'));
        }
    })
    .catch(function(err) {
        console.error('Error:', err);
        alert('Error al guardar');
    });
}

function eliminarGestion(id) {
    if (!confirm('¿Eliminar esta gestión?')) {
        return;
    }
    
    fetch('/api/excel/gestiones/' + id, {
        method: 'DELETE'
    })
    .then(function(res) { return res.json(); })
    .then(function(resultado) {
        if (resultado && !resultado.error) {
            alert('Gestión eliminada');
            buscarGestiones();
        } else {
            alert('Error: ' + (resultado.error || 'Error'));
        }
    })
    .catch(function(err) {
        console.error('Error:', err);
        alert('Error al eliminar');
    });
}

function crearModal(contenido) {
    var overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.id = 'modal-gestiones';
    overlay.innerHTML = contenido;
    overlay.onclick = function(e) {
        if (e.target === overlay) {
            cerrarModal();
        }
    };
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
    document.getElementById('tipo-gestion').selectedIndex = 0;
    buscarGestiones();
}


// Infinite scroll
function initInfiniteScroll() {
    var sentinel = document.getElementById('infinite-scroll-sentinel');
    if (!sentinel) {
        sentinel = document.createElement('div');
        sentinel.id = 'infinite-scroll-sentinel';
        sentinel.style.cssText = 'height:50px;display:flex;align-items:center;justify-content:center;';
        sentinel.innerHTML = '📜 Cargar más...';
        document.getElementById('lista-gestiones')?.appendChild(sentinel);
    }
    
    if ('IntersectionObserver' in window) {
        var observer = new IntersectionObserver(function(entries) {
            var entry = entries[0];
            if (entry.isIntersecting && hasMoreData && !isLoading) {
                cargarMas();
            }
        }, { rootMargin: '100px' });
        
        observer.observe(sentinel);
    }
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
            currentOffset = 0; // reset paging for new query
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

async function cargarMas() {
    if (isLoading || !hasMoreData) return;
    
    isLoading = true;
    var sentinel = document.getElementById('infinite-scroll-sentinel');
    if (sentinel) sentinel.innerHTML = '⏳ Cargando...';
    
    var q = document.getElementById('busqueda-general')?.value || '';
    var cedula = q;
    var nombre = q;
    var telefono = q;
    var observacion = q;
    var tipo = document.getElementById('tipo-gestion')?.value || '';
    
    currentOffset += currentLimit;
    
    try {
        var url = '/api/excel/gestiones/todas?limite=' + currentLimit + '&offset=' + currentOffset;
        if (cedula) url += '&cedula=' + encodeURIComponent(cedula);
        if (nombre) url += '&nombre=' + encodeURIComponent(nombre);
        if (telefono) url += '&telefono=' + encodeURIComponent(telefono);
        if (observacion) url += '&observacion=' + encodeURIComponent(observacion);
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
            
            renderizarLista(todosDatos);
        } else {
            hasMoreData = false;
        }
    } catch (error) {
        console.error('Error cargando más:', error);
    } finally {
        isLoading = false;
        if (sentinel) {
            sentinel.innerHTML = hasMoreData ? '📜 Cargar más...' : '✅ Fin de registros';
        }
    }
}

// Initialize
buscarGestiones();
initInfiniteScroll();
initSearchListeners();
