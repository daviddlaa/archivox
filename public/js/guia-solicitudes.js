// ============================================================================
// GUÍA DE SOLICITUDES — Tour interactivo (Desktop & Móvil)
// ============================================================================
// Se muestra una sola vez por usuario al entrar a la página de Solicitudes.
// Persistencia: localStorage key = guia_solicitudes_v1_<usuarioId>
//
// Uso:
//   mostrarGuiaSolicitudesSiPrimeraVez({ usuarioId })
// Devuelve true si la mostró (primera vez) o false si ya se vio.
// ============================================================================
(function() {
    'use strict';

    var CLAVE_GUIA = 'guia_solicitudes_v1';

    function clavePorUsuario(usuarioId) {
        return CLAVE_GUIA + '_' + (usuarioId ? String(usuarioId) : 'anon');
    }

    function fueVista(usuarioId) {
        try {
            return localStorage.getItem(clavePorUsuario(usuarioId)) === '1';
        } catch (e) {
            return true; // Sin almacenamiento: no insistir
        }
    }

    function marcarVista(usuarioId) {
        try {
            localStorage.setItem(clavePorUsuario(usuarioId), '1');
        } catch (e) { /* ignore */ }
    }

    function escapar(texto) {
        return String(texto || '')
            .replace(/&/g, '&amp;')
            .replace(/"/g, '&quot;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    }

    // ==========================================================================
    // Definición de pasos del tour
    // ==========================================================================
    function getPasos() {
        return [
            {
                icono: '👋',
                titulo: '¡Bienvenido a Solicitudes!',
                texto: 'Esta es tu pantalla principal de trabajo. Aquí puedes ver, filtrar y gestionar todas las solicitudes importadas. Te mostramos las partes más importantes.',
                ejemplo: ''
            },
            {
                icono: '📊',
                titulo: 'Indicadores (KPIs)',
                texto: 'En la parte superior ves tres números clave: el total de solicitudes, cuántas estás viendo ahora, y cuántas tienes seleccionadas. Te dan un resumen rápido sin buscar.',
                ejemplo: 'Total · Mostrando · Seleccionadas'
            },
            {
                icono: '🔍',
                titulo: 'Búsqueda rápida',
                texto: 'Escribe en la barra de búsqueda para encontrar una solicitud por su ID, cédula, nombre o teléfono. Los resultados se filtran al instante.',
                ejemplo: 'Ej: "12345" o "María"'
            },
            {
                icono: '🎯',
                titulo: 'Filtros inteligentes',
                texto: 'Usa los filtros para afinar tu búsqueda: por estado (aprobada, pendiente, etc.), segmento, campaña, rango de fecha y vendedor. Puedes combinar varios filtros.',
                ejemplo: '📌 Estado  🏷️ Segmento  🚀 Campaña'
            },
            {
                icono: '🗂️',
                titulo: 'Vista Tarjeta o Tabla',
                texto: 'Alterna entre vista de tarjetas (ideal para revisar rápido) y vista de tabla (ideal para comparar muchos datos). Elige la que más te guste con los botones 🗂️ y 📋.',
                ejemplo: ''
            },
            {
                icono: '🚀',
                titulo: 'Seleccionar y crear campañas',
                texto: 'Selecciona una o varias solicitudes y usa la barra de acciones para crear una nueva campaña o agregarlas a una existente. ¡Así de fácil empiezas a trabajar!',
                ejemplo: 'Seleccionar todo → Crear campaña'
            }
        ];
    }

    // ==========================================================================
    // Estado del tour
    // ==========================================================================
    var pasoActual = 0;
    var pasos = [];
    var usuarioId = null;
    var overlay = null;

    // ==========================================================================
    // Renderizado
    // ==========================================================================
    function renderPaso() {
        var paso = pasos[pasoActual];
        var total = pasos.length;
        var progreso = ((pasoActual + 1) / total) * 100;

        var html = '';
        html += '<div class="guia-solicitudes">';

        // Header solo en el primer paso
        if (pasoActual === 0) {
            html += '<div class="guia-sol-header">';
            html += '<span class="guia-sol-icon">📋</span>';
            html += '<h2>Tour de Solicitudes</h2>';
            html += '<p>Te explicamos brevemente cómo funciona esta página.</p>';
            html += '</div>';
        }

        // Barra de progreso
        html += '<div class="guia-sol-progress">';
        html += '<div class="guia-sol-progress-bar" style="width:' + progreso + '%"></div>';
        html += '</div>';

        // Paso actual
        html += '<div class="guia-sol-paso guia-sol-paso-animado" key="' + pasoActual + '">';
        html += '<span class="guia-sol-paso-icono">' + paso.icono + '</span>';
        html += '<h3 class="guia-sol-paso-titulo">' + paso.titulo + '</h3>';
        html += '<p class="guia-sol-paso-texto">' + paso.texto + '</p>';
        if (paso.ejemplo) {
            html += '<span class="guia-sol-paso-ejemplo">' + paso.ejemplo + '</span>';
        }
        html += '</div>';

        // Dots indicadores
        html += '<div class="guia-sol-dots">';
        for (var i = 0; i < total; i++) {
            var cls = 'guia-sol-dot';
            if (i === pasoActual) cls += ' active';
            else if (i < pasoActual) cls += ' visited';
            html += '<button type="button" class="' + cls + '" onclick="window._guiaSolicitudes.irAPaso(' + i + ')" title="Paso ' + (i + 1) + '"></button>';
        }
        html += '</div>';

        // Botones de navegación
        html += '<div class="guia-sol-botones">';
        if (pasoActual > 0) {
            html += '<button type="button" class="guia-sol-btn guia-sol-btn-prev" onclick="window._guiaSolicitudes.prev()">← Atrás</button>';
        }
        if (pasoActual < total - 1) {
            html += '<button type="button" class="guia-sol-btn guia-sol-btn-skip" onclick="window._guiaSolicitudes.cerrar()">Saltar</button>';
            html += '<button type="button" class="guia-sol-btn guia-sol-btn-next" onclick="window._guiaSolicitudes.next()">Siguiente →</button>';
        } else {
            html += '<button type="button" class="guia-sol-btn guia-sol-btn-finish" onclick="window._guiaSolicitudes.cerrar()">👍 ¡Entendido!</button>';
        }
        html += '</div>';

        // Footer
        html += '<div class="guia-sol-footer">Paso ' + (pasoActual + 1) + ' de ' + total + '</div>';

        html += '</div>';

        return html;
    }

    function actualizarOverlay() {
        if (!overlay) return;
        var content = overlay.querySelector('.modal-content');
        if (content) {
            content.innerHTML = renderPaso();
        }
    }

    // ==========================================================================
    // Navegación
    // ==========================================================================
    function next() {
        if (pasoActual < pasos.length - 1) {
            pasoActual++;
            actualizarOverlay();
        }
    }

    function prev() {
        if (pasoActual > 0) {
            pasoActual--;
            actualizarOverlay();
        }
    }

    function irAPaso(idx) {
        if (idx >= 0 && idx < pasos.length) {
            pasoActual = idx;
            actualizarOverlay();
        }
    }

    function cerrar() {
        marcarVista(usuarioId);
        if (typeof Modal !== 'undefined' && Modal.cerrar) {
            Modal.cerrar();
        } else if (typeof cerrarModal === 'function') {
            cerrarModal();
        }
        overlay = null;
    }

    // ==========================================================================
    // API pública
    // ==========================================================================
    window.mostrarGuiaSolicitudesSiPrimeraVez = function(opts) {
        opts = opts || {};
        usuarioId = opts.usuarioId || null;

        if (fueVista(usuarioId)) return false;

        pasos = getPasos();
        pasoActual = 0;

        var html = renderPaso();

        if (typeof Modal !== 'undefined' && Modal.abrir) {
            overlay = Modal.abrir(html, { ancho: 'narrow' });
        } else if (typeof crearModal === 'function') {
            overlay = crearModal(html);
        } else {
            marcarVista(usuarioId);
            return false;
        }

        return true;
    };

    // Funciones de navegación como API interna
    window._guiaSolicitudes = {
        next: next,
        prev: prev,
        irAPaso: irAPaso,
        cerrar: cerrar
    };
})();
