// ============================================================================
// NOTIFICACIONES 2.0 - CENTRO DE NOTIFICACIONES MODERNO
// ============================================================================
// Compartido entre escritorio y móvil.
// Características:
// - Cards con prioridades y acciones
// - SSE para actualizaciones en tiempo real
// - Animaciones de entrada
// - Marcación individual y masiva
// - Archivado
// - Toast de nueva notificación
// ============================================================================

// ============================================================================
// CONFIGURACIÓN
// ============================================================================
const NOTIF_CONFIG = {
    POLL_INTERVAL: 30000,    // 30s - fallback polling
    MAX_TOAST_DURATION: 5000, // 5s - duración del toast
    SSE_RECONNECT_DELAY: 3000, // 3s - reconexión SSE
    MAX_VISIBLE_NOTIFS: 50,   // máx notificaciones en el panel
    TIPO_ICONOS: { info: 'ℹ️', warning: '⚠️', success: '✅', danger: '🚨' },
    TIPO_COLORES: { info: '#3b82f6', warning: '#f59e0b', success: '#10b981', danger: '#ef4444' },
    PRIORIDAD_LABELS: { baja: 'Baja', normal: 'Normal', alta: 'Alta', critica: 'Crítica' },
    PRIORIDAD_ICONOS: { baja: '⬇️', normal: '➡️', alta: '⬆️', critica: '🔴' }
};

// ============================================================================
// ESTADO GLOBAL
// ============================================================================
let notifState = {
    eventSource: null,        // Conexión SSE
    isPanelOpen: false,       // ¿Panel abierto?
    reconnecting: false,      // ¿Reconectando SSE?
    toastTimeout: null,       // Timeout del toast actual
    pendingCount: 0,          // Contador actual de no leídas
    isInitialized: false,     // ¿Inicializado?
    notificationsCache: []    // Cache de notificaciones cargadas
};

// ============================================================================
// INICIALIZAR
// ============================================================================
function initNotificaciones() {
    if (notifState.isInitialized) return;
    notifState.isInitialized = true;

    // Crear el panel si no existe
    if (!document.getElementById('notif-panel')) {
        crearPanelNotificaciones();
    }

    // Cargar badge inicial
    actualizarBadgeNotifUsuario();

    // Iniciar SSE
    iniciarSSE();

    // Fallback: polling periódico si SSE falla
    setInterval(() => {
        if (!notifState.eventSource || notifState.eventSource.readyState === EventSource.CLOSED) {
            actualizarBadgeNotifUsuario();
        }
    }, NOTIF_CONFIG.POLL_INTERVAL);
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
            <h3>🔔 Notificaciones <span id="notifPanelCount" class="notif-badge-usuario" style="display:none;position:static;display:inline-flex;margin-left:8px;font-size:10px;">0</span></h3>
            <div class="notif-panel-header-actions">
                <button class="notif-btn-mark-all" id="notifBtnMarkAll" onclick="marcarTodasLeidasUsuario()" title="Marcar todas como leídas" style="display:none">
                    ✓ Marcar todas
                </button>
                <button class="notif-panel-close" onclick="cerrarPanelNotificaciones()">✕</button>
            </div>
        </div>
        <div class="notif-panel-body" id="notif-panel-body">
            <div class="notif-loading">Cargando...</div>
        </div>
        <div class="notif-connection-status" id="notifConnectionStatus">
            <span class="notif-connection-dot" id="notifConnectionDot"></span>
            <span id="notifConnectionText">Conectado</span>
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
        notifState.isPanelOpen = true;
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
        notifState.isPanelOpen = false;
        document.body.style.overflow = '';
    }
}

// ============================================================================
// SSE - SERVER-SENT EVENTS (tiempo real)
// ============================================================================
function iniciarSSE() {
    if (notifState.eventSource) {
        notifState.eventSource.close();
    }

    const url = '/api/admin/notificaciones/stream';

    try {
        const es = new EventSource(url, { withCredentials: true });
        notifState.eventSource = es;

        // Conexión establecida
        es.addEventListener('connected', function(e) {
            actualizarEstadoConexion(true);
            notifState.reconnecting = false;
            console.log('[Notificaciones] SSE conectado');
        });

        // Nueva notificación creada
        es.addEventListener('notification.created', function(e) {
            try {
                const notif = JSON.parse(e.data);
                console.log('[Notificaciones] Nueva notificación SSE:', notif.titulo);

                // Actualizar badge
                actualizarBadgeNotifUsuario();

                // Si el panel está abierto, recargar
                if (notifState.isPanelOpen && !notifState._isMarkingRead) {
                    cargarNotificacionesUsuario();
                }

                // Mostrar toast (si no estamos en el panel)
                if (!notifState.isPanelOpen) {
                    mostrarToastNotificacion(notif);
                }
            } catch (err) {
                console.error('[Notificaciones] Error parsing SSE data:', err);
            }
        });

        // Notificación leída
        es.addEventListener('notification.read', function(e) {
            actualizarBadgeNotifUsuario();
            // Solo recargar si NO estamos en medio de marcar como leída
            if (notifState.isPanelOpen && !notifState._isMarkingRead) {
                cargarNotificacionesUsuario();
            }
        });

        // Notificación archivada
        es.addEventListener('notification.archived', function(e) {
            if (notifState.isPanelOpen) {
                cargarNotificacionesUsuario();
            }
        });

        // Actualización de contador
        es.addEventListener('count.updated', function(e) {
            try {
                const data = JSON.parse(e.data);
                if (data.no_leidas !== null) {
                    actualizarBadgeConValor(data.no_leidas);
                } else {
                    actualizarBadgeNotifUsuario();
                }
            } catch (err) {
                actualizarBadgeNotifUsuario();
            }
        });

        // Ping keep-alive
        es.addEventListener('ping', function(e) {
            // No hacer nada, solo mantiene la conexión viva
        });

        // Error de conexión
        es.onerror = function(err) {
            console.warn('[Notificaciones] SSE error, reconectando...');
            actualizarEstadoConexion(false);

            if (!notifState.reconnecting) {
                notifState.reconnecting = true;
                setTimeout(function() {
                    notifState.eventSource = null;
                    iniciarSSE();
                }, NOTIF_CONFIG.SSE_RECONNECT_DELAY);
            }
        };
    } catch (err) {
        console.error('[Notificaciones] Error iniciando SSE:', err);
        actualizarEstadoConexion(false);
    }
}

function actualizarEstadoConexion(conectado) {
    const dot = document.getElementById('notifConnectionDot');
    const text = document.getElementById('notifConnectionText');
    if (dot && text) {
        dot.className = 'notif-connection-dot' + (conectado ? '' : ' disconnected');
        text.textContent = conectado ? 'En vivo' : 'Reconectando...';
    }
}

// ============================================================================
// ACTUALIZAR BADGE (contador de no leídas)
// ============================================================================
async function actualizarBadgeNotifUsuario() {
    try {
        const res = await fetch('/api/admin/notificaciones/no-leidas');
        const data = await res.json();
        actualizarBadgeConValor(data.no_leidas || 0);
    } catch (e) {
        console.warn('[Notificaciones] Error actualizando badge:', e);
    }
}

function actualizarBadgeConValor(noLeidas) {
    const badge = document.getElementById('notifBadgeUsuario');
    if (!badge) return;

    const prevCount = notifState.pendingCount;
    notifState.pendingCount = noLeidas;

    if (noLeidas > 0) {
        badge.textContent = noLeidas > 99 ? '99+' : noLeidas;
        badge.style.display = 'flex';

        // Animar si hay notificaciones nuevas
        if (noLeidas > prevCount) {
            badge.style.animation = 'none';
            badge.offsetHeight; // Reflow
            badge.style.animation = 'badgePopIn 0.3s ease';
        }
    } else {
        badge.style.display = 'none';
    }
}

// ============================================================================
// TOAST DE NUEVA NOTIFICACIÓN
// ============================================================================
function mostrarToastNotificacion(notif) {
    // Remover toast anterior
    const existing = document.querySelector('.notif-toast');
    if (existing) {
        existing.style.animation = 'notifToastOut 0.3s ease forwards';
        setTimeout(() => existing.remove(), 300);
    }

    const toast = document.createElement('div');
    toast.className = `notif-toast notif-toast-${notif.tipo || 'info'}`;
    toast.setAttribute('data-notif-id', notif.id || '');

    const tipoIcono = NOTIF_CONFIG.TIPO_ICONOS[notif.tipo] || 'ℹ️';

    toast.innerHTML = `
        <div class="notif-toast-icon">${tipoIcono}</div>
        <div class="notif-toast-content" onclick="abrirPanelNotificaciones()">
            <div class="notif-toast-title">${escapeHtmlNotif(notif.titulo)}</div>
            <div class="notif-toast-msg">${escapeHtmlNotif(notif.mensaje ? notif.mensaje.substring(0, 80) : '')}</div>
        </div>
        <button class="notif-toast-close" onclick="cerrarToast(this)">✕</button>
    `;

    document.body.appendChild(toast);

    // Auto-cerrar después de X segundos
    if (notifState.toastTimeout) clearTimeout(notifState.toastTimeout);
    notifState.toastTimeout = setTimeout(() => {
        const t = document.querySelector('.notif-toast');
        if (t) {
            t.style.animation = 'notifToastOut 0.3s ease forwards';
            setTimeout(() => t.remove(), 300);
        }
    }, NOTIF_CONFIG.MAX_TOAST_DURATION);
}

function cerrarToast(btn) {
    const toast = btn.closest('.notif-toast');
    if (toast) {
        toast.style.animation = 'notifToastOut 0.3s ease forwards';
        setTimeout(() => toast.remove(), 300);
    }
    if (notifState.toastTimeout) clearTimeout(notifState.toastTimeout);
}

// ============================================================================
// CARGAR NOTIFICACIONES EN EL PANEL
// ============================================================================
async function cargarNotificacionesUsuario() {
    const body = document.getElementById('notif-panel-body');
    if (!body) return;
    body.innerHTML = '<div class="notif-loading">Cargando...</div>';

    try {
        const res = await fetch('/api/admin/notificaciones?limite=30');
        if (!res.ok) {
            body.innerHTML = '<div class="notif-empty">Error al cargar notificaciones</div>';
            return;
        }
        const data = await res.json();

        // Cachear
        notifState.notificationsCache = data.data || [];

        // Actualizar badge del panel
        const panelCount = document.getElementById('notifPanelCount');
        if (panelCount) {
            const noLeidas = (data.data || []).filter(n => !n.leida).length;
            if (noLeidas > 0) {
                panelCount.textContent = noLeidas;
                panelCount.style.display = 'inline-flex';
            } else {
                panelCount.style.display = 'none';
            }
        }

        // Botón "Marcar todas"
        const btnMarkAll = document.getElementById('notifBtnMarkAll');
        if (btnMarkAll) {
            const hasUnread = (data.data || []).some(n => !n.leida);
            btnMarkAll.style.display = hasUnread ? 'inline-flex' : 'none';
        }

        if (!data.data || data.data.length === 0) {
            body.innerHTML = `
                <div class="notif-empty">
                    <div class="notif-empty-icon">🔔</div>
                    <h4>Sin notificaciones</h4>
                    <p>No tienes notificaciones nuevas</p>
                </div>`;
            return;
        }

        // Renderizar cards
        body.innerHTML = data.data.map((n, index) => renderizarNotificacion(n, index)).join('');

        // Animar las que llegaron nuevas (las primeras si son no leídas)
        const items = body.querySelectorAll('.notif-item');
        if (items.length > 0) {
            // Animar las no leídas al inicio
            items.forEach((item, i) => {
                if (item.dataset.leida === 'false' && i < 3) {
                    item.classList.add('notif-item-new');
                }
            });
        }

    } catch (err) {
        console.error('[Notificaciones] Error cargando:', err);
        body.innerHTML = '<div class="notif-empty">Error al cargar</div>';
    }
}

// ============================================================================
// RENDERIZAR UNA NOTIFICACIÓN (Card moderna)
// ============================================================================
function renderizarNotificacion(n, index) {
    const tipoIcono = NOTIF_CONFIG.TIPO_ICONOS[n.tipo] || 'ℹ️';
    const tipoColor = NOTIF_CONFIG.TIPO_COLORES[n.tipo] || '#6b7280';
    const prioridad = n.prioridad || 'normal';
    const prioridadLabel = NOTIF_CONFIG.PRIORIDAD_LABELS[prioridad] || 'Normal';
    const prioridadIcono = NOTIF_CONFIG.PRIORIDAD_ICONOS[prioridad] || '➡️';
    const esNoLeida = !n.leida;
    const clasePrioridad = `notif-item-prioridad-${prioridad}`;
    const claseNoLeida = esNoLeida ? 'notif-item-no-leida' : '';
    const claseNew = (esNoLeida && index < 3) ? 'notif-item-new' : '';
    const claseTipo = `notif-tipo-badge-${n.tipo || 'info'}`;

    // Fecha formateada
    const fechaHTML = formatearFechaNotif(n.created_at);

    // ¿Tiene acción? - Botón de acción rápida
    const accionHTML = (n.accion_url && n.accion_texto) ? `
        <button class="notif-item-action-btn"
           data-notif-action-url="${escapeHtmlNotif(n.accion_url)}"
           onclick="event.stopPropagation(); marcarLeidaUsuario(${n.id}, this.dataset.notifActionUrl);">
            ${escapeHtmlNotif(n.accion_texto)} →
        </button>
    ` : '';

    // ¿Está expirada?
    const claseExpirada = (n.fecha_expiracion && new Date(n.fecha_expiracion) < new Date()) ? 'notif-item-expirada' : '';

    const dataAccionUrl = n.accion_url ? ` data-accion-url="${escapeHtmlNotif(n.accion_url)}"` : '';
    const cardOnClick = `marcarLeidaUsuario(${n.id}${n.accion_url ? `, this.dataset.accionUrl` : ''})`;

    return `
        <div class="notif-item ${claseNoLeida} ${clasePrioridad} ${claseNew} ${claseExpirada}"
             data-id="${n.id}"
             data-leida="${n.leida ? 'true' : 'false'}"
             ${dataAccionUrl}
             onclick="${cardOnClick}">
            <div class="notif-item-icon-wrapper" style="background:${tipoColor}20">
                <span>${tipoIcono}</span>
                <span class="notif-priority-badge notif-priority-${prioridad}" title="Prioridad: ${prioridadLabel}">
                    ${prioridad === 'critica' ? '!!' : prioridad === 'alta' ? '!' : ''}
                </span>
            </div>
            <div class="notif-item-content">
                <div class="notif-item-header">
                    <div class="notif-item-title">${escapeHtmlNotif(n.titulo)}</div>
                    <span class="notif-item-tipo-badge ${claseTipo}">${tipoIcono} ${n.tipo || 'info'}</span>
                </div>
                <div class="notif-item-msg">${escapeHtmlNotif(n.mensaje)}</div>
                <div class="notif-item-footer">
                    <div class="notif-item-date">
                        <i>🕐</i> ${fechaHTML}
                        ${n.fecha_expiracion ? `<span style="margin-left:8px;color:#dc2626">⏰ Exp: ${formatearFechaNotif(n.fecha_expiracion)}</span>` : ''}
                    </div>
                    <div style="display:flex;align-items:center;gap:4px">
                        ${accionHTML}
                        <button class="notif-item-archive-btn" onclick="event.stopPropagation(); archivarNotificacion(${n.id})" title="Archivar">
                            📦
                        </button>
                    </div>
                </div>
            </div>
            ${esNoLeida ? '<div class="notif-item-dot"></div>' : ''}
        </div>
    `;
}

// ============================================================================
// MARCAR COMO LEÍDA (individual) - con navegación a acción si existe
// ============================================================================
async function marcarLeidaUsuario(id, accionUrl) {
    // Flag para evitar doble recarga por SSE
    notifState._isMarkingRead = true;

    try {
        await fetch(`/api/admin/notificaciones/${id}/leer`, { method: 'PUT' });
    } catch (e) {
        console.warn('[Notificaciones] Error marcando leída:', e);
    }

    // Actualizar visualmente sin recargar todo
    const item = document.querySelector(`.notif-item[data-id="${id}"]`);
    if (item) {
        item.classList.remove('notif-item-no-leida', 'notif-item-new');
        item.dataset.leida = 'true';
        const dot = item.querySelector('.notif-item-dot');
        if (dot) dot.remove();
    }

    actualizarBadgeNotifUsuario();
    actualizarContadorPanel();

    // Liberar flag después de un breve momento
    setTimeout(() => { notifState._isMarkingRead = false; }, 300);

    // Si hay URL de acción, cerrar panel y navegar
    if (accionUrl) {
        cerrarPanelNotificaciones();
        setTimeout(() => {
            window.location.href = accionUrl;
        }, 350); // Esperar que cierre la animación del panel
        return;
    }

    // Recargar suavemente (solo si no hay SSE que ya lo haga)
    if (notifState.isPanelOpen) {
        // Pequeña actualización local sin recarga completa
        setTimeout(() => {
            if (!notifState._isMarkingRead) {
                cargarNotificacionesUsuario();
            }
        }, 600);
    }
}

// ============================================================================
// MARCAR TODAS COMO LEÍDAS
// ============================================================================
async function marcarTodasLeidasUsuario() {
    try {
        const res = await fetch('/api/admin/notificaciones/marcar-todas-leidas', { method: 'PUT' });
        if (res.ok) {
            // Actualizar visualmente
            const items = document.querySelectorAll('.notif-item[data-leida="false"]');
            items.forEach(item => {
                item.classList.remove('notif-item-no-leida', 'notif-item-new');
                item.dataset.leida = 'true';
                const dot = item.querySelector('.notif-item-dot');
                if (dot) dot.remove();
            });

            actualizarBadgeNotifUsuario();

            // Ocultar botón
            const btn = document.getElementById('notifBtnMarkAll');
            if (btn) btn.style.display = 'none';

            // Ocultar contador del panel
            const panelCount = document.getElementById('notifPanelCount');
            if (panelCount) panelCount.style.display = 'none';

            mostrarToastSimple('✅ Todas marcadas como leídas');
        }
    } catch (e) {
        console.error('[Notificaciones] Error marcar todas:', e);
    }
}

// ============================================================================
// ARCHIVAR NOTIFICACIÓN
// ============================================================================
async function archivarNotificacion(id) {
    try {
        const res = await fetch(`/api/admin/notificaciones/${id}/archivar`, { method: 'PUT' });
        if (res.ok) {
            // Animar salida
            const item = document.querySelector(`.notif-item[data-id="${id}"]`);
            if (item) {
                item.style.transition = 'all 0.3s ease';
                item.style.opacity = '0';
                item.style.transform = 'translateX(30px)';
                item.style.maxHeight = '0';
                item.style.padding = '0';
                setTimeout(() => item.remove(), 300);
            }

            actualizarBadgeNotifUsuario();
            actualizarContadorPanel();

            // Mostrar estado vacío si no hay más
            setTimeout(() => {
                const body = document.getElementById('notif-panel-body');
                if (body && body.querySelectorAll('.notif-item').length === 0) {
                    cargarNotificacionesUsuario();
                }
            }, 400);

            mostrarToastSimple('📦 Notificación archivada');
        }
    } catch (e) {
        console.error('[Notificaciones] Error archivar:', e);
    }
}

// ============================================================================
// ACTUALIZAR CONTADOR DEL PANEL
// ============================================================================
function actualizarContadorPanel() {
    const items = document.querySelectorAll('.notif-item[data-leida="false"]');
    const panelCount = document.getElementById('notifPanelCount');
    if (panelCount) {
        if (items.length > 0) {
            panelCount.textContent = items.length;
            panelCount.style.display = 'inline-flex';
        } else {
            panelCount.style.display = 'none';
        }
    }
    const btn = document.getElementById('notifBtnMarkAll');
    if (btn) {
        btn.style.display = items.length > 0 ? 'inline-flex' : 'none';
    }
}

// ============================================================================
// TOAST SIMPLE (mensaje informativo)
// ============================================================================
function mostrarToastSimple(mensaje) {
    const toast = document.createElement('div');
    toast.className = 'admin-toast';
    toast.textContent = mensaje;
    toast.style.cssText = `
        position: fixed; bottom: 24px; right: 24px;
        padding: 14px 24px; border-radius: 10px;
        background: #1f2937; color: white;
        font-weight: 600; font-size: 14px;
        box-shadow: 0 4px 20px rgba(0,0,0,0.4);
        z-index: 10001;
        animation: notifToastIn 0.3s ease;
        max-width: 360px;
    `;

    document.body.appendChild(toast);
    setTimeout(() => {
        toast.style.animation = 'notifToastOut 0.3s ease forwards';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// ============================================================================
// HELPERS
// ============================================================================
function escapeHtmlNotif(str) {
    if (!str) return '';
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
        return d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
    } catch(e) { return fecha; }
}
