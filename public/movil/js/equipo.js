// ============================================================================
// EQUIPO MÓVIL - Archivox v3.0
// Gestión de equipo con experiencia tipo app nativa
// Rediseñado desde la auditoría del módulo Desktop
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
            document.getElementById('equipoContainer').innerHTML = `
                <div class="equipo-empty" style="margin-top:40px;">
                    <div class="equipo-empty-icon">🏢</div>
                    <h3>Sin Equipo Asignado</h3>
                    <p>No perteneces a ningún equipo. Contacta al administrador.</p>
                </div>
            `;
            var fab = document.getElementById('btnRefresh');
            if (fab) fab.style.display = 'none';
            return;
        }

        _esLider = !!user.es_lider;

        initPullToRefresh();
        initKpiScrollIndicator();
        await cargarTodo();

    } catch (err) {
        console.error('[Equipo Móvil] Error:', err);
        document.getElementById('equipoAgentesList').innerHTML = `
            <div class="equipo-empty">
                <div class="equipo-empty-icon">⚠️</div>
                <h3>Error al cargar</h3>
                <p>${escapeHtmlMovil(err.message)}</p>
                <button onclick="recargarTodo()" style="padding:10px 24px;background:#6366f1;color:white;border:none;border-radius:10px;font-weight:600;font-size:14px;">Reintentar</button>
            </div>
        `;
    }
});

// ============================================================================
// CARGAR TODOS LOS DATOS (UNA SOLA LLAMADA A mi-equipo)
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
            document.querySelectorAll('.equipo-kpi-value').forEach(function(el) { el.textContent = '—'; });
            return;
        }

        // Header dinámico
        actualizarHeader(eqData);

        // Carga paralela de dashboard, campañas y gestiones
        var [dashRes, campRes, gestRes] = await Promise.all([
            fetch('/api/equipos/' + _equipoId + '/dashboard'),
            fetch('/api/equipos/' + _equipoId + '/campanas'),
            fetch('/api/equipos/' + _equipoId + '/gestiones?limite=10')
        ]);

        if (!dashRes.ok) throw new Error('Error al cargar dashboard');
        var dashData = await dashRes.json();

        _agentesData = dashData.agentes || [];
        var campanasDash = dashData.campañas || [];

        _totalGestiones7d = _agentesData.reduce(function(acc, a) {
            return acc + parseInt(a.gestiones_7d || 0);
        }, 0);
        _totalAsignadas = dashData.totales?.asignadas || _agentesData.reduce(function(acc, a) {
            return acc + parseInt(a.asignadas || 0);
        }, 0);

        var agentesActivos = _agentesData.filter(function(a) { return a.is_active; }).length;

        // KPIs
        document.getElementById('kpiAgentes').textContent = agentesActivos;
        document.getElementById('kpiCampanas').textContent = campanasDash.length;
        document.getElementById('kpiGestiones').textContent = _totalGestiones7d;
        document.getElementById('kpiAsignadas').textContent = _totalAsignadas;

        document.getElementById('agentesCount').textContent = _agentesData.length + ' agente(s)';

        // Renderizar todo
        renderizarAgentesCards();

        if (campRes.ok) {
            var campData = await campRes.json();
            _campanasData = campData.data || [];
            renderizarCampanas();
        }

        if (gestRes.ok) {
            var gestData = await gestRes.json();
            _gestionesData = gestData.data || [];
            renderizarGestiones();
        }

        // Mostrar acciones rápidas (ocultas por defecto)
        var actions = document.getElementById('equipoQuickActions');
        if (actions) actions.style.display = 'grid';

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
    var p = document.querySelector('.header-title p');
    if (h1) h1.textContent = '🏢 ' + (eqData.nombre || 'Mi Equipo');
    if (p) p.textContent = (eqData.descripcion || 'Gestión de agentes') + (_esLider ? ' · 👑 Líder' : '');
}

// ============================================================================
// ESTADOS VACÍO
// ============================================================================
function mostrarEstadoVacio(icono, titulo, mensaje) {
    document.getElementById('equipoAgentesList').innerHTML = `
        <div class="equipo-empty">
            <div class="equipo-empty-icon">${icono}</div>
            <h3>${titulo}</h3>
            <p>${mensaje}</p>
        </div>
    `;
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
// KPI SCROLL INDICATOR
// ============================================================================
function initKpiScrollIndicator() {
    var kpis = document.getElementById('equipoKpis');
    if (!kpis) return;
    kpis.addEventListener('scroll', actualizarKpiScrollDots, { passive: true });
}

function actualizarKpiScrollDots() {
    var kpis = document.getElementById('equipoKpis');
    var dots = document.querySelectorAll('.kpi-scroll-dot');
    if (!kpis || !dots.length) return;
    var scrollLeft = kpis.scrollLeft;
    var cardWidth = 150;
    var activeIndex = Math.round(scrollLeft / cardWidth);
    for (var i = 0; i < dots.length; i++) {
        dots[i].classList.toggle('active', i === activeIndex);
    }
}

// ============================================================================
// ACCIONES RÁPIDAS
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
    bodyHtml += '<button class="equipo-detalle-btn" style="background:#10b981;color:white;justify-content:center;margin-top:12px;" onclick="ejecutarCrearAgente()">';
    bodyHtml += '<span class="equipo-detalle-btn-icon">➕</span> Crear Agente';
    bodyHtml += '</button>';
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
// RENDERIZAR CARDS DE AGENTES
// ============================================================================
function renderizarAgentesCards() {
    var container = document.getElementById('equipoAgentesList');

    if (!_agentesData || _agentesData.length === 0) {
        container.innerHTML = `
            <div class="equipo-empty">
                <div class="equipo-empty-icon">👥</div>
                <h3>Sin Agentes</h3>
                <p>Aún no hay agentes en tu equipo. Crea el primero.</p>
            </div>
        `;
        return;
    }

    var html = '';
    for (var i = 0; i < _agentesData.length; i++) {
        var a = _agentesData[i];
        var activo = a.is_active;
        var estadoClase = activo ? 'activo' : 'inactivo';
        var estadoTexto = activo ? '🟢 Activo' : '🔴 Inactivo';
        var asignadas = parseInt(a.asignadas || 0);
        var gestiones7d = parseInt(a.gestiones_7d || 0);
        var nombreMostrar = a.nombre || a.username || 'Sin nombre';

        html += '<div class="equipo-agente-card ' + estadoClase + '" data-index="' + i + '" onclick="abrirDetalleAgente(' + i + ')">';
        html += '<div class="equipo-agente-header">';
        html += '<div class="equipo-agente-avatar ' + estadoClase + '">👤</div>';
        html += '<div class="equipo-agente-info">';
        html += '<span class="equipo-agente-nombre">' + escapeHtmlMovil(nombreMostrar) + '</span>';
        html += '<span class="equipo-agente-username">@' + escapeHtmlMovil(a.username) + '</span>';
        html += '</div>';
        html += '<span class="equipo-agente-status ' + estadoClase + '">' + estadoTexto + '</span>';
        html += '</div>';

        html += '<div class="equipo-agente-stats">';
        html += '<div class="equipo-agente-stat">';
        html += '<span class="equipo-agente-stat-value">' + asignadas + '</span>';
        html += '<span class="equipo-agente-stat-label">📋 Asignadas</span>';
        html += '</div>';
        html += '<div class="equipo-agente-stat">';
        html += '<span class="equipo-agente-stat-value">' + gestiones7d + '</span>';
        html += '<span class="equipo-agente-stat-label">📝 Gestiones (7d)</span>';
        html += '</div>';
        html += '</div>';

        html += '<button class="equipo-agente-btn" onclick="event.stopPropagation(); abrirDetalleAgente(' + i + ')">';
        html += '📋 Ver Detalles';
        html += '</button>';
        html += '</div>';
    }

    container.innerHTML = html;
    animarCardsAgentes();
}

function animarCardsAgentes() {
    var cards = document.querySelectorAll('.equipo-agente-card');
    cards.forEach(function(card, index) {
        setTimeout(function() {
            card.classList.add('visible');
        }, 50 + (index * 80));
    });
}

// ============================================================================
// RENDERIZAR CAMPAÑAS DEL EQUIPO
// ============================================================================
function renderizarCampanas() {
    var container = document.getElementById('campanasEquipoList');
    var countEl = document.getElementById('campanasCount');
    if (!container) return;

    if (!_campanasData || _campanasData.length === 0) {
        container.innerHTML = `
            <div class="equipo-empty" style="padding:20px;">
                <p style="margin:0;color:#9ca3af;font-size:13px;">No hay campañas asociadas a tu equipo.</p>
            </div>
        `;
        if (countEl) countEl.textContent = '0';
        return;
    }

    if (countEl) countEl.textContent = _campanasData.length + ' campaña(s)';

    var html = '';
    for (var i = 0; i < _campanasData.length; i++) {
        var c = _campanasData[i];
        var total = parseInt(c.total_solicitudes || 0);
        var gestionadas = parseInt(c.gestionadas || 0);
        var pct = total > 0 ? Math.round((gestionadas / total) * 100) : 0;
        var pctCls = pct >= 100 ? 'completa' : '';
        var estadoCls = c.estado === 'activa' ? 'activo' : 'inactivo';

        var asignadoHtml = c.asignado_a
            ? '<span style="color:#059669;font-weight:600;">👤 ' + escapeHtmlMovil(c.asignado_username || 'Agente') + '</span>'
            : '<span style="color:#9ca3af;">⬜ Sin asignar</span>';

        html += '<div class="campana-card">';
        html += '<div class="campana-header">';
        html += '<div class="campana-icon">📢</div>';
        html += '<div class="campana-info">';
        html += '<span class="campana-nombre">' + escapeHtmlMovil(c.nombre_campana || 'Campaña #' + c.id) + '</span>';
        html += '<span class="campana-meta">#' + c.id + ' · ' + total + ' solicitudes</span>';
        html += '</div>';
        html += '<span class="campana-estado ' + estadoCls + '"></span>';
        html += '</div>';

        html += '<div class="campana-body">';
        html += '<div class="campana-progress">';
        html += '<div class="campana-progress-bar">';
        html += '<div class="campana-progress-fill ' + pctCls + '" style="width:' + Math.min(pct, 100) + '%;"></div>';
        html += '</div>';
        html += '<span class="campana-progress-text">' + pct + '%</span>';
        html += '</div>';
        html += '<div class="campana-stats">';
        html += '<span>📄 ' + total + ' asignadas</span>';
        html += '<span>✓ ' + gestionadas + ' gestionadas</span>';
        html += '</div>';
        html += '<div class="campana-asignado">' + asignadoHtml + '</div>';
        html += '</div>';
        html += '</div>';
    }

    container.innerHTML = html;
}

// ============================================================================
// RENDERIZAR GESTIONES RECIENTES
// ============================================================================
function renderizarGestiones() {
    var container = document.getElementById('gestionesEquipoList');
    var countEl = document.getElementById('gestionesCount');
    if (!container) return;

    if (!_gestionesData || _gestionesData.length === 0) {
        container.innerHTML = `
            <div class="equipo-empty" style="padding:20px;">
                <p style="margin:0;color:#9ca3af;font-size:13px;">No hay gestiones recientes del equipo.</p>
            </div>
        `;
        if (countEl) countEl.textContent = '0';
        return;
    }

    if (countEl) countEl.textContent = _gestionesData.length + ' gestión(es)';

    var html = '';
    for (var i = 0; i < _gestionesData.length; i++) {
        var g = _gestionesData[i];
        html += '<div class="gestion-item">';
        html += '<div class="gestion-timeline-dot"></div>';
        html += '<div class="gestion-content">';
        html += '<div class="gestion-header-line">';
        html += '<a href="/m/solicitudes?buscar=' + g.solicitud_id + '" class="gestion-id">#' + g.solicitud_id + '</a>';
        html += '<span class="gestion-tipo badge badge-blue">' + escapeHtmlMovil(g.tipo_gestion) + '</span>';
        html += '</div>';
        html += '<div class="gestion-cliente">' + escapeHtmlMovil(g.cliente_nombre || '—') + '</div>';
        html += '<div class="gestion-meta">';
        html += '<span>👤 ' + escapeHtmlMovil(g.agente_username || g.agente_nombre || '-') + '</span>';
        html += '<span>📅 ' + formatearFechaRelativa(g.fecha_gestion) + '</span>';
        html += '</div>';
        if (g.observacion) {
            html += '<div class="gestion-obs">' + escapeHtmlMovil(g.observacion.substring(0, 60)) + (g.observacion.length > 60 ? '...' : '') + '</div>';
        }
        html += '</div>';
        html += '</div>';
    }

    container.innerHTML = html;
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
// BOTTOM SHEET DETALLE DE AGENTE (MEJORADO con asignaciones detalladas)
// ============================================================================
function abrirDetalleAgente(index) {
    var agente = _agentesData[index];
    if (!agente) return;

    var activo = agente.is_active;
    var estadoClase = activo ? 'activo' : 'inactivo';
    var estadoTexto = activo ? '🟢 Activo' : '🔴 Inactivo';
    var estadoAccion = activo ? '🔴 Desactivar' : '🟢 Activar';
    var estadoAccionClase = activo ? 'equipo-detalle-btn-danger' : 'equipo-detalle-btn-success';
    var nombreMostrar = agente.nombre || agente.username || 'Sin nombre';
    var asignadas = parseInt(agente.asignadas || 0);
    var gestiones7d = parseInt(agente.gestiones_7d || 0);

    var bodyHtml = '';

    // Header del detalle
    bodyHtml += '<div class="equipo-detalle-header">';
    bodyHtml += '<div class="equipo-detalle-avatar equipo-agente-avatar ' + estadoClase + '">👤</div>';
    bodyHtml += '<div class="equipo-detalle-info">';
    bodyHtml += '<h3>' + escapeHtmlMovil(nombreMostrar) + '</h3>';
    bodyHtml += '<p>@' + escapeHtmlMovil(agente.username) + ' · ' + estadoTexto + '</p>';
    bodyHtml += '</div>';
    bodyHtml += '</div>';

    // Resumen de stats
    bodyHtml += '<div class="equipo-agente-stats" style="margin-bottom:16px;">';
    bodyHtml += '<div class="equipo-agente-stat">';
    bodyHtml += '<span class="equipo-agente-stat-value">' + asignadas + '</span>';
    bodyHtml += '<span class="equipo-agente-stat-label">📋 Asignadas</span>';
    bodyHtml += '</div>';
    bodyHtml += '<div class="equipo-agente-stat">';
    bodyHtml += '<span class="equipo-agente-stat-value">' + gestiones7d + '</span>';
    bodyHtml += '<span class="equipo-agente-stat-label">📝 Gestiones (7d)</span>';
    bodyHtml += '</div>';
    bodyHtml += '</div>';

    // Acciones
    bodyHtml += '<div class="equipo-detalle-actions">';

    // Ver asignaciones detalladas (igual que Desktop)
    bodyHtml += '<button class="equipo-detalle-btn" onclick="event.stopPropagation(); cerrarSheetDetalle(); verAsignacionesAgenteMovil(' + agente.id + ', \'' + escapeHtmlMovil(agente.username) + '\')">';
    bodyHtml += '<span class="equipo-detalle-btn-icon">📋</span>';
    bodyHtml += 'Ver Asignaciones Detalladas';
    bodyHtml += '</button>';

    // Ver campañas asignadas
    bodyHtml += '<button class="equipo-detalle-btn" onclick="event.stopPropagation(); cerrarSheetDetalle(); verCampanasAgente(' + agente.id + ', \'' + escapeHtmlMovil(agente.username) + '\')">';
    bodyHtml += '<span class="equipo-detalle-btn-icon">📢</span>';
    bodyHtml += 'Ver Campañas Asignadas';
    bodyHtml += '</button>';

    // Editar agente
    bodyHtml += '<button class="equipo-detalle-btn" onclick="event.stopPropagation(); cerrarSheetDetalle(); editarAgente(' + agente.id + ', \'' + escapeHtmlMovil(agente.username) + '\', \'' + escapeHtmlMovil(agente.nombre || '') + '\')">';
    bodyHtml += '<span class="equipo-detalle-btn-icon">✏️</span>';
    bodyHtml += 'Editar Agente';
    bodyHtml += '</button>';

    // Reset password
    bodyHtml += '<button class="equipo-detalle-btn" onclick="event.stopPropagation(); cerrarSheetDetalle(); resetPasswordAgente(' + agente.id + ', \'' + escapeHtmlMovil(agente.username) + '\')">';
    bodyHtml += '<span class="equipo-detalle-btn-icon">🔑</span>';
    bodyHtml += 'Cambiar Contraseña';
    bodyHtml += '</button>';

    bodyHtml += '<div class="equipo-detalle-divider"></div>';

    // Activar/Desactivar
    bodyHtml += '<button class="equipo-detalle-btn ' + estadoAccionClase + '" onclick="event.stopPropagation(); cerrarSheetDetalle(); toggleActivoAgente(' + agente.id + ', ' + (activo ? 'false' : 'true') + ', \'' + escapeHtmlMovil(agente.username) + '\')">';
    bodyHtml += '<span class="equipo-detalle-btn-icon">' + (activo ? '🔴' : '🟢') + '</span>';
    bodyHtml += estadoAccion;
    bodyHtml += '</button>';

    bodyHtml += '</div>';

    mostrarSheetMovil('👤 ' + escapeHtmlMovil(agente.username), bodyHtml);
}

// ============================================================================
// VER ASIGNACIONES DETALLADAS (como en Desktop)
// ============================================================================
async function verAsignacionesAgenteMovil(agenteId, username) {
    mostrarToastMovil('📋 Cargando asignaciones...');
    try {
        var dashRes = await fetch('/api/equipos/' + _equipoId + '/dashboard');
        if (!dashRes.ok) throw new Error('Error');
        var data = await dashRes.json();

        var agente = (data.agentes || []).find(function(a) { return a.id == agenteId; });
        if (!agente) {
            mostrarToastMovil('⚠️ No se encontró información del agente');
            return;
        }

        var asignadas = parseInt(agente.asignadas || 0);
        var gestiones7d = parseInt(agente.gestiones_7d || 0);

        var bodyHtml = '';
        bodyHtml += '<div style="padding:8px 0;">';
        bodyHtml += '<div class="asignaciones-detalle-card">';
        bodyHtml += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">';
        bodyHtml += '<div style="background:#ecfdf5;padding:16px;border-radius:10px;border:1px solid #a7f3d0;text-align:center;">';
        bodyHtml += '<div style="font-size:28px;font-weight:700;color:#065f46;">' + asignadas.toLocaleString() + '</div>';
        bodyHtml += '<div style="font-size:11px;color:#047857;font-weight:600;margin-top:4px;">📋 Solicitudes Asignadas</div>';
        bodyHtml += '</div>';
        bodyHtml += '<div style="background:#ede9fe;padding:16px;border-radius:10px;border:1px solid #ddd6fe;text-align:center;">';
        bodyHtml += '<div style="font-size:28px;font-weight:700;color:#5b21b6;">' + gestiones7d.toLocaleString() + '</div>';
        bodyHtml += '<div style="font-size:11px;color:#6d28d9;font-weight:600;margin-top:4px;">📝 Gestiones (7 días)</div>';
        bodyHtml += '</div>';
        bodyHtml += '</div>';
        bodyHtml += '<a href="/m/solicitudes?usuario=' + agenteId + '" style="display:flex;align-items:center;justify-content:center;gap:8px;padding:12px;margin-top:12px;background:#6366f1;color:white;border-radius:10px;text-decoration:none;font-weight:600;font-size:13px;">';
        bodyHtml += '📋 Ver todas las solicitudes de ' + escapeHtmlMovil(username);
        bodyHtml += '</a>';
        bodyHtml += '</div>';
        bodyHtml += '</div>';

        mostrarSheetMovil('📋 Asignaciones de ' + escapeHtmlMovil(username), bodyHtml);

    } catch (err) {
        console.error('[Equipo Móvil] Error cargando asignaciones:', err);
        mostrarToastMovil('⚠️ Error al cargar asignaciones');
    }
}

// ============================================================================
// BOTTOM SHEET MÓVIL
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
// ACCIONES DE AGENTE (usan _equipoId global)
// ============================================================================

// Ver campañas del agente
async function verCampanasAgente(agenteId, username) {
    mostrarToastMovil('📢 Cargando campañas de ' + username + '...');
    try {
        var campRes = await fetch('/api/equipos/' + _equipoId + '/campanas');
        var campData = await campRes.json();
        var campañas = campData.data || [];
        var asignadas = campañas.filter(function(c) { return String(c.asignado_a) === String(agenteId); });

        var bodyHtml = '';
        if (asignadas.length === 0) {
            bodyHtml = '<div style="text-align:center;padding:30px 0;color:#6b7280;">';
            bodyHtml += '<div style="font-size:40px;margin-bottom:10px;">📢</div>';
            bodyHtml += '<p style="font-size:14px;">' + escapeHtmlMovil(username) + ' no tiene campañas asignadas.</p>';
            bodyHtml += '</div>';
        } else {
            bodyHtml += '<div style="margin-bottom:12px;font-size:13px;color:#6b7280;">📊 Total: ' + asignadas.length + ' campaña(s)</div>';
            for (var i = 0; i < asignadas.length; i++) {
                var c = asignadas[i];
                var total = parseInt(c.total_solicitudes || 0);
                var gestionadas = parseInt(c.gestionadas || 0);
                var pct = total > 0 ? Math.round((gestionadas / total) * 100) : 0;
                bodyHtml += '<div style="background:#f9fafb;border-radius:10px;padding:12px;margin-bottom:8px;border:1px solid #f3f4f6;">';
                bodyHtml += '<div style="font-weight:700;font-size:13px;color:#1f2937;margin-bottom:6px;">#' + c.id + ' ' + escapeHtmlMovil(c.nombre_campana || 'Campaña') + '</div>';
                bodyHtml += '<div style="font-size:11px;color:#6b7280;">📄 ' + total + ' · ✓ ' + gestionadas + ' · 📊 ' + pct + '%</div>';
                bodyHtml += '<div style="margin-top:6px;height:4px;background:#e5e7eb;border-radius:2px;overflow:hidden;">';
                bodyHtml += '<div style="height:100%;width:' + pct + '%;background:#10b981;border-radius:2px;transition:width 0.3s;"></div>';
                bodyHtml += '</div></div>';
            }
        }
        mostrarSheetMovil('📢 Campañas de ' + escapeHtmlMovil(username), bodyHtml);
    } catch (err) {
        console.error('[Equipo Móvil] Error cargando campañas:', err);
        mostrarToastMovil('⚠️ Error al cargar campañas');
    }
}

// Editar agente
function editarAgente(agenteId, username, nombreActual) {
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
    bodyHtml += '<button class="equipo-detalle-btn" style="background:#6366f1;color:white;justify-content:center;margin-top:8px;" onclick="guardarEdicionAgente(' + agenteId + ')">';
    bodyHtml += '<span class="equipo-detalle-btn-icon">💾</span> Guardar Cambios';
    bodyHtml += '</button>';
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
        } else {
            var errData = await res.json();
            mostrarToastMovil('⚠️ ' + (errData.error || 'Error al actualizar'));
        }
    } catch (err) {
        console.error('[Equipo Móvil] Error editando agente:', err);
        mostrarToastMovil('⚠️ Error de conexión');
    }
}

// Reset password
function resetPasswordAgente(agenteId, username) {
    var bodyHtml = '';
    bodyHtml += '<div style="padding:8px 0;">';
    bodyHtml += '<p style="font-size:13px;color:#6b7280;margin-bottom:14px;">Nueva contraseña para <strong>' + escapeHtmlMovil(username) + '</strong></p>';
    bodyHtml += '<div class="equipo-form-group-movil">';
    bodyHtml += '<label>Nueva contraseña</label>';
    bodyHtml += '<input type="text" id="reset-password-input" placeholder="Mín 8 carac., mayúscula y número">';
    bodyHtml += '</div>';
    bodyHtml += '<button class="equipo-detalle-btn" style="background:#6366f1;color:white;justify-content:center;" onclick="guardarResetPassword(' + agenteId + ')">';
    bodyHtml += '<span class="equipo-detalle-btn-icon">🔑</span> Cambiar Contraseña';
    bodyHtml += '</button>';
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

// Toggle activo/inactivo
async function toggleActivoAgente(agenteId, nuevoEstado, username) {
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
// NAVEGACIÓN
// ============================================================================
function irASolicitudes() {
    window.location.href = '/m/solicitudes';
}

function irAImportar() {
    window.location.href = '/m/importar';
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

    var kpiValues = document.querySelectorAll('.equipo-kpi-value');
    for (var i = 0; i < kpiValues.length; i++) kpiValues[i].textContent = '...';

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
