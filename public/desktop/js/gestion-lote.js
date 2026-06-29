console.log('Cargando gestion-lote.js...');

// Variables globales
var gestionId = null;
var datosGestion = null;
var solicitudes = [];
var todasLasSolicitudes = [];
var campañas = [];

// Objeto SidebarCampanas para manejar el toggle del sidebar
var SidebarCampanas = {
    isOpen: true,
    
    toggle: function() {
        this.isOpen = !this.isOpen;
        var sidebar = document.getElementById('sidebar-campañas');
        var layout = document.querySelector('.layout');
        
        if (this.isOpen) {
            sidebar.classList.remove('oculto');
            layout.classList.remove('sidebar-hidden');
        } else {
            sidebar.classList.add('oculto');
            layout.classList.add('sidebar-hidden');
        }
    },
    
    show: function() {
        if (!this.isOpen) {
            this.toggle();
        }
    },
    
    hide: function() {
        if (this.isOpen) {
            this.toggle();
        }
    }
};

// Obtener ID de la gestión de la URL
function obtenerGestionId() {
    var urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('id');
}

// Cargar datos de la gestión al iniciar
async function init() {
    // Primero cargar las campañas en el sidebar
    await cargarListaCampanas();
    
    // Luego verificar si hay un ID en la URL
    gestionId = obtenerGestionId();
    
    if (gestionId) {
        await cargarGestion();
        await cargarSolicitudes();
        // Marcar la campaña como activa
        marcarCampañaActiva(gestionId);
    }
}

// Cargar lista de todas las campañas en el sidebar
async function cargarListaCampanas() {
    try {
        var container = document.getElementById('lista-campañas');
        
        var response = await fetch('/api/gestiones-maestro');
        
        if (!response.ok) {
            throw new Error('Error al cargar');
        }
        
        campañas = await response.json();
        
        if (!campañas || campañas.length === 0) {
            container.innerHTML = '<div class="empty">'+
                '<p>No hay campañas.</p>'+
                '<p>Ve a Solicitudes para crear una.</p>'+
                '</div>';
            return;
        }
        
        var html = '';
        
        for (var i = 0; i < campañas.length; i++) {
            var g = campañas[i];
            var pct = g.total_solicitudes > 0 ? Math.round((g.gestionadas / g.total_solicitudes) * 100) : 0;
            var isActive = gestionId && String(g.id) === String(gestionId) ? 'active' : '';
            
            html += '<div class="campaña-card ' + isActive + '" onclick="seleccionarCampaña(' + g.id + ')">';
            html += '<div class="campaña-nombre">';
            html += '<span class="campaña-id">#' + g.id + '</span>';
            html += '<span>' + (g.nombre || 'Sin nombre') + '</span>';
            html += '</div>';
            html += '<div class="campaña-stats">';
            html += '<span>📄 ' + (g.total_solicitudes || 0) + '</span>';
            html += '<span>✓ ' + (g.gestionadas || 0) + '</span>';
            html += '<span>📊 ' + pct + '%</span>';
            html += '</div>';
            html += '<div class="campaña-progreso">';
            html += '<div class="campaña-progreso-barra" style="width: ' + pct + '%;"></div>';
            html += '</div>';
            
var estadoClase = (g.estado === 'Completada' || pct === 100) ? 'completada' : 'activa';
            html += '<span class="campaña-estado ' + estadoClase + '">' + (g.estado || 'Activa') + '</span>';
            
            // Botón de eliminar
            html += '<button class="campaña-btn-eliminar" onclick="event.stopPropagation(); confirmarEliminarCampaña(' + g.id + ', \'' + (g.nombre || 'Gestión #' + g.id) + '\', ' + (g.total_solicitudes || 0) + ', ' + (g.gestionadas || 0) + ')">🗑️</button>';
            html += '</div>';
        }
        
        container.innerHTML = html;
        
    } catch (error) {
        console.error('Error cargando lista:', error);
        document.getElementById('lista-campañas').innerHTML = 
            '<div class="error">Error al cargar las campañas</div>';
    }
}

// Seleccionar una campaña
function seleccionarCampaña(id) {
    // Actualizar el ID global
    gestionId = id;
    
    // Marcar visualmente como activa
    marcarCampañaActiva(id);
    
    // Navegar a la URL con el ID
    window.location.href = '/gestion-lote?id=' + id;
}

// Marcar campaña como activa en el sidebar
function marcarCampañaActiva(id) {
    var cards = document.querySelectorAll('.campaña-card');
    for (var i = 0; i < cards.length; i++) {
        cards[i].classList.remove('active');
    }
    
    // Encontrar la tarjeta correspondiente
    var card = document.querySelector('.campaña-card[onclick="seleccionarCampaña(' + id + ')"]');
    if (card) {
        card.classList.add('active');
    }
}

// Cargar datos de la gestión
async function cargarGestion() {
    try {
        var response = await fetch('/api/gestiones-maestro/' + gestionId);
        
        if (!response.ok) {
            var error = await response.json();
            alert('Error: ' + (error.error || 'Error al cargar la gestión'));
            window.location.href = '/solicitudes';
            return;
        }
        
        datosGestion = await response.json();
        
        // Actualizar título
        document.getElementById('gestion-nombre').textContent = datosGestion.nombre || 'Gestión #' + gestionId;
        
// Mostrar panel de progreso y filtros
        document.getElementById('panel-progreso').style.display = 'block';
        document.getElementById('filtros-row').style.display = 'flex';
        
        // Actualizar contadores
        actualizarProgreso();
        
    } catch (error) {
        console.error('Error cargando gestión:', error);
        alert('Error al cargar la gestión');
        window.location.href = '/solicitudes';
    }
}

// Actualizar progreso
function actualizarProgreso() {
    if (!datosGestion) return;
    
    var total = datosGestion.total_solicitudes || 0;
    var gestionadas = 0;
    
    // Contar gestionadas
    solicitudes.forEach(function(sol) {
        if (sol.gestion_id && sol.tipo_gestion && sol.tipo_gestion !== 'Pendiente') {
            gestionadas++;
        }
    });
    
    var pendientes = total - gestionadas;
    var porcentaje = total > 0 ? Math.round((gestionadas / total) * 100) : 0;
    
    document.getElementById('total-solicitudes').textContent = total;
    document.getElementById('gestionadas').textContent = gestionadas;
    document.getElementById('pendientes').textContent = pendientes;
    document.getElementById('progreso-porcentaje').textContent = porcentaje + '%';
    document.getElementById('barra-progreso').style.width = porcentaje + '%';
}

// Cargar solicitudes de la gestión
async function cargarSolicitudes() {
    try {
        var container = document.getElementById('lista-solicitudes');
        container.innerHTML = '<div class="loading">Cargando solicitudes...</div>';
        
        var response = await fetch('/api/gestiones-maestro/' + gestionId);
        
        if (!response.ok) {
            throw new Error('Error al cargar');
        }
        
        datosGestion = await response.json();
        solicitudes = datosGestion.solicitudes || [];
        todasLasSolicitudes = [...solicitudes];
        
        renderizarSolicitudes(solicitudes);
        actualizarProgreso();
        
    } catch (error) {
        console.error('Error cargando solicitudes:', error);
        document.getElementById('lista-solicitudes').innerHTML = 
            '<div class="error">Error al cargar las solicitudes</div>';
    }
}

// Renderizar lista de solicitudes
function renderizarSolicitudes(lista) {
    var container = document.getElementById('lista-solicitudes');
    
    if (!lista || lista.length === 0) {
        container.innerHTML = '<div class="empty">No hay solicitudes en esta gestión</div>';
        return;
    }
    
    var busqueda = document.getElementById('busqueda').value.toLowerCase();
    var filtroEstado = document.getElementById('filtro-estado').value;
    
    // Filtrar
    var filtradas = lista.filter(function(sol) {
        // Filtro por búsqueda
        if (busqueda) {
            var matchId = sol.id_solicitud && String(sol.id_solicitud).includes(busqueda);
            var matchCedula = sol.cedula && sol.cedula.toString().toLowerCase().includes(busqueda);
            var matchNombre = sol.nombre && sol.nombre.toLowerCase().includes(busqueda);
            var matchCelular = sol.celular && sol.celular.toString().includes(busqueda);
            if (!matchId && !matchCedula && !matchNombre && !matchCelular) return false;
        }
        
        // Filtro por estado
        if (filtroEstado) {
            var estadoActual = sol.tipo_gestion || 'Pendiente';
            if (estadoActual !== filtroEstado) return false;
        }
        
        return true;
    });
    
    if (filtradas.length === 0) {
        container.innerHTML = '<div class="empty">No hay solicitudes que coincidan con los filtros</div>';
        return;
    }
    
    var html = '';
    
    for (var i = 0; i < filtradas.length; i++) {
        var sol = filtradas[i];
        var estado = sol.tipo_gestion || 'Pendiente';
        var gestionId = sol.gestion_id;
        var observacion = sol.gestion_obs || '';
        
        var coloresEstado = {
            'Pendiente': '#fef3c7',
            'Llamada': '#d1fae5',
            'WhatsApp': '#dcfce7',
            'Seguimiento': '#dbeafe',
            'Cobranza': '#fee2e2',
            'Cita': '#e0e7ff',
            'Completada': '#bbf7d0'
        };
        
        var colorFondo = coloresEstado[estado] || '#f3f4f6';
        var gestionada = estado !== 'Pendiente';
        
        html += '<div class="sol-card ' + (gestionada ? 'gestionada' : 'pendiente') + '">';
        
        // Header
        html += '<div class="sol-header">';
        html += '<span class="sol-id">#' + sol.id_solicitud + '</span>';
        html += '<span class="sol-estado" style="background:' + colorFondo + ';">' + estado + '</span>';
        html += '</div>';
        
        // Info
        html += '<div class="sol-info">';
        html += '<div class="sol-nombre">' + (sol.nombre || 'Sin nombre') + '</div>';
        html += '<div class="sol-datos">';
        html += '<span>📍 ' + (sol.cedula || '—') + '</span>';
        html += '<span>📱 ' + (sol.celular || '—') + '</span>';
        html += '<span>🏷️ ' + (sol.segmento || '—') + '</span>';
        html += '</div>';
        html += '</div>';
        
// Observación - mostrar siempre de forma visible
        if (observacion) {
            html += '<div class="sol-observacion">' + observacion + '</div>';
        } else {
            html += '<div class="sol-observacion-vacia">Sin observación registrada</div>';
        }
        
// Acciones
        html += '<div class="sol-acciones">';
        
        if (!gestionada) {
            html += '<button class="btn-accion btn-llamar" onclick="abrirGestion(\'' + sol.id_solicitud + '\', \'Llamada\')">📞 Llamada</button>';
            html += '<button class="btn-accion btn-whatsapp" onclick="abrirGestion(\'' + sol.id_solicitud + '\', \'WhatsApp\')">💬 WhatsApp</button>';
            html += '<button class="btn-accion btn-whatsapp-img" onclick="abrirGestionWhatsApp(\'' + sol.id_solicitud + '\', \'' + (sol.celular || '') + '\')">📷 WhatsApp c/Imagen</button>';
            html += '<button class="btn-accion btn-seguimiento" onclick="abrirGestion(\'' + sol.id_solicitud + '\', \'Seguimiento\')">📋 Seguimiento</button>';
            html += '<button class="btn-accion btn-cobranza" onclick="abrirGestion(\'' + sol.id_solicitud + '\', \'Cobranza\')">💰 Cobranza</button>';
            html += '<button class="btn-accion btn-completar" onclick="abrirGestion(\'' + sol.id_solicitud + '\', \'Completada\')">✅ Completar</button>';
        } else {
            html += '<button class="btn-accion btn-ver" onclick="verGestion(\'' + sol.id_solicitud + '\')">👁️ Ver Gestión</button>';
        }
        
        html += '</div>';
        
        html += '</div>';
    }
    
    container.innerHTML = html;
}

// Abrir modal de gestión para una solicitud
function abrirGestion(solicitudId, tipo) {
    var sol = solicitudes.find(function(s) { return s.id_solicitud == solicitudId; });
    
    if (!sol) {
        alert('Solicitud no encontrada');
        return;
    }
    
    var opcionesDropdown = '';
    var opciones = ['Llamada', 'WhatsApp', 'Seguimiento', 'Cobranza', 'Cita', 'Completada', 'Otro'];
    
    for (var i = 0; i < opciones.length; i++) {
        var selected = opciones[i] === tipo ? 'selected' : '';
        opcionesDropdown += '<option value="' + opciones[i] + '" ' + selected + '>' + opciones[i] + '</option>';
    }
    
    var contenido = '';
    
    contenido += '<div class="modal-gestion">';
    contenido += '<h2>📋 Gestionar Solicitud #' + solicitudId + '</h2>';
    
    // Info del cliente
    contenido += '<div class="modal-info">';
    contenido += '<p><strong>Nombre:</strong> ' + (sol.nombre || '—') + '</p>';
    contenido += '<p><strong>Cédula:</strong> ' + (sol.cedula || '—') + '</p>';
    contenido += '<p><strong>Celular:</strong> ' + (sol.celular || '—') + '</p>';
    contenido += '</div>';
    
    // Formulario
    contenido += '<div class="modal-form">';
    contenido += '<label>📋 Tipo de Gestión:</label>';
    contenido += '<select id="tipo-gestion-modal">' + opcionesDropdown + '</select>';
    
    contenido += '<label>📝 Observación:</label>';
    contenido += '<textarea id="observacion-modal" rows="4" placeholder="Escriba su observación..."></textarea>';
    
    contenido += '<div class="modal-botones">';
    contenido += '<button class="btn-cancelar" onclick="cerrarModal()">Cancelar</button>';
    contenido += '<button class="btn-guardar" onclick="guardarGestionIndividual(\'' + solicitudId + '\')">💾 Guardar</button>';
    contenido += '</div>';
    contenido += '</div>';
    contenido += '</div>';
    
    crearModal(contenido);
}

// Guardar gestión individual
async function guardarGestionIndividual(solicitudId) {
    var tipo = document.getElementById('tipo-gestion-modal').value;
    var observacion = document.getElementById('observacion-modal').value.trim();
    
    if (!observacion) {
        alert('Por favor escriba una observación');
        return;
    }
    
    var btn = document.querySelector('.btn-guardar');
    btn.textContent = '💾 Guardando...';
    btn.disabled = true;
    
    try {
        var response = await fetch('/api/excel/gestiones', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                solicitud_id: solicitudId,
                tipo_gestion: tipo,
                observacion: observacion,
                gestion_maestro_id: gestionId
            })
        });
        
        var resultado = await response.json();
        
        if (response.ok && !resultado.error) {
            alert('Gestión guardada correctamente');
            cerrarModal();
            cargarSolicitudes();
        } else {
            alert('Error: ' + (resultado.error || 'Error desconocido'));
        }
    } catch (error) {
        console.error('Error guardando gestión:', error);
        alert('Error al guardar la gestión');
    } finally {
        btn.textContent = '💾 Guardar';
        btn.disabled = false;
    }
}

// Ver gestión existente
function verGestion(solicitudId) {
    var sol = solicitudes.find(function(s) { return s.id_solicitud == solicitudId; });
    
    if (!sol || !sol.gestion_id) {
        alert('No hay gestión registrada');
        return;
    }
    
    var contenido = '';
    
    contenido += '<div class="modal-ver">';
    contenido += '<h2>📋 Gestión - Solicitud #' + solicitudId + '</h2>';
    contenido += '<div class="modal-info">';
    contenido += '<p><strong>Tipo:</strong> ' + (sol.tipo_gestion || '—') + '</p>';
    contenido += '<p><strong>Fecha:</strong> ' + (sol.fecha_gestion || '—') + '</p>';
    contenido += '<p><strong>Observación:</strong></p>';
    contenido += '<div class="modal-observacion">' + (sol.gestion_obs || 'Sin observación') + '</div>';
    contenido += '</div>';
    contenido += '<button class="btn-cerrar" onclick="cerrarModal()">Cerrar</button>';
    contenido += '</div>';
    
    crearModal(contenido);
}

// Crear modal genérico
function crearModal(contenido) {
    var modalExistente = document.getElementById('modal-generico');
    if (modalExistente) {
        modalExistente.remove();
    }
    
    var overlay = document.createElement('div');
    overlay.id = 'modal-generico';
    overlay.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 9999; display: flex; align-items: center; justify-content: center;';
    
    var modal = document.createElement('div');
    modal.style.cssText = 'background: white; border-radius: 16px; max-width: 600px; width: 90%; max-height: 90vh; overflow: auto; box-shadow: 0 20px 60px rgba(0,0,0,0.4); padding: 30px;';
    modal.innerHTML = contenido;
    
    overlay.onclick = function(e) {
        if (e.target === overlay) {
            cerrarModal();
        }
    };
    
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
}

// Cerrar modal
function cerrarModal() {
    var modal = document.getElementById('modal-generico');
    if (modal) {
        modal.remove();
    }
}

// Eventos
document.getElementById('busqueda').addEventListener('input', function() {
    renderizarSolicitudes(todasLasSolicitudes);
});

document.getElementById('filtro-estado').addEventListener('change', function() {
    renderizarSolicitudes(todasLasSolicitudes);
});

// Iniciar
init();

// ================== WHATSAPP CON IMAGEN INDIVIDUAL ==================

// Función para abrir WhatsApp Web con wa.me
function abrirWhatsAppWeb(celular, mensaje) {
    var numeroLimpio = String(celular).replace(/[^0-9]/g, '');
    if (numeroLimpio.length === 8) {
        numeroLimpio = '505' + numeroLimpio;
    }
    var urlWhatsApp = 'https://wa.me/' + numeroLimpio;
    if (mensaje) {
        urlWhatsApp += '?text=' + encodeURIComponent(mensaje);
    }
    var win = window.open(urlWhatsApp, '_blank');
    if (!win) {
        alert('Por favor permite ventanas emergentes para WhatsApp');
    }
}

// Abrir modal de WhatsApp con imagen para una solicitud específica
function abrirGestionWhatsApp(solicitudId, celular) {
    var sol = solicitudes.find(function(s) { return s.id_solicitud == solicitudId; });
    
    if (!sol) {
        alert('Solicitud no encontrada');
        return;
    }
    
    // Validar que tenga celular
    if (!celular || celular === '') {
        alert('Esta solicitud no tiene número de celular');
        return;
    }
    
    var contenido = '';
    
    contenido += '<div class="modal-gestion">';
    contenido += '<h2>📷 WhatsApp c/Imagen - Solicitud #' + solicitudId + '</h2>';
    
    // Info del cliente
    contenido += '<div class="modal-info">';
    contenido += '<p><strong>Nombre:</strong> ' + (sol.nombre || '—') + '</p>';
    contenido += '<p><strong>Celular:</strong> ' + celular + '</p>';
    contenido += '</div>';
    
    // Formulario
    contenido += '<div class="modal-form">';
    contenido += '<label>📝 Mensaje:</label>';
    contenido += '<textarea id="whatsapp-img-mensaje" rows="3" placeholder="Escriba su mensaje..."></textarea>';
    
    contenido += '<label>📎 Seleccionar Imagen:</label>';
    contenido += '<input type="file" id="whatsapp-img-input" accept="image/jpeg,image/png,image/webp" onchange="previsualizarWhatsAppImg(event)">';
    contenido += '<div id="whatsapp-img-preview-container" style="display: none; margin-top: 12px; text-align: center;">';
    contenido += '<img id="whatsapp-img-preview" style="max-width: 200px; max-height: 200px; border-radius: 8px; border: 2px solid #e2e8f0;">';
    contenido += '<div style="margin-top: 8px;"><button type="button" onclick="quitarWhatsAppImg()" style="padding: 6px 12px; background: #fee2e2; border: none; border-radius: 4px; cursor: pointer;">Quitar Imagen</button></div>';
    contenido += '</div>';
    
    // Nuevo check para abrir WhatsApp Web
    contenido += '<div style="margin-top: 16px; padding: 12px; background: #f0fdf4; border-radius: 8px;">';
    contenido += '<label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">';
    contenido += '<input type="checkbox" id="whatsapp-abrir-web" checked style="width: 20px; height: 20px;">';
    contenido += '<span>📱 Abrir WhatsApp Web automáticamente</span>';
    contenido += '</label>';
    contenido += '</div>';
    
    contenido += '<div class="modal-botones">';
    contenido += '<button class="btn-cancelar" onclick="cerrarModal()">Cancelar</button>';
    contenido += '<button class="btn-guardar" id="btn-whatsapp-img" onclick="enviarWhatsAppImagen(\'' + solicitudId + '\', \'' + celular + '\')">📤 Enviar</button>';
    contenido += '</div>';
    contenido += '</div>';
    contenido += '</div>';
    
    crearModal(contenido);
}

// Previsualizar imagen para WhatsApp individual
function previsualizarWhatsAppImg(event) {
    var file = event.target.files[0];
    if (!file) return;
    
    // Validar tipo
    var tiposPermitidos = ['image/jpeg', 'image/png', 'image/webp'];
    if (!tiposPermitidos.includes(file.type)) {
        alert('Solo se permiten imágenes JPG, PNG o WebP');
        event.target.value = '';
        return;
    }
    
    // Validar tamaño (5MB)
    if (file.size > 5 * 1024 * 1024) {
        alert('La imagen no puede superar 5MB');
        event.target.value = '';
        return;
    }
    
    // Preview
    var reader = new FileReader();
    reader.onload = function(e) {
        var container = document.getElementById('whatsapp-img-preview-container');
        var img = document.getElementById('whatsapp-img-preview');
        if (container && img) {
            container.style.display = 'block';
            img.src = e.target.result;
        }
    };
    reader.readAsDataURL(file);
}

// Quitar imagen de WhatsApp individual
function quitarWhatsAppImg() {
    var input = document.getElementById('whatsapp-img-input');
    var container = document.getElementById('whatsapp-img-preview-container');
    if (input) input.value = '';
    if (container) container.style.display = 'none';
}

// Abrir WhatsApp Web directamente (sin esperar upload)
function abrirWhatsAppWeb(celular, mensaje) {
    // Limpiar y formatear número
    var numeroLimpio = String(celular).replace(/[^0-9]/g, '');
    
    // Si no tiene código de país, agregar 505 (Nicaragua)
    if (numeroLimpio.length === 8) {
        numeroLimpio = '505' + numeroLimpio;
    }
    
    // Usar wa.me que es más confiable que web.whatsapp.com
    var urlWhatsApp = 'https://wa.me/' + numeroLimpio;
    
    if (mensaje) {
        urlWhatsApp += '?text=' + encodeURIComponent(mensaje);
    }
    
    console.log('DEBUG: Abriendo WhatsApp Web:', urlWhatsApp);
    
    // Abrir en nueva pestaña
    var win = window.open(urlWhatsApp, '_blank');
    if (!win) {
        alert('Por favor permite ventanas emergentes para enviar mensajes de WhatsApp');
    }
}

// ================== ELIMINAR CAMPAÑA ==================

// Mostrar modal de confirmación para eliminar campaña
function confirmarEliminarCampaña(id, nombre, total, gestionadas) {
    var contenido = '';
    
    contenido += '<div class="modal-eliminar">';
    contenido += '<h2>🗑️ Eliminar Campaña</h2>';
    
    contenido += '<div class="modal-info-eliminar">';
    contenido += '<p><strong>Campaña:</strong> ' + nombre + '</p>';
    contenido += '<p><strong>Total Solicitudes:</strong> ' + total + '</p>';
    contenido += '<p><strong>Gestionadas:</strong> ' + gestionadas + '</p>';
    contenido += '<p><strong>Pendientes:</strong> ' + (total - gestionadas) + '</p>';
    contenido += '</div>';
    
    // Advertencia
    contenido += '<div class="modal-advertencia">';
    contenido += '<p>⚠️ <strong>IMPORTANTE:</strong></p>';
    contenido += '<ul>';
contenido += '<li>Se eliminarán <strong>TODAS las gestione</strong> registradas en estas ' + total + ' solicitudes.</li>';
    contenido += '<li>Esta acción es <strong>IRREVERSIBLE</strong>.</li>';
    contenido += '<li>Los datos de las solicitudes originale NO se eliminarán.</li>';
    contenido += '</ul>';
    contenido += '</div>';
    
    contenido += '<div class="modal-botones">';
    contenido += '<button class="btn-cancelar" onclick="cerrarModal()">Cancelar</button>';
    contenido += '<button class="btn-eliminar" id="btn-eliminar-campaña" onclick="eliminarCampaña(' + id + ')">🗑️ Eliminar</button>';
    contenido += '</div>';
    contenido += '</div>';
    
    crearModal(contenido);
}

// Eliminar campaña
async function eliminarCampaña(id) {
    var btn = document.getElementById('btn-eliminar-campaña');
    btn.textContent = '⏳ Eliminando...';
    btn.disabled = true;
    
    try {
        var response = await fetch('/api/gestiones-maestro/' + id, {
            method: 'DELETE'
        });
        
        var resultado = await response.json();
        
        if (response.ok && !resultado.error) {
            alert('✅ Campaña eliminada correctamente');
            cerrarModal();
            
            // Si era la campaña activa, redirigir
            if (String(gestionId) === String(id)) {
                window.location.href = '/gestion-lote';
            } else {
                cargarListaCampanas();
            }
        } else {
            alert('Error: ' + (resultado.error || 'Error al eliminar'));
            btn.textContent = '🗑️ Eliminar';
            btn.disabled = false;
        }
    } catch (error) {
        console.error('Error eliminando:', error);
        alert('Error al eliminar la campaña');
        btn.textContent = '🗑️ Eliminar';
        btn.disabled = false;
    }
}

// ================== FIN ELIMINAR CAMPAÑA ==================

// Enviar WhatsApp con imagen
async function enviarWhatsAppImagen(solicitudId, celular) {
    var mensaje = document.getElementById('whatsapp-img-mensaje').value.trim();
    var fileInput = document.getElementById('whatsapp-img-input');
    var file = fileInput ? fileInput.files[0] : null;
    var checkboxAbrirWeb = document.getElementById('whatsapp-abrir-web');
    var abrirWeb = checkboxAbrirWeb ? checkboxAbrirWeb.checked : true;
    
    if (!mensaje && !file) {
        alert('Escriba un mensaje o seleccione una imagen');
        return;
    }
    
    var btn = document.getElementById('btn-whatsapp-img');
    btn.textContent = '⏳ Procesando...';
    btn.disabled = true;
    
    try {
        // 0. ABRIR WHATSAPP WEB PRIMERO (antes de operaciones async)
        // Esto evita que el navegador bloquee la ventana emergente
        if (abrirWeb) {
            abrirWhatsAppWeb(celular, mensaje);
        }
        
        // 1. Subir imagen si existe
        var imagenUrl = null;
        if (file) {
            var formData = new FormData();
            formData.append('imagen', file);
            
            var uploadResponse = await fetch('/api/excel/upload-imagen', {
                method: 'POST',
                body: formData
            });
            
            // Verificar que la respuesta es OK antes de parsear JSON
            if (!uploadResponse.ok) {
                var errorText = await uploadResponse.text();
                console.error('ERROR upload-imagen:', errorText);
                throw new Error('Error al subir imagen: ' + uploadResponse.status);
            }
            
            var uploadResult = await uploadResponse.json();
            if (!uploadResult.success) {
                throw new Error(uploadResult.error || 'Error al subir imagen');
            }
            imagenUrl = uploadResult.url;
            console.log('DEBUG: Imagen subida:', imagenUrl);
        }
        
        // 2. Guardar gestión en la base de datos
        var observacion = mensaje;
        if (imagenUrl) {
            observacion = (mensaje ? mensaje + '\n\n' : '') + '[Imagen: ' + imagenUrl + ']';
        }
        
        var response = await fetch('/api/excel/gestiones', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                solicitud_id: solicitudId,
                tipo_gestion: 'WhatsApp',
                observacion: observacion,
                gestion_maestro_id: gestionId
            })
        });
        
        var resultado = await response.json();
        
if (!response.ok || resultado.error) {
            throw new Error(resultado.error || 'Error al guardar gestión');
        }
        
        alert('✅ Gestión guardada');
        
        cerrarModal();
        cargarSolicitudes();
        
    } catch (error) {
        console.error('Error:', error);
        alert('Error: ' + error.message);
    } finally {
        btn.textContent = '📤 Enviar';
        btn.disabled = false;
    }
}

