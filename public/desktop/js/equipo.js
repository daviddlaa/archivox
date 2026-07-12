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
        document.querySelectorAll('.equipo-stat-info span').forEach(s => s.textContent = '—');
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

            return `<tr>
                <td style="color:#6b7280;">#${c.id}</td>
                <td><strong>${escapeHtml(c.nombre_campana || 'Campaña #' + c.id)}</strong></td>
                <td>${escapeHtml(c.agente_username || '-')}</td>
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
        tbody.innerHTML = '<tr><td colspan="8" class="equipo-loading" style="color:#dc2626">Error al cargar campañas</td></tr>';
    }
}

// ============================================================================
// CARGAR GESTIONES RECIENTES DEL EQUIPO
// ============================================================================
async function cargarGestiones() {
    const tbody = document.getElementById('gestionesEquipoBody');

    try {
        const equipoId = window._equipoId;
        if (!equipoId) {
            tbody.innerHTML = '<tr><td colspan="6" class="equipo-loading">Sin equipo asignado</td></tr>';
            return;
        }

        const res = await fetch(`/api/equipos/${equipoId}/gestiones?limite=20`);
        if (!res.ok) throw new Error('Error ' + res.status);
        const data = await res.json();

        const gestiones = data.data || [];

        if (gestiones.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="equipo-loading">No hay gestiones recientes del equipo</td></tr>';
            return;
        }

        tbody.innerHTML = gestiones.map(g => `
            <tr>
                <td style="color:#6b7280;font-size:12px;">${formatearFecha(g.fecha_gestion)}</td>
                <td><strong>${escapeHtml(g.agente_username || g.agente_nombre || '-')}</strong></td>
                <td><a href="/solicitudes?buscar=${g.solicitud_id}" style="color:#6366f1;font-weight:600;text-decoration:none;">#${g.solicitud_id}</a></td>
                <td>${escapeHtml(g.cliente_nombre || '—')}</td>
                <td><span class="equipo-role-badge agente">${escapeHtml(g.tipo_gestion)}</span></td>
                <td style="color:#6b7280;font-size:12px;max-width:250px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
                    ${escapeHtml((g.observacion || '').substring(0, 80))}${(g.observacion || '').length > 80 ? '...' : ''}
                </td>
            </tr>
        `).join('');

    } catch (err) {
        console.error('[Equipo] Error cargar gestiones:', err);
        tbody.innerHTML = '<tr><td colspan="6" class="equipo-loading" style="color:#dc2626">Error al cargar gestiones</td></tr>';
    }
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
