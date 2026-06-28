console.log('Cargando movil/gestion-lote.js...');

var gestionId = null;
var datosGestion = null;
var solicitudes = [];
var todasLasSolicitudes = [];
var campañas = [];

function obtenerGestionId() {
    var urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('id');
}

async function init() {
    await cargarListaCampanas();

    gestionId = obtenerGestionId();
    if (gestionId) {
        await cargarGestion();
        await cargarSolicitudes();
        marcarCampañaActiva(gestionId);
    }
}

async function cargarListaCampanas() {
    try {
        var container = document.getElementById('lista-campañas');
        var response = await fetch('/api/gestiones-maestro');
        if (!response.ok) throw new Error('Error al cargar campañas');
        campañas = await response.json();

        if (!campañas || campañas.length === 0) {
            container.innerHTML = '<div class="sin-campana"><div class="sin-campana-icon">📋</div><p>No hay campañas. Ve a Solicitudes para crear una.</p></div>';
            return;
        }

        var html = '';
        for (var i = 0; i < campañas.length; i++) {
            var g = campañas[i];
            var pct = g.total_solicitudes > 0 ? Math.round((g.gestionadas / g.total_solicitudes) * 100) : 0;
            var isActive = gestionId && String(g.id) === String(gestionId) ? 'active' : '';

            html += '<div class="campaña-chip ' + isActive + '" onclick="seleccionarCampaña(' + g.id + ')">';
            html += '<div class="campaña-chip-nombre">' + (g.nombre || 'Sin nombre') + '</div>';
            html += '<div class="campaña-chip-stats">';
            html += '<span>📄 ' + (g.total_solicitudes || 0) + '</span>';
            html += '<span>✓ ' + (g.gestionadas || 0) + '</span>';
            html += '<span>' + pct + '%</span>';
            html += '</div>';
            html += '</div>';
        }

        container.innerHTML = html;
    } catch (error) {
        console.error('Error cargando campañas:', error);
        var container = document.getElementById('lista-campañas');
        if (container) container.innerHTML = '<div class="sin-campana"><p>Error al cargar campañas</p></div>';
    }
}

function seleccionarCampaña(id) {
    gestionId = id;
    marcarCampañaActiva(id);
    window.location.href = '/m/gestion-lote?id=' + id;
}

function marcarCampañaActiva(id) {
    var chips = document.querySelectorAll('.campaña-chip');
    chips.forEach(function(c) { c.classList.remove('active'); });
    var chip = document.querySelector('.campaña-chip[onclick="seleccionarCampaña(' + id + ')"]');
    if (chip) {
        chip.classList.add('active');
        // Desplazar el chip al centro del scroll horizontal (si aplica)
        try {
            var container = document.getElementById('lista-campañas');
            if (container && typeof chip.scrollIntoView === 'function') {
                chip.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
            }
        } catch (e) {
            // no bloquear si scroll falla
            console.warn('No se pudo desplazar el chip:', e);
        }
    }
}

async function cargarGestion() {
    try {
        var response = await fetch('/api/gestiones-maestro/' + gestionId);
        if (!response.ok) {
            var error = await response.json().catch(function(){return {}});
            alert('Error: ' + (error.error || 'Error al cargar la gestión'));
            window.location.href = '/m/solicitudes';
            return;
        }

        datosGestion = await response.json();
        var titulo = document.getElementById('gestion-titulo');
        if (titulo) titulo.textContent = datosGestion.nombre || 'Gestión #' + gestionId;

        var panel = document.getElementById('panel-progreso');
        if (panel) panel.style.display = 'block';
        var filtros = document.getElementById('filtros-row');
        if (filtros) filtros.style.display = 'block';

        actualizarProgreso();
    } catch (error) {
        console.error('Error cargando gestión:', error);
        alert('Error al cargar la gestión');
        window.location.href = '/m/solicitudes';
    }
}

function actualizarProgreso() {
    if (!datosGestion) return;
    var total = datosGestion.total_solicitudes || 0;
    var gestionadas = 0;

    solicitudes.forEach(function(sol) {
        if (sol.gestion_id && sol.tipo_gestion && sol.tipo_gestion !== 'Pendiente') gestionadas++;
    });

    var pendientes = total - gestionadas;
    var porcentaje = total > 0 ? Math.round((gestionadas / total) * 100) : 0;

    var elTotal = document.getElementById('total-solicitudes'); if (elTotal) elTotal.textContent = total;
    var elGes = document.getElementById('gestionadas'); if (elGes) elGes.textContent = gestionadas;
    var elPen = document.getElementById('pendientes'); if (elPen) elPen.textContent = pendientes;
    var elPct = document.getElementById('progreso-porcentaje'); if (elPct) elPct.textContent = porcentaje + '%';
    var barra = document.getElementById('barra-progreso'); if (barra) barra.style.width = porcentaje + '%';
    var barraContainer = document.getElementById('progreso-barra-container'); if (barraContainer) barraContainer.style.display = 'block';
}

async function cargarSolicitudes() {
    try {
        var container = document.getElementById('lista-solicitudes');
        if (container) container.innerHTML = '<div class="sin-campana"><p>Cargando solicitudes...</p></div>';

        var response = await fetch('/api/gestiones-maestro/' + gestionId);
        if (!response.ok) throw new Error('Error al cargar solicitudes');

        datosGestion = await response.json();
        solicitudes = datosGestion.solicitudes || [];
        todasLasSolicitudes = solicitudes.slice();

        renderizarSolicitudes(solicitudes);
        actualizarProgreso();
    } catch (error) {
        console.error('Error cargando solicitudes:', error);
        var container = document.getElementById('lista-solicitudes');
        if (container) container.innerHTML = '<div class="sin-campana"><p>Error al cargar las solicitudes</p></div>';
    }
}

function renderizarSolicitudes(lista) {
    var container = document.getElementById('lista-solicitudes');
    if (!lista || lista.length === 0) {
        container.innerHTML = '<div class="sin-campana"><p>No hay solicitudes en esta gestión</p></div>';
        return;
    }

    var busqueda = (document.getElementById('busqueda') && document.getElementById('busqueda').value.toLowerCase()) || '';
    var filtroEstado = (document.getElementById('filtro-estado') && document.getElementById('filtro-estado').value) || '';

    var filtradas = lista.filter(function(sol) {
        if (busqueda) {
            var matchId = sol.id_solicitud && String(sol.id_solicitud).includes(busqueda);
            var matchCedula = sol.cedula && sol.cedula.toString().toLowerCase().includes(busqueda);
            var matchNombre = sol.nombre && sol.nombre.toLowerCase().includes(busqueda);
            var matchCelular = sol.celular && sol.celular.toString().includes(busqueda);
            if (!matchId && !matchCedula && !matchNombre && !matchCelular) return false;
        }
        if (filtroEstado) {
            var estadoActual = sol.tipo_gestion || 'Pendiente';
            if (estadoActual !== filtroEstado) return false;
        }
        return true;
    });

    if (filtradas.length === 0) {
        container.innerHTML = '<div class="sin-campana"><p>No hay solicitudes que coincidan con los filtros</p></div>';
        return;
    }

    var html = '';
    for (var i = 0; i < filtradas.length; i++) {
        var sol = filtradas[i];
        var estado = sol.tipo_gestion || 'Pendiente';
        var observacion = sol.gestion_obs || '';
        var gestionada = estado !== 'Pendiente';

        html += '<div class="sol-card ' + (gestionada ? 'gestionada' : '') + '" data-gestion-id="' + (sol.gestion_id || '') + '">';
        html += '<div class="sol-header">';
        html += '<div class="sol-id">#' + sol.id_solicitud + '</div>';
        html += '<div class="sol-badge estado-' + estado.replace(/\s+/g,'') + '">' + estado + '</div>';
        html += '</div>';

        html += '<div class="sol-nombre">' + (sol.nombre || 'Sin nombre') + '</div>';
        html += '<div class="sol-datos">';
        html += '<span>📍 ' + (sol.cedula || '—') + '</span>';
        html += '<span>📱 ' + (sol.celular || '—') + '</span>';
        html += '<span>🏷️ ' + (sol.segmento || '—') + '</span>';
        html += '</div>';

        if (observacion) {
            html += '<div class="sol-obs">' + observacion + '</div>';
        }

html += '<div class="sol-botones">';
        if (!gestionada) {
            html += '<button class="btn-sol btn-sol-call" onclick="abrirGestion(\'' + sol.id_solicitud + '\', \'Llamada\')">📞 Llamada</button>';
            html += '<button class="btn-sol btn-sol-whatsapp" onclick="abrirGestion(\'' + sol.id_solicitud + '\', \'WhatsApp\')">💬 WhatsApp</button>';
            html += '<button class="btn-sol btn-sol-whatsapp-img" onclick="abrirGestionWhatsApp(\'' + sol.id_solicitud + '\', \'' + (sol.celular || '') + '\')">📷 WhatsApp c/Imagen</button>';
            html += '<button class="btn-sol btn-sol-seguimiento" onclick="abrirGestion(\'' + sol.id_solicitud + '\', \'Seguimiento\')">📋 Seguimiento</button>';
            html += '<button class="btn-sol btn-sol-cobranza" onclick="abrirGestion(\'' + sol.id_solicitud + '\', \'Cobranza\')">💰 Cobranza</button>';
            html += '<button class="btn-sol btn-sol-completar" onclick="abrirGestion(\'' + sol.id_solicitud + '\', \'Completada\')">✅ Completar</button>';
        } else {
            html += '<button class="btn-sol btn-sol-ver" onclick="verGestion(\'' + sol.id_solicitud + '\')">👁️ Ver</button>';
        }
        html += '</div>';

        html += '</div>'; // sol-card
    }

    container.innerHTML = html;
}

function abrirGestion(solicitudId, tipo) {
    var sol = solicitudes.find(function(s) { return s.id_solicitud == solicitudId; });
    if (!sol) {
        alert('Solicitud no encontrada');
        return;
    }

    // Activar y desplazar la campaña asociada (comportamiento similar a escritorio)
    try {
        if (sol.gestion_id) {
            marcarCampañaActiva(sol.gestion_id);
        }
    } catch (e) {
        console.warn('Error marcando campaña activa:', e);
    }

    var opciones = ['Llamada', 'WhatsApp', 'Seguimiento', 'Cobranza', 'Cita', 'Completada', 'Otro'];
    var opcionesDropdown = '';
    for (var i = 0; i < opciones.length; i++) {
        var selected = opciones[i] === tipo ? 'selected' : '';
        opcionesDropdown += '<option value="' + opciones[i] + '" ' + selected + '>' + opciones[i] + '</option>';
    }

    var contenido = '';
    contenido += '<div class="modal-gestion">';
    contenido += '<h2>📋 Gestionar Solicitud #' + solicitudId + '</h2>';
    contenido += '<div class="modal-info">';
    contenido += '<p><strong>Nombre:</strong> ' + (sol.nombre || '—') + '</p>';
    contenido += '<p><strong>Cédula:</strong> ' + (sol.cedula || '—') + '</p>';
    contenido += '<p><strong>Celular:</strong> ' + (sol.celular || '—') + '</p>';
    contenido += '</div>';
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

async function guardarGestionIndividual(solicitudId) {
    var tipo = document.getElementById('tipo-gestion-modal').value;
    var observacion = document.getElementById('observacion-modal').value.trim();
    if (!observacion) { alert('Por favor escriba una observación'); return; }

    var btn = document.querySelector('.btn-guardar');
    if (btn) { btn.textContent = '💾 Guardando...'; btn.disabled = true; }

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
        if (btn) { btn.textContent = '💾 Guardar'; btn.disabled = false; }
    }
}

function verGestion(solicitudId) {
    var sol = solicitudes.find(function(s) { return s.id_solicitud == solicitudId; });
    if (!sol || !sol.gestion_id) { alert('No hay gestión registrada'); return; }

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

function crearModal(contenido) {
    var modalExistente = document.getElementById('modal-generico');
    if (modalExistente) modalExistente.remove();

    var overlay = document.createElement('div');
    overlay.id = 'modal-generico';
    overlay.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 9999; display: flex; align-items: center; justify-content: center;';

    var modal = document.createElement('div');
    modal.style.cssText = 'background: white; border-radius: 16px; max-width: 600px; width: 90%; max-height: 90vh; overflow: auto; box-shadow: 0 20px 60px rgba(0,0,0,0.4); padding: 20px;';
    modal.innerHTML = contenido;

    overlay.onclick = function(e) { if (e.target === overlay) cerrarModal(); };

    overlay.appendChild(modal);
    document.body.appendChild(overlay);
}

function cerrarModal() {
    var modal = document.getElementById('modal-generico'); if (modal) modal.remove();
}

// Eventos
var busqEl = document.getElementById('busqueda'); if (busqEl) busqEl.addEventListener('input', function() { renderizarSolicitudes(todasLasSolicitudes); });
var filtroEl = document.getElementById('filtro-estado'); if (filtroEl) filtroEl.addEventListener('change', function() { renderizarSolicitudes(todasLasSolicitudes); });

// Iniciar
init();

// ================== ESTADO DE WHATSAPP ==================

// Variable para estado de WhatsApp
var whatsappStatus = {
    initialized: false,
    isReady: false,
    qrCode: null
};

// Obtener estado de WhatsApp del servidor
async function cargarEstadoWhatsApp() {
    try {
        var response = await fetch('/api/whatsapp/status');
        var data = await response.json();
        whatsappStatus = data;
    } catch (error) {
        console.error('Error obteniendo estado de WhatsApp:', error);
        whatsappStatus.initialized = false;
    }
}

// ================== WHATSAPP MASIVO ==================

// Variables globales para WhatsApp Masivo
var whatsappMensajeGlobal = '';
var whatsappImagenGlobal = null;
var whatsappImagenNombreGlobal = null;
var whatsappTipoGlobal = 'WhatsApp';

// Mostrar fila de WhatsApp al cargar gestión
function mostrarFilaWhatsApp() {
    var fila = document.getElementById('whatsapp-global-row');
    if (fila) {
        fila.style.display = 'flex';
    }
}

// Abrir modal de WhatsApp Masivo
function abrirModalWhatsApp() {
    // Cargar estado de WhatsApp primero
    cargarEstadoWhatsApp();
    
    // Filtrar solo solicitudes pendientes
    var pendientes = solicitudes.filter(function(sol) {
        return !sol.gestion_id || !sol.tipo_gestion || sol.tipo_gestion === 'Pendiente';
    });
    
    if (pendientes.length === 0) {
        alert('No hay solicitudes pendientes para gestionar');
        return;
    }
    
    // Obtener estado actual de WhatsApp
    var estadoWhatsApp = whatsappStatus || { initialized: false, isReady: false, qrCode: null };
    
    var contenido = '';
    
    contenido += '<div class="modal-gestion">';
    contenido += '<h2>💬 WhatsApp Masivo - Configurar</h2>';
    
    // Mostrar estado de WhatsApp dentro del modal
    contenido += '<div class="whatsapp-modal-status" style="margin-bottom: 16px; padding: 12px; border-radius: 8px; background: ' + (estadoWhatsApp.isReady ? '#dcfce7' : estadoWhatsApp.qrCode ? '#fef3c7' : '#fee2e2') + ';">';
    if (estadoWhatsApp.isReady) {
        contenido += '<p style="margin: 0; color: #166534; font-weight: bold;">✅ WhatsApp Conectado - Listo para enviar</p>';
    } else if (estadoWhatsApp.qrCode) {
        contenido += '<p style="margin: 0 0 8px 0; color: #92400e; font-weight: bold;">📱 Esperando QR - No conectado</p>';
        contenido += '<div style="text-align: center; margin-bottom: 12px;">';
        contenido += '<img src="https://api.qrserver.ch/v1/create-qr-code/?size=150x150&data=' + encodeURIComponent(estadoWhatsApp.qrCode) + '" alt="QR" style="border-radius: 8px;">';
        contenido += '</div>';
    } else {
        contenido += '<p style="margin: 0; color: #991b1b; font-weight: bold;">❌ WhatsApp Desconectado</p>';
    }
    contenido += '</div>';
    
    contenido += '<div class="modal-info">';
    contenido += '<p><strong>Total pendientes:</strong> ' + pendientes.length + '</p>';
    contenido += '<p><strong>Con imagen:</strong> ' + (whatsappImagenGlobal ? 'Sí' : 'No') + '</p>';
    if (whatsappImagenNombreGlobal) {
        contenido += '<p><strong>Imagen:</strong> ' + whatsappImagenNombreGlobal + '</p>';
    }
    if (whatsappMensajeGlobal) {
        contenido += '<p><strong>Mensaje guardado:</strong> ' + whatsappMensajeGlobal.substring(0, 50) + '...</p>';
    }
    contenido += '</div>';
    
    // Opciones de tipo
    contenido += '<div class="modal-form">';
    contenido += '<label>📋 Tipo de Gestión:</label>';
    contenido += '<select id="whatsapp-tipo">';
    contenido += '<option value="WhatsApp">WhatsApp</option>';
    contenido += '<option value="Llamada">Llamada</option>';
    contenido += '<option value="Seguimiento">Seguimiento</option>';
    contenido += '<option value="Cobranza">Cobranza</option>';
    contenido += '<option value="Cita">Cita</option>';
    contenido += '<option value="Completada">Completada</option>';
    contenido += '</select>';
    
    contenido += '<label>📝 Mensaje:</label>';
    contenido += '<textarea id="whatsapp-mensaje" rows="4" placeholder="Escriba su mensaje..."></textarea>';
    
    contenido += '<label>📎 Adjuntar Imagen (opcional):</label>';
    contenido += '<div style="margin-bottom: 12px;">';
    contenido += '<input type="file" id="whatsapp-file-input" accept="image/jpeg,image/png,image/webp" onchange="previsualizarImagenWhatsApp(event)">';
    contenido += '<div id="whatsapp-preview-container" style="display: none; margin-top: 8px;">';
    contenido += '<img id="whatsapp-preview-img" style="max-width: 100px; border-radius: 8px;">';
    contenido += '<button type="button" onclick="quitarImagenWhatsApp()" style="margin-left: 8px; padding: 4px 8px; background: #fee2e2; border: none; border-radius: 4px; cursor: pointer;">Quitar</button>';
    contenido += '</div>';
    contenido += '</div>';
    
    contenido += '<div class="modal-botones">';
    contenido += '<button class="btn-cancelar" onclick="cerrarModal()">Cancelar</button>';
    contenido += '<button class="btn-guardar" id="btn-whatsapp-masivo" onclick="guardarConfiguracionWhatsApp()">💾 Guardar</button>';
    contenido += '</div>';
    contenido += '</div>';
    contenido += '</div>';
    
    crearModal(contenido);
    
    // Si ya hay configuración guardada, mostrar en los campos
    var tipoSelect = document.getElementById('whatsapp-tipo');
    var mensajeTextarea = document.getElementById('whatsapp-mensaje');
    if (tipoSelect) tipoSelect.value = whatsappTipoGlobal;
    if (mensajeTextarea && whatsappMensajeGlobal) mensajeTextarea.value = whatsappMensajeGlobal;
    
    // Si ya hay imagen cargada, mostrar preview
    if (whatsappImagenGlobal) {
        var container = document.getElementById('whatsapp-preview-container');
        var img = document.getElementById('whatsapp-preview-img');
        if (container && img) {
            container.style.display = 'block';
            img.src = whatsappImagenGlobal;
        }
    }
}

// Guardar configuración de WhatsApp Masivo
async function guardarConfiguracionWhatsApp() {
    whatsappTipoGlobal = document.getElementById('whatsapp-tipo').value;
    whatsappMensajeGlobal = document.getElementById('whatsapp-mensaje').value.trim();
    var fileInput = document.getElementById('whatsapp-file-input');
    var file = fileInput ? fileInput.files[0] : null;
    
    if (!whatsappMensajeGlobal && !file) {
        alert('Escriba un mensaje o adjunte una imagen');
        return;
    }
    
    var btn = document.getElementById('btn-whatsapp-masivo');
    btn.textContent = '⏳ Guardando...';
    btn.disabled = true;
    
    try {
        if (file) {
            var formData = new FormData();
            formData.append('imagen', file);
            
            var uploadResponse = await fetch('/api/excel/upload-imagen', {
                method: 'POST',
                body: formData
            });
            
            if (!uploadResponse.ok) {
                var errorText = await uploadResponse.text();
                throw new Error('Error al subir imagen: ' + uploadResponse.status);
            }
            
            var uploadResult = await uploadResponse.json();
            if (!uploadResult.success) {
                throw new Error(uploadResult.error || 'Error al subir imagen');
            }
            whatsappImagenGlobal = uploadResult.url;
            whatsappImagenNombreGlobal = file.name;
        }
        
        alert('✅ Configuración guardada\n\nAhora cada tarjeta tiene un botón "📤 Enviar" para enviar.');
        
        cerrarModal();
        renderizarSolicitudes(solicitudes);
        
    } catch (error) {
        console.error('Error guardando configuración:', error);
        alert('Error: ' + error.message);
    } finally {
        btn.textContent = '💾 Guardar';
        btn.disabled = false;
    }
}

// Previsualizar imagen antes de subir
function previsualizarImagenWhatsApp(event) {
    var file = event.target.files[0];
    if (!file) return;
    
    var tiposPermitidos = ['image/jpeg', 'image/png', 'image/webp'];
    if (!tiposPermitidos.includes(file.type)) {
        alert('Solo se permiten imágenes JPG, PNG o WebP');
        event.target.value = '';
        return;
    }
    
    if (file.size > 5 * 1024 * 1024) {
        alert('La imagen no puede superar 5MB');
        event.target.value = '';
        return;
    }
    
    var reader = new FileReader();
    reader.onload = function(e) {
        var container = document.getElementById('whatsapp-preview-container');
        var img = document.getElementById('whatsapp-preview-img');
        if (container && img) {
            container.style.display = 'block';
            img.src = e.target.result;
        }
    };
    reader.readAsDataURL(file);
}

// Quitar imagen de WhatsApp
function quitarImagenWhatsApp() {
    var input = document.getElementById('whatsapp-file-input');
    var container = document.getElementById('whatsapp-preview-container');
    if (input) input.value = '';
    if (container) container.style.display = 'none';
}

// ================== WHATSAPP CON IMAGEN ==================

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
    contenido += '<img id="whatsapp-img-preview" style="max-width: 150px; max-height: 150px; border-radius: 8px; border: 2px solid #e2e8f0;">';
    contenido += '<div style="margin-top: 8px;"><button type="button" onclick="quitarWhatsAppImg()" style="padding: 6px 12px; background: #fee2e2; border: none; border-radius: 4px; cursor: pointer;">Quitar Imagen</button></div>';
    contenido += '</div>';
    
    // Check para abrir WhatsApp Web
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

// Abrir WhatsApp Web directamente
function abrirWhatsAppWeb(celular, mensaje) {
    // Limpiar y formatear número
    var numeroLimpio = String(celular).replace(/[^0-9]/g, '');
    
    // Si no tiene código de país, agregar 505 (Nicaragua)
    if (numeroLimpio.length === 8) {
        numeroLimpio = '505' + numeroLimpio;
    }
    
    // Construir URL de WhatsApp Web
    var urlWhatsApp = 'https://web.whatsapp.com/send?phone=' + numeroLimpio;
    
    if (mensaje) {
        urlWhatsApp += '&text=' + encodeURIComponent(mensaje);
    }
    
    console.log('DEBUG: Abriendo WhatsApp Web:', urlWhatsApp);
    
    // Abrir en nueva pestaña
    var win = window.open(urlWhatsApp, '_blank');
    if (!win) {
        // Si fue bloqueado, intentar con wa.me
        window.open('https://wa.me/' + numeroLimpio + '?text=' + encodeURIComponent(mensaje || ''), '_blank');
    }
}

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
        // 0. ABRIR WHATSAPP WEB PRIMERO
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
