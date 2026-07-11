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

        if (!data.data || data.data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" class="admin-loading">No se encontraron usuarios</td></tr>';
            if (cardsDiv) cardsDiv.innerHTML = '<div class="admin-loading">No se encontraron usuarios</div>';
            document.getElementById('pageInfo').textContent = 'Página 1';
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
                        ${user.locked_until && new Date(user.locked_until) > new Date() ?
                            `<button class="action-btn lock" onclick="desbloquearUsuario(${user.id})" title="Desbloquear">🔓</button>` : ''}
                    </div>
                </td>
            </tr>`;
        }).join('');

        // Cards para móvil
        cardsDiv.innerHTML = data.data.map(user => {
            const estado = user.is_active ?
                (user.locked_until && new Date(user.locked_until) > new Date() ? 'bloqueado' : 'activo')
                : 'inactivo';
            const rolClass = user.is_superadmin ? 'superadmin' : user.rol;

            return `<div class="user-card">
                <div class="user-card-header">
                    <span class="user-card-name">${escapeHtml(user.username)}</span>
                    <span class="role-badge ${rolClass}">${rolLabel(user)}</span>
                </div>
                <div class="user-card-body">
                    <div class="user-card-row"><span>Nombre</span><strong>${escapeHtml(user.nombre || '-')}</strong></div>
                    <div class="user-card-row"><span>Email</span><strong>${escapeHtml(user.email || '-')}</strong></div>
                    <div class="user-card-row"><span>Estado</span><strong><span class="estado-dot ${estado}"></span> ${estado}</strong></div>
                    <div class="user-card-row"><span>Registro</span><strong>${formatearFecha(user.created_at)}</strong></div>
                    <div class="user-card-row"><span>Último login</span><strong>${formatearFecha(user.last_login) || 'Nunca'}</strong></div>
                </div>
                <div class="user-card-actions">
                    <button class="action-btn edit" onclick="editarUsuario(${user.id})" title="Editar">✏️ Editar</button>
                    ${user.locked_until && new Date(user.locked_until) > new Date() ?
                        `<button class="action-btn lock" onclick="desbloquearUsuario(${user.id})">🔓 Desbloquear</button>` : ''}
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
