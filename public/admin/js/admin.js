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
        if (user.rol === 'superadmin' || user.is_superadmin) {
            badge.textContent = '👑 Super Admin';
        } else if (user.rol === 'admin') {
            badge.textContent = '🛡️ Admin';
        } else {
            console.log('[Admin] No eres admin, redirigiendo a inicio');
            window.location.href = '/';
            return;
        }

        // Reloj
        actualizarReloj();
        setInterval(actualizarReloj, 1000);

        // Cargar datos
        cargarUsuarios();
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

            const rolClass = user.is_superadmin ? 'superadmin' : user.rol;

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
                        ${user.locked_until && new Date(user.locked_until) > new Date() ?
                            `<button class="action-btn lock" onclick="desbloquearUsuario(${user.id})" title="Desbloquear">🔓</button>` : ''}
                    </div>
                </td>
            </tr>`;
        }).join('');

        // ASIGNAR filas a la tabla (¡ESTA LÍNEA FALTABA!)
        tbody.innerHTML = rows;

        // Cards para móvil - versión mejorada responsive
        cardsDiv.innerHTML = data.data.map(user => {
            const estado = user.is_active ?
                (user.locked_until && new Date(user.locked_until) > new Date() ? 'bloqueado' : 'activo')
                : 'inactivo';
            const rolClass = user.is_superadmin ? 'superadmin' : user.rol;
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
        const isSuper = document.querySelector('.admin-badge')?.textContent?.includes('Super');
        rolSelect.innerHTML = '<option value="user">Usuario</option>' +
            (isSuper ? '<option value="admin">Administrador</option><option value="superadmin">Super Admin</option>' : '');
        rolSelect.value = user.is_superadmin ? 'superadmin' : user.rol;

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
    tbody.innerHTML = '<tr><td colspan="6" class="admin-loading">Cargando auditoría...</td></tr>';

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
            return;
        }
        const data = await res.json();

        if (!data.data || data.data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="admin-loading">No hay registros de auditoría</td></tr>';
            return;
        }

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

    } catch (err) {
        console.error('Error auditoría:', err);
        tbody.innerHTML = '<tr><td colspan="6" class="admin-loading" style="color:var(--admin-danger)">Error al cargar auditoría</td></tr>';
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
    if (user.is_superadmin) return 'Super Admin';
    if (user.rol === 'admin') return 'Admin';
    return 'Usuario';
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
