// ============================================================================
// NOTIFICACIONES - COMPONENTE PARA DASHBOARD
// ============================================================================
// Compartido entre escritorio y móvil.
// Muestra la campana con badge y un panel deslizable con las notificaciones.
// ============================================================================

// ============================================================================
// INICIALIZAR: Llamar después de que el DOM esté listo
// ============================================================================
function initNotificaciones() {
    // Crear el panel de notificaciones si no existe
    if (!document.getElementById('notif-panel')) {
        crearPanelNotificaciones();
    }
    // Cargar badge de no leídas
    actualizarBadgeNotifUsuario();
    // Actualizar cada 30 segundos
    setInterval(actualizarBadgeNotifUsuario, 30000);
}

// ============================================================================
// CREAR PANEL DE NOTIFICACIONES (inserta el HTML en el body)
// ============================================================================
function crearPanelNotificaciones() {
    // Overlay
    const overlay = document.createElement('div');
    overlay.id = 'notif-panel-overlay';
    overlay.className = 'notif-overlay';
    overlay.onclick = cerrarPanelNotificaciones;

    // Panel
    const panel = document.createElement('div');
    panel.id = 'notif-panel';
    panel.className = 'notif-panel';
    panel.innerHTML = `
        <div class="notif-panel-header">
            <h3>🔔 Notificaciones</h3>
            <button class="notif-panel-close" onclick="cerrarPanelNotificaciones()">✕</button>
        </div>
        <div class="notif-panel-body" id="notif-panel-body">
            <div class="notif-loading">Cargando...</div>
        </div>
    `;

    document.body.appendChild(overlay);
    document.body.appendChild(panel);
}

// ============================================================================
// ABRIR / CERRAR PANEL
// ============================================================================
function abrirPanelNotificaciones() {
    const panel = document.getElementById('notif-panel');
    const overlay = document.getElementById('notif-panel-overlay');
    if (panel && overlay) {
        panel.classList.add('open');
        overlay.classList.add('open');
        cargarNotificacionesUsuario();
        document.body.style.overflow = 'hidden';
    }
}

function cerrarPanelNotificaciones() {
    const panel = document.getElementById('notif-panel');
    const overlay = document.getElementById('notif-panel-overlay');
    if (panel && overlay) {
        panel.classList.remove('open');
        overlay.classList.remove('open');
        document.body.style.overflow = '';
    }
}

// ============================================================================
// ACTUALIZAR BADGE (contador de no leídas)
// ============================================================================
async function actualizarBadgeNotifUsuario() {
    try {
        const res = await fetch('/api/admin/notificaciones/no-leidas');
        const data = await res.json();
        const badge = document.getElementById('notifBadgeUsuario');
        if (!badge) return;
        if (data.no_leidas > 0) {
            badge.textContent = data.no_leidas > 99 ? '99+' : data.no_leidas;
            badge.style.display = 'flex';
        } else {
            badge.style.display = 'none';
        }
    } catch (e) { /* ignora */ }
}

// ============================================================================
// CARGAR NOTIFICACIONES EN EL PANEL
// ============================================================================
async function cargarNotificacionesUsuario() {
    const body = document.getElementById('notif-panel-body');
    if (!body) return;
    body.innerHTML = '<div class="notif-loading">Cargando...</div>';

    try {
        const res = await fetch('/api/admin/notificaciones?limite=20');
        if (!res.ok) {
            body.innerHTML = '<div class="notif-empty">Error al cargar notificaciones</div>';
            return;
        }
        const data = await res.json();

        if (!data.data || data.data.length === 0) {
            body.innerHTML = `
                <div class="notif-empty">
                    <div class="notif-empty-icon">🔔</div>
                    <h4>Sin notificaciones</h4>
                    <p>No tienes notificaciones nuevas</p>
                </div>`;
            return;
        }

        const tipoIconos = { info: 'ℹ️', warning: '⚠️', success: '✅', danger: '🚨' };
        const tipoColores = { info: '#3b82f6', warning: '#f59e0b', success: '#10b981', danger: '#ef4444' };

        body.innerHTML = data.data.map(n => `
            <div class="notif-item ${n.leida ? '' : 'notif-item-no-leida'}" onclick="${n.leida ? '' : `marcarLeidaUsuario(${n.id})`}">
                <div class="notif-item-icon" style="background:${tipoColores[n.tipo] || '#6b7280'}20">
                    <span>${tipoIconos[n.tipo] || 'ℹ️'}</span>
                </div>
                <div class="notif-item-content">
                    <div class="notif-item-title">${escapeHtmlNotif(n.titulo)}</div>
                    <div class="notif-item-msg">${escapeHtmlNotif(n.mensaje)}</div>
                    <div class="notif-item-date">${formatearFechaNotif(n.created_at)}</div>
                </div>
                ${!n.leida ? '<div class="notif-item-dot"></div>' : ''}
            </div>
        `).join('');

    } catch (err) {
        console.error('Error cargando notificaciones:', err);
        body.innerHTML = '<div class="notif-empty">Error al cargar</div>';
    }
}

// ============================================================================
// MARCAR COMO LEÍDA
// ============================================================================
async function marcarLeidaUsuario(id) {
    try {
        await fetch(`/api/admin/notificaciones/${id}/leer`, { method: 'PUT' });
        actualizarBadgeNotifUsuario();
        cargarNotificacionesUsuario();
    } catch (e) { /* ignora */ }
}

// ============================================================================
// HELPERS
// ============================================================================
function escapeHtmlNotif(str) {
    if (!str) return '';
    // Preservar saltos de línea para white-space: pre-line
    return String(str).replace(/[&<>"']/g, function(c) {
        return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c] || c;
    });
}

function formatearFechaNotif(fecha) {
    if (!fecha) return '';
    try {
        const d = new Date(fecha);
        const ahora = new Date();
        const diffMs = ahora - d;
        const diffMin = Math.floor(diffMs / 60000);
        const diffHoras = Math.floor(diffMs / 3600000);
        const diffDias = Math.floor(diffMs / 86400000);

        if (diffMin < 1) return 'Ahora';
        if (diffMin < 60) return `Hace ${diffMin} min`;
        if (diffHoras < 24) return `Hace ${diffHoras}h`;
        if (diffDias < 7) return `Hace ${diffDias}d`;
        return d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' });
    } catch(e) { return fecha; }
}
