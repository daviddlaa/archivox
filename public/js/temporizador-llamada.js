/**
 * Temporizador de llamada — Fase 1 v2 (docs/plan-metricas-llamadas-semaforo.md §8).
 *
 * Popup tipo SweetAlert (overlay + diálogo centrado) que se abre desde el botón
 * 📞 de cada tarjeta. Flujo:
 *
 *   1. Al tocar 📞: se abre el popup con el contador corriendo y se marca el número.
 *   2. La llamada ocurre fuera del navegador; al volver, el contador muestra el
 *      tiempo REAL transcurrido (wall-clock: Date.now() − inicio, con refresco en
 *      visibilitychange/pageshow — no depende de que setInterval siga latiendo en
 *      segundo plano).
 *   3. "✓ Terminar llamada": se detiene el contador, se muestra la duración y se
 *      permite elegir el RESULTADO de la gestión telefónica (buckets del embudo)
 *      más una observación opcional.
 *   4. "💾 Guardar": crea la gestión tipo "Llamada" vía POST /api/excel/gestiones
 *      con duracion_seg, llamada_inicio/fin, resultado y metodo_duracion='temporizador'.
 *
 * Nudges psicológicos:
 *   - Contador grande en vivo ("presión visual").
 *   - Cancelar/cerrar (botón, click fuera o Escape) con llamada en curso → confirmación.
 *   - Refuerzo positivo: toast "📞 Llamada de MM:SS registrada" al guardar.
 *   - Si el usuario no usa este flujo y registra "Llamada" desde el modal de gestión,
 *     el backend igualmente persiste el resultado; la duración queda pendiente
 *     (visible para el líder en la Fase 3).
 *
 * Autónomo: no depende de modal.js ni de crearModalMovil (cada página móvil tiene
 * el suyo); el módulo construye y destruye su propio overlay.
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

    var actual = null;      // llamada activa o recién finalizada
    var overlayEl = null;
    var limpiezas = [];     // funciones para quitar listeners

    function formatear(seg) {
        seg = Math.max(0, Math.round(seg || 0));
        var m = Math.floor(seg / 60);
        var s = seg % 60;
        return (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
    }

    function escapar(texto) {
        return String(texto == null ? '' : texto)
            .replace(/&/g, '&amp;')
            .replace(/"/g, '&quot;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    }

    function numeroLimpio(celular) {
        return String(celular || '').replace(/\D/g, '');
    }

    function segActual() {
        if (!actual || !actual.inicio) return 0;
        return Math.max(0, Math.round((Date.now() - actual.inicio) / 1000));
    }

    // ------------------------------------------------------------------ popup

    function crearOverlay() {
        if (overlayEl) { overlayEl.remove(); }

        overlayEl = document.createElement('div');
        overlayEl.id = 'llamada-popup-overlay';
        overlayEl.style.cssText = [
            'position:fixed;top:0;left:0;width:100%;height:100%;',
            'background:rgba(17,24,39,0.55);z-index:10000;',
            'display:flex;align-items:center;justify-content:center;padding:16px;box-sizing:border-box;'
        ].join('');

        var dialogo = document.createElement('div');
        dialogo.id = 'llamada-popup-dialogo';
        dialogo.style.cssText = [
            'background:#fff;border-radius:16px;max-width:420px;width:100%;',
            'padding:22px;box-sizing:border-box;text-align:center;',
            'box-shadow:0 25px 50px -12px rgba(0,0,0,0.45);',
            'font-family:inherit;color:#111827;'
        ].join('');
        overlayEl.appendChild(dialogo);
        document.body.appendChild(overlayEl);

        // Cerrar con click fuera o Escape → pasa por cancelar() (confirmación si hay llamada)
        var onClickOverlay = function (e) { if (e.target === overlayEl) cancelar(); };
        var onEscape = function (e) { if (e.key === 'Escape') cancelar(); };
        var onVisibilidad = function () { if (document.visibilityState === 'visible') actualizarTimer(); };
        var onPageShow = function () { actualizarTimer(); };

        overlayEl.addEventListener('click', onClickOverlay);
        document.addEventListener('keydown', onEscape);
        document.addEventListener('visibilitychange', onVisibilidad);
        window.addEventListener('pageshow', onPageShow);

        limpiezas.push(function () {
            overlayEl.removeEventListener('click', onClickOverlay);
            document.removeEventListener('keydown', onEscape);
            document.removeEventListener('visibilitychange', onVisibilidad);
            window.removeEventListener('pageshow', onPageShow);
        });
    }

    function dialogHtml(contenido) {
        return '<div style="font-size:13px;font-weight:600;color:#6b7280;margin-bottom:2px;">📞 Llamada a</div>'
            + '<div style="font-size:18px;font-weight:700;color:#111827;margin-bottom:2px;">' + escapar(actual.nombre || '—') + '</div>'
            + '<div style="font-size:13px;color:#6b7280;margin-bottom:14px;">📱 ' + escapar(actual.celular || '—') + '</div>'
            + contenido;
    }

    function renderEnLlamada() {
        var d = document.getElementById('llamada-popup-dialogo');
        if (!d) return;
        d.innerHTML = dialogHtml(
            '<div id="llamada-timer" style="font-size:42px;font-weight:800;color:#dc2626;font-variant-numeric:tabular-nums;line-height:1.1;">00:00</div>'
            + '<div id="llamada-estado" style="font-size:13px;font-weight:700;color:#dc2626;margin:4px 0 16px;">🔴 EN LLAMADA</div>'
            + '<div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap;">'
            + '<button type="button" onclick="TemporizadorLlamada.marcarDeNuevo()" style="padding:10px 14px;background:#2563eb;color:#fff;border:none;border-radius:10px;font-weight:600;cursor:pointer;">📞 Marcar de nuevo</button>'
            + '<button type="button" onclick="TemporizadorLlamada.finalizar()" style="padding:10px 14px;background:#dc2626;color:#fff;border:none;border-radius:10px;font-weight:600;cursor:pointer;">✓ Terminar llamada</button>'
            + '<button type="button" onclick="TemporizadorLlamada.cancelar()" style="padding:10px 14px;background:#f3f4f6;color:#374151;border:none;border-radius:10px;font-weight:600;cursor:pointer;">✕ Cancelar</button>'
            + '</div>'
        );
    }

    function renderResultado() {
        var d = document.getElementById('llamada-popup-dialogo');
        if (!d) return;

        var pills = '';
        for (var i = 0; i < RESULTADOS.length; i++) {
            pills += '<button type="button" data-val="' + RESULTADOS[i].v + '" onclick="TemporizadorLlamada.elegirResultado(\'' + RESULTADOS[i].v + '\')" style="display:inline-block;margin:3px;padding:8px 12px;border:2px solid #e5e7eb;border-radius:20px;background:#f9fafb;color:#374151;font-size:13px;font-weight:600;cursor:pointer;">' + RESULTADOS[i].l + '</button>';
        }

        d.innerHTML = dialogHtml(
            '<div style="font-size:34px;font-weight:800;color:#059669;font-variant-numeric:tabular-nums;line-height:1.1;">' + formatear(actual.seg) + '</div>'
            + '<div style="font-size:13px;font-weight:600;color:#059669;margin:2px 0 14px;">✅ Llamada finalizada</div>'
            + '<div style="text-align:left;font-size:13px;font-weight:700;color:#374151;margin-bottom:6px;">🏷️ Resultado de la gestión telefónica:</div>'
            + '<div id="llamada-resultado-pills" style="margin-bottom:12px;">' + pills + '</div>'
            + '<textarea id="llamada-obs" rows="2" placeholder="Observación (opcional)..." style="width:100%;box-sizing:border-box;padding:10px;border:1px solid #d1d5db;border-radius:8px;font-size:14px;margin-bottom:14px;font-family:inherit;"></textarea>'
            + '<div style="display:flex;gap:8px;justify-content:center;">'
            + '<button type="button" id="llamada-btn-guardar" onclick="TemporizadorLlamada.guardar()" style="padding:11px 18px;background:#059669;color:#fff;border:none;border-radius:10px;font-weight:700;cursor:pointer;">💾 Guardar</button>'
            + '<button type="button" onclick="TemporizadorLlamada.cancelar()" style="padding:11px 18px;background:#f3f4f6;color:#374151;border:none;border-radius:10px;font-weight:600;cursor:pointer;">✕ Cancelar</button>'
            + '</div>'
        );
    }

    function actualizarTimer() {
        var el = document.getElementById('llamada-timer');
        if (el && actual && actual.activo) el.textContent = formatear(segActual());
    }

    // ------------------------------------------------------------------ API

    function abrirLlamada(opciones) {
        opciones = opciones || {};
        if (actual && actual.activo) {
            alert('📞 Ya hay una llamada en curso para otra solicitud. Termínala primero.');
            return;
        }
        if (!opciones.solicitudId) return;

        actual = {
            solicitudId: String(opciones.solicitudId),
            celular: opciones.celular || '',
            gestionId: opciones.gestionId || null,
            nombre: opciones.nombre || '',
            onGuardada: opciones.onGuardada || null,
            inicio: Date.now(),
            fin: null,
            seg: 0,
            activo: true,
            resultado: null,
            observacion: '',
            timer: null
        };

        crearOverlay();
        renderEnLlamada();
        actual.timer = setInterval(actualizarTimer, 1000);
        actualizarTimer();

        marcarDeNuevo();
    }

    function marcarDeNuevo() {
        if (!actual) return;
        var numero = numeroLimpio(actual.celular);
        if (!numero) { alert('No hay número de celular'); return; }
        window.location.href = 'tel:' + numero;
    }

    function finalizar() {
        if (!actual || !actual.activo) return;
        if (actual.timer) { clearInterval(actual.timer); actual.timer = null; }
        actual.fin = Date.now();
        actual.seg = segActual();
        actual.activo = false;
        renderResultado();
    }

    function elegirResultado(valor) {
        if (!actual) return;
        actual.resultado = valor;
        var pills = document.querySelectorAll('#llamada-resultado-pills button[data-val]');
        for (var i = 0; i < pills.length; i++) {
            var activo = pills[i].getAttribute('data-val') === valor;
            pills[i].style.borderColor = activo ? '#059669' : '#e5e7eb';
            pills[i].style.background = activo ? '#d1fae5' : '#f9fafb';
            pills[i].style.color = activo ? '#065f46' : '#374151';
        }
    }

    async function guardar() {
        if (!actual) return;
        if (!actual.resultado) {
            alert('Selecciona el resultado de la llamada antes de guardar.');
            return;
        }
        var obsEl = document.getElementById('llamada-obs');
        var observacion = obsEl ? obsEl.value.trim() : '';
        var btn = document.getElementById('llamada-btn-guardar');
        if (btn) { btn.disabled = true; btn.textContent = '⏳ Guardando...'; }

        var body = {
            solicitud_id: actual.solicitudId,
            tipo_gestion: 'Llamada',
            observacion: observacion,
            gestion_maestro_id: actual.gestionId || null,
            duracion_seg: (typeof actual.seg === 'number' && actual.seg >= 0) ? actual.seg : null,
            llamada_inicio: new Date(actual.inicio).toISOString(),
            llamada_fin: new Date(actual.fin || actual.inicio).toISOString(),
            resultado: actual.resultado,
            metodo_duracion: 'temporizador'
        };

        try {
            var response = await fetch('/api/excel/gestiones', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });
            var resultado = await response.json().catch(function () { return {}; });
            if (!response.ok || resultado.error) {
                alert('Error: ' + (resultado.error || 'No se pudo guardar la gestión'));
                if (btn) { btn.disabled = false; btn.textContent = '💾 Guardar'; }
                return;
            }
            var data = resultado.data || {};
            mostrarToast('📞 Llamada de ' + formatear(actual.seg) + ' registrada');
            var cb = actual.onGuardada;
            var solicitudId = actual.solicitudId;
            cerrar();
            if (typeof cb === 'function') { try { cb(data, solicitudId); } catch (e) { console.error('[TemporizadorLlamada] onGuardada:', e); } }
        } catch (error) {
            console.error('[TemporizadorLlamada] Error guardando:', error);
            alert('Error al guardar la gestión: ' + error.message);
            if (btn) { btn.disabled = false; btn.textContent = '💾 Guardar'; }
        }
    }

    function cancelar() {
        if (!actual) return;
        if (actual.activo) {
            var ok = window.confirm('📞 Llamada en curso (' + formatear(segActual()) + '). ¿Cancelar la llamada sin guardar y cerrar?');
            if (!ok) return;
        }
        cerrar();
    }

    function cerrar() {
        if (actual && actual.timer) { clearInterval(actual.timer); actual.timer = null; }
        for (var i = 0; i < limpiezas.length; i++) { try { limpiezas[i](); } catch (e) { /* silencioso */ } }
        limpiezas = [];
        if (overlayEl) { overlayEl.remove(); overlayEl = null; }
        actual = null;
    }

    function mostrarToast(mensaje) {
        var toast = document.createElement('div');
        toast.textContent = mensaje;
        toast.style.cssText = [
            'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);',
            'background:#111827;color:#fff;padding:12px 20px;border-radius:12px;',
            'font-size:14px;font-weight:600;z-index:10001;box-shadow:0 10px 25px -5px rgba(0,0,0,0.4);'
        ].join('');
        document.body.appendChild(toast);
        setTimeout(function () {
            toast.style.transition = 'opacity 0.4s';
            toast.style.opacity = '0';
            setTimeout(function () { if (toast.parentNode) toast.parentNode.removeChild(toast); }, 420);
        }, 3200);
    }

    window.TemporizadorLlamada = {
        abrirLlamada: abrirLlamada,
        marcarDeNuevo: marcarDeNuevo,
        finalizar: finalizar,
        elegirResultado: elegirResultado,
        guardar: guardar,
        cancelar: cancelar,
        formatear: formatear
    };
})(window);
