// ============================================================================
// DEEP LINK ROUTER - Sistema centralizado de resolución de rutas
// ============================================================================
// ARCHIVOX - Arquitectura de Deep Links Multiplataforma
//
// Propósito:
//   Desacoplar la intención del usuario (módulo) de la URL específica de cada
//   plataforma (Desktop, Mobile, futuras). Cada frontend resuelve la URL
//   correcta según su propia plataforma.
//
// Uso:
//   DeepLinkRouter.resolver('solicitudes')        → '/solicitudes' (Desktop)
//   DeepLinkRouter.resolver('solicitudes', true)   → '/m/solicitudes' (Mobile)
//   DeepLinkRouter.resolver('solicitudes', null, true) → siempre Desktop
//   DeepLinkRouter.resolverUrl(notif.accion_modulo) → URL según plataforma
//   DeepLinkRouter.resolverUrl(notif.accion_url)   → compatibilidad hacia atrás
//
// Tabla de módulos:
//   Cada módulo tiene rutas para Desktop, Mobile y Admin.
//   Agregar nuevos módulos aquí para que estén disponibles en todas las
//   plataformas sin modificar el panel de administración.
// ============================================================================

(function(global) {
    'use strict';

    // ========================================================================
    // CONFIGURACIÓN CENTRALIZADA DE MÓDULOS
    // ========================================================================
    // Cada módulo define:
    //   id:      Identificador único del módulo
    //   label:   Etiqueta visible en el selector del admin
    //   icon:    Emoji representativo
    //   rutas:   Objeto con las rutas para cada plataforma
    //     desktop: Ruta para la versión Desktop
    //     mobile:  Ruta para la versión Mobile
    //     admin:   Ruta para la versión Admin (opcional, default: desktop)
    //   adminOnly: Si es true, solo visible para admins en el selector
    // ========================================================================
    var MODULOS = [
        { id: 'dashboard',      label: 'Dashboard',          icon: '🏠', rutas: { desktop: '/',          mobile: '/m' } },
        { id: 'dashboard-admin', label: 'Dashboard (Admin)', icon: '📊', rutas: { desktop: '/admin',     mobile: '/m/admin' }, adminOnly: true },
        { id: 'solicitudes',    label: 'Solicitudes',        icon: '📋', rutas: { desktop: '/solicitudes',  mobile: '/m/solicitudes' } },
        { id: 'importar',       label: 'Importar Excel',     icon: '📤', rutas: { desktop: '/importar',     mobile: '/m/importar' } },
        { id: 'historial',      label: 'Historial',          icon: '🔄', rutas: { desktop: '/historial',    mobile: '/m/historial' } },
        { id: 'gestiones',      label: 'Gestiones',          icon: '📝', rutas: { desktop: '/gestiones',    mobile: '/m/gestiones' } },
        { id: 'gestion-lote',   label: 'Gestión por Lotes',  icon: '🚀', rutas: { desktop: '/gestion-lote', mobile: '/m/gestion-lote' } },
        { id: 'relaciones',     label: 'Relaciones',         icon: '📋', rutas: { desktop: '/relaciones',   mobile: '/m/relaciones' } },
        { id: 'ventas',         label: 'Control de Ventas',  icon: '💰', rutas: { desktop: '/equipo-ventas', mobile: '/m/ventas' } },
        { id: 'perfil',         label: 'Perfil',             icon: '👤', rutas: { desktop: '/perfil',        mobile: '/perfil' } },
        { id: 'perfil-config',  label: 'Perfil (Config)',    icon: '⚙️', rutas: { desktop: '/perfil?tab=config', mobile: '/perfil?tab=config' } },
        { id: 'perfil-ayuda',   label: 'Ayuda / Tutoriales', icon: '❓', rutas: { desktop: '/perfil?tab=ayuda',   mobile: '/perfil?tab=ayuda' } },
    ];

    // Cache de módulos por ID para búsqueda rápida
    var MODULOS_POR_ID = {};
    MODULOS.forEach(function(m) { MODULOS_POR_ID[m.id] = m; });

    // ========================================================================
    // DETECCIÓN DE PLATAFORMA
    // ========================================================================
    function esPlataformaMobile() {
        // Detección por URL: si la ruta empieza con /m/, estamos en mobile
        if (window.location.pathname.startsWith('/m/') || window.location.pathname === '/m') {
            return true;
        }
        // Detección por user-agent (fallback)
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    }

    function esPaginaAdmin() {
        var p = window.location.pathname;
        return p === '/admin' || p === '/m/admin' || p.startsWith('/admin/');
    }

    // ========================================================================
    // API PÚBLICA
    // ========================================================================
    var DeepLinkRouter = {
        // --------------------------------------------------------------------
        // Obtener la lista completa de módulos (para el selector admin)
        // --------------------------------------------------------------------
        getModulos: function(opts) {
            opts = opts || {};
            var incluirAdmin = opts.incluirAdmin || false;
            if (incluirAdmin) {
                return MODULOS;
            }
            return MODULOS.filter(function(m) { return !m.adminOnly; });
        },

        // --------------------------------------------------------------------
        // Obtener un módulo por su ID
        // --------------------------------------------------------------------
        getModulo: function(moduloId) {
            return MODULOS_POR_ID[moduloId] || null;
        },

        // --------------------------------------------------------------------
        // Resolver un módulo → URL según la plataforma actual
        // --------------------------------------------------------------------
        // Uso:
        //   DeepLinkRouter.resolver('solicitudes')
        //     → detecta automáticamente la plataforma
        //   DeepLinkRouter.resolver('solicitudes', true)
        //     → fuerza Mobile
        //   DeepLinkRouter.resolver('solicitudes', false)
        //     → fuerza Desktop
        // --------------------------------------------------------------------
        resolver: function(moduloId, forzarMobile, forzarDesktop) {
            var modulo = MODULOS_POR_ID[moduloId];
            if (!modulo) {
                console.warn('[DeepLinkRouter] Módulo no encontrado:', moduloId);
                return null;
            }

            var rutas = modulo.rutas;

            // Determinar plataforma
            if (forzarMobile) {
                return rutas.mobile || rutas.desktop; // fallback a desktop
            }
            if (forzarDesktop) {
                return rutas.desktop;
            }

            // Detección automática
            var mobile = esPlataformaMobile();
            return mobile ? (rutas.mobile || rutas.desktop) : rutas.desktop;
        },

        // --------------------------------------------------------------------
        // Resolver la URL de navegación desde una notificación
        // --------------------------------------------------------------------
        // Prioridad:
        //   1. Si tiene accion_modulo, resolver según plataforma
        //   2. Si tiene accion_url (legacy), usar directamente (con advertencia)
        //   3. Si no tiene nada, retornar null
        // --------------------------------------------------------------------
        resolverUrl: function(notificacion) {
            if (!notificacion) return null;

            // ✅ NUEVO: Resolver por módulo lógico
            if (notificacion.accion_modulo) {
                var url = this.resolver(notificacion.accion_modulo);
                if (url) return url;
            }

            // 🔄 COMPATIBILIDAD HACIA ATRÁS: accion_url legacy
            if (notificacion.accion_url) {
                return notificacion.accion_url;
            }

            return null;
        },

        // --------------------------------------------------------------------
        // Obtener el texto de acción automático para un módulo
        // --------------------------------------------------------------------
        getTextoAccion: function(moduloId) {
            var modulo = MODULOS_POR_ID[moduloId];
            if (!modulo) return '';
            return 'Ir a ' + (modulo.icon ? modulo.icon + ' ' : '') + modulo.label;
        },

        // --------------------------------------------------------------------
        // Verificar si una URL pertenece a la plataforma incorrecta
        // --------------------------------------------------------------------
        esUrlDePlataformaIncorrecta: function(url) {
            if (!url) return false;
            var mobile = esPlataformaMobile();

            // Si estamos en mobile y la URL no tiene /m/, es incorrecta
            if (mobile && !url.startsWith('/m/') && url !== '/m') {
                // Excepciones: URLs que son iguales en ambas plataformas
                var rutasCompartidas = ['/perfil', '/admin', '/login'];
                if (rutasCompartidas.indexOf(url) !== -1) return false;
                return true;
            }

            // Si estamos en desktop y la URL tiene /m/, es incorrecta
            if (!mobile && (url.startsWith('/m/') || url === '/m')) {
                return true;
            }

            return false;
        },

        // --------------------------------------------------------------------
        // Extraer query string de una URL (todo después de ?)
        // --------------------------------------------------------------------
        _extraerQueryString: function(url) {
            var idx = url.indexOf('?');
            return idx !== -1 ? url.substring(idx) : '';
        },

        // --------------------------------------------------------------------
        // Corregir una URL legacy para que coincida con la plataforma actual
        // --------------------------------------------------------------------
        // Maneja:
        //   - URLs con query params (preserva ?param=value)
        //   - URLs sin query params
        //   - Si no encuentra el módulo, devuelve la URL original
        // --------------------------------------------------------------------
        corregirUrl: function(url) {
            if (!url) return url;
            var mobile = esPlataformaMobile();

            // Si la URL pertenece a la plataforma incorrecta, corregirla
            if (this.esUrlDePlataformaIncorrecta(url)) {
                // Extraer query params para preservarlos después de la corrección
                var queryStr = this._extraerQueryString(url);

                // Buscar el módulo por URL (comparar solo el pathname)
                for (var i = 0; i < MODULOS.length; i++) {
                    var m = MODULOS[i];
                    var r = m.rutas;

                    if (!mobile) {
                        // Estamos en Desktop, la URL está en formato Mobile
                        // Comparar pathname de url con r.mobile
                        if (r.mobile && (url === r.mobile || url.startsWith(r.mobile + '?'))) {
                            return r.desktop + queryStr;
                        }
                    } else {
                        // Estamos en Mobile, la URL está en formato Desktop
                        // Comparar pathname de url con r.desktop
                        if (r.desktop && (url === r.desktop || url.startsWith(r.desktop + '?'))) {
                            return (r.mobile || r.desktop) + queryStr;
                        }
                    }
                }
            }

            return url;
        }
    };

    // ========================================================================
    // EXPORTAR
    // ========================================================================
    global.DeepLinkRouter = DeepLinkRouter;

})(window);
