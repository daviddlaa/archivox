/**
 * Modal Compartido — Sistema unificado de ventanas modales
 * 
 * Reemplaza las implementaciones inline de crearModal/cerrarModal en:
 * - solicitudes.js
 * - gestion-lote.js
 * - relaciones.js
 * - gestiones.js
 * - admin.js (parcialmente)
 * - ventas.js (reemplazo de SweetAlert2)
 * 
 * Uso:
 *   Modal.abrir(htmlContent)
 *   Modal.abrirConfirm({ titulo, mensaje, icono, onConfirm })
 *   Modal.cerrar()
 *   Modal.abrirFormulario({ titulo, html, onGuardar })
 */
(function() {
    'use strict';

    /* --- Configuración --- */
    var ANIMACION_SALIDA_MS = 200;

    /* --- Variables de estado --- */
    var modalActual = null;
    var confirmCallback = null;

    /* --- Función principal: abrir modal --- */
    function abrir(contenidoHTML, opciones) {
        opciones = opciones || {};
        var ancho = opciones.ancho || ''; // 'wide', 'narrow', o ''

        // Cerrar modal existente si lo hay
        cerrar();

        var overlay = document.createElement('div');
        overlay.className = 'modal-overlay';

        var modal = document.createElement('div');
        modal.className = 'modal-content' + (ancho ? ' modal-content-' + ancho : '');
        modal.innerHTML = contenidoHTML;

        // Cerrar al hacer clic en overlay (fuera del contenido)
        overlay.addEventListener('click', function(e) {
            if (e.target === overlay) {
                cerrar();
            }
        });

        // Cerrar con Escape
        var escapeHandler = function(e) {
            if (e.key === 'Escape') {
                cerrar();
                document.removeEventListener('keydown', escapeHandler);
            }
        };
        // Guardar referencia para limpiar después
        overlay._escapeHandler = escapeHandler;

        overlay.appendChild(modal);
        document.body.appendChild(overlay);
        modalActual = overlay;

        // Focus trap: enfocar el primer input/botón dentro del modal
        setTimeout(function() {
            var focusable = modal.querySelector('input, select, textarea, button, a');
            if (focusable) focusable.focus();
        }, 100);

        return overlay;
    }

    /* --- Cerrar modal con animación --- */
    function cerrar() {
        if (!modalActual) return;

        // Prevenir doble cierre
        var overlay = modalActual;
        modalActual = null;

        document.removeEventListener('keydown', overlay._escapeHandler);

        // Animación de salida
        overlay.style.animation = 'modalOverlayOut ' + ANIMACION_SALIDA_MS + 'ms ease forwards';
        var content = overlay.querySelector('.modal-content');
        if (content) {
            content.style.animation = 'none';
            content.style.opacity = '0';
            content.style.transform = 'translateY(10px) scale(0.97)';
            content.style.transition = 'all ' + ANIMACION_SALIDA_MS + 'ms ease';
        }

        setTimeout(function() {
            if (overlay.parentNode) {
                overlay.parentNode.removeChild(overlay);
            }
        }, ANIMACION_SALIDA_MS);
    }

    /* --- Modal de confirmación --- */
    function abrirConfirm(opciones) {
        opciones = opciones || {};
        var titulo = opciones.titulo || '¿Está seguro?';
        var mensaje = opciones.mensaje || '';
        var icono = opciones.icono || '⚠️';
        var textoConfirmar = opciones.textoConfirmar || 'Confirmar';
        var textoCancelar = opciones.textoCancelar || 'Cancelar';
        var onConfirm = opciones.onConfirm || function() {};
        var tipo = opciones.tipo || 'primary'; // primary, danger, success

        var colorBtn = 'modal-btn-primary';
        if (tipo === 'danger') colorBtn = 'modal-btn-danger';
        else if (tipo === 'success') colorBtn = 'modal-btn-success';

        confirmCallback = onConfirm;

        var html = '' +
            '<div class="modal-confirm">' +
                '<div class="confirm-icon">' + icono + '</div>' +
                '<h2>' + titulo + '</h2>' +
                (mensaje ? '<p>' + mensaje + '</p>' : '') +
                '<div class="confirm-buttons">' +
                    '<button class="modal-btn modal-btn-cancel" onclick="Modal.cerrar()">' + textoCancelar + '</button>' +
                    '<button class="modal-btn ' + colorBtn + '" onclick="Modal._ejecutarConfirm()">' + textoConfirmar + '</button>' +
                '</div>' +
            '</div>';

        return abrir(html, { ancho: 'narrow' });
    }

    /* --- Ejecutar callback de confirmación --- */
    function ejecutarConfirm() {
        if (typeof confirmCallback === 'function') {
            confirmCallback();
            confirmCallback = null;
        }
        cerrar();
    }

    /* --- Modal de formulario simple --- */
    function abrirFormulario(opciones) {
        opciones = opciones || {};
        var titulo = opciones.titulo || 'Formulario';
        var htmlForm = opciones.html || '';
        var onGuardar = opciones.onGuardar || function() {};
        var textoGuardar = opciones.textoGuardar || '💾 Guardar';

        var html = '' +
            '<div class="modal-header">' +
                '<h2>' + titulo + '</h2>' +
                '<button class="modal-close-btn" onclick="Modal.cerrar()">✕</button>' +
            '</div>' +
            '<div class="modal-body">' +
                htmlForm +
            '</div>' +
            '<div class="modal-footer">' +
                '<button class="modal-btn modal-btn-cancel" onclick="Modal.cerrar()">Cancelar</button>' +
                '<button class="modal-btn modal-btn-primary" id="modal-btn-guardar" onclick="Modal._guardarFormulario()">' + textoGuardar + '</button>' +
            '</div>';

        modalActual = abrir(html);
        // Guardar callback
        modalActual._guardarCallback = onGuardar;

        return modalActual;
    }

    /* --- Ejecutar guardado de formulario --- */
    function guardarFormulario() {
        if (modalActual && typeof modalActual._guardarCallback === 'function') {
            modalActual._guardarCallback();
        }
    }

    /* --- API pública --- */
    window.Modal = {
        abrir: abrir,
        cerrar: cerrar,
        confirmar: abrirConfirm,
        formulario: abrirFormulario,
        _ejecutarConfirm: ejecutarConfirm,
        _guardarFormulario: guardarFormulario
    };

    /* --- Backward compatibility: legacy aliases --- */
    window.crearModal = abrir;
    window.cerrarModal = cerrar;

})();
