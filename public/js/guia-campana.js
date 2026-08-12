// ============================================================================
// GUÍA DIDÁCTICA DE CLASIFICACIÓN EN CAMPAÑAS (una sola vez por usuario)
// ----------------------------------------------------------------------------
// Se muestra al entrar a una campaña (desktop y móvil) hasta que el usuario la
// cierra con "¡Entendido!". La persistencia usa localStorage con llave por
// usuario (campana_guia_v1_<usuarioId>), siguiendo la convención de
// preferencias del proyecto (campanas_reco_open_mobile, etc.).
//
// Uso:
//   mostrarGuiaCampanaSiPrimeraVez({ usuarioId, nombre, cedula })
// Devuelve true si la mostró (primera vez) o false si ya se vio.
// ============================================================================
(function() {
    'use strict';

    var CLAVE_GUIA = 'campana_guia_v1';

    function clavePorUsuario(usuarioId) {
        return CLAVE_GUIA + '_' + (usuarioId ? String(usuarioId) : 'anon');
    }

    function fueVista(usuarioId) {
        try {
            return localStorage.getItem(clavePorUsuario(usuarioId)) === '1';
        } catch (e) {
            return true; // Sin almacenamiento disponible: no insistir
        }
    }

    function marcarVista(usuarioId) {
        try {
            localStorage.setItem(clavePorUsuario(usuarioId), '1');
        } catch (e) { /* ignore */ }
    }

    function copiarTexto(texto) {
        var valor = String(texto || '').trim();
        if (!valor) return;
        var btn = document.getElementById('guia-copiar-btn');
        var done = function() {
            if (btn) {
                btn.textContent = '✅ Copiado';
                setTimeout(function() {
                    if (document.getElementById('guia-copiar-btn')) {
                        btn.textContent = '📋 Copiar nombre y cédula';
                    }
                }, 2000);
            }
        };
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(valor).then(done);
            return;
        }
        var textarea = document.createElement('textarea');
        textarea.value = valor;
        textarea.setAttribute('readonly', '');
        textarea.style.position = 'fixed';
        textarea.style.left = '-9999px';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        done();
    }

    function escapar(texto) {
        return String(texto || '')
            .replace(/&/g, '&amp;')
            .replace(/"/g, '&quot;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    }

    // ============================================================================
    // API pública
    // ============================================================================
    window.mostrarGuiaCampanaSiPrimeraVez = function(opts) {
        opts = opts || {};
        if (fueVista(opts.usuarioId)) return false;

        var nombre = String(opts.nombre || '').trim();
        var cedula = String(opts.cedula || '').trim();
        var tieneDatos = !!(nombre || cedula);
        var textoDatos = (nombre + ' - ' + cedula).replace(/^\s*-\s*|\s*-\s*$/g, '').trim();

        // Handlers globales (invocados desde el HTML del modal)
        window.guiaCopiarContacto = function() { copiarTexto(textoDatos); };
        window.guiaCerrarCampana = function(uid) {
            marcarVista(uid);
            if (typeof cerrarModal === 'function') cerrarModal();
            else if (window.Modal) window.Modal.cerrar();
        };

        var filas = [
            { cls: 'sin_clasificar', dot: '⚪', nombre: 'Sin clasificar', texto: 'Por revisar: todavía no sabes qué hará el cliente.' },
            { cls: 'amarillo', dot: '🟡', nombre: 'Seguimiento', texto: 'Aún no responden: márcalos para retomarlos más tarde.' },
            { cls: 'verde', dot: '🟢', nombre: 'Encaminadas', texto: 'Tienen interés: continúa la gestión con ellos.' },
            { cls: 'rojo', dot: '🔴', nombre: 'En espera', texto: 'No quieren nada por ahora: respeta su tiempo.' }
        ];

        var html = '';
        html += '<div class="guia-campana">';
        html += '<div class="guia-campana-header">';
        html += '<span class="guia-campana-icon">🎓</span>';
        html += '<h2>¡Campaña lista! Así se trabaja</h2>';
        html += '<p>Después de hablar con cada cliente, clasifícalo con el selector de su tarjeta:</p>';
        html += '</div>';

        // Tarjeta didáctica: replica el selector segmentado del semáforo
        html += '<div class="guia-campana-semaforo">';
        for (var i = 0; i < filas.length; i++) {
            var f = filas[i];
            html += '<div class="guia-campana-fila guia-' + f.cls + '">';
            html += '<span class="guia-campana-dot">' + f.dot + '</span>';
            html += '<span class="guia-campana-fila-info"><strong>' + f.nombre + '</strong><small>' + f.texto + '</small></span>';
            html += '</div>';
        }
        html += '</div>';

        // Segmento de prioridad de contacto: llamar primero, mensaje después
        html += '<div class="guia-campana-prioridad">';
        html += '<span class="guia-campana-prioridad-titulo">Prioridad de contacto:</span>';
        html += '<div class="guia-campana-segmento">';
        html += '<span class="guia-campana-seg activo">1️⃣ 📞 Llama primero</span>';
        html += '<span class="guia-campana-seg">2️⃣ 💬 Luego mensaje</span>';
        html += '</div>';
        html += '</div>';

        // Recomendación: guardar el contacto en el teléfono
        html += '<div class="guia-campana-tip">';
        html += '<span class="guia-campana-tip-icon">📱</span>';
        html += '<span class="guia-campana-tip-info"><strong>Guarda el contacto en tu teléfono</strong><small>Nombre + cédula para reconocer al cliente cuando llames.</small></span>';
        if (tieneDatos) {
            html += '<button type="button" class="guia-campana-copiar" id="guia-copiar-btn" onclick="window.guiaCopiarContacto()">📋 Copiar nombre y cédula</button>';
        }
        html += '</div>';

        html += '<button type="button" class="guia-campana-cta" onclick="window.guiaCerrarCampana(' + (opts.usuarioId ? String(opts.usuarioId) : 'null') + ')">👍 ¡Entendido!</button>';
        html += '</div>';

        if (typeof crearModal === 'function') {
            crearModal(html);
        } else if (window.Modal) {
            window.Modal.abrir(html);
        } else {
            marcarVista(opts.usuarioId); // Sin modal disponible: marcar como vista igualmente
            return false;
        }
        return true;
    };
})();
