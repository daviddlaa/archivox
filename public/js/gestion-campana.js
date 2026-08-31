/**
 * Gestión de campañas — Lógica compartida del modal de guardado de gestiones.
 *
 * Comparte entre escritorio (public/desktop/js/gestion-lote.js) y móvil
 * (public/movil/js/gestion-lote.js):
 *   - guardarGestionIndividual(): guarda la gestión (POST /api/excel/gestiones),
 *     aplica el toggle de destacado de forma AISLADA (un fallo de red aquí no debe
 *     bloquear la gestión ya guardada ni invitar a reintentar y duplicar) y
 *     actualiza la tarjeta EN MEMORIA para no perder filtro, scroll ni foco.
 *   - guardarRecordatorioModal(): programa un recordatorio (POST .../recordatorios).
 *   - alternarModoRecordatorio(): muestra/oculta los campos extra de recordatorio.
 *
 * Depende de variables globales de la página: window.gestionId,
 * window.solicitudes y window.todasLasSolicitudes, y de las funciones globales
 * crearModal/cerrarModal (public/js/modal.js).
 */
(function(window) {
    'use strict';

    function buscarSolicitudGlobal(solicitudId) {
        var listas = [window.solicitudes, window.todasLasSolicitudes];
        for (var l = 0; l < listas.length; l++) {
            var lista = listas[l];
            if (!lista) continue;
            for (var i = 0; i < lista.length; i++) {
                if (String(lista[i].id_solicitud) === String(solicitudId)) return lista[i];
            }
        }
        return null;
    }

    function aplicarGestionLocal(solicitudId, datos) {
        var listas = [window.solicitudes, window.todasLasSolicitudes];
        for (var l = 0; l < listas.length; l++) {
            var lista = listas[l];
            if (!lista) continue;
            for (var i = 0; i < lista.length; i++) {
                if (String(lista[i].id_solicitud) === String(solicitudId)) {
                    if (datos.gestion_id != null) lista[i].gestion_id = datos.gestion_id;
                    if (datos.tipo_gestion != null) lista[i].tipo_gestion = datos.tipo_gestion;
                    if (datos.gestion_obs != null) lista[i].gestion_obs = datos.gestion_obs;
                    if (datos.fecha_gestion != null) lista[i].fecha_gestion = datos.fecha_gestion;
                    if (datos.recordatorio_id != null) lista[i].recordatorio_id = datos.recordatorio_id;
                    if (datos.recordatorio_canal != null) lista[i].recordatorio_canal = datos.recordatorio_canal;
                    if (datos.recordatorio_fecha != null) lista[i].recordatorio_fecha = datos.recordatorio_fecha;
                    if (datos.recordatorio_nota != null) lista[i].recordatorio_nota = datos.recordatorio_nota;
                    if (datos.recordatorio_estado != null) lista[i].recordatorio_estado = datos.recordatorio_estado;
                    if (datos.destacado != null) lista[i].destacado = datos.destacado;
                }
            }
        }
    }

    // Programar un recordatorio dentro de la campaña actual (window.gestionId)
    async function guardarRecordatorioModal(solicitudId, nota, fecha) {
        var canalEl = document.getElementById('recordatorio-canal');
        var canal = canalEl ? canalEl.value : 'Llamada';
        var response = await fetch('/api/gestiones-maestro/' + window.gestionId + '/recordatorios', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ solicitud_id: solicitudId, canal: canal, fecha_recordatorio: fecha, nota: nota || '' })
        });
        var resultado = await response.json().catch(function() { return {}; });
        if (!response.ok || resultado.error) {
            // Sin alert aquí: el catch de guardarGestionIndividual muestra un único aviso
            throw new Error(resultado.error || 'Error al programar recordatorio');
        }
        return resultado;
    }

    // Guardar la gestión del modal.
    // opciones: { solicitudId, gestionId, onConfirmar(mensaje), onCargarDatos() }
    async function guardarGestionIndividual(opciones) {
        var tipo = document.getElementById('tipo-gestion-modal').value;
        var obsEl = document.getElementById('observacion-modal');
        var observacion = obsEl ? obsEl.value.trim() : '';
        var btn = document.querySelector('.btn-guardar');

        if (tipo !== 'Recordatorio' && !observacion) {
            alert('Por favor escriba una observación');
            return;
        }
        if (btn) { btn.textContent = '💾 Guardando...'; btn.disabled = true; }

        try {
            if (tipo === 'Recordatorio') {
                var fechaRec = document.getElementById('recordatorio-fecha').value;
                if (!fechaRec) {
                    alert('Seleccione la fecha y hora del recordatorio');
                    return;
                }
                var resRec = await guardarRecordatorioModal(opciones.solicitudId, observacion, fechaRec);
                // Actualizar la tarjeta en memoria (también muestra el badge del recordatorio)
                aplicarGestionLocal(opciones.solicitudId, {
                    gestion_id: resRec.gestion_id,
                    tipo_gestion: 'Recordatorio',
                    gestion_obs: observacion,
                    recordatorio_id: resRec.id,
                    recordatorio_canal: (document.getElementById('recordatorio-canal') || {}).value || 'Llamada',
                    recordatorio_fecha: String(fechaRec).replace('T', ' '),
                    recordatorio_nota: observacion,
                    recordatorio_estado: 'pendiente'
                });
                opciones.onConfirmar('⏰ Recordatorio programado');
                cerrarModal();
                opciones.onCargarDatos();
                // Notificaciones push: ofrecer activarlas tras programar un recordatorio
                // (push-suscripcion.js escucha este evento y muestra su banner contextual)
                try {
                    document.dispatchEvent(new CustomEvent('archivox:recordatorio-guardado'));
                } catch (e) { /* push no disponible */ }
                return;
            }

            var body = {
                solicitud_id: opciones.solicitudId,
                tipo_gestion: tipo,
                observacion: observacion,
                gestion_maestro_id: opciones.gestionId || null
            };
            var response = await fetch('/api/excel/gestiones', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });
            var resultado = await response.json().catch(function() { return {}; });
            if (!response.ok || resultado.error) {
                alert('Error: ' + (resultado.error || 'Error desconocido'));
                return;
            }

            // 1) Destacado: aislado del flujo de éxito (un fallo aquí NO debe
            //    bloquear la gestión ya guardada ni invitar a reintentar y duplicar)
            var checkboxDestacar = document.getElementById('toggle-destacar');
            if (checkboxDestacar && opciones.gestionId) {
                var solActual = buscarSolicitudGlobal(opciones.solicitudId);
                var nuevoDestacado = checkboxDestacar.checked ? 1 : 0;
                if (solActual && nuevoDestacado !== (solActual.destacado || 0)) {
                    try {
                        var resDest = await fetch('/api/gestiones-maestro/' + opciones.gestionId + '/solicitudes/' + encodeURIComponent(opciones.solicitudId) + '/destacar', {
                            method: 'PUT',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ destacado: nuevoDestacado })
                        });
                        if (resDest.ok) {
                            solActual.destacado = nuevoDestacado;
                        } else {
                            console.warn('[guardarGestionIndividual] destacar no aplicado:', resDest.status);
                        }
                    } catch (e) {
                        console.warn('[guardarGestionIndividual] Error destacando:', e);
                    }
                }
            }

            // 2) Actualizar la tarjeta en memoria con la gestión recién guardada
            var data = resultado.data || {};
            aplicarGestionLocal(opciones.solicitudId, {
                gestion_id: data.id,
                tipo_gestion: data.tipo_gestion || tipo,
                gestion_obs: data.observacion != null ? data.observacion : observacion,
                fecha_gestion: data.fecha_gestion || null
            });

            // 3) Confirmar + cerrar + refresco local (conserva filtro, scroll y foco)
            var msgs = {
                'Seguimiento': 'Seguimiento registrado',
                'Cobranza': 'Cobranza registrada',
                'Completada': 'Solicitud completada',
                'Llamada': '📞 Llamada registrada',
                'Recordatorio': '⏰ Recordatorio programado'
            };
            opciones.onConfirmar(msgs[tipo] || 'Gestión guardada');
            cerrarModal();
            opciones.onCargarDatos();
        } catch (error) {
            console.error('Error guardando gestión:', error);
            alert('Error al guardar la gestión');
        } finally {
            if (btn) { btn.textContent = '💾 Guardar'; btn.disabled = false; }
        }
    }

    // Mostrar/ocultar los campos extra del modo recordatorio
    function alternarModoRecordatorio(select) {
        var block = document.getElementById('recordatorio-fields');
        if (!block) return;
        var esRecordatorio = select && select.value === 'Recordatorio';
        block.style.display = esRecordatorio ? 'block' : 'none';
        var labelObs = document.getElementById('label-observacion-modal');
        if (labelObs) {
            labelObs.textContent = esRecordatorio ? '📝 Nota (opcional):' : '📝 Observación:';
        }
    }

    window.GestionCampana = {
        guardarGestionIndividual: guardarGestionIndividual,
        guardarRecordatorioModal: guardarRecordatorioModal,
        alternarModoRecordatorio: alternarModoRecordatorio,
        // Actualiza la tarjeta en memoria tras guardar una gestión/petición sin recargar
        // toda la lista. Reutilizada por el temporizador de llamada (móvil) y el flujo
        // de seguimiento para no perder filtro, scroll ni foco.
        aplicarGestionLocal: aplicarGestionLocal
    };
})(window);
