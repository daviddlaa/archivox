/**
 * Drawer Unificado — Archivox
 * Funciona en escritorio y móvil con una API única: Drawer.open/close/toggle
 * 
 * - Escritorio: botón flotante ☰ + overlay + drawer desde la izquierda
 * - Móvil:    sin botón flotante (usa botones de la página), bloquea scroll
 * - Menú con secciones agrupadas (Inicio, Operaciones, Cuenta)
 * - Detección automática de rol admin
 */

(function() {
    'use strict';

    /* ───────── helpers ───────── */
    function isMobile() {
        return window.innerWidth < 769;
    }

    function esPaginaAdmin() {
        var p = window.location.pathname;
        return p === '/admin' || p === '/m/admin' || p.startsWith('/admin/');
    }

    /* ───────── construcción del HTML del drawer ───────── */
    function getNavHTML() {
        var admin = esPaginaAdmin();

        if (admin) {
            return `
                <div class="drawer-section">
                    <h3>Administración</h3>
                    <ul class="drawer-menu">
                        <li><a href="/admin" class="drawer-link"><span class="drawer-menu-icon">📊</span>Dashboard</a></li>
                        <li><a href="#" class="drawer-link" onclick="cambiarTab('usuarios'); Drawer.close(); return false;"><span class="drawer-menu-icon">👥</span>Usuarios</a></li>
                        <li><a href="#" class="drawer-link" onclick="cambiarTab('estadisticas'); Drawer.close(); return false;"><span class="drawer-menu-icon">📊</span>Estadísticas</a></li>
                        <li><a href="#" class="drawer-link" onclick="cambiarTab('auditoria'); Drawer.close(); return false;"><span class="drawer-menu-icon">📋</span>Auditoría</a></li>
                        <li><a href="#" class="drawer-link" onclick="cambiarTab('notificaciones'); Drawer.close(); return false;"><span class="drawer-menu-icon">🔔</span>Notificaciones</a></li>
                    </ul>
                </div>
                <div class="drawer-section drawer-section-last">
                    <h3>Cuenta</h3>
                    <ul class="drawer-menu">
                        <li><a href="/" class="drawer-link"><span class="drawer-menu-icon">🏠</span>Volver al Sistema</a></li>
                        <li class="drawer-menu-logout"><a href="#" onclick="cerrarSesion()" class="drawer-link"><span class="drawer-menu-icon">🚪</span>Cerrar Sesión</a></li>
                    </ul>
                </div>`;
        }

        return `
            <div class="drawer-section">
                <h3>Inicio</h3>
                <ul class="drawer-menu">
                    <li><a href="/" class="drawer-link"><span class="drawer-menu-icon">📊</span>Dashboard</a></li>
                    <li><a href="/perfil" class="drawer-link"><span class="drawer-menu-icon">👤</span>Mi Perfil</a></li>
                    <li><a href="/equipo-ventas" class="drawer-link"><span class="drawer-menu-icon">💰</span>Control de Ventas</a></li>
                </ul>
            </div>
            <div class="drawer-section">
                <h3>Operaciones</h3>
                <ul class="drawer-menu">
                    <li><a href="/importar" class="drawer-link"><span class="drawer-menu-icon">📤</span>Importar Excel</a></li>
                    <li><a href="/solicitudes" class="drawer-link"><span class="drawer-menu-icon">📋</span>Solicitudes</a></li>
                    <li><a href="/gestiones" class="drawer-link"><span class="drawer-menu-icon">📝</span>Gestiones</a></li>
                    <li><a href="/gestion-lote" class="drawer-link"><span class="drawer-menu-icon">🚀</span>Campañas</a></li>
                    <li><a href="/relaciones" class="drawer-link"><span class="drawer-menu-icon">📋</span>Relaciones</a></li>
                    <li><a href="/historial" class="drawer-link"><span class="drawer-menu-icon">🔄</span>Historial</a></li>
                </ul>
            </div>
            <div class="drawer-section drawer-section-last">
                <h3>Cuenta</h3>
                <ul class="drawer-menu">
                    <li><a href="/admin" class="drawer-link" id="adminLink" style="display:none"><span class="drawer-menu-icon">🛡️</span>Admin</a></li>
                    <li class="drawer-menu-logout"><a href="#" onclick="cerrarSesion()" class="drawer-link"><span class="drawer-menu-icon">🚪</span>Cerrar Sesión</a></li>
                </ul>
            </div>`;
    }

    function buildDrawerHTML() {
        var mob = isMobile();

        var html = '';
        // Floating toggle solo en desktop
        if (!mob) {
            html += '<button id="drawer-toggle" class="drawer-toggle" onclick="Drawer.toggle()">☰</button>';
        }
        html += '<div id="drawer-overlay" class="drawer-overlay" onclick="Drawer.close()"></div>';
        html += '<aside id="drawer" class="drawer">';
        html += '  <div class="drawer-header">';
        html += '    <div class="drawer-logo"><h2>' + (esPaginaAdmin() ? '🛡️ Admin' : '📊 Archivox') + '</h2></div>';
        html += '    <button class="drawer-close" onclick="Drawer.close()">✕</button>';
        html += '  </div>';
        html += getNavHTML();
        html += '</aside>';

        return html;
    }

    /* ───────── drawer lifecycle ───────── */
    function initDrawer() {
        var wrapper = document.getElementById('drawer-wrapper');

        // Si no existe wrapper, lo creamos al inicio del body
        if (!wrapper) {
            wrapper = document.createElement('div');
            wrapper.id = 'drawer-wrapper';
            document.body.insertBefore(wrapper, document.body.firstChild);
        }

        wrapper.innerHTML = buildDrawerHTML();

        // Keyboard: Escape cierra
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape') Drawer.close();
        });

        // Resize: recrear toggle cuando cambia entre desktop/mobile
        var resizeTimer;
        window.addEventListener('resize', function() {
            clearTimeout(resizeTimer);
            resizeTimer = setTimeout(function() {
                var newMob = window.innerWidth < 769;
                var toggle = document.getElementById('drawer-toggle');
                if (newMob && toggle) {
                    toggle.remove();
                } else if (!newMob && !toggle) {
                    // Re-crear toggle si hace falta
                    var existingWrapper = document.getElementById('drawer-wrapper');
                    if (existingWrapper) {
                        var btn = document.createElement('button');
                        btn.id = 'drawer-toggle';
                        btn.className = 'drawer-toggle';
                        btn.onclick = function() { Drawer.toggle(); };
                        btn.textContent = '☰';
                        existingWrapper.insertBefore(btn, existingWrapper.firstChild);
                    }
                }
            }, 300);
        });

        // Admin access check
        checkAdminAccess();
    }

    /* ───────── API pública ───────── */
    window.Drawer = {
        isOpen: false,

        toggle: function() {
            if (this.isOpen) { this.close(); } else { this.open(); }
        },

        open: function() {
            var drawer = document.getElementById('drawer');
            var overlay = document.getElementById('drawer-overlay');
            if (!drawer || !overlay) return;

            drawer.classList.add('open');
            overlay.classList.add('open');
            this.isOpen = true;

            // Scroll lock solo en móvil
            if (isMobile()) {
                document.body.style.overflow = 'hidden';
            }

            // Ocultar toggle flotante cuando el drawer está abierto (desktop)
            var toggle = document.getElementById('drawer-toggle');
            if (toggle) toggle.classList.add('hidden');
        },

        close: function() {
            var drawer = document.getElementById('drawer');
            var overlay = document.getElementById('drawer-overlay');
            if (!drawer || !overlay) return;

            drawer.classList.remove('open');
            overlay.classList.remove('open');
            this.isOpen = false;

            // Restaurar scroll
            document.body.style.overflow = '';

            // Mostrar toggle flotante de nuevo
            var toggle = document.getElementById('drawer-toggle');
            if (toggle) toggle.classList.remove('hidden');
        }
    };

    /* ───────── admin access ───────── */
    async function checkAdminAccess() {
        try {
            var res = await fetch('/api/auth/sesion');
            var data = await res.json();
            if (data.autenticado && (data.usuario.rol === 'admin' || data.usuario.rol === 'superadmin' || data.usuario.is_superadmin)) {
                var link = document.getElementById('adminLink');
                if (link) link.style.display = '';
            }
        } catch(e) { /* ignore */ }
    }

    /* ───────── cerrar sesión (global) ───────── */
    window.cerrarSesion = function() {
        if (confirm('¿Estás seguro de cerrar sesión?')) {
            sessionStorage.setItem('justLoggedOut', Date.now().toString());
            fetch('/auth/logout', { method: 'POST', credentials: 'include' })
                .then(function(r) { window.location.href = '/login'; })
                .catch(function() { window.location.href = '/login'; });
        }
        return false;
    };

    /* ───────── arranque ───────── */
    function boot() {
        initDrawer();
        // Auto-iniciar notificaciones
        if (typeof initNotificaciones === 'function') {
            initNotificaciones();
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot);
    } else {
        setTimeout(boot, 0);
    }

})();
