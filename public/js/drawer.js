/**
 * Drawer Unificado — Archivox
 * 
 * - DESKTOP: botón flotante ☰ + overlay + drawer desde la izquierda
 * - MÓVIL:   NO crea el drawer (cero HTML, cero memoria).
 *            Reemplazado por MobileMenu (bottom sheet nativo)
 *            que se crea bajo demanda y se destruye al cerrar.
 * 
 * API unificada: Drawer.open / Drawer.close / Drawer.toggle
 * funciona en ambas plataformas de forma transparente.
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

    /* ======================================================================
       MENÚ MÓVIL — Bottom Sheet nativo (cero dependencias)
       ======================================================================
       Se crea bajo demanda cuando el usuario toca "Menú"
       y se destruye completamente al cerrar.
       NO ocupa memoria mientras está cerrado.
    ====================================================================== */
    var MobileMenu = {
        isOpen: false,

        /* ─── build nav items ─── */
        _getItems: function() {
            if (esPaginaAdmin()) {
                return [
                    { icon: '📊', label: 'Dashboard', href: '/m/admin' },
                    null, // separator
                    { icon: '🏠', label: 'Volver al Sistema', href: '/' },
                    { icon: '🚪', label: 'Cerrar Sesión', action: 'cerrarSesion', danger: true },
                ];
            }
            return [
                { icon: '📊', label: 'Inicio', href: '/m' },
                { icon: '👤', label: 'Mi Perfil', href: '/perfil' },
                { icon: '💰', label: 'Ventas', href: '/m/ventas' },
                null, // separator
                { icon: '📤', label: 'Importar Excel', href: '/m/importar' },
                { icon: '📋', label: 'Solicitudes', href: '/m/solicitudes' },
                { icon: '📝', label: 'Gestiones', href: '/m/gestiones' },
                { icon: '🚀', label: 'Campañas', href: '/m/gestion-lote' },
                { icon: '📋', label: 'Relaciones', href: '/m/relaciones' },
                { icon: '🔄', label: 'Historial', href: '/m/historial' },
                null, // separator
                { icon: '🛡️', label: 'Admin', href: '/admin', adminOnly: true },
                { icon: '🚪', label: 'Cerrar Sesión', action: 'cerrarSesion', danger: true },
            ];
        },

        _buildHTML: function() {
            var items = this._getItems();
            var navHTML = '';
            for (var i = 0; i < items.length; i++) {
                var item = items[i];
                if (item === null) {
                    navHTML += '<div class="mm-divider"></div>';
                    continue;
                }
                if (item.adminOnly) {
                    navHTML += '<a class="mm-item mm-item-admin" id="mm-admin-link" style="display:none" href="' + item.href + '" onclick="MobileMenu.close()">' +
                        '<span class="mm-item-icon">' + item.icon + '</span>' +
                        '<span class="mm-item-label">' + item.label + '</span>' +
                        '</a>';
                    continue;
                }
                if (item.action === 'cerrarSesion') {
                    navHTML += '<a class="mm-item mm-item-danger" href="#" onclick="event.preventDefault(); cerrarSesion(); MobileMenu.close()">' +
                        '<span class="mm-item-icon">' + item.icon + '</span>' +
                        '<span class="mm-item-label">' + item.label + '</span>' +
                        '</a>';
                    continue;
                }
                navHTML += '<a class="mm-item' + (item.danger ? ' mm-item-danger' : '') + '" href="' + item.href + '" onclick="MobileMenu.close()">' +
                    '<span class="mm-item-icon">' + item.icon + '</span>' +
                    '<span class="mm-item-label">' + item.label + '</span>' +
                    '</a>';
            }

            return '' +
                '<div id="mm-overlay" class="mm-overlay" onclick="MobileMenu.close()"></div>' +
                '<div id="mm-sheet" class="mm-sheet" role="dialog" aria-label="Menú de navegación">' +
                    '<div class="mm-handle"></div>' +
                    '<div class="mm-header">' +
                        '<span class="mm-header-title">📊 Archivox</span>' +
                        '<button class="mm-close" onclick="MobileMenu.close()" aria-label="Cerrar menú">✕</button>' +
                    '</div>' +
                    '<div class="mm-body">' +
                        navHTML +
                    '</div>' +
                '</div>';
        },

        open: function() {
            if (this.isOpen) return;

            // Crear wrapper si no existe
            var wrapper = document.getElementById('drawer-wrapper');
            if (!wrapper) {
                wrapper = document.createElement('div');
                wrapper.id = 'drawer-wrapper';
                document.body.insertBefore(wrapper, document.body.firstChild);
            }

            wrapper.innerHTML = this._buildHTML();
            this.isOpen = true;

            // Scroll lock en body
            document.body.style.overflow = 'hidden';

            // Animar entrada: overlay fade, sheet slide up
            requestAnimationFrame(function() {
                var overlay = document.getElementById('mm-overlay');
                var sheet = document.getElementById('mm-sheet');
                if (overlay) overlay.classList.add('visible');
                if (sheet) sheet.classList.add('visible');
            });

            // Verificar acceso admin
            this._checkAdmin();

            // Keyboard escape
            this._keyHandler = function(e) {
                if (e.key === 'Escape') MobileMenu.close();
            };
            document.addEventListener('keydown', this._keyHandler);
        },

        close: function() {
            if (!this.isOpen) return;

            var overlay = document.getElementById('mm-overlay');
            var sheet = document.getElementById('mm-sheet');

            if (overlay) overlay.classList.remove('visible');
            if (sheet) sheet.classList.remove('visible');

            // Restaurar scroll
            document.body.style.overflow = '';
            this.isOpen = false;

            // Eliminar del DOM después de la animación
            var self = this;
            setTimeout(function() {
                var wrapper = document.getElementById('drawer-wrapper');
                if (wrapper && !document.querySelector('#drawer-wrapper .drawer, #drawer-wrapper .mm-sheet')) {
                    wrapper.innerHTML = '';
                }
                if (self._keyHandler) {
                    document.removeEventListener('keydown', self._keyHandler);
                    self._keyHandler = null;
                }
            }, 250);
        },

        toggle: function() {
            if (this.isOpen) { this.close(); } else { this.open(); }
        },

        _checkAdmin: function() {
            fetch('/api/auth/sesion')
                .then(function(r) { return r.json(); })
                .then(function(data) {
                    if (data.autenticado && (data.usuario.rol === 'admin' || data.usuario.rol === 'superadmin' || data.usuario.is_superadmin)) {
                        var link = document.getElementById('mm-admin-link');
                        if (link) link.style.display = '';
                    }
                })
                .catch(function() {});
        }
    };

    /* ======================================================================
       DRAWER DE ESCRITORIO (inalterado)
    ====================================================================== */
    function getNavHTML() {
        var admin = esPaginaAdmin();

        if (admin) {
            return '' +
                '<div class="drawer-section">' +
                    '<h3>Administración</h3>' +
                    '<ul class="drawer-menu">' +
                        '<li><a href="/admin" class="drawer-link"><span class="drawer-menu-icon">📊</span>Dashboard</a></li>' +
                        '<li><a href="#" class="drawer-link" onclick="cambiarTab(\'usuarios\'); Drawer.close(); return false;"><span class="drawer-menu-icon">👥</span>Usuarios</a></li>' +
                        '<li><a href="#" class="drawer-link" onclick="cambiarTab(\'estadisticas\'); Drawer.close(); return false;"><span class="drawer-menu-icon">📊</span>Estadísticas</a></li>' +
                        '<li><a href="#" class="drawer-link" onclick="cambiarTab(\'auditoria\'); Drawer.close(); return false;"><span class="drawer-menu-icon">📋</span>Auditoría</a></li>' +
                        '<li><a href="#" class="drawer-link" onclick="cambiarTab(\'notificaciones\'); Drawer.close(); return false;"><span class="drawer-menu-icon">🔔</span>Notificaciones</a></li>' +
                    '</ul>' +
                '</div>' +
                '<div class="drawer-section drawer-section-last">' +
                    '<h3>Cuenta</h3>' +
                    '<ul class="drawer-menu">' +
                        '<li><a href="/" class="drawer-link"><span class="drawer-menu-icon">🏠</span>Volver al Sistema</a></li>' +
                        '<li class="drawer-menu-logout"><a href="#" onclick="cerrarSesion()" class="drawer-link"><span class="drawer-menu-icon">🚪</span>Cerrar Sesión</a></li>' +
                    '</ul>' +
                '</div>';
        }

        return '' +
            '<div class="drawer-section">' +
                '<h3>Inicio</h3>' +
                '<ul class="drawer-menu">' +
                    '<li><a href="/" class="drawer-link"><span class="drawer-menu-icon">📊</span>Dashboard</a></li>' +
                    '<li><a href="/perfil" class="drawer-link"><span class="drawer-menu-icon">👤</span>Mi Perfil</a></li>' +
                    '<li><a href="/equipo-ventas" class="drawer-link"><span class="drawer-menu-icon">💰</span>Control de Ventas</a></li>' +
                '</ul>' +
            '</div>' +
            '<div class="drawer-section">' +
                '<h3>Operaciones</h3>' +
                '<ul class="drawer-menu">' +
                    '<li><a href="/importar" class="drawer-link"><span class="drawer-menu-icon">📤</span>Importar Excel</a></li>' +
                    '<li><a href="/solicitudes" class="drawer-link"><span class="drawer-menu-icon">📋</span>Solicitudes</a></li>' +
                    '<li><a href="/gestiones" class="drawer-link"><span class="drawer-menu-icon">📝</span>Gestiones</a></li>' +
                    '<li><a href="/gestion-lote" class="drawer-link"><span class="drawer-menu-icon">🚀</span>Campañas</a></li>' +
                    '<li><a href="/relaciones" class="drawer-link"><span class="drawer-menu-icon">📋</span>Relaciones</a></li>' +
                    '<li><a href="/historial" class="drawer-link"><span class="drawer-menu-icon">🔄</span>Historial</a></li>' +
                '</ul>' +
            '</div>' +
            '<div class="drawer-section drawer-section-last">' +
                '<h3>Cuenta</h3>' +
                '<ul class="drawer-menu">' +
                    '<li><a href="/admin" class="drawer-link" id="adminLink" style="display:none"><span class="drawer-menu-icon">🛡️</span>Admin</a></li>' +
                    '<li class="drawer-menu-logout"><a href="#" onclick="cerrarSesion()" class="drawer-link"><span class="drawer-menu-icon">🚪</span>Cerrar Sesión</a></li>' +
                '</ul>' +
            '</div>';
    }

    function buildDrawerHTML() {
        return '' +
            '<button id="drawer-toggle" class="drawer-toggle" onclick="Drawer.toggle()">☰</button>' +
            '<div id="drawer-overlay" class="drawer-overlay" onclick="Drawer.close()"></div>' +
            '<aside id="drawer" class="drawer">' +
                '<div class="drawer-header">' +
                    '<div class="drawer-logo"><h2>' + (esPaginaAdmin() ? '🛡️ Admin' : '📊 Archivox') + '</h2></div>' +
                    '<button class="drawer-close" onclick="Drawer.close()">✕</button>' +
                '</div>' +
                getNavHTML() +
            '</aside>';
    }

    /* ───────── drawer lifecycle (solo desktop) ───────── */
    function initDesktopDrawer() {
        var wrapper = document.getElementById('drawer-wrapper');
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

        // Resize: ocultar toggle al pasar a tamaño móvil (solo desktop)
        var resizeTimer;
        window.addEventListener('resize', function() {
            clearTimeout(resizeTimer);
            resizeTimer = setTimeout(function() {
                if (window.innerWidth < 769) {
                    var toggle = document.getElementById('drawer-toggle');
                    if (toggle) toggle.style.display = 'none';
                } else {
                    var toggle = document.getElementById('drawer-toggle');
                    if (toggle) toggle.style.display = '';
                }
            }, 300);
        });

        // Admin access check
        checkAdminAccess();
    }

    /* ───────── API pública unificada ───────── */
    var esMobile = isMobile();

    if (esMobile) {
        // ─── MÓVIL: MobileMenu ligero ───
        window.MobileMenu = MobileMenu;
        window.Drawer = {
            isOpen: false,
            open: function() { MobileMenu.open(); this.isOpen = MobileMenu.isOpen; },
            close: function() { MobileMenu.close(); this.isOpen = MobileMenu.isOpen; },
            toggle: function() { MobileMenu.toggle(); this.isOpen = MobileMenu.isOpen; }
        };
    } else {
        // ─── DESKTOP: Drawer completo ───
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

                // Ocultar toggle flotante cuando el drawer está abierto
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

                // Mostrar toggle flotante de nuevo
                var toggle = document.getElementById('drawer-toggle');
                if (toggle) toggle.classList.remove('hidden');
            }
        };
    }

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
        // En móvil: NO crear nada. En desktop: crear el drawer.
        if (!isMobile()) {
            initDesktopDrawer();
        }

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
