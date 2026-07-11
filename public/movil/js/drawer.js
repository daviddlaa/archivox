/**
 * Drawer Unificado para Móvil
 * Se incluye en todas las páginas móviles
 * 
 * Funciones:
 * - abrirDrawer() / cerrarDrawer()
 * - toggleDrawer()
 * - Manejo de eventos (Escape, click outside)
 */

console.log('Drawer.js móvil cargado');

// Verificar si ya existe el drawer en el DOM
function initDrawer() {
    console.log('Inicializando drawer móvil...');
    
    var existingDrawer = document.getElementById('drawer');
    var existingOverlay = document.getElementById('drawer-overlay');
    
    if (existingDrawer && existingOverlay) {
        console.log('Drawer ya existe en el DOM');
        return;
    }
    
    console.log('Creando drawer dinámicamente...');
    crearDrawer();
}

// Crear el drawer dinámicamente
function crearDrawer() {
    // Overlay
    var overlay = document.createElement('div');
    overlay.id = 'drawer-overlay';
    overlay.className = 'drawer-overlay';
    overlay.onclick = cerrarDrawer;
    
    // Drawer
    var drawer = document.createElement('aside');
    drawer.id = 'drawer';
    drawer.className = 'drawer';
    
    // HTML del drawer
    drawer.innerHTML = `
        <div class="drawer-header">
            <span class="drawer-header-title">📋 Archivox</span>
            <button class="drawer-close" onclick="cerrarDrawer()">✕</button>
        </div>

        <div class="drawer-section">
            <h3>Inicio</h3>
            <ul class="drawer-menu">
                <li><a href="/m"><span class="drawer-menu-icon">📊</span>Dashboard</a></li>
                <li><a href="/m/solicitudes"><span class="drawer-menu-icon">📋</span>Solicitudes</a></li>
            </ul>
        </div>

        <div class="drawer-section">
            <h3>Operaciones</h3>
            <ul class="drawer-menu">
                <li><a href="/m/importar"><span class="drawer-menu-icon">📤</span>Importar</a></li>
                <li><a href="/m/gestiones"><span class="drawer-menu-icon">📝</span>Gestiones</a></li>
                <li><a href="/m/gestion-lote"><span class="drawer-menu-icon">🚀</span>Campañas</a></li>
                <li><a href="/m/relaciones"><span class="drawer-menu-icon">📋</span>Relaciones</a></li>
                <li><a href="/m/ventas"><span class="drawer-menu-icon">💰</span>Ventas</a></li>
                <li><a href="/m/historial"><span class="drawer-menu-icon">🔄</span>Historial</a></li>
                <li><a href="/perfil"><span class="drawer-menu-icon">👤</span>Mi Perfil</a></li>
                <li><a href="/m/admin" id="adminLinkMovil" style="display:none"><span class="drawer-menu-icon">🛡️</span>Admin</a></li>
            </ul>
        </div>

        <div class="drawer-section drawer-section-last">
            <h3>Cuenta</h3>
            <ul class="drawer-menu">
                <li class="drawer-menu-logout">
                    <a href="#" onclick="cerrarSesion()">
                        <span class="drawer-menu-icon">🚪</span>
                        Cerrar Sesión
                    </a>
                </li>
            </ul>
        </div>
    `;
    
    // Insertar en el body
    document.body.appendChild(overlay);
    document.body.appendChild(drawer);
}

// Mostrar enlace admin si el usuario es admin
async function checkAdminAccessMovil() {
    try {
        const res = await fetch('/api/auth/sesion');
        const data = await res.json();
        if (data.autenticado && (data.usuario.rol === 'admin' || data.usuario.rol === 'superadmin' || data.usuario.is_superadmin)) {
            var link = document.getElementById('adminLinkMovil');
            if (link) link.style.display = '';
        }
    } catch(e) { /* ignora */ }
}

// Funciones globales

function abrirDrawer() {
    var drawer = document.getElementById('drawer');
    var overlay = document.getElementById('drawer-overlay');
    
    if (drawer && overlay) {
        drawer.classList.add('open');
        overlay.classList.add('open');
        // Bloquear scroll del body para evitar rebote
        document.body.style.overflow = 'hidden';
        console.log('Drawer abierto');
    } else {
        console.error('Elementos del drawer no encontrados');
    }
}

function cerrarDrawer() {
    var drawer = document.getElementById('drawer');
    var overlay = document.getElementById('drawer-overlay');
    
    if (drawer && overlay) {
        drawer.classList.remove('open');
        overlay.classList.remove('open');
        // Restaurar scroll del body
        document.body.style.overflow = '';
        console.log('Drawer cerrado');
    }
}

function toggleDrawer() {
    var drawer = document.getElementById('drawer');
    
    if (drawer && drawer.classList.contains('open')) {
        cerrarDrawer();
    } else {
        abrirDrawer();
    }
}

// Cerrar sesión
function cerrarSesion() {
    if (confirm('¿Estás seguro de cerrar sesión?')) {
        // Marcar que se está cerrando sesión (para evitar re-entrada automática)
        sessionStorage.setItem('justLoggedOut', Date.now().toString());
        
        // Fetch con credentials para enviar la cookie y esperar respuesta
        fetch('/auth/logout', { 
            method: 'POST', 
            credentials: 'include' 
        })
        .then(function(response) { 
            // Verificar que el logout fue exitoso
            if (response.ok) {
                window.location.href = '/login';
            } else {
                // Si hay error, igual redirigir forzando logout
                window.location.href = '/login';
            }
        })
        .catch(function() { 
            // En caso de error, igual redirigir al login
            window.location.href = '/login'; 
        });
    }
    return false;
}

// Event listeners
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
        cerrarDrawer();
    }
});

// Verificar acceso admin
setTimeout(checkAdminAccessMovil, 500);

// Inicializar cuando el DOM esté listo
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initDrawer);
} else {
    // Si ya está listo, ejecutar después de un pequeño delay
    setTimeout(initDrawer, 0);
}
