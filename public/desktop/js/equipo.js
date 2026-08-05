// ============================================================================
// PANEL DEL LÍDER - ARCHIVOX v3.0
// Gestión de equipo: dashboard, agentes, campañas, asignaciones
// ============================================================================

// ============================================================================
// INICIALIZACIÓN
// ============================================================================
document.addEventListener('DOMContentLoaded', async function() {
    try {
        // Verificar sesión y rol
        const sesRes = await fetch('/api/auth/sesion');
        if (!sesRes.ok) throw new Error('Error al verificar sesión');
        const sesion = await sesRes.json();

        if (!sesion.autenticado) {
            window.location.href = '/login';
            return;
        }

        const user = sesion.usuario;

        // Verificar que el usuario tiene equipo y es líder
        if (!user.equipo_id) {
            document.querySelector('.equipo-container').innerHTML = `
                <div style="text-align:center;padding:60px 20px;">
                    <div style="font-size:64px;margin-bottom:20px;">🏢</div>
                    <h2 style="color:#1f2937;margin-bottom:8px;">Sin Equipo Asignado</h2>
                    <p style="color:#6b7280;">No perteneces a ningún equipo. Contacta al administrador.</p>
                </div>
            `;
            return;
        }

        if (!user.es_lider && user.rol !== 'superadmin' && user.rol !== 'admin') {
            window.location.href = '/';
            return;
        }

        // Mostrar badge de líder
        if (user.es_lider || user.rol === 'superadmin' || user.rol === 'admin') {
            document.getElementById('liderBadge').style.display = 'inline-flex';
        }

        // Cargar datos del equipo
        await cargarEquipo();
        await cargarDashboard();
        await cargarAgentes();
        await cargarCampanas();
        await cargarGestiones();
        initEquipoCarousel();

    } catch (err) {
        console.error('[Equipo] Error en inicialización:', err);
        document.querySelector('.equipo-container').innerHTML = `
            <div style="text-align:center;padding:60px 20px;">
                <div style="font-size:64px;margin-bottom:20px;">⚠️</div>
                <h2 style="color:#dc2626;margin-bottom:8px;">Error al cargar</h2>
                <p style="color:#6b7280;">${escapeHtml(err.message)}</p>
                <button onclick="location.reload()" style="margin-top:16px;padding:10px 24px;background:#6366f1;color:white;border:none;border-radius:8px;cursor:pointer;">Reintentar</button>
            </div>
        `;
    }
});

// ============================================================================
// CARGAR INFORMACIÓN DEL EQUIPO
// ============================================================================
async function cargarEquipo() {
    try {
        const res = await fetch('/api/equipos/mi-equipo');
        const data = await res.json();

        if (data.equipo === null) {
            document.getElementById('equipoNombre').textContent = 'Sin equipo';
            document.getElementById('equipoDesc').textContent = data.mensaje || 'No perteneces a ningún equipo';
            return;
        }

        document.getElementById('equipoNombre').textContent = `🏢 ${escapeHtml(data.nombre)}`;
        document.getElementById('equipoDesc').textContent = data.descripcion || 'Panel de gestión de equipo';
        window._equipoId = data.id;
        window._esLider = !!data.es_lider;

    } catch (err) {
        console.error('[Equipo] Error cargar equipo:', err);
    }
}

// ============================================================================
// CARGAR DASHBOARD (stats cards)
// ============================================================================
async function cargarDashboard() {
    try {
        const equipoId = window._equipoId;
        if (!equipoId) return;

        const res = await fetch(`/api/equipos/${equipoId}/dashboard`);
        if (!res.ok) throw new Error('Error ' + res.status);
        const data = await res.json();

        document.getElementById('totalAgentes').textContent = (data.agentes?.length || 0).toLocaleString();
        document.getElementById('totalAsignaciones').textContent = (data.totales?.asignadas || 0).toLocaleString();
        document.getElementById('totalCampanas').textContent = (data.campañas?.length || 0).toLocaleString();

        // Sumar gestiones de los últimos 7 días
        const gestiones7d = data.agentes?.reduce((acc, a) => acc + parseInt(a.gestiones_7d || 0), 0) || 0;
        document.getElementById('totalGestiones').textContent = gestiones7d.toLocaleString();

    } catch (err) {
        console.error('[Equipo] Error cargar dashboard:', err);
        document.querySelectorAll('.equipo-kpi-info span').forEach(s => s.textContent = '—');
    }
}

// ============================================================================
// CARGAR AGENTES (solo datos + contador del header; la UI vive en el panel)
// ============================================================================
async function cargarAgentes() {
    try {
        const equipoId = window._equipoId;
        if (!equipoId) return;

        const res = await fetch(`/api/equipos/${equipoId}/dashboard`);
        if (!res.ok) throw new Error('Error ' + res.status);
        const data = await res.json();

        _agentesData = data.agentes || [];

        const contador = document.getElementById('agentesHeaderCount');
        if (contador) contador.textContent = _agentesData.length;

    } catch (err) {
        console.error('[Equipo] Error cargar agentes:', err);
    }
}

// ============================================================================
// CARGAR CAMPAÑAS DEL EQUIPO
// ============================================================================
async function cargarCampanas() {
    const tbody = document.getElementById('campanasEquipoBody');

    try {
        const equipoId = window._equipoId;
        if (!equipoId) {
            tbody.innerHTML = '<tr><td colspan="8" class="equipo-loading">Sin equipo asignado</td></tr>';
            return;
        }

        const res = await fetch(`/api/equipos/${equipoId}/campanas`);
        if (!res.ok) throw new Error('Error ' + res.status);
        const data = await res.json();

        const campanas = data.data || [];

        if (campanas.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" class="equipo-loading">No hay campañas asociadas a tu equipo. ¡Crea la primera desde Campañas!</td></tr>';
            return;
        }

        tbody.innerHTML = campanas.map(c => {
            const total = parseInt(c.total_solicitudes || 0);
            const gestionadas = parseInt(c.gestionadas || 0);
            const progreso = total > 0 ? Math.round((gestionadas / total) * 100) : 0;
            const progresoCls = progreso >= 100 ? 'completa' : '';

            const estadoCls = c.estado === 'activa' ? 'activo' : 'inactivo';
            
            // Mostrar asignado a agente
            const asignadoHtml = c.asignado_a 
                ? '<span style="color:#059669;font-weight:600;">👤 ' + escapeHtml(c.asignado_username || 'Agente #' + c.asignado_a) + '</span>'
                : '<span style="color:#9ca3af;">⬜ Sin asignar</span>';

            return `<tr>
                <td style="color:#6b7280;">#${c.id}</td>
                <td><strong>${escapeHtml(c.nombre_campana || 'Campaña #' + c.id)}</strong></td>
                <td>${escapeHtml(c.agente_username || '-')}</td>
                <td>${asignadoHtml}</td>
                <td><strong>${total.toLocaleString()}</strong></td>
                <td><strong>${gestionadas.toLocaleString()}</strong></td>
                <td>
                    <div class="equipo-progress">
                        <div class="equipo-progress-bar">
                            <div class="equipo-progress-fill ${progresoCls}" style="width:${Math.min(progreso, 100)}%"></div>
                        </div>
                        <span class="equipo-progress-text">${progreso}%</span>
                    </div>
                </td>
                <td><span class="equipo-status-dot ${estadoCls}"></span>${escapeHtml(c.estado || 'activa')}</td>
                <td style="color:#6b7280;font-size:12px;">${formatearFecha(c.created_at)}</td>
            </tr>`;
        }).join('');

    } catch (err) {
        console.error('[Equipo] Error cargar campañas:', err);
        tbody.innerHTML = '<tr><td colspan="9" class="equipo-loading" style="color:#dc2626">Error al cargar campañas</td></tr>';
    }
}

// ============================================================================
// CARGAR GESTIONES RECIENTES DEL EQUIPO
// ============================================================================
let _gestionesLimite = 20;
let _gestionesEquipo = [];

async function cargarGestiones() {
    const feed = document.getElementById('gestionesFeed');

    try {
        const equipoId = window._equipoId;
        if (!equipoId) {
            feed.innerHTML = '<div class="equipo-loading">Sin equipo asignado</div>';
            return;
        }

        const res = await fetch(`/api/equipos/${equipoId}/gestiones?limite=${_gestionesLimite}`);
        if (!res.ok) throw new Error('Error ' + res.status);
        const data = await res.json();

        _gestionesEquipo = data.data || [];

        if (_gestionesEquipo.length === 0) {
            feed.innerHTML = '<div class="equipo-loading">No hay gestiones recientes del equipo</div>';
            ocultarCargarMas(true);
            return;
        }

        poblarFiltrosGestiones();
        renderizarFeedGestiones();
        ocultarCargarMas(_gestionesEquipo.length < _gestionesLimite);

    } catch (err) {
        console.error('[Equipo] Error cargar gestiones:', err);
        feed.innerHTML = '<div class="equipo-loading" style="color:#dc2626">Error al cargar gestiones</div>';
    }
}

function filtrarGestiones() {
    const agente = document.getElementById('filtroAgenteGestiones').value;
    const tipo = document.getElementById('filtroTipoGestiones').value;
    return _gestionesEquipo.filter(g =>
        (!agente || (g.agente_username || g.agente_nombre || '-') === agente) &&
        (!tipo || g.tipo_gestion === tipo)
    );
}

function renderizarFeedGestiones() {
    const feed = document.getElementById('gestionesFeed');
    const lista = filtrarGestiones();

    if (lista.length === 0) {
        feed.innerHTML = '<div class="equipo-loading">No hay gestiones que coincidan con el filtro</div>';
        return;
    }

    feed.innerHTML = lista.map(g => {
        const agente = g.agente_username || g.agente_nombre || '-';
        const obs = (g.observacion || '').trim();
        return `
            <a class="equipo-feed-item" href="/solicitudes?buscar=${encodeURIComponent(g.solicitud_id)}">
                <div class="equipo-feed-avatar">${escapeHtml((agente[0] || '?').toUpperCase())}</div>
                <div class="equipo-feed-main">
                    <div class="equipo-feed-top">
                        <strong class="equipo-feed-agente">${escapeHtml(agente)}</strong>
                        <span class="equipo-feed-tipo tipo-${claseTipoGestion(g.tipo_gestion)}">${escapeHtml(g.tipo_gestion)}</span>
                        <span class="equipo-feed-fecha">${formatearFecha(g.fecha_gestion)}</span>
                    </div>
                    <div class="equipo-feed-cliente">#${g.solicitud_id} · ${escapeHtml(g.cliente_nombre || '—')}</div>
                    ${obs ? `<div class="equipo-feed-obs">${escapeHtml(obs.substring(0, 120))}${obs.length > 120 ? '...' : ''}</div>` : ''}
                </div>
                <span class="equipo-feed-chevron">›</span>
            </a>
        `;
    }).join('');
}

function poblarFiltrosGestiones() {
    const selAgente = document.getElementById('filtroAgenteGestiones');
    const selTipo = document.getElementById('filtroTipoGestiones');

    const agentes = [...new Set(_gestionesEquipo.map(g => g.agente_username || g.agente_nombre || '-'))].filter(Boolean);
    const tipos = [...new Set(_gestionesEquipo.map(g => g.tipo_gestion).filter(Boolean))];

    const actAgente = selAgente.value;
    const actTipo = selTipo.value;

    selAgente.innerHTML = '<option value="">Todos los agentes</option>' +
        agentes.map(a => `<option value="${escapeHtml(a)}">${escapeHtml(a)}</option>`).join('');
    selTipo.innerHTML = '<option value="">Todos los tipos</option>' +
        tipos.map(t => `<option value="${escapeHtml(t)}">${escapeHtml(t)}</option>`).join('');

    selAgente.value = agentes.includes(actAgente) ? actAgente : '';
    selTipo.value = tipos.includes(actTipo) ? actTipo : '';
}

function claseTipoGestion(tipo) {
    const t = String(tipo || '').toLowerCase();
    if (t.includes('complet')) return 'completada';
    if (t.includes('llamada')) return 'llamada';
    if (t.includes('seguimient')) return 'seguimiento';
    if (t.includes('visita')) return 'visita';
    return 'otro';
}

function ocultarCargarMas(ocultar) {
    const btn = document.getElementById('btnCargarMasGestiones');
    if (btn) btn.style.display = ocultar ? 'none' : '';
}

async function cargarMasGestiones() {
    _gestionesLimite += 20;
    await cargarGestiones();
}

// ============================================================================
// PASARELA DE KPIs (patrón carrusel del dashboard)
// Navegación: dots + flechas ‹ › con loop, sin autoplay.
// ============================================================================
function igualarAlturaEquipoSlides() {
    const track = document.getElementById('equipoTrack');
    if (!track) return;
    const slides = track.querySelectorAll('.equipo-slide');
    if (slides.length < 2) return;
    track.style.height = 'auto';
    let max = 0;
    slides.forEach(s => { max = Math.max(max, s.offsetHeight); });
    if (max > 0) track.style.height = max + 'px';
}

function initEquipoCarousel() {
    const track = document.getElementById('equipoTrack');
    if (!track) return;
    const slides = track.querySelectorAll('.equipo-slide');
    const dots = Array.prototype.slice.call(document.querySelectorAll('.equipo-dot'));
    const prev = document.getElementById('equipoPrev');
    const next = document.getElementById('equipoNext');
    if (slides.length < 2 || !dots.length) return;
    let step = slides[1].offsetLeft - slides[0].offsetLeft;

    function indiceActual() {
        return Math.max(0, Math.min(dots.length - 1, Math.round(track.scrollLeft / step)));
    }

    function irA(index) {
        track.scrollTo({ left: index * step, behavior: 'smooth' });
    }

    function actualizarDotActivo() {
        const index = indiceActual();
        dots.forEach((dot, i) => {
            dot.classList.toggle('active', i === index);
        });
    }

    track.addEventListener('scroll', actualizarDotActivo, { passive: true });

    dots.forEach((dot, i) => {
        dot.addEventListener('click', () => irA(i));
    });

    if (prev) {
        prev.addEventListener('click', () => {
            const i = indiceActual() - 1;
            irA(i < 0 ? slides.length - 1 : i);
        });
    }
    if (next) {
        next.addEventListener('click', () => {
            const i = indiceActual() + 1;
            irA(i >= slides.length ? 0 : i);
        });
    }

    window.addEventListener('resize', () => {
        step = slides[1].offsetLeft - slides[0].offsetLeft;
        actualizarDotActivo();
        igualarAlturaEquipoSlides();
    });

    igualarAlturaEquipoSlides();
}

// ============================================================================
// PANEL LATERAL DE AGENTES (escritorio)
// Gestión completa fuera de la pasarela: lista, crear, editar,
// activar/desactivar, reset de contraseña y asignaciones.
// ============================================================================
let _agentesData = [];
let _panelAgentesAbierto = false;
let _panelAgentesEscAttached = false;

function crearEstructuraPanelAgentes() {
    let existente = document.getElementById('panel-agentes-overlay');
    if (existente) return existente;

    const html = `
        <div class="panel-agentes-overlay" id="panel-agentes-overlay" onclick="cerrarPanelAgentes()">
            <aside class="panel-agentes" onclick="event.stopPropagation()">
                <div class="panel-agentes-header">
                    <div class="panel-agentes-titulo">
                        <span class="panel-agentes-titulo-icono">👥</span>
                        <span id="panel-agentes-titulo">Agentes del Equipo</span>
                    </div>
                    <button class="panel-agentes-close" onclick="cerrarPanelAgentes()" aria-label="Cerrar">✕</button>
                </div>
                <div class="panel-agentes-body" id="panel-agentes-body">
                    <div class="panel-agentes-loading">⏳ Cargando agentes...</div>
                </div>
            </aside>
        </div>`;

    // insertAdjacentHTML: robusto ante whitespace inicial (wrapper.firstChild
    // puede ser un nodo de texto con los saltos de línea del template literal)
    document.body.insertAdjacentHTML('beforeend', html);

    requestAnimationFrame(() => {
        const overlay = document.getElementById('panel-agentes-overlay');
        const aside = overlay ? overlay.querySelector('.panel-agentes') : null;
        if (overlay) overlay.classList.add('abierto-overlay');
        if (aside) aside.classList.add('abierto');
    });

    document.body.style.overflow = 'hidden';
    _panelAgentesAbierto = true;

    if (!_panelAgentesEscAttached) {
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape' && _panelAgentesAbierto) cerrarPanelAgentes();
        });
        _panelAgentesEscAttached = true;
    }

    return document.getElementById('panel-agentes-overlay');
}

async function abrirPanelAgentes() {
    crearEstructuraPanelAgentes();
    const body = document.getElementById('panel-agentes-body');
    body.innerHTML = '<div class="panel-agentes-loading">⏳ Cargando agentes...</div>';

    try {
        const equipoId = window._equipoId;
        if (!equipoId) {
            body.innerHTML = '<div class="panel-agentes-loading">Sin equipo asignado</div>';
            return;
        }

        const [dashRes, miembrosRes] = await Promise.all([
            fetch(`/api/equipos/${equipoId}/dashboard`),
            fetch(`/api/equipos/${equipoId}/miembros`)
        ]);

        if (!dashRes.ok) throw new Error('Error al cargar agentes (' + dashRes.status + ')');
        const dashData = await dashRes.json();
        const miembrosData = dashRes.ok ? ((await miembrosRes.json()).data || []) : [];
        const mapaMiembros = {};
        miembrosData.forEach(m => { mapaMiembros[m.usuario_id] = m; });

        _agentesData = (dashData.agentes || []).map(a => Object.assign({}, a, {
            email: mapaMiembros[a.id] ? mapaMiembros[a.id].email : undefined,
            fecha_ingreso: mapaMiembros[a.id] ? mapaMiembros[a.id].fecha_ingreso : undefined
        }));

        const contador = document.getElementById('agentesHeaderCount');
        if (contador) contador.textContent = _agentesData.length;

        renderPanelAgentesLista();
    } catch (err) {
        console.error('[Equipo] Error abrir panel agentes:', err);
        body.innerHTML = '<div class="panel-agentes-loading" style="color:#dc2626">Error al cargar agentes</div>';
    }
}

function cerrarPanelAgentes() {
    const overlay = document.getElementById('panel-agentes-overlay');
    if (!overlay) return;
    const aside = overlay.querySelector('.panel-agentes');
    if (aside) aside.classList.remove('abierto');
    overlay.classList.remove('abierto-overlay');
    _panelAgentesAbierto = false;
    document.body.style.overflow = '';

    setTimeout(() => {
        const ov = document.getElementById('panel-agentes-overlay');
        if (ov && !_panelAgentesAbierto) ov.remove();
    }, 300);
}

// ── Vista Lista ──
function renderPanelAgentesLista() {
    const body = document.getElementById('panel-agentes-body');
    document.getElementById('panel-agentes-titulo').textContent = 'Agentes del Equipo';

    if (!_agentesData.length) {
        body.innerHTML = `
            <div class="panel-agentes-vacio">
                <div class="panel-agentes-vacio-icono">👥</div>
                <h3>No hay agentes</h3>
                <p>Crea el primer agente de tu equipo.</p>
                <button class="equipo-btn equipo-btn-primary" onclick="nuevoAgenteEnPanel()">➕ Nuevo Agente</button>
            </div>`;
        return;
    }

    let html = `<button class="panel-agentes-nuevo" onclick="nuevoAgenteEnPanel()">
                    <span class="panel-agentes-nuevo-icono">➕</span> Nuevo Agente
                </button>`;
    html += '<div class="panel-agentes-lista">';

    _agentesData.forEach(a => {
        const activo = !!a.is_active;
        const estado = activo ? 'activo' : 'inactivo';
        const inicial = escapeHtml(((a.nombre || a.username || '?').trim()[0] || '?').toUpperCase());
        const ingreso = formatearFecha(a.fecha_ingreso) || '-';
        const asignadas = parseInt(a.asignadas || 0).toLocaleString();
        const gestiones7d = parseInt(a.gestiones_7d || 0).toLocaleString();

        html += `
            <div class="panel-agente-card ${estado}">
                <div class="panel-agente-top">
                    <div class="panel-agente-avatar ${estado}">${inicial}</div>
                    <div class="panel-agente-info">
                        <span class="panel-agente-username">${escapeHtml(a.username)}</span>
                        <span class="panel-agente-nombre">${escapeHtml(a.nombre || '-')}</span>
                    </div>
                    <span class="panel-agente-badge ${estado}">${activo ? '●' : '○'} ${estado}</span>
                    <label class="panel-agente-switch" title="Activar/Desactivar agente">
                        <input type="checkbox" onchange="toggleActivoAgente(${a.id}, this)" ${activo ? 'checked' : ''}>
                        <span class="panel-agente-switch-slider"></span>
                    </label>
                </div>
                <div class="panel-agente-stats">
                    <div class="panel-agente-stat"><b>${asignadas}</b>📋 Asignadas</div>
                    <div class="panel-agente-stat"><b>${gestiones7d}</b>📝 Gestiones 7d</div>
                </div>
                <div class="panel-agente-ingreso">📅 Ingreso: ${escapeHtml(ingreso)}</div>
                <div class="panel-agente-acciones">
                    <button class="panel-agente-btn panel-agente-btn-primary" onclick="verAsignacionesAgente(${a.id}, '${escapeHtml(a.username)}')">📋 Asignaciones</button>
                    <button class="panel-agente-btn panel-agente-btn-secondary" onclick="editarAgenteEnPanel(${a.id})">✏️ Editar</button>
                </div>
            </div>`;
    });

    html += '</div>';
    body.innerHTML = html;
}

// ── Vista Formulario (Nuevo / Editar) ──
function nuevoAgenteEnPanel() {
    renderPanelFormAgente('nuevo', null);
}

function editarAgenteEnPanel(agenteId) {
    const agente = _agentesData.find(a => a.id == agenteId);
    if (!agente) return;
    renderPanelFormAgente('editar', agente);
}

function renderPanelFormAgente(modo, agente) {
    const body = document.getElementById('panel-agentes-body');
    const titulo = document.getElementById('panel-agentes-titulo');
    const esNuevo = modo === 'nuevo';

    titulo.textContent = esNuevo ? '➕ Nuevo Agente' : '✏️ Editar: ' + (agente.username || '');

    const usernameField = esNuevo ? `
        <div class="equipo-form-group">
            <label>Usuario *</label>
            <input type="text" id="panelAgenteUsername" placeholder="Nombre de usuario" autocomplete="off">
        </div>` : '';

    const passwordField = esNuevo ? `
        <div class="equipo-form-group">
            <label>Contraseña *</label>
            <input type="text" id="panelAgentePassword" placeholder="Mín 8 caracteres, mayúscula y número" autocomplete="off">
        </div>` : `
        <div class="panel-agentes-seccion">
            <h3>🔑 Cambiar contraseña <span>(opcional)</span></h3>
            <div class="equipo-form-group">
                <label>Nueva contraseña</label>
                <input type="text" id="panelAgentePassword" placeholder="Déjalo vacío para no cambiarla" autocomplete="off">
            </div>
        </div>`;

    const submitHandler = esNuevo ? 'crearAgente()' : 'guardarAgenteEdicion(' + (agente ? agente.id : '') + ')';

    body.innerHTML = `
        <button class="panel-agentes-volver" onclick="renderPanelAgentesLista()">← Volver a la lista</button>
        <form class="panel-agentes-form" onsubmit="event.preventDefault(); ${submitHandler}">
            ${usernameField}
            <div class="equipo-form-group">
                <label>Nombre</label>
                <input type="text" id="panelAgenteNombre" placeholder="Nombre completo" autocomplete="off" value="${esNuevo ? '' : escapeHtml(agente.nombre || '')}">
            </div>
            <div class="equipo-form-group">
                <label>Email (opcional)</label>
                <input type="email" id="panelAgenteEmail" placeholder="correo@ejemplo.com" autocomplete="off" value="${esNuevo ? '' : escapeHtml(agente.email || '')}">
            </div>
            ${passwordField}
            <button type="submit" class="panel-agentes-submit">${esNuevo ? '➕ Crear Agente' : '💾 Guardar Cambios'}</button>
        </form>`;

    if (esNuevo) {
        const u = document.getElementById('panelAgenteUsername');
        if (u) u.focus();
    }
}

async function crearAgente() {
    const equipoId = window._equipoId;
    if (!equipoId) return mostrarToast('⚠️ No hay equipo asignado', 'error');

    const username = document.getElementById('panelAgenteUsername').value.trim();
    const nombre = document.getElementById('panelAgenteNombre').value.trim();
    const password = document.getElementById('panelAgentePassword').value;
    const email = document.getElementById('panelAgenteEmail').value.trim() || null;

    if (!username || !password) return mostrarToast('⚠️ Usuario y contraseña son requeridos', 'error');
    if (password.length < 8) return mostrarToast('⚠️ La contraseña debe tener al menos 8 caracteres', 'error');
    if (!/[A-Z]/.test(password)) return mostrarToast('⚠️ La contraseña debe contener al menos una mayúscula', 'error');
    if (!/[0-9]/.test(password)) return mostrarToast('⚠️ La contraseña debe contener al menos un número', 'error');

    const btn = document.querySelector('.panel-agentes-submit');
    if (btn) { btn.disabled = true; btn.textContent = '⏳ Creando...'; }

    try {
        const res = await fetch(`/api/equipos/${equipoId}/agentes`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, nombre, password, email })
        });
        const result = await res.json();
        if (!res.ok) throw new Error(result.error || 'Error al crear agente');

        mostrarToast('✅ Agente creado: ' + username);
        await cargarDashboard();
        await abrirPanelAgentes();
    } catch (err) {
        console.error('[Equipo] Error crear agente:', err);
        mostrarToast('⚠️ ' + err.message, 'error');
        if (btn) { btn.disabled = false; btn.textContent = '➕ Crear Agente'; }
    }
}

// ============================================================================
// VER ASIGNACIONES DE UN AGENTE (dentro del panel)
// ============================================================================
async function verAsignacionesAgente(agenteId, username) {
    const body = document.getElementById('panel-agentes-body');
    const titulo = document.getElementById('panel-agentes-titulo');
    titulo.textContent = '📋 Asignaciones de ' + username;
    body.innerHTML = `
        <button class="panel-agentes-volver" onclick="renderPanelAgentesLista()">← Volver a la lista</button>
        <div class="panel-agentes-loading">Cargando información...</div>`;

    // Los datos ya están en memoria (los carga abrirPanelAgentes)
    const agente = _agentesData.find(a => a.id == agenteId);

    if (!agente) {
        body.innerHTML = `
            <button class="panel-agentes-volver" onclick="renderPanelAgentesLista()">← Volver a la lista</button>
            <div class="panel-agentes-vacio">
                <div class="panel-agentes-vacio-icono">👤</div>
                <h3>Sin información</h3>
                <p>No se encontró información del agente.</p>
            </div>`;
        return;
    }

    const asignadas = parseInt(agente.asignadas || 0);
    const gestiones7d = parseInt(agente.gestiones_7d || 0);

    body.innerHTML = `
        <button class="panel-agentes-volver" onclick="renderPanelAgentesLista()">← Volver a la lista</button>
        <div class="panel-agentes-asignaciones">
            <div class="asignaciones-agente-card">
                <div class="asignaciones-agente-header">
                    <span style="font-size:32px;">👤</span>
                    <div>
                        <div class="asignaciones-agente-nombre">${escapeHtml(username)}</div>
                        <div style="font-size:12px;color:#6b7280;">${escapeHtml(agente.nombre || '')}</div>
                    </div>
                </div>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:12px;">
                    <div style="background:#ecfdf5;padding:14px;border-radius:8px;border:1px solid #a7f3d0;text-align:center;">
                        <div style="font-size:28px;font-weight:700;color:#065f46;">${asignadas.toLocaleString()}</div>
                        <div style="font-size:12px;color:#047857;font-weight:600;">📋 Solicitudes Asignadas</div>
                    </div>
                    <div style="background:#ede9fe;padding:14px;border-radius:8px;border:1px solid #ddd6fe;text-align:center;">
                        <div style="font-size:28px;font-weight:700;color:#5b21b6;">${gestiones7d.toLocaleString()}</div>
                        <div style="font-size:12px;color:#6d28d9;font-weight:600;">📝 Gestiones (7 días)</div>
                    </div>
                </div>
                <div style="margin-top:16px;padding-top:16px;border-top:1px solid #e5e7eb;">
                    <a href="/solicitudes?usuario=${agenteId}" target="_blank" class="panel-agentes-link-solicitudes">
                        📋 Ver todas las solicitudes de ${escapeHtml(username)}
                    </a>
                </div>
            </div>
        </div>`;
}

// ============================================================================
// GUARDAR EDICIÓN DE AGENTE (nombre, email y contraseña opcional)
// ============================================================================
async function guardarAgenteEdicion(agenteId) {
    const equipoId = window._equipoId;
    const nombre = document.getElementById('panelAgenteNombre').value.trim();
    const email = document.getElementById('panelAgenteEmail').value.trim() || null;
    const nuevaPassword = document.getElementById('panelAgentePassword').value;

    // Validar la contraseña ANTES de guardar nada (evita guardados parciales)
    if (nuevaPassword && (nuevaPassword.length < 8 || !/[A-Z]/.test(nuevaPassword) || !/[0-9]/.test(nuevaPassword))) {
        mostrarToast('⚠️ Contraseña: mín 8 caracteres, una mayúscula y un número', 'error');
        return;
    }

    const btn = document.querySelector('.panel-agentes-submit');
    if (btn) { btn.disabled = true; btn.textContent = '⏳ Guardando...'; }

    try {
        const res = await fetch(`/api/equipos/${equipoId}/agentes/${agenteId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nombre, email })
        });
        const result = await res.json();
        if (!res.ok) throw new Error(result.error || 'Error al actualizar agente');

        if (nuevaPassword) {
            const pwdRes = await fetch(`/api/equipos/${equipoId}/agentes/${agenteId}/reset-password`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ nueva_password: nuevaPassword })
            });
            const pwdData = await pwdRes.json();
            if (!pwdRes.ok) throw new Error(pwdData.error || 'Error al cambiar contraseña');
        }

        mostrarToast('✅ Agente actualizado');
        await cargarDashboard();
        await abrirPanelAgentes();
    } catch (err) {
        console.error('[Equipo] Error editar agente:', err);
        mostrarToast('⚠️ ' + err.message, 'error');
        if (btn) { btn.disabled = false; btn.textContent = '💾 Guardar Cambios'; }
    }
}

// ============================================================================
// ACTIVAR / DESACTIVAR AGENTE
// ============================================================================
async function toggleActivoAgente(agenteId, checkbox) {
    const equipoId = window._equipoId;
    const accion = checkbox.checked ? 'activar' : 'desactivar';
    const agente = _agentesData.find(a => a.id == agenteId);
    if (!confirm(`¿Seguro que deseas ${accion} al agente ${agente ? agente.username : ''}?`)) {
        checkbox.checked = !checkbox.checked;
        return;
    }

    try {
        const res = await fetch(`/api/equipos/${equipoId}/agentes/${agenteId}/toggle-active`, {
            method: 'PUT'
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Error al cambiar estado');

        const idx = _agentesData.findIndex(a => a.id == agenteId);
        if (idx >= 0) _agentesData[idx].is_active = data.is_active;

        mostrarToast('✅ ' + data.mensaje);
        await cargarDashboard();
        renderPanelAgentesLista();
    } catch (err) {
        console.error('[Equipo] Error toggle agente:', err);
        checkbox.checked = !checkbox.checked;
        mostrarToast('⚠️ ' + err.message, 'error');
    }
}

// ============================================================================
// HELPERS
// ============================================================================
function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/[&<>"']/g, function(c) {
        return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c] || c;
    });
}

function formatearFecha(fecha) {
    if (!fecha) return '';
    try {
        const d = new Date(fecha);
        if (isNaN(d.getTime())) return fecha;
        return d.toLocaleDateString('es-ES', {
            day: '2-digit', month: '2-digit', year: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });
    } catch(e) { return fecha; }
}

// Toast notifications (tipo: 'success' por defecto, 'error' para fallos)
function mostrarToast(mensaje, tipo) {
    const existing = document.querySelector('.equipo-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = 'equipo-toast';
    toast.textContent = mensaje;
    toast.style.cssText = `
        position: fixed; bottom: 24px; right: 24px;
        padding: 12px 20px; border-radius: 10px;
        background: ${tipo === 'error' ? '#ef4444' : '#10b981'}; color: white;
        font-weight: 600; font-size: 13px;
        box-shadow: 0 4px 20px rgba(0,0,0,0.3);
        z-index: 9999;
        animation: slideIn 0.3s ease;
    `;

    document.body.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transition = 'opacity 0.3s';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}
