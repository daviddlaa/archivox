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
    // Backoff exponencial: 5s → 10s → 20s → 40s → 60s (máx)
    // Evita quemar el cupo del rate limiter con reconexiones cada 3s.
    SSE_RECONNECT_DELAY: 5000,
    SSE_RECONNECT_MAX_DELAY: 60000,
    SSE_RECONNECT_FACTOR: 2,
    SSE_HIDDEN_POLL_DELAY: 5000, // chequear visibilidad al reconectar en segundo plano
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
    reconnectAttempts: 0,     // Intentos seguidos (para backoff exponencial)
    toastTimeout: null,       // Timeout del toast actual
    pendingCount: 0,          // Contador actual de no leídas
    isInitialized: false,     // ¿Inicializado?
    notificationsCache: [],   // Cache de notificaciones cargadas
    tabActivo: 'activas',     // Pestaña del panel: 'activas' | 'archivadas'
    esAdmin: null             // ¿Usuario admin? (se resuelve una vez vía /api/auth/sesion)
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
        <div class="notif-panel-tabs">
            <button class="notif-panel-tab active" data-tab="activas" onclick="cambiarTabNotificaciones('activas')">🔔 Activas</button>
            <button class="notif-panel-tab" data-tab="archivadas" onclick="cambiarTabNotificaciones('archivadas')">📦 Archivadas</button>
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
function abrirPanelNotificacionesWidget() {
    const panel = document.getElementById('notif-panel');
    const overlay = document.getElementById('notif-panel-overlay');
    if (panel && overlay) {
        panel.classList.add('open');
        overlay.classList.add('open');
        notifState.isPanelOpen = true;
        notifState._isMarkingRead = false;
        // Cargar el contenido cada vez que se abre el panel
        cambiarTabNotificaciones('activas', true);
        document.body.style.overflow = 'hidden';
    }
}

// ============================================================================
// CAMBIAR PESTAÑA DEL PANEL (Activas / Archivadas)
// ============================================================================
function cambiarTabNotificaciones(tab, recargar = true) {
    notifState.tabActivo = tab;
    const tabs = document.querySelectorAll('.notif-panel-tab');
    tabs.forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
    if (recargar) {
        cargarNotificacionesUsuario();
    } else {
        const body = document.getElementById('notif-panel-body');
        if (body) body.innerHTML = '<div class="notif-loading">Cargando...</div>';
    }
}

// Resolver (una sola vez) si el usuario es admin/superadmin, para mostrar
// acciones reservadas como eliminar definitivamente.
function esUsuarioAdmin() {
    return new Promise((resolve) => {
        if (notifState.esAdmin !== null) return resolve(notifState.esAdmin);
        fetch('/api/auth/sesion')
            .then(r => r.json())
            .then(data => {
                const u = data && data.autenticado ? data.usuario : null;
                notifState.esAdmin = !!(u && (u.is_superadmin || u.rol === 'superadmin'));
                resolve(notifState.esAdmin);
            })
            .catch(() => { notifState.esAdmin = false; resolve(false); });
    });
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
            notifState.reconnectAttempts = 0; // Reconexión exitosa → resetear backoff
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
            // Ignorar eventos generados por la propia acción (dedupe)
            if (notifState._isMarkingRead) return;
            actualizarBadgeNotifUsuario();
            if (notifState.isPanelOpen) {
                cargarNotificacionesUsuario();
            }
        });

        // Notificación archivada (incluye leer+archivar)
        es.addEventListener('notification.archived', function(e) {
            if (notifState._isMarkingRead) return;
            actualizarBadgeNotifUsuario();
            if (notifState.isPanelOpen) {
                cargarNotificacionesUsuario();
            }
        });

        // Actualización de contador
        es.addEventListener('count.updated', function(e) {
            if (notifState._isMarkingRead) return; // Evitar duplicación con la propia acción
            try {
                const data = JSON.parse(e.data);
                if (data.no_leidas !== null) {
                    actualizarBadgeConValor(data.no_leidas);
                } else {
                    actualizarBadgeNotifUsuario();
                }
            } catch (err) {
                if (!notifState._isMarkingRead) actualizarBadgeNotifUsuario();
            }
        });

        // Campañas creadas/renombradas/eliminadas → refresco en vivo de la grid
        // (desktop y móvil comparten este script; cada uno define cargarListaCampanas)
        es.addEventListener('campanas.updated', function(e) {
            try {
                const data = JSON.parse(e.data);
                console.log('[Notificaciones] campanas.updated:', data.accion || '?', data.id);

                // Si la campaña abierta (detalle) fue eliminada, salir a la landing
                if (data.accion === 'eliminada' && typeof window.gestionId !== 'undefined' && window.gestionId !== null && String(window.gestionId) === String(data.id)) {
                    const base = window.location.pathname.indexOf('/m/') === 0 ? '/m/gestion-lote' : '/gestion-lote';
                    window.location.href = base;
                    return;
                }

                // Refrescar la grid en vivo (debounce: coalescer ráfagas de eventos)
                if (typeof cargarListaCampanas === 'function') {
                    if (notifState._campanasRefreshTimer) return;
                    notifState._campanasRefreshTimer = setTimeout(function() {
                        notifState._campanasRefreshTimer = null;
                        cargarListaCampanas();
                    }, 150);
                }
            } catch (err) {
                console.error('[Notificaciones] Error parsing campanas.updated:', err);
            }
        });

        // Ping keep-alive
        es.addEventListener('ping', function(e) {
            // No hacer nada, solo mantiene la conexión viva
        });

        // Error de conexión — reconexión con BACKOFF EXPONENCIAL
        // Antes: reintento cada 3s fijo → quemaba el cupo del rate limiter.
        // Ahora: 5s, 10s, 20s, 40s, 60s (máx) y pausa si la pestaña está oculta.
        es.onerror = function(err) {
            console.warn('[Notificaciones] SSE error, programando reconexión...');
            actualizarEstadoConexion(false);

            if (notifState.reconnecting) return;
            notifState.reconnecting = true;

            const delay = Math.min(
                NOTIF_CONFIG.SSE_RECONNECT_DELAY * Math.pow(NOTIF_CONFIG.SSE_RECONNECT_FACTOR, notifState.reconnectAttempts),
                NOTIF_CONFIG.SSE_RECONNECT_MAX_DELAY
            );
            notifState.reconnectAttempts++;

            const reconectar = function() {
                notifState.reconnecting = false;
                notifState.eventSource = null;
                iniciarSSE();
            };

            // Si la pestaña está oculta (usuario en otra app/pestaña), no reconectar
            // de inmediato: esperar a que vuelva a estar visible para no generar
            // tráfico inútil ni quemar el límite del servidor.
            const esperarVisibleYReconectar = function() {
                if (document.hidden) {
                    setTimeout(esperarVisibleYReconectar, NOTIF_CONFIG.SSE_HIDDEN_POLL_DELAY);
                    return;
                }
                reconectar();
            };

            if (document.hidden) {
                setTimeout(esperarVisibleYReconectar, NOTIF_CONFIG.SSE_HIDDEN_POLL_DELAY);
            } else {
                setTimeout(reconectar, delay);
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
    const esNovedad = Number(notif.es_novedad) === 1;
    toast.className = `notif-toast notif-toast-${notif.tipo || 'info'}${esNovedad ? ' notif-toast-novedad' : ''}`;
    toast.setAttribute('data-notif-id', notif.id || '');

    const tipoIcono = esNovedad ? '✨' : (NOTIF_CONFIG.TIPO_ICONOS[notif.tipo] || 'ℹ️');

    toast.innerHTML = `
        <div class="notif-toast-icon">${tipoIcono}</div>
        <div class="notif-toast-content" onclick="abrirPanelNotificacionesWidget()">
            <div class="notif-toast-title">${escapeHtmlNotif(notif.titulo)} ${esNovedad ? '<span class="notif-nuevo-badge">🆕 NUEVO</span>' : ''}</div>
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
        const esArchivadas = notifState.tabActivo === 'archivadas';
        const url = esArchivadas
            ? '/api/admin/notificaciones?archivada=1&limite=50'
            : '/api/admin/notificaciones?limite=50';
        const res = await fetch(url);
        if (!res.ok) {
            body.innerHTML = '<div class="notif-empty">Error al cargar notificaciones</div>';
            return;
        }
        const data = await res.json();

        // Cachear
        notifState.notificationsCache = data.data || [];

        // Actualizar badge del panel (solo en pestaña Activas)
        const panelCount = document.getElementById('notifPanelCount');
        if (panelCount) {
            if (esArchivadas) {
                panelCount.style.display = 'none';
            } else {
                const noLeidas = (data.data || []).filter(n => !n.leida).length;
                if (noLeidas > 0) {
                    panelCount.textContent = noLeidas;
                    panelCount.style.display = 'inline-flex';
                } else {
                    panelCount.style.display = 'none';
                }
            }
        }

        // Botón "Marcar todas" (solo en pestaña Activas)
        const btnMarkAll = document.getElementById('notifBtnMarkAll');
        if (btnMarkAll) {
            const hasUnread = !esArchivadas && (data.data || []).some(n => !n.leida);
            btnMarkAll.style.display = hasUnread ? 'inline-flex' : 'none';
        }

        if (!data.data || data.data.length === 0) {
            body.innerHTML = `
                <div class="notif-empty">
                    <div class="notif-empty-icon">${esArchivadas ? '📦' : '🔔'}</div>
                    <h4>${esArchivadas ? 'Sin notificaciones archivadas' : 'Sin notificaciones'}</h4>
                    <p>${esArchivadas ? 'Aquí verás las que archives o las novedades ya leídas' : 'No tienes notificaciones nuevas'}</p>
                </div>`;
            return;
        }

        // Pestaña Archivadas: lista plana con Restaurar / Eliminar
        if (esArchivadas) {
            const esAdmin = await esUsuarioAdmin();
            body.innerHTML = data.data.map(n => renderizarNotificacionArchivada(n, esAdmin)).join('');
            return;
        }

        // ================================================================
        // 🆕 SEPARAR NOVEDADES (anuncios de funcionalidades) del resto
        // Las novedades se muestran en una sección destacada al inicio.
        // Las ya leídas se archivan automáticamente en el backend, así que
        // aquí solo se muestran las no leídas.
        // ================================================================
        const novedades = (data.data || []).filter(n => Number(n.es_novedad) === 1 && !n.leida);
        const normales = (data.data || []).filter(n => Number(n.es_novedad) !== 1);

        let html = '';

        // Sección destacada de Novedades
        if (novedades.length > 0) {
            const noLeidasNovedades = novedades.filter(n => !n.leida).length;
            html += `
                <div class="notif-novedades-header">
                    <div class="notif-novedades-header-title">✨ Novedades</div>
                    <div class="notif-novedades-header-sub">Nuevas funcionalidades de Archivox</div>
                    ${noLeidasNovedades > 0 ? `<span class="notif-novedades-count">${noLeidasNovedades} nueva${noLeidasNovedades > 1 ? 's' : ''}</span>` : ''}
                </div>
                <div class="notif-novedades-list">
                    ${novedades.map((n, i) => renderizarNotificacion(n, i, true)).join('')}
                </div>
            `;
        }

        // Notificaciones normales
        if (normales.length > 0) {
            if (novedades.length > 0) {
                html += `<div class="notif-divider">📌 Notificaciones</div>`;
            }
            html += normales.map((n, i) => renderizarNotificacion(n, i, false)).join('');
        }

        if (!html) {
            html = `
                <div class="notif-empty">
                    <div class="notif-empty-icon">🔔</div>
                    <h4>Sin notificaciones</h4>
                    <p>No tienes notificaciones nuevas</p>
                </div>`;
        }

        body.innerHTML = html;

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
function renderizarNotificacion(n, index, esNovedad) {
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
    // 🆕 Novedades: clase especial + badge "NUEVO"
    const esNovedadBool = esNovedad || Number(n.es_novedad) === 1;
    const claseNovedad = esNovedadBool ? 'notif-item-novedad' : '';
    const badgeNovedad = esNovedadBool ? '<span class="notif-nuevo-badge">🆕 NUEVO</span>' : '';

    // Fecha formateada
    const fechaHTML = formatearFechaNotif(n.created_at);

    // ¿Tiene acción? - Botón de acción rápida (navega; la card click solo consume)
    // 🆕 Deep Link Router: si tiene accion_modulo, usarlo; si no, usar accion_url (legacy)
    const tieneAccion = (n.accion_modulo || n.accion_url) && n.accion_texto;
    const accionHTML = tieneAccion ? `
        <button class="notif-item-action-btn"
           data-notif-action-url="${escapeHtmlNotif(n.accion_url || '')}"
           ${n.accion_modulo ? `data-notif-accion-modulo="${escapeHtmlNotif(n.accion_modulo)}"` : ''}
           onclick="event.stopPropagation(); abrirNotificacionAccion(${n.id}, this.dataset.notifActionUrl, this.dataset.notifAccionModulo);">
            ${escapeHtmlNotif(n.accion_texto)} →
        </button>
    ` : '';

    // ¿Está expirada?
    const claseExpirada = (n.fecha_expiracion && new Date(n.fecha_expiracion) < new Date()) ? 'notif-item-expirada' : '';

    // ⏰ RECORDATORIOS: si la notificación está vinculada a un recordatorio
    // (recordatorio_id), se muestran acciones directas sin salir del menú:
    // Hecho / Posponer / Eliminar. Tras cada acción la notificación se archiva.
    const esRecordatorio = n.recordatorio_id != null;
    let recordatorioHTML = '';
    if (esRecordatorio) {
        const campanaId = extraerCampanaId(n.accion_url);
        recordatorioHTML = `
            <div class="notif-recordatorio-acciones">
                <button class="notif-recordatorio-btn hecho" onclick="event.stopPropagation(); marcarRecordatorioHecho(${n.id}, ${n.recordatorio_id}, ${campanaId})" title="Marcar como hecho">✅ Hecho</button>
                <button class="notif-recordatorio-btn posponer" onclick="event.stopPropagation(); abrirModalPosponer(${n.id}, ${n.recordatorio_id}, ${campanaId})" title="Reprogramar para otra fecha">⏰ Posponer</button>
                <button class="notif-recordatorio-btn eliminar" onclick="event.stopPropagation(); cancelarRecordatorioNotificacion(${n.id}, ${n.recordatorio_id}, ${campanaId})" title="Cancelar el recordatorio">❌ Eliminar</button>
            </div>
        `;
    }

    const cardOnClick = `consumirNotificacion(${n.id})`;

    return `
        <div class="notif-item ${claseNoLeida} ${clasePrioridad} ${claseNew} ${claseExpirada} ${claseNovedad}"
             data-id="${n.id}"
             data-leida="${n.leida ? 'true' : 'false'}"
             onclick="${cardOnClick}">
            <div class="notif-item-icon-wrapper" style="background:${tipoColor}20">
                <span>${tipoIcono}</span>
                <span class="notif-priority-badge notif-priority-${prioridad}" title="Prioridad: ${prioridadLabel}">
                    ${prioridad === 'critica' ? '!!' : prioridad === 'alta' ? '!' : ''}
                </span>
            </div>
            <div class="notif-item-content">
                <div class="notif-item-header">
                    <div class="notif-item-title">${escapeHtmlNotif(n.titulo)} ${badgeNovedad}</div>
                    <span class="notif-item-tipo-badge ${claseTipo}">${tipoIcono} ${n.tipo || 'info'}</span>
                </div>
                <div class="notif-item-msg">${escapeHtmlNotif(n.mensaje)}</div>
                ${recordatorioHTML}
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
// RENDERIZAR NOTIFICACIÓN ARCHIVADA (pestaña 📦 Archivadas)
// ============================================================================
function renderizarNotificacionArchivada(n, esAdmin) {
    const tipoIcono = NOTIF_CONFIG.TIPO_ICONOS[n.tipo] || 'ℹ️';
    const tipoColor = NOTIF_CONFIG.TIPO_COLORES[n.tipo] || '#6b7280';
    const claseTipo = `notif-tipo-badge-${n.tipo || 'info'}`;
    const fechaHTML = formatearFechaNotif(n.created_at);
    const esRecordatorio = n.recordatorio_id != null;

    // Botón "Abrir →": navega al destino (ya leído y archivado)
    const tieneAccion = (n.accion_modulo || n.accion_url) && n.accion_texto;
    const accionHTML = tieneAccion ? `
        <button class="notif-item-action-btn"
           data-notif-action-url="${escapeHtmlNotif(n.accion_url || '')}"
           ${n.accion_modulo ? `data-notif-accion-modulo="${escapeHtmlNotif(n.accion_modulo)}"` : ''}
           onclick="abrirNotificacionAccion(${n.id}, this.dataset.notifActionUrl, this.dataset.notifAccionModulo)">
            ${escapeHtmlNotif(n.accion_texto)} →
        </button>
    ` : '';

    // Acciones de recordatorio: siguen disponibles aunque la notificación esté
    // archivada (para no perder un recordatorio pendiente al consumir la card)
    let recordatorioHTML = '';
    if (esRecordatorio) {
        const campanaId = extraerCampanaId(n.accion_url);
        recordatorioHTML = `
            <div class="notif-recordatorio-acciones">
                <button class="notif-recordatorio-btn hecho" onclick="marcarRecordatorioHecho(${n.id}, ${n.recordatorio_id}, ${campanaId})" title="Marcar como hecho">✅ Hecho</button>
                <button class="notif-recordatorio-btn posponer" onclick="abrirModalPosponer(${n.id}, ${n.recordatorio_id}, ${campanaId})" title="Reprogramar para otra fecha">⏰ Posponer</button>
                <button class="notif-recordatorio-btn eliminar" onclick="cancelarRecordatorioNotificacion(${n.id}, ${n.recordatorio_id}, ${campanaId})" title="Cancelar el recordatorio">❌ Eliminar</button>
            </div>
        `;
    }

    return `
        <div class="notif-item notif-item-archivada" data-id="${n.id}">
            <div class="notif-item-icon-wrapper" style="background:${tipoColor}20">
                <span>${esRecordatorio ? '⏰' : tipoIcono}</span>
            </div>
            <div class="notif-item-content">
                <div class="notif-item-header">
                    <div class="notif-item-title">${escapeHtmlNotif(n.titulo)}</div>
                    <span class="notif-item-tipo-badge ${claseTipo}">${tipoIcono} ${n.tipo || 'info'}</span>
                </div>
                <div class="notif-item-msg">${escapeHtmlNotif(n.mensaje)}</div>
                ${recordatorioHTML}
                <div class="notif-item-footer">
                    <div class="notif-item-date"><i>🕐</i> ${fechaHTML}</div>
                    <div style="display:flex;align-items:center;gap:4px;flex-wrap:wrap;justify-content:flex-end">
                        ${accionHTML}
                        <button class="notif-item-action-btn" onclick="restaurarNotificacion(${n.id})" title="Restaurar a Activas">
                            ↩ Restaurar
                        </button>
                        ${esAdmin ? `
                        <button class="notif-recordatorio-btn eliminar" onclick="eliminarNotificacion(${n.id})" title="Eliminar definitivamente">
                            🗑 Eliminar
                        </button>` : ''}
                    </div>
                </div>
            </div>
        </div>
    `;
}

// Extraer el id de campaña desde una accion_url tipo "/gestion-lote?id=54"
function extraerCampanaId(accionUrl) {
    if (!accionUrl) return null;
    const m = String(accionUrl).match(/[?&]id=(\d+)/);
    return m ? parseInt(m[1], 10) : null;
}

// ============================================================================
// CONSUMIR NOTIFICACIÓN (click en la card): leer + archivar, SIN navegar
// ============================================================================
// El enlace al destino queda disponible en el botón de acción "→" de la card.
// ============================================================================
async function consumirNotificacion(id) {
    if (notifState._isMarkingRead) return;
    notifState._isMarkingRead = true;

    try {
        await fetch(`/api/admin/notificaciones/${id}/leer?archivar=1`, { method: 'PUT' });
    } catch (e) {
        console.warn('[Notificaciones] Error consumiendo notificación:', e);
    }

    // Animar salida de la card
    const item = document.querySelector(`.notif-item[data-id="${id}"]`);
    if (item) {
        item.style.transition = 'all 0.3s ease';
        item.style.opacity = '0';
        item.style.transform = 'translateX(30px)';
        item.style.maxHeight = '0';
        item.style.padding = '0';
        setTimeout(() => item.remove(), 300);
    }

    await actualizarBadgeNotifUsuario();
    actualizarContadorPanel();

    // Si no quedan items en la pestaña, recargar para mostrar el estado vacío
    setTimeout(() => {
        const body = document.getElementById('notif-panel-body');
        if (notifState.isPanelOpen && body && body.querySelectorAll('.notif-item').length === 0) {
            cargarNotificacionesUsuario();
        }
    }, 400);

    setTimeout(() => { notifState._isMarkingRead = false; }, 600);
}

// ============================================================================
// ABRIR ACCIÓN (botón "→"): leer + archivar + navegar vía DeepLinkRouter
// ============================================================================
async function abrirNotificacionAccion(id, accionUrl, accionModulo) {
    notifState._isMarkingRead = true;

    try {
        await fetch(`/api/admin/notificaciones/${id}/leer?archivar=1`, { method: 'PUT' });
    } catch (e) {
        console.warn('[Notificaciones] Error marcando leída al navegar:', e);
    }

    await actualizarBadgeNotifUsuario();

    // ====================================================================
    // 🆕 RESOLVER URL DE NAVEGACIÓN USANDO DEEP LINK ROUTER
    // ====================================================================
    var urlNavegacion = null;

    // 1. Si tenemos accion_modulo, usar DeepLinkRouter para resolver según plataforma
    if (accionModulo && typeof DeepLinkRouter !== 'undefined') {
        urlNavegacion = DeepLinkRouter.resolver(accionModulo);
    }

    // 2. Si no se pudo resolver por módulo, usar accion_url legacy
    //    Pero verificar que no sea de la plataforma incorrecta
    if (!urlNavegacion && accionUrl) {
        if (typeof DeepLinkRouter !== 'undefined') {
            // Intentar corregir URL legacy si es de plataforma incorrecta
            urlNavegacion = DeepLinkRouter.corregirUrl(accionUrl);
        } else {
            urlNavegacion = accionUrl;
        }
    }

    // 3. Navegar si hay URL resuelta
    if (urlNavegacion) {
        cerrarPanelNotificaciones();
        setTimeout(() => {
            window.location.href = urlNavegacion;
        }, 400); // Esperar que cierre la animación del panel
        setTimeout(() => { notifState._isMarkingRead = false; }, 800);
        return;
    }

    setTimeout(() => { notifState._isMarkingRead = false; }, 500);
    if (notifState.isPanelOpen) cargarNotificacionesUsuario();
}

// ============================================================================
// MARCAR TODAS COMO LEÍDAS
// ============================================================================
async function marcarTodasLeidasUsuario() {
    try {
        const res = await fetch('/api/admin/notificaciones/marcar-todas-leidas', { method: 'PUT' });
        if (res.ok) {
            // Ocultar botón y contador del panel
            const btn = document.getElementById('notifBtnMarkAll');
            if (btn) btn.style.display = 'none';
            const panelCount = document.getElementById('notifPanelCount');
            if (panelCount) panelCount.style.display = 'none';

            await actualizarBadgeNotifUsuario();
            mostrarToastSimple('✅ Todas marcadas como leídas y archivadas');

            // Recargar la pestaña (todo lo activo desaparece de Activas)
            if (notifState.isPanelOpen) {
                setTimeout(() => cargarNotificacionesUsuario(), 350);
            }
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
// ACCIONES DE RECORDATORIO DESDE EL PANEL
// ============================================================================
// Tras cada acción (Hecho/Posponer/Eliminar) la notificación se archiva
// automáticamente y el panel se refresca.

async function archivarYRefrescar(notifId, mensaje) {
    try {
        await fetch(`/api/admin/notificaciones/${notifId}/archivar`, { method: 'PUT' });
    } catch (e) {
        console.warn('[Notificaciones] Error archivando tras acción:', e);
    }
    const item = document.querySelector(`.notif-item[data-id="${notifId}"]`);
    if (item) {
        item.style.transition = 'all 0.3s ease';
        item.style.opacity = '0';
        item.style.transform = 'translateX(30px)';
        item.style.maxHeight = '0';
        item.style.padding = '0';
        setTimeout(() => item.remove(), 300);
    }
    await actualizarBadgeNotifUsuario();
    actualizarContadorPanel();
    setTimeout(() => {
        const body = document.getElementById('notif-panel-body');
        if (body) cargarNotificacionesUsuario();
    }, 400);
    if (mensaje) mostrarToastSimple(mensaje);
}

async function marcarRecordatorioHecho(notifId, rid, campanaId) {
    if (campanaId) {
        try {
            const res = await fetch(`/api/gestiones-maestro/${campanaId}/recordatorios/${rid}/estado`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ estado: 'hecho' })
            });
            if (!res.ok) throw new Error('Respuesta no OK');
        } catch (e) {
            console.error('[Notificaciones] Error recordatorio hecho:', e);
            mostrarToastSimple('❌ No se pudo marcar como hecho');
            return;
        }
    }
    archivarYRefrescar(notifId, '✅ Recordatorio marcado como hecho');
}

async function cancelarRecordatorioNotificacion(notifId, rid, campanaId) {
    if (!confirm('¿Cancelar este recordatorio?')) return;
    if (campanaId) {
        try {
            const res = await fetch(`/api/gestiones-maestro/${campanaId}/recordatorios/${rid}/estado`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ estado: 'cancelado' })
            });
            if (!res.ok) throw new Error('Respuesta no OK');
        } catch (e) {
            console.error('[Notificaciones] Error cancelar recordatorio:', e);
            mostrarToastSimple('❌ No se pudo cancelar el recordatorio');
            return;
        }
    }
    archivarYRefrescar(notifId, '❌ Recordatorio cancelado');
}

function abrirModalPosponer(notifId, rid, campanaId) {
    if (!campanaId) {
        mostrarToastSimple('No se pudo reprogramar: falta la campaña');
        return;
    }

    const localToInput = (d) => {
        const pad = x => String(x).padStart(2, '0');
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    };

    const overlay = document.createElement('div');
    overlay.className = 'notif-posponer-overlay';
    overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };

    const modal = document.createElement('div');
    modal.className = 'notif-posponer-modal';
    modal.innerHTML = `
        <h4>⏰ Posponer recordatorio</h4>
        <p class="notif-posponer-sub">¿Cuándo quieres que te avise de nuevo?</p>
        <div class="notif-posponer-presets">
            <button type="button" data-min="30">+30 min</button>
            <button type="button" data-min="60">+1 hora</button>
            <button type="button" data-min="1440">+1 día</button>
        </div>
        <label class="notif-posponer-label">Fecha y hora personalizada</label>
        <input type="datetime-local" id="notifPosponerInput" value="${localToInput(new Date(Date.now() + 30 * 60000))}">
        <div class="notif-posponer-actions">
            <button type="button" class="notif-posponer-cancel">Cancelar</button>
            <button type="button" class="notif-posponer-ok">Guardar</button>
        </div>
    `;
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    const input = modal.querySelector('#notifPosponerInput');
    modal.querySelectorAll('.notif-posponer-presets button').forEach(btn => {
        btn.onclick = () => {
            const d = new Date(Date.now() + parseInt(btn.dataset.min, 10) * 60000);
            input.value = localToInput(d);
        };
    });
    modal.querySelector('.notif-posponer-cancel').onclick = () => overlay.remove();
    modal.querySelector('.notif-posponer-ok').onclick = async () => {
        const val = input.value;
        if (!val) { mostrarToastSimple('Elige una fecha y hora'); return; }
        overlay.remove();
        try {
            const res = await fetch(`/api/gestiones-maestro/${campanaId}/recordatorios/${rid}/posponer`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ fecha_recordatorio: val.replace('T', ' ') + ':00' })
            });
            if (!res.ok) throw new Error('Respuesta no OK');
        } catch (e) {
            console.error('[Notificaciones] Error posponer:', e);
            mostrarToastSimple('❌ No se pudo posponer');
            return;
        }
        archivarYRefrescar(notifId, '⏰ Recordatorio reprogramado');
    };
}

// ============================================================================
// RESTAURAR / ELIMINAR (pestaña 📦 Archivadas)
// ============================================================================
async function restaurarNotificacion(id) {
    try {
        const res = await fetch(`/api/admin/notificaciones/${id}/restaurar`, { method: 'PUT' });
        if (res.ok) {
            const item = document.querySelector(`.notif-item-archivada[data-id="${id}"]`);
            if (item) item.remove();
            setTimeout(() => {
                const body = document.getElementById('notif-panel-body');
                if (body && body.querySelectorAll('.notif-item').length === 0) cargarNotificacionesUsuario();
            }, 300);
            mostrarToastSimple('↩ Notificación restaurada');
        }
    } catch (e) {
        console.error('[Notificaciones] Error restaurar:', e);
    }
}

async function eliminarNotificacion(id) {
    if (!confirm('¿Eliminar esta notificación definitivamente?')) return;
    try {
        const res = await fetch(`/api/admin/notificaciones/${id}`, { method: 'DELETE' });
        if (res.ok) {
            const item = document.querySelector(`.notif-item-archivada[data-id="${id}"]`);
            if (item) item.remove();
            setTimeout(() => {
                const body = document.getElementById('notif-panel-body');
                if (body && body.querySelectorAll('.notif-item').length === 0) cargarNotificacionesUsuario();
            }, 300);
            mostrarToastSimple('🗑 Notificación eliminada');
        }
    } catch (e) {
        console.error('[Notificaciones] Error eliminar:', e);
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
