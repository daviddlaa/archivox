// ============================================================================
// PANEL DE ADMINISTRACIÓN - ARCHIVOX
// ============================================================================

let paginaActual = 1;
let searchTimeout;

// ============================================================================
// SISTEMA DE GUARDA DE MODALES - Previene apertura múltiple y ghost clicks
// ============================================================================
// En móvil los eventos táctiles pueden generar múltiples onclick si no hay
// control de estado. Este sistema garantiza que solo un modal esté abierto.
// ============================================================================
let _modalAbiertoId = null; // ID del modal actualmente abierto

// Cache de elementos del DOM de modales para evitar búsquedas repetidas
const _MODALES = {
    overlay: 'modalOverlay',
    user: 'userModal',
    createUser: 'createModal',
    notif: 'notifModal',
    statsUser: 'statsUsuarioModal',
    createEquipo: 'createEquipoModal',
    asignarLider: 'asignarLiderModal',
    createAgente: 'createAgenteModal',
    moverUsuario: 'moverUsuarioModal',
    eliminarEquipo: 'eliminarEquipoModal',
    crearCampana: 'crearCampanaModal'
};

/**
 * Abre un modal de forma segura:
 * 1. Cierra cualquier modal abierto previamente
 * 2. Marca el nuevo modal como abierto
 * 3. Previene aperturas duplicadas por ghost clicks
 */
function _abrirModal(modalId) {
    // Si ya hay un modal abierto, cerrarlo primero
    if (_modalAbiertoId && _modalAbiertoId !== modalId) {
        _cerrarModal(_modalAbiertoId);
    }
    // Si es el mismo modal ya abierto, ignorar (ghost click)
    if (_modalAbiertoId === modalId) return;

    _modalAbiertoId = modalId;
    document.getElementById(modalId).classList.add('active');
    document.getElementById(_MODALES.overlay).classList.add('active');
}

/**
 * Cierra un modal específico:
 * 1. Remueve la clase active del modal
 * 2. Si era el último modal activo, también oculta el overlay
 * 3. Limpia el estado
 * 4. Verifica que no queden otros modales activos (defensa)
 */
function _cerrarModal(modalId) {
    const el = document.getElementById(modalId);
    if (el) el.classList.remove('active');

    if (_modalAbiertoId === modalId) {
        _modalAbiertoId = null;
    }

    // Verificar si hay otros modales activos (por si cerrarTodosLosModales ya los limpió)
    var hayOtroModal = false;
    for (var key in _MODALES) {
        if (key === 'overlay') continue;
        var otro = document.getElementById(_MODALES[key]);
        if (otro && otro !== el && otro.classList.contains('active')) {
            hayOtroModal = true;
            break;
        }
    }

    if (!hayOtroModal) {
        document.getElementById(_MODALES.overlay).classList.remove('active');
    }
}

// ============================================================================
// SISTEMA DE DELEGACIÓN DE EVENTOS PARA BOTONES DE ACCIÓN
// ============================================================================
// Los botones generados dinámicamente (cards de usuarios, miembros de equipo)
// usan un solo escuchador delegado en lugar de inline onclick, para evitar
// duplicación de listeners en cada render y problemas de quoting.
//
// Convención: data-action="nombre-accion" + data-* para parámetros
// ============================================================================

/**
 * Protege contra ghost clicks evitando que clicks en el overlay
 * del admin se propaguen a otros elementos.
 *
 * ⚠️ NOTA: NO se usa stopPropagation global porque eso impediría
 * que los onclick inline (fase target) se ejecuten.
 *
 * En móvil, la protección principal contra ghost clicks es:
 * - CSS touch-action: manipulation (elimina retardo 300ms)
 * - Guarda _abrirModal (ignora aperturas duplicadas)
 *
 * Esta función solo asegura que clicks dentro de modales no
 * se propaguen al overlay (que cierra todos los modales).
 */
function _initGhostClickProtection() {
    // ================================================================
    // PROTEGER el overlay: clicks dentro de modales no deben cerrarlos
    // ================================================================
    document.addEventListener('click', function(e) {
        // Si el click fue dentro de un modal-content (no en el overlay),
        // evitar que el evento llegue al overlay
        var target = e.target;
        while (target && target !== document) {
            if (target.classList && target.classList.contains('admin-modal-content')) {
                // Click dentro del contenido del modal - no propagar al overlay
                e.stopPropagation();
                return;
            }
            // No interferir con el drawer.js MobileMenu
            if (target.id === 'drawer-wrapper' ||
                (target.classList && target.classList.contains('mm-overlay'))) {
                return;
            }
            target = target.parentElement;
        }
    }, false); // Fase bubbling: el onclick del botón ya se ejecutó
}

// Inicializar al cargar (una sola vez)
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _initGhostClickProtection);
} else {
    _initGhostClickProtection();
}


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

        // Badge de notificaciones en tiempo real (SSE)
        actualizarBadgeNotif();
        iniciarSSEAdmin();

        // ================================================================
        // SUPERADMIN MOBILE: Soporte para navegación por ?tab= query param
        // Permite que los enlaces del menú móvil abran tabs específicos
        // ================================================================
        var urlParams = new URLSearchParams(window.location.search);
        var tabParam = urlParams.get('tab');
        if (tabParam) {
            var tabValido = ['usuarios', 'estadisticas', 'auditoria', 'notificaciones', 'solicitudes', 'equipos'];
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
let conexionesTimer = null;
let tabActivo = 'usuarios';

function cambiarTab(tab) {
    tabActivo = tab;
    document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.admin-tab-content').forEach(t => t.classList.remove('active'));

    document.querySelector(`.admin-tab[data-tab="${tab}"]`).classList.add('active');
    document.getElementById(`tab-${tab}`).classList.add('active');

    if (tab === 'estadisticas') {
        cargarEstadisticas();
        cargarConexiones();
        iniciarRefreshConexiones();
    }
    if (tab === 'auditoria') cargarAuditoria();
    if (tab === 'notificaciones') { cargarNotificaciones(); actualizarBadgeNotif(); }
    if (tab === 'solicitudes') { cargarFiltrosSolicitudesGlobales(); cargarSolicitudesGlobales(); }
    if (tab === 'basedatos') cargarEstadoBD();
}

// ============================================================================
// BACKUP / DUMP DE BASE DE DATOS
// ============================================================================
// GET /api/admin/dump/info — muestra el motor activo.
// GET /api/admin/dump — descarga el respaldo SQL en un solo clic (superadmin).
// ============================================================================
async function cargarEstadoBD() {
    const el = document.getElementById('dbMotor');
    if (!el) return;
    el.textContent = 'Consultando motor...';
    try {
        const res = await fetch('/api/admin/dump/info');
        if (!res.ok) {
            el.textContent = '';
            return;
        }
        const info = await res.json();
        const nombre = info.motor === 'postgres' ? 'PostgreSQL (producción)' : 'SQLite (local)';
        el.textContent = 'Motor: ' + nombre + ' · ' + (info.tablas || 0) + ' tablas';
    } catch (err) {
        console.error('Error cargarEstadoBD:', err);
        el.textContent = '';
    }
}

async function descargarDumpBD() {
    const btn = document.querySelector('#tab-basedatos .admin-btn-primary');
    const status = document.getElementById('dumpStatus');
    const textoOriginal = btn ? btn.textContent : '';

    try {
        if (btn) { btn.disabled = true; btn.textContent = '⏳ Generando dump...'; }
        if (status) status.style.color = '#6b7280';

        const res = await fetch('/api/admin/dump');
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.error || ('Error ' + res.status));
        }

        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const match = (res.headers.get('Content-Disposition') || '').match(/filename="?([^";]+)"?/i);
        const a = document.createElement('a');
        a.href = url;
        a.download = match ? match[1] : 'archivox_dump.sql';
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 10000);

        if (status) {
            status.textContent = '✅ Dump generado correctamente. Revisa tu carpeta de descargas.';
            status.style.color = '#16a34a';
        }
    } catch (err) {
        console.error('Error descargarDumpBD:', err);
        if (status) {
            status.textContent = '❌ ' + err.message;
            status.style.color = '#dc2626';
        }
    } finally {
        if (btn) { btn.disabled = false; btn.textContent = textoOriginal; }
    }
}

// ============================================================================
// CONEXIONES Y SEGURIDAD (tiempo real)
// ============================================================================
// Se alimenta de GET /api/admin/conexiones (solo superadmin).
// Se auto-refresca cada 30s mientras la pestaña está activa.
// ============================================================================
function iniciarRefreshConexiones() {
    if (conexionesTimer) return;
    conexionesTimer = setInterval(() => {
        const tabActivo = document.querySelector('.admin-tab.active');
        if (tabActivo && tabActivo.dataset.tab === 'estadisticas') {
            cargarConexiones();
        } else {
            clearInterval(conexionesTimer);
            conexionesTimer = null;
        }
    }, 30000);
}

function formatearUptime(segundos) {
    const h = Math.floor(segundos / 3600);
    const m = Math.floor((segundos % 3600) / 60);
    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m`;
    return `${segundos}s`;
}

async function cargarConexiones() {
    const grid = document.getElementById('conexionesGrid');
    const tbody = document.getElementById('conexionesTableBody');
    const cardsDiv = document.getElementById('conexionesMobileCards');
    const updatedEl = document.getElementById('conexionesUpdated');
    if (!grid) return;

    try {
        const res = await fetch('/api/admin/conexiones');
        if (!res.ok) {
            grid.innerHTML = `<div class="stat-card stat-loading" style="color:#dc2626">Error ${res.status} al cargar conexiones</div>`;
            return;
        }
        const data = await res.json();

        const sse = data.sse || {};
        const pool = data.pool || {};
        const mon = data.monitor || {};
        const bloques = mon.bloqueos || {};

        const poolInfo = pool.engine === 'postgres'
            ? `${pool.total} total · ${pool.idle} idle · ${pool.waiting} esperando`
            : 'SQLite (local)';

        // Tarjetas resumen (reutilizan estilos de stat-card)
        grid.innerHTML = `
            <div class="stat-card">
                <div class="stat-icon">🟢</div>
                <div class="stat-label">Conectados ahora</div>
                <div class="stat-value">${sse.usuarios_conectados || 0}</div>
                <div class="stat-sub">${sse.total_conexiones || 0} conexiones SSE</div>
            </div>
            <div class="stat-card">
                <div class="stat-icon">📈</div>
                <div class="stat-label">Peticiones (15 min)</div>
                <div class="stat-value">${(mon.total_peticiones || 0).toLocaleString()}</div>
                <div class="stat-sub">${mon.usuarios_activos || 0} usuarios activos</div>
            </div>
            <div class="stat-card">
                <div class="stat-icon">⏱️</div>
                <div class="stat-label">Uptime servidor</div>
                <div class="stat-value">${formatearUptime(mon.uptime_segundos || 0)}</div>
                <div class="stat-sub">desde el último reinicio</div>
            </div>
            <div class="stat-card">
                <div class="stat-icon">🛡️</div>
                <div class="stat-label">Bloqueos Rate Limit</div>
                <div class="stat-value">${bloques.total || 0}</div>
                <div class="stat-sub">${bloques.ultimo ? 'último: ' + formatearFecha(bloques.ultimo) : 'sin bloqueos'}</div>
            </div>
            <div class="stat-card">
                <div class="stat-icon">🗄️</div>
                <div class="stat-label">Pool BD</div>
                <div class="stat-value">${pool.engine === 'postgres' ? pool.total : 'SQLite'}</div>
                <div class="stat-sub">${poolInfo}</div>
            </div>
        `;

        // Usuarios con actividad
        const usuarios = data.usuarios || [];
        if (tbody) {
            if (usuarios.length === 0) {
                tbody.innerHTML = '<tr><td colspan="6" class="admin-loading">Sin actividad en los últimos 15 min</td></tr>';
            } else {
                tbody.innerHTML = usuarios.map(u => {
                    const rolClass = u.rol === 'lider' ? 'lider' : u.rol;
                    return `<tr>
                        <td><span class="admin-username">${escapeHtml(u.username)}</span></td>
                        <td>${escapeHtml(u.nombre || '-')}</td>
                        <td><span class="role-badge ${rolClass}">${rolLabel({ rol: u.rol, is_superadmin: u.rol === 'superadmin' })}</span></td>
                        <td>${u.peticiones_15min}</td>
                        <td>${u.conexiones_sse > 0 ? '🔌 ' + u.conexiones_sse : '—'}</td>
                        <td>${u.conectado_ahora ? '<span style="color:#10b981">●</span>' : '—'}</td>
                    </tr>`;
                }).join('');
            }
        }

        // Mobile cards
        if (cardsDiv) {
            if (usuarios.length === 0) {
                cardsDiv.innerHTML = '<div class="admin-loading">Sin actividad en los últimos 15 min</div>';
            } else {
                cardsDiv.innerHTML = usuarios.map(u => {
                    const rolClass = u.rol === 'lider' ? 'lider' : u.rol;
                    return `<div class="user-card">
                        <div class="admin-user-card-header">
                            <div class="admin-user-card-avatar">${escapeHtml((u.nombre || u.username).charAt(0).toUpperCase())}</div>
                            <div class="admin-user-card-info">
                                <div class="admin-user-card-name">${escapeHtml(u.nombre || u.username)}</div>
                                <div class="admin-user-card-username">@${escapeHtml(u.username)}</div>
                            </div>
                            <span class="role-badge ${rolClass}">${rolLabel({ rol: u.rol, is_superadmin: u.rol === 'superadmin' })}</span>
                        </div>
                        <div class="admin-user-card-body">
                            <div class="admin-user-card-row">
                                <span class="admin-user-card-label">📈 Peticiones (15 min)</span>
                                <span class="admin-user-card-value">${u.peticiones_15min}</span>
                            </div>
                            <div class="admin-user-card-row">
                                <span class="admin-user-card-label">🔌 SSE</span>
                                <span class="admin-user-card-value">${u.conexiones_sse > 0 ? u.conexiones_sse + ' conexión(es)' : 'Inactivo'}</span>
                            </div>
                            <div class="admin-user-card-row">
                                <span class="admin-user-card-label">🟢 Estado</span>
                                <span class="admin-user-card-value">${u.conectado_ahora ? 'Conectado ahora' : 'Sin conexión SSE'}</span>
                            </div>
                        </div>
                    </div>`;
                }).join('');
            }
        }

        if (updatedEl) updatedEl.textContent = 'Actualizado: ' + formatearFecha(new Date().toISOString());
    } catch (err) {
        console.error('Error cargar conexiones:', err);
        grid.innerHTML = '<div class="stat-card stat-loading" style="color:var(--admin-danger)">Error al cargar conexiones</div>';
    }
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
        _abrirModal(_MODALES.user);

    } catch (err) {
        console.error('Error editar usuario:', err);
        alert('Error al cargar datos del usuario');
    }
}

function cerrarModal() {
    _cerrarModal(_MODALES.user);
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
    document.getElementById('createUsername').value = '';
    document.getElementById('createNombre').value = '';
    document.getElementById('createEmail').value = '';
    document.getElementById('createPassword').value = '';
    _abrirModal(_MODALES.createUser);
}

function cerrarModalCrear() {
    _cerrarModal(_MODALES.createUser);
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
        const archivadaCheck = document.getElementById('filterNotifArchivada');
        const archivada = archivadaCheck && archivadaCheck.checked ? '1' : '0';

        let url = `/api/admin/notificaciones?pagina=${paginaNotif}&limite=15&archivada=${archivada}`;
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
                <td><strong>${escapeHtml(n.titulo)}</strong>${Number(n.es_novedad) === 1 ? ' <span style="background:linear-gradient(135deg,#7c3aed,#2563eb);color:#fff;font-size:9px;font-weight:700;padding:2px 7px;border-radius:10px;margin-left:4px;vertical-align:middle">🆕 NUEVO</span>' : ''}</td>
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
                        ${Number(n.archivada) === 1 ? `<button class="action-btn" onclick="restaurarNotificacionAdmin(${n.id})" title="Restaurar a activas">↩</button>` : ''}
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
                const esNovedad = Number(n.es_novedad) === 1;

                return `<div class="notif-admin-card ${n.leida ? 'notif-admin-card-leida' : 'notif-admin-card-no-leida'}${esNovedad ? ' notif-admin-card-novedad' : ''}">
                    <div class="notif-admin-card-header">
                        <div class="notif-admin-card-icon" style="background:${esNovedad ? '#7c3aed20' : tipoColor + '20'}">
                            <span>${esNovedad ? '✨' : tipoIcono}</span>
                        </div>
                        <div class="notif-admin-card-info">
                            <div class="notif-admin-card-title">${escapeHtml(n.titulo)}${esNovedad ? ' <span style="background:linear-gradient(135deg,#7c3aed,#2563eb);color:#fff;font-size:9px;font-weight:700;padding:2px 7px;border-radius:10px;margin-left:4px;vertical-align:middle">🆕 NUEVO</span>' : ''}</div>
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
                        ${Number(n.archivada) === 1 ? `<button class="admin-user-card-btn admin-user-card-btn-secondary" onclick="restaurarNotificacionAdmin(${n.id})">↩ Restaurar</button>` : ''}
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
    document.getElementById('notifEsNovedad').checked = false;
    _abrirModal(_MODALES.notif);
}

function cerrarModalNotif() {
    _cerrarModal(_MODALES.notif);
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
    const es_novedad = document.getElementById('notifEsNovedad').checked ? 1 : 0;

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
                destinatario_id,
                es_novedad         // 🆕 1 = anuncio de nueva funcionalidad
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
            actualizarBadgeNotif();
            mostrarToast('📦 Notificación archivada');
        }
    } catch (err) {
        console.error('Error archivar:', err);
    }
}

// Restaurar notificación archivada desde el admin
async function restaurarNotificacionAdmin(id) {
    try {
        const res = await fetch(`/api/admin/notificaciones/${id}/restaurar`, { method: 'PUT' });
        if (res.ok) {
            cargarNotificaciones();
            actualizarBadgeNotif();
            mostrarToast('↩ Notificación restaurada a activas');
        }
    } catch (err) {
        console.error('Error restaurar:', err);
    }
}

// ============================================================================
// SSE EN VIVO PARA EL BADGE DEL ADMIN (tiempo real)
// ============================================================================
function iniciarSSEAdmin() {
    try {
        const es = new EventSource('/api/admin/notificaciones/stream', { withCredentials: true });

        es.addEventListener('notification.created', function() {
            actualizarBadgeNotif();
            if (tabActivo === 'notificaciones') cargarNotificaciones();
        });

        es.addEventListener('notification.read', function() {
            actualizarBadgeNotif();
            if (tabActivo === 'notificaciones') cargarNotificaciones();
        });

        es.addEventListener('notification.archived', function() {
            actualizarBadgeNotif();
            if (tabActivo === 'notificaciones') cargarNotificaciones();
        });

        es.addEventListener('count.updated', function(e) {
            actualizarBadgeNotif();
        });

        es.onerror = function() {
            // El EventSource se reconecta solo; solo re-sincronizar el badge
            actualizarBadgeNotif();
        };
    } catch (err) {
        console.error('Error SSE admin:', err);
    }
}

// ============================================================================
// ESTADÍSTICAS POR USUARIO
// ============================================================================

async function verEstadisticasUsuario(userId, username) {
    document.getElementById('statsUsuarioTitle').textContent = `📊 Estadísticas: ${username}`;
    document.getElementById('statsUsuarioContent').innerHTML = '<div class="admin-loading">Cargando estadísticas...</div>';
    _abrirModal(_MODALES.statsUser);

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
    _cerrarModal(_MODALES.statsUser);
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

    _abrirModal(_MODALES.createEquipo);
}

function cerrarModalCrearEquipo() {
    _cerrarModal(_MODALES.createEquipo);
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

    _abrirModal(_MODALES.asignarLider);
}

function cerrarModalAsignarLider() {
    _cerrarModal(_MODALES.asignarLider);
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

    _abrirModal(_MODALES.createAgente);
}

function cerrarModalCrearAgente() {
    _cerrarModal(_MODALES.createAgente);
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

    _abrirModal(_MODALES.moverUsuario);
}

function cerrarModalMoverUsuario() {
    _cerrarModal(_MODALES.moverUsuario);
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
    _abrirModal(_MODALES.eliminarEquipo);
}

function cerrarModalEliminarEquipo() {
    _cerrarModal(_MODALES.eliminarEquipo);
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
    // Cerrar todos los modales de forma ordenada
    for (var key in _MODALES) {
        if (key === 'overlay') continue;
        _cerrarModal(_MODALES[key]);
    }
    // Forzar limpieza del overlay
    var overlay = document.getElementById(_MODALES.overlay);
    if (overlay) overlay.classList.remove('active');
    _modalAbiertoId = null;
}


// ============================================================================
// SOLICITUDES GLOBALES (superadmin, solo lectura)
// ============================================================================
let paginaSolGlobal = 1;
let totalSolGlobal = 0;
let limiteSolGlobal = 50;
let _debounceSolGlobal = null;
const solicitudesSeleccionadas = new Set();

function debounceBuscarSolicitudesGlobales() {
    clearTimeout(_debounceSolGlobal);
    _debounceSolGlobal = setTimeout(function() { cargarSolicitudesGlobales(1); }, 350);
}

async function cargarFiltrosSolicitudesGlobales() {
    try {
        const res = await fetch('/api/admin/solicitudes/filtros');
        if (!res.ok) return;
        const data = await res.json();

        const llenar = function(selectId, valores, placeholder, fijas) {
            const sel = document.getElementById(selectId);
            if (!sel) return;
            const previo = sel.value;
            let html = '<option value="">' + placeholder + '</option>';
            (fijas || []).forEach(function(o) {
                html += '<option value="' + o[0] + '">' + o[1] + '</option>';
            });
            (valores || []).forEach(function(v) {
                const val = String(v).replace(/"/g, '&quot;');
                html += '<option value="' + val + '">' + val + '</option>';
            });
            sel.innerHTML = html;
            if (previo && Array.prototype.some.call(sel.options, function(o) { return o.value === previo; })) {
                sel.value = previo;
            }
        };

        llenar('filterSolEstado', data.estados, 'Todos los estados', [['__no_aplica_credito__', '👎 No aplica para crédito']]);
        llenar('filterSolSegmento', data.segmentos, 'Todos los segmentos');
        llenar('filterSolProducto', data.productos, 'Todos los productos');
    } catch (err) {
        console.error('[Admin] Error cargando filtros solicitudes:', err);
    }
}

async function cargarSolicitudesGlobales(pagina) {
    if (pagina) paginaSolGlobal = pagina;
    const tbody = document.getElementById('solicitudesGlobalTableBody');
    const cardsDiv = document.getElementById('solicitudesGlobalMobileCards');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="11" class="admin-loading">Cargando solicitudes...</td></tr>';
    if (cardsDiv) cardsDiv.innerHTML = '<div class="admin-loading">Cargando solicitudes...</div>';

    try {
        const q = (document.getElementById('searchSolicitudGlobal') || {}).value || '';
        const estado = (document.getElementById('filterSolEstado') || {}).value || '';
        const segmento = (document.getElementById('filterSolSegmento') || {}).value || '';
        const producto = (document.getElementById('filterSolProducto') || {}).value || '';
        const usuario_id = (document.getElementById('filterSolUsuario') || {}).value || '';
        const fecha_desde = (document.getElementById('filterSolDesde') || {}).value || '';
        const fecha_hasta = (document.getElementById('filterSolHasta') || {}).value || '';
        const vendedor = (document.getElementById('filterSolVendedor') || {}).value || '';

        let url = '/api/admin/solicitudes?pagina=' + paginaSolGlobal + '&limite=' + limiteSolGlobal;
        if (q) url += '&q=' + encodeURIComponent(q);
        if (estado) url += '&estado=' + encodeURIComponent(estado);
        if (segmento) url += '&segmento=' + encodeURIComponent(segmento);
        if (producto) url += '&producto=' + encodeURIComponent(producto);
        if (usuario_id) url += '&usuario_id=' + encodeURIComponent(usuario_id);
        if (fecha_desde) url += '&fecha_desde=' + encodeURIComponent(fecha_desde);
        if (fecha_hasta) url += '&fecha_hasta=' + encodeURIComponent(fecha_hasta);
        if (vendedor) url += '&vendedor=' + encodeURIComponent(vendedor);

        const res = await fetch(url);
        if (!res.ok) {
            const errData = await res.json().catch(() => ({ error: res.statusText }));
            tbody.innerHTML = '<tr><td colspan="11" class="admin-loading" style="color:#dc2626">Error ' + res.status + ': ' + escapeHtml(errData.error || '') + '</td></tr>';
            if (cardsDiv) cardsDiv.innerHTML = '<div class="admin-loading" style="color:#dc2626">Error ' + res.status + '</div>';
            return;
        }
        const data = await res.json();
        totalSolGlobal = data.total || 0;
        const rows = data.data || [];

        if (rows.length === 0) {
            tbody.innerHTML = '<tr><td colspan="11" class="admin-loading">No se encontraron solicitudes</td></tr>';
            if (cardsDiv) cardsDiv.innerHTML = '<div class="admin-loading">No se encontraron solicitudes</div>';
        } else {
            tbody.innerHTML = rows.map(function(s) {
                const dueno = s.dueno_username || s.dueno_nombre || ('#' + (s.usuario_id || '-'));
                const solId = s.id_solicitud || s.id;
                const sel = solicitudesSeleccionadas.has(solId);
                return '<tr>' +
                    '<td><input type="checkbox" class="sol-global-check" data-id="' + solId + '" onchange="toggleSolicitudGlobal(this)"' + (sel ? ' checked' : '') + '></td>' +
                    '<td>' + escapeHtml(solId) + '</td>' +
                    '<td>' + escapeHtml(s.cedula || '-') + '</td>' +
                    '<td>' + escapeHtml(s.nombre || '-') + '</td>' +
                    '<td>' + escapeHtml(s.celular || '-') + '</td>' +
                    '<td>' + escapeHtml(s.estado || '-') + '</td>' +
                    '<td>' + escapeHtml(s.segmento || '-') + '</td>' +
                    '<td>' + escapeHtml(dueno) + '</td>' +
                    '<td>' + escapeHtml(s.vendedor || '-') + '</td>' +
                    '<td>' + escapeHtml(s.nombre_campana || (s.campana_id ? '#' + s.campana_id : '-')) + '</td>' +
                    '<td>' + formatearFecha(s.fecha_solicitud || s.created_at) + '</td>' +
                    '</tr>';
            }).join('');

            if (cardsDiv) {
                cardsDiv.innerHTML = rows.map(function(s) {
                    const dueno = s.dueno_username || s.dueno_nombre || ('#' + (s.usuario_id || '-'));
                    const solId = s.id_solicitud || s.id;
                    const sel = solicitudesSeleccionadas.has(solId);
                    return '<div class="user-card">' +
                        '<div class="admin-user-card-header">' +
                        '<input type="checkbox" class="sol-global-check" data-id="' + solId + '" onchange="toggleSolicitudGlobal(this)"' + (sel ? ' checked' : '') + '>' +
                        '<div class="admin-user-card-info">' +
                        '<div class="admin-user-card-name">#' + escapeHtml(solId) + ' · ' + escapeHtml(s.nombre || '-') + '</div>' +
                        '<div class="admin-user-card-username">' + escapeHtml(s.cedula || '-') + ' · ' + escapeHtml(s.celular || '-') + '</div>' +
                        '</div>' +
                        '<span class="role-badge">' + escapeHtml(s.estado || '-') + '</span>' +
                        '</div>' +
                        '<div class="admin-user-card-body">' +
                        '<div class="admin-user-card-row"><span class="admin-user-card-label">Dueño</span><span class="admin-user-card-value">' + escapeHtml(dueno) + '</span></div>' +
                        '<div class="admin-user-card-row"><span class="admin-user-card-label">Segmento</span><span class="admin-user-card-value">' + escapeHtml(s.segmento || '-') + '</span></div>' +
                        '<div class="admin-user-card-row"><span class="admin-user-card-label">Vendedor</span><span class="admin-user-card-value">' + escapeHtml(s.vendedor || '-') + '</span></div>' +
                        '<div class="admin-user-card-row"><span class="admin-user-card-label">Campaña</span><span class="admin-user-card-value">' + escapeHtml(s.nombre_campana || '-') + '</span></div>' +
                        '<div class="admin-user-card-row"><span class="admin-user-card-label">Fecha</span><span class="admin-user-card-value">' + formatearFecha(s.fecha_solicitud || s.created_at) + '</span></div>' +
                        '</div></div>';
                }).join('');
            }
        }

        const totalPaginas = Math.max(1, Math.ceil(totalSolGlobal / limiteSolGlobal));
        const info = document.getElementById('pageInfoSolGlobal');
        if (info) info.textContent = 'Página ' + paginaSolGlobal + ' de ' + totalPaginas + ' · ' + totalSolGlobal + ' total';
        const prev = document.getElementById('prevPageSolGlobal');
        const next = document.getElementById('nextPageSolGlobal');
        if (prev) prev.disabled = paginaSolGlobal <= 1;
        if (next) next.disabled = paginaSolGlobal >= totalPaginas;
    } catch (err) {
        console.error('[Admin] Error solicitudes globales:', err);
        tbody.innerHTML = '<tr><td colspan="11" class="admin-loading" style="color:#dc2626">' + escapeHtml(err.message) + '</td></tr>';
    }
    sincronizarSeleccionTodasSol();
    actualizarContadorSeleccion();
}

function cambiarPaginaSolicitudesGlobales(dir) {
    if (dir === 'prev' && paginaSolGlobal > 1) {
        cargarSolicitudesGlobales(paginaSolGlobal - 1);
    } else if (dir === 'next') {
        cargarSolicitudesGlobales(paginaSolGlobal + 1);
    }
}

function exportarSolicitudesGlobales() {
    const q = (document.getElementById('searchSolicitudGlobal') || {}).value || '';
    const estado = (document.getElementById('filterSolEstado') || {}).value || '';
    const segmento = (document.getElementById('filterSolSegmento') || {}).value || '';
    const producto = (document.getElementById('filterSolProducto') || {}).value || '';
    const usuario_id = (document.getElementById('filterSolUsuario') || {}).value || '';
    const fecha_desde = (document.getElementById('filterSolDesde') || {}).value || '';
    const fecha_hasta = (document.getElementById('filterSolHasta') || {}).value || '';
    const vendedor = (document.getElementById('filterSolVendedor') || {}).value || '';
    let url = '/api/admin/solicitudes/export?';
    const parts = [];
    if (q) parts.push('q=' + encodeURIComponent(q));
    if (estado) parts.push('estado=' + encodeURIComponent(estado));
    if (segmento) parts.push('segmento=' + encodeURIComponent(segmento));
    if (producto) parts.push('producto=' + encodeURIComponent(producto));
    if (usuario_id) parts.push('usuario_id=' + encodeURIComponent(usuario_id));
    if (fecha_desde) parts.push('fecha_desde=' + encodeURIComponent(fecha_desde));
    if (fecha_hasta) parts.push('fecha_hasta=' + encodeURIComponent(fecha_hasta));
    if (vendedor) parts.push('vendedor=' + encodeURIComponent(vendedor));
    window.location.href = url + parts.join('&');
}

// ============================================================================
// SELECCIÓN MULTIPLE DE SOLICITUDES → CREAR CAMPAÑA ASIGNADA POR EL SISTEMA
// ============================================================================
function toggleSolicitudGlobal(el) {
    const id = Number(el.getAttribute('data-id'));
    if (el.checked) {
        solicitudesSeleccionadas.add(id);
    } else {
        solicitudesSeleccionadas.delete(id);
    }
    sincronizarSeleccionTodasSol();
    actualizarContadorSeleccion();
}

function toggleSeleccionarTodasSol(el) {
    const checks = document.querySelectorAll('.sol-global-check');
    checks.forEach(function(c) {
        c.checked = el.checked;
        const id = Number(c.getAttribute('data-id'));
        if (el.checked) {
            solicitudesSeleccionadas.add(id);
        } else {
            solicitudesSeleccionadas.delete(id);
        }
    });
    actualizarContadorSeleccion();
}

function sincronizarSeleccionTodasSol() {
    const todas = document.getElementById('seleccionarTodasSol');
    if (!todas) return;
    const checks = document.querySelectorAll('.sol-global-check');
    todas.checked = checks.length > 0 && Array.prototype.every.call(checks, function(c) { return c.checked; });
}

function actualizarContadorSeleccion() {
    const n = solicitudesSeleccionadas.size;
    const btn = document.getElementById('btnCrearCampanaSistema');
    const contador = document.getElementById('contadorSeleccionSol');
    if (btn) btn.disabled = n === 0;
    if (contador) contador.textContent = n > 0 ? n + ' solicitud' + (n > 1 ? 'es' : '') + ' seleccionada' + (n > 1 ? 's' : '') : '';
}

function abrirModalCrearCampana() {
    if (solicitudesSeleccionadas.size === 0) {
        mostrarToast('⚠️ Selecciona al menos una solicitud');
        return;
    }
    document.getElementById('campanaNombre').value = '';
    document.getElementById('campanaDescripcion').value = '';
    document.getElementById('campanaFechaLimite').value = '';
    document.getElementById('campanaUsuario').value = '';
    document.getElementById('campanaSeleccionadas').textContent =
        solicitudesSeleccionadas.size + ' solicitud' + (solicitudesSeleccionadas.size > 1 ? 'es' : '') + ' seleccionada' + (solicitudesSeleccionadas.size > 1 ? 's' : '');
    cargarUsuariosParaCampana();
    _abrirModal(_MODALES.crearCampana);
}

function cerrarModalCrearCampana() {
    _cerrarModal(_MODALES.crearCampana);
}

async function cargarUsuariosParaCampana() {
    const sel = document.getElementById('campanaUsuario');
    if (!sel) return;
    sel.innerHTML = '<option value="">Cargando usuarios...</option>';
    try {
        const res = await fetch('/api/admin/usuarios?limite=1000');
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const data = await res.json();
        const usuarios = (data.data || []).filter(function(u) {
            return !u.is_superadmin && u.rol !== 'superadmin' && u.is_active;
        }).sort(function(a, b) {
            return (a.nombre || a.username || '').localeCompare(b.nombre || b.username || '');
        });
        let html = '<option value="">Selecciona el usuario destino...</option>';
        usuarios.forEach(function(u) {
            html += '<option value="' + u.id + '">' + escapeHtml(u.nombre || u.username) + ' (@' + escapeHtml(u.username) + ')</option>';
        });
        sel.innerHTML = html;
    } catch (err) {
        console.error('[Admin] Error cargando usuarios para campaña:', err);
        sel.innerHTML = '<option value="">Error cargando usuarios</option>';
    }
}

async function crearCampanaSistema() {
    const usuario_id = document.getElementById('campanaUsuario').value;
    const nombre = document.getElementById('campanaNombre').value;
    const descripcion = document.getElementById('campanaDescripcion').value;
    const fecha_limite = document.getElementById('campanaFechaLimite').value || null;

    if (!usuario_id) return alert('Selecciona el usuario destino');
    if (!nombre.trim()) return alert('El nombre de la campaña es requerido');

    const btn = document.getElementById('btnGuardarCampanaSistema');
    const original = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Creando...';

    try {
        const res = await fetch('/api/admin/campanas', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                usuario_id: Number(usuario_id),
                nombre: nombre.trim(),
                descripcion: descripcion,
                fecha_limite: fecha_limite,
                solicitudes_ids: Array.from(solicitudesSeleccionadas)
            })
        });
        const result = await res.json();
        if (!res.ok) {
            throw new Error(result.error || result.detalle || 'HTTP ' + res.status);
        }
        cerrarModalCrearCampana();
        solicitudesSeleccionadas.clear();
        actualizarContadorSeleccion();
        sincronizarSeleccionTodasSol();
        cargarSolicitudesGlobales(1);
        mostrarToast('✅ ' + result.mensaje);
    } catch (err) {
        console.error('[Admin] Error creando campaña sistema:', err);
        alert('Error al crear la campaña: ' + err.message);
    } finally {
        btn.disabled = false;
        btn.textContent = original;
    }
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
