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
// CARGAR AGENTES
// ============================================================================
async function cargarAgentes() {
    const tbody = document.getElementById('agentesTableBody');

    try {
        const equipoId = window._equipoId;
        if (!equipoId) {
            tbody.innerHTML = '<tr><td colspan="7" class="equipo-loading">Sin equipo asignado</td></tr>';
            return;
        }

        const res = await fetch(`/api/equipos/${equipoId}/dashboard`);
        if (!res.ok) throw new Error('Error ' + res.status);
        const data = await res.json();

        const agentes = data.agentes || [];

        if (agentes.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" class="equipo-loading">No hay agentes en tu equipo. ¡Crea el primero!</td></tr>';
            return;
        }

        tbody.innerHTML = agentes.map(a => {
            const estado = a.is_active ? 'activo' : 'inactivo';
            return `<tr>
                <td><strong>${escapeHtml(a.username)}</strong></td>
                <td>${escapeHtml(a.nombre || '-')}</td>
                <td><span class="equipo-status-dot ${estado}"></span><span style="text-transform:capitalize">${estado}</span></td>
                <td><strong>${parseInt(a.asignadas || 0).toLocaleString()}</strong></td>
                <td><strong>${parseInt(a.gestiones_7d || 0).toLocaleString()}</strong></td>
                <td style="color:#6b7280;font-size:12px;">${formatearFecha(a.fecha_ingreso) || '-'}</td>
                <td>
                    <button class="equipo-action-btn equipo-action-btn-primary" onclick="verAsignacionesAgente(${a.id}, '${escapeHtml(a.username)}')" title="Ver asignaciones">
                        📋 Asignaciones
                    </button>
                </td>
            </tr>`;
        }).join('');

    } catch (err) {
        console.error('[Equipo] Error cargar agentes:', err);
        tbody.innerHTML = '<tr><td colspan="7" class="equipo-loading" style="color:#dc2626">Error al cargar agentes</td></tr>';
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
// CREAR AGENTE
// ============================================================================
function abrirModalCrearAgente() {
    document.getElementById('createAgenteUsername').value = '';
    document.getElementById('createAgenteNombre').value = '';
    document.getElementById('createAgentePassword').value = '';
    document.getElementById('createAgenteEmail').value = '';
    document.getElementById('createAgenteModal').style.display = 'flex';
}

function cerrarModalCrearAgente(event) {
    if (event && event.target !== event.currentTarget) return;
    document.getElementById('createAgenteModal').style.display = 'none';
}

async function crearAgente() {
    const equipoId = window._equipoId;
    if (!equipoId) return alert('No hay equipo asignado');

    const username = document.getElementById('createAgenteUsername').value.trim();
    const nombre = document.getElementById('createAgenteNombre').value.trim();
    const password = document.getElementById('createAgentePassword').value;
    const email = document.getElementById('createAgenteEmail').value.trim() || null;

    if (!username || !password) return alert('Usuario y contraseña son requeridos');
    if (password.length < 8) return alert('La contraseña debe tener al menos 8 caracteres');
    if (!/[A-Z]/.test(password)) return alert('La contraseña debe contener al menos una mayúscula');
    if (!/[0-9]/.test(password)) return alert('La contraseña debe contener al menos un número');

    try {
        const res = await fetch(`/api/equipos/${equipoId}/agentes`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, nombre, password, email })
        });

        const result = await res.json();

        if (res.ok) {
            cerrarModalCrearAgente();
            await cargarAgentes();
            await cargarDashboard();
            mostrarToast('✅ Agente creado: ' + username);
        } else {
            alert(result.error || 'Error al crear agente');
        }
    } catch (err) {
        console.error('[Equipo] Error crear agente:', err);
        alert('Error de conexión');
    }
}

// ============================================================================
// VER ASIGNACIONES DE UN AGENTE
// ============================================================================
// Usa el dashboard del equipo para mostrar resumen y enlace a solicitudes.
async function verAsignacionesAgente(agenteId, username) {
    document.getElementById('asignacionesModalTitle').textContent = `📋 Asignaciones de ${username}`;
    document.getElementById('asignacionesContent').innerHTML = '<div class="equipo-loading">Cargando información...</div>';
    document.getElementById('verAsignacionesModal').style.display = 'flex';

    try {
        const equipoId = window._equipoId;
        const res = await fetch(`/api/equipos/${equipoId}/dashboard`);
        if (!res.ok) throw new Error('Error ' + res.status);
        const data = await res.json();

        const agente = (data.agentes || []).find(a => a.id === agenteId || a.id == agenteId);

        if (!agente) {
            document.getElementById('asignacionesContent').innerHTML = `
                <div style="text-align:center;padding:30px;color:#6b7280;">
                    <div style="font-size:48px;margin-bottom:12px;">👤</div>
                    <p>No se encontró información del agente.</p>
                </div>
            `;
            return;
        }

        const asignadas = parseInt(agente.asignadas || 0);
        const gestiones7d = parseInt(agente.gestiones_7d || 0);

        document.getElementById('asignacionesContent').innerHTML = `
            <div style="padding:10px 0;">
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
                        <a href="/solicitudes?usuario=${agenteId}" target="_blank" style="display:flex;align-items:center;justify-content:center;gap:8px;padding:10px;background:#6366f1;color:white;border-radius:8px;text-decoration:none;font-weight:600;font-size:13px;">
                            📋 Ver todas las solicitudes de ${escapeHtml(username)}
                        </a>
                    </div>
                </div>
            </div>
        `;

    } catch (err) {
        console.error('[Equipo] Error cargar asignaciones:', err);
        document.getElementById('asignacionesContent').innerHTML = `
            <div style="text-align:center;padding:30px;color:#dc2626;">
                <p>Error al cargar información: ${escapeHtml(err.message)}</p>
            </div>
        `;
    }
}

function cerrarModalAsignaciones(event) {
    if (event && event.target !== event.currentTarget) return;
    document.getElementById('verAsignacionesModal').style.display = 'none';
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

// Toast notifications
function mostrarToast(mensaje) {
    const existing = document.querySelector('.equipo-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = 'equipo-toast';
    toast.textContent = mensaje;
    toast.style.cssText = `
        position: fixed; bottom: 24px; right: 24px;
        padding: 12px 20px; border-radius: 10px;
        background: #10b981; color: white;
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
