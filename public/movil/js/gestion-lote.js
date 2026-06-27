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
