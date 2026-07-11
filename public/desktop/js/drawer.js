// Drawer unificado para versión escritorio
// Usado en todas las páginas de escritorio
console.log('Drawer.js cargado');

// Verificar si el drawer ya existe en el HTML (si está en el DOM, no recrear)
function initDrawer() {
    console.log('Drawer check init');
    
    var existingDrawer = document.getElementById('drawer');
    var existingToggle = document.getElementById('drawer-toggle');
    var existingOverlay = document.getElementById('drawer-overlay');
    
    if (existingDrawer && existingToggle && existingOverlay) {
        console.log('Drawer ya existe en HTML, no recrear');
    } else {
        console.log('Drawer no encontrado en HTML, creando dinámicamente...');
        crearDrawerDinamico();
    }
    
    // Verificar acceso admin
    checkAdminAccess();
    
    // Agregar evento de teclado
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            Drawer.close();
        }
    });
}

// Determinar si estamos en la página de administración
function esPaginaAdmin() {
    return window.location.pathname === '/admin' ||
           window.location.pathname === '/m/admin' ||
           window.location.pathname.startsWith('/admin/');
}

// Crear drawer dinámicamente si no existe en HTML
function crearDrawerDinamico() {
    // Si ya existe un drawer-wrapper en el DOM, reutilizarlo en lugar de crear otro
    var existingWrapper = document.getElementById('drawer-wrapper');
    
    // Determinar si es página admin para usar links adecuados
    var isAdmin = esPaginaAdmin();
    
    var drawerHTML = '';
    
    if (isAdmin) {
        // Drawer con opciones completas de administración
        // El primer link (Dashboard) es activo por defecto
        drawerHTML = `
            <button id="drawer-toggle" class="drawer-toggle" onclick="Drawer.toggle()">☰</button>
            <div id="drawer-overlay" class="drawer-overlay" onclick="Drawer.close()"></div>
            <aside id="drawer" class="drawer">
                <div class="drawer-header">
                    <div class="drawer-logo"><h2>🛡️ Admin</h2></div>
                    <button class="drawer-close" onclick="Drawer.close()">✕</button>
                </div>
                <nav class="drawer-nav">
                    <a href="/admin" class="drawer-link active">📊 Dashboard</a>
                    <a href="#" class="drawer-link" onclick="cambiarTab('usuarios'); Drawer.close(); return false;">👥 Usuarios</a>
                    <a href="#" class="drawer-link" onclick="cambiarTab('estadisticas'); Drawer.close(); return false;">📊 Estadísticas</a>
                    <a href="#" class="drawer-link" onclick="cambiarTab('auditoria'); Drawer.close(); return false;">📋 Auditoría</a>
                    <a href="#" class="drawer-link" onclick="cambiarTab('notificaciones'); Drawer.close(); return false;">🔔 Notificaciones</a>
                    <a href="#" class="drawer-link" onclick="alert('Centro de Comunicación - Próximamente'); Drawer.close(); return false;">📢 Centro de Comunicación</a>
                    <a href="#" class="drawer-link" onclick="alert('Centro de Aprendizaje - Próximamente'); Drawer.close(); return false;">🎓 Centro de Aprendizaje</a>
                    <a href="#" class="drawer-link" onclick="alert('Configuración - Próximamente'); Drawer.close(); return false;">⚙️ Configuración</a>
                    <div class="drawer-divider"></div>
                    <a href="/" class="drawer-link">🏠 Volver al Sistema</a>
                    <a href="#" class="drawer-link drawer-link-logout" onclick="cerrarSesion()">🚪 Cerrar Sesión</a>
                </nav>
            </aside>
        `;
        // Nota: La clase 'active' del Dashboard se actualizará dinámicamente
        // cuando se implemente la navegación por tabs en el panel admin
    } else {
        // Drawer estándar para usuarios
        drawerHTML = `
            <button id="drawer-toggle" class="drawer-toggle" onclick="Drawer.toggle()">☰</button>
            <div id="drawer-overlay" class="drawer-overlay" onclick="Drawer.close()"></div>
            <aside id="drawer" class="drawer">
                <div class="drawer-header">
                    <div class="drawer-logo"><h2>📊 Archivox</h2></div>
                    <button class="drawer-close" onclick="Drawer.close()">✕</button>
                </div>
                <nav class="drawer-nav">
                    <a href="/" class="drawer-link">📊 Dashboard</a>
                    <a href="/perfil" class="drawer-link">👤 Mi Perfil</a>
                    <a href="/equipo-ventas" class="drawer-link">💰 Control de Ventas</a>
                    <a href="/importar" class="drawer-link">📤 Importar Excel</a>
                    <a href="/solicitudes" class="drawer-link">📋 Solicitudes</a>
                    <a href="/gestiones" class="drawer-link">📝 Gestiones</a>
                    <a href="/gestion-lote" class="drawer-link">📢 Campañas</a>
                    <a href="/relaciones" class="drawer-link">📋 Relaciones</a>
                    <a href="/historial" class="drawer-link">🔄 Historial</a>
                    <a href="/admin" class="drawer-link drawer-link-admin" id="adminLink" style="display:none">🛡️ Admin</a>
                    <a href="#" class="drawer-link drawer-link-logout" onclick="cerrarSesion()">🚪 Cerrar Sesión</a>
                </nav>
            </aside>
        `;
    }
    
    if (existingWrapper) {
        // Si ya existe un wrapper (como en admin.html), reemplazar su contenido
        existingWrapper.innerHTML = drawerHTML;
        console.log('Drawer insertado en wrapper existente');
    } else if (document.body) {
        // Si no existe wrapper, crear uno nuevo al inicio del body
        var drawerDiv = document.createElement('div');
        drawerDiv.id = 'drawer-wrapper';
        drawerDiv.innerHTML = drawerHTML;
        document.body.insertBefore(drawerDiv, document.body.firstChild);
        console.log('Drawer creado dinámicamente');
    }
}

var Drawer = {
    isOpen: false,
    
    toggle: function() {
        console.log('Toggle drawer, estado actual:', this.isOpen);
        if (this.isOpen) {
            this.close();
        } else {
            this.open();
        }
    },
    
    open: function() {
        var drawer = document.getElementById('drawer');
        var overlay = document.getElementById('drawer-overlay');
        var toggle = document.getElementById('drawer-toggle');
        
        console.log('Abriendo drawer:', drawer, overlay);
        
        if (drawer && overlay) {
            drawer.classList.add('open');
            overlay.classList.add('open');
            if (toggle) toggle.classList.add('hidden');
            this.isOpen = true;
            console.log('Drawer abierto');
        } else {
            console.error('Elementos del drawer no encontrados');
        }
    },
    
    close: function() {
        var drawer = document.getElementById('drawer');
        var overlay = document.getElementById('drawer-overlay');
        var toggle = document.getElementById('drawer-toggle');
        
        if (drawer && overlay) {
            drawer.classList.remove('open');
            overlay.classList.remove('open');
            if (toggle) toggle.classList.remove('hidden');
            this.isOpen = false;
        }
    }
};

// Mostrar enlace de admin si el usuario tiene rol admin/superadmin
async function checkAdminAccess() {
    try {
        const res = await fetch('/api/auth/sesion');
        const data = await res.json();
        if (data.autenticado && (data.usuario.rol === 'admin' || data.usuario.rol === 'superadmin' || data.usuario.is_superadmin)) {
            var link = document.getElementById('adminLink');
            if (link) link.style.display = '';
        }
    } catch(e) { /* ignora */ }
}

// Función global para cerrar sesión
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
                // Si hay error, igual redirigir pero forcing logout
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

// Inicializar cuando el DOM esté listo
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initDrawer);
} else {
    // Ejecutar inmediatamente si el DOM ya está listo
    setTimeout(initDrawer, 0);
}
