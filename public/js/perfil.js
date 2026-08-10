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
