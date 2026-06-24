// Manejo de autenticación

const loginForm = document.getElementById('loginForm');
const registroForm = document.getElementById('registroForm');
const mensajeDiv = document.getElementById('mensaje');

// Verificar si ya está logueado al cargar
document.addEventListener('DOMContentLoaded', async () => {
    try {
        // Verificar si viene de un logout reciente (evitar re-entrada automática)
        const justLoggedOut = sessionStorage.getItem('justLoggedOut');
        const now = Date.now();
        
        // Si viene de logout hace menos de 2 segundos, no verificar automáticamente
        if (justLoggedOut && (now - parseInt(justLoggedOut)) < 2000) {
            console.log('Logout reciente, no auto-redirigir');
            sessionStorage.removeItem('justLoggedOut');
            return;
        }
        
        const response = await fetch('/api/auth/sesion');
        const data = await response.json();
        
        if (data.autenticado) {
            // Ya está logueado, redirigir al dashboard
            window.location.href = '/';
        }
    } catch (error) {
        console.error('Error al verificar sesión:', error);
    }
});

// Mostrar formulario de registro
function mostrarRegistro() {
    loginForm.style.display = 'none';
    registroForm.style.display = 'flex';
    mensajeDiv.innerHTML = '';
}

// Mostrar formulario de login
function mostrarLogin() {
    registroForm.style.display = 'none';
    loginForm.style.display = 'flex';
    mensajeDiv.innerHTML = '';
}

// Mostrar mensaje de error
function mostrarError(mensaje) {
    mensajeDiv.innerHTML = `<div class="error-message">${mensaje}</div>`;
}

// Mostrar mensaje de éxito
function mostrarExito(mensaje) {
    mensajeDiv.innerHTML = `<div class="success-message">${mensaje}</div>`;
}

// Manejar login
if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;
        const btn = loginForm.querySelector('.btn-login');
        
        btn.disabled = true;
        btn.innerHTML = '<div class="loader"></div>';
        mensajeDiv.innerHTML = '';
        
        try {
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ username, password })
            });
            
            const data = await response.json();
            
            if (response.ok) {
                mostrarExito('✓ Login exitoso, redireccionando...');
                setTimeout(() => {
                    window.location.href = '/';
                }, 1000);
            } else {
                mostrarError(data.error || 'Error al iniciar sesión');
                btn.disabled = false;
                btn.textContent = 'Iniciar Sesión';
            }
        } catch (error) {
            mostrarError('Error de conexión');
            btn.disabled = false;
            btn.textContent = 'Iniciar Sesión';
        }
    });
}

// Manejar registro
if (registroForm) {
    registroForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const username = document.getElementById('regUsername').value;
        const password = document.getElementById('regPassword').value;
        const nombre = document.getElementById('regNombre').value;
        const btn = registroForm.querySelector('.btn-login');
        
        btn.disabled = true;
        btn.innerHTML = '<div class="loader"></div>';
        mensajeDiv.innerHTML = '';
        
        try {
            const response = await fetch('/api/auth/registrar', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ username, password, nombre })
            });
            
            const data = await response.json();
            
            if (response.ok) {
                mostrarExito('✓ Cuenta creada, ahora puedes iniciar sesión');
                registroForm.reset();
                setTimeout(() => {
                    mostrarLogin();
                }, 1500);
            } else {
                mostrarError(data.error || 'Error al registrar');
                btn.disabled = false;
                btn.textContent = 'Crear Cuenta';
            }
        } catch (error) {
            mostrarError('Error de conexión');
            btn.disabled = false;
            btn.textContent = 'Crear Cuenta';
        }
    });
}

// Función global para usar en onclick
window.mostrarRegistro = mostrarRegistro;
window.mostrarLogin = mostrarLogin;
