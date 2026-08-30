// ============================================================================
// PERFIL DE USUARIO - ARCHIVOX
// ============================================================================

document.addEventListener('DOMContentLoaded', async function() {
    try {
        // Verificar sesión
        const sesRes = await fetch('/api/auth/sesion');
        if (!sesRes.ok) {
            window.location.href = '/login';
            return;
        }
        const sesion = await sesRes.json();
        if (!sesion.autenticado) {
            window.location.href = '/login';
            return;
        }

        // Cargar datos del perfil
        await cargarPerfil();
    } catch (err) {
        console.error('[Perfil] Error:', err);
    }
});

// ============================================================================
// NOTIFICACIONES PUSH — estado + activar/desactivar desde el Perfil
// ============================================================================
// push-suscripcion.js se carga con `defer` (se ejecuta al terminar el parseo),
// antes del evento `load`. Por eso se usa `load` para garantizar que el objeto
// PushNotif ya existe.
// ============================================================================
window.addEventListener('load', function() {
    var pushEst = document.getElementById('perfilPushEstado');
    var btnActivar = document.getElementById('btnActivarPush');
    var btnDesactivar = document.getElementById('btnDesactivarPush');

    if (!pushEst || !window.PushNotif) return;

    function renderizar(suscrito) {
        var estado = PushNotif.estadoPermiso();
        if (estado === 'no-soporte') {
            pushEst.textContent = 'Tu navegador no soporta notificaciones push en este dispositivo.';
            btnActivar.style.display = 'none';
            btnDesactivar.style.display = 'none';
        } else if (PushNotif.esIOSEnPestana()) {
            pushEst.textContent = 'En iPhone/iPad, abre "Compartir" → "Añadir a Pantalla de Inicio" para activar las notificaciones.';
            btnActivar.style.display = 'none';
            btnDesactivar.style.display = 'none';
        } else if (estado === 'denied') {
            pushEst.textContent = 'Permiso bloqueado en este navegador. Actívalo desde la configuración del navegador.';
            btnActivar.style.display = 'none';
            btnDesactivar.style.display = 'none';
        } else if (suscrito) {
            pushEst.textContent = '✅ Este dispositivo recibe notificaciones push.';
            btnActivar.style.display = 'none';
            btnDesactivar.style.display = 'inline-block';
        } else {
            pushEst.textContent = 'Este dispositivo no tiene notificaciones push activadas.';
            btnActivar.style.display = 'inline-block';
            btnDesactivar.style.display = 'none';
        }
    }

    function consultarEstado() {
        if (PushNotif.soportado()) {
            PushNotif.registrarSW().then(function(reg) {
                return reg.pushManager.getSubscription();
            }).then(function(sub) {
                renderizar(Boolean(sub));
            }).catch(function() { renderizar(false); });
        } else {
            renderizar(false);
        }
    }

    btnActivar.addEventListener('click', function() {
        btnActivar.disabled = true;
        PushNotif.solicitar().then(function(r) {
            btnActivar.disabled = false;
            if (r.estado === 'suscrito' || r.estado === 'ya-suscrito') {
                renderizar(true);
            } else if (r.error && pushEst) {
                // El navegador falló al suscribirse: mostrar el motivo real
                // (típicamente clave VAPID mal configurada en el entorno)
                pushEst.textContent = 'No se pudo activar: ' + r.error;
            } else {
                consultarEstado(); // refresca el mensaje según el permiso resultante
            }
        });
    });

    btnDesactivar.addEventListener('click', function() {
        btnDesactivar.disabled = true;
        PushNotif.desactivar().then(function() {
            btnDesactivar.disabled = false;
            renderizar(false);
        });
    });

    consultarEstado();
});

// ============================================================================
// CARGAR PERFIL
// ============================================================================
async function cargarPerfil() {
    try {
        const res = await fetch('/api/auth/perfil');
        if (!res.ok) {
            mostrarError('Error al cargar el perfil');
            return;
        }
        const user = await res.json();

        // Información personal
        document.getElementById('perfilNombre').textContent = user.nombre || user.username;
        document.getElementById('perfilUsername').textContent = user.username;
        document.getElementById('perfilEmail').textContent = user.email || 'No registrado';
        document.getElementById('perfilRol').textContent = rolLabel(user);
        document.getElementById('perfilCreado').textContent = formatearFecha(user.created_at);
        document.getElementById('perfilLastLogin').textContent = formatearFecha(user.last_login) || 'Nunca';

        // Avatar con inicial
        const inicial = (user.nombre || user.username).charAt(0).toUpperCase();
        document.getElementById('avatarInicial').textContent = inicial;

        // Rellenar formulario de edición
        document.getElementById('editNombre').value = user.nombre || '';
        document.getElementById('editEmail').value = user.email || '';

    } catch (err) {
        console.error('[Perfil] Error cargar:', err);
        mostrarError('Error de conexión al cargar perfil');
    }
}

// ============================================================================
// ACTUALIZAR PERFIL
// ============================================================================
document.getElementById('perfilForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const btn = e.target.querySelector('button[type="submit"]');
    const nombre = document.getElementById('editNombre').value;
    const email = document.getElementById('editEmail').value;

    btn.disabled = true;
    btn.textContent = 'Guardando...';
    limpiarMensaje();

    try {
        const res = await fetch('/api/auth/perfil', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nombre, email })
        });

        const data = await res.json();
        if (res.ok) {
            mostrarExito('✅ Perfil actualizado correctamente');
            cargarPerfil(); // Recargar datos
        } else {
            mostrarError(data.error || 'Error al actualizar');
        }
    } catch (err) {
        console.error('[Perfil] Error update:', err);
        mostrarError('Error de conexión');
    } finally {
        btn.disabled = false;
        btn.textContent = 'Guardar Cambios';
    }
});

// ============================================================================
// CAMBIAR CONTRASEÑA
// ============================================================================
document.getElementById('passwordForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const btn = e.target.querySelector('button[type="submit"]');
    const password_actual = document.getElementById('passActual').value;
    const nueva_password = document.getElementById('passNueva').value;
    const confirmar = document.getElementById('passConfirmar').value;

    if (nueva_password !== confirmar) {
        mostrarError('Las contraseñas nuevas no coinciden');
        return;
    }

    btn.disabled = true;
    btn.textContent = 'Actualizando...';
    limpiarMensaje();

    try {
        const res = await fetch('/api/auth/cambiar-password', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password_actual, nueva_password })
        });

        const data = await res.json();
        if (res.ok) {
            mostrarExito('✅ Contraseña actualizada correctamente');
            document.getElementById('passwordForm').reset();
        } else {
            mostrarError(data.error || 'Error al cambiar contraseña');
        }
    } catch (err) {
        console.error('[Perfil] Error password:', err);
        mostrarError('Error de conexión');
    } finally {
        btn.disabled = false;
        btn.textContent = 'Actualizar Contraseña';
    }
});

// ============================================================================
// HELPERS
// ============================================================================
function mostrarError(msg) {
    const div = document.getElementById('perfilMensaje');
    div.innerHTML = `<div class="error-message">${msg}</div>`;
    setTimeout(() => { const el = div.querySelector('.error-message'); if (el) el.remove(); }, 5000);
}

function mostrarExito(msg) {
    const div = document.getElementById('perfilMensaje');
    div.innerHTML = `<div class="success-message">${msg}</div>`;
    setTimeout(() => { const el = div.querySelector('.success-message'); if (el) el.remove(); }, 5000);
}

function limpiarMensaje() {
    document.getElementById('perfilMensaje').innerHTML = '';
}

function rolLabel(user) {
    if (user.is_superadmin || user.rol === 'superadmin') return '👑 Super Admin';
    if (user.rol === 'lider') return '👑 Líder';
    if (user.rol === 'agente') return '🔹 Agente';
    return '👤 Usuario';
}

function formatearFecha(fecha) {
    if (!fecha) return '-';
    try {
        return new Date(fecha).toLocaleDateString('es-ES', {
            day: '2-digit', month: 'long', year: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });
    } catch(e) { return fecha; }
}
