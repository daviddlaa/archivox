console.log('Cargando movil/gestion-lote.js...');

var gestionId = null;
var datosGestion = null;
var solicitudes = [];
var todasLasSolicitudes = [];
var campañas = [];
var filtroSemaforoMovil = null;
var campanaCompletada = false;
var SEMAFORO_MOVIL = ['sin_clasificar', 'verde', 'amarillo', 'rojo'];
var _recomendacionMovilIndex = 0;
var _recomendacionMovilTimer = null;

// Estado de líder/agentes (como en desktop)
var _esLider = false;
var _equipoActual = null;
var _agentesEquipo = [];

// Determinar si el usuario actual es líder
async function verificarRolUsuario() {
    try {
        var res = await fetch('/api/auth/sesion');
        var sesion = await res.json();
        if (sesion.autenticado && sesion.usuario) {
            _esLider = !!(sesion.usuario.es_lider || sesion.usuario.rol === 'superadmin' || sesion.usuario.rol === 'admin');
            _equipoActual = sesion.usuario.equipo_id || null;
            return _esLider;
        }
    } catch (e) {
        console.error('[verificarRolUsuario] Error:', e);
    }
    return false;
}

// Cargar agentes del equipo del líder
async function cargarAgentesEquipo(equipoId) {
    if (!equipoId) return [];
    try {
        var res = await fetch('/api/equipos/' + equipoId + '/dashboard');
        var data = await res.json();
        _agentesEquipo = data.agentes || [];
        return _agentesEquipo;
    } catch (e) {
        console.error('[cargarAgentesEquipo] Error:', e);
        _agentesEquipo = [];
        return [];
    }
}

function obtenerGestionId() {
    var urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('id');
}

async function init() {
    console.log('[movil-init] Iniciando carga de gestion-lote...');
    window.addEventListener('resize', ajustarStickySemaforo);
    try {
        await cargarListaCampanas();
        console.log('[movil-init] Campañas cargadas');

        gestionId = obtenerGestionId();
        console.log('[movil-init] gestionId:', gestionId);
        
        if (gestionId) {
            await cargarDatosGestionMovil();
            marcarCampañaActiva(gestionId);
            console.log('[movil-init] Carga completa');
            // Deep link: saltar a la tarjeta de la solicitud (desde Solicitudes)
            var urlParams = new URLSearchParams(window.location.search);
            var cardTarget = urlParams.get('card');
            if (cardTarget) {
                setTimeout(function() {
                    navegarACardMovil(cardTarget);
                }, 300);
                // Limpiar el parámetro card: si el usuario recarga, que no vuelva a saltar
                try {
                    urlParams.delete('card');
                    var nuevaBusqueda = urlParams.toString();
                    history.replaceState(null, '', window.location.pathname + (nuevaBusqueda ? '?' + nuevaBusqueda : ''));
                } catch (e) {}
            }
        } else {
            renderizarGridCampanasLandingMovil();
        }
    } catch (error) {
        console.error('[movil-init] Error:', error);
    }
}

function renderizarGridCampanasLandingMovil() {
    var container = document.getElementById('lista-solicitudes');
    if (!container) return;

    var semaforo = document.getElementById('semaforo-mobile');
    if (semaforo) semaforo.style.display = 'none';
    var kpi = document.getElementById('header-kpi-mobile');
    if (kpi) kpi.hidden = true;
    var histBtn = document.getElementById('btn-historial-campana-movil');
    if (histBtn) histBtn.style.display = 'none';

    if (!campañas || campañas.length === 0) {
        container.innerHTML = '<div class="sin-campana">' +
            '<div class="sin-campana-icon">📋</div>' +
            '<p>No hay campañas.</p>' +
            '<p>Ve a <a href="/m/solicitudes">Solicitudes</a> para crear una.</p>' +
            '</div>';
        return;
    }

    var html = '<div class="campanas-landing-grid-movil">';
    for (var i = 0; i < campañas.length; i++) {
        var g = campañas[i];
        var completadas = parseInt(g.completadas || 0, 10);
        var pct = g.total_solicitudes > 0 ? Math.round((completadas / g.total_solicitudes) * 100) : 0;
        var estadoClase = (g.estado === 'Completada' || pct === 100) ? 'completada' : 'activa';

        html += '<div class="campana-landing-card" onclick="seleccionarCampaña(' + g.id + ')">';
        html += '  <div class="campana-landing-card-top">';
        html += '    <span class="campana-landing-id">#' + g.id + '</span>';
        html += '    <span class="campana-landing-estado ' + estadoClase + '">' + (g.estado || 'Activa') + '</span>';
        html += '  </div>';
        html += '  <div class="campana-landing-name">' + escaparParaHTML(g.nombre || 'Sin nombre') + '</div>';
        if (g.es_sistema) {
            html += '  <div class="campaña-badge-sistema">🤖 Asignada por el sistema</div>';
        }
        html += '  <div class="campana-landing-stats">' + (g.total_solicitudes || 0) + ' solicitudes · ' + completadas + ' completadas · ' + pct + '%</div>';
        html += '  <div class="campana-landing-bar"><span style="width:' + pct + '%"></span></div>';
        html += '  <button type="button" class="campana-landing-more" onclick="event.stopPropagation(); abrirBottomSheetCampana(' + g.id + ', \'' + escaparParaAtributo(g.nombre || 'Gestión #' + g.id) + '\', ' + (g.total_solicitudes || 0) + ', ' + (g.gestionadas || 0) + ', \'' + escaparParaAtributo(g.descripcion || '') + '\', \'' + (g.fecha_limite || '') + '\', \'' + (g.estado || 'Activa') + '\')" title="Acciones">⋯</button>';
        html += '</div>';
    }
    html += '</div>';
    container.innerHTML = html;
}

async function cargarListaCampanas() {
    try {
        console.log('[movil-campanas] Fetching campaigns...');
        var container = document.getElementById('lista-campañas');
        
        // Paralelizar: cargar campañas y verificar rol al mismo tiempo
        var controller = new AbortController();
        var timeoutId = setTimeout(function() { controller.abort(); }, 10000);
        
        var [response] = await Promise.all([
            fetch('/api/gestiones-maestro', { signal: controller.signal }),
            verificarRolUsuario()
        ]);
        clearTimeout(timeoutId);
        
        console.log('[movil-campanas] Response:', response.status);
        if (!response.ok) throw new Error('Error al cargar campañas (status: ' + response.status + ')');
        campañas = await response.json();

        if (!campañas || campañas.length === 0) {
            container.innerHTML = '<div style="text-align:center;padding:24px;color:#94a3b8;font-size:13px;">No hay campañas. Ve a Solicitudes para crear una.</div>';
            return;
        }

        // Cargar agentes del equipo sin bloquear el render (se usan al hacer clic en ⋮)
        if (_esLider && _equipoActual) {
            cargarAgentesEquipo(_equipoActual);
        }
        
        var html = '';
        for (var i = 0; i < campañas.length; i++) {
            var g = campañas[i];
            var completadas = parseInt(g.completadas || 0, 10);
            var pct = g.total_solicitudes > 0 ? Math.round((completadas / g.total_solicitudes) * 100) : 0;
            var isActive = gestionId && String(g.id) === String(gestionId) ? 'active' : '';

            html += '<div class="campana-sheet-item ' + isActive + '" onclick="seleccionarCampaña(' + g.id + ')">';
            html += '  <div class="campana-sheet-item-icon">📋</div>';
            html += '  <div class="campana-sheet-item-info">';
            html += '    <div class="campana-sheet-item-name">' + (g.nombre || 'Sin nombre') + (g.es_sistema ? ' <span class="campana-sheet-item-badge">🤖 Sistema</span>' : '') + '</div>';
            html += '    <div class="campana-sheet-item-stats">' + (g.total_solicitudes || 0) + ' solicitudes · ' + completadas + ' completadas · ' + pct + '%</div>';
            html += '  </div>';
            html += '  <button class="campana-sheet-item-more" onclick="event.stopPropagation(); closeCampanasSheet(); abrirBottomSheetCampana(' + g.id + ', \'' + escaparParaAtributo(g.nombre || 'Gestión #' + g.id) + '\', ' + (g.total_solicitudes || 0) + ', ' + (g.gestionadas || 0) + ', \'' + escaparParaAtributo(g.descripcion || '') + '\', \'' + (g.fecha_limite || '') + '\', \'' + (g.estado || 'Activa') + '\')" title="Acciones">⋯</button>';
            html += '</div>';
        }

        container.innerHTML = html;
        actualizarBotonCampana();
    } catch (error) {
        console.error('Error cargando campañas:', error);
        var container = document.getElementById('lista-campañas');
        if (container) container.innerHTML = '<div style="text-align:center;padding:24px;color:#94a3b8;font-size:13px;">Error al cargar campañas</div>';
    }
}

function toggleCampanasSheet() {
    var overlay = document.getElementById('campanas-sheet-overlay');
    var sheet = document.getElementById('campanas-sheet');
    if (!overlay || !sheet) return;
    if (sheet.classList.contains('visible')) {
        closeCampanasSheet();
    } else {
        overlay.classList.add('visible');
        sheet.classList.add('visible');
    }
}

function closeCampanasSheet() {
    var overlay = document.getElementById('campanas-sheet-overlay');
    var sheet = document.getElementById('campanas-sheet');
    if (overlay) overlay.classList.remove('visible');
    if (sheet) sheet.classList.remove('visible');
}

function actualizarBotonCampana() {
    var label = document.getElementById('campana-btn-label');
    if (!label) return;
    if (gestionId) {
        var cam = (campañas || []).find(function(c) { return String(c.id) === String(gestionId); });
        label.textContent = cam ? (cam.nombre || 'Campaña') : 'Campaña';
    } else {
        label.textContent = 'Campañas';
    }
}

function seleccionarCampaña(id) {
    closeCampanasSheet();
    gestionId = id;
    marcarCampañaActiva(id);
    window.location.href = '/m/gestion-lote?id=' + id;
}

function marcarCampañaActiva(id) {
    var items = document.querySelectorAll('.campana-sheet-item');
    items.forEach(function(el) { el.classList.remove('active'); });
    // Buscar por índice en la lista
    if (campañas) {
        for (var i = 0; i < campañas.length; i++) {
            if (String(campañas[i].id) === String(id)) {
                if (items[i]) items[i].classList.add('active');
                break;
            }
        }
    }
    actualizarBotonCampana();
}

// Unifica cargarGestion + cargarSolicitudes en móvil
async function cargarDatosGestionMovil() {
    try {
        console.log('[movil-cargarDatos] Cargando gestión ID:', gestionId);
        var container = document.getElementById('lista-solicitudes');
        if (container) container.innerHTML = '<div class="sin-campana"><p>Cargando solicitudes...</p></div>';

        var controller = new AbortController();
        var timeoutId = setTimeout(function() { controller.abort(); }, 10000);
        var response = await fetch('/api/gestiones-maestro/' + gestionId, { signal: controller.signal });
        clearTimeout(timeoutId);
        
        console.log('[movil-cargarDatos] Response:', response.status);
        if (!response.ok) throw new Error('Error al cargar gestión (status: ' + response.status + ')');

        datosGestion = await response.json();
        filtroSemaforoMovil = null;
        
        var panel = document.getElementById('panel-progreso');
        if (panel) panel.style.display = 'none';
        var semaforoPanel = document.getElementById('semaforo-mobile');
        if (semaforoPanel) semaforoPanel.style.display = 'block';

        var kpiMobile = document.getElementById('header-kpi-mobile');
        if (kpiMobile) kpiMobile.hidden = false;

        cerrarRecoSheet();

        var containerExportar = document.getElementById('exportar-excel-container');
        if (containerExportar) containerExportar.style.display = 'none';
        var containerAgregar = document.getElementById('agregar-solicitudes-container');
        if (containerAgregar) containerAgregar.style.display = 'none';

        solicitudes = datosGestion.solicitudes || [];
        console.log('[movil-cargarDatos] Solicitudes:', solicitudes.length);
        if (solicitudes.length > 0) {
            console.log('[movil-cargarDatos] Primeras 3 gestion_obs:', 
                solicitudes.slice(0, 3).map(function(s) { 
                    return {id: s.id_solicitud, obs: s.gestion_obs, tipo: s.tipo_gestion}; 
                })
            );
        }
        todasLasSolicitudes = solicitudes.slice();

        aplicarEstadoSemaforoCompletadaMovil();
        renderizarSolicitudes(solicitudes);
        actualizarProgreso();
        mostrarBotonHistorialCampanaMovil();
        ajustarStickySemaforo();
    } catch (error) {
        console.error('[movil-cargarDatos] Error:', error);
        var container = document.getElementById('lista-solicitudes');
        if (container) container.innerHTML = '<div class="sin-campana"><p>Error: ' + error.message + '</p></div>';
    }
}

function actualizarProgreso() {
    if (!datosGestion) return;
    var total = datosGestion.total_solicitudes || 0;
    var gestionadas = 0;
    var completadas = 0;

    solicitudes.forEach(function(sol) {
        if (sol.gestion_id && sol.tipo_gestion && sol.tipo_gestion !== 'Pendiente') gestionadas++;
        if (sol.tipo_gestion === 'Completada') completadas++;
    });

    var pendientes = Math.max(total - completadas, 0);
    var porcentaje = total > 0 ? Math.round((completadas / total) * 100) : 0;

    var elPct = document.getElementById('progreso-porcentaje'); if (elPct) elPct.textContent = porcentaje + '%';
    var resumen = document.getElementById('avance-mobile-resumen'); if (resumen) resumen.textContent = completadas + '/' + total;
    var restante = document.getElementById('avance-mobile-restante');
    if (restante) restante.textContent = pendientes > 0 ? pendientes + ' pend.' : (total > 0 ? 'Completada' : 'Sin sol.');
    var barra = document.getElementById('barra-progreso');
    if (barra) {
        barra.style.width = porcentaje + '%';
        var track = barra.parentElement;
        if (track) track.setAttribute('aria-valuenow', porcentaje);
    }
    actualizarActividadMovil();
    actualizarSemaforoMovil();
}

function normalizarSemaforoMovil(valor) {
    return SEMAFORO_MOVIL.indexOf(valor) !== -1 ? valor : 'sin_clasificar';
}

function aplicarEstadoSemaforoCompletadaMovil() {
    campanaCompletada = /^completad[ao]$/i.test((datosGestion && datosGestion.estado) || '');
    var scroll = document.getElementById('semaforo-mobile-scroll');
    var nota = document.getElementById('semaforo-completada-note-movil');

    if (campanaCompletada) {
        filtroSemaforoMovil = null;
        if (scroll) scroll.style.display = 'none';
        if (nota) nota.style.display = 'block';
    } else {
        if (scroll) scroll.style.display = '';
        if (nota) nota.style.display = 'none';
    }
}

function obtenerConteoSemaforoMovil() {
    var conteo = { sin_clasificar: 0, verde: 0, amarillo: 0, rojo: 0 };
    if (campanaCompletada) return conteo;
    var lista = todasLasSolicitudes || [];
    lista.forEach(function(sol) {
        if (sol.tipo_gestion === 'Completada') return;
        conteo[normalizarSemaforoMovil(sol.semaforo)]++;
    });
    return conteo;
}

function formatearTiempoRelativoMovil(fecha) {
    if (!fecha) return null;
    var timestamp = new Date(fecha).getTime();
    if (isNaN(timestamp)) return null;
    var minutos = Math.max(0, Math.floor((Date.now() - timestamp) / 60000));
    if (minutos < 1) return 'Hace un momento';
    if (minutos < 60) return 'Hace ' + minutos + ' minuto' + (minutos === 1 ? '' : 's');
    var horas = Math.floor(minutos / 60);
    if (horas < 24) return 'Hace ' + horas + ' hora' + (horas === 1 ? '' : 's');
    var dias = Math.floor(horas / 24);
    return 'Hace ' + dias + ' día' + (dias === 1 ? '' : 's');
}

function actualizarActividadMovil() {
    var ultima = null;
    (todasLasSolicitudes || []).forEach(function(sol) {
        if (!sol.fecha_gestion) return;
        var timestamp = new Date(sol.fecha_gestion).getTime();
        if (!isNaN(timestamp) && (!ultima || timestamp > ultima.timestamp)) ultima = { timestamp: timestamp, tipo: sol.tipo_gestion || 'Gestión' };
    });
    var texto = document.getElementById('ultima-actividad-mobile');
    var detalle = document.getElementById('actividad-mobile-detalle');
    var bloque = document.getElementById('actividad-mobile');
    var pausa = document.getElementById('header-pausa-mobile');
    var enPausa = !!ultima && (Date.now() - ultima.timestamp) > 8 * 60 * 60 * 1000;
    if (texto) texto.textContent = ultima ? formatearTiempoRelativoMovil(ultima.timestamp) : 'Sin actividad registrada';
    if (detalle) detalle.textContent = ultima ? ultima.tipo + ' registrada en la campaña' : 'Cuando registres una gestión, aparecerá aquí.';
    if (bloque) bloque.classList.toggle('actividad-mobile-antigua', enPausa);
    if (pausa) pausa.hidden = !enPausa;
}

function actualizarSemaforoMovil(conteo) {
    conteo = conteo || obtenerConteoSemaforoMovil();
    SEMAFORO_MOVIL.forEach(function(key) {
        var count = document.getElementById('count-mobile-' + key);
        var card = document.querySelector('.semaforo-mobile-card[data-semaforo="' + key + '"]');
        if (count) count.textContent = conteo[key] || 0;
        if (card) {
            card.classList.toggle('active', filtroSemaforoMovil === key);
            card.classList.toggle('is-empty', !(conteo[key] || 0));
        }
    });
    actualizarRecomendacionesMovil(conteo);
}

var BUENAS_PRACTICAS_MOVIL = [
    { icon: '📞', title: 'Prioriza la llamada cuando sea posible.', text: 'Ayuda a resolver dudas y detectar interés real.' },
    { icon: '📋', title: 'Registra la gestión durante la conversación.', text: 'Evita olvidos y mantiene el historial actualizado.' },
    { icon: '💬', title: 'Personaliza cada conversación de WhatsApp.', text: 'Usa el nombre y evita repetir mensajes idénticos.' },
    { icon: '📅', title: 'Respeta los horarios de contacto.', text: 'Cuida la experiencia del cliente y la respuesta.' },
    { icon: '↔️', title: 'Espera una respuesta antes de insistir.', text: 'Las conversaciones naturales ayudan a evitar restricciones.' }
];

function actualizarRecomendacionesMovil(conteo) {
    var activas = (solicitudes || []).filter(function(sol) { return sol.tipo_gestion !== 'Completada'; });
    var antiguas = activas.filter(function(sol) {
        if (!sol.fecha_gestion) return false;
        var fecha = new Date(sol.fecha_gestion).getTime();
        return !isNaN(fecha) && Date.now() - fecha > 48 * 60 * 60 * 1000;
    }).length;
    var contexto;
    if (activas.length === 0 && solicitudes.length) contexto = { icon: '✓', title: 'La campaña terminó su ciclo.', text: 'Revisa el historial para conservar buenas prácticas.' };
    else if (conteo.amarillo >= 3) contexto = { icon: '📌', title: 'Hay varios seguimientos por retomar.', text: 'Trabaja primero las solicitudes amarillas.' };
    else if (conteo.sin_clasificar >= 3) contexto = { icon: '🧭', title: 'Clasifica antes de continuar.', text: 'Ordenar las solicitudes ayuda a priorizar mejor.' };
    else if (antiguas >= 3) contexto = { icon: '⏰', title: 'Hay seguimientos sin actividad reciente.', text: 'Retomarlos puede mejorar el avance.' };
    else if (conteo.rojo >= 3) contexto = { icon: '⏳', title: 'Hay solicitudes en espera.', text: 'Respeta el tiempo y trabaja primero las amarillas.' };
    else contexto = { icon: '💡', title: 'Registra cada gestión mientras conversas.', text: 'Un historial actualizado evita olvidos.' };
    var icon = document.getElementById('recomendacion-mobile-icon');
    var sheetIcon = document.getElementById('reco-sheet-icon');
    var title = document.getElementById('recomendacion-mobile-titulo');
    var text = document.getElementById('recomendacion-mobile-texto');
    if (icon) icon.textContent = contexto.icon;
    if (sheetIcon) sheetIcon.textContent = contexto.icon;
    if (title) title.textContent = contexto.title;
    if (text) text.textContent = contexto.text;
    mostrarBuenaPracticaMovil();
    if (!_recomendacionMovilTimer) _recomendacionMovilTimer = setInterval(mostrarBuenaPracticaMovil, 10000);
}

function mostrarBuenaPracticaMovil() {
    var container = document.getElementById('buenas-practicas-mobile');
    if (!container) return;
    var practica = BUENAS_PRACTICAS_MOVIL[_recomendacionMovilIndex % BUENAS_PRACTICAS_MOVIL.length];
    _recomendacionMovilIndex++;
    container.innerHTML = '<span><b>' + practica.icon + '</b><strong>' + practica.title + '</strong></span><small>' + practica.text + '</small>';
}

function toggleRecomendaciones(modo) {
    if (modo === 'mobile') {
        toggleRecoChipMovil();
        return;
    }
    var contenido = document.getElementById('recomendaciones-contenido');
    var boton = contenido && contenido.parentElement.querySelector('button');
    if (!contenido || !boton) return;
    var oculto = contenido.hidden;
    contenido.hidden = !oculto;
    boton.textContent = oculto ? 'Ocultar' : 'Mostrar';
    boton.setAttribute('aria-expanded', String(oculto));
}

function toggleRecoChipMovil() {
    var sheet = document.getElementById('reco-bs-sheet');
    if (!sheet) return;
    var abrir = !sheet.classList.contains('visible');
    if (abrir) {
        abrirRecoSheet();
    } else {
        cerrarRecoSheet();
    }
    var chip = document.getElementById('reco-chip-btn');
    if (chip) chip.setAttribute('aria-expanded', String(abrir));
    try { localStorage.setItem('campanas_reco_open_mobile', abrir ? '1' : '0'); } catch (e) {}
}

function abrirRecoSheet() {
    var overlay = document.getElementById('reco-bs-overlay');
    var sheet = document.getElementById('reco-bs-sheet');
    if (overlay) overlay.classList.add('visible');
    if (sheet) sheet.classList.add('visible');
}

function cerrarRecoSheet() {
    var overlay = document.getElementById('reco-bs-overlay');
    var sheet = document.getElementById('reco-bs-sheet');
    if (overlay) overlay.classList.remove('visible');
    if (sheet) sheet.classList.remove('visible');
    var chip = document.getElementById('reco-chip-btn');
    if (chip) chip.setAttribute('aria-expanded', 'false');
}

// ===== Filtros inline (búsqueda + estado debajo del semáforo) =====
function limpiarFiltrosBusqueda() {
    var input = document.getElementById('busqueda');
    var select = document.getElementById('filtro-estado');
    if (input) input.value = '';
    if (select) select.value = '';
    filtroSemaforoMovil = null;
    actualizarSemaforoMovil();
    actualizarIndicadorFiltros();
    if (!gestionId) return; // sin campaña, no re-renderizar el estado vacío
    renderizarSolicitudes(todasLasSolicitudes);
}

function actualizarIndicadorFiltros() {
    var limpiar = document.getElementById('btn-filtros-limpiar');
    if (!limpiar) return;
    var input = document.getElementById('busqueda');
    var select = document.getElementById('filtro-estado');
    var activos = (input && input.value && input.value.length) || (select && select.value && select.value.length) || !!filtroSemaforoMovil;
    limpiar.style.display = activos ? 'flex' : 'none';
}

function setFiltroSemaforoMovil(valor) {
    if (campanaCompletada) {
        filtroSemaforoMovil = null;
        return;
    }
    filtroSemaforoMovil = valor && filtroSemaforoMovil === valor ? null : (valor || null);
    actualizarSemaforoMovil();
    renderizarSolicitudes(todasLasSolicitudes);
}

// ===== HISTORIAL GENERAL DE LA CAMPAÑA (móvil) =====
function mostrarBotonHistorialCampanaMovil() {
    var boton = document.getElementById('btn-historial-campana-movil');
    if (boton) boton.style.display = 'inline-flex';
}

async function abrirHistorialCampanaMovil() {
    if (!gestionId) return;
    try {
        crearModal('<div class="modal-gestion" style="text-align:center;padding:20px;"><h2>🕘 Últimas gestiones</h2><p>⏳ Cargando...</p></div>');

        var response = await fetch('/api/gestiones-maestro/' + gestionId + '/historial');
        if (!response.ok) throw new Error('Error al cargar historial general');

        var data = await response.json();
        var gestiones = (data && data.gestiones) || [];
        var nombreCampana = (data && data.gestion && data.gestion.nombre) ? data.gestion.nombre : 'Campaña';

        var contenido = '';
        contenido += '<div class="modal-gestion">';
        contenido += '<h2 class="historial-modal-titulo" style="word-break:break-word;">🕘 Últimas gestiones · ' + escaparParaHTML(nombreCampana) + '</h2>';

        if (!gestiones.length) {
            contenido += '<div style="text-align:center;padding:20px;color:#6b7280;font-size:13px;">No hay gestiones registradas en esta campaña</div>';
        } else {
            contenido += '<div style="margin-bottom:8px;color:#6b7280;font-size:12px;">📊 ' + gestiones.length + ' gestione(s) · toca una para ir a su tarjeta</div>';
            contenido += '<div style="max-height:60vh;overflow-y:auto;">';

            var coloresTipo = {
                'Pendiente': '#fef3c7',
                'Llamada': '#d1fae5',
                'WhatsApp': '#dcfce7',
                'Seguimiento': '#dbeafe',
                'Cobranza': '#fee2e2',
                'Cita': '#e0e7ff',
                'Completada': '#bbf7d0',
                'Recordatorio': '#ffedd5'
            };
            var coloresSemaforo = {
                'sin_clasificar': { bg: '#e5e7eb', texto: '⚪ Sin clasificar' },
                'amarillo': { bg: '#fef3c7', texto: '🟡 Seguimiento' },
                'verde': { bg: '#d1fae5', texto: '🟢 Encaminada' },
                'rojo': { bg: '#fee2e2', texto: '🔴 En espera' }
            };

            for (var i = 0; i < gestiones.length; i++) {
                var g = gestiones[i];
                var fecha = formatearFechaHistorialMovil(g.fecha_gestion);
                var isLast = i === gestiones.length - 1;
                var colorBadge = coloresTipo[g.tipo_gestion] || '#f3f4f6';
                var semaforo = coloresSemaforo[g.semaforo] || coloresSemaforo['sin_clasificar'];
                var nombreCliente = g.nombre_cliente || 'Solicitud #' + g.solicitud_id;

                contenido += '<div style="display:flex;gap:12px;position:relative;cursor:pointer;" onclick="navegarACardMovil(\'' + g.solicitud_id + '\')">';
                contenido += '<div style="display:flex;flex-direction:column;align-items:center;">';
                contenido += '<div style="width:12px;height:12px;border-radius:50%;background:' + colorBadge + ';border:2px solid #9ca3af;flex-shrink:0;"></div>';
                if (!isLast) contenido += '<div style="width:2px;flex:1;background:#e5e7eb;margin:4px 0;"></div>';
                contenido += '</div>';
                contenido += '<div style="flex:1;padding-bottom:' + (isLast ? '0' : '12px') + ';">';
                contenido += '<div style="display:flex;align-items:center;justify-content:space-between;gap:6px;margin-bottom:3px;">';
                contenido += '<strong style="font-size:13px;color:#111827;">' + escaparParaHTML(nombreCliente) + '</strong>';
                contenido += '<span style="font-size:10px;color:#374151;background:' + semaforo.bg + ';padding:2px 8px;border-radius:10px;font-weight:600;flex-shrink:0;">' + semaforo.texto + '</span>';
                contenido += '</div>';
                contenido += '<div style="font-size:10px;color:#9ca3af;margin-bottom:3px;">#' + g.solicitud_id + (g.cedula ? ' · 🆔 ' + escaparParaHTML(g.cedula) : '') + '</div>';
                contenido += '<div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;flex-wrap:wrap;">';
                contenido += '<span style="background:' + colorBadge + ';padding:1px 8px;border-radius:10px;font-size:10px;font-weight:600;color:#374151;">' + escaparParaHTML(g.tipo_gestion || '—') + '</span>';
                if (g.vendedor) contenido += '<span style="font-size:10px;color:#2563eb;font-weight:600;">🏷️ ' + escaparParaHTML(g.vendedor) + '</span>';
                contenido += '<span style="font-size:10px;color:#9ca3af;">⏱️ ' + fecha + '</span>';
                contenido += '</div>';
                contenido += '<div style="background:#f9fafb;padding:8px 10px;border-radius:6px;font-size:12px;color:#374151;line-height:1.4;">' + escaparParaHTML(g.observacion || 'Sin observación') + '</div>';
                contenido += '</div>';
                contenido += '</div>';
            }

            contenido += '</div>';
        }

        contenido += '<div style="margin-top:12px;text-align:right;">';
        contenido += '<button class="btn-cerrar" onclick="cerrarModal()" style="padding:8px 20px;background:#f3f4f6;border:none;border-radius:8px;cursor:pointer;font-size:14px;">Cerrar</button>';
        contenido += '</div>';
        contenido += '</div>';

        cerrarModal();
        crearModal(contenido, { alto: '75vh' });
    } catch (error) {
        console.error('[movil] Error cargando historial general:', error);
        cerrarModal();
        alert('Error al cargar el historial de la campaña');
    }
}

// Ir a la tarjeta de una solicitud desde el historial general, sin importar su semáforo
function navegarACardMovil(solicitudId) {
    cerrarModal();

    filtroSemaforoMovil = null;
    var inputBusqueda = document.getElementById('busqueda');
    if (inputBusqueda) inputBusqueda.value = '';
    var selectEstado = document.getElementById('filtro-estado');
    if (selectEstado) selectEstado.value = '';
    actualizarSemaforoMovil();
    renderizarSolicitudes(todasLasSolicitudes);

    var target = document.querySelector('.sol-card[data-sol-id="' + solicitudId + '"]');
    if (!target) {
        alert('La solicitud ya no está en esta campaña');
        return;
    }

    if (target.closest('.solicitudes-completadas-mobile')) {
        var heading = document.querySelector('.completadas-mobile-heading');
        var listaCompletadas = heading && heading.nextElementSibling;
        if (heading && listaCompletadas && listaCompletadas.hidden) toggleCompletadasMovil(heading);
        target = document.querySelector('.sol-card[data-sol-id="' + solicitudId + '"]');
        if (!target) return;
    }

    target.scrollIntoView({ behavior: 'smooth', block: 'center' });

    target.classList.remove('sol-card-nav-flash');
    void target.offsetWidth;
    target.classList.add('sol-card-nav-flash');
    setTimeout(function() {
        target.classList.remove('sol-card-nav-flash');
    }, 1600);
}

// El semáforo es sticky: se pega justo debajo del header (altura dinámica)
function ajustarStickySemaforo() {
    var header = document.querySelector('.header');
    var semaforo = document.getElementById('semaforo-mobile');
    var lista = document.getElementById('lista-solicitudes');
    if (!header || !semaforo) return;
    var top = header.offsetHeight;
    semaforo.style.top = top + 'px';
    if (lista) lista.style.scrollMarginTop = (top + semaforo.offsetHeight) + 'px';
}

function mostrarConfirmacionGestionMovil(mensaje) {
    var anterior = document.querySelector('.campana-toast-mobile');
    if (anterior) anterior.remove();
    var toast = document.createElement('div');
    toast.className = 'campana-toast-mobile';
    toast.textContent = '✓ ' + mensaje;
    document.body.appendChild(toast);
    requestAnimationFrame(function() { toast.classList.add('visible'); });
    setTimeout(function() { toast.classList.remove('visible'); setTimeout(function() { if (toast.parentNode) toast.remove(); }, 180); }, 2200);
}

function abrirSelectorSemaforoMovil(solicitudId, actual) {
    var opciones = [
        { key: 'sin_clasificar', label: 'Por revisar', help: 'Todavía necesita clasificación.' },
        { key: 'verde', label: 'Ya encaminada', help: 'La gestión avanza correctamente.' },
        { key: 'amarillo', label: 'Necesita seguimiento', help: 'Conviene retomarla pronto.' },
        { key: 'rojo', label: 'En espera', help: 'No contactar ahora.' }
    ];
    var contenido = '<div class="modal-gestion modal-semaforo-movil"><h2>Estado de espera</h2><p class="semaforo-modal-help">Elige el próximo momento adecuado para contactar.</p><div class="semaforo-modal-opciones">';
    opciones.forEach(function(opcion) {
        contenido += '<button type="button" class="semaforo-modal-opcion ' + opcion.key + (actual === opcion.key ? ' actual' : '') + '" onclick="cambiarSemaforoMovil(\'' + solicitudId + '\', \'' + opcion.key + '\')"><span class="sol-semaforo-dot"></span><span><strong>' + opcion.label + '</strong><small>' + opcion.help + '</small></span></button>';
    });
    contenido += '</div><button class="btn-cancelar" onclick="cerrarModal()">Cancelar</button></div>';
    crearModal(contenido);
}

async function cambiarSemaforoMovil(solicitudId, semaforo) {
    if (!gestionId) return;
    try {
        var response = await fetch('/api/gestiones-maestro/' + gestionId + '/solicitudes/' + encodeURIComponent(solicitudId) + '/semaforo', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ semaforo: semaforo })
        });
        var resultado = await response.json().catch(function() { return {}; });
        if (!response.ok) throw new Error(resultado.error || 'No se pudo actualizar el estado');
        cerrarModal();
        mostrarConfirmacionGestionMovil('Estado actualizado');
        await cargarDatosGestionMovil();
    } catch (error) {
        console.error('[movil] Error actualizando semáforo:', error);
        alert(error.message || 'Error al actualizar el estado');
    }
}

async function cambiarSemaforoSolicitudMovil(solicitudId, semaforo, eventRef) {
    if (!gestionId) return;
    var valor = normalizarSemaforoMovil(semaforo);
    var prev = null;
    (todasLasSolicitudes || []).forEach(function(sol) {
        if (String(sol.id_solicitud) === String(solicitudId)) prev = normalizarSemaforoMovil(sol.semaforo);
    });
    if (prev === valor) return;

    var origin = eventRef && eventRef.currentTarget ? eventRef.currentTarget : null;
    try {
        var response = await fetch('/api/gestiones-maestro/' + gestionId + '/solicitudes/' + encodeURIComponent(solicitudId) + '/semaforo', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ semaforo: valor })
        });
        var data = await response.json().catch(function() { return {}; });
        if (!response.ok) {
            alert(data.error || 'No se pudo actualizar el estado');
            return;
        }

        (todasLasSolicitudes || []).forEach(function(sol) {
            if (String(sol.id_solicitud) === String(solicitudId)) sol.semaforo = valor;
        });
        (solicitudes || []).forEach(function(sol) {
            if (String(sol.id_solicitud) === String(solicitudId)) sol.semaforo = valor;
        });

        var container = document.getElementById('lista-solicitudes');
        var motionOk = !(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
        var oldRects = {};
        if (container && motionOk) {
            container.querySelectorAll('.sol-card[data-sol-id]').forEach(function(c) {
                oldRects[c.getAttribute('data-sol-id')] = c.getBoundingClientRect();
            });
        }

        // Si el filtro activo ya no incluye esta tarjeta → animar salida antes de re-render
        var card = origin && origin.closest ? origin.closest('.sol-card') : null;
        if (filtroSemaforoMovil && filtroSemaforoMovil !== valor && card && motionOk) {
            card.classList.add('sol-card-exit');
            await new Promise(function(r) { setTimeout(r, 220); });
        }

        renderizarSolicitudes(todasLasSolicitudes, true);
        actualizarSemaforoMovil(data.semaforo_conteos);

        if (container && motionOk) {
            // FLIP: las tarjetas que permanecen se deslizan a su nueva posición
            container.querySelectorAll('.sol-card[data-sol-id]').forEach(function(c) {
                var id = c.getAttribute('data-sol-id');
                var old = oldRects[id];
                if (!old) return;
                var nr = c.getBoundingClientRect();
                var dx = old.left - nr.left;
                var dy = old.top - nr.top;
                if (!dx && !dy) return;
                c.style.transition = 'none';
                c.style.transform = 'translate(' + dx + 'px,' + dy + 'px)';
                requestAnimationFrame(function() {
                    requestAnimationFrame(function() {
                        c.style.transition = '';
                        c.style.transform = '';
                    });
                });
            });
            // Bump en la tarjeta del semáforo destino del carrusel
            var target = document.querySelector('.semaforo-mobile-card[data-semaforo="' + valor + '"]');
            if (target) {
                target.classList.remove('bump');
                void target.offsetWidth;
                target.classList.add('bump');
            }
        }

        mostrarConfirmacionGestionMovil('Estado actualizado');
    } catch (error) {
        console.error('[movil] Error actualizando semáforo:', error);
        alert(error.message || 'Error al actualizar el estado');
    }
}

// Normaliza el texto para búsqueda: minúsculas, sin tildes, sin espacios sobrantes
function normalizarBusqueda(texto) {
    return String(texto || '').toLowerCase().trim().replace(/\s+/g, ' ').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function renderizarSolicitudes(lista, sinEntrada) {
    var container = document.getElementById('lista-solicitudes');
    // Guardar posición de scroll antes de re-render
    var scrollY = container ? container.scrollTop : 0;
    if (container) container.classList.toggle('no-stagger', !!sinEntrada);
    actualizarIndicadorFiltros();
    if (!lista || lista.length === 0) {
        container.innerHTML = '<div class="sin-campana"><p>No hay solicitudes en esta gestión</p></div>';
        return;
    }

    var busqueda = (document.getElementById('busqueda') && normalizarBusqueda(document.getElementById('busqueda').value)) || '';
    var filtroEstado = (document.getElementById('filtro-estado') && document.getElementById('filtro-estado').value) || '';

    var filtradas = lista.filter(function(sol) {
        if (busqueda) {
            var matchId = sol.id_solicitud && normalizarBusqueda(sol.id_solicitud).includes(busqueda);
            var matchCedula = sol.cedula && normalizarBusqueda(sol.cedula).includes(busqueda);
            var matchNombre = sol.nombre && normalizarBusqueda(sol.nombre).includes(busqueda);
            var matchCelular = sol.celular && normalizarBusqueda(sol.celular).includes(busqueda);
            var matchObs = sol.gestion_obs && normalizarBusqueda(sol.gestion_obs).includes(busqueda);
            var matchTipo = sol.tipo_gestion && normalizarBusqueda(sol.tipo_gestion).includes(busqueda);
            if (!matchId && !matchCedula && !matchNombre && !matchCelular && !matchObs && !matchTipo) return false;
        }
        if (filtroEstado) {
            var estadoActual = sol.tipo_gestion || 'Pendiente';
            if (estadoActual !== filtroEstado) return false;
        }
        if (filtroSemaforoMovil) {
            if (campanaCompletada || sol.tipo_gestion === 'Completada') return false;
            if (normalizarSemaforoMovil(sol.semaforo) !== filtroSemaforoMovil) return false;
        }
        return true;
    });
    if (filtradas.length === 0) {
        container.innerHTML = '<div class="sin-campana"><p>No hay solicitudes que coincidan con los filtros</p></div>';
        return;
    }
    
    var completadas = filtradas.filter(function(sol) { return sol.tipo_gestion === 'Completada'; });
    var activasFiltradas = filtradas.filter(function(sol) { return sol.tipo_gestion !== 'Completada'; });

    // Ordenar: destacadas primero (🔥 al inicio), luego por prioridad de semáforo
    var PRIORIDAD_SEMAFORO_MOVIL = { amarillo: 0, sin_clasificar: 1, verde: 2, rojo: 3 };
    activasFiltradas.sort(function(a, b) {
        if (a.destacado == 1 && b.destacado != 1) return -1;
        if (a.destacado != 1 && b.destacado == 1) return 1;
        var pa = PRIORIDAD_SEMAFORO_MOVIL[normalizarSemaforoMovil(a.semaforo)] || 4;
        var pb = PRIORIDAD_SEMAFORO_MOVIL[normalizarSemaforoMovil(b.semaforo)] || 4;
        return pa - pb;
    });
    completadas.sort(function(a, b) { return new Date(b.fecha_gestion || 0).getTime() - new Date(a.fecha_gestion || 0).getTime(); });
    
    var html = activasFiltradas.length ? '<section class="solicitudes-activas-mobile">' : '';
    for (var i = 0; i < activasFiltradas.length; i++) {
        var sol = activasFiltradas[i];
        var estado = sol.tipo_gestion || 'Pendiente';
        var observacion = sol.gestion_obs || '';
        var gestionada = estado !== 'Pendiente';
        var destacada = sol.destacado == 1;
        var semaforo = normalizarSemaforoMovil(sol.semaforo);
        var noAplica = sol.no_aplica_credito == 0;

        html += '<div class="sol-card sol-semaforo-' + semaforo + ' ' + (gestionada ? 'gestionada' : '') + (destacada ? ' destacada' : '') + (noAplica ? ' no-aplica-credito' : '') + '" data-sol-id="' + sol.id_solicitud + '" data-gestion-id="' + (sol.gestion_id || '') + '">';
        html += '<div class="sol-header">';
        html += '<div class="sol-header-badges">';
        if (destacada) {
            html += '<span class="sol-destacado-badge sol-destacado-badge-on" onclick="event.stopPropagation(); toggleDestacado(\'' + sol.id_solicitud + '\', 0, event)" title="Quitar destacado">🔥 Destacada</span>';
        } else {
            html += '<span class="sol-destacado-badge sol-destacado-badge-off" onclick="event.stopPropagation(); toggleDestacado(\'' + sol.id_solicitud + '\', 1, event)" title="Destacar tarjeta">🔥 Destacar</span>';
        }
        html += '<div class="sol-badge estado-' + estado.replace(/\s+/g,'') + '">' + estado + '</div>';
        html += '<span class="sol-segmento-badge" title="Segmento">' + (sol.segmento ? escaparParaHTML(sol.segmento) : '—') + '</span>';
        html += '</div>';
        html += '</div>';

        html += '<div class="sol-nombre sol-nombre-copy" onclick="copiarNombreCedula(\'' + escaparParaAtributo(sol.nombre || '') + '\', \'' + escaparParaAtributo(sol.cedula || '') + '\')" title="Copiar nombre completo y cédula">' + (sol.nombre || 'Sin nombre') + '</div>';
        html += '<div class="sol-semaforo-switch" role="group" aria-label="Estado de espera">';
        for (var s = 0; s < SEMAFORO_MOVIL.length; s++) {
            var keyS = SEMAFORO_MOVIL[s];
            var activeCls = semaforo === keyS ? ' active' : '';
            var labelS = keyS === 'sin_clasificar' ? 'Sin clasificar' : keyS === 'verde' ? 'Encaminada' : keyS === 'amarillo' ? 'Seguimiento' : 'En espera';
            html += '<button type="button" class="sol-semaforo-switch-segment ' + keyS + activeCls + '" data-val="' + keyS + '" onclick="event.stopPropagation(); cambiarSemaforoSolicitudMovil(\'' + sol.id_solicitud + '\', \'' + keyS + '\', event)" aria-label="' + labelS + '"><span class="sol-semaforo-switch-dot"></span><span class="sol-semaforo-switch-text">' + labelS + '</span></button>';
        }
        html += '</div>';
        html += '<div class="sol-datos">';
        html += '<span class="sol-dato-copy" onclick="copiarTexto(\'' + escaparParaAtributo(sol.cedula || '') + '\', \'cédula\')" title="Copiar cédula">🆔 ' + (sol.cedula || '—') + '</span>';
        html += '<span class="sol-dato-copy" onclick="copiarTexto(\'' + escaparParaAtributo(sol.celular || '') + '\', \'teléfono\')" title="Copiar teléfono">📱 ' + (sol.celular || '—') + '</span>';
        html += '<button type="button" class="btn-sol btn-sol-call" onclick="llamarDesdeGestionLote(\'' + (sol.celular || "") + '\')" title="Llamar">📞</button>';
        html += '<span class="sol-chat-icon" onclick="abrirGestionWhatsApp(\'' + escaparParaAtributo(sol.id_solicitud) + '\', \'' + escaparParaAtributo(sol.celular || '') + '\')" title="Enviar WhatsApp con plantilla">💬</span>';
        html += '</div>';

        if (observacion) {
            html += '<div class="sol-obs">' + observacion + '</div>';
        }

html += '<div class="sol-botones sol-botones-fila">';
        html += '<button class="btn-sol btn-sol-primary" onclick="abrirGestion(\'' + sol.id_solicitud + '\', \'Seguimiento\')"><span class="sol-btn-icon">📋</span><span class="sol-btn-label">Seguimiento</span></button>';
        html += '<button class="btn-sol btn-sol-historial" onclick="verHistorial(\'' + sol.id_solicitud + '\')"><span class="sol-btn-icon">📋</span><span class="sol-btn-label">Historial</span></button>';
        if (sol.recordatorio_id) {
            html += '<button class="btn-sol btn-sol-recordatorio" onclick="verRecordatorioMovil(\'' + sol.id_solicitud + '\')"><span class="sol-btn-icon">⏰</span><span class="sol-btn-label">Recordatorio</span></button>';
        }
        html += '<button class="btn-sol btn-sol-quitar" onclick="confirmarQuitarSolicitud(\'' + sol.id_solicitud + '\', \'' + escaparParaAtributo(sol.nombre || '') + '\')"><span class="sol-btn-icon">❌</span><span class="sol-btn-label">Quitar</span></button>';
        html += '<button class="btn-sol btn-sol-noaplica' + (noAplica ? ' activo' : '') + '" onclick="confirmarMarcarNoAplicaCreditoMovil(\'' + sol.id_solicitud + '\', ' + (noAplica ? 1 : 0) + ')" title="' + (noAplica ? 'Restaurar: aplica para crédito' : 'Marcar: ya no aplica para crédito') + '"><span class="sol-btn-icon">' + (noAplica ? '👍' : '👎') + '</span><span class="sol-btn-label">No aplica</span></button>';
        html += '</div>';

        html += '</div>'; // sol-card
    }

    if (activasFiltradas.length) html += '</section>';
    if (completadas.length) {
        var completadasAbiertas = activasFiltradas.length === 0;
        html += '<section class="solicitudes-completadas-mobile"><button type="button" class="completadas-mobile-heading' + (completadasAbiertas ? ' open' : '') + '" onclick="toggleCompletadasMovil(this)" aria-expanded="' + completadasAbiertas + '"><span><strong>✓ Solicitudes completadas</strong><small>El ciclo de estas solicitudes terminó</small></span><span><b>' + completadas.length + '</b><i>⌄</i></span></button><div class="completadas-mobile-lista"' + (completadasAbiertas ? '' : ' hidden') + '>';
        completadas.forEach(function(solCompletada) { html += renderizarTarjetaCompletadaMovil(solCompletada); });
        html += '</div></section>';
    }
    container.innerHTML = html;
    // Restaurar posición de scroll si el contenido es lo suficientemente largo
    if (scrollY > 0 && container.scrollHeight > scrollY) {
        container.scrollTop = scrollY;
    }
}

function renderizarTarjetaCompletadaMovil(sol) {
    var nombre = escaparParaHTML(sol.nombre || 'Sin nombre');
    var observacion = escaparParaHTML(sol.gestion_obs || 'Sin observación registrada');
    var fecha = formatearTiempoRelativoMovil(sol.fecha_gestion) || 'Fecha no disponible';
    return '<article class="sol-card sol-card-completada-mobile">' +
        '<div class="completada-mobile-top"><span>✓ Completada</span><small>' + fecha + '</small></div>' +
        '<div class="sol-nombre-row-mobile"><strong>' + nombre + '</strong><b>' + (sol.segmento || 'Sin segmento') + '</b></div>' +
        '<div class="sol-datos"><span>🆔 ' + (sol.cedula || '—') + '</span><span>📱 ' + (sol.celular || '—') + '</span></div>' +
        '<div class="completada-mobile-gestion"><strong>' + (sol.tipo_gestion || 'Completada') + '</strong><span>' + observacion + '</span></div>' +
        '<div class="sol-botones"><button class="btn-sol btn-sol-ver" onclick="verGestion(\'' + sol.id_solicitud + '\')">📋 Ver gestión</button><button class="btn-sol btn-sol-historial" onclick="verHistorial(\'' + sol.id_solicitud + '\')">📋 Historial</button><button class="btn-sol btn-sol-quitar" onclick="confirmarQuitarSolicitud(\'' + sol.id_solicitud + '\', \'' + escaparParaAtributo(sol.nombre || '') + '\')">❌ Quitar</button></div>' +
        '</article>';
}

function toggleCompletadasMovil(button) {
    var lista = button && button.nextElementSibling;
    if (!lista) return;
    var abierta = !lista.hidden;
    lista.hidden = abierta;
    button.setAttribute('aria-expanded', String(!abierta));
    button.classList.toggle('open', !abierta);
}

function escaparParaHTML(texto) {
    return String(texto || '')
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
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

    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(valor).then(function() {
            alert(etiqueta.charAt(0).toUpperCase() + etiqueta.slice(1) + ' copiada');
        });
        return;
    }

    var textarea = document.createElement('textarea');
    textarea.value = valor;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
    alert(etiqueta.charAt(0).toUpperCase() + etiqueta.slice(1) + ' copiada');
}

function llamarDesdeGestionLote(celular) {
    if (!celular) {
        alert('No hay número de celular');
        return;
    }
    var numeroLimpio = String(celular).replace(/\D/g, '');
    if (!numeroLimpio) {
        alert('No hay número de celular');
        return;
    }
    window.location.href = 'tel:' + numeroLimpio;
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

    var opciones = ['Seguimiento', 'Cobranza', 'Completada', 'Recordatorio'];
    var iconosTipo = { 'Seguimiento': '📋', 'Cobranza': '💰', 'Completada': '✅', 'Recordatorio': '⏰' };
    var pillsHtml = '';
    for (var i = 0; i < opciones.length; i++) {
        var activa = opciones[i] === tipo ? ' activo' : '';
        pillsHtml += '<button type="button" class="tipo-pill' + activa + '" data-tipo="' + opciones[i] + '" onclick="seleccionarTipoMovil(this)">' + (iconosTipo[opciones[i]] || '') + ' ' + opciones[i] + '</button>';
    }

    var contenido = '';
    contenido += '<div class="modal-gestion">';
    contenido += '<h2>📋 Gestionar Solicitud #' + escaparParaHTML(solicitudId) + '</h2>';
    contenido += '<div class="modal-info">';
    contenido += '<p><strong>Nombre:</strong> ' + escaparParaHTML(sol.nombre || '—') + '</p>';
    contenido += '<p><strong>Cédula:</strong> ' + escaparParaHTML(sol.cedula || '—') + '</p>';
    contenido += '<p><strong>Celular:</strong> ' + escaparParaHTML(sol.celular || '—') + '</p>';
    contenido += '</div>';
    contenido += '<div class="modal-form">';
    contenido += '<label>📋 Tipo de Gestión:</label>';
    contenido += '<div class="tipo-pills">' + pillsHtml + '</div>';
    contenido += '<input type="hidden" id="tipo-gestion-modal" value="' + escaparParaAtributo(tipo) + '">';
    contenido += '<label id="label-observacion-modal">📝 Observación:</label>';
    contenido += '<textarea id="observacion-modal" rows="4" placeholder="Escriba su observación..."></textarea>';
    
    // Campos extra para el modo recordatorio
    contenido += '<div id="recordatorio-fields" style="display:none;margin-bottom:12px;">';
    contenido += '<label>📱 Canal:</label>';
    contenido += '<select id="recordatorio-canal"><option value="Llamada">Llamada</option><option value="Mensaje">Mensaje</option></select>';
    contenido += '<label>🕐 Fecha y hora:</label>';
    contenido += '<input type="datetime-local" id="recordatorio-fecha" min="' + valorMinimoDatetimeLocalMovil() + '">';
    contenido += '</div>';
    
    // Toggle destacar
    var destacadoActual = sol.destacado == 1;
    contenido += '<label style="display:flex;align-items:center;gap:8px;margin-bottom:12px;cursor:pointer;padding:10px 12px;background:' + (destacadoActual ? '#fffbeb' : '#f9fafb') + ';border-radius:8px;border:1px solid ' + (destacadoActual ? '#f59e0b' : '#e5e7eb') + ';">';
    contenido += '<input type="checkbox" id="toggle-destacar" ' + (destacadoActual ? 'checked' : '') + ' style="width:18px;height:18px;">';
    contenido += '<span style="font-size:13px;color:' + (destacadoActual ? '#92400e' : '#6b7280') + ';">🔥 Destacar tarjeta</span>';
    contenido += '</label>';
    
    contenido += '<div class="modal-botones">';
    contenido += '<button class="btn-cancelar" onclick="cerrarModal()">Cancelar</button>';    contenido += '<button class="btn-guardar" onclick="guardarGestionIndividual(\'' + escaparParaAtributo(solicitudId) + '\')">💾 Guardar</button>'; 
    contenido += '</div>'; 
    contenido += '</div>';
    contenido += '</div>';

    crearModal(contenido);
}

function seleccionarTipoMovil(pill) {
    if (!pill) return;
    var contenedor = pill.closest('.tipo-pills');
    if (contenedor) {
        var pills = contenedor.querySelectorAll('.tipo-pill');
        for (var i = 0; i < pills.length; i++) {
            pills[i].classList.toggle('activo', pills[i] === pill);
        }
    }
    var hidden = document.getElementById('tipo-gestion-modal');
    if (hidden) {
        hidden.value = pill.getAttribute('data-tipo') || '';
        alternarModoRecordatorioMovil(hidden);
    }
}

async function guardarGestionIndividual(solicitudId) {
    var tipo = document.getElementById('tipo-gestion-modal').value;
    var observacion = document.getElementById('observacion-modal').value.trim();
    if (tipo !== 'Recordatorio' && !observacion) { alert('Por favor escriba una observación'); return; }

    var btn = document.querySelector('.btn-guardar');
    if (btn) { btn.textContent = '💾 Guardando...'; btn.disabled = true; }

    try {
        if (tipo === 'Recordatorio') {
            var fechaRec = document.getElementById('recordatorio-fecha').value;
            if (!fechaRec) {
                alert('Seleccione la fecha y hora del recordatorio');
                return;
            }
            await guardarRecordatorioModalMovil(solicitudId, observacion, fechaRec);
            mostrarConfirmacionGestionMovil('⏰ Recordatorio programado');
            cerrarModal();
            cargarDatosGestionMovil();
            return;
        }
        var bodyLoteMovil = {
            solicitud_id: solicitudId,
            tipo_gestion: tipo,
            observacion: observacion,
            gestion_maestro_id: gestionId
        };

        var response = await fetch('/api/excel/gestiones', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(bodyLoteMovil)
        });

        var resultado = await response.json();
        if (response.ok && !resultado.error) {
            // Guardar destacado si cambió
            var checkboxDestacar = document.getElementById('toggle-destacar');
            if (checkboxDestacar) {
                var solActual = solicitudes.find(function(s) { return s.id_solicitud == solicitudId; });
                var nuevoDestacado = checkboxDestacar.checked ? 1 : 0;
                if (solActual && nuevoDestacado !== (solActual.destacado || 0)) {
                    await fetch('/api/gestiones-maestro/' + gestionId + '/solicitudes/' + encodeURIComponent(solicitudId) + '/destacar', {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ destacado: nuevoDestacado })
                    });
                }
            }
            mostrarConfirmacionGestionMovil('Una gestión más completada');
            cerrarModal();
            cargarDatosGestionMovil();
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

// Alternar destacado de una solicitud (solo anima el badge; no pinta la tarjeta)
async function toggleDestacado(solicitudId, nuevoEstado, eventRef) {
    try {
        var response = await fetch('/api/gestiones-maestro/' + gestionId + '/solicitudes/' + encodeURIComponent(solicitudId) + '/destacar', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ destacado: Number(nuevoEstado) })
        });

        var resultado = await response.json().catch(function() { return {}; });

        if (!response.ok || resultado.error) {
            alert(resultado.error || 'No se pudo actualizar el destacado');
            return;
        }

        var val = Number(nuevoEstado) === 1 ? 1 : 0;
        for (var i = 0; i < todasLasSolicitudes.length; i++) {
            if (String(todasLasSolicitudes[i].id_solicitud) === String(solicitudId)) {
                todasLasSolicitudes[i].destacado = val;
            }
        }
        for (var j = 0; j < solicitudes.length; j++) {
            if (String(solicitudes[j].id_solicitud) === String(solicitudId)) {
                solicitudes[j].destacado = val;
            }
        }

        renderizarSolicitudes(todasLasSolicitudes);

        // Animación del badge recién pintado (solo el botón, no la tarjeta)
        setTimeout(function() {
            var cards = document.querySelectorAll('.sol-card[data-sol-id="' + solicitudId + '"]');
            if (cards.length > 0) {
                var badge = cards[0].querySelector('.sol-destacado-badge');
                if (badge) {
                    badge.classList.remove('pop');
                    void badge.offsetWidth;
                    badge.classList.add('pop');
                }
            }
        }, 30);
    } catch (error) {
        console.error('[movil] Error alternando destacado:', error);
        alert('Error al actualizar el destacado');
    }
}

function verGestion(solicitudId) {
    var sol = solicitudes.find(function(s) { return s.id_solicitud == solicitudId; });
    if (!sol || !sol.gestion_id) { alert('No hay gestión registrada'); return; }

    var contenido = '';
    contenido += '<div class="modal-ver">';
    contenido += '<h2>📋 Gestión - Solicitud #' + escaparParaHTML(solicitudId) + '</h2>';
    contenido += '<div class="modal-info">';
    contenido += '<p><strong>Tipo:</strong> ' + escaparParaHTML(sol.tipo_gestion || '—') + '</p>';
    contenido += '<p><strong>Fecha:</strong> ' + escaparParaHTML(sol.fecha_gestion || '—') + '</p>';
    contenido += '<p><strong>Observación:</strong></p>';
    contenido += '<div class="modal-observacion">' + escaparParaHTML(sol.gestion_obs || 'Sin observación') + '</div>';
    contenido += '</div>';
    contenido += '<button class="btn-cerrar" onclick="cerrarModal()">Cerrar</button>';
    contenido += '</div>';

    crearModal(contenido);
}

// ============================================================================
// RECORDATORIOS DE LLAMADAS/MENSAJES (móvil)
// ============================================================================

// Valor "ahora" en formato datetime-local (hora local del navegador)
function valorMinimoDatetimeLocalMovil() {
    var d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 16);
}

// Mostrar/ocultar campos de recordatorio según el tipo seleccionado en el modal
function alternarModoRecordatorioMovil(select) {
    var block = document.getElementById('recordatorio-fields');
    if (!block) return;
    var esRecordatorio = select && select.value === 'Recordatorio';
    block.style.display = esRecordatorio ? 'block' : 'none';
    var labelObs = document.getElementById('label-observacion-modal');
    if (labelObs) {
        labelObs.textContent = esRecordatorio ? '📝 Nota (opcional):' : '📝 Observación:';
    }
}

// Guardar un recordatorio a través del endpoint de la campaña
async function guardarRecordatorioModalMovil(solicitudId, nota, fecha) {
    var canal = document.getElementById('recordatorio-canal').value;
    var response = await fetch('/api/gestiones-maestro/' + gestionId + '/recordatorios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ solicitud_id: solicitudId, canal: canal, fecha_recordatorio: fecha, nota: nota || '' })
    });
    var resultado = await response.json().catch(function() { return {}; });
    if (!response.ok || resultado.error) {
        alert('Error: ' + (resultado.error || 'Error desconocido'));
        throw new Error(resultado.error || 'Error al programar recordatorio');
    }
    return resultado;
}

// Formato compacto para el badge de la tarjeta: "Hoy 15:30" o "06/08 15:30"
function formatearHoraRecordatorioMovil(fecha) {
    if (!fecha) return '';
    var d = new Date(String(fecha).replace(' ', 'T'));
    if (isNaN(d.getTime())) return '';
    var ahora = new Date();
    var esHoy = d.getFullYear() === ahora.getFullYear() && d.getMonth() === ahora.getMonth() && d.getDate() === ahora.getDate();
    var hora = d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
    if (esHoy) return 'Hoy ' + hora;
    return d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' }) + ' ' + hora;
}

// Ver el recordatorio pendiente de una solicitud
function verRecordatorioMovil(solicitudId) {
    var sol = solicitudes.find(function(s) { return s.id_solicitud == solicitudId; });
    if (!sol || !sol.recordatorio_id) {
        alert('No hay recordatorio pendiente');
        return;
    }
    var contenido = '';
    contenido += '<div class="modal-ver">';
    contenido += '<h2>⏰ Recordatorio - Solicitud #' + escaparParaHTML(solicitudId) + '</h2>';
    contenido += '<div class="modal-info">';
    contenido += '<p><strong>Cliente:</strong> ' + escaparParaHTML(sol.nombre || '—') + '</p>';
    contenido += '<p><strong>Canal:</strong> ' + escaparParaHTML(sol.recordatorio_canal || 'Llamada') + '</p>';
    contenido += '<p><strong>Fecha:</strong> ' + escaparParaHTML(formatearHoraRecordatorioMovil(sol.recordatorio_fecha)) + '</p>';
    contenido += '<p><strong>Nota:</strong> ' + escaparParaHTML(sol.recordatorio_nota || 'Sin nota') + '</p>';
    contenido += '</div>';
    contenido += '<div class="modal-botones">';
    contenido += '<button class="btn-guardar" onclick="marcarRecordatorioHechoMovil(\'' + sol.id_solicitud + '\')">✅ Marcar hecho</button>';
    contenido += '<button class="btn-cancelar" onclick="cancelarRecordatorioMovil(\'' + sol.id_solicitud + '\')">🗑 Cancelar</button>';
    contenido += '<button class="btn-cerrar" onclick="cerrarModal()">Cerrar</button>';
    contenido += '</div>';
    contenido += '</div>';
    crearModal(contenido);
}

async function marcarRecordatorioHechoMovil(solicitudId) {
    var sol = solicitudes.find(function(s) { return s.id_solicitud == solicitudId; });
    if (!sol || !sol.recordatorio_id) return;
    await cambiarEstadoRecordatorioMovil(sol.recordatorio_id, 'hecho');
}

async function cancelarRecordatorioMovil(solicitudId) {
    var sol = solicitudes.find(function(s) { return s.id_solicitud == solicitudId; });
    if (!sol || !sol.recordatorio_id) return;
    if (!confirm('¿Cancelar este recordatorio?')) return;
    await cambiarEstadoRecordatorioMovil(sol.recordatorio_id, 'cancelado');
}

async function cambiarEstadoRecordatorioMovil(rid, estado) {
    try {
        var response = await fetch('/api/gestiones-maestro/' + gestionId + '/recordatorios/' + rid + '/estado', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ estado: estado })
        });
        var resultado = await response.json().catch(function() { return {}; });
        if (!response.ok || resultado.error) {
            alert(resultado.error || 'No se pudo actualizar el recordatorio');
            return;
        }
        cerrarModal();
        cargarDatosGestionMovil();
    } catch (error) {
        console.error('Error actualizando recordatorio:', error);
        alert('Error al actualizar el recordatorio');
    }
}

// Formato de fecha estilo WhatsApp: Hoy/Ayer/El lunes/Hace X semanas + hora (móvil)
function formatearFechaHistorialMovil(fecha) {
    if (!fecha) return '—';
    var d = new Date(fecha);
    if (isNaN(d.getTime())) return '—';
    var ahora = new Date();
    var hoy = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate());
    var dia = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    var diff = Math.round((hoy.getTime() - dia.getTime()) / 86400000);
    var hora = d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
    if (diff <= 0) return 'Hoy · ' + hora;
    if (diff === 1) return 'Ayer · ' + hora;
    if (diff < 7) return 'El ' + ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'][d.getDay()] + ' · ' + hora;
    var semanas = Math.floor(diff / 7);
    if (semanas <= 4) return 'Hace ' + (semanas === 1 ? 'una semana' : semanas + ' semanas') + ' · ' + hora;
    var meses = Math.floor(diff / 30);
    if (meses <= 11) return 'Hace ' + (meses === 1 ? 'un mes' : meses + ' meses') + ' · ' + hora;
    return d.toLocaleDateString('es-ES') + ' · ' + hora;
}

// Ver historial completo de gestiones de una solicitud (móvil)
async function verHistorial(solicitudId) {
    try {
        crearModal('<div class="modal-gestion" style="text-align:center;padding:20px;"><h2>📋 Historial</h2><p>⏳ Cargando...</p></div>');
        
        var response = await fetch('/api/gestiones-maestro/' + gestionId + '/solicitudes/' + encodeURIComponent(solicitudId) + '/historial');
        if (!response.ok) throw new Error('Error al cargar historial');
        
        var gestiones = await response.json();
        
        var sol = solicitudes.find(function(s) { return s.id_solicitud == solicitudId; });
        var nombreCliente = (sol && sol.nombre) ? sol.nombre : 'Solicitud #' + solicitudId;
        
        var contenido = '';
        contenido += '<div class="modal-gestion">';
        contenido += '<h2 class="historial-modal-titulo">📋 Historial · ' + escaparParaHTML(nombreCliente) + '</h2>';
        contenido += '<div style="color:#9ca3af;font-size:11px;margin:2px 0 8px;">Solicitud #' + solicitudId + '</div>';
        
        if (!gestiones || gestiones.length === 0) {
            contenido += '<div style="text-align:center;padding:15px;color:#6b7280;font-size:13px;">No hay gestiones registradas</div>';
        } else {
            contenido += '<div style="margin-bottom:8px;color:#6b7280;font-size:12px;">📊 Total: ' + gestiones.length + ' gestione(s)</div>';
            contenido += '<div style="max-height:40vh;overflow-y:auto;">';
            
            var coloresTipo = {
                'Pendiente': '#fef3c7',
                'Llamada': '#d1fae5',
                'WhatsApp': '#dcfce7',
                'Seguimiento': '#dbeafe',
                'Cobranza': '#fee2e2',
                'Cita': '#e0e7ff',
                'Completada': '#bbf7d0',
                'Recordatorio': '#ffedd5'
            };
            
            for (var i = 0; i < gestiones.length; i++) {
                var g = gestiones[i];
                var fecha = formatearFechaHistorialMovil(g.fecha_gestion);
                var isLast = i === gestiones.length - 1;
                var colorBadge = coloresTipo[g.tipo_gestion] || '#f3f4f6';
                
                contenido += '<div style="display:flex;gap:12px;position:relative;">';
                // Timeline dot + line
                contenido += '<div style="display:flex;flex-direction:column;align-items:center;">';
                contenido += '<div style="width:12px;height:12px;border-radius:50%;background:' + colorBadge + ';border:2px solid #9ca3af;flex-shrink:0;"></div>';
                if (!isLast) {
                    contenido += '<div style="width:2px;flex:1;background:#e5e7eb;margin:4px 0;"></div>';
                }
                contenido += '</div>';
                // Content
                contenido += '<div style="flex:1;padding-bottom:' + (isLast ? '0' : '12px') + ';">';
                contenido += '<div style="display:flex;align-items:center;gap:6px;margin-bottom:3px;flex-wrap:wrap;">';
                contenido += '<span style="background:' + colorBadge + ';padding:1px 8px;border-radius:10px;font-size:10px;font-weight:600;color:#374151;">' + escaparParaHTML(g.tipo_gestion || '—') + '</span>';
                if (g.vendedor) contenido += '<span style="font-size:10px;color:#2563eb;font-weight:600;">🏷️ ' + escaparParaHTML(g.vendedor) + '</span>';
                contenido += '<span style="font-size:10px;color:#9ca3af;">' + fecha + '</span>';
                contenido += '</div>';
                contenido += '<div style="background:#f9fafb;padding:8px 10px;border-radius:6px;font-size:12px;color:#374151;line-height:1.4;">' + escaparParaHTML(g.observacion || 'Sin observación') + '</div>';
                contenido += '</div>';
                contenido += '</div>';
            }
            
            contenido += '</div>';
        }
        
        contenido += '<div style="margin-top:12px;text-align:right;">';
        contenido += '<button class="btn-cerrar" onclick="cerrarModal()" style="padding:8px 20px;background:#f3f4f6;border:none;border-radius:8px;cursor:pointer;font-size:14px;">Cerrar</button>';
        contenido += '</div>';
        contenido += '</div>';
        
        cerrarModal();
        crearModal(contenido, { alto: '55vh' });
        
    } catch (error) {
        console.error('[movil] Error cargando historial:', error);
        cerrarModal();
        alert('Error al cargar el historial');
    }
}

function crearModal(contenido, opciones) {
    var modalExistente = document.getElementById('modal-generico');
    if (modalExistente) modalExistente.remove();

    var overlay = document.createElement('div');
    overlay.id = 'modal-generico';
    overlay.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 9999; display: flex; align-items: center; justify-content: center;';

    var modal = document.createElement('div');
    modal.style.cssText = 'background: white; border-radius: 16px; max-width: 600px; width: 90%; max-height: 90vh; overflow: auto; box-shadow: 0 20px 60px rgba(0,0,0,0.4); padding: 20px;';
    if (opciones && opciones.alto) modal.style.maxHeight = opciones.alto;
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

// ================== QUITAR SOLICITUD DE CAMPAÑA (MÓVIL) ==================

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
    contenido += '<ul style="padding-left: 20px; margin: 8px 0; font-size: 13px;">';
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
            await cargarDatosGestionMovil();
            await cargarListaCampanas();
        } else {
            alert('Error: ' + (resultado.error || 'Error al quitar solicitud'));
            if (btn) { btn.textContent = '❌ Quitar'; btn.disabled = false; }
        }
    } catch (error) {
        console.error('[movil] Error quitando solicitud:', error);
        alert('Error al quitar la solicitud');
        if (btn) { btn.textContent = '❌ Quitar'; btn.disabled = false; }
    }
}

// ================== FLAG "YA NO APLICA PARA CRÉDITO" (MÓVIL) ==================

function confirmarMarcarNoAplicaCreditoMovil(solicitudId, nuevoValor) {
    if (nuevoValor === 1) {
        // Revertir: directo (no vuelve a ninguna campaña)
        marcarNoAplicaCreditoMovil(solicitudId, 1);
        return;
    }
    
    var overlay = document.createElement('div');
    overlay.id = 'modal-no-aplica-credito-movil';
    overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.4);z-index:10000;display:flex;align-items:flex-end;justify-content:center;animation:fadeIn 0.2s ease;';
    
    var sheet = document.createElement('div');
    sheet.style.cssText = 'background:white;width:100%;max-height:70vh;border-radius:20px 20px 0 0;display:flex;flex-direction:column;overflow:hidden;animation:slideUp 0.3s ease;box-shadow:0 -10px 40px rgba(0,0,0,0.15);';
    
    var nombreCampana = (datosGestion && datosGestion.nombre) ? datosGestion.nombre : '—';
    
    sheet.innerHTML = 
        '<div style="display:flex;align-items:center;justify-content:space-between;padding:16px 18px 12px;border-bottom:1px solid #e5e7eb;flex-shrink:0;">' +
            '<h2 style="margin:0;font-size:17px;color:#dc2626;">👎 No aplica para crédito</h2>' +
            '<button onclick="cerrarModalNoAplicaCreditoMovil()" style="background:#f3f4f6;border:none;border-radius:50%;width:32px;height:32px;font-size:16px;cursor:pointer;display:flex;align-items:center;justify-content:center;color:#6b7280;">✕</button>' +
        '</div>' +
        '<div style="padding:16px 18px 20px;overflow-y:auto;flex:1;">' +
            '<div style="background:#fef2f2;padding:14px;border-radius:12px;margin-bottom:16px;">' +
                '<p style="margin:0 0 6px;font-size:14px;color:#991b1b;"><strong>Solicitud:</strong> #' + solicitudId + '</p>' +
                '<p style="margin:0;font-size:13px;color:#991b1b;"><strong>Campaña:</strong> ' + escaparParaHTML(nombreCampana) + '</p>' +
            '</div>' +
            '<div style="background:#fef3c7;border:1px solid #f59e0b;padding:14px;border-radius:10px;">' +
                '<p style="margin:0 0 6px;font-weight:bold;font-size:13px;color:#92400e;">⚠️ ¿Estás seguro?</p>' +
                '<ul style="margin:0;padding-left:18px;font-size:12px;color:#92400e;">' +
                    '<li style="margin-bottom:4px;">Se marcará como <strong>ya no aplica para crédito</strong>.</li>' +
                    '<li style="margin-bottom:4px;">Será <strong>quitada de esta campaña</strong>.</li>' +
                    '<li style="margin-bottom:4px;">Las gestiones registradas <strong>NO</strong> se eliminarán.</li>' +
                    '<li>Puedes revertirlo desde el listado de solicitudes.</li>' +
                '</ul>' +
            '</div>' +
            '<div style="display:flex;gap:10px;margin-top:20px;">' +
                '<button type="button" onclick="cerrarModalNoAplicaCreditoMovil()" style="flex:1;padding:14px;background:#f3f4f6;color:#374151;border:none;border-radius:10px;font-size:15px;font-weight:600;cursor:pointer;">Cancelar</button>' +
                '<button type="button" id="btn-confirmar-no-aplica-movil" onclick="marcarNoAplicaCreditoMovil(' + solicitudId + ', 0)" style="flex:1;padding:14px;background:#dc2626;color:white;border:none;border-radius:10px;font-size:15px;font-weight:700;cursor:pointer;">👎 Marcar</button>' +
            '</div>' +
        '</div>';
    
    overlay.appendChild(sheet);
    document.body.appendChild(overlay);
    
    overlay.addEventListener('click', function(e) {
        if (e.target === overlay) cerrarModalNoAplicaCreditoMovil();
    });
}

function cerrarModalNoAplicaCreditoMovil() {
    var modal = document.getElementById('modal-no-aplica-credito-movil');
    if (modal) {
        modal.style.transition = 'opacity 0.2s ease';
        modal.style.opacity = '0';
        setTimeout(function() { modal.remove(); }, 200);
    }
}

async function marcarNoAplicaCreditoMovil(solicitudId, valor) {
    var btn = document.getElementById('btn-confirmar-no-aplica-movil');
    if (btn) { btn.textContent = '⏳ Procesando...'; btn.disabled = true; }
    
    try {
        var response = await fetch('/api/gestiones-maestro/' + gestionId + '/solicitudes/' + encodeURIComponent(solicitudId) + '/no-aplica-credito', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ no_aplica_credito: Number(valor) })
        });
        
        var resultado = await response.json().catch(function() { return {}; });
        
        if (!response.ok || resultado.error) {
            alert(resultado.error || 'No se pudo actualizar la solicitud');
            if (btn) { btn.textContent = '👎 Marcar'; btn.disabled = false; }
            return;
        }
        
        cerrarModalNoAplicaCreditoMovil();
        if (Number(valor) === 0) {
            alert('✅ Marcada como "ya no aplica para crédito" y quitada de la campaña');
        } else {
            alert('✅ Solicitud restaurada: aplica para crédito');
        }
        await cargarDatosGestionMovil();
        await cargarListaCampanas();
    } catch (error) {
        console.error('[movil] Error marcando no aplica crédito:', error);
        alert('Error al actualizar la solicitud');
        if (btn) { btn.textContent = '👎 Marcar'; btn.disabled = false; }
    }
}

// ================== AGREGAR SOLICITUDES A CAMPAÑA (MÓVIL - REDISEÑADO) ==================

function abrirModalAgregarSolicitudesMovil() {
    // Crear overlay y bottom sheet
    var overlay = document.createElement('div');
    overlay.id = 'modal-agregar-movil';
    overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.4);z-index:10000;display:flex;align-items:flex-end;justify-content:center;animation:fadeIn 0.2s ease;';
    
    var sheet = document.createElement('div');
    sheet.style.cssText = 'background:white;width:100%;max-height:85vh;border-radius:20px 20px 0 0;display:flex;flex-direction:column;overflow:hidden;animation:slideUp 0.3s ease;box-shadow:0 -10px 40px rgba(0,0,0,0.15);';
    
    // === HEADER ===
    sheet.innerHTML = '<div style="display:flex;align-items:center;justify-content:space-between;padding:16px 18px 12px;border-bottom:1px solid #e5e7eb;flex-shrink:0;">' +
        '<h2 style="margin:0;font-size:17px;color:#1f2937;">➕ Agregar Solicitudes</h2>' +
        '<button onclick="cerrarModalAgregarMovil()" style="background:#f3f4f6;border:none;border-radius:50%;width:32px;height:32px;font-size:16px;cursor:pointer;display:flex;align-items:center;justify-content:center;color:#6b7280;">✕</button>' +
        '</div>' +
        // === BARRA DE BÚSQUEDA ===
        '<div style="padding:12px 18px 8px;flex-shrink:0;">' +
        '<input type="text" id="busqueda-agregar" autofocus placeholder="🔍 Buscar por nombre, cédula o teléfono..." style="width:100%;padding:14px 16px;border:2px solid #e5e7eb;border-radius:12px;font-size:16px;outline:none;box-sizing:border-box;transition:border-color 0.2s;" oninput="buscarSolicitudesParaAgregarMovil(event)" onfocus="this.style.borderColor=\'#6366f1\'" onblur="this.style.borderColor=\'#e5e7eb\'">' +
        '</div>' +
        // === CONTADOR DE SELECCIONADOS ===
        '<div id="seleccionados-agregar" style="display:none;padding:8px 18px;flex-shrink:0;">' +
        '<div style="background:#eef2ff;padding:8px 14px;border-radius:10px;font-size:13px;color:#4338ca;font-weight:600;">✅ <span id="contador-seleccionados">0</span> solicitude(s) seleccionada(s)</div>' +
        '</div>' +
        // === LISTA DE RESULTADOS ===
        '<div id="resultados-agregar" style="flex:1;overflow-y:auto;padding:8px 18px;min-height:120px;">' +
        '<div style="text-align:center;padding:40px 10px;color:#9ca3af;font-size:14px;">🔍 Escribe al menos 2 caracteres para buscar</div>' +
        '</div>' +
        // === BOTÓN AGREGAR (STICKY BOTTOM) ===
        '<div style="padding:12px 18px 20px;border-top:1px solid #e5e7eb;flex-shrink:0;">' +
        '<button id="btn-agregar-solicitudes" onclick="agregarSolicitudesSeleccionadasMovil()" disabled style="width:100%;padding:16px;background:linear-gradient(135deg,#6366f1,#4f46e5);color:white;border:none;border-radius:12px;font-size:16px;font-weight:700;cursor:pointer;transition:all 0.2s;opacity:0.5;">➕ Agregar (0)</button>' +
        '</div>';
    
    overlay.appendChild(sheet);
    document.body.appendChild(overlay);
    
    // Cerrar al tocar el overlay (fuera del sheet)
    overlay.addEventListener('click', function(e) {
        if (e.target === overlay) cerrarModalAgregarMovil();
    });
    
    // Auto-focus al input después de que el DOM se actualice
    setTimeout(function() {
        var input = document.getElementById('busqueda-agregar');
        if (input) input.focus();
    }, 300);
}

function cerrarModalAgregarMovil() {
    var modal = document.getElementById('modal-agregar-movil');
    if (modal) {
        modal.style.transition = 'opacity 0.2s ease';
        modal.style.opacity = '0';
        setTimeout(function() { modal.remove(); }, 200);
    }
    // Limpiar selecciones
    solicitudesSeleccionadas = {};
}

// Agregar keyframes animation al cargar la página
(function() {
    var style = document.createElement('style');
    style.textContent = '@keyframes slideUp { from { transform:translateY(100%); } to { transform:translateY(0); } } @keyframes fadeIn { from { opacity:0; } to { opacity:1; } }';
    document.head.appendChild(style);
})();

var solicitudesDisponibles = [];
var solicitudesSeleccionadas = {};

async function buscarSolicitudesParaAgregarMovil(event) {
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
            console.error('[movil] Error parseando solicitudes_ids:', e);
        }
        
        var lista = Array.isArray(data) ? data : (data.data || []);
        solicitudesDisponibles = [];
        
        for (var i = 0; i < lista.length; i++) {
            var sol = lista[i];
            var idSol = sol.id_solicitud || sol.id;
            // Excluir las que ya están en la campaña y las marcadas como "ya no aplica para crédito"
            if (idsEnCampana.indexOf(idSol) === -1 && sol.no_aplica_credito != 0) {
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
            
            html += '<div class="agregar-item ' + isSelected + '" onclick="toggleSeleccionSolicitudMovil(' + solId + ')">';
            html += '<div class="agregar-item-check">' + (isSelected ? '✅' : '⬜') + '</div>';
            html += '<div class="agregar-item-info">';
            html += '<div class="agregar-item-nombre">#' + solId + ' - ' + (sol.nombre || 'Sin nombre') + '</div>';
            html += '<div class="agregar-item-datos">🆔 ' + (sol.cedula || '—') + ' | 📱 ' + (sol.celular || '—') + '</div>';
            html += '</div>';
            html += '</div>';
        }
        
        resultadosContainer.innerHTML = html;
        actualizarBotonAgregarMovil();
        
    } catch (error) {
        console.error('[movil] Error en búsqueda:', error);
        resultadosContainer.innerHTML = '<div class="agregar-error">Error al buscar: ' + error.message + '</div>';
    }
}

function toggleSeleccionSolicitudMovil(solicitudId) {
    if (solicitudesSeleccionadas[solicitudId]) {
        delete solicitudesSeleccionadas[solicitudId];
    } else {
        solicitudesSeleccionadas[solicitudId] = true;
    }
    
    var items = document.querySelectorAll('.agregar-item');
    items.forEach(function(item) {
        var onclick = item.getAttribute('onclick') || '';
        var match = onclick.match(/toggleSeleccionSolicitudMovil\((\d+)\)/);
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
    
    actualizarBotonAgregarMovil();
}

function actualizarBotonAgregarMovil() {
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

async function agregarSolicitudesSeleccionadasMovil() {
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
            cerrarModalAgregarMovil();
            await cargarDatosGestionMovil();
            await cargarListaCampanas();
        } else {
            alert('Error: ' + (resultado.error || 'Error al agregar solicitudes'));
            if (btn) { btn.textContent = '➕ Agregar (' + ids.length + ')'; btn.disabled = false; }
        }
    } catch (error) {
        console.error('[movil] Error agregando solicitudes:', error);
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

// ================== EDITAR CAMPAÑA (MÓVIL) ==================

function abrirModalEditarCampanaMovil(id, nombre, descripcion, fechaLimite, estado) {
    var nombreEsc = escaparParaHTML(nombre);
    var descEsc = escaparParaHTML(descripcion);
    
    var overlay = document.createElement('div');
    overlay.id = 'modal-editar-campana-movil';
    overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.4);z-index:10000;display:flex;align-items:flex-end;justify-content:center;animation:fadeIn 0.2s ease;';
    
    var sheet = document.createElement('div');
    sheet.style.cssText = 'background:white;width:100%;max-height:80vh;border-radius:20px 20px 0 0;display:flex;flex-direction:column;overflow:hidden;animation:slideUp 0.3s ease;box-shadow:0 -10px 40px rgba(0,0,0,0.15);';
    
    sheet.innerHTML = 
        '<div style="display:flex;align-items:center;justify-content:space-between;padding:16px 18px 12px;border-bottom:1px solid #e5e7eb;flex-shrink:0;">' +
            '<h2 style="margin:0;font-size:17px;color:#1f2937;">✏️ Editar Campaña</h2>' +
            '<button onclick="cerrarModalEditarCampanaMovil()" style="background:#f3f4f6;border:none;border-radius:50%;width:32px;height:32px;font-size:16px;cursor:pointer;display:flex;align-items:center;justify-content:center;color:#6b7280;">✕</button>' +
        '</div>' +
        '<div style="padding:16px 18px 20px;overflow-y:auto;flex:1;">' +
            '<form id="form-editar-campana-movil" onsubmit="event.preventDefault(); guardarEdicionCampanaMovil(' + id + ')">' +
            '<label style="display:block;font-weight:600;font-size:13px;color:#374151;margin-bottom:6px;">📋 Nombre de la campaña:</label>' +
            '<input type="text" id="edit-nombre-movil" value="' + nombreEsc + '" placeholder="Nombre de la campaña" required style="width:100%;padding:14px 16px;border:2px solid #e5e7eb;border-radius:10px;font-size:15px;margin-bottom:16px;box-sizing:border-box;outline:none;transition:border-color 0.2s;" onfocus="this.style.borderColor=\'#6366f1\'" onblur="this.style.borderColor=\'#e5e7eb\'">' +
            
            '<label style="display:block;font-weight:600;font-size:13px;color:#374151;margin-bottom:6px;">📝 Descripción (opcional):</label>' +
            '<textarea id="edit-descripcion-movil" rows="3" placeholder="Descripción de la campaña..." style="width:100%;padding:14px 16px;border:2px solid #e5e7eb;border-radius:10px;font-size:15px;margin-bottom:16px;box-sizing:border-box;font-family:inherit;resize:vertical;outline:none;transition:border-color 0.2s;" onfocus="this.style.borderColor=\'#6366f1\'" onblur="this.style.borderColor=\'#e5e7eb\'">' + descEsc + '</textarea>' +
            
            '<label style="display:block;font-weight:600;font-size:13px;color:#374151;margin-bottom:6px;">📅 Fecha límite (opcional):</label>' +
            '<input type="date" id="edit-fecha-limite-movil" value="' + fechaLimite + '" style="width:100%;padding:14px 16px;border:2px solid #e5e7eb;border-radius:10px;font-size:15px;margin-bottom:16px;box-sizing:border-box;outline:none;transition:border-color 0.2s;" onfocus="this.style.borderColor=\'#6366f1\'" onblur="this.style.borderColor=\'#e5e7eb\'">' +
            
            '<label style="display:block;font-weight:600;font-size:13px;color:#374151;margin-bottom:6px;">📊 Estado:</label>' +
            '<div style="display:flex;gap:10px;margin-bottom:8px;">' +
                '<label style="flex:1;display:flex;align-items:center;justify-content:center;gap:6px;padding:12px 16px;background:' + (estado === 'Activa' ? '#eef2ff' : '#f9fafb') + ';border:2px solid ' + (estado === 'Activa' ? '#6366f1' : '#e5e7eb') + ';border-radius:10px;cursor:pointer;transition:all 0.2s;" onclick="seleccionarEstadoMovil(\'Activa\')">' +
                    '<span style="font-size:18px;">🟢</span>' +
                    '<span style="font-weight:600;font-size:14px;color:' + (estado === 'Activa' ? '#4338ca' : '#6b7280') + '">Activa</span>' +
                '</label>' +
                '<label style="flex:1;display:flex;align-items:center;justify-content:center;gap:6px;padding:12px 16px;background:' + (estado === 'Completada' ? '#eef2ff' : '#f9fafb') + ';border:2px solid ' + (estado === 'Completada' ? '#6366f1' : '#e5e7eb') + ';border-radius:10px;cursor:pointer;transition:all 0.2s;" onclick="seleccionarEstadoMovil(\'Completada\')">' +
                    '<span style="font-size:18px;">✅</span>' +
                    '<span style="font-weight:600;font-size:14px;color:' + (estado === 'Completada' ? '#4338ca' : '#6b7280') + '">Completada</span>' +
                '</label>' +
            '</div>' +
            '<input type="hidden" id="edit-estado-movil" value="' + estado + '">' +
            
            '<div style="display:flex;gap:10px;margin-top:20px;">' +
                '<button type="button" onclick="cerrarModalEditarCampanaMovil()" style="flex:1;padding:14px;background:#f3f4f6;color:#374151;border:none;border-radius:10px;font-size:15px;font-weight:600;cursor:pointer;">Cancelar</button>' +
                '<button type="submit" style="flex:1;padding:14px;background:linear-gradient(135deg,#6366f1,#4f46e5);color:white;border:none;border-radius:10px;font-size:15px;font-weight:700;cursor:pointer;">💾 Guardar</button>' +
            '</div>' +
            '</form>' +
        '</div>';
    
    overlay.appendChild(sheet);
    document.body.appendChild(overlay);
    
    overlay.addEventListener('click', function(e) {
        if (e.target === overlay) cerrarModalEditarCampanaMovil();
    });
}

function cerrarModalEditarCampanaMovil() {
    var modal = document.getElementById('modal-editar-campana-movil');
    if (modal) {
        modal.style.transition = 'opacity 0.2s ease';
        modal.style.opacity = '0';
        setTimeout(function() { modal.remove(); }, 200);
    }
}

function seleccionarEstadoMovil(estado) {
    document.getElementById('edit-estado-movil').value = estado;
    // Actualizar estilos visuales
    var labels = document.querySelectorAll('#modal-editar-campana-movil label[onclick^="seleccionarEstadoMovil"]');
    labels.forEach(function(label) {
        var onclick = label.getAttribute('onclick') || '';
        var isSelected = onclick.indexOf("'" + estado + "'") !== -1;
        if (isSelected) {
            label.style.background = '#eef2ff';
            label.style.borderColor = '#6366f1';
            var span = label.querySelector('span:last-child');
            if (span) span.style.color = '#4338ca';
        } else {
            label.style.background = '#f9fafb';
            label.style.borderColor = '#e5e7eb';
            var span = label.querySelector('span:last-child');
            if (span) span.style.color = '#6b7280';
        }
    });
}

async function guardarEdicionCampanaMovil(id) {
    var nombre = document.getElementById('edit-nombre-movil').value.trim();
    var descripcion = document.getElementById('edit-descripcion-movil').value.trim();
    var fechaLimite = document.getElementById('edit-fecha-limite-movil').value;
    var estado = document.getElementById('edit-estado-movil').value;
    
    if (!nombre) {
        alert('El nombre de la campaña es requerido');
        return;
    }
    
    // Deshabilitar botones
    var submitBtn = document.querySelector('#form-editar-campana-movil button[type="submit"]');
    var cancelBtn = document.querySelector('#form-editar-campana-movil button[type="button"]');
    if (submitBtn) { submitBtn.textContent = '⏳ Guardando...'; submitBtn.disabled = true; }
    if (cancelBtn) cancelBtn.disabled = true;
    
    try {
        var response = await fetch('/api/gestiones-maestro/' + id, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                nombre: nombre,
                descripcion: descripcion,
                fecha_limite: fechaLimite || null,
                estado: estado
            })
        });
        
        var resultado = await response.json();
        
        if (response.ok && !resultado.error) {
            alert('✅ Campaña actualizada correctamente');
            cerrarModalEditarCampanaMovil();
            await cargarListaCampanas();
            if (String(gestionId) === String(id)) {
                if (datosGestion) {
                    datosGestion.nombre = nombre;
                    datosGestion.estado = estado;
                }
                aplicarEstadoSemaforoCompletadaMovil();
                actualizarSemaforoMovil();
                renderizarSolicitudes(todasLasSolicitudes);
                ajustarStickySemaforo();
            }
        } else {
            alert('Error: ' + (resultado.error || 'Error al actualizar campaña'));
            if (submitBtn) { submitBtn.textContent = '💾 Guardar'; submitBtn.disabled = false; }
            if (cancelBtn) cancelBtn.disabled = false;
        }
    } catch (error) {
        console.error('[movil] Error editando campaña:', error);
        alert('Error al actualizar la campaña');
        if (submitBtn) { submitBtn.textContent = '💾 Guardar'; submitBtn.disabled = false; }
        if (cancelBtn) cancelBtn.disabled = false;
    }
}

// ================== FIN EDITAR CAMPAÑA (MÓVIL) ==================

// ================== ELIMINAR CAMPAÑA (MÓVIL) ==================

function confirmarEliminarCampañaMovil(id, nombre, total, gestionadas) {
    var pendientes = total - gestionadas;
    
    var overlay = document.createElement('div');
    overlay.id = 'modal-eliminar-campana-movil';
    overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.4);z-index:10000;display:flex;align-items:flex-end;justify-content:center;animation:fadeIn 0.2s ease;';
    
    var sheet = document.createElement('div');
    sheet.style.cssText = 'background:white;width:100%;max-height:70vh;border-radius:20px 20px 0 0;display:flex;flex-direction:column;overflow:hidden;animation:slideUp 0.3s ease;box-shadow:0 -10px 40px rgba(0,0,0,0.15);';
    
    var nombreEsc = escaparParaHTML(nombre);
    
    sheet.innerHTML = 
        '<div style="display:flex;align-items:center;justify-content:space-between;padding:16px 18px 12px;border-bottom:1px solid #e5e7eb;flex-shrink:0;">' +
            '<h2 style="margin:0;font-size:17px;color:#dc2626;">🗑️ Eliminar Campaña</h2>' +
            '<button onclick="cerrarModalEliminarCampanaMovil()" style="background:#f3f4f6;border:none;border-radius:50%;width:32px;height:32px;font-size:16px;cursor:pointer;display:flex;align-items:center;justify-content:center;color:#6b7280;">✕</button>' +
        '</div>' +
        '<div style="padding:16px 18px 20px;overflow-y:auto;flex:1;">' +
            '<div style="background:#fef2f2;padding:16px;border-radius:12px;margin-bottom:16px;">' +
                '<p style="margin:0 0 8px;font-size:14px;color:#991b1b;"><strong>Campaña:</strong> ' + nombreEsc + '</p>' +
                '<p style="margin:0 0 8px;font-size:13px;color:#991b1b;">📄 Total solicitudes: ' + total + '</p>' +
                '<p style="margin:0 0 8px;font-size:13px;color:#991b1b;">✓ Gestionadas: ' + gestionadas + '</p>' +
                '<p style="margin:0;font-size:13px;color:#991b1b;">⏳ Pendientes: ' + pendientes + '</p>' +
            '</div>' +
            '<div style="background:#fef3c7;border:1px solid #f59e0b;padding:14px;border-radius:10px;margin-bottom:16px;">' +
                '<p style="margin:0 0 6px;font-weight:bold;font-size:13px;color:#92400e;">⚠️ IMPORTANTE:</p>' +
                '<ul style="margin:0;padding-left:18px;font-size:12px;color:#92400e;">' +
                    '<li style="margin-bottom:4px;">El historial de <strong>gestiones</strong> de las solicitudes <strong>NO se eliminará</strong>: quedará en el historial general de cada solicitud.</li>' +
                    '<li style="margin-bottom:4px;">Esta acción es <strong>IRREVERSIBLE</strong>.</li>' +
                    '<li>Los datos de las solicitudes originales NO se eliminarán.</li>' +
                '</ul>' +
            '</div>' +
            '<div style="display:flex;gap:10px;margin-top:20px;">' +
                '<button type="button" onclick="cerrarModalEliminarCampanaMovil()" style="flex:1;padding:14px;background:#f3f4f6;color:#374151;border:none;border-radius:10px;font-size:15px;font-weight:600;cursor:pointer;">Cancelar</button>' +
                '<button type="button" id="btn-eliminar-campana-movil" onclick="eliminarCampañaMovil(' + id + ')" style="flex:1;padding:14px;background:#dc2626;color:white;border:none;border-radius:10px;font-size:15px;font-weight:700;cursor:pointer;">🗑️ Eliminar</button>' +
            '</div>' +
        '</div>';
    
    overlay.appendChild(sheet);
    document.body.appendChild(overlay);
    
    overlay.addEventListener('click', function(e) {
        if (e.target === overlay) cerrarModalEliminarCampanaMovil();
    });
}

function cerrarModalEliminarCampanaMovil() {
    var modal = document.getElementById('modal-eliminar-campana-movil');
    if (modal) {
        modal.style.transition = 'opacity 0.2s ease';
        modal.style.opacity = '0';
        setTimeout(function() { modal.remove(); }, 200);
    }
}

async function eliminarCampañaMovil(id) {
    var btn = document.getElementById('btn-eliminar-campana-movil');
    if (btn) { btn.textContent = '⏳ Eliminando...'; btn.disabled = true; }
    
    try {
        var response = await fetch('/api/gestiones-maestro/' + id, {
            method: 'DELETE'
        });
        
        var resultado = await response.json();
        
        if (response.ok && !resultado.error) {
            alert('✅ Campaña eliminada correctamente');
            cerrarModalEliminarCampanaMovil();
            
            // Si era la campaña activa, recargar sin ID
            if (String(gestionId) === String(id)) {
                window.location.href = '/m/gestion-lote';
            } else {
                await cargarListaCampanas();
            }
        } else {
            alert('Error: ' + (resultado.error || 'Error al eliminar'));
            if (btn) { btn.textContent = '🗑️ Eliminar'; btn.disabled = false; }
        }
    } catch (error) {
        console.error('[movil] Error eliminando campaña:', error);
        alert('Error al eliminar la campaña');
        if (btn) { btn.textContent = '🗑️ Eliminar'; btn.disabled = false; }
    }
}

// ================== FIN ELIMINAR CAMPAÑA (MÓVIL) ==================

// ================== BOTTOM SHEET DE ACCIONES DE CAMPAÑA ==================

// Variable para evitar abrir múltiples bottom sheets
var _bottomSheetAbierto = false;

function abrirBottomSheetCampana(id, nombre, total, gestionadas, descripcion, fechaLimite, estado) {
    if (_bottomSheetAbierto) return;
    _bottomSheetAbierto = true;
    
    try {
        var pendientes = total - gestionadas;
        var nombreEsc = escaparParaHTML(nombre);
        var descEsc = escaparParaHTML(descripcion || '');
        var estadoActual = estado || 'Activa';
        
        // Construir items del menú según el rol
        var itemsHTML = '';
        
        // Editar campaña (siempre visible) — pasa todos los datos reales
        itemsHTML += '<button class="campaña-bs-item" onclick="cerrarBottomSheetCampana(); abrirModalEditarCampanaMovil(' + id + ', \'' + escaparParaAtributo(nombre) + '\', \'' + escaparParaAtributo(descripcion || '') + '\', \'' + (fechaLimite || '') + '\', \'' + estadoActual + '\')">';
        itemsHTML += '  <span class="campaña-bs-item-icon">✏️</span>';
        itemsHTML += '  <span class="campaña-bs-item-label">Editar campaña</span>';
        itemsHTML += '</button>';
    
    // Asignar a agente (solo líder) — sin setTimeout
    if (_esLider) {
        itemsHTML += '<button class="campaña-bs-item" onclick="cerrarBottomSheetCampana(); abrirModalAsignarAgenteMovil(' + id + ', \'' + escaparParaAtributo(nombre) + '\')">';
        itemsHTML += '  <span class="campaña-bs-item-icon">👤</span>';
        itemsHTML += '  <span class="campaña-bs-item-label">Asignar a agente</span>';
        itemsHTML += '</button>';
    }
    
    // Agregar solicitudes (si la campaña activa es esta)
    if (gestionId && String(gestionId) === String(id) && typeof abrirModalAgregarSolicitudesMovil === 'function') {
        itemsHTML += '<button class="campaña-bs-item" onclick="cerrarBottomSheetCampana(); abrirModalAgregarSolicitudesMovil()">';
        itemsHTML += '  <span class="campaña-bs-item-icon">➕</span>';
        itemsHTML += '  <span class="campaña-bs-item-label">Agregar solicitudes</span>';
        itemsHTML += '</button>';
    }

    // Exportar Excel (siempre visible) — sin setTimeout
    itemsHTML += '<button class="campaña-bs-item" onclick="cerrarBottomSheetCampana(); if(typeof exportarExcelGestionLote === \'function\') exportarExcelGestionLote()">';
    itemsHTML += '  <span class="campaña-bs-item-icon">📥</span>';
    itemsHTML += '  <span class="campaña-bs-item-label">Exportar Excel</span>';
    itemsHTML += '</button>';
    
    // Divider antes de eliminar
    itemsHTML += '<div class="campaña-bs-divider"></div>';
    
    // Eliminar campaña (danger) — sin setTimeout
    itemsHTML += '<button class="campaña-bs-item campaña-bs-item-danger" onclick="cerrarBottomSheetCampana(); confirmarEliminarCampañaMovil(' + id + ', \'' + escaparParaAtributo(nombre) + '\', ' + total + ', ' + gestionadas + ')">';
    itemsHTML += '  <span class="campaña-bs-item-icon">🗑️</span>';
    itemsHTML += '  <span class="campaña-bs-item-label">Eliminar campaña</span>';
    itemsHTML += '</button>';
    
    var overlay = document.getElementById('campaña-bs-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'campaña-bs-overlay';
        overlay.className = 'campaña-bs-overlay';
        document.body.appendChild(overlay);
    }
    
    overlay.innerHTML = '' +
        '<div class="campaña-bs-overlay" id="campaña-bs-overlay-inner" onclick="cerrarBottomSheetCampana()"></div>' +
        '<div class="campaña-bs-sheet" id="campaña-bs-sheet">' +
            '<div class="campaña-bs-handle"></div>' +
            '<div class="campaña-bs-header">' +
                '<div>' +
                    '<div class="campaña-bs-header-title">' + nombreEsc + '</div>' +
                    '<div class="campaña-bs-header-sub">📄 ' + total + ' · ✓ ' + gestionadas + ' · ⏳ ' + pendientes + '</div>' +
                '</div>' +
                '<button class="campaña-bs-close" onclick="cerrarBottomSheetCampana()">✕</button>' +
            '</div>' +
            '<div class="campaña-bs-body">' +
                itemsHTML +
            '</div>' +
        '</div>';
    
    // Animar entrada
    requestAnimationFrame(function() {
        overlay.classList.add('visible');
        var innerOverlay = document.getElementById('campaña-bs-overlay-inner');
        var sheet = document.getElementById('campaña-bs-sheet');
        if (innerOverlay) innerOverlay.classList.add('visible');
        if (sheet) sheet.classList.add('visible');
    });
    
    // Keyboard escape
    var escapeHandler = function(e) {
        if (e.key === 'Escape') {
            cerrarBottomSheetCampana();
            document.removeEventListener('keydown', escapeHandler);
        }
    };
    document.addEventListener('keydown', escapeHandler);
    overlay._escapeHandler = escapeHandler;
    } catch (e) {
        console.error('[BottomSheet] Error:', e);
        _bottomSheetAbierto = false; // Liberar flag si hay error
    }
}

function cerrarBottomSheetCampana() {
    var innerOverlay = document.getElementById('campaña-bs-overlay-inner');
    var sheet = document.getElementById('campaña-bs-sheet');
    var overlay = document.getElementById('campaña-bs-overlay');
    
    if (innerOverlay) innerOverlay.classList.remove('visible');
    if (sheet) sheet.classList.remove('visible');
    if (overlay) overlay.classList.remove('visible');
    
    _bottomSheetAbierto = false;
    
    // Limpiar overlay después de animación
    setTimeout(function() {
        if (overlay) {
            if (overlay._escapeHandler) {
                document.removeEventListener('keydown', overlay._escapeHandler);
            }
            overlay.innerHTML = '';
        }
    }, 300);
}

// ================== ASIGNAR A AGENTE (MÓVIL) — NUEVO ==================

function abrirModalAsignarAgenteMovil(campaniaId, nombreCampania) {
    if (!_esLider || _agentesEquipo.length === 0) {
        alert('No tienes agentes en tu equipo para asignar');
        return;
    }
    
    // Buscar la campaña para obtener asignado actual
    var campania = null;
    for (var i = 0; i < campañas.length; i++) {
        if (String(campañas[i].id) === String(campaniaId)) {
            campania = campañas[i];
            break;
        }
    }
    var asignadoActual = campania ? campania.asignado_a : null;
    
    var nombreEsc = escaparParaHTML(nombreCampania);
    
    // Construir lista de agentes
    var listaAgentes = '';
    
    // Opción quitar asignación si ya tiene una
    if (asignadoActual) {
        listaAgentes += '<button class="campaña-bs-item" onclick="cerrarBottomSheetCampana(); setTimeout(function() { quitarAsignacionAgenteMovil(' + campaniaId + '); }, 250)" style="color:#dc2626;">' +
            '<span class="campaña-bs-item-icon">❌</span>' +
            '<span class="campaña-bs-item-label">Quitar asignación actual</span>' +
            '</button>' +
            '<div class="campaña-bs-divider"></div>';
    }
    
    for (var i = 0; i < _agentesEquipo.length; i++) {
        var agente = _agentesEquipo[i];
        var esAsignado = String(agente.id) === String(asignadoActual);
        var isActive = agente.is_active !== false;
        
        if (!isActive) continue; // Omitir agentes inactivos
        
        var nombreAgente = escaparParaHTML(agente.nombre || agente.username || 'Agente #' + agente.id);
        var asignadas = parseInt(agente.asignadas || 0);
        
        listaAgentes += '<button class="campaña-bs-item' + (esAsignado ? '" style="background:#ecfdf5;color:#065f46;"' : '"') + ' onclick="cerrarBottomSheetCampana(); setTimeout(function() { asignarAgenteMovil(' + campaniaId + ', ' + agente.id + '); }, 250)">';
        listaAgentes += '  <span class="campaña-bs-item-icon">' + (esAsignado ? '✅' : '👤') + '</span>';
        listaAgentes += '  <span class="campaña-bs-item-label">' + nombreAgente + ' · ' + asignadas + ' asignadas' + (esAsignado ? ' (actual)' : '') + '</span>';
        listaAgentes += '</button>';
    }
    
    if (!listaAgentes) {
        alert('No hay agentes activos disponibles en tu equipo');
        return;
    }
    
    // Mostrar bottom sheet con agentes
    var overlay = document.getElementById('campaña-bs-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'campaña-bs-overlay';
        overlay.className = 'campaña-bs-overlay';
        document.body.appendChild(overlay);
    }
    
    overlay.innerHTML = '' +
        '<div class="campaña-bs-overlay" id="campaña-bs-overlay-inner" onclick="cerrarBottomSheetCampana()"></div>' +
        '<div class="campaña-bs-sheet" id="campaña-bs-sheet">' +
            '<div class="campaña-bs-handle"></div>' +
            '<div class="campaña-bs-header">' +
                '<div>' +
                    '<div class="campaña-bs-header-title">👤 Asignar Campaña</div>' +
                    '<div class="campaña-bs-header-sub">' + nombreEsc + '</div>' +
                '</div>' +
                '<button class="campaña-bs-close" onclick="cerrarBottomSheetCampana()">✕</button>' +
            '</div>' +
            '<div class="campaña-bs-body">' +
                listaAgentes +
            '</div>' +
        '</div>';
    
    requestAnimationFrame(function() {
        overlay.classList.add('visible');
        var innerOverlay = document.getElementById('campaña-bs-overlay-inner');
        var sheet = document.getElementById('campaña-bs-sheet');
        if (innerOverlay) innerOverlay.classList.add('visible');
        if (sheet) sheet.classList.add('visible');
    });
}

async function asignarAgenteMovil(campaniaId, agenteId) {
    try {
        var response = await fetch('/api/gestiones-maestro/' + campaniaId + '/asignar-agente', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ agente_id: agenteId })
        });
        
        var resultado = await response.json();
        
        if (response.ok) {
            alert('✅ ' + resultado.mensaje);
            await cargarListaCampanas();
            if (String(campaniaId) === String(gestionId)) {
                await cargarDatosGestionMovil();
            }
        } else {
            alert('Error: ' + (resultado.error || 'Error al asignar agente'));
        }
    } catch (error) {
        console.error('[movil] Error asignando agente:', error);
        alert('Error al asignar agente: ' + error.message);
    }
}

async function quitarAsignacionAgenteMovil(campaniaId) {
    if (!confirm('¿Estás seguro de quitar la asignación de esta campaña?')) return;
    
    try {
        var response = await fetch('/api/gestiones-maestro/' + campaniaId + '/quitar-asignacion', {
            method: 'PUT'
        });
        
        var resultado = await response.json();
        
        if (response.ok) {
            alert('✅ ' + resultado.mensaje);
            await cargarListaCampanas();
        } else {
            alert('Error: ' + (resultado.error || 'Error al quitar asignación'));
        }
    } catch (error) {
        console.error('[movil] Error quitando asignación:', error);
        alert('Error al quitar asignación: ' + error.message);
    }
}

// ================== FIN NUEVAS FUNCIONES ==================

// Iniciar
init();

// ================== WHATSAPP CON IMAGEN INDIVIDUAL ==================

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

// Reemplazar la variable {nombre} con el nombre del cliente
function aplicarVariableNombre(contenido, nombreCliente) {
    var nombre = obtenerNombreParaMensaje(nombreCliente) || '';
    return String(contenido || '').replace(/\{nombre\}/g, nombre);
}

// Abrir modal de WhatsApp para una solicitud (solo texto, sin imagen)
async function abrirGestionWhatsApp(solicitudId, celular) {
    var sol = solicitudes.find(function(s) { return s.id_solicitud == solicitudId; });
    
    if (!sol) {
        alert('Solicitud no encontrada');
        return;
    }
    
    if (!celular || celular === '') {
        alert('Esta solicitud no tiene número de celular');
        return;
    }
    
    // Cargar plantillas del usuario (reemplazan los mensajes fijos)
    var plantillasUsuario = [];
    try {
        var resPlantillas = await fetch('/api/plantillas', { credentials: 'include' });
        var dataPlantillas = await resPlantillas.json();
        plantillasUsuario = (dataPlantillas && dataPlantillas.data) || [];
    } catch (e) {
        plantillasUsuario = [];
    }
    
    var contenido = '';
    
    contenido += '<div class="modal-gestion">';
    contenido += '<h2>💬 WhatsApp Directo - Solicitud #' + solicitudId + '</h2>';
    contenido += '<div class="modal-info">';
    contenido += '<p><strong>Nombre:</strong> ' + escaparParaHTML(sol.nombre || '—') + '</p>';
    contenido += '<p><strong>Celular:</strong> ' + escaparParaHTML(celular) + '</p>';
    contenido += '</div>';
    contenido += '<div class="modal-form">';
    contenido += '<label>📝 Mensaje:</label>';
    var mensajeDefecto = generarMensajeWhatsApp(sol.nombre);

    // Plantillas del usuario con {nombre} reemplazado
    var opcionesMensajes = [];
    for (var p = 0; p < plantillasUsuario.length; p++) {
        opcionesMensajes.push({
            texto: aplicarVariableNombre(plantillasUsuario[p].contenido, sol.nombre),
            etiqueta: plantillasUsuario[p].nombre || ('Plantilla ' + (p + 1))
        });
    }
    var mensajeInicial = opcionesMensajes.length ? opcionesMensajes[0].texto : mensajeDefecto;

    if (opcionesMensajes.length > 0) {
        contenido += '<div class="plantillas-grid">';
        for (var i = 0; i < opcionesMensajes.length; i++) {
            contenido += '<button type="button" class="btn-plantilla-whatsapp" data-index="' + i + '" data-opciones="' + encodeURIComponent(JSON.stringify(opcionesMensajes)) + '" onclick="cambiarMensajeWhatsAppDesdeBoton(this)">' + escaparParaHTML(opcionesMensajes[i].etiqueta) + '</button>';
        }
        contenido += '</div>';
    }
    contenido += '<textarea id="whatsapp-img-mensaje" rows="5" placeholder="Escriba su mensaje..." style="margin-bottom: 12px;">' + escaparParaHTML(mensajeInicial) + '</textarea>';
    contenido += '<div style="padding: 12px; background: #f0fdf4; border-radius: 8px; border: 1px solid #86efac; margin-bottom: 12px;">';
    contenido += '<div style="display: flex; align-items: center; gap: 8px;">';
    contenido += '<span style="font-size: 18px;">📱</span>';
    contenido += '<span style="font-size: 13px; color: #166534;">Se abrirá WhatsApp con el mensaje y el número de la solicitud.</span>';
    contenido += '</div>';
    contenido += '<div style="margin-top: 8px; display: flex; align-items: center; gap: 8px;">';
    contenido += '<input type="checkbox" id="whatsapp-abrir-web" checked style="width: 18px; height: 18px;">';
    contenido += '<span style="font-size: 12px; color: #374151;">Abrir WhatsApp al enviar</span>';
    contenido += '</div>';
    contenido += '<div style="margin-top: 6px; display: flex; align-items: center; gap: 8px;">';
    contenido += '<input type="checkbox" id="whatsapp-guardar" style="width: 18px; height: 18px;">';
    contenido += '<span style="font-size: 12px; color: #6b7280;">Guardar gestión en el historial</span>';
    contenido += '</div>';
    contenido += '</div>';
    contenido += '<div class="modal-botones">';
    contenido += '<button class="btn-cancelar" onclick="cerrarModal()">Cancelar</button>';
    contenido += '<button class="btn-guardar" id="btn-whatsapp-img" onclick="enviarWhatsApp(\'' + escaparParaAtributo(solicitudId) + '\', \'' + escaparParaAtributo(celular) + '\')">📤 Enviar</button>';
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

// Abrir WhatsApp en móvil (app nativa si está instalada, o web como fallback)
function abrirWhatsAppMovil(celular, mensaje) {
    var numeroFormateado = formatearNumeroWhatsApp(celular);
    
    console.log('[WhatsApp Movil] Número original:', celular, '→ formateado:', numeroFormateado);
    
    var texto = mensaje ? '&text=' + encodeURIComponent(mensaje) : '';
    
    // 1. Intentar deep link de WhatsApp app (whatsapp://)
    var urlApp = 'whatsapp://send?phone=' + numeroFormateado + texto;
    
    // 2. Fallback: universal link que abre la app o el navegador
    var urlUniversal = 'https://api.whatsapp.com/send?phone=' + numeroFormateado + texto;
    
    console.log('[WhatsApp Movil] Deep link:', urlApp);
    
    // Intentar deep link primero
    var win = window.open(urlApp, '_blank');
    
    // Si no se pudo (popup bloqueado o deep link no funciona), usar universal link
    if (!win) {
        console.log('[WhatsApp Movil] Fallback a universal link:', urlUniversal);
        win = window.open(urlUniversal, '_blank');
    }
    
    // Último recurso: redirigir directamente
    if (!win) {
        console.log('[WhatsApp Movil] Fallback final: redirigiendo...');
        window.location.href = urlUniversal;
    }
}

// Enviar WhatsApp (solo texto, sin imagen)
async function enviarWhatsApp(solicitudId, celular) {
    var mensaje = document.getElementById('whatsapp-img-mensaje').value.trim();
    var checkboxAbrir = document.getElementById('whatsapp-abrir-web');
    var abrirApp = checkboxAbrir ? checkboxAbrir.checked : true;
    
    if (!mensaje) {
        alert('Escriba un mensaje para enviar');
        return;
    }
    
    var btn = document.getElementById('btn-whatsapp-img');
    btn.textContent = '⏳ Guardando...';
    btn.disabled = true;
    
    var checkboxGuardar = document.getElementById('whatsapp-guardar');
    var guardar = checkboxGuardar ? checkboxGuardar.checked : false;
    
    try {
        // ===== PASO 1: Guardar gestión SOLO si el checkbox está marcado =====
        if (guardar) {
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
        }
        
        // ===== PASO 2: Abrir WhatsApp app =====
        if (abrirApp) {
            abrirWhatsAppMovil(celular, mensaje);
        }
        
        if (guardar) {
            alert('✅ Mensaje enviado y gestión guardada');
            cerrarModal();
            await cargarDatosGestionMovil();
        } else {
            alert('✅ Mensaje enviado');
            cerrarModal();
        }
        
    } catch (error) {
        console.error('[WhatsApp Movil] Error:', error);
        alert('Error: ' + error.message);
    } finally {
        btn.textContent = '📤 Enviar';
        btn.disabled = false;
    }
}

