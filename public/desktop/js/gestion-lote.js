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
    console.log('[init] Iniciando carga de gestion-lote...');
    
    // Primero cargar las campañas en el sidebar
    await cargarListaCampanas();
    console.log('[init] Campañas cargadas, verificando ID en URL...');
    
    // Luego verificar si hay un ID en la URL
    gestionId = obtenerGestionId();
    console.log('[init] gestionId desde URL:', gestionId);
    
    if (gestionId) {
        console.log('[init] Cargando datos de gestión:', gestionId);
        await cargarDatosGestion();
        // Marcar la campaña como activa
        marcarCampañaActiva(gestionId);
        console.log('[init] Carga completa');
    } else {
        console.log('[init] No hay ID en URL, mostrando solo lista de campañas');
    }
}

// Cargar lista de todas las campañas en el sidebar
async function cargarListaCampanas() {
    try {
        console.log('[cargarListaCampanas] Iniciando fetch...');
        var container = document.getElementById('lista-campañas');
        
        // Timeout de 10 segundos para el fetch
        var controller = new AbortController();
        var timeoutId = setTimeout(function() { controller.abort(); console.log('[cargarListaCampanas] Timeout!'); }, 10000);
        
        var response = await fetch('/api/gestiones-maestro', { signal: controller.signal });
        clearTimeout(timeoutId);
        
        console.log('[cargarListaCampanas] Response status:', response.status);
        
        if (!response.ok) {
            throw new Error('Error al cargar (status: ' + response.status + ')');
        }
        
        campañas = await response.json();
        console.log('[cargarListaCampanas] Campañas recibidas:', campañas ? campañas.length : 0);
        
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

// Cargar datos de la gestión (unifica cargarGestion + cargarSolicitudes)
async function cargarDatosGestion() {
    try {
        console.log('[cargarDatosGestion] Cargando gestión ID:', gestionId);
        var container = document.getElementById('lista-solicitudes');
        if (container) container.innerHTML = '<div class="loading">Cargando solicitudes...</div>';
        
        // Timeout de 10 segundos para el fetch
        var controller = new AbortController();
        var timeoutId = setTimeout(function() { controller.abort(); console.log('[cargarDatosGestion] Timeout!'); }, 10000);
        
        var response = await fetch('/api/gestiones-maestro/' + gestionId, { signal: controller.signal });
        clearTimeout(timeoutId);
        
        console.log('[cargarDatosGestion] Response status:', response.status);
        
        if (!response.ok) {
            var errorData = await response.json().catch(function() { return {}; });
            throw new Error(errorData.error || 'Error al cargar la gestión (status: ' + response.status + ')');
        }
        
        datosGestion = await response.json();
        
        // Actualizar título
        var tituloEl = document.getElementById('gestion-nombre');
        if (tituloEl) tituloEl.textContent = datosGestion.nombre || 'Gestión #' + gestionId;
        
        // Mostrar panel de progreso y filtros
        var panelProgreso = document.getElementById('panel-progreso');
        var filtrosRow = document.getElementById('filtros-row');
        if (panelProgreso) panelProgreso.style.display = 'block';
        if (filtrosRow) filtrosRow.style.display = 'flex';
        
        // Mostrar botón de exportar Excel
        var btnExportar = document.getElementById('btn-exportar-excel');
        if (btnExportar) btnExportar.style.display = 'inline-block';
        
        // Mostrar botón de agregar solicitudes
        var btnAgregarContainer = document.getElementById('agregar-solicitudes-container');
        if (btnAgregarContainer) btnAgregarContainer.style.display = 'block';
        
        solicitudes = datosGestion.solicitudes || [];
        console.log('[cargarDatosGestion] Solicitudes recibidas:', solicitudes.length);
        if (solicitudes.length > 0) {
            // JSON.stringify para ver valores exactos sin expandir en consola
            var primeras3 = solicitudes.slice(0, 3).map(function(s) { 
                return {id: s.id_solicitud, obs: s.gestion_obs, tipo: s.tipo_gestion}; 
            });
            console.log('[cargarDatosGestion] Primeras 3 gestion_obs:', JSON.stringify(primeras3));
        }
        todasLasSolicitudes = [...solicitudes];
        
        actualizarProgreso();
        renderizarSolicitudes(solicitudes);
        
    } catch (error) {
        console.error('Error cargando datos de gestión:', error);
        var errContainer = document.getElementById('lista-solicitudes');
        if (errContainer) errContainer.innerHTML = '<div class="error">Error al cargar: ' + error.message + '</div>';
        var nombreEl = document.getElementById('gestion-nombre');
        if (nombreEl) nombreEl.textContent = 'Error al cargar gestión';
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
        html += '<div class="sol-nombre sol-nombre-copy" onclick="copiarNombreCedula(\'' + escaparParaAtributo(sol.nombre || '') + '\', \'' + escaparParaAtributo(sol.cedula || '') + '\')" title="Copiar nombre completo y cédula">' + (sol.nombre || 'Sin nombre') + '</div>';
        html += '<div class="sol-datos">';
        html += '<span class="sol-dato-copy" onclick="copiarTexto(\'' + escaparParaAtributo(sol.cedula || '') + '\', \'cédula\')" title="Copiar cédula">🆔 ' + (sol.cedula || '—') + '</span>';
        html += '<span class="sol-dato-copy" onclick="copiarTexto(\'' + escaparParaAtributo(sol.celular || '') + '\', \'teléfono\')" title="Copiar teléfono">📱 ' + (sol.celular || '—') + '</span>';
        html += '<span class="sol-chat-icon" onclick="abrirWhatsAppDesktop(\'' + escaparParaAtributo(sol.celular || '') + '\', \'\')" title="Abrir chat WhatsApp">💬</span>';
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
        
        // Botones de acción SIEMPRE visibles (independientemente del estado)
        html += '<button class="btn-accion btn-seguimiento" onclick="abrirGestion(\'' + sol.id_solicitud + '\', \'Seguimiento\')">📋 Seguimiento</button>';
        html += "<button class=\"btn-accion btn-whatsapp-img\" onclick=\"abrirGestionWhatsApp('" + sol.id_solicitud + "', '" + escaparParaAtributo(sol.celular || '') + "')\">💬 Directo</button>";
        
        // Botón ver gestión (si tiene gestión registrada)
        if (gestionada) {
            html += '<button class="btn-accion tertiary" onclick="verGestion(\'' + sol.id_solicitud + '\')">👁️ Ver</button>';
        }
        
        // Botón historial para TODAS las cards
        html += '<button class="btn-accion tertiary" onclick="verHistorial(\'' + sol.id_solicitud + '\')">📋 Historial</button>';
        
        // Botón quitar de campaña
        html += '<button class="btn-accion btn-quitar-solicitud" onclick="confirmarQuitarSolicitud(\'' + sol.id_solicitud + '\', \'' + escaparParaAtributo(sol.nombre || '') + '\')">❌ Quitar</button>';
        
        html += '</div>';
        
        html += '</div>';
    }
    
    container.innerHTML = html;
}

function escaparParaAtributo(texto) {
    return String(texto || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

function copiarNombreCedula(nombre, cedula) {
    var valorNombre = String(nombre || '').trim();
    var valorCedula = String(cedula || '').trim();
    var texto = '';

    if (valorNombre && valorCedula) {
        texto = valorNombre + ' - ' + valorCedula;
    } else if (valorNombre) {
        texto = valorNombre;
    } else if (valorCedula) {
        texto = valorCedula;
    }

    if (!texto) {
        alert('No hay nombre ni cédula para copiar');
        return;
    }

    copiarTexto(texto, 'nombre y cédula');
}

function copiarTexto(texto, etiqueta) {
    var valor = String(texto || '').trim();
    if (!valor) {
        alert('No hay ' + etiqueta + ' para copiar');
        return;
    }

    var copiarYNotificar = function() {
        alert(etiqueta.charAt(0).toUpperCase() + etiqueta.slice(1) + ' copiada');
    };

    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(valor).then(copiarYNotificar).catch(function() {
            fallbackCopy(valor, etiqueta, copiarYNotificar);
        });
        return;
    }

    fallbackCopy(valor, etiqueta, copiarYNotificar);
}

function fallbackCopy(texto, etiqueta, callback) {
    var textarea = document.createElement('textarea');
    textarea.value = texto;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
    if (callback) callback();
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
            cargarDatosGestion();
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

// Ver historial completo de gestiones de una solicitud
async function verHistorial(solicitudId) {
    try {
        crearModal('<div class="modal-gestion" style="text-align:center;padding:30px;"><h2>📋 Historial</h2><p>⏳ Cargando...</p></div>');
        
        var response = await fetch('/api/excel/gestiones/' + solicitudId);
        if (!response.ok) throw new Error('Error al cargar historial');
        
        var gestiones = await response.json();
        
        var contenido = '';
        contenido += '<div class="modal-gestion">';
        contenido += '<h2 style="margin-top:0;">📋 Historial - Solicitud #' + solicitudId + '</h2>';
        
        if (!gestiones || gestiones.length === 0) {
            contenido += '<div style="text-align:center;padding:20px;color:#6b7280;">No hay gestiones registradas para esta solicitud</div>';
        } else {
            contenido += '<div style="margin-bottom:12px;color:#6b7280;font-size:13px;">📊 Total: ' + gestiones.length + ' gestione(s)</div>';
            contenido += '<div style="max-height:450px;overflow-y:auto;">';
            
            var coloresTipo = {
                'Pendiente': '#fef3c7',
                'Llamada': '#d1fae5',
                'WhatsApp': '#dcfce7',
                'Seguimiento': '#dbeafe',
                'Cobranza': '#fee2e2',
                'Cita': '#e0e7ff',
                'Completada': '#bbf7d0'
            };
            
            for (var i = 0; i < gestiones.length; i++) {
                var g = gestiones[i];
                var fecha = g.fecha_gestion ? new Date(g.fecha_gestion).toLocaleString('es-ES') : '—';
                var isLast = i === gestiones.length - 1;
                var colorBadge = coloresTipo[g.tipo_gestion] || '#f3f4f6';
                
                contenido += '<div style="display:flex;gap:15px;position:relative;">';
                // Timeline dot + line
                contenido += '<div style="display:flex;flex-direction:column;align-items:center;">';
                contenido += '<div style="width:14px;height:14px;border-radius:50%;background:' + colorBadge + ';border:2px solid #9ca3af;flex-shrink:0;"></div>';
                if (!isLast) {
                    contenido += '<div style="width:2px;flex:1;background:#e5e7eb;margin:4px 0;"></div>';
                }
                contenido += '</div>';
                // Content
                contenido += '<div style="flex:1;padding-bottom:' + (isLast ? '0' : '16px') + ';">';
                contenido += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;flex-wrap:wrap;">';
                contenido += '<span style="background:' + colorBadge + ';padding:2px 10px;border-radius:12px;font-size:11px;font-weight:600;color:#374151;">' + (g.tipo_gestion || '—') + '</span>';
                contenido += '<span style="font-size:11px;color:#9ca3af;">' + fecha + '</span>';
                contenido += '</div>';
                contenido += '<div style="background:#f9fafb;padding:10px 12px;border-radius:8px;font-size:13px;color:#374151;line-height:1.5;">' + (g.observacion || 'Sin observación') + '</div>';
                contenido += '</div>';
                contenido += '</div>';
            }
            
            contenido += '</div>';
        }
        
        contenido += '<div style="margin-top:16px;text-align:right;">';
        contenido += '<button class="btn-cerrar" onclick="cerrarModal()" style="padding:8px 20px;background:#f3f4f6;border:none;border-radius:8px;cursor:pointer;font-size:14px;">Cerrar</button>';
        contenido += '</div>';
        contenido += '</div>';
        
        // Cerrar modal de carga y abrir con datos
        cerrarModal();
        crearModal(contenido);
        
    } catch (error) {
        console.error('Error cargando historial:', error);
        cerrarModal();
        alert('Error al cargar el historial');
    }
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

// ================== QUITAR SOLICITUD DE CAMPAÑA ==================

function confirmarQuitarSolicitud(solicitudId, nombreCliente) {
    var contenido = '';
    contenido += '<div class="modal-gestion">';
    contenido += '<h2>❌ Quitar Solicitud #' + solicitudId + '</h2>';
    contenido += '<div class="modal-info">';
    contenido += '<p><strong>Solicitud:</strong> #' + solicitudId + '</p>';
    contenido += '<p><strong>Cliente:</strong> ' + (nombreCliente || '—') + '</p>';
    contenido += '<p><strong>Campaña:</strong> ' + (datosGestion ? datosGestion.nombre : '—') + '</p>';
    contenido += '</div>';
    contenido += '<div class="modal-advertencia">';
    contenido += '<p>⚠️ <strong>¿Estás seguro?</strong></p>';
    contenido += '<ul>';
    contenido += '<li>La solicitud será quitada de esta campaña.</li>';
    contenido += '<li>Las gestiones registradas NO se eliminarán.</li>';
    contenido += '<li>Esta acción es <strong>IRREVERSIBLE</strong>.</li>';
    contenido += '</ul>';
    contenido += '</div>';
    contenido += '<div class="modal-botones">';
    contenido += '<button class="btn-cancelar" onclick="cerrarModal()">Cancelar</button>';
    contenido += '<button class="btn-eliminar" id="btn-confirmar-quitar" onclick="quitarSolicitudDeCampana(' + solicitudId + ')">❌ Quitar</button>';
    contenido += '</div>';
    contenido += '</div>';
    
    crearModal(contenido);
}

async function quitarSolicitudDeCampana(solicitudId) {
    var btn = document.getElementById('btn-confirmar-quitar');
    if (btn) { btn.textContent = '⏳ Quitando...'; btn.disabled = true; }
    
    try {
        var response = await fetch('/api/gestiones-maestro/' + gestionId + '/quitar-solicitud', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ solicitud_id: parseInt(solicitudId) })
        });
        
        var resultado = await response.json();
        
        if (response.ok && !resultado.error) {
            alert('✅ Solicitud quitada de la campaña');
            cerrarModal();
            await cargarDatosGestion();
            await cargarListaCampanas();
        } else {
            alert('Error: ' + (resultado.error || 'Error al quitar solicitud'));
            if (btn) { btn.textContent = '❌ Quitar'; btn.disabled = false; }
        }
    } catch (error) {
        console.error('Error quitando solicitud:', error);
        alert('Error al quitar la solicitud');
        if (btn) { btn.textContent = '❌ Quitar'; btn.disabled = false; }
    }
}

// ================== AGREGAR SOLICITUDES A CAMPAÑA ==================

function abrirModalAgregarSolicitudes() {
    var contenido = '';
    contenido += '<div class="modal-agregar-solicitudes">';
    contenido += '<h2>➕ Agregar Solicitudes a la Campaña</h2>';
    
    // Búsqueda
    contenido += '<div class="modal-agregar-busqueda">';
    contenido += '<input type="text" id="busqueda-agregar" placeholder="🔍 Buscar por cédula, nombre o teléfono..." oninput="buscarSolicitudesParaAgregar(event)">';
    contenido += '</div>';
    
    // Lista de resultados
    contenido += '<div id="resultados-agregar" class="resultados-agregar">';
    contenido += '<div class="agregar-vacio">Escribe para buscar solicitudes disponibles</div>';
    contenido += '</div>';
    
    // Seleccionados
    contenido += '<div id="seleccionados-agregar" class="seleccionados-agregar" style="display:none;">';
    contenido += '<p><strong>Seleccionados:</strong> <span id="contador-seleccionados">0</span></p>';
    contenido += '</div>';
    
    contenido += '<div class="modal-botones">';
    contenido += '<button class="btn-cancelar" onclick="cerrarModal()">Cancelar</button>';
    contenido += '<button class="btn-guardar" id="btn-agregar-solicitudes" onclick="agregarSolicitudesSeleccionadas()" disabled>➕ Agregar (0)</button>';
    contenido += '</div>';
    contenido += '</div>';
    
    crearModal(contenido);
}

var solicitudesDisponibles = [];
var solicitudesSeleccionadas = {};

async function buscarSolicitudesParaAgregar(event) {
    var termino = event.target.value.trim();
    var resultadosContainer = document.getElementById('resultados-agregar');
    
    if (!termino || termino.length < 2) {
        resultadosContainer.innerHTML = '<div class="agregar-vacio">Escribe al menos 2 caracteres para buscar</div>';
        return;
    }
    
    resultadosContainer.innerHTML = '<div class="agregar-cargando">🔍 Buscando...</div>';
    
    try {
        var response = await fetch('/api/excel/solicitudes/buscar?q=' + encodeURIComponent(termino));
        if (!response.ok) throw new Error('Error en búsqueda');
        
        var data = await response.json();
        
        // Obtener IDs ya en la campaña
        if (!datosGestion || !datosGestion.solicitudes_ids) {
            resultadosContainer.innerHTML = '<div class="agregar-vacio">Error: no hay datos de campaña</div>';
            return;
        }
        
        var idsEnCampana = [];
        try {
            idsEnCampana = JSON.parse(datosGestion.solicitudes_ids);
        } catch (e) {
            console.error('Error parseando solicitudes_ids:', e);
        }
        
        // Filtrar solo las que NO están en la campaña
        solicitudesDisponibles = [];
        
        // Determinar si data es un array o tiene propiedad solicitudes
        var lista = Array.isArray(data) ? data : (data.data || []);
        
        for (var i = 0; i < lista.length; i++) {
            var sol = lista[i];
            var idSol = sol.id_solicitud || sol.id;
            if (idsEnCampana.indexOf(idSol) === -1) {
                solicitudesDisponibles.push(sol);
            }
        }
        
        if (solicitudesDisponibles.length === 0) {
            resultadosContainer.innerHTML = '<div class="agregar-vacio">No se encontraron solicitudes disponibles</div>';
            return;
        }
        
        var html = '';
        for (var i = 0; i < solicitudesDisponibles.length; i++) {
            var sol = solicitudesDisponibles[i];
            var solId = sol.id_solicitud || sol.id;
            var isSelected = solicitudesSeleccionadas[solId] ? 'selected' : '';
            
            html += '<div class="agregar-item ' + isSelected + '" onclick="toggleSeleccionSolicitud(' + solId + ')">';
            html += '<div class="agregar-item-check">' + (isSelected ? '✅' : '⬜') + '</div>';
            html += '<div class="agregar-item-info">';
            html += '<div class="agregar-item-nombre">#' + solId + ' - ' + (sol.nombre || 'Sin nombre') + '</div>';
            html += '<div class="agregar-item-datos">🆔 ' + (sol.cedula || '—') + ' | 📱 ' + (sol.celular || '—') + '</div>';
            html += '</div>';
            html += '</div>';
        }
        
        resultadosContainer.innerHTML = html;
        actualizarBotonAgregar();
        
    } catch (error) {
        console.error('Error en búsqueda:', error);
        resultadosContainer.innerHTML = '<div class="agregar-error">Error al buscar: ' + error.message + '</div>';
    }
}

function toggleSeleccionSolicitud(solicitudId) {
    if (solicitudesSeleccionadas[solicitudId]) {
        delete solicitudesSeleccionadas[solicitudId];
    } else {
        solicitudesSeleccionadas[solicitudId] = true;
    }
    
    // Actualizar visual
    var items = document.querySelectorAll('.agregar-item');
    items.forEach(function(item) {
        var onclick = item.getAttribute('onclick') || '';
        var match = onclick.match(/toggleSeleccionSolicitud\((\d+)\)/);
        if (match) {
            var id = parseInt(match[1]);
            if (solicitudesSeleccionadas[id]) {
                item.classList.add('selected');
                item.querySelector('.agregar-item-check').textContent = '✅';
            } else {
                item.classList.remove('selected');
                item.querySelector('.agregar-item-check').textContent = '⬜';
            }
        }
    });
    
    actualizarBotonAgregar();
}

function actualizarBotonAgregar() {
    var count = Object.keys(solicitudesSeleccionadas).length;
    var btn = document.getElementById('btn-agregar-solicitudes');
    var contador = document.getElementById('contador-seleccionados');
    var container = document.getElementById('seleccionados-agregar');
    
    if (btn) {
        btn.textContent = '➕ Agregar (' + count + ')';
        btn.disabled = count === 0;
    }
    if (contador) contador.textContent = count;
    if (container) container.style.display = count > 0 ? 'block' : 'none';
}

async function agregarSolicitudesSeleccionadas() {
    var ids = Object.keys(solicitudesSeleccionadas).map(function(id) { return parseInt(id); });
    
    if (ids.length === 0) {
        alert('Selecciona al menos una solicitud');
        return;
    }
    
    var btn = document.getElementById('btn-agregar-solicitudes');
    if (btn) { btn.textContent = '⏳ Agregando...'; btn.disabled = true; }
    
    try {
        var response = await fetch('/api/gestiones-maestro/' + gestionId + '/agregar-solicitudes', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ solicitudes_ids: ids })
        });
        
        var resultado = await response.json();
        
        if (response.ok && !resultado.error) {
            alert('✅ ' + resultado.mensaje);
            solicitudesSeleccionadas = {};
            cerrarModal();
            await cargarDatosGestion();
            await cargarListaCampanas();
        } else {
            alert('Error: ' + (resultado.error || 'Error al agregar solicitudes'));
            if (btn) { btn.textContent = '➕ Agregar (' + ids.length + ')'; btn.disabled = false; }
        }
    } catch (error) {
        console.error('Error agregando solicitudes:', error);
        alert('Error al agregar las solicitudes');
        if (btn) { btn.textContent = '➕ Agregar (' + ids.length + ')'; btn.disabled = false; }
    }
}

// ================== EXPORTAR CAMPAÑA A EXCEL ==================

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
    
    ws['!cols'] = [
        {wch: 12},
        {wch: 30},
        {wch: 15},
        {wch: 15},
        {wch: 15},
        {wch: 50}
    ];
    
    var nombreCampana = (datosGestion && datosGestion.nombre) || 'campana';
    var nombreArchivo = 'campana_' + nombreCampana.replace(/[^a-zA-Z0-9]/g, '_') + '_' + new Date().toISOString().slice(0, 10) + '.xlsx';
    
    XLSX.utils.book_append_sheet(wb, ws, 'Campaña');
    XLSX.writeFile(wb, nombreArchivo);
    
    alert('Se exportaron ' + datos.length + ' registros a Excel');
}

// Iniciar
init();

// ================== WHATSAPP CON IMAGEN INDIVIDUAL ==================

// ================== CONFIGURACIÓN WHATSAPP ==================
// Código de país para números sin prefijo internacional
// Ecuador = 593, Nicaragua = 505, Costa Rica = 506, etc.
var PAIS_CODIGO = '593';
// Longitud máxima de un número nacional (sin código de país)
// Ecuador móvil = 9 dígitos, fijo = 7-8 dígitos
var PAIS_LONGITUD_MAX_SIN_CODIGO = 9;

// Formatear número para WhatsApp: agrega código de país si es necesario
function formatearNumeroWhatsApp(celular) {
    var numero = String(celular).replace(/[^0-9]/g, '');
    
    // Quitar cero(s) a la izquierda (ej: 099XXXXXXXX → 99XXXXXXXX)
    numero = numero.replace(/^0+/, '');
    
    // Si el número ya tiene código de país (más largo que la longitud máxima local), usarlo directo
    if (numero.length > PAIS_LONGITUD_MAX_SIN_CODIGO) {
        return numero;
    }
    
    // Si es un número local (sin código de país), agregar el código configurado
    return PAIS_CODIGO + numero;
}

// Función para abrir WhatsApp Web (desktop: wa.me)
function abrirWhatsAppDesktop(celular, mensaje) {
    var numeroFormateado = formatearNumeroWhatsApp(celular);
    
    console.log('[WhatsApp Desktop] Número original:', celular, '→ formateado:', numeroFormateado);
    
    var urlWhatsApp = 'https://wa.me/' + numeroFormateado;
    if (mensaje) {
        urlWhatsApp += '?text=' + encodeURIComponent(mensaje);
    }
    console.log('[WhatsApp Desktop] Abriendo:', urlWhatsApp);
    var win = window.open(urlWhatsApp, '_blank');
    if (!win) {
        alert('Por favor permite ventanas emergentes para WhatsApp');
    }
}

// Obtener el nombre completo del cliente para el saludo del mensaje
function obtenerNombreParaMensaje(nombreCompleto) {
    if (!nombreCompleto) return '';
    return String(nombreCompleto).trim().replace(/\s+/g, ' ');
}

// Generar mensaje predeterminado de WhatsApp con el nombre completo del cliente
function generarMensajeWhatsApp(nombreCompleto) {
    var nombreParaSaludo = obtenerNombreParaMensaje(nombreCompleto);
    var saludo = nombreParaSaludo ? 'Hola ' + nombreParaSaludo + ' 👋' : 'Hola 👋';
    return saludo + '\nCrédito Resuelve a las órdenes 💳✨\n\nTu crédito esta aprobado 🙌\nQué necesitas para tu hogar?, te ayudamos a hacerlo posible 📲';
}

// Abrir modal de WhatsApp para una solicitud (solo texto, sin imagen)
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
    contenido += '<h2>💬 WhatsApp Directo - Solicitud #' + solicitudId + '</h2>';
    
    // Info del cliente
    contenido += '<div class="modal-info">';
    contenido += '<p><strong>Nombre:</strong> ' + (sol.nombre || '—') + '</p>';
    contenido += '<p><strong>Celular:</strong> ' + celular + '</p>';
    contenido += '</div>';
    
    // Formulario
    contenido += '<div class="modal-form">';
    contenido += '<label>📝 Mensaje:</label>';
    var mensajeDefecto = generarMensajeWhatsApp(sol.nombre);
    var opcionesMensajes = [
        { texto: mensajeDefecto, etiqueta: 'Mensaje predeterminado' },
        { texto: 'Hola ' + (sol.nombre || '') + ' 👋\nCrédito Resuelve a las órdenes 💳✨\n\nTu crédito está aprobado 🙌\n¿Deseas que te ayudemos con tu hogar? 📲', etiqueta: 'Aprobación rápida' },
        { texto: 'Hola ' + (sol.nombre || '') + ' 👋\nTe contactamos de Crédito Resuelve 💳\n\nEstamos listos para ayudarte con tu crédito. ¿Cuándo te parece conversar? 📲', etiqueta: 'Seguimiento simple' },
        { texto: 'Hola ' + (sol.nombre || '') + ' 👋\nQuedamos atentos a tus necesidades.\n\nSi gustas, te compartimos más información sobre tu crédito. 📲', etiqueta: 'Consulta general' }
    ];
    contenido += '<div style="display:flex; flex-wrap:wrap; gap:8px; margin-bottom:10px;">';
    for (var i = 0; i < opcionesMensajes.length; i++) {
        contenido += '<button type="button" class="btn-plantilla-whatsapp" data-index="' + i + '" data-opciones="' + encodeURIComponent(JSON.stringify(opcionesMensajes)) + '" onclick="cambiarMensajeWhatsAppDesdeBoton(this)">' + opcionesMensajes[i].etiqueta + '</button>';
    }
    contenido += '</div>';
    contenido += '<textarea id="whatsapp-img-mensaje" rows="5" placeholder="Escriba su mensaje..." style="margin-bottom: 12px;">' + mensajeDefecto + '</textarea>';
    
    // Info de WhatsApp
    contenido += '<div style="padding: 12px; background: #f0fdf4; border-radius: 8px; border: 1px solid #86efac; margin-bottom: 12px;">';
    contenido += '<div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">';
    contenido += '<span style="font-size: 16px;">💻</span>';
    contenido += '<span style="font-size: 13px; color: #166534;">Se abrirá WhatsApp con el mensaje y el número de la solicitud.</span>';
    contenido += '</div>';
    contenido += '<label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">';
    contenido += '<input type="checkbox" id="whatsapp-abrir-web" checked style="width: 18px; height: 18px;">';
    contenido += '<span style="font-size: 13px; color: #374151;">Abrir WhatsApp al enviar</span>';
    contenido += '</label>';
    contenido += '</div>';
    
    contenido += '<div class="modal-botones">';
    contenido += '<button class="btn-cancelar" onclick="cerrarModal()">Cancelar</button>';
    contenido += '<button class="btn-guardar" id="btn-whatsapp-img" onclick="enviarWhatsApp(\'' + solicitudId + '\', \'' + celular + '\')">📤 Enviar</button>';
    contenido += '</div>';
    contenido += '</div>';
    contenido += '</div>';
    
    crearModal(contenido);
}

function cambiarMensajeWhatsAppDesdeBoton(boton) {
    var textarea = document.getElementById('whatsapp-img-mensaje');
    if (!textarea || !boton) return;
    var index = parseInt(boton.getAttribute('data-index'), 10);
    var opcionesJson = decodeURIComponent(boton.getAttribute('data-opciones') || '');
    var opciones = JSON.parse(opcionesJson);
    if (opciones[index] && opciones[index].texto) {
        textarea.value = opciones[index].texto;
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

// Enviar WhatsApp (solo texto, sin imagen)
async function enviarWhatsApp(solicitudId, celular) {
    var mensaje = document.getElementById('whatsapp-img-mensaje').value.trim();
    var checkboxAbrir = document.getElementById('whatsapp-abrir-web');
    var abrirWeb = checkboxAbrir ? checkboxAbrir.checked : true;
    
    if (!mensaje) {
        alert('Escriba un mensaje para enviar');
        return;
    }
    
    var btn = document.getElementById('btn-whatsapp-img');
    btn.textContent = '⏳ Guardando...';
    btn.disabled = true;
    
    try {
        // ===== PASO 1: Guardar gestión =====
        var response = await fetch('/api/excel/gestiones', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                solicitud_id: solicitudId,
                tipo_gestion: 'WhatsApp',
                observacion: mensaje,
                gestion_maestro_id: gestionId
            })
        });
        
        var resultado = await response.json();
        
        if (!response.ok || resultado.error) {
            throw new Error(resultado.error || 'Error al guardar gestión');
        }
        
        // ===== PASO 2: Abrir WhatsApp Web =====
        if (abrirWeb) {
            abrirWhatsAppDesktop(celular, mensaje);
        }
        
        alert('✅ Gestión guardada');
        cerrarModal();
        await cargarDatosGestion();
        
    } catch (error) {
        console.error('[WhatsApp Desktop] Error:', error);
        alert('Error: ' + error.message);
    } finally {
        btn.textContent = '📤 Enviar';
        btn.disabled = false;
    }
}

