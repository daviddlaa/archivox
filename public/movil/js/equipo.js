// ============================================================================
// EQUIPO MÓVIL - Archivox v4.0
// Gestión de equipo con experiencia tipo app nativa (vista Líder)
// Rediseño: 3 pestañas (Agentes / Campañas / Actividad) + detalle en
// pantalla completa. Backend sin cambios (mismos endpoints).
// ============================================================================

// ============================================================================
// ESTADO GLOBAL
// ============================================================================
var _equipoData = null;
var _agentesData = [];
var _campanasData = [];
var _gestionesData = [];
var _equipoId = null;
var _esLider = false;
var _totalGestiones7d = 0;
var _totalAsignadas = 0;
var _refrescando = false;
var _ptrEstado = 'idle';

// Estado de la UI (tabs, filtros, orden)
var _tabActual = 'agentes';
var _ordenAgentes = 'nombre';
var _busquedaAgentes = '';
var _filtroCampanas = 'todas';
var _filtroAgenteActividad = 'todos';
var _offsetGestiones = 15;      // ya se cargaron 15
var _limiteGestiones = 15;
var _hayMasGestiones = false;
var _detalleAbierto = false;
var _scrollListaGuardado = 0;

// ============================================================================
// INICIALIZACIÓN
// ============================================================================
document.addEventListener('DOMContentLoaded', async function() {
    try {
        var sesRes = await fetch('/api/auth/sesion');
        if (!sesRes.ok) throw new Error('Error al verificar sesión');
        var sesion = await sesRes.json();

        if (!sesion.autenticado) {
            window.location.href = '/m/login';
            return;
        }

        var user = sesion.usuario;

        if (!user.equipo_id) {
            document.getElementById('tab-agentes').innerHTML =
                '<div class="eq-empty" style="margin-top:24px;">' +
                '<span class="eq-empty-icon">🏢</span>' +
                '<h3>Sin Equipo Asignado</h3>' +
                '<p>No perteneces a ningún equipo. Contacta al administrador.</p>' +
                '</div>';
            return;
        }

        _esLider = !!user.es_lider;

        // Solo los líderes gestionan agentes: ocultar acción de creación si no lo es
        var btnNuevo = document.getElementById('btnNuevoAgente');
        if (btnNuevo && !_esLider) btnNuevo.style.display = 'none';

        initPullToRefresh();
        await cargarTodo();

    } catch (err) {
        console.error('[Equipo Móvil] Error:', err);
        document.getElementById('equipoAgentesList').innerHTML =
            '<div class="eq-empty">' +
            '<span class="eq-empty-icon">⚠️</span>' +
            '<h3>Error al cargar</h3>' +
            '<p>' + escapeHtmlMovil(err.message) + '</p>' +
            '<button onclick="recargarTodo()" class="eq-btn-nuevo" style="margin-top:14px;">Reintentar</button>' +
            '</div>';
    }
});

// ============================================================================
// CARGAR TODOS LOS DATOS
// ============================================================================
async function cargarTodo() {
    try {
        var eqRes = await fetch('/api/equipos/mi-equipo');
        var eqData = await eqRes.json();

        if (!eqData.equipo && !eqData.id) {
            mostrarEstadoVacio('🏢', 'Sin Equipo', 'No perteneces a ningún equipo.');
            return;
        }

        _equipoId = eqData.id;
        if (!_equipoId) {
            mostrarEstadoVacio('⚠️', 'Error de datos', 'No se pudo identificar el equipo. Intenta recargar.');
            return;
        }

        actualizarHeader(eqData);

        // Carga paralela de dashboard, campañas y gestiones
        var [dashRes, campRes, gestRes] = await Promise.all([
            fetch('/api/equipos/' + _equipoId + '/dashboard'),
            fetch('/api/equipos/' + _equipoId + '/campanas'),
            fetch('/api/equipos/' + _equipoId + '/gestiones?limite=' + _limiteGestiones)
        ]);

        if (!dashRes.ok) throw new Error('Error al cargar dashboard');
        var dashData = await dashRes.json();

        _agentesData = dashData.agentes || [];

        _totalGestiones7d = _agentesData.reduce(function(acc, a) {
            return acc + parseInt(a.gestiones_7d || 0);
        }, 0);
        _totalAsignadas = dashData.totales && dashData.totales.asignadas != null
            ? dashData.totales.asignadas
            : _agentesData.reduce(function(acc, a) { return acc + parseInt(a.asignadas || 0); }, 0);

        var agentesActivos = _agentesData.filter(function(a) { return a.is_active; }).length;

        // KPIs (3 métricas)
        var kpiAgentes = document.getElementById('kpiAgentes');
        if (kpiAgentes) kpiAgentes.textContent = agentesActivos;
        var kpiGestiones = document.getElementById('kpiGestiones');
        if (kpiGestiones) kpiGestiones.textContent = _totalGestiones7d;
        var kpiAsignadas = document.getElementById('kpiAsignadas');
        if (kpiAsignadas) kpiAsignadas.textContent = _totalAsignadas;

        document.getElementById('agentesCount').textContent = _agentesData.length + ' agente(s)';

        // Renderizar todo
        renderizarAgentes();

        if (campRes.ok) {
            var campData = await campRes.json();
            _campanasData = campData.data || [];
            renderizarCampanas();
        } else {
            renderizarCampanas();
        }

        if (gestRes.ok) {
            var gestData = await gestRes.json();
            _gestionesData = gestData.data || [];
            _hayMasGestiones = _gestionesData.length >= _limiteGestiones;
        }
        renderizarGestiones();
        renderizarChipsActividad();

    } catch (err) {
        console.error('[Equipo Móvil] Error cargar datos:', err);
        mostrarEstadoVacio('⚠️', 'Error', escapeHtmlMovil(err.message));
    }
}

// ============================================================================
// HEADER DINÁMICO
// ============================================================================
function actualizarHeader(eqData) {
    var h1 = document.querySelector('.header-title h1');
    var p = document.getElementById('equipoSubtitle');
    if (h1) h1.textContent = (eqData.nombre || 'Mi Equipo');
    if (p) p.textContent = (eqData.descripcion || 'Gestión de agentes') + (_esLider ? ' · Líder' : '');
}

// ============================================================================
// TABS
// ============================================================================
function cambiarTab(tab) {
    if (tab === _tabActual) return;
    _tabActual = tab;

    var tabs = document.querySelectorAll('.eq-tab');
    for (var i = 0; i < tabs.length; i++) {
        tabs[i].classList.toggle('active', tabs[i].getAttribute('data-tab') === tab);
    }

    var panes = ['agentes', 'campanas', 'actividad', 'detalle'];
    for (var j = 0; j < panes.length; j++) {
        var pane = document.getElementById('tab-' + panes[j]);
        if (pane) pane.style.display = (panes[j] === tab) ? '' : 'none';
    }
}

// ============================================================================
// ESTADOS VACÍO
// ============================================================================
function mostrarEstadoVacio(icono, titulo, mensaje) {
    document.getElementById('equipoAgentesList').innerHTML =
        '<div class="eq-empty">' +
        '<span class="eq-empty-icon">' + icono + '</span>' +
        '<h3>' + titulo + '</h3>' +
        '<p>' + mensaje + '</p>' +
        '</div>';
    document.getElementById('agentesCount').textContent = '0';
}

// ============================================================================
// PULL-TO-REFRESH
// ============================================================================
function initPullToRefresh() {
    var container = document.getElementById('equipoContainer');
    var touchStartY = 0;
    var isPulling = false;
    var pullThreshold = 80;

    container.addEventListener('touchstart', function(e) {
        if (window.scrollY > 0) return;
        if (_refrescando) return;
        touchStartY = e.touches[0].clientY;
        isPulling = true;
        _ptrEstado = 'idle';
    }, { passive: true });

    container.addEventListener('touchmove', function(e) {
        if (!isPulling || _refrescando) return;
        if (window.scrollY > 0) { resetPtr(); return; }

        var currentY = e.touches[0].clientY;
        var diff = currentY - touchStartY;

        if (diff < 0) { resetPtr(); return; }
        e.preventDefault();

        var pullDistance = Math.min(diff * 0.5, 120);
        var indicator = document.getElementById('ptrIndicator');
        var arrow = document.getElementById('ptrArrow');

        indicator.style.transform = 'translateY(' + (pullDistance - 60) + 'px)';
        indicator.style.opacity = Math.min(pullDistance / 60, 1);

        if (pullDistance >= pullThreshold) {
            _ptrEstado = 'pulled';
            if (arrow) arrow.classList.add('pulled');
            document.getElementById('ptrText').textContent = 'Suelta para actualizar';
        } else {
            _ptrEstado = 'pulling';
            if (arrow) arrow.classList.remove('pulled');
            document.getElementById('ptrText').textContent = 'Tira para actualizar';
        }
    }, { passive: false });

    container.addEventListener('touchend', function(e) {
        if (!isPulling) return;
        isPulling = false;

        var arrow = document.getElementById('ptrArrow');
        if (arrow && arrow.classList.contains('pulled')) {
            _ptrEstado = 'refreshing';
            _refrescando = true;
            document.getElementById('ptrText').textContent = 'Actualizando...';
            var spinner = document.getElementById('ptrSpinner');
            if (spinner) spinner.classList.add('active');
            if (arrow) arrow.style.display = 'none';
            var indicator = document.getElementById('ptrIndicator');
            if (indicator) {
                indicator.style.transform = 'translateY(0px)';
                indicator.style.opacity = '1';
            }
            recargarTodo().then(function() {
                setTimeout(resetPtr, 400);
            });
        } else {
            resetPtr();
        }
    }, { passive: true });
}

function resetPtr() {
    var indicator = document.getElementById('ptrIndicator');
    var arrow = document.getElementById('ptrArrow');
    var spinner = document.getElementById('ptrSpinner');
    if (indicator) {
        indicator.style.transform = 'translateY(-60px)';
        indicator.style.opacity = '0';
    }
    if (arrow) {
        arrow.classList.remove('pulled');
        arrow.style.display = 'inline-block';
    }
    if (spinner) spinner.classList.remove('active');
    var text = document.getElementById('ptrText');
    if (text) text.textContent = 'Tira para actualizar';
    _refrescando = false;
}

// ============================================================================
// PESTAÑA AGENTES — búsqueda y orden
// ============================================================================
function filtrarAgentesPorBusqueda() {
    _busquedaAgentes = (document.getElementById('agenteBusqueda').value || '').trim().toLowerCase();
    renderizarAgentes();
}

function setOrdenAgentes(orden) {
    _ordenAgentes = orden;
    var chips = document.querySelectorAll('#agenteSortChips .eq-chip');
    for (var i = 0; i < chips.length; i++) {
        chips[i].classList.toggle('active', chips[i].getAttribute('data-sort') === orden);
    }
    renderizarAgentes();
}

function getAgentesFiltradosYOrdenados() {
    var lista = _agentesData.slice();

    if (_busquedaAgentes) {
        lista = lista.filter(function(a) {
            var nombre = ((a.nombre || '') + ' ' + (a.username || '')).toLowerCase();
            return nombre.indexOf(_busquedaAgentes) !== -1;
        });
    }

    if (_ordenAgentes === 'asignadas') {
        lista.sort(function(a, b) { return (parseInt(b.asignadas || 0)) - (parseInt(a.asignadas || 0)); });
    } else if (_ordenAgentes === 'actividad') {
        lista.sort(function(a, b) { return (parseInt(b.gestiones_7d || 0)) - (parseInt(a.gestiones_7d || 0)); });
    } else {
        lista.sort(function(a, b) { return (a.nombre || a.username || '').localeCompare(b.nombre || b.username || '', 'es'); });
    }

    return lista;
}

// ============================================================================
// RENDERIZAR AGENTES (filas compactas)
// ============================================================================
function renderizarAgentes() {
    var container = document.getElementById('equipoAgentesList');
    if (!container) return;

    var lista = getAgentesFiltradosYOrdenados();

    if (lista.length === 0) {
        container.innerHTML =
            '<div class="eq-empty">' +
            '<span class="eq-empty-icon">' + (_agentesData.length ? '🔍' : '👥') + '</span>' +
            '<h3>' + (_agentesData.length ? 'Sin resultados' : 'Sin Agentes') + '</h3>' +
            '<p>' + (_agentesData.length
                ? 'No hay agentes que coincidan con la búsqueda.'
                : 'Aún no hay agentes en tu equipo. Crea el primero.') + '</p>' +
            '</div>';
        return;
    }

    var html = '';
    for (var i = 0; i < lista.length; i++) {
        var a = lista[i];
        var activo = a.is_active;
        var estadoClase = activo ? 'activo' : 'inactivo';
        var asignadas = parseInt(a.asignadas || 0);
        var gestiones7d = parseInt(a.gestiones_7d || 0);
        var nombreMostrar = a.nombre || a.username || 'Sin nombre';
        var inicial = (nombreMostrar.charAt(0) || '👤').toUpperCase();

        html += '<div class="eq-agente-row ' + estadoClase + '" data-id="' + a.id + '" onclick="abrirDetalleAgente(' + a.id + ')">';
        html += '<div class="eq-agente-avatar ' + estadoClase + '">' + escapeHtmlMovil(inicial) +
                '<span class="eq-agente-status-dot ' + estadoClase + '"></span></div>';
        html += '<div class="eq-agente-info">';
        html += '<span class="eq-agente-nombre">' + escapeHtmlMovil(nombreMostrar) + '</span>';
        html += '<span class="eq-agente-username">@' + escapeHtmlMovil(a.username) + (activo ? '' : ' · Inactivo') + '</span>';
        html += '</div>';
        html += '<div class="eq-agente-side">';
        html += '<div class="eq-agente-mini"><b>' + asignadas + '</b><span>Asig.</span></div>';
        html += '<div class="eq-agente-mini"><b>' + gestiones7d + '</b><span>7 días</span></div>';
        html += '</div>';
        html += '<span class="eq-agente-chevron">›</span>';
        html += '</div>';
    }

    container.innerHTML = html;
    animarFilasAgentes();
}

function animarFilasAgentes() {
    var filas = document.querySelectorAll('.eq-agente-row');
    for (var i = 0; i < filas.length; i++) {
        (function(fila, idx) {
            setTimeout(function() { fila.classList.add('visible'); }, 40 + (idx * 60));
        })(filas[i], i);
    }
}

// ============================================================================
// DETALLE DE AGENTE (pantalla completa)
// ============================================================================
function buscarAgente(agenteId) {
    for (var i = 0; i < _agentesData.length; i++) {
        if (_agentesData[i].id == agenteId) return _agentesData[i];
    }
    return null;
}

function abrirDetalleAgente(agenteId) {
    var agente = buscarAgente(agenteId);
    if (!agente) return;

    // Guardar scroll de la lista para volver
    _scrollListaGuardado = window.scrollY;

    var activo = agente.is_active;
    var estadoClase = activo ? 'activo' : 'inactivo';
    var estadoTexto = activo ? '🟢 Activo' : '🔴 Inactivo';
    var estadoAccion = activo ? '🔴 Desactivar' : '🟢 Activar';
    var estadoAccionClase = activo ? 'eq-detalle-btn-danger' : 'eq-detalle-btn-success';
    var nombreMostrar = agente.nombre || agente.username || 'Sin nombre';
    var asignadas = parseInt(agente.asignadas || 0);
    var gestiones7d = parseInt(agente.gestiones_7d || 0);
    var inicial = (nombreMostrar.charAt(0) || '👤').toUpperCase();

    var html = '';

    // Topbar con botón volver
    html += '<div class="eq-detalle-topbar">';
    html += '<button class="eq-back-btn" onclick="cerrarDetalleAgente()" title="Volver">←</button>';
    html += '<span class="eq-detalle-title">Detalle del agente</span>';
    html += '<span class="eq-detalle-spacer"></span>';
    html += '</div>';

    // Cabecera + stats
    html += '<div class="eq-detalle-card">';
    html += '<div class="eq-detalle-header">';
    html += '<div class="eq-detalle-avatar ' + estadoClase + '">' + escapeHtmlMovil(inicial) +
            '<span class="eq-agente-status-dot ' + estadoClase + '"></span></div>';
    html += '<div class="eq-detalle-info">';
    html += '<h3>' + escapeHtmlMovil(nombreMostrar) + '</h3>';
    html += '<p>@' + escapeHtmlMovil(agente.username) + ' · ' + estadoTexto + '</p>';
    html += '<span class="badge ' + (activo ? 'badge-green' : 'badge-red') + '">' + estadoTexto + '</span>';
    html += '</div>';
    html += '</div>';
    html += '<div class="eq-detalle-stats">';
    html += '<div class="eq-detalle-stat"><span class="eq-detalle-stat-value">' + asignadas.toLocaleString() + '</span><span class="eq-detalle-stat-label">📋 Asignadas</span></div>';
    html += '<div class="eq-detalle-stat"><span class="eq-detalle-stat-value">' + gestiones7d.toLocaleString() + '</span><span class="eq-detalle-stat-label">📝 Gestiones 7d</span></div>';
    html += '</div>';
    html += '</div>';

    // Campañas asignadas
    var campanasAgente = _campanasData.filter(function(c) { return String(c.asignado_a) === String(agente.id); });
    html += '<div class="eq-detalle-card">';
    html += '<h4 class="eq-detalle-section-title">📢 Campañas asignadas</h4>';
    if (campanasAgente.length === 0) {
        html += '<p style="font-size:12.5px;color:#9ca3af;margin:0;">Sin campañas asignadas.</p>';
    } else {
        for (var c = 0; c < campanasAgente.length; c++) {
            var cam = campanasAgente[c];
            var camTotal = parseInt(cam.total_solicitudes || 0);
            var camGest = parseInt(cam.gestionadas || 0);
            var camPct = camTotal > 0 ? Math.round((camGest / camTotal) * 100) : 0;
            html += '<div class="eq-campana-mini" onclick="location.href=\'/m/gestion-lote?id=' + cam.id + '\'">';
            html += '<div class="eq-campana-mini-info">';
            html += '<span class="eq-campana-mini-nombre">' + escapeHtmlMovil(cam.nombre || cam.nombre_campana || ('Campaña #' + cam.id)) + '</span>';
            html += '<div class="eq-campana-mini-bar"><div class="eq-campana-mini-fill" style="width:' + Math.min(camPct, 100) + '%;"></div></div>';
            html += '</div>';
            html += '<span class="eq-campana-mini-pct">' + camPct + '%</span>';
            html += '</div>';
        }
    }
    html += '</div>';

    // Últimas gestiones del agente
    var gestionesAgente = _gestionesData
        .filter(function(g) { return g.agente_username === agente.username; })
        .slice(0, 5);
    html += '<div class="eq-detalle-card">';
    html += '<h4 class="eq-detalle-section-title">📝 Últimas gestiones</h4>';
    if (gestionesAgente.length === 0) {
        html += '<p style="font-size:12.5px;color:#9ca3af;margin:0;">Sin gestiones recientes.</p>';
    } else {
        for (var g = 0; g < gestionesAgente.length; g++) {
            var ges = gestionesAgente[g];
            html += '<div class="gestion-item" onclick="location.href=\'/m/solicitudes?buscar=' + ges.solicitud_id + '\'">';
            html += '<div class="gestion-timeline-dot"></div>';
            html += '<div class="gestion-content">';
            html += '<div class="gestion-header-line">';
            html += '<span class="gestion-id">#' + ges.solicitud_id + '</span>';
            html += '<span class="gestion-tipo badge badge-blue">' + escapeHtmlMovil(ges.tipo_gestion) + '</span>';
            html += '</div>';
            html += '<div class="gestion-cliente">' + escapeHtmlMovil(ges.cliente_nombre || '—') + '</div>';
            html += '<div class="gestion-meta"><span>📅 ' + formatearFechaRelativa(ges.fecha_gestion) + '</span></div>';
            if (ges.observacion) {
                html += '<div class="gestion-obs">' + escapeHtmlMovil(ges.observacion.substring(0, 60)) + (ges.observacion.length > 60 ? '...' : '') + '</div>';
            }
            html += '</div>';
            html += '</div>';
        }
    }
    html += '</div>';

    // Acciones
    html += '<div class="eq-detalle-card">';
    html += '<div class="eq-detalle-actions">';
    html += '<button class="eq-detalle-btn" onclick="editarAgente(' + agente.id + ')">';
    html += '<span class="eq-detalle-btn-icon">✏️</span> Editar Agente</button>';
    html += '<button class="eq-detalle-btn" onclick="resetPasswordAgente(' + agente.id + ')">';
    html += '<span class="eq-detalle-btn-icon">🔑</span> Cambiar Contraseña</button>';
    html += '<div class="eq-detalle-divider"></div>';
    html += '<button class="eq-detalle-btn ' + estadoAccionClase + '" onclick="toggleActivoAgente(' + agente.id + ', ' + (activo ? 'false' : 'true') + ')">';
    html += '<span class="eq-detalle-btn-icon">' + (activo ? '🔴' : '🟢') + '</span> ' + estadoAccion + '</button>';
    html += '</div>';
    html += '</div>';

    // Link rápido a solicitudes del agente
    html += '<div class="eq-detalle-card">';
    html += '<a href="/m/solicitudes?usuario=' + agente.id + '" style="display:flex;align-items:center;justify-content:center;gap:8px;padding:13px;background:#f5f7ff;color:#4f46e5;border-radius:12px;text-decoration:none;font-weight:700;font-size:13.5px;">';
    html += '📋 Ver todas sus solicitudes</a>';
    html += '</div>';

    document.getElementById('detalleAgenteContenido').innerHTML = html;

    // Mostrar detalle, ocultar pestañas y demás panes
    _detalleAbierto = true;
    var tabs = document.getElementById('eqTabs');
    if (tabs) tabs.style.display = 'none';
    var panes = ['agentes', 'campanas', 'actividad'];
    for (var p = 0; p < panes.length; p++) {
        var pane = document.getElementById('tab-' + panes[p]);
        if (pane) pane.style.display = 'none';
    }
    document.getElementById('tab-detalle').style.display = '';
    window.scrollTo(0, 0);
}

function cerrarDetalleAgente() {
    _detalleAbierto = false;
    var tabs = document.getElementById('eqTabs');
    if (tabs) tabs.style.display = '';
    var panes = ['agentes', 'campanas', 'actividad', 'detalle'];
    for (var i = 0; i < panes.length; i++) {
        var pane = document.getElementById('tab-' + panes[i]);
        if (pane) pane.style.display = (panes[i] === _tabActual) ? '' : 'none';
    }
    window.scrollTo(0, _scrollListaGuardado);
}

// ============================================================================
// PESTAÑA CAMPAÑAS — filtros y render
// ============================================================================
function setFiltroCampanas(filtro) {
    _filtroCampanas = filtro;
    var chips = document.querySelectorAll('#campanaFilterChips .eq-chip');
    for (var i = 0; i < chips.length; i++) {
        chips[i].classList.toggle('active', chips[i].getAttribute('data-filtro') === filtro);
    }
    renderizarCampanas();
}

function renderizarCampanas() {
    var container = document.getElementById('campanasEquipoList');
    var countEl = document.getElementById('campanasCount');
    if (!container) return;

    var lista = _campanasData.filter(function(c) {
        if (_filtroCampanas === 'todas') return true;
        var estado = String(c.estado || '').toLowerCase();
        if (_filtroCampanas === 'activa') return estado.indexOf('activa') !== -1 || estado === 'activo';
        if (_filtroCampanas === 'completada') return estado.indexOf('completad') !== -1;
        return true;
    });

    if (countEl) countEl.textContent = lista.length + ' campaña(s)';

    if (lista.length === 0) {
        container.innerHTML =
            '<div class="eq-empty">' +
            '<span class="eq-empty-icon">📢</span>' +
            '<h3>' + (_campanasData.length ? 'Sin resultados' : 'Sin campañas') + '</h3>' +
            '<p>' + (_campanasData.length
                ? 'No hay campañas con ese filtro.'
                : 'No hay campañas asociadas a tu equipo.') + '</p>' +
            '</div>';
        return;
    }

    var html = '';
    for (var i = 0; i < lista.length; i++) {
        var c = lista[i];
        var total = parseInt(c.total_solicitudes || 0);
        var gestionadas = parseInt(c.gestionadas || 0);
        var pct = total > 0 ? Math.round((gestionadas / total) * 100) : 0;
        var pctCls = pct >= 100 ? 'completa' : '';
        var estado = String(c.estado || 'activa').toLowerCase();
        var estadoCls = estado.indexOf('completad') !== -1 ? 'completada'
            : (estado === 'activa' || estado === 'activo') ? 'activa' : 'pausada';

        var asignadoHtml = c.asignado_a
            ? '<span class="eq-campana-asignado">👤 ' + escapeHtmlMovil(c.asignado_username || 'Agente') + '</span>'
            : '<span class="eq-campana-asignado sin-asignar">⬜ Sin asignar</span>';

        html += '<div class="eq-campana-card" onclick="location.href=\'/m/gestion-lote?id=' + c.id + '\'">';
        html += '<div class="eq-campana-head">';
        html += '<div class="eq-campana-icon">📢</div>';
        html += '<div class="eq-campana-info">';
        html += '<span class="eq-campana-nombre">' + escapeHtmlMovil(c.nombre_campana || c.nombre || ('Campaña #' + c.id)) + '</span>';
        html += '<span class="eq-campana-meta">#' + c.id + ' · ' + total + ' solicitudes</span>';
        html += '</div>';
        html += '<span class="eq-campana-estado ' + estadoCls + '"></span>';
        html += '</div>';
        html += '<div class="eq-campana-progress">';
        html += '<div class="eq-campana-progress-bar"><div class="eq-campana-progress-fill ' + pctCls + '" style="width:' + Math.min(pct, 100) + '%;"></div></div>';
        html += '<span class="eq-campana-progress-text ' + pctCls + '">' + pct + '%</span>';
        html += '</div>';
        html += '<div class="eq-campana-stats">';
        html += '<span>📄 ' + total + ' · ✓ ' + gestionadas + '</span>';
        html += asignadoHtml;
        html += '</div>';
        html += '</div>';
    }

    container.innerHTML = html;
}

// ============================================================================
// PESTAÑA ACTIVIDAD — chips por agente + timeline por día
// ============================================================================
function renderizarChipsActividad() {
    var contChips = document.getElementById('actividadAgenteChips');
    if (!contChips) return;

    var html = '<button class="eq-chip' + (_filtroAgenteActividad === 'todos' ? ' active' : '') + '" onclick="setFiltroActividad(-1)">Todos</button>';

    for (var i = 0; i < _agentesData.length; i++) {
        var username = _agentesData[i].username;
        if (!username) continue;
        html += '<button class="eq-chip' + (_filtroAgenteActividad === username ? ' active' : '') + '" onclick="setFiltroActividad(' + i + ')">' + escapeHtmlMovil(username) + '</button>';
    }

    contChips.innerHTML = html;
}

function setFiltroActividad(idx) {
    _filtroAgenteActividad = idx === -1 ? 'todos' : (_agentesData[idx] ? _agentesData[idx].username : 'todos');
    renderizarChipsActividad();
    renderizarGestiones();
}

function renderizarGestiones() {
    var container = document.getElementById('gestionesEquipoList');
    var countEl = document.getElementById('gestionesCount');
    if (!container) return;

    var lista = _gestionesData.filter(function(g) {
        return _filtroAgenteActividad === 'todos' || g.agente_username === _filtroAgenteActividad;
    });

    if (countEl) countEl.textContent = lista.length + ' gestión(es)';

    // Botón cargar más (re-establecer texto tras una carga)
    var btnMas = document.getElementById('btnCargarMasGestiones');
    if (btnMas) {
        btnMas.style.display = _hayMasGestiones ? '' : 'none';
        btnMas.disabled = false;
        btnMas.textContent = 'Cargar más gestiones';
    }

    if (lista.length === 0) {
        container.innerHTML =
            '<div class="eq-empty">' +
            '<span class="eq-empty-icon">📝</span>' +
            '<h3>' + (_gestionesData.length ? 'Sin resultados' : 'Sin gestiones') + '</h3>' +
            '<p>' + (_gestionesData.length
                ? 'No hay gestiones de ese agente en el período reciente.'
                : 'Aún no hay gestiones registradas por el equipo.') + '</p>' +
            '</div>';
        return;
    }

    // Agrupar por día
    var grupos = {};
    var ordenDias = [];
    for (var i = 0; i < lista.length; i++) {
        var g = lista[i];
        var clave = claveDia(g.fecha_gestion);
        if (!grupos[clave]) {
            grupos[clave] = { etiqueta: etiquetaDia(g.fecha_gestion), items: [] };
            ordenDias.push(clave);
        }
        grupos[clave].items.push(g);
    }

    var html = '';
    for (var d = 0; d < ordenDias.length; d++) {
        var grupo = grupos[ordenDias[d]];
        html += '<div class="eq-grupo-dia">' + grupo.etiqueta + '</div>';
        for (var k = 0; k < grupo.items.length; k++) {
            var gest = grupo.items[k];
            html += '<div class="gestion-item" onclick="location.href=\'/m/solicitudes?buscar=' + gest.solicitud_id + '\'">';
            html += '<div class="gestion-timeline-dot"></div>';
            html += '<div class="gestion-content">';
            html += '<div class="gestion-header-line">';
            html += '<span class="gestion-id">#' + gest.solicitud_id + '</span>';
            html += '<span class="gestion-tipo badge badge-blue">' + escapeHtmlMovil(gest.tipo_gestion) + '</span>';
            html += '</div>';
            html += '<div class="gestion-cliente">' + escapeHtmlMovil(gest.cliente_nombre || '—') + '</div>';
            html += '<div class="gestion-meta">';
            html += '<span>👤 ' + escapeHtmlMovil(gest.agente_username || '-') + '</span>';
            html += '<span>🕐 ' + formatearHora(gest.fecha_gestion) + '</span>';
            html += '</div>';
            if (gest.observacion) {
                html += '<div class="gestion-obs">' + escapeHtmlMovil(gest.observacion.substring(0, 60)) + (gest.observacion.length > 60 ? '...' : '') + '</div>';
            }
            html += '</div>';
            html += '</div>';
        }
    }

    container.innerHTML = html;
}

async function cargarMasGestiones() {
    var btnMas = document.getElementById('btnCargarMasGestiones');
    if (btnMas) { btnMas.disabled = true; btnMas.textContent = 'Cargando...'; }

    try {
        var res = await fetch('/api/equipos/' + _equipoId + '/gestiones?limite=' + _limiteGestiones + '&offset=' + _offsetGestiones);
        if (!res.ok) throw new Error('Error');
        var data = await res.json();
        var nuevas = data.data || [];
        _gestionesData = _gestionesData.concat(nuevas);
        _offsetGestiones += nuevas.length;
        _hayMasGestiones = nuevas.length >= _limiteGestiones;
        renderizarGestiones();
        renderizarChipsActividad();
    } catch (err) {
        console.error('[Equipo Móvil] Error cargar más gestiones:', err);
        if (btnMas) { btnMas.disabled = false; btnMas.textContent = 'Cargar más gestiones'; }
        mostrarToastMovil('⚠️ Error al cargar más gestiones');
    }
}

// ============================================================================
// HELPERS DE FECHA
// ============================================================================
function claveDia(fecha) {
    try {
        var d = new Date(fecha);
        if (isNaN(d.getTime())) return String(fecha);
        var dd = String(d.getDate()).padStart(2, '0');
        var mm = String(d.getMonth() + 1).padStart(2, '0');
        var yyyy = d.getFullYear();
        return yyyy + '-' + mm + '-' + dd;
    } catch (e) { return String(fecha); }
}

function etiquetaDia(fecha) {
    try {
        var d = new Date(fecha);
        if (isNaN(d.getTime())) return 'Sin fecha';
        var hoy = new Date();
        var ayer = new Date();
        ayer.setDate(ayer.getDate() - 1);
        var cHoy = claveDia(hoy);
        var cAyer = claveDia(ayer);
        var c = claveDia(d);
        if (c === cHoy) return 'Hoy';
        if (c === cAyer) return 'Ayer';
        return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
    } catch (e) { return 'Sin fecha'; }
}

function formatearHora(fecha) {
    try {
        var d = new Date(fecha);
        if (isNaN(d.getTime())) return '';
        return d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
    } catch (e) { return ''; }
}

function formatearFechaRelativa(fecha) {
    if (!fecha) return '';
    try {
        var d = new Date(fecha);
        if (isNaN(d.getTime())) return fecha;
        var ahora = new Date();
        var diffMs = ahora - d;
        var diffMin = Math.floor(diffMs / 60000);
        var diffHoras = Math.floor(diffMs / 3600000);
        var diffDias = Math.floor(diffMs / 86400000);

        if (diffMin < 1) return 'Ahora';
        if (diffMin < 60) return 'Hace ' + diffMin + ' min';
        if (diffHoras < 24) return 'Hace ' + diffHoras + ' h';
        if (diffDias < 7) return 'Hace ' + diffDias + ' día(s)';
        return d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' });
    } catch(e) { return fecha; }
}

// ============================================================================
// CREAR AGENTE (sheet)
// ============================================================================
function abrirNuevoAgente() {
    var bodyHtml = '';
    bodyHtml += '<div style="padding:8px 0;">';
    bodyHtml += '<div class="equipo-form-group-movil">';
    bodyHtml += '<label>Usuario *</label>';
    bodyHtml += '<input type="text" id="movil-nuevo-username" placeholder="Nombre de usuario" autocomplete="off">';
    bodyHtml += '</div>';
    bodyHtml += '<div class="equipo-form-group-movil">';
    bodyHtml += '<label>Nombre completo</label>';
    bodyHtml += '<input type="text" id="movil-nuevo-nombre" placeholder="Nombre del agente" autocomplete="off">';
    bodyHtml += '</div>';
    bodyHtml += '<div class="equipo-form-group-movil">';
    bodyHtml += '<label>Contraseña *</label>';
    bodyHtml += '<input type="text" id="movil-nuevo-password" placeholder="Mín 8 carac., mayúscula y número" autocomplete="off">';
    bodyHtml += '</div>';
    bodyHtml += '<div class="equipo-form-group-movil">';
    bodyHtml += '<label>Email (opcional)</label>';
    bodyHtml += '<input type="email" id="movil-nuevo-email" placeholder="correo@ejemplo.com" autocomplete="off">';
    bodyHtml += '</div>';
    bodyHtml += '<button class="eq-sheet-submit" onclick="ejecutarCrearAgente()">➕ Crear Agente</button>';
    bodyHtml += '</div>';

    mostrarSheetMovil('➕ Nuevo Agente', bodyHtml);
}

async function ejecutarCrearAgente() {
    if (!_equipoId) { mostrarToastMovil('⚠️ No hay equipo asignado'); return; }

    var username = document.getElementById('movil-nuevo-username').value.trim();
    var nombre = document.getElementById('movil-nuevo-nombre').value.trim();
    var password = document.getElementById('movil-nuevo-password').value;
    var email = document.getElementById('movil-nuevo-email').value.trim() || null;

    if (!username || !password) { mostrarToastMovil('⚠️ Usuario y contraseña son requeridos'); return; }
    if (password.length < 8) { mostrarToastMovil('⚠️ La contraseña debe tener al menos 8 caracteres'); return; }
    if (!/[A-Z]/.test(password)) { mostrarToastMovil('⚠️ Debe contener al menos una mayúscula'); return; }
    if (!/[0-9]/.test(password)) { mostrarToastMovil('⚠️ Debe contener al menos un número'); return; }

    try {
        var res = await fetch('/api/equipos/' + _equipoId + '/agentes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: username, nombre: nombre || username, password: password, email: email })
        });
        var result = await res.json();

        if (res.ok) {
            cerrarSheetDetalle();
            mostrarToastMovil('✅ Agente creado: ' + username);
            await recargarTodo();
        } else {
            mostrarToastMovil('⚠️ ' + (result.error || 'Error al crear agente'));
        }
    } catch (err) {
        console.error('[Equipo Móvil] Error crear agente:', err);
        mostrarToastMovil('⚠️ Error de conexión');
    }
}

// ============================================================================
// BOTTOM SHEET MÓVIL (reutilizable)
// ============================================================================
function mostrarSheetMovil(titulo, bodyHtml) {
    var overlay = document.createElement('div');
    overlay.className = 'mm-overlay visible';

    var sheet = document.createElement('div');
    sheet.className = 'mm-sheet visible';
    sheet.innerHTML = '' +
        '<div class="mm-handle"></div>' +
        '<div class="mm-header">' +
            '<span class="mm-header-title">' + titulo + '</span>' +
            '<button class="mm-close" onclick="cerrarSheetDetalle()">✕</button>' +
        '</div>' +
        '<div class="mm-body equipo-sheet-body">' +
            bodyHtml +
        '</div>';

    overlay.appendChild(sheet);
    document.body.appendChild(overlay);

    overlay.addEventListener('click', function(e) {
        if (e.target === overlay) cerrarSheetDetalle();
    });
}

function cerrarSheetDetalle() {
    var sheets = document.querySelectorAll('.mm-sheet.visible');
    var overlays = document.querySelectorAll('.mm-overlay.visible');
    for (var i = 0; i < sheets.length; i++) sheets[i].classList.remove('visible');
    for (var i = 0; i < overlays.length; i++) overlays[i].classList.remove('visible');
    setTimeout(function() {
        document.querySelectorAll('.mm-sheet:not(.visible)').forEach(function(el) { el.remove(); });
        document.querySelectorAll('.mm-overlay:not(.visible)').forEach(function(el) { el.remove(); });
    }, 350);
}

// ============================================================================
// ACCIONES DE AGENTE
// ============================================================================
function editarAgente(agenteId) {
    var agente = buscarAgente(agenteId);
    if (!agente) return;
    var username = agente.username || '';
    var nombreActual = agente.nombre || '';
    var bodyHtml = '';
    bodyHtml += '<div style="padding:8px 0;">';
    bodyHtml += '<div class="equipo-form-group-movil">';
    bodyHtml += '<label>Nombre completo</label>';
    bodyHtml += '<input type="text" id="edit-nombre-agente" value="' + escapeHtmlMovil(nombreActual) + '" placeholder="Nombre del agente">';
    bodyHtml += '</div>';
    bodyHtml += '<div class="equipo-form-group-movil">';
    bodyHtml += '<label>Email (opcional)</label>';
    bodyHtml += '<input type="email" id="edit-email-agente" placeholder="correo@ejemplo.com">';
    bodyHtml += '</div>';
    bodyHtml += '<button class="eq-sheet-submit" onclick="guardarEdicionAgente(' + agenteId + ')">💾 Guardar Cambios</button>';
    bodyHtml += '</div>';
    mostrarSheetMovil('✏️ Editar ' + escapeHtmlMovil(username), bodyHtml);
}

async function guardarEdicionAgente(agenteId) {
    var nombre = document.getElementById('edit-nombre-agente').value.trim();
    var email = document.getElementById('edit-email-agente').value.trim() || null;
    if (!nombre) { mostrarToastMovil('⚠️ El nombre es requerido'); return; }
    try {
        var res = await fetch('/api/equipos/' + _equipoId + '/agentes/' + agenteId, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nombre: nombre, email: email })
        });
        if (res.ok) {
            mostrarToastMovil('✅ Agente actualizado');
            cerrarSheetDetalle();
            await recargarTodo();
            // Reabrir detalle si estábamos en él
            if (_detalleAbierto) abrirDetalleAgente(agenteId);
        } else {
            var errData = await res.json();
            mostrarToastMovil('⚠️ ' + (errData.error || 'Error al actualizar'));
        }
    } catch (err) {
        console.error('[Equipo Móvil] Error editando agente:', err);
        mostrarToastMovil('⚠️ Error de conexión');
    }
}

function resetPasswordAgente(agenteId) {
    var agente = buscarAgente(agenteId);
    if (!agente) return;
    var username = agente.username || '';
    var bodyHtml = '';
    bodyHtml += '<div style="padding:8px 0;">';
    bodyHtml += '<p style="font-size:13px;color:#6b7280;margin-bottom:14px;">Nueva contraseña para <strong>' + escapeHtmlMovil(username) + '</strong></p>';
    bodyHtml += '<div class="equipo-form-group-movil">';
    bodyHtml += '<label>Nueva contraseña</label>';
    bodyHtml += '<input type="text" id="reset-password-input" placeholder="Mín 8 carac., mayúscula y número">';
    bodyHtml += '</div>';
    bodyHtml += '<button class="eq-sheet-submit" onclick="guardarResetPassword(' + agenteId + ')">🔑 Cambiar Contraseña</button>';
    bodyHtml += '</div>';
    mostrarSheetMovil('🔑 Reset Password', bodyHtml);
}

async function guardarResetPassword(agenteId) {
    var nuevaPassword = document.getElementById('reset-password-input').value;
    if (!nuevaPassword || nuevaPassword.length < 8) { mostrarToastMovil('⚠️ Mínimo 8 caracteres'); return; }
    if (!/[A-Z]/.test(nuevaPassword)) { mostrarToastMovil('⚠️ Debe contener una mayúscula'); return; }
    if (!/[0-9]/.test(nuevaPassword)) { mostrarToastMovil('⚠️ Debe contener un número'); return; }
    try {
        var res = await fetch('/api/equipos/' + _equipoId + '/agentes/' + agenteId + '/reset-password', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nueva_password: nuevaPassword })
        });
        if (res.ok) {
            mostrarToastMovil('✅ Contraseña actualizada');
            cerrarSheetDetalle();
        } else {
            var errData = await res.json();
            mostrarToastMovil('⚠️ ' + (errData.error || 'Error'));
        }
    } catch (err) {
        console.error('[Equipo Móvil] Error reset password:', err);
        mostrarToastMovil('⚠️ Error de conexión');
    }
}

async function toggleActivoAgente(agenteId, nuevoEstado) {
    var agente = buscarAgente(agenteId);
    if (!agente) return;
    var username = agente.username || '';
    var accion = nuevoEstado ? 'activar' : 'desactivar';
    var confirmado = await new Promise(function(resolve) {
        Modal.confirmar({
            titulo: (nuevoEstado ? '🟢 Activar' : '🔴 Desactivar') + ' Agente',
            mensaje: '¿Estás seguro de ' + accion + ' a <strong>' + escapeHtmlMovil(username) + '</strong>?',
            icono: nuevoEstado ? '🟢' : '🔴',
            textoConfirmar: 'Sí, ' + accion,
            textoCancelar: 'Cancelar',
            tipo: nuevoEstado ? 'success' : 'danger',
            onConfirm: function() { resolve(true); }
        });
        setTimeout(function() { resolve(false); }, 30000);
    });
    if (!confirmado) return;

    try {
        var res = await fetch('/api/equipos/' + _equipoId + '/agentes/' + agenteId + '/toggle-active', {
            method: 'PUT'
        });
        if (res.ok) {
            mostrarToastMovil('✅ ' + username + ' ' + (nuevoEstado ? 'activado' : 'desactivado'));
            await recargarTodo();
            if (_detalleAbierto) abrirDetalleAgente(agenteId);
        } else {
            var errData = await res.json();
            mostrarToastMovil('⚠️ ' + (errData.error || 'Error'));
        }
    } catch (err) {
        console.error('[Equipo Móvil] Error toggle:', err);
        mostrarToastMovil('⚠️ Error de conexión');
    }
}

// ============================================================================
// RECARGAR TODO
// ============================================================================
async function recargarTodo() {
    if (_refrescando) return;
    var enPtr = _ptrEstado === 'refreshing';

    if (!enPtr) {
        document.getElementById('equipoAgentesList').innerHTML = '' +
            '<div class="equipo-shimmer"></div>' +
            '<div class="equipo-shimmer" style="margin-top:12px;"></div>';
    }

    var kpiValues = document.querySelectorAll('.eq-kpi-value');
    for (var i = 0; i < kpiValues.length; i++) kpiValues[i].textContent = '...';

    _offsetGestiones = _limiteGestiones;
    _gestionesData = [];

    await cargarTodo();

    if (!enPtr) mostrarToastMovil('✅ Actualizado');
}

// ============================================================================
// TOAST
// ============================================================================
function mostrarToastMovil(mensaje) {
    var existing = document.querySelector('.equipo-toast-movil');
    if (existing) existing.remove();
    var toast = document.createElement('div');
    toast.className = 'equipo-toast-movil';
    toast.textContent = mensaje;
    document.body.appendChild(toast);
    setTimeout(function() {
        toast.style.opacity = '0';
        toast.style.transition = 'opacity 0.3s';
        setTimeout(function() { toast.remove(); }, 300);
    }, 2500);
}

// ============================================================================
// HELPERS
// ============================================================================
function escapeHtmlMovil(str) {
    if (!str) return '';
    return String(str).replace(/[&<>"']/g, function(c) {
        return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c] || c;
    });
}
