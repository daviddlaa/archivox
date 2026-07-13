// ============================================================================
// EQUIPO MÓVIL - Archivox v3.0
// Gestión de equipo con cards tipo app
// ============================================================================

// ============================================================================
// ESTADO GLOBAL
// ============================================================================
var _equipoData = null;
var _agentesData = [];
var _totalGestiones7d = 0;
var _totalCampanas = 0;

// ============================================================================
// INICIALIZACIÓN
// ============================================================================
document.addEventListener('DOMContentLoaded', async function() {
    try {
        // Verificar sesión
        var sesRes = await fetch('/api/auth/sesion');
        if (!sesRes.ok) throw new Error('Error al verificar sesión');
        var sesion = await sesRes.json();

        if (!sesion.autenticado) {
            window.location.href = '/m/login';
            return;
        }

        var user = sesion.usuario;

        // Verificar que tiene equipo y es líder
        if (!user.equipo_id) {
            document.getElementById('equipoContainer').innerHTML = `
                <div class="equipo-empty" style="margin-top:40px;">
                    <div class="equipo-empty-icon">🏢</div>
                    <h3>Sin Equipo Asignado</h3>
                    <p>No perteneces a ningún equipo. Contacta al administrador.</p>
                </div>
            `;
            return;
        }

        // Cargar datos
        await cargarDatosEquipo();

    } catch (err) {
        console.error('[Equipo Móvil] Error:', err);
        document.getElementById('equipoAgentesList').innerHTML = `
            <div class="equipo-empty">
                <div class="equipo-empty-icon">⚠️</div>
                <h3>Error al cargar</h3>
                <p>${escapeHtmlMovil(err.message)}</p>
                <button onclick="recargarTodo()" style="padding:10px 24px;background:#6366f1;color:white;border:none;border-radius:10px;font-weight:600;font-size:14px;">Reintentar</button>
            </div>
        `;
    }
});

// ============================================================================
// CARGAR DATOS DEL EQUIPO
// ============================================================================
async function cargarDatosEquipo() {
    try {
        // Obtener equipo del usuario
        var eqRes = await fetch('/api/equipos/mi-equipo');
        var eqData = await eqRes.json();

        if (!eqData.equipo && !eqData.id) {
            document.getElementById('equipoAgentesList').innerHTML = `
                <div class="equipo-empty">
                    <div class="equipo-empty-icon">🏢</div>
                    <h3>Sin Equipo</h3>
                    <p>No perteneces a ningún equipo.</p>
                </div>
            `;
            return;
        }

        var equipoId = eqData.id;
        if (!equipoId) return;

        // Cargar dashboard del equipo
        var dashRes = await fetch('/api/equipos/' + equipoId + '/dashboard');
        if (!dashRes.ok) throw new Error('Error al cargar dashboard');
        var dashData = await dashRes.json();

        _agentesData = dashData.agentes || [];
        var campañas = dashData.campañas || [];

        // Calcular totales
        _totalGestiones7d = _agentesData.reduce(function(acc, a) {
            return acc + parseInt(a.gestiones_7d || 0);
        }, 0);
        _totalCampanas = campañas.length;
        var totalAsignadas = dashData.totales?.asignadas || _agentesData.reduce(function(acc, a) {
            return acc + parseInt(a.asignadas || 0);
        }, 0);

        var agentesActivos = _agentesData.filter(function(a) { return a.is_active; }).length;

        // Actualizar KPIs
        document.getElementById('kpiAgentes').textContent = agentesActivos;
        document.getElementById('kpiCampanas').textContent = _totalCampanas;
        document.getElementById('kpiGestiones').textContent = _totalGestiones7d;
        document.getElementById('kpiAsignadas').textContent = totalAsignadas;

        // Actualizar contador
        document.getElementById('agentesCount').textContent = _agentesData.length + ' agente(s)';

        // Renderizar cards de agentes
        renderizarAgentesCards();

    } catch (err) {
        console.error('[Equipo Móvil] Error cargar datos:', err);
        document.getElementById('equipoAgentesList').innerHTML = `
            <div class="equipo-empty">
                <div class="equipo-empty-icon">⚠️</div>
                <h3>Error</h3>
                <p>${escapeHtmlMovil(err.message)}</p>
            </div>
        `;
    }
}

// ============================================================================
// RENDERIZAR CARDS DE AGENTES
// ============================================================================
function renderizarAgentesCards() {
    var container = document.getElementById('equipoAgentesList');

    if (!_agentesData || _agentesData.length === 0) {
        container.innerHTML = `
            <div class="equipo-empty">
                <div class="equipo-empty-icon">👥</div>
                <h3>Sin Agentes</h3>
                <p>Aún no hay agentes en tu equipo.</p>
            </div>
        `;
        return;
    }

    var html = '';

    for (var i = 0; i < _agentesData.length; i++) {
        var a = _agentesData[i];
        var activo = a.is_active;
        var estadoClase = activo ? 'activo' : 'inactivo';
        var estadoTexto = activo ? '🟢 Activo' : '🔴 Inactivo';
        var avatarClase = activo ? 'activo' : 'inactivo';
        var inicial = (a.nombre || a.username || '?').charAt(0).toUpperCase();
        var asignadas = parseInt(a.asignadas || 0);
        var gestiones7d = parseInt(a.gestiones_7d || 0);

        html += '<div class="equipo-agente-card ' + estadoClase + '" onclick="abrirDetalleAgente(' + i + ')">';

        // Header con avatar y nombre
        html += '<div class="equipo-agente-header">';
        html += '<div class="equipo-agente-avatar ' + avatarClase + '">👤</div>';
        html += '<div class="equipo-agente-info">';
        html += '<span class="equipo-agente-nombre">' + escapeHtmlMovil(a.nombre || a.username || 'Sin nombre') + '</span>';
        html += '<span class="equipo-agente-username">@' + escapeHtmlMovil(a.username) + '</span>';
        html += '</div>';
        html += '<span class="equipo-agente-status ' + estadoClase + '">' + estadoTexto + '</span>';
        html += '</div>';

        // Stats
        html += '<div class="equipo-agente-stats">';
        html += '<div class="equipo-agente-stat">';
        html += '<span class="equipo-agente-stat-value">' + asignadas + '</span>';
        html += '<span class="equipo-agente-stat-label">📋 Asignadas</span>';
        html += '</div>';
        html += '<div class="equipo-agente-stat">';
        html += '<span class="equipo-agente-stat-value">' + gestiones7d + '</span>';
        html += '<span class="equipo-agente-stat-label">📝 Gestiones (7d)</span>';
        html += '</div>';
        html += '</div>';

        // Botón de acción
        html += '<button class="equipo-agente-btn" onclick="event.stopPropagation(); abrirDetalleAgente(' + i + ')">';
        html += '📋 Ver Detalles';
        html += '</button>';

        html += '</div>';
    }

    container.innerHTML = html;
}

// ============================================================================
// ABRIR DETALLE DE AGENTE (Bottom Sheet)
// ============================================================================
function abrirDetalleAgente(index) {
    var agente = _agentesData[index];
    if (!agente) return;

    var activo = agente.is_active;
    var estadoClase = activo ? 'activo' : 'inactivo';
    var estadoTexto = activo ? '🟢 Activo' : '🔴 Inactivo';
    var estadoAccion = activo ? '🔴 Desactivar' : '🟢 Activar';
    var estadoAccionClase = activo ? 'equipo-detalle-btn-danger' : 'equipo-detalle-btn-success';

    var bodyHtml = '';

    // Header del detalle
    bodyHtml += '<div class="equipo-detalle-header">';
    bodyHtml += '<div class="equipo-detalle-avatar equipo-agente-avatar ' + estadoClase + '">👤</div>';
    bodyHtml += '<div class="equipo-detalle-info">';
    bodyHtml += '<h3>' + escapeHtmlMovil(agente.nombre || agente.username || 'Sin nombre') + '</h3>';
    bodyHtml += '<p>@' + escapeHtmlMovil(agente.username) + ' · ' + estadoTexto + '</p>';
    bodyHtml += '</div>';
    bodyHtml += '</div>';

    // Acciones
    bodyHtml += '<div class="equipo-detalle-actions">';

    // Ver campañas asignadas
    bodyHtml += '<button class="equipo-detalle-btn" onclick="cerrarSheetDetalle(); verCampanasAgente(' + agente.id + ', \\'' + escapeHtmlMovil(agente.username) + '\\')">';
    bodyHtml += '<span class="equipo-detalle-btn-icon">📢</span>';
    bodyHtml += 'Ver Campañas Asignadas';
    bodyHtml += '</button>';

    // Asignar nueva campaña
    bodyHtml += '<button class="equipo-detalle-btn" onclick="cerrarSheetDetalle(); irACampanas()">';
    bodyHtml += '<span class="equipo-detalle-btn-icon">🚀</span>';
    bodyHtml += 'Asignar Nueva Campaña';
    bodyHtml += '</button>';

    bodyHtml += '<div class="equipo-detalle-divider"></div>';

    // Editar agente
    bodyHtml += '<button class="equipo-detalle-btn" onclick="cerrarSheetDetalle(); editarAgente(' + agente.id + ', \\'' + escapeHtmlMovil(agente.username) + '\\', \\'' + escapeHtmlMovil(agente.nombre || '') + '\\')">';
    bodyHtml += '<span class="equipo-detalle-btn-icon">✏️</span>';
    bodyHtml += 'Editar Agente';
    bodyHtml += '</button>';

    // Reset password
    bodyHtml += '<button class="equipo-detalle-btn" onclick="cerrarSheetDetalle(); resetPasswordAgente(' + agente.id + ', \\'' + escapeHtmlMovil(agente.username) + '\\')">';
    bodyHtml += '<span class="equipo-detalle-btn-icon">🔑</span>';
    bodyHtml += 'Cambiar Contraseña';
    bodyHtml += '</button>';

    bodyHtml += '<div class="equipo-detalle-divider"></div>';

    // Activar/Desactivar
    bodyHtml += '<button class="equipo-detalle-btn ' + estadoAccionClase + '" onclick="cerrarSheetDetalle(); toggleActivoAgente(' + agente.id + ', ' + (activo ? 'false' : 'true') + ', \\'' + escapeHtmlMovil(agente.username) + '\\')">';
    bodyHtml += '<span class="equipo-detalle-btn-icon">' + (activo ? '🔴' : '🟢') + '</span>';
    bodyHtml += estadoAccion;
    bodyHtml += '</button>';

    bodyHtml += '</div>';

    // Mostrar bottom sheet
    mostrarSheetMovil('👤 ' + escapeHtmlMovil(agente.username), bodyHtml);
}

// ============================================================================
// BOTTOM SHEET MÓVIL (usando estilos de estilos.css)
// ============================================================================
function mostrarSheetMovil(titulo, bodyHtml) {
    // Crear overlay
    var overlay = document.createElement('div');
    overlay.className = 'mm-overlay visible';

    // Crear sheet
    var sheet = document.createElement('div');
    sheet.className = 'mm-sheet visible';

    sheet.innerHTML = '' +
        '<div class="mm-handle"></div>' +
        '<div class="mm-header">' +
            '<span class="mm-header-title">' + titulo + '</span>' +
            '<button class="mm-close" onclick="cerrarSheetDetalle()">✕</button>' +
        '</div>' +
        '<div class="mm-body equipo-sheet-body">' +
            bodyHtml +
        '</div>';

    overlay.appendChild(sheet);
    document.body.appendChild(overlay);

    // Cerrar al tocar overlay
    overlay.addEventListener('click', function(e) {
        if (e.target === overlay) {
            cerrarSheetDetalle();
        }
    });
}

function cerrarSheetDetalle() {
    var sheets = document.querySelectorAll('.mm-sheet.visible');
    var overlays = document.querySelectorAll('.mm-overlay.visible');

    for (var i = 0; i < sheets.length; i++) {
        sheets[i].classList.remove('visible');
    }
    for (var i = 0; i < overlays.length; i++) {
        overlays[i].classList.remove('visible');
    }

    // Remover después de la animación
    setTimeout(function() {
        var allSheets = document.querySelectorAll('.mm-sheet');
        var allOverlays = document.querySelectorAll('.mm-overlay');
        for (var i = 0; i < allSheets.length; i++) {
            if (!allSheets[i].classList.contains('visible')) {
                allSheets[i].remove();
            }
        }
        for (var i = 0; i < allOverlays.length; i++) {
            if (!allOverlays[i].classList.contains('visible')) {
                allOverlays[i].remove();
            }
        }
    }, 350);
}

// ============================================================================
// ACCIONES DE AGENTE
// ============================================================================

// Ver campañas del agente
async function verCampanasAgente(agenteId, username) {
    mostrarToastMovil('📢 Cargando campañas de ' + username + '...');

    try {
        // Obtener equipo ID
        var eqRes = await fetch('/api/equipos/mi-equipo');
        var eqData = await eqRes.json();
        var equipoId = eqData.id;
        if (!equipoId) return;

        var campRes = await fetch('/api/equipos/' + equipoId + '/campanas');
        var campData = await campRes.json();
        var campañas = campData.data || [];

        // Filtrar campañas asignadas a este agente
        var asignadas = campañas.filter(function(c) {
            return String(c.asignado_a) === String(agenteId);
        });

        var bodyHtml = '';

        if (asignadas.length === 0) {
            bodyHtml = '<div style="text-align:center;padding:30px 0;color:#6b7280;">';
            bodyHtml += '<div style="font-size:40px;margin-bottom:10px;">📢</div>';
            bodyHtml += '<p style="font-size:14px;">' + escapeHtmlMovil(username) + ' no tiene campañas asignadas.</p>';
            bodyHtml += '</div>';
        } else {
            bodyHtml += '<div style="margin-bottom:12px;font-size:13px;color:#6b7280;">📊 Total: ' + asignadas.length + ' campaña(s)</div>';

            for (var i = 0; i < asignadas.length; i++) {
                var c = asignadas[i];
                var total = parseInt(c.total_solicitudes || 0);
                var gestionadas = parseInt(c.gestionadas || 0);
                var pct = total > 0 ? Math.round((gestionadas / total) * 100) : 0;

                bodyHtml += '<div style="background:#f9fafb;border-radius:10px;padding:12px;margin-bottom:8px;border:1px solid #f3f4f6;">';
                bodyHtml += '<div style="font-weight:700;font-size:13px;color:#1f2937;margin-bottom:6px;">#' + c.id + ' ' + escapeHtmlMovil(c.nombre_campana || 'Campaña') + '</div>';
                bodyHtml += '<div style="font-size:11px;color:#6b7280;">📄 ' + total + ' · ✓ ' + gestionadas + ' · 📊 ' + pct + '%</div>';
                bodyHtml += '<div style="margin-top:6px;height:4px;background:#e5e7eb;border-radius:2px;overflow:hidden;">';
                bodyHtml += '<div style="height:100%;width:' + pct + '%;background:#10b981;border-radius:2px;transition:width 0.3s;"></div>';
                bodyHtml += '</div>';
                bodyHtml += '</div>';
            }
        }

        mostrarSheetMovil('📢 Campañas de ' + escapeHtmlMovil(username), bodyHtml);

    } catch (err) {
        console.error('[Equipo Móvil] Error cargando campañas:', err);
        mostrarToastMovil('⚠️ Error al cargar campañas');
    }
}

// Ir a campañas (gestion-lote)
function irACampanas() {
    window.location.href = '/m/gestion-lote';
}

// Editar agente
function editarAgente(agenteId, username, nombreActual) {
    var bodyHtml = '';
    bodyHtml += '<div style="padding:8px 0;">';
    bodyHtml += '<div style="margin-bottom:14px;">';
    bodyHtml += '<label style="display:block;font-size:12px;font-weight:600;color:#374151;margin-bottom:4px;">Nombre completo</label>';
    bodyHtml += '<input type="text" id="edit-nombre-agente" value="' + escapeHtmlMovil(nombreActual) + '" placeholder="Nombre del agente" style="width:100%;padding:10px 12px;border:2px solid #e5e7eb;border-radius:8px;font-size:14px;box-sizing:border-box;">';
    bodyHtml += '</div>';
    bodyHtml += '<div style="margin-bottom:14px;">';
    bodyHtml += '<label style="display:block;font-size:12px;font-weight:600;color:#374151;margin-bottom:4px;">Email (opcional)</label>';
    bodyHtml += '<input type="email" id="edit-email-agente" placeholder="correo@ejemplo.com" style="width:100%;padding:10px 12px;border:2px solid #e5e7eb;border-radius:8px;font-size:14px;box-sizing:border-box;">';
    bodyHtml += '</div>';
    bodyHtml += '<button class="equipo-detalle-btn" style="background:#6366f1;color:white;justify-content:center;margin-top:8px;" onclick="guardarEdicionAgente(' + agenteId + ')">';
    bodyHtml += '<span class="equipo-detalle-btn-icon">💾</span> Guardar Cambios';
    bodyHtml += '</button>';
    bodyHtml += '</div>';

    mostrarSheetMovil('✏️ Editar ' + escapeHtmlMovil(username), bodyHtml);
}

async function guardarEdicionAgente(agenteId) {
    var nombre = document.getElementById('edit-nombre-agente').value.trim();
    var email = document.getElementById('edit-email-agente').value.trim() || null;

    if (!nombre) {
        mostrarToastMovil('⚠️ El nombre es requerido');
        return;
    }

    try {
        var eqRes = await fetch('/api/equipos/mi-equipo');
        var eqData = await eqRes.json();
        var equipoId = eqData.id;
        if (!equipoId) return;

        var res = await fetch('/api/equipos/' + equipoId + '/agentes/' + agenteId, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nombre: nombre, email: email })
        });

        if (res.ok) {
            mostrarToastMovil('✅ Agente actualizado');
            cerrarSheetDetalle();
            await recargarTodo();
        } else {
            var errData = await res.json();
            mostrarToastMovil('⚠️ ' + (errData.error || 'Error al actualizar'));
        }
    } catch (err) {
        console.error('[Equipo Móvil] Error editando agente:', err);
        mostrarToastMovil('⚠️ Error de conexión');
    }
}

// Reset password
function resetPasswordAgente(agenteId, username) {
    var bodyHtml = '';
    bodyHtml += '<div style="padding:8px 0;">';
    bodyHtml += '<p style="font-size:13px;color:#6b7280;margin-bottom:14px;">Nueva contraseña para <strong>' + escapeHtmlMovil(username) + '</strong></p>';
    bodyHtml += '<div style="margin-bottom:14px;">';
    bodyHtml += '<label style="display:block;font-size:12px;font-weight:600;color:#374151;margin-bottom:4px;">Nueva contraseña</label>';
    bodyHtml += '<input type="text" id="reset-password-input" placeholder="Mín 8 carac., mayúscula y número" style="width:100%;padding:10px 12px;border:2px solid #e5e7eb;border-radius:8px;font-size:14px;box-sizing:border-box;">';
    bodyHtml += '</div>';
    bodyHtml += '<button class="equipo-detalle-btn" style="background:#6366f1;color:white;justify-content:center;" onclick="guardarResetPassword(' + agenteId + ')">';
    bodyHtml += '<span class="equipo-detalle-btn-icon">🔑</span> Cambiar Contraseña';
    bodyHtml += '</button>';
    bodyHtml += '</div>';

    mostrarSheetMovil('🔑 Reset Password', bodyHtml);
}

async function guardarResetPassword(agenteId) {
    var nuevaPassword = document.getElementById('reset-password-input').value;

    if (!nuevaPassword || nuevaPassword.length < 8) {
        mostrarToastMovil('⚠️ Mínimo 8 caracteres');
        return;
    }
    if (!/[A-Z]/.test(nuevaPassword)) {
        mostrarToastMovil('⚠️ Debe contener una mayúscula');
        return;
    }
    if (!/[0-9]/.test(nuevaPassword)) {
        mostrarToastMovil('⚠️ Debe contener un número');
        return;
    }

    try {
        var eqRes = await fetch('/api/equipos/mi-equipo');
        var eqData = await eqRes.json();
        var equipoId = eqData.id;
        if (!equipoId) return;

        var res = await fetch('/api/equipos/' + equipoId + '/agentes/' + agenteId + '/reset-password', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nueva_password: nuevaPassword })
        });

        if (res.ok) {
            mostrarToastMovil('✅ Contraseña actualizada');
            cerrarSheetDetalle();
        } else {
            var errData = await res.json();
            mostrarToastMovil('⚠️ ' + (errData.error || 'Error'));
        }
    } catch (err) {
        console.error('[Equipo Móvil] Error reset password:', err);
        mostrarToastMovil('⚠️ Error de conexión');
    }
}

// Toggle activo/inactivoasync function toggleActivoAgente(agenteId, nuevoEstado, username) {
    var accion = nuevoEstado ? 'activar' : 'desactivar';
    var confirmado = await new Promise(function(resolve) {
        Modal.confirmar({
            titulo: (nuevoEstado ? '🟢 Activar' : '🔴 Desactivar') + ' Agente',
            mensaje: '¿Estás seguro de ' + accion + ' a <strong>' + escapeHtmlMovil(username) + '</strong>?',
            icono: nuevoEstado ? '🟢' : '🔴',
            textoConfirmar: 'Sí, ' + accion,
            textoCancelar: 'Cancelar',
            tipo: nuevoEstado ? 'success' : 'danger',
            onConfirm: function() { resolve(true); }
        });
        // Si se cierra sin confirmar
        setTimeout(function() { resolve(false); }, 30000);
    });
    if (!confirmado) return;
    
    try {
        var eqRes = await fetch('/api/equipos/mi-equipo');
        var eqData = await eqRes.json();
        var equipoId = eqData.id;
        if (!equipoId) return;

        var res = await fetch('/api/equipos/' + equipoId + '/agentes/' + agenteId + '/toggle-active', {
            method: 'PUT'
        });

        if (res.ok) {
            mostrarToastMovil('✅ ' + username + ' ' + (nuevoEstado ? 'activado' : 'desactivado'));
            await recargarTodo();
        } else {
            var errData = await res.json();
            mostrarToastMovil('⚠️ ' + (errData.error || 'Error'));
        }
    } catch (err) {
        console.error('[Equipo Móvil] Error toggle:', err);
        mostrarToastMovil('⚠️ Error de conexión');
    }
}

// ============================================================================
// RECARGAR TODO
// ============================================================================
async function recargarTodo() {
    // Mostrar shimmer
    document.getElementById('equipoAgentesList').innerHTML = '' +
        '<div class="equipo-shimmer"></div>' +
        '<div class="equipo-shimmer" style="margin-top:12px;"></div>';

    // Actualizar KPIs con animación
    var kpiValues = document.querySelectorAll('.equipo-kpi-value');
    for (var i = 0; i < kpiValues.length; i++) {
        kpiValues[i].textContent = '...';
    }

    await cargarDatosEquipo();
    mostrarToastMovil('✅ Actualizado');
}

// ============================================================================
// TOAST
// ============================================================================
function mostrarToastMovil(mensaje) {
    var existing = document.querySelector('.equipo-toast-movil');
    if (existing) existing.remove();

    var toast = document.createElement('div');
    toast.className = 'equipo-toast-movil';
    toast.textContent = mensaje;
    document.body.appendChild(toast);

    setTimeout(function() {
        toast.style.opacity = '0';
        toast.style.transition = 'opacity 0.3s';
        setTimeout(function() { toast.remove(); }, 300);
    }, 2500);
}

// ============================================================================
// HELPERS
// ============================================================================
function escapeHtmlMovil(str) {
    if (!str) return '';
    return String(str).replace(/[&<>"']/g, function(c) {
        return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c] || c;
    });
}
