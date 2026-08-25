(function () {
    'use strict';

    var mesActual = new Date();
    mesActual.setDate(1);
    mesActual.setHours(0, 0, 0, 0);

    var diaSeleccionado = ymd(new Date());
    var recordatorios = [];
    var porDia = {};
    var esMovil = location.pathname.indexOf('/m/') === 0;

    function pad(n) { return n < 10 ? '0' + n : String(n); }
    function ymd(d) {
        return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
    }
    function parseFecha(str) {
        if (!str) return null;
        var s = String(str).replace(' ', 'T').slice(0, 19);
        var d = new Date(s);
        return isNaN(d.getTime()) ? null : d;
    }
    function esc(t) {
        return String(t == null ? '' : t)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }
    function nombreMes(d) {
        return d.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
    }
    function labelDia(ymdStr) {
        var p = ymdStr.split('-');
        var d = new Date(parseInt(p[0], 10), parseInt(p[1], 10) - 1, parseInt(p[2], 10));
        return d.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
    }

    function inicioFinMes(d) {
        var y = d.getFullYear();
        var m = d.getMonth();
        var desde = y + '-' + pad(m + 1) + '-01';
        var ultimo = new Date(y, m + 1, 0).getDate();
        var hasta = y + '-' + pad(m + 1) + '-' + pad(ultimo);
        return { desde: desde, hasta: hasta };
    }

    async function recargarMes() {
        var rango = inicioFinMes(mesActual);
        var estado = (document.getElementById('filtro-estado-cal') || {}).value || 'pendiente';
        var titulo = document.getElementById('cal-mes-titulo');
        if (titulo) titulo.textContent = nombreMes(mesActual);

        var grid = document.getElementById('cal-grid');
        if (grid) grid.innerHTML = '<div class="cal-empty" style="grid-column:1/-1">Cargando...</div>';

        try {
            var url = '/api/gestiones-maestro/recordatorios?desde=' + encodeURIComponent(rango.desde) +
                '&hasta=' + encodeURIComponent(rango.hasta) +
                '&estado=' + encodeURIComponent(estado);
            var res = await fetch(url, { credentials: 'include' });
            if (!res.ok) throw new Error('Error ' + res.status);
            var data = await res.json();
            recordatorios = data.data || [];
            indexarPorDia();
            renderGrid();
            actualizarKpis();
            renderListaDia(diaSeleccionado);
        } catch (e) {
            console.error('[Calendario]', e);
            if (grid) grid.innerHTML = '<div class="cal-empty" style="grid-column:1/-1;color:#dc2626">No se pudieron cargar los recordatorios</div>';
        }
    }

    function indexarPorDia() {
        porDia = {};
        for (var i = 0; i < recordatorios.length; i++) {
            var r = recordatorios[i];
            var f = parseFecha(r.fecha_recordatorio);
            if (!f) continue;
            var key = ymd(f);
            if (!porDia[key]) porDia[key] = [];
            porDia[key].push(r);
        }
    }

    function actualizarKpis() {
        var hoy = ymd(new Date());
        var now = Date.now();
        var vencidos = 0, hoyN = 0, prox = 0;
        for (var i = 0; i < recordatorios.length; i++) {
            var r = recordatorios[i];
            if (r.estado && r.estado !== 'pendiente') continue;
            var f = parseFecha(r.fecha_recordatorio);
            if (!f) continue;
            var key = ymd(f);
            if (key === hoy) hoyN++;
            else if (f.getTime() < now) vencidos++;
            else prox++;
        }
        var elV = document.getElementById('kpi-vencidos');
        var elH = document.getElementById('kpi-hoy');
        var elP = document.getElementById('kpi-prox');
        if (elV) elV.textContent = String(vencidos);
        if (elH) elH.textContent = String(hoyN);
        if (elP) elP.textContent = String(prox);
    }

    function renderGrid() {
        var grid = document.getElementById('cal-grid');
        if (!grid) return;
        var y = mesActual.getFullYear();
        var m = mesActual.getMonth();
        var first = new Date(y, m, 1);
        var startOffset = (first.getDay() + 6) % 7; // lunes=0
        var daysInMonth = new Date(y, m + 1, 0).getDate();
        var prevDays = new Date(y, m, 0).getDate();
        var hoy = ymd(new Date());
        var html = '';
        var totalCells = Math.ceil((startOffset + daysInMonth) / 7) * 7;

        for (var i = 0; i < totalCells; i++) {
            var dayNum, cellDate, other = false;
            if (i < startOffset) {
                dayNum = prevDays - startOffset + i + 1;
                cellDate = new Date(y, m - 1, dayNum);
                other = true;
            } else if (i >= startOffset + daysInMonth) {
                dayNum = i - (startOffset + daysInMonth) + 1;
                cellDate = new Date(y, m + 1, dayNum);
                other = true;
            } else {
                dayNum = i - startOffset + 1;
                cellDate = new Date(y, m, dayNum);
            }
            var key = ymd(cellDate);
            var items = porDia[key] || [];
            var cls = 'cal-day';
            if (other) cls += ' other-month';
            if (key === hoy) cls += ' today';
            if (key === diaSeleccionado) cls += ' selected';

            var llamadas = 0, mensajes = 0, vencidos = 0;
            var now = Date.now();
            for (var j = 0; j < items.length; j++) {
                var it = items[j];
                if (String(it.canal || '').toLowerCase() === 'mensaje') mensajes++;
                else llamadas++;
                var ff = parseFecha(it.fecha_recordatorio);
                if (ff && ff.getTime() < now && it.estado === 'pendiente') vencidos++;
            }

            html += '<button type="button" class="' + cls + '" data-day="' + key + '" onclick="seleccionarDia(\'' + key + '\')">';
            html += '<span class="cal-day-num">' + dayNum + '</span>';
            if (items.length) {
                html += '<div class="cal-day-dots">';
                if (vencidos) html += '<span class="cal-dot cal-dot-vencido">' + vencidos + '</span>';
                else if (llamadas && mensajes) html += '<span class="cal-dot cal-dot-mix">' + items.length + '</span>';
                else if (mensajes) html += '<span class="cal-dot cal-dot-mensaje">' + items.length + '</span>';
                else html += '<span class="cal-dot cal-dot-llamada">' + items.length + '</span>';
                html += '</div>';
            }
            html += '</button>';
        }
        grid.innerHTML = html;
    }

    function seleccionarDia(key) {
        diaSeleccionado = key;
        renderGrid();
        renderListaDia(key);
        // Móvil: auto-scroll suave hasta el panel del día para ver la lista sin scroll manual
        if (esMovil) {
            var panel = document.querySelector('.cal-dia-panel-movil') || document.querySelector('.cal-dia-panel');
            if (panel) {
                setTimeout(function () {
                    panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }, 60);
            }
        }
    }

    function renderListaDia(key) {
        var lista = document.getElementById('cal-dia-lista');
        var titulo = document.getElementById('cal-dia-titulo');
        var countEl = document.getElementById('cal-dia-count');
        if (titulo) titulo.textContent = labelDia(key);
        var items = (porDia[key] || []).slice();
        if (countEl) countEl.textContent = items.length ? (items.length + ' recordatorio' + (items.length === 1 ? '' : 's')) : '';

        if (!items.length) {
            if (lista) lista.innerHTML = '<div class="cal-empty">No hay recordatorios este día.</div>';
            return;
        }

        var now = Date.now();
        var hoy = ymd(new Date());
        var hoyBadge = document.getElementById('cal-dia-hoy-badge');
        if (hoyBadge) hoyBadge.style.display = (key === hoy) ? 'inline-flex' : 'none';
        var vencidos = [];
        var delDia = [];
        for (var i = 0; i < items.length; i++) {
            var r = items[i];
            var f = parseFecha(r.fecha_recordatorio);
            var esVen = r.estado === 'pendiente' && f && f.getTime() < now && key <= hoy;
            if (esVen) vencidos.push(r);
            else delDia.push(r);
        }

        var html = '';
        function section(title, arr, flagVencido) {
            if (!arr.length) return;
            html += '<div class="cal-section-title">' + title + '</div>';
            for (var j = 0; j < arr.length; j++) html += renderItem(arr[j], !!flagVencido);
        }
        section('Vencidos', vencidos, true);
        section(key === hoy ? 'Hoy' : 'Del día', delDia, false);

        if (lista) lista.innerHTML = html || '<div class="cal-empty">No hay recordatorios este día.</div>';
    }

    function renderItem(r, esVencido) {
        var f = parseFecha(r.fecha_recordatorio);
        var hora = f ? pad(f.getHours()) + ':' + pad(f.getMinutes()) : '--:--';
        var canal = String(r.canal || 'Llamada');
        var canalCls = canal.toLowerCase() === 'mensaje' ? 'mensaje' : 'llamada';
        var campanaHref = (esMovil ? '/m/gestion-lote?id=' : '/gestion-lote?id=') + encodeURIComponent(r.gestion_maestro_id || '');
        if (r.solicitud_id) campanaHref += '&card=' + encodeURIComponent(r.solicitud_id);

        var html = '<div class="cal-item' + (esVencido ? ' vencido' : '') + '">';
        html += '<div class="cal-item-top">';
        html += '<span class="cal-item-canal ' + canalCls + '">' + (canalCls === 'mensaje' ? '💬' : '📞') + ' ' + esc(canal) + '</span>';
        html += '<span class="cal-item-hora">' + hora + '</span>';
        html += '</div>';
        html += '<div class="cal-item-name">' + esc(r.cliente_nombre || ('Solicitud #' + (r.solicitud_id || ''))) + '</div>';
        html += '<div class="cal-item-meta">';
        if (r.cliente_cedula) html += '🆔 ' + esc(r.cliente_cedula) + ' · ';
        if (r.cliente_celular) html += '📱 ' + esc(r.cliente_celular) + ' · ';
        html += '📢 ' + esc(r.nombre_campana || ('Campaña #' + r.gestion_maestro_id));
        html += '</div>';
        if (r.nota) html += '<div class="cal-item-nota">' + esc(r.nota) + '</div>';
        html += '<div class="cal-item-actions">';
        if (r.estado === 'pendiente') {
            html += '<button type="button" class="btn-hecho" onclick="accionRecordatorio(' + r.gestion_maestro_id + ',' + r.id + ',\'hecho\')">✅ Hecho</button>';
            html += '<button type="button" class="btn-posponer" onclick="posponerDesdeCal(' + r.gestion_maestro_id + ',' + r.id + ',\'' + String(r.fecha_recordatorio || '').replace(/'/g, '') + '\')">⏰ Posponer</button>';
            html += '<button type="button" class="btn-cancelar" onclick="accionRecordatorio(' + r.gestion_maestro_id + ',' + r.id + ',\'cancelado\')">❌ Cancelar</button>';
        } else {
            html += '<span class="cal-item-hora">Estado: ' + esc(r.estado) + '</span>';
        }
        html += '<a class="btn-ir" href="' + campanaHref + '">🚀 Ir a campaña</a>';
        html += '</div></div>';
        return html;
    }

    async function accionRecordatorio(campanaId, rid, estado) {
        try {
            var res = await fetch('/api/gestiones-maestro/' + campanaId + '/recordatorios/' + rid + '/estado', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ estado: estado })
            });
            if (!res.ok) throw new Error('No se pudo actualizar');
            mostrarToastCal(estado === 'hecho' ? '✅ Marcado como hecho' : '❌ Recordatorio cancelado');
            await recargarMes();
        } catch (e) {
            mostrarToastCal('⚠️ ' + (e.message || 'Error'));
        }
    }

    // ========================================================================
    // POSPONER CON MODAL (reemplaza prompt() nativo)
    // Modal con atajos rápidos + datetime-local, estilo notificaciones.
    // ========================================================================
    function localToInputCal(d) {
        return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) +
            'T' + pad(d.getHours()) + ':' + pad(d.getMinutes());
    }

    function abrirModalPosponerCal(campanaId, rid, fechaActual) {
        var valorInicial = '';
        if (fechaActual) {
            var f = parseFecha(fechaActual);
            if (f) valorInicial = localToInputCal(f);
        }
        if (!valorInicial) valorInicial = localToInputCal(new Date(Date.now() + 60 * 60000));

        var html =
            '<div class="modal-header">' +
                '<h2>⏰ Posponer recordatorio</h2>' +
                '<button class="modal-close-btn" onclick="Modal.cerrar()">✕</button>' +
            '</div>' +
            '<div class="modal-body cal-posponer-body">' +
                '<p class="cal-posponer-sub">¿Cuándo quieres que te avise de nuevo?</p>' +
                '<div class="cal-posponer-presets">' +
                    '<button type="button" class="cal-posponer-preset" data-min="30">+30 min</button>' +
                    '<button type="button" class="cal-posponer-preset" data-min="60">+1 hora</button>' +
                    '<button type="button" class="cal-posponer-preset" data-min="1440">+1 día</button>' +
                '</div>' +
                '<input type="datetime-local" id="cal-posponer-input" value="' + valorInicial + '" class="cal-posponer-input">' +
            '</div>' +
            '<div class="modal-footer">' +
                '<button class="modal-btn modal-btn-cancel" onclick="Modal.cerrar()">Cancelar</button>' +
                '<button class="modal-btn modal-btn-primary" onclick="guardarPosponerCal(' + campanaId + ',' + rid + ')">💾 Guardar</button>' +
            '</div>';

        Modal.abrir(html);

        var input = document.getElementById('cal-posponer-input');
        var presets = document.querySelectorAll('.cal-posponer-preset');
        for (var i = 0; i < presets.length; i++) {
            presets[i].addEventListener('click', function () {
                var mins = parseInt(this.getAttribute('data-min'), 10) || 30;
                input.value = localToInputCal(new Date(Date.now() + mins * 60000));
            });
        }
    }

    async function guardarPosponerCal(campanaId, rid) {
        var input = document.getElementById('cal-posponer-input');
        var val = input ? input.value : '';
        if (!val) { mostrarToastCal('⚠️ Elige una fecha y hora'); return; }
        var norm = String(val).trim().replace('T', ' ');
        if (norm.length === 16) norm += ':00';
        try {
            var res = await fetch('/api/gestiones-maestro/' + campanaId + '/recordatorios/' + rid + '/posponer', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ fecha_recordatorio: norm })
            });
            if (!res.ok) throw new Error('No se pudo posponer');
            Modal.cerrar();
            mostrarToastCal('⏰ Recordatorio reprogramado');
            await recargarMes();
        } catch (e) {
            mostrarToastCal('⚠️ ' + (e.message || 'Error'));
        }
    }

    function posponerDesdeCal(campanaId, rid, fechaActual) {
        abrirModalPosponerCal(campanaId, rid, fechaActual);
    }

    // ========================================================================
    // TOAST (feedback no bloqueante en vez de alert())
    // ========================================================================
    function mostrarToastCal(mensaje) {
        var anterior = document.querySelector('.cal-toast');
        if (anterior) anterior.remove();
        var toast = document.createElement('div');
        toast.className = 'cal-toast';
        toast.textContent = mensaje;
        document.body.appendChild(toast);
        requestAnimationFrame(function () { toast.classList.add('visible'); });
        setTimeout(function () {
            toast.classList.remove('visible');
            setTimeout(function () { if (toast.parentNode) toast.remove(); }, 300);
        }, 2200);
    }

    function cambiarMes(delta) {
        mesActual.setMonth(mesActual.getMonth() + delta);
        recargarMes();
    }

    // ========================================================================
    // SWIPE PARA CAMBIAR DE MES (solo móvil)
    // ========================================================================
    function configurarSwipeMes() {
        var panel = document.querySelector('.cal-mes-panel');
        if (!panel) return;
        var startX = null, startY = null;
        panel.addEventListener('touchstart', function (e) {
            if (e.touches.length !== 1) { startX = null; return; }
            startX = e.touches[0].clientX;
            startY = e.touches[0].clientY;
        }, { passive: true });
        panel.addEventListener('touchcancel', function () { startX = null; }, { passive: true });
        panel.addEventListener('touchend', function (e) {
            if (startX === null) return;
            var t = e.changedTouches[0];
            var dX = t.clientX - startX;
            var dY = t.clientY - startY;
            startX = null;
            if (Math.abs(dX) < 70 || Math.abs(dX) < Math.abs(dY)) return;
            if (dX < 0) cambiarMes(1); else cambiarMes(-1);
        }, { passive: true });
    }

    function irHoy() {
        var now = new Date();
        mesActual = new Date(now.getFullYear(), now.getMonth(), 1);
        diaSeleccionado = ymd(now);
        recargarMes();
    }

    window.recargarMes = recargarMes;
    window.cambiarMes = cambiarMes;
    window.irHoy = irHoy;
    window.seleccionarDia = seleccionarDia;
    window.accionRecordatorio = accionRecordatorio;
    window.posponerDesdeCal = posponerDesdeCal;
    window.guardarPosponerCal = guardarPosponerCal;

    document.addEventListener('DOMContentLoaded', function () {
        irHoy();
        if (esMovil) configurarSwipeMes();
    });
})();
