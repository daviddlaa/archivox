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
    
    // Agregar evento de teclado
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            Drawer.close();
        }
    });
}

// Crear drawer dinámicamente si no existe en HTML
function crearDrawerDinamico() {
    var drawerDiv = document.createElement('div');
    drawerDiv.id = 'drawer-wrapper';
    drawerDiv.innerHTML = `
        <button id="drawer-toggle" class="drawer-toggle" onclick="Drawer.toggle()">☰</button>
        <div id="drawer-overlay" class="drawer-overlay" onclick="Drawer.close()"></div>
        <aside id="drawer" class="drawer">
            <div class="drawer-header">
                <div class="drawer-logo"><h2>📊 Archivox</h2></div>
<button class="drawer-close" onclick="Drawer.close()">✕</button>
            </div>
            <nav class="drawer-nav">
                <a href="/" class="drawer-link">📊 Dashboard</a>
                <a href="/equipo-ventas" class="drawer-link">💰 Control de Ventas</a>
                <a href="/importar" class="drawer-link">📤 Importar Excel</a>
                <a href="/solicitudes" class="drawer-link">📋 Solicitudes</a>
                <a href="/gestiones" class="drawer-link">📝 Gestiones</a>
                <a href="/historial" class="drawer-link">🔄 Historial</a>
                <a href="#" class="drawer-link drawer-link-logout" onclick="cerrarSesion()">🚪 Cerrar Sesión</a>
            </nav>
        </aside>
    `;
    
    if (document.body) {
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

// Función global para cerrar sesión
function cerrarSesion() {
    if (confirm('¿Estás seguro de cerrar sesión?')) {
        fetch('/auth/logout', { method: 'POST', credentials: 'include' })
            .then(function() { window.location.href = '/login'; })
            .catch(function() { window.location.href = '/login'; });
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
