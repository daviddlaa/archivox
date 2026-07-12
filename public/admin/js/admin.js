// ============================================================================
// PANEL DE ADMINISTRACIÓN - ARCHIVOX
// ============================================================================

let paginaActual = 1;
let searchTimeout;

// ============================================================================
// INICIALIZACIÓN
// ============================================================================
document.addEventListener('DOMContentLoaded', async function() {
    try {
        // Verificar sesión y rol
        const sesRes = await fetch('/api/auth/sesion');
        if (!sesRes.ok) {
            console.error('[Admin] Error al verificar sesión:', sesRes.status, sesRes.statusText);
            window.location.href = '/login';
            return;
        }
        const sesion = await sesRes.json();

        if (!sesion.autenticado) {
            console.log('[Admin] No autenticado, redirigiendo a login');
            window.location.href = '/login';
            return;
        }

        const user = sesion.usuario;
        console.log('[Admin] Sesión verificada:', user.username, 'rol:', user.rol, 'is_superadmin:', user.is_superadmin);

        const badge = document.getElementById('userBadge');
        if (user.is_superadmin || user.rol === 'superadmin') {
            badge.textContent = '👑 Super Admin';
        } else {
            console.log('[Admin] No eres superadmin, redirigiendo a inicio');
            window.location.href = '/';
            return;
        }

        // Reloj
        actualizarReloj();
        setInterval(actualizarReloj, 1000);

        // Cargar datos iniciales
        cargarUsuarios();

        // ================================================================
        // SUPERADMIN MOBILE: Soporte para navegación por ?tab= query param
        // Permite que los enlaces del menú móvil abran tabs específicos
        // ================================================================
        var urlParams = new URLSearchParams(window.location.search);
        var tabParam = urlParams.get('tab');
        if (tabParam) {
            var tabValido = ['usuarios', 'estadisticas', 'auditoria', 'notificaciones', 'equipos'];
            if (tabValido.indexOf(tabParam) !== -1) {
                cambiarTab(tabParam);
            }
        }
    } catch (err) {
        console.error('[Admin] Error en inicialización:', err);
        document.getElementById('usersTableBody').innerHTML =
            '<tr><td colspan="8" class="admin-loading" style="color:#dc2626">Error al cargar: ' + escapeHtml(err.message) + '</td></tr>';
    }
});

function actualizarReloj() {
    const clock = document.getElementById('clock');
    if (clock) {
        clock.textContent = new Date().toLocaleString('es-ES', {
            day: '2-digit', month: '2-digit', year: 'numeric',
            hour: '2-digit', minute: '2-digit', second: '2-digit'
        });
    }
}

// ============================================================================
// TABS
// ============================================================================
function cambiarTab(tab) {
    document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.admin-tab-content').forEach(t => t.classList.remove('active'));

    document.querySelector(`.admin-tab[data-tab="${tab}"]`).classList.add('active');
    document.getElementById(`tab-${tab}`).classList.add('active');

    if (tab === 'estadisticas') cargarEstadisticas();
    if (tab === 'auditoria') cargarAuditoria();
    if (tab === 'notificaciones') { cargarNotificaciones(); actualizarBadgeNotif(); }
}

// ============================================================================
// USUARIOS
// ============================================================================
async function cargarUsuarios() {
    const tbody = document.getElementById('usersTableBody');
    const cardsDiv = document.getElementById('mobileCards');
    tbody.innerHTML = '<tr><td colspan="8" class="admin-loading">Cargando usuarios...</td></tr>';
    if (cardsDiv) cardsDiv.innerHTML = '<div class="admin-loading">Cargando usuarios...</div>';

    try {
        const q = document.getElementById('searchUser').value;
        const rol = document.getElementById('filterRol').value;
        const estado = document.getElementById('filterEstado').value;

        let url = `/api/admin/usuarios?pagina=${paginaActual}&limite=15`;
        if (q) url += `&q=${encodeURIComponent(q)}`;
        if (rol) url += `&rol=${rol}`;
        if (estado) url += `&estado=${estado}`;

        console.log('[Admin] GET', url);
        const res = await fetch(url);
        console.log('[Admin] Respuesta:', res.status);
        if (!res.ok) {
            const errData = await res.json().catch(() => ({ error: res.statusText }));
            console.error('[Admin] Error:', errData);
            tbody.innerHTML = '<tr><td colspan="8" class="admin-loading" style="color:#dc2626">Error ' + res.status + '</td></tr>';
            if (cardsDiv) cardsDiv.innerHTML = '<div class="admin-loading" style="color:#dc2626">Error ' + res.status + '</div>';
            return;
        }
        const data = await res.json();

        console.log('[Admin] Usuarios recibidos:', data.data?.length || 0);

        if (!data.data || data.data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" class="admin-loading">No se encontraron usuarios</td></tr>';
            if (cardsDiv) cardsDiv.innerHTML = '<div class="admin-loading">No se encontraron usuarios</div>';
            document.getElementById('pageInfo').textContent = 'Página 1';
            document.getElementById('prevPage').disabled = paginaActual <= 1;
            document.getElementById('nextPage').disabled = true;
            return;
        }
        const rows = data.data.map(user => {
            const estado = user.is_active ?
                (user.locked_until && new Date(user.locked_until) > new Date() ? 'bloqueado' : 'activo')
                : 'inactivo';

            const rolClass = user.is_superadmin ? 'superadmin' : (user.rol === 'lider' ? 'lider' : user.rol);

            return `<tr>
                <td><span class="admin-username">${escapeHtml(user.username)}</span></td>
                <td>${escapeHtml(user.nombre || '-')}</td>
                <td>${escapeHtml(user.email || '-')}</td>
                <td><span class="role-badge ${rolClass}">${rolLabel(user)}</span></td>
                <td><span class="estado-indicador"><span class="estado-dot ${estado}"></span>${estado}</span></td>
                <td>${formatearFecha(user.created_at)}</td>
                <td>${formatearFecha(user.last_login)}</td>
                <td>
                    <div class="action-btns">
                        <button class="action-btn edit" onclick="editarUsuario(${user.id})" title="Editar">✏️</button>
                        <button class="action-btn stats" data-userid="${user.id}" data-username="${escapeHtml(user.username)}" onclick="verEstadisticasUsuario(this.dataset.userid, this.dataset.username)" title="Estadísticas">📊</button>
                        ${!user.is_superadmin && user.rol !== 'superadmin' ?
                            (user.rol === 'lider'
                                ? `<button class="action-btn" onclick="revocarLider(${user.id}, '${escapeHtml(user.username)}')" title="Revocar Líder" style="color:#f59e0b">👑</button>`
                                : `<button class="action-btn" onclick="promoverALider(${user.id}, '${escapeHtml(user.username)}')" title="Convertir en Líder" style="color:#10b981">⬆️</button>`
                            ) : ''
                        }
                        ${user.locked_until && new Date(user.locked_until) > new Date() ?
                            `<button class="action-btn lock" onclick="desbloquearUsuario(${user.id})" title="Desbloquear">🔓</button>` : ''}
                    </div>
                </td>
            </tr>`;
        }).join('');

        // ASIGNAR filas a la tabla
        tbody.innerHTML = rows;

        // Cards para móvil - versión mejorada responsive
        cardsDiv.innerHTML = data.data.map(user => {
            const estado = user.is_active ?
                (user.locked_until && new Date(user.locked_until) > new Date() ? 'bloqueado' : 'activo')
                : 'inactivo';
            const rolClass = user.is_superadmin ? 'superadmin' : (user.rol === 'lider' ? 'lider' : user.rol);
            const estadoColor = estado === 'activo' ? '#10b981' : estado === 'bloqueado' ? '#f59e0b' : '#ef4444';

            return `<div class="user-card">
                <div class="admin-user-card-header">
                    <div class="admin-user-card-avatar">${escapeHtml((user.nombre || user.username).charAt(0).toUpperCase())}</div>
                    <div class="admin-user-card-info">
                        <div class="admin-user-card-name">${escapeHtml(user.nombre || user.username)}</div>
                        <div class="admin-user-card-username">@${escapeHtml(user.username)}</div>
                    </div>
                    <span class="role-badge ${rolClass}">${rolLabel(user)}</span>
                </div>
                <div class="admin-user-card-body">
                    <div class="admin-user-card-row">
                        <span class="admin-user-card-label">📧 Email</span>
                        <span class="admin-user-card-value">${escapeHtml(user.email || '-')}</span>
                    </div>
                    <div class="admin-user-card-row">
                        <span class="admin-user-card-label">📌 Estado</span>
                        <span class="admin-user-card-value"><span class="estado-dot ${estado}" style="background:${estadoColor}"></span> ${estado}</span>
                    </div>
                    <div class="admin-user-card-row">
                        <span class="admin-user-card-label">📅 Registro</span>
                        <span class="admin-user-card-value">${formatearFecha(user.created_at)}</span>
                    </div>
                    <div class="admin-user-card-row">
                        <span class="admin-user-card-label">🔑 Último login</span>
                        <span class="admin-user-card-value">${formatearFecha(user.last_login) || 'Nunca'}</span>
                    </div>
                    ${user.locked_until && new Date(user.locked_until) > new Date() ?
                        `<div class="admin-user-card-row">
                            <span class="admin-user-card-label">🔒 Bloqueado hasta</span>
                            <span class="admin-user-card-value" style="color:#f59e0b">${formatearFecha(user.locked_until)}</span>
                        </div>` : ''}
                </div>
                <div class="admin-user-card-actions">
                    <button class="admin-user-card-btn admin-user-card-btn-primary" onclick="editarUsuario(${user.id})">✏️ Editar</button>
                    <button class="admin-user-card-btn admin-user-card-btn-secondary" onclick="verEstadisticasUsuario(${user.id}, '${escapeHtml(user.username)}')">📊 Stats</button>
                    ${user.locked_until && new Date(user.locked_until) > new Date() ?
                        `<button class="admin-user-card-btn admin-user-card-btn-warning" onclick="desbloquearUsuario(${user.id})">🔓 Desbloquear</button>` : ''}
                </div>
            </div>`;
        }).join('');

        document.getElementById('pageInfo').textContent = `Página ${paginaActual}`;
        document.getElementById('prevPage').disabled = paginaActual <= 1;
        document.getElementById('nextPage').disabled = !data.data || data.data.length < 15;

    } catch (err) {
        console.error('Error cargar usuarios:', err);
        tbody.innerHTML = '<tr><td colspan="8" class="admin-loading" style="color:#dc2626">Error al cargar usuarios</td></tr>';
        if (cardsDiv) cardsDiv.innerHTML = '<div class="admin-loading" style="color:#dc2626">Error al cargar usuarios</div>';
    }
}

function debounceBuscar() {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => { paginaActual = 1; cargarUsuarios(); }, 300);
}

function cambiarPagina(dir) {
    if (dir === 'next') paginaActual++;
    else if (paginaActual > 1) paginaActual--;
    cargarUsuarios();
}

// ============================================================================
// MODAL EDICIÓN
// ============================================================================
async function editarUsuario(id) {
    try {
        const res = await fetch(`/api/admin/usuarios/${id}`);
        const user = await res.json();
        if (!user.id) return alert('Error al cargar usuario');

        document.getElementById('editUserId').value = user.id;
        document.getElementById('editUsername').value = user.username;
        document.getElementById('editNombre').value = user.nombre || '';
        document.getElementById('editEmail').value = user.email || '';

        // Opciones de rol
        const rolSelect = document.getElementById('editRol');
        rolSelect.innerHTML = '<option value="user">Usuario</option>' +
            '<option value="agente">Agente</option>' +
            '<option value="lider">Líder</option>';
        // Solo superadmin establecido puede ser superadmin
        if (user.is_superadmin) {
            rolSelect.innerHTML += '<option value="superadmin">Super Admin</option>';
        }
        rolSelect.value = user.is_superadmin ? 'superadmin' : (user.rol || 'user');

        // Info del usuario
        document.getElementById('infoCreated').textContent = formatearFecha(user.created_at);
        document.getElementById('infoLastLogin').textContent = formatearFecha(user.last_login) || 'Nunca';
        document.getElementById('infoAttempts').textContent = user.failed_login_attempts || 0;

        // Botones de estado
        document.getElementById('btnActivar').style.display = user.is_active ? 'none' : 'inline-block';
        document.getElementById('btnDesactivar').style.display = user.is_active ? 'inline-block' : 'none';
        document.getElementById('btnDesbloquear').style.display =
            (user.locked_until && new Date(user.locked_until) > new Date()) ? 'inline-block' : 'none';

        document.getElementById('modalTitle').textContent = `Editar: ${user.username}`;
        document.getElementById('modalOverlay').classList.add('active');
        document.getElementById('userModal').classList.add('active');

    } catch (err) {
        console.error('Error editar usuario:', err);
        alert('Error al cargar datos del usuario');
    }
}

function cerrarModal() {
    document.getElementById('modalOverlay').classList.remove('active');
    document.getElementById('userModal').classList.remove('active');
}

async function guardarUsuario() {
    const id = document.getElementById('editUserId').value;
    const data = {
        nombre: document.getElementById('editNombre').value,
        email: document.getElementById('editEmail').value,
        rol: document.getElementById('editRol').value
    };

    try {
        const res = await fetch(`/api/admin/usuarios/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        const result = await res.json();
        if (res.ok) {
            cerrarModal();
            cargarUsuarios();
            mostrarToast('✅ Usuario actualizado');
        } else {
            alert(result.error || 'Error al guardar');
        }
    } catch (err) {
        console.error('Error guardar:', err);
        alert('Error de conexión');
    }
}

// ============================================================================
// PROMOVER A LÍDER
// ============================================================================
async function promoverALider(id, username) {
    if (!confirm(`¿Convertir a ${username} en Líder?\n\nSe creará automáticamente un equipo para él/ella.`)) return;

    try {
        const res = await fetch(`/api/admin/usuarios/${id}/promover-lider`, { method: 'POST' });
        const result = await res.json();
        if (res.ok) {
            cargarUsuarios();
            mostrarToast(`✅ ${username} ahora es Líder`);
        } else {
            alert(result.error || 'Error al promover');
        }
    } catch (err) {
        console.error('[Admin] Error promover:', err);
        alert('Error de conexión');
    }
}

// ============================================================================
// REVOCAR LÍDER
// ============================================================================
async function revocarLider(id, username) {
    if (!confirm(`¿Revocar el rol de Líder a ${username}?\n\nEl equipo se mantendrá pero ${username} ya no será líder.`)) return;

    try {
        const res = await fetch(`/api/admin/usuarios/${id}/revocar-lider`, { method: 'POST' });
        const result = await res.json();
        if (res.ok) {
            cargarUsuarios();
            mostrarToast(`👑 Liderazgo revocado: ${username} ahora es Agente`);
        } else {
            alert(result.error || 'Error al revocar');
        }
    } catch (err) {
        console.error('[Admin] Error revocar:', err);
        alert('Error de conexión');
    }
}

// ============================================================================
// TOGGLE ACTIVO / DESBLOQUEAR
// ============================================================================
async function toggleActivo() {
    const id = document.getElementById('editUserId').value;
    try {
        const res = await fetch(`/api/admin/usuarios/${id}/toggle-active`, { method: 'PUT' });
        const result = await res.json();
        if (res.ok) {
            cerrarModal();
            cargarUsuarios();
            mostrarToast(`✅ ${result.mensaje}`);
        } else {
            alert(result.error || 'Error');
        }
    } catch (err) {
        console.error('Error toggle:', err);
    }
}

async function desbloquear() {
    const id = document.getElementById('editUserId').value;
    try {
        const res = await fetch(`/api/admin/usuarios/${id}/unlock`, { method: 'PUT' });
        const result = await res.json();
        if (res.ok) {
            cerrarModal();
            cargarUsuarios();
            mostrarToast('✅ Usuario desbloqueado');
        } else {
            alert(result.error || 'Error');
        }
    } catch (err) {
        console.error('Error unlock:', err);
    }
}

async function desbloquearUsuario(id) {
    try {
        const res = await fetch(`/api/admin/usuarios/${id}/unlock`, { method: 'PUT' });
        const result = await res.json();
        if (res.ok) {
            cargarUsuarios();
            mostrarToast('✅ Usuario desbloqueado');
        } else {
            alert(result.error || 'Error');
        }
    } catch (err) {
        console.error('Error unlock:', err);
    }
}

async function resetPassword() {
    const id = document.getElementById('editUserId').value;
    const password = document.getElementById('newPassword').value;

    if (!password || password.length < 8) {
        return alert('La contraseña debe tener al menos 8 caracteres');
    }

    try {
        const res = await fetch(`/api/admin/usuarios/${id}/reset-password`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nueva_password: password })
        });
        const result = await res.json();
        if (res.ok) {
            document.getElementById('newPassword').value = '';
            mostrarToast('✅ Contraseña actualizada');
        } else {
            alert(result.error || 'Error');
        }
    } catch (err) {
        console.error('Error reset password:', err);
    }
}

// ============================================================================
// CREAR USUARIO
// ============================================================================
function abrirModalCrear() {
    document.getElementById('createModal').classList.add('active');
    document.getElementById('modalOverlay').classList.add('active');
    document.getElementById('createUsername').value = '';
    document.getElementById('createNombre').value = '';
    document.getElementById('createEmail').value = '';
    document.getElementById('createPassword').value = '';
}

function cerrarModalCrear() {
    document.getElementById('createModal').classList.remove('active');
    document.getElementById('modalOverlay').classList.remove('active');
}

async function crearUsuario() {
    const data = {
        username: document.getElementById('createUsername').value,
        nombre: document.getElementById('createNombre').value,
        email: document.getElementById('createEmail').value,
        password: document.getElementById('createPassword').value,
        rol: document.getElementById('createRol').value
    };

    if (!data.username || !data.password) {
        return alert('Usuario y contraseña son requeridos');
    }

    try {
        const res = await fetch('/api/admin/usuarios', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        const result = await res.json();
        if (res.ok) {
            cerrarModalCrear();
            cargarUsuarios();
            mostrarToast('✅ Usuario creado');
        } else {
            alert(result.error || 'Error al crear usuario');
        }
    } catch (err) {
        console.error('Error crear:', err);
    }
}

// ============================================================================
// ESTADÍSTICAS
// ============================================================================
async function cargarEstadisticas() {
    const grid = document.getElementById('statsGrid');
    grid.innerHTML = '<div class="stat-card stat-loading">Cargando estadísticas...</div>';

    try {
        console.log('[Admin] Cargando estadísticas...');
        const res = await fetch('/api/admin/estadisticas');
        if (!res.ok) {
            const errData = await res.json().catch(() => ({ error: res.statusText }));
            console.error('[Admin] Error estadísticas:', res.status, errData);
            grid.innerHTML = '<div class="stat-card stat-loading" style="color:#dc2626">Error ' + res.status + '</div>';
            return;
        }
        const data = await res.json();

        grid.innerHTML = `
            <div class="stat-card">
                <div class="stat-icon">👥</div>
                <div class="stat-label">Total Usuarios</div>
                <div class="stat-value">${data.usuarios.total}</div>
                <div class="stat-sub">${data.usuarios.nuevos_hoy} nuevos hoy</div>
            </div>
            <div class="stat-card">
                <div class="stat-icon">🟢</div>
                <div class="stat-label">Usuarios Activos</div>
                <div class="stat-value">${data.usuarios.estado?.activos || 0}</div>
            </div>
            <div class="stat-card">
                <div class="stat-icon">🔴</div>
                <div class="stat-label">Usuarios Inactivos</div>
                <div class="stat-value">${data.usuarios.estado?.inactivos || 0}</div>
            </div>
            <div class="stat-card">
                <div class="stat-icon">🔒</div>
                <div class="stat-label">Bloqueados</div>
                <div class="stat-value">${data.usuarios.estado?.bloqueados || 0}</div>
            </div>
            <div class="stat-card">
                <div class="stat-icon">📋</div>
                <div class="stat-label">Solicitudes</div>
                <div class="stat-value">${data.datos?.solicitudes || 0}</div>
            </div>
            <div class="stat-card">
                <div class="stat-icon">📝</div>
                <div class="stat-label">Gestiones</div>
                <div class="stat-value">${data.datos?.gestiones || 0}</div>
            </div>
            <div class="stat-card">
                <div class="stat-icon">🔗</div>
                <div class="stat-label">Relaciones</div>
                <div class="stat-value">${data.datos?.relaciones || 0}</div>
            </div>
            <div class="stat-card">
                <div class="stat-icon">⚠️</div>
                <div class="stat-label">Intentos Fallidos (24h)</div>
                <div class="stat-value">${data.seguridad?.intentos_fallidos_24h || 0}</div>
                <div class="stat-sub">${data.usuarios?.sin_login_reciente || 0} usuarios sin login reciente</div>
            </div>
        `;
    } catch (err) {
        console.error('Error stats:', err);
        grid.innerHTML = '<div class="stat-card stat-loading" style="color:var(--admin-danger)">Error al cargar estadísticas</div>';
    }
}

// ============================================================================
// AUDITORÍA
// ============================================================================
async function cargarAuditoria() {
    const tbody = document.getElementById('auditTableBody');
    const cardsDiv = document.getElementById('auditMobileCards');
    tbody.innerHTML = '<tr><td colspan="6" class="admin-loading">Cargando auditoría...</td></tr>';
    if (cardsDiv) cardsDiv.innerHTML = '<div class="admin-loading">Cargando auditoría...</div>';

    try {
        const q = document.getElementById('searchAudit').value;
        let url = '/api/admin/auditoria?limite=50';
        if (q) url += `&accion=${encodeURIComponent(q)}`;

        console.log('[Admin] Cargando auditoría:', url);
        const res = await fetch(url);
        if (!res.ok) {
            const errData = await res.json().catch(() => ({ error: res.statusText }));
            console.error('[Admin] Error auditoría:', res.status, errData);
            tbody.innerHTML = '<tr><td colspan="6" class="admin-loading" style="color:#dc2626">Error ' + res.status + '</td></tr>';
            if (cardsDiv) cardsDiv.innerHTML = '<div class="admin-loading" style="color:#dc2626">Error ' + res.status + '</div>';
            return;
        }
        const data = await res.json();

        if (!data.data || data.data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="admin-loading">No hay registros de auditoría</td></tr>';
            if (cardsDiv) cardsDiv.innerHTML = '<div class="admin-loading">No hay registros de auditoría</div>';
            return;
        }

        // Tabla para desktop
        tbody.innerHTML = data.data.map(log => {
            let detalle = '';
            try {
                const d = JSON.parse(log.detalle);
                detalle = d?.motivo || d?.username || d?.metodo || '';
            } catch(e) {
                detalle = log.detalle || '';
            }

            return `<tr>
                <td>${formatearFecha(log.created_at)}</td>
                <td>${escapeHtml(log.usuario_username || `#${log.usuario_id}`)}</td>
                <td><code>${escapeHtml(log.accion)}</code></td>
                <td>${escapeHtml(log.target_type || '-')}</td>
                <td>${escapeHtml(log.ip_address || '-')}</td>
                <td style="font-size:12px;color:var(--admin-text-muted)">${escapeHtml(detalle)}</td>
            </tr>`;
        }).join('');

        // Cards para móvil
        if (cardsDiv) {
            cardsDiv.innerHTML = data.data.map(log => {
                let detalle = '';
                try {
                    const d = JSON.parse(log.detalle);
                    detalle = d?.motivo || d?.username || d?.metodo || '';
                } catch(e) {
                    detalle = log.detalle || '';
                }

                const accionIcon = log.accion.includes('user') || log.accion.includes('login') ? '👤' :
                    log.accion.includes('notif') ? '🔔' :
                    log.accion.includes('equipo') || log.accion.includes('team') ? '🏢' :
                    log.accion.includes('create') || log.accion.includes('crear') ? '➕' :
                    log.accion.includes('delete') || log.accion.includes('eliminar') ? '🗑️' :
                    log.accion.includes('update') || log.accion.includes('actualizar') ? '✏️' : '📋';

                return `<div class="audit-card">
                    <div class="audit-card-header">
                        <div class="audit-card-icon">${accionIcon}</div>
                        <div class="audit-card-info">
                            <div class="audit-card-user">${escapeHtml(log.usuario_username || `Usuario #${log.usuario_id}`)}</div>
                            <div class="audit-card-date">${formatearFecha(log.created_at)}</div>
                        </div>
                        <span class="audit-card-badge badge badge-gray">${escapeHtml(log.target_type || '-')}</span>
                    </div>
                    <div class="audit-card-body">
                        <div class="audit-card-row">
                            <span class="audit-card-label">🔧 Acción</span>
                            <span class="audit-card-value"><code class="audit-card-action-code">${escapeHtml(log.accion)}</code></span>
                        </div>
                        <div class="audit-card-row">
                            <span class="audit-card-label">🌐 IP</span>
                            <span class="audit-card-value">${escapeHtml(log.ip_address || '-')}</span>
                        </div>
                    </div>
                    ${detalle ? `<div class="audit-card-detail">📝 ${escapeHtml(detalle)}</div>` : ''}
                </div>`;
            }).join('');
        }

    } catch (err) {
        console.error('Error auditoría:', err);
        tbody.innerHTML = '<tr><td colspan="6" class="admin-loading" style="color:var(--admin-danger)">Error al cargar auditoría</td></tr>';
        if (cardsDiv) cardsDiv.innerHTML = '<div class="admin-loading" style="color:#dc2626">Error al cargar auditoría</div>';
    }
}

function debounceAuditar() {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(cargarAuditoria, 300);
}

// ============================================================================
// DEEP LINKS - Configuración centralizada
// ============================================================================
// Los módulos ahora se definen en public/js/deep-link-router.js (DeepLinkRouter).
// Aquí solo se usa como referencia para el selector de notificaciones.
// 
// 🆕 NUEVA ARQUITECTURA:
//   - Se usa accion_modulo (identificador lógico) en lugar de URL fija
//   - DeepLinkRouter resuelve la URL según la plataforma del usuario
//   - El admin ya NO elige entre Desktop/Mobile, solo el módulo
// ============================================================================

// ============================================================================
// NOTIFICACIONES
// ============================================================================

let paginaNotif = 1;
let searchNotifTimeout;

// Cargar notificaciones desde el servidor
async function cargarNotificaciones() {
    const tbody = document.getElementById('notifTableBody');
    const cardsDiv = document.getElementById('notifMobileCards');
    tbody.innerHTML = '<tr><td colspan="10" class="admin-loading">Cargando notificaciones...</td></tr>';
    if (cardsDiv) cardsDiv.innerHTML = '<div class="admin-loading">Cargando notificaciones...</div>';

    try {
        const q = document.getElementById('searchNotif').value;
        const tipo = document.getElementById('filterNotifTipo').value;
        const leida = document.getElementById('filterNotifLeida').value;

        let url = `/api/admin/notificaciones?pagina=${paginaNotif}&limite=15`;
        if (q) url += `&q=${encodeURIComponent(q)}`;
        if (tipo) url += `&tipo=${tipo}`;
        if (leida !== '') url += `&leida=${leida}`;

        const res = await fetch(url);
        if (!res.ok) {
            tbody.innerHTML = '<tr><td colspan="10" class="admin-loading" style="color:#dc2626">Error ' + res.status + '</td></tr>';
            if (cardsDiv) cardsDiv.innerHTML = '<div class="admin-loading" style="color:#dc2626">Error ' + res.status + '</div>';
            return;
        }
        const data = await res.json();

        if (!data.data || data.data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="10" class="admin-loading">No hay notificaciones</td></tr>';
            if (cardsDiv) cardsDiv.innerHTML = '<div class="admin-loading">No hay notificaciones</div>';
            document.getElementById('pageInfoNotif').textContent = 'Página 1';
            document.getElementById('prevPageNotif').disabled = true;
            document.getElementById('nextPageNotif').disabled = true;
            return;
        }

        const tipoIconos = { info: 'ℹ️', warning: '⚠️', success: '✅', danger: '🚨' };
        const tipoColores = { info: '#3b82f6', warning: '#f59e0b', success: '#10b981', danger: '#ef4444' };
        const prioridadIconos = { baja: '⬇️', normal: '➡️', alta: '⬆️', critica: '🔴' };
        const prioridadColores = { baja: '#9ca3af', normal: '#3b82f6', alta: '#f59e0b', critica: '#dc2626' };
        const prioridadLabels = { baja: 'Baja', normal: 'Normal', alta: 'Alta', critica: 'Crítica' };

        // Tabla para desktop
        tbody.innerHTML = data.data.map(n => `
            <tr class="${n.leida ? '' : 'notif-no-leida'}">
                <td>${n.leida ? '📖' : '📩'}</td>
                <td><strong>${escapeHtml(n.titulo)}</strong></td>
                <td style="white-space:pre-line;font-size:13px">${escapeHtml(n.mensaje)}</td>
                <td><span style="background:${tipoColores[n.tipo] || '#6b7280'};color:white;padding:3px 8px;border-radius:4px;font-size:11px">${tipoIconos[n.tipo] || 'ℹ️'} ${n.tipo}</span></td>
                <td>
                    <span style="color:${prioridadColores[n.prioridad] || '#6b7280'};font-weight:600;font-size:13px">
                        ${prioridadIconos[n.prioridad] || '➡️'} ${n.prioridad || 'normal'}
                    </span>
                </td>
                <td>${escapeHtml(n.creador_username || 'Sistema')}</td>
                <td>${n.destinatario_id ? 'Usuario #' + n.destinatario_id : '🌐 Todos'}</td>
                <td>${n.accion_url ? `<a href="${escapeHtml(n.accion_url)}" target="_blank" style="font-size:12px">🔗 ${escapeHtml(n.accion_texto || 'Ir')}</a>` : '-'}</td>
                <td>${formatearFecha(n.created_at)}</td>
                <td>
                    <div class="action-btns">
                        ${!n.leida ? `<button class="action-btn" onclick="marcarLeida(${n.id})" title="Marcar leída">✅</button>` : ''}
                        <button class="action-btn" onclick="archivarNotificacionAdmin(${n.id})" title="Archivar">📦</button>
                        <button class="action-btn" onclick="eliminarNotificacion(${n.id})" title="Eliminar" style="color:#dc2626">🗑️</button>
                    </div>
                </td>
            </tr>
        `).join('');

        // Cards para móvil
        if (cardsDiv) {
            cardsDiv.innerHTML = data.data.map(n => {
                const tipoIcono = tipoIconos[n.tipo] || 'ℹ️';
                const tipoColor = tipoColores[n.tipo] || '#6b7280';
                const prioridadIcono = prioridadIconos[n.prioridad] || '➡️';
                const prioridadLabel = prioridadLabels[n.prioridad] || 'Normal';
                const leidaStatus = n.leida ? '📖 Leída' : '📩 No leída';
                const destinatario = n.destinatario_id ? 'Usuario #' + n.destinatario_id : '🌐 Todos';

                return `<div class="notif-admin-card ${n.leida ? 'notif-admin-card-leida' : 'notif-admin-card-no-leida'}">
                    <div class="notif-admin-card-header">
                        <div class="notif-admin-card-icon" style="background:${tipoColor}20">
                            <span>${tipoIcono}</span>
                        </div>
                        <div class="notif-admin-card-info">
                            <div class="notif-admin-card-title">${escapeHtml(n.titulo)}</div>
                            <div class="notif-admin-card-meta">
                                <span class="notif-admin-card-tipo" style="background:${tipoColor}20;color:${tipoColor}">${tipoIcono} ${n.tipo}</span>
                                <span style="color:${prioridadColores[n.prioridad] || '#6b7280'}">${prioridadIcono} ${prioridadLabel}</span>
                            </div>
                        </div>
                        <div class="notif-admin-card-estado">${n.leida ? '📖' : '📩'}</div>
                    </div>
                    <div class="notif-admin-card-body">
                        <div class="notif-admin-card-msg">${escapeHtml(n.mensaje)}</div>
                        <div class="notif-admin-card-details">
                            <div class="notif-admin-card-row">
                                <span class="notif-admin-card-label">👤 Creado por</span>
                                <span class="notif-admin-card-value">${escapeHtml(n.creador_username || 'Sistema')}</span>
                            </div>
                            <div class="notif-admin-card-row">
                                <span class="notif-admin-card-label">📡 Destinatario</span>
                                <span class="notif-admin-card-value">${destinatario}</span>
                            </div>
                            <div class="notif-admin-card-row">
                                <span class="notif-admin-card-label">📅 Fecha</span>
                                <span class="notif-admin-card-value">${formatearFecha(n.created_at)}</span>
                            </div>
                            ${n.leida_at ? `
                            <div class="notif-admin-card-row">
                                <span class="notif-admin-card-label">✅ Leída el</span>
                                <span class="notif-admin-card-value">${formatearFecha(n.leida_at)}</span>
                            </div>` : ''}
                        </div>
                    </div>
                    <div class="notif-admin-card-actions">
                        ${!n.leida ? `<button class="admin-user-card-btn admin-user-card-btn-secondary" onclick="marcarLeida(${n.id})">✅ Marcar leída</button>` : ''}
                        <button class="admin-user-card-btn admin-user-card-btn-secondary" onclick="archivarNotificacionAdmin(${n.id})">📦 Archivar</button>
                        <button class="admin-user-card-btn admin-user-card-btn-danger" onclick="eliminarNotificacion(${n.id})">🗑️ Eliminar</button>
                        ${n.accion_url ? `<a href="${escapeHtml(n.accion_url)}" target="_blank" class="admin-user-card-btn admin-user-card-btn-primary" style="text-decoration:none;text-align:center">🔗 ${escapeHtml(n.accion_texto || 'Abrir')}</a>` : ''}
                    </div>
                </div>`;
            }).join('');
        }

        document.getElementById('pageInfoNotif').textContent = `Página ${paginaNotif}`;
        document.getElementById('prevPageNotif').disabled = paginaNotif <= 1;
        document.getElementById('nextPageNotif').disabled = !data.data || data.data.length < 15;

    } catch (err) {
        console.error('Error notificaciones:', err);
        tbody.innerHTML = '<tr><td colspan="10" class="admin-loading" style="color:#dc2626">Error al cargar notificaciones</td></tr>';
        if (cardsDiv) cardsDiv.innerHTML = '<div class="admin-loading" style="color:#dc2626">Error al cargar notificaciones</div>';
    }
}

function debounceNotificaciones() {
    clearTimeout(searchNotifTimeout);
    searchNotifTimeout = setTimeout(() => { paginaNotif = 1; cargarNotificaciones(); }, 300);
}

function cambiarPaginaNotif(dir) {
    if (dir === 'next') paginaNotif++;
    else if (paginaNotif > 1) paginaNotif--;
    cargarNotificaciones();
}

// Contar notificaciones no leídas y actualizar badge
async function actualizarBadgeNotif() {
    try {
        const res = await fetch('/api/admin/notificaciones/no-leidas');
        const data = await res.json();
        const badge = document.getElementById('notifCount');
        if (data.no_leidas > 0) {
            badge.textContent = data.no_leidas;
            badge.style.display = 'inline';
        } else {
            badge.style.display = 'none';
        }
    } catch (e) { /* ignora */ }
}

// Abrir panel de notificaciones (cambiar a tab de notificaciones)
function abrirPanelNotificaciones() {
    cambiarTab('notificaciones');
}

// Marcar notificación como leída
async function marcarLeida(id) {
    try {
        const res = await fetch(`/api/admin/notificaciones/${id}/leer`, { method: 'PUT' });
        if (res.ok) {
            cargarNotificaciones();
            actualizarBadgeNotif();
            mostrarToast('✅ Marcada como leída');
        }
    } catch (err) {
        console.error('Error marcar leída:', err);
    }
}

// Eliminar notificación
async function eliminarNotificacion(id) {
    if (!confirm('¿Eliminar esta notificación?')) return;
    try {
        const res = await fetch(`/api/admin/notificaciones/${id}`, { method: 'DELETE' });
        if (res.ok) {
            cargarNotificaciones();
            mostrarToast('🗑️ Notificación eliminada');
        }
    } catch (err) {
        console.error('Error eliminar:', err);
    }
}

// Actualizar texto del botón de acción según el módulo seleccionado
function actualizarTextoAccion() {
    const select = document.getElementById('notifAccionUrl');
    const textoInput = document.getElementById('notifAccionTexto');
    const selectedOption = select.options[select.selectedIndex];
    const moduleId = selectedOption ? selectedOption.value : '';

    if (moduleId && typeof DeepLinkRouter !== 'undefined') {
        const modulo = DeepLinkRouter.getModulo(moduleId);
        if (modulo) {
            textoInput.value = DeepLinkRouter.getTextoAccion(moduleId);
            textoInput.readOnly = true;
            textoInput.style.background = '#f3f4f6';
        } else {
            textoInput.value = '';
            textoInput.readOnly = true;
            textoInput.style.background = '#f3f4f6';
        }
    } else {
        textoInput.value = '';
        textoInput.readOnly = true;
        textoInput.style.background = '#f3f4f6';
    }
}

// Modal crear notificación
async function abrirModalCrearNotificacion() {
    // Cargar deep links en el selector (usando módulos lógicos)
    const urlSelect = document.getElementById('notifAccionUrl');
    urlSelect.innerHTML = '<option value="">🌐 Sin acción (solo informativa)</option>';

    // Obtener módulos de DeepLinkRouter (solo no-admin)
    // Fallback: si DeepLinkRouter no está disponible, el selector solo muestra "Sin acción"
    if (typeof DeepLinkRouter !== 'undefined' && DeepLinkRouter.getModulos) {
        try {
            var modulos = DeepLinkRouter.getModulos({ incluirAdmin: false });
            modulos.forEach(function(m) {
                urlSelect.innerHTML += '<option value="' + m.id + '">' + escapeHtml(m.icon + ' ' + m.label) + '</option>';
            });
        } catch (e) {
            console.warn('[Admin] Error cargando módulos de DeepLinkRouter:', e);
        }
    } else {
        console.warn('[Admin] DeepLinkRouter no disponible. El selector de acciones solo mostrará "Sin acción".');
    }

    // Cargar usuarios para selector de destinatario
    try {
        const res = await fetch('/api/admin/usuarios?limite=100');
        const data = await res.json();
        const select = document.getElementById('notifDestinatario');
        select.innerHTML = '<option value="">🌐 Todos los usuarios</option>';
        if (data.data) {
            data.data.forEach(u => {
                select.innerHTML += `<option value="${u.id}">${escapeHtml(u.username)} (${escapeHtml(u.nombre || u.username)})</option>`;
            });
        }
    } catch (e) { /* si falla, solo mostrar opción de todos */ }

    document.getElementById('notifTitulo').value = '';
    document.getElementById('notifMensaje').value = '';
    document.getElementById('notifTipo').value = 'info';
    document.getElementById('notifPrioridad').value = 'normal';
    document.getElementById('notifAccionTexto').value = '';
    document.getElementById('notifFechaExpiracion').value = '';
    document.getElementById('notifModal').classList.add('active');
    document.getElementById('modalOverlay').classList.add('active');
}

function cerrarModalNotif() {
    document.getElementById('notifModal').classList.remove('active');
    document.getElementById('modalOverlay').classList.remove('active');
}

async function crearNotificacion() {
    const titulo = document.getElementById('notifTitulo').value.trim();
    const mensaje = document.getElementById('notifMensaje').value.trim();
    const tipo = document.getElementById('notifTipo').value;
    const prioridad = document.getElementById('notifPrioridad').value;
    var accion_url = document.getElementById('notifAccionUrl').value.trim() || null;
    var accion_texto = document.getElementById('notifAccionTexto').value.trim() || null;
    const fecha_expiracion = document.getElementById('notifFechaExpiracion').value || null;
    const destinatario_id = document.getElementById('notifDestinatario').value || null;

    // 🆕 Deep Link Router: el valor del select ahora es un moduleId (no una URL)
    // Si se seleccionó un módulo, se envía como accion_modulo.
    // Si accion_url tiene formato de URL directa (legacy), se usa como antes.
    var accion_modulo = null;
    if (accion_url) {
        if (accion_url.startsWith('/')) {
            // Es una URL directa (legacy) - mantener como accion_url
            // Esto puede ocurrir si DeepLinkRouter no cargó
        } else {
            // Es un moduleId de DeepLinkRouter
            accion_modulo = accion_url;
            accion_url = null; // No enviar URL directa, el router la resolverá
        }
    }

    if (!titulo || !mensaje) {
        return alert('Título y mensaje son requeridos');
    }

    try {
        const res = await fetch('/api/admin/notificaciones', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                titulo,
                mensaje,
                tipo,
                prioridad,
                accion_modulo,     // 🆕 Módulo lógico para DeepLinkRouter
                accion_url,        // Se envía null si se usó módulo
                accion_texto,
                fecha_expiracion,
                destinatario_id
            })
        });
        if (res.ok) {
            cerrarModalNotif();
            cargarNotificaciones();
            mostrarToast('📢 Notificación publicada');
        } else {
            const err = await res.json();
            alert(err.error || 'Error al crear notificación');
        }
    } catch (err) {
        console.error('Error crear notif:', err);
        alert('Error de conexión');
    }
}

// Archivar notificación desde el admin
async function archivarNotificacionAdmin(id) {
    try {
        const res = await fetch(`/api/admin/notificaciones/${id}/archivar`, { method: 'PUT' });
        if (res.ok) {
            cargarNotificaciones();
            mostrarToast('📦 Notificación archivada');
        }
    } catch (err) {
        console.error('Error archivar:', err);
    }
}

// ============================================================================
// ESTADÍSTICAS POR USUARIO
// ============================================================================

async function verEstadisticasUsuario(userId, username) {
    document.getElementById('statsUsuarioTitle').textContent = `📊 Estadísticas: ${username}`;
    document.getElementById('statsUsuarioContent').innerHTML = '<div class="admin-loading">Cargando estadísticas...</div>';
    document.getElementById('modalOverlay').classList.add('active');
    document.getElementById('statsUsuarioModal').classList.add('active');

    try {
        const res = await fetch(`/api/admin/estadisticas/usuario/${userId}`);
        if (!res.ok) {
            document.getElementById('statsUsuarioContent').innerHTML = `<div class="admin-loading" style="color:#dc2626">Error ${res.status}</div>`;
            return;
        }
        const data = await res.json();

        // Info del usuario
        let html = `
            <div class="stats-user-header">
                <div class="stats-user-avatar">👤</div>
                <div class="stats-user-info">
                    <h3>${escapeHtml(data.usuario.nombre || data.usuario.username)}</h3>
                    <span class="role-badge ${data.usuario.is_superadmin ? 'superadmin' : data.usuario.rol}">${rolLabel(data.usuario)}</span>
                    <div class="stats-user-dates">
                        <span>📅 Registro: ${formatearFecha(data.usuario.created_at)}</span>
                        <span>🔑 Último login: ${formatearFecha(data.usuario.last_login) || 'Nunca'}</span>
                    </div>
                </div>
            </div>
            <div class="stats-metricas-grid">
        `;

        // Métricas
        for (const [key, metrica] of Object.entries(data.metricas)) {
            const porcentaje = metrica.porcentaje > 0 ? 
                `<div class="stats-porcentaje-bar"><div class="stats-porcentaje-fill" style="width:${Math.min(metrica.porcentaje, 100)}%"></div></div>
                 <div class="stats-porcentaje-text">${metrica.porcentaje}% del sistema</div>` : '';
            
            html += `
                <div class="stats-metrica-card">
                    <div class="stats-metrica-icon">${metrica.icon || '📊'}</div>
                    <div class="stats-metrica-content">
                        <div class="stats-metrica-label">${metrica.label}</div>
                        <div class="stats-metrica-value">${metrica.valor.toLocaleString()}</div>
                        ${porcentaje}
                    </div>
                </div>
            `;
        }

        html += '</div>';
        document.getElementById('statsUsuarioContent').innerHTML = html;

    } catch (err) {
        console.error('Error stats usuario:', err);
        document.getElementById('statsUsuarioContent').innerHTML = '<div class="admin-loading" style="color:#dc2626">Error al cargar estadísticas</div>';
    }
}

function cerrarStatsUsuario() {
    document.getElementById('statsUsuarioModal').classList.remove('active');
    document.getElementById('modalOverlay').classList.remove('active');
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
    if (!fecha) return '-';
    try {
        return new Date(fecha).toLocaleDateString('es-ES', {
            day: '2-digit', month: '2-digit', year: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });
    } catch(e) { return fecha; }
}

function rolLabel(user) {
    if (user.is_superadmin || user.rol === 'superadmin') return 'Super Admin';
    if (user.rol === 'lider') return 'Líder';
    if (user.rol === 'agente') return 'Agente';
    return 'Usuario';
}

// ============================================================================
// EQUIPOS - GESTIÓN DE EQUIPOS
// ============================================================================

let equipoActualId = null; // ID del equipo en vista detalle
let equipoActualNombre = '';
let equiposSearchTimeout;

// Cargar lista de equipos
async function cargarEquipos() {
    const tbody = document.getElementById('equiposTableBody');
    const cardsDiv = document.getElementById('equiposMobileCards');
    tbody.innerHTML = '<tr><td colspan="7" class="admin-loading">Cargando equipos...</td></tr>';
    if (cardsDiv) cardsDiv.innerHTML = '<div class="admin-loading">Cargando equipos...</div>';

    try {
        const q = document.getElementById('searchEquipo').value;
        let url = '/api/equipos';
        if (q) url += `?q=${encodeURIComponent(q)}`;

        const res = await fetch(url);
        if (!res.ok) {
            tbody.innerHTML = '<tr><td colspan="7" class="admin-loading" style="color:#dc2626">Error ' + res.status + '</td></tr>';
            if (cardsDiv) cardsDiv.innerHTML = '<div class="admin-loading" style="color:#dc2626">Error ' + res.status + '</div>';
            return;
        }
        const data = await res.json();

        if (!data.data || data.data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" class="admin-loading">No hay equipos creados. ¡Crea el primero!</td></tr>';
            if (cardsDiv) cardsDiv.innerHTML = '<div class="admin-loading">No hay equipos creados. ¡Crea el primero!</div>';
            return;
        }

        tbody.innerHTML = data.data.map(eq => {
            const lider = eq.miembros?.find(m => m.es_lider);
            const liderNombre = lider ? escapeHtml(lider.usuario_username || lider.usuario_nombre) : '-';
            const totalMiembros = eq.miembros?.length || eq.total_miembros || 0;

            return `<tr>
                <td><span class="admin-username" style="cursor:pointer" onclick="verEquipo(${eq.id}, '${escapeHtml(eq.nombre)}')">🏢 ${escapeHtml(eq.nombre)}</span></td>
                <td style="font-size:13px;color:#6b7280;">${escapeHtml(eq.descripcion || '-')}</td>
                <td><strong>${totalMiembros}</strong></td>
                <td>${liderNombre}</td>
                <td><strong>${eq.total_campanas || eq.campanas_count || 0}</strong></td>
                <td>${formatearFecha(eq.created_at)}</td>
                <td>
                    <div class="action-btns">
                        <button class="action-btn edit" onclick="verEquipo(${eq.id}, '${escapeHtml(eq.nombre)}')" title="Ver equipo">👁️</button>
                        <button class="action-btn" onclick="abrirModalEditarEquipo(${eq.id}, '${escapeHtml(eq.nombre)}', '${escapeHtml(eq.descripcion || '')}')" title="Editar">✏️</button>
                        <button class="action-btn" onclick="verEstadisticasEquipo(${eq.id})" title="Estadísticas">📊</button>
                    </div>
                </td>
            </tr>`;
        }).join('');

        // Cards para móvil
        if (cardsDiv) {
            cardsDiv.innerHTML = data.data.map(eq => {
                const lider = eq.miembros?.find(m => m.es_lider);
                const liderNombre = lider ? escapeHtml(lider.usuario_username || lider.usuario_nombre) : 'Sin líder';
                const totalMiembros = eq.miembros?.length || eq.total_miembros || 0;

                return `<div class="user-card">
                    <div class="admin-user-card-header">
                        <div class="admin-user-card-avatar" style="background:linear-gradient(135deg,#6366f1,#8b5cf6)">🏢</div>
                        <div class="admin-user-card-info">
                            <div class="admin-user-card-name">🏢 ${escapeHtml(eq.nombre)}</div>
                            <div class="admin-user-card-username">${escapeHtml(eq.descripcion || 'Sin descripción')}</div>
                        </div>
                    </div>
                    <div class="admin-user-card-body">
                        <div class="admin-user-card-row">
                            <span class="admin-user-card-label">👥 Miembros</span>
                            <span class="admin-user-card-value">${totalMiembros}</span>
                        </div>
                        <div class="admin-user-card-row">
                            <span class="admin-user-card-label">👑 Líder</span>
                            <span class="admin-user-card-value">${liderNombre}</span>
                        </div>
                        <div class="admin-user-card-row">
                            <span class="admin-user-card-label">📋 Campañas</span>
                            <span class="admin-user-card-value">${eq.total_campanas || eq.campanas_count || 0}</span>
                        </div>
                        <div class="admin-user-card-row">
                            <span class="admin-user-card-label">📅 Creado</span>
                            <span class="admin-user-card-value">${formatearFecha(eq.created_at)}</span>
                        </div>
                    </div>
                    <div class="admin-user-card-actions">
                        <button class="admin-user-card-btn admin-user-card-btn-primary" onclick="verEquipo(${eq.id}, '${escapeHtml(eq.nombre)}')">👁️ Ver</button>
                        <button class="admin-user-card-btn admin-user-card-btn-secondary" onclick="verEstadisticasEquipo(${eq.id})">📊 Stats</button>
                    </div>
                </div>`;
            }).join('');
        }

    } catch (err) {
        console.error('Error cargar equipos:', err);
        tbody.innerHTML = '<tr><td colspan="7" class="admin-loading" style="color:#dc2626">Error al cargar equipos</td></tr>';
        if (cardsDiv) cardsDiv.innerHTML = '<div class="admin-loading" style="color:#dc2626">Error al cargar equipos</div>';
    }
}

function debounceBuscarEquipo() {
    clearTimeout(equiposSearchTimeout);
    equiposSearchTimeout = setTimeout(cargarEquipos, 300);
}

// ============================================================================
// VER DETALLE DEL EQUIPO
// ============================================================================

async function verEquipo(id, nombre) {
    equipoActualId = id;
    equipoActualNombre = nombre;

    // Mostrar vista detalle, ocultar lista
    document.getElementById('equiposListView').style.display = 'none';
    document.getElementById('equipoDetailView').style.display = 'block';

    // Cabecera
    document.getElementById('equipoDetailName').textContent = `🏢 ${nombre}`;
    document.getElementById('equipoDetailDesc').textContent = 'Cargando...';

    try {
        const res = await fetch(`/api/equipos/${id}`);
        if (!res.ok) throw new Error('Error ' + res.status);
        const eq = await res.json();

        document.getElementById('equipoDetailDesc').textContent = eq.descripcion || 'Sin descripción';

        // Stats
        const miembros = eq.miembros || [];
        const lider = miembros.find(m => m.es_lider);
        document.getElementById('equipoStatMiembros').textContent = eq.total_miembros || miembros.length;
        document.getElementById('equipoStatLider').textContent = lider ? escapeHtml(lider.usuario_username || lider.usuario_nombre) : 'Sin asignar';
        document.getElementById('equipoStatCampanas').textContent = eq.total_campanas || 0;
        document.getElementById('equipoStatSolicitudes').textContent = eq.total_asignaciones || 0;

        // Tabla de miembros
        const miembrosBody = document.getElementById('equipoMiembrosBody');
        const miembrosCardsDiv = document.getElementById('equipoMiembrosMobileCards');
        if (!miembros || miembros.length === 0) {
            miembrosBody.innerHTML = '<tr><td colspan="8" class="admin-loading">No hay miembros en este equipo</td></tr>';
            if (miembrosCardsDiv) miembrosCardsDiv.innerHTML = '<div class="admin-loading">No hay miembros en este equipo</div>';
        } else {
            miembrosBody.innerHTML = miembros.map(m => {
                const estado = m.fecha_salida ? 'inactivo' : 'activo';
                const esLider = m.es_lider ? '✅ Sí' : '—';
                return `<tr>
                    <td><span class="admin-username">${escapeHtml(m.usuario_username || 'Usuario #' + m.usuario_id)}</span></td>
                    <td>${escapeHtml(m.usuario_nombre || '-')}</td>
                    <td><span class="role-badge ${m.usuario_rol === 'superadmin' ? 'superadmin' : m.usuario_rol}">${rolLabelUsuario(m.usuario_rol)}</span></td>
                    <td>${esLider}</td>
                    <td>${formatearFecha(m.fecha_ingreso)}</td>
                    <td>${m.fecha_salida ? formatearFecha(m.fecha_salida) : '<span style="color:#10b981">Activo</span>'}</td>
                    <td><span class="estado-indicador"><span class="estado-dot ${estado}"></span>${estado}</span></td>
                    <td>
                        <div class="action-btns">
                            ${!m.es_lider ? `<button class="action-btn edit" onclick="asignarLiderDirecto(${eq.id}, ${m.usuario_id}, '${escapeHtml(m.usuario_username)}')" title="Asignar como líder">👑</button>` : ''}
                            ${!m.fecha_salida ? `<button class="action-btn lock" onclick="removerMiembro(${eq.id}, ${m.usuario_id}, '${escapeHtml(m.usuario_username)}')" title="Remover del equipo" style="color:#dc2626">🚫</button>` : ''}
                        </div>
                    </td>
                </tr>`;
            }).join('');

            // Cards para móvil
            if (miembrosCardsDiv) {
                miembrosCardsDiv.innerHTML = miembros.map(m => {
                    const estado = m.fecha_salida ? 'inactivo' : 'activo';
                    const esLider = m.es_lider ? '✅ Sí' : '—';
                    const estadoColor = estado === 'activo' ? '#10b981' : '#ef4444';
                    const inicial = (m.usuario_nombre || m.usuario_username || '?').charAt(0).toUpperCase();
                    const rolClase = m.usuario_rol === 'superadmin' ? 'superadmin' : (m.usuario_rol === 'lider' ? 'lider' : m.usuario_rol);

                    return `<div class="equipo-miembro-card">
                        <div class="equipo-miembro-header">
                            <div class="equipo-miembro-avatar">${inicial}</div>
                            <div class="equipo-miembro-info">
                                <div class="equipo-miembro-name">${escapeHtml(m.usuario_nombre || m.usuario_username || 'Usuario')}</div>
                                <div class="equipo-miembro-label">@${escapeHtml(m.usuario_username || '')}</div>
                            </div>
                            <span class="role-badge ${rolClase}">${rolLabelUsuario(m.usuario_rol)}</span>
                        </div>
                        <div class="admin-user-card-body">
                            <div class="admin-user-card-row">
                                <span class="admin-user-card-label">👑 Líder</span>
                                <span class="admin-user-card-value">${esLider}</span>
                            </div>
                            <div class="admin-user-card-row">
                                <span class="admin-user-card-label">📅 Ingreso</span>
                                <span class="admin-user-card-value">${formatearFecha(m.fecha_ingreso)}</span>
                            </div>
                            <div class="admin-user-card-row">
                                <span class="admin-user-card-label">📌 Estado</span>
                                <span class="admin-user-card-value"><span class="estado-dot ${estado}" style="background:${estadoColor}"></span> ${m.fecha_salida ? 'Inactivo' : 'Activo'}</span>
                            </div>
                            ${m.fecha_salida ? `<div class="admin-user-card-row">
                                <span class="admin-user-card-label">🚪 Salida</span>
                                <span class="admin-user-card-value">${formatearFecha(m.fecha_salida)}</span>
                            </div>` : ''}
                        </div>
                        <div class="equipo-miembro-actions">
                            ${!m.es_lider ? `<button class="admin-btn admin-btn-sm admin-btn-primary" onclick="asignarLiderDirecto(${eq.id}, ${m.usuario_id}, '${escapeHtml(m.usuario_username)}')">👑 Líder</button>` : ''}
                            ${!m.fecha_salida ? `<button class="admin-btn admin-btn-sm admin-btn-danger" onclick="removerMiembro(${eq.id}, ${m.usuario_id}, '${escapeHtml(m.usuario_username)}')">🚫 Remover</button>` : ''}
                        </div>
                    </div>`;
                }).join('');
            }
        }

        // Campañas del equipo
        await cargarCampanasEquipo(id);

    } catch (err) {
        console.error('Error cargar equipo:', err);
        document.getElementById('equipoDetailDesc').textContent = 'Error al cargar detalles';
    }
}

async function cargarCampanasEquipo(equipoId) {
    const campanasBody = document.getElementById('equipoCampanasBody');
    const campanasCardsDiv = document.getElementById('equipoCampanasMobileCards');
    try {
        const res = await fetch(`/api/equipos/${equipoId}/campanas`);
        if (!res.ok) {
            campanasBody.innerHTML = '<tr><td colspan="6" class="admin-loading" style="color:#dc2626">Error ' + res.status + '</td></tr>';
            if (campanasCardsDiv) campanasCardsDiv.innerHTML = '<div class="admin-loading" style="color:#dc2626">Error ' + res.status + '</div>';
            return;
        }
        const data = await res.json();

        if (!data.data || data.data.length === 0) {
            campanasBody.innerHTML = '<tr><td colspan="6" class="admin-loading">No hay campañas asociadas a este equipo</td></tr>';
            if (campanasCardsDiv) campanasCardsDiv.innerHTML = '<div class="admin-loading">No hay campañas asociadas a este equipo</div>';
            return;
        }

        campanasBody.innerHTML = data.data.map(c => `
            <tr>
                <td>#${c.id}</td>
                <td>${escapeHtml(c.nombre_campana || c.nombre || 'Campaña #' + c.id)}</td>
                <td>${escapeHtml(c.agente_username || '-')}</td>
                <td><strong>${c.total_solicitudes || 0}</strong></td>
                <td><span class="estado-indicador"><span class="estado-dot ${c.estado === 'completada' ? 'activo' : 'inactivo'}"></span>${escapeHtml(c.estado || 'activa')}</span></td>
                <td>${formatearFecha(c.created_at)}</td>
            </tr>
        `).join('');

        // Cards para móvil
        if (campanasCardsDiv) {
            campanasCardsDiv.innerHTML = data.data.map(c => `
                <div class="equipo-campana-card">
                    <div class="equipo-campana-header">
                        <div class="equipo-campana-icon">📋</div>
                        <div class="equipo-campana-info">
                            <div class="equipo-campana-name">${escapeHtml(c.nombre_campana || c.nombre || 'Campaña #' + c.id)}</div>
                        </div>
                        <span class="badge ${c.estado === 'completada' ? 'badge-success' : 'badge-info'}">${escapeHtml(c.estado || 'activa')}</span>
                    </div>
                    <div class="admin-user-card-body">
                        <div class="admin-user-card-row">
                            <span class="admin-user-card-label">🆔 ID</span>
                            <span class="admin-user-card-value">#${c.id}</span>
                        </div>
                        <div class="admin-user-card-row">
                            <span class="admin-user-card-label">👤 Agente</span>
                            <span class="admin-user-card-value">${escapeHtml(c.agente_username || '-')}</span>
                        </div>
                        <div class="admin-user-card-row">
                            <span class="admin-user-card-label">📋 Solicitudes</span>
                            <span class="admin-user-card-value"><strong>${c.total_solicitudes || 0}</strong></span>
                        </div>
                        <div class="admin-user-card-row">
                            <span class="admin-user-card-label">📅 Creado</span>
                            <span class="admin-user-card-value">${formatearFecha(c.created_at)}</span>
                        </div>
                    </div>
                </div>
            `).join('');
        }

    } catch (err) {
        console.error('Error cargar campañas del equipo:', err);
        campanasBody.innerHTML = '<tr><td colspan="6" class="admin-loading" style="color:#dc2626">Error al cargar campañas</td></tr>';
        if (campanasCardsDiv) campanasCardsDiv.innerHTML = '<div class="admin-loading" style="color:#dc2626">Error al cargar campañas</div>';
    }
}

function volverListaEquipos() {
    equipoActualId = null;
    equipoActualNombre = '';
    document.getElementById('equiposListView').style.display = 'block';
    document.getElementById('equipoDetailView').style.display = 'none';
    cargarEquipos();
}

// ============================================================================
// CREAR EQUIPO
// ============================================================================

async function abrirModalCrearEquipo() {
    document.getElementById('createEquipoNombre').value = '';
    document.getElementById('createEquipoDesc').value = '';

    // Cargar usuarios disponibles para líder
    const liderSelect = document.getElementById('createEquipoLider');
    liderSelect.innerHTML = '<option value="">— Sin líder —</option>';
    try {
        const res = await fetch('/api/admin/usuarios?limite=200');
        const data = await res.json();
        if (data.data) {
            data.data.forEach(u => {
                liderSelect.innerHTML += `<option value="${u.id}">${escapeHtml(u.username)} (${escapeHtml(u.nombre || u.username)})</option>`;
            });
        }
    } catch (e) { /* seguir sin opciones */ }

    document.getElementById('createEquipoModal').classList.add('active');
    document.getElementById('modalOverlay').classList.add('active');
}

function cerrarModalCrearEquipo() {
    document.getElementById('createEquipoModal').classList.remove('active');
    document.getElementById('modalOverlay').classList.remove('active');
}

async function crearEquipo() {
    const nombre = document.getElementById('createEquipoNombre').value.trim();
    const descripcion = document.getElementById('createEquipoDesc').value.trim();
    const liderId = document.getElementById('createEquipoLider').value;

    if (!nombre) return alert('El nombre del equipo es requerido');

    try {
        const body = { nombre, descripcion };
        if (liderId) body.lider_id = parseInt(liderId);

        const res = await fetch('/api/equipos', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        const result = await res.json();
        if (res.ok) {
            cerrarModalCrearEquipo();
            cargarEquipos();
            mostrarToast('✅ Equipo creado exitosamente');
        } else {
            alert(result.error || 'Error al crear equipo');
        }
    } catch (err) {
        console.error('Error crear equipo:', err);
        alert('Error de conexión');
    }
}

// ============================================================================
// ASIGNAR LÍDER
// ============================================================================

async function abrirModalAsignarLider() {
    if (!equipoActualId) return;

    document.getElementById('asignarLiderEquipoNombre').value = equipoActualNombre;

    const liderSelect = document.getElementById('asignarLiderSelect');
    liderSelect.innerHTML = '<option value="">Cargando miembros disponibles...</option>';

    try {
        const res = await fetch(`/api/equipos/${equipoActualId}/miembros`);
        const data = await res.json();
        liderSelect.innerHTML = '<option value="">— Seleccionar —</option>';

        if (data.data) {
            data.data.forEach(m => {
                if (!m.fecha_salida) {
                    liderSelect.innerHTML += `<option value="${m.usuario_id}">${escapeHtml(m.usuario_username)} ${m.es_lider ? '(actual líder)' : ''}</option>`;
                }
            });
        }
    } catch (e) {
        liderSelect.innerHTML = '<option value="">Error al cargar miembros</option>';
    }

    document.getElementById('asignarLiderModal').classList.add('active');
    document.getElementById('modalOverlay').classList.add('active');
}

function cerrarModalAsignarLider() {
    document.getElementById('asignarLiderModal').classList.remove('active');
    document.getElementById('modalOverlay').classList.remove('active');
}

async function asignarLider() {
    const userId = parseInt(document.getElementById('asignarLiderSelect').value);
    if (!userId) return alert('Selecciona un usuario para asignar como líder');

    try {
        const res = await fetch(`/api/equipos/${equipoActualId}/asignar-lider`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ usuario_id: userId })
        });
        const result = await res.json();
        if (res.ok) {
            cerrarModalAsignarLider();
            verEquipo(equipoActualId, equipoActualNombre);
            mostrarToast('✅ Líder asignado correctamente');
        } else {
            alert(result.error || 'Error al asignar líder');
        }
    } catch (err) {
        console.error('Error asignar líder:', err);
        alert('Error de conexión');
    }
}

// Asignar líder directo desde la tabla de miembros
function asignarLiderDirecto(equipoId, usuarioId, username) {
    if (!confirm(`¿Asignar a ${username} como líder de ${equipoActualNombre}?`)) return;

    fetch(`/api/equipos/${equipoId}/asignar-lider`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usuario_id: usuarioId })
    })
    .then(r => r.json())
    .then(result => {
        if (result.id || result.mensaje) {
            verEquipo(equipoActualId, equipoActualNombre);
            mostrarToast('✅ Líder asignado: ' + username);
        } else {
            alert(result.error || 'Error');
        }
    })
    .catch(err => {
        console.error(err);
        alert('Error de conexión');
    });
}

// ============================================================================
// CREAR AGENTE
// ============================================================================

async function abrirModalCrearAgente() {
    if (!equipoActualId) return;
    document.getElementById('createAgenteEquipoNombre').value = equipoActualNombre;
    document.getElementById('createAgenteUsername').value = '';
    document.getElementById('createAgenteNombre').value = '';
    document.getElementById('createAgentePassword').value = '';

    document.getElementById('createAgenteModal').classList.add('active');
    document.getElementById('modalOverlay').classList.add('active');
}

function cerrarModalCrearAgente() {
    document.getElementById('createAgenteModal').classList.remove('active');
    document.getElementById('modalOverlay').classList.remove('active');
}

async function crearAgente() {
    const username = document.getElementById('createAgenteUsername').value.trim();
    const nombre = document.getElementById('createAgenteNombre').value.trim();
    const password = document.getElementById('createAgentePassword').value;

    if (!username || !password) return alert('Usuario y contraseña son requeridos');
    if (password.length < 8) return alert('La contraseña debe tener al menos 8 caracteres');

    try {
        const res = await fetch(`/api/equipos/${equipoActualId}/agentes`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, nombre, password })
        });
        const result = await res.json();
        if (res.ok) {
            cerrarModalCrearAgente();
            verEquipo(equipoActualId, equipoActualNombre);
            mostrarToast('✅ Agente creado: ' + username);
        } else {
            alert(result.error || 'Error al crear agente');
        }
    } catch (err) {
        console.error('Error crear agente:', err);
        alert('Error de conexión');
    }
}

// ============================================================================
// MOVER USUARIO
// ============================================================================

async function abrirModalMoverUsuario() {
    if (!equipoActualId) return;

    document.getElementById('moverUsuarioEquipoActual').value = equipoActualNombre;

    // Cargar usuarios del equipo actual
    const userSelect = document.getElementById('moverUsuarioSelect');
    userSelect.innerHTML = '<option value="">Cargando usuarios...</option>';

    // Cargar equipos destino
    const destSelect = document.getElementById('moverUsuarioDestinoSelect');
    destSelect.innerHTML = '<option value="">Cargando equipos...</option>';

    try {
        const [miembrosRes, equiposRes] = await Promise.all([
            fetch(`/api/equipos/${equipoActualId}/miembros`),
            fetch('/api/equipos')
        ]);

        const miembros = await miembrosRes.json();
        const equipos = await equiposRes.json();

        userSelect.innerHTML = '<option value="">— Seleccionar usuario —</option>';
        if (miembros.data) {
            miembros.data.forEach(m => {
                if (!m.fecha_salida) {
                    userSelect.innerHTML += `<option value="${m.usuario_id}">${escapeHtml(m.usuario_username)} ${m.es_lider ? '👑' : ''}</option>`;
                }
            });
        }

        destSelect.innerHTML = '<option value="">— Seleccionar equipo destino —</option>';
        if (equipos.data) {
            equipos.data.forEach(eq => {
                if (eq.id !== equipoActualId) {
                    destSelect.innerHTML += `<option value="${eq.id}">${escapeHtml(eq.nombre)}</option>`;
                }
            });
        }

    } catch (e) {
        userSelect.innerHTML = '<option value="">Error al cargar</option>';
        destSelect.innerHTML = '<option value="">Error al cargar</option>';
    }

    document.getElementById('moverUsuarioModal').classList.add('active');
    document.getElementById('modalOverlay').classList.add('active');
}

function cerrarModalMoverUsuario() {
    document.getElementById('moverUsuarioModal').classList.remove('active');
    document.getElementById('modalOverlay').classList.remove('active');
}

async function moverUsuario() {
    const usuarioId = parseInt(document.getElementById('moverUsuarioSelect').value);
    const equipoDestinoId = parseInt(document.getElementById('moverUsuarioDestinoSelect').value);

    if (!usuarioId) return alert('Selecciona un usuario');
    if (!equipoDestinoId) return alert('Selecciona un equipo destino');

    try {
        const res = await fetch(`/api/equipos/${equipoActualId}/mover-usuario`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ usuario_id: usuarioId, equipo_destino_id: equipoDestinoId })
        });
        const result = await res.json();
        if (res.ok) {
            cerrarModalMoverUsuario();
            verEquipo(equipoActualId, equipoActualNombre);
            mostrarToast('✅ Usuario movido exitosamente');
        } else {
            alert(result.error || 'Error al mover usuario');
        }
    } catch (err) {
        console.error('Error mover usuario:', err);
        alert('Error de conexión');
    }
}

// ============================================================================
// REMOVER MIEMBRO
// ============================================================================

function removerMiembro(equipoId, usuarioId, username) {
    if (!confirm(`¿Remover a ${username} del equipo ${equipoActualNombre}?\n\nEl usuario dejará de pertenecer a este equipo pero conservará su historial.`)) return;

    fetch(`/api/equipos/${equipoId}/remover-miembro`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usuario_id: usuarioId })
    })
    .then(r => r.json())
    .then(result => {
        if (result.mensaje || !result.error) {
            verEquipo(equipoActualId, equipoActualNombre);
            mostrarToast('🚫 Usuario removido del equipo');
        } else {
            alert(result.error || 'Error');
        }
    })
    .catch(err => {
        console.error(err);
        alert('Error de conexión');
    });
}

// ============================================================================
// ELIMINAR EQUIPO
// ============================================================================

function eliminarEquipo() {
    if (!equipoActualId) return;
    document.getElementById('eliminarEquipoNombre').textContent = equipoActualNombre;
    document.getElementById('eliminarEquipoModal').classList.add('active');
    document.getElementById('modalOverlay').classList.add('active');
}

function cerrarModalEliminarEquipo() {
    document.getElementById('eliminarEquipoModal').classList.remove('active');
    document.getElementById('modalOverlay').classList.remove('active');
}

async function confirmarEliminarEquipo() {
    try {
        const res = await fetch(`/api/equipos/${equipoActualId}`, { method: 'DELETE' });
        const result = await res.json();
        if (res.ok) {
            cerrarModalEliminarEquipo();
            volverListaEquipos();
            mostrarToast('🗑️ Equipo eliminado');
        } else {
            alert(result.error || 'Error al eliminar equipo');
        }
    } catch (err) {
        console.error('Error eliminar equipo:', err);
        alert('Error de conexión');
    }
}

// ============================================================================
// ESTADÍSTICAS DEL EQUIPO
// ============================================================================

async function verEstadisticasEquipo(equipoId) {
    try {
        const res = await fetch(`/api/equipos/${equipoId}/dashboard`);
        if (!res.ok) return mostrarToast('Error al cargar estadísticas del equipo');
        const data = await res.json();

        // Mostrar resumen en toast
        const msg = `📊 ${data.equipo_nombre || 'Equipo'}: ${data.total_miembros || 0} miembros, ${data.total_campanas || 0} campañas, ${data.total_asignaciones || 0} asignaciones`;
        mostrarToast(msg);
    } catch (err) {
        console.error('Error estadísticas equipo:', err);
    }
}

// ============================================================================
// HELPER: rolLabelUsuario (para miembros de equipo)
// ============================================================================

function rolLabelUsuario(rol) {
    if (rol === 'superadmin') return 'Super Admin';
    if (rol === 'lider') return 'Líder';
    if (rol === 'agente') return 'Agente';
    return 'Usuario';
}

// ============================================================================
// EXTENDER cambiarTab para cargar equipos cuando se cambie a esa pestaña
// ============================================================================

// Guardar referencia a la función original
const _cambiarTabOriginal = window.cambiarTab;
window.cambiarTab = function(tab) {
    _cambiarTabOriginal(tab);
    if (tab === 'equipos') {
        cargarEquipos();
    }
};

// ============================================================================
// CERRAR TODOS LOS MODALES (overlay compartido)
// ============================================================================

function cerrarTodosLosModales() {
    // Modales existentes
    cerrarModal();                      // userModal
    cerrarModalCrear();                 // createModal (usuario)
    cerrarModalNotif();                 // notifModal
    cerrarStatsUsuario();               // statsUsuarioModal

    // Modales de equipos
    cerrarModalCrearEquipo();           // createEquipoModal
    cerrarModalAsignarLider();          // asignarLiderModal
    cerrarModalCrearAgente();           // createAgenteModal
    cerrarModalMoverUsuario();          // moverUsuarioModal
    cerrarModalEliminarEquipo();        // eliminarEquipoModal

    // Quitar overlay por si alguna función no lo hizo
    document.getElementById('modalOverlay').classList.remove('active');
}

// Toast notifications
function mostrarToast(mensaje) {
    const existing = document.querySelector('.admin-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = 'admin-toast';
    toast.textContent = mensaje;
    toast.style.cssText = `
        position: fixed; bottom: 24px; right: 24px;
        padding: 14px 24px; border-radius: 10px;
        background: var(--admin-primary); color: white;
        font-weight: 600; font-size: 14px;
        box-shadow: 0 4px 20px rgba(0,0,0,0.4);
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
