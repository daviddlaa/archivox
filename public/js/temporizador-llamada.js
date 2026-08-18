/**
 * Temporizador de llamada — Fase 1 de instrumentación de métricas.
 * Ver: docs/plan-metricas-llamadas-semaforo.md
 *
 * Registra la duración real de la llamada (segundos) y un resultado estructurado
 * (buckets del embudo comercial), usando "nudges" psicológicos para garantizar
 * que se presione el botón "Finalizar llamada":
 *
 *   1. Fricción por diseño  : mientras el cronómetro corre, los botones
 *                             Guardar/Cancelar del modal quedan deshabilitados.
 *   2. Presión visual       : cronómetro grande en vivo ("EN LLAMADA") y
 *                             confirmación obligatoria al cerrar con llamada activa.
 *   3. Refuerzo positivo    : mensaje "Llamada de MM:SS registrada" al finalizar.
 *   4. Anti-olvido          : si se guarda una gestión tipo "Llamada" sin
 *                             duración, pide una duración estimada (metodo='estimada').
 *
 * Uso:
 *   - Insertar el bloque:  window.TemporizadorLlamada.html('campana')
 *   - Al guardar:          window.TemporizadorLlamada.obtenerPayload('campana', tipo)
 *   - Antes de guardar:    window.TemporizadorLlamada.estaActivo('campana')
 */
(function (window) {
    'use strict';

    var RESULTADOS = [
        { v: 'no_contesta', l: '📵 No contestó' },
        { v: 'numero_invalido', l: '📛 Número incorrecto' },
        { v: 'no_interesado', l: '🙅 No interesado' },
        { v: 'interesado', l: '👍 Interesado' },
        { v: 'derivado', l: '🤝 Derivado a vendedor' },
        { v: 'venta', l: '💰 Venta' },
        { v: 'descalificado', l: '🚫 Descalificado' },
        { v: 'seguimiento', l: '🔄 Seguimiento' },
        { v: 'otro', l: '📝 Otro' }
    ];

    // Estado por instancia de modal (clave = idPrefijo: 'campana' | 'solicitud')
    var estados = {};
    var guardiaInstalada = false;

    function crearEstado() {
        return { inicio: null, fin: null, seg: 0, metodo: null, timer: null, activo: false };
    }

    function formatear(seg) {
        seg = Math.max(0, Math.round(seg || 0));
        var m = Math.floor(seg / 60);
        var s = seg % 60;
        return (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
    }

    function opcionesResultadoHtml() {
        var html = '';
        for (var i = 0; i < RESULTADOS.length; i++) {
            html += '<option value="' + RESULTADOS[i].v + '">' + RESULTADOS[i].l + '</option>';
        }
        return html;
    }

    // HTML del bloque temporizador + resultado (se inserta en los modales de gestión)
    function html(idPrefijo) {
        return '<div id="' + idPrefijo + '-llamada-bloque" style="border:2px solid #2563eb;border-radius:8px;padding:12px;margin-bottom:12px;background:#eff6ff;">'
            + '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:10px;">'
            + '<span id="' + idPrefijo + '-llamada-timer" style="font-size:20px;font-weight:700;font-variant-numeric:tabular-nums;color:#dc2626;">00:00</span>'
            + '<div style="display:flex;gap:8px;">'
            + '<button type="button" id="' + idPrefijo + '-btn-iniciar" onclick="TemporizadorLlamada.iniciar(this)" data-id="' + idPrefijo + '" style="padding:8px 14px;background:#2563eb;color:#fff;border:none;border-radius:8px;font-weight:600;cursor:pointer;">📞 Iniciar llamada</button>'
            + '<button type="button" id="' + idPrefijo + '-btn-finalizar" onclick="TemporizadorLlamada.finalizar(this)" data-id="' + idPrefijo + '" style="padding:8px 14px;background:#dc2626;color:#fff;border:none;border-radius:8px;font-weight:600;cursor:pointer;display:none;">✓ Finalizar llamada</button>'
            + '</div></div>'
            + '<div id="' + idPrefijo + '-llamada-duracion" style="display:none;font-size:13px;font-weight:600;color:#166534;margin-bottom:8px;"></div>'
            + '<label style="display:block;font-weight:600;margin-bottom:4px;font-size:12px;color:#374151;">🏷️ Resultado:</label>'
            + '<select id="' + idPrefijo + '-resultado" style="width:100%;padding:8px;border:1px solid #d1d5db;border-radius:6px;font-size:13px;background:#fff;">'
            + '<option value="">— Sin clasificar —</option>' + opcionesResultadoHtml()
            + '</select></div>';
    }

    // Botones del modal actual que deben bloquearse durante la llamada
    function botonesModal(desde) {
        var overlay = desde && desde.closest ? desde.closest('.modal-overlay') : null;
        if (!overlay) return { guardar: [], cancelar: [] };
        var guardar = overlay.querySelectorAll('.btn-guardar, button[onclick^="guardarGestionDesktop"]');
        var cancelar = overlay.querySelectorAll('button[onclick*="cerrarModal"]');
        return { guardar: Array.prototype.slice.call(guardar), cancelar: Array.prototype.slice.call(cancelar) };
    }

    function setBotones(desde, deshabilitar) {
        var b = botonesModal(desde);
        b.guardar.forEach(function (btn) { btn.disabled = deshabilitar; });
        b.cancelar.forEach(function (btn) { btn.disabled = deshabilitar; });
    }

    function actualizarTimer(idPrefijo) {
        var e = estados[idPrefijo];
        var el = document.getElementById(idPrefijo + '-llamada-timer');
        if (!e || !el) return;
        el.textContent = formatear((Date.now() - new Date(e.inicio).getTime()) / 1000);
    }

    function iniciar(boton) {
        var idPrefijo = boton.getAttribute('data-id');
        var e = estados[idPrefijo] || (estados[idPrefijo] = crearEstado());
        if (e.activo) return;

        e.inicio = new Date().toISOString();
        e.activo = true;
        e.metodo = null;
        e.seg = 0;

        var btnIniciar = document.getElementById(idPrefijo + '-btn-iniciar');
        var btnFinalizar = document.getElementById(idPrefijo + '-btn-finalizar');
        var dur = document.getElementById(idPrefijo + '-llamada-duracion');
        if (btnIniciar) btnIniciar.style.display = 'none';
        if (btnFinalizar) btnFinalizar.style.display = 'inline-block';
        if (dur) dur.style.display = 'none';

        if (e.timer) clearInterval(e.timer);
        e.timer = setInterval(function () { actualizarTimer(idPrefijo); }, 1000);
        actualizarTimer(idPrefijo);

        // Fricción por diseño: no se puede guardar/cancelar con la llamada en curso
        setBotones(boton, true);
    }

    function finalizarPorId(idPrefijo, desde) {
        var e = estados[idPrefijo];
        if (!e || !e.activo) return;
        e.fin = new Date().toISOString();
        e.seg = Math.max(0, Math.round((new Date(e.fin).getTime() - new Date(e.inicio).getTime()) / 1000));
        e.metodo = 'temporizador';
        e.activo = false;
        if (e.timer) { clearInterval(e.timer); e.timer = null; }
        if (desde) setBotones(desde, false);
    }

    function finalizar(boton) {
        var idPrefijo = boton.getAttribute('data-id');
        finalizarPorId(idPrefijo, boton);

        var e = estados[idPrefijo];
        var dur = document.getElementById(idPrefijo + '-llamada-duracion');
        if (dur && e) {
            dur.textContent = '✅ Llamada de ' + formatear(e.seg) + ' registrada';
            dur.style.display = 'block';
        }
        var btnIniciar = document.getElementById(idPrefijo + '-btn-iniciar');
        var btnFinalizar = document.getElementById(idPrefijo + '-btn-finalizar');
        if (btnFinalizar) btnFinalizar.style.display = 'none';
        if (btnIniciar) btnIniciar.style.display = 'inline-block';
    }

    function estaActivo(idPrefijo) {
        var e = estados[idPrefijo];
        return !!(e && e.activo);
    }

    // Payload a enviar al backend + nudge anti-olvido (duración estimada)
    function obtenerPayload(idPrefijo, tipo) {
        var e = estados[idPrefijo] || (estados[idPrefijo] = crearEstado());

        if (String(tipo || '') === 'Llamada' && !e.seg && !e.activo) {
            var mins = window.prompt('📞 No se registró la duración de la llamada. ¿Cuántos minutos duró aproximadamente? (déjalo vacío para omitir)');
            if (mins !== null && mins !== '' && !isNaN(Number(mins)) && Number(mins) > 0) {
                e.seg = Math.round(Number(mins) * 60);
                e.metodo = 'estimada';
            }
        }

        var sel = document.getElementById(idPrefijo + '-resultado');
        var resultado = sel ? sel.value : '';
        return {
            duracion_seg: e.seg || null,
            llamada_inicio: e.inicio,
            llamada_fin: e.fin,
            resultado: resultado || null,
            metodo_duracion: e.metodo || (e.seg ? 'temporizador' : null)
        };
    }

    // Guardia de cierre: si hay una llamada en curso, pedir confirmación
    // antes de cerrar el modal (cubre botón Cancelar, overlay y tecla Escape).
    function instalarGuardia() {
        if (guardiaInstalada) return;
        guardiaInstalada = true;

        var origCerrar = window.cerrarModal;
        var wrapper = function () {
            var activos = [];
            Object.keys(estados).forEach(function (k) { if (estados[k].activo) activos.push(k); });
            if (activos.length) {
                var k = activos[0];
                var e = estados[k];
                var seg = Math.floor((Date.now() - new Date(e.inicio).getTime()) / 1000);
                if (!window.confirm('📞 Llamada en curso (' + formatear(seg) + '). ¿Cancelar la llamada sin guardar y cerrar?')) {
                    return;
                }
                finalizarPorId(k);
                delete estados[k];
            }
            if (origCerrar) origCerrar();
        };

        window.cerrarModal = wrapper;
        try {
            if (window.Modal && typeof window.Modal.cerrar === 'function') {
                window.Modal.cerrar = wrapper;
            }
        } catch (e) { /* silencioso */ }
    }

    window.TemporizadorLlamada = {
        html: html,
        iniciar: iniciar,
        finalizar: finalizar,
        estaActivo: estaActivo,
        obtenerPayload: obtenerPayload,
        formatear: formatear
    };

    instalarGuardia();
})(window);
