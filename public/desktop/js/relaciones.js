// ================== ESTADO GLOBAL ==================
var estadoActual = '';
var busquedaActual = '';
var fechaDesdeActual = '';
var fechaHastaActual = '';
var paginaActual = 1;
var ordenActual = 'cliente';
var direccionActual = 'ASC';
var limite = 30;
var totalResultados = 0;
var datosActuales = [];

// ================== WHATSAPP CONFIG ==================
var PAIS_CODIGO = '593';
var PAIS_LONGITUD_MAX_SIN_CODIGO = 9;

// ================== UPLOAD DRAG & DROP ==================
var dropZone = document.getElementById('dropZone');
var fileInput = document.getElementById('fileInput');

dropZone.addEventListener('click', function() { fileInput.click(); });
dropZone.addEventListener('dragover', function(e) { e.preventDefault(); dropZone.classList.add('dragover'); });
dropZone.addEventListener('dragleave', function() { dropZone.classList.remove('dragover'); });
dropZone.addEventListener('drop', function(e) {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    if (e.dataTransfer.files.length > 0) fileInput.files = e.dataTransfer.files;
});

// ================== SUBIR EXCEL ==================
document.getElementById('formUploadRelaciones').addEventListener('submit', async function(e) {
    e.preventDefault();
    var archivo = fileInput.files[0];
    if (!archivo) { mostrarMensaje('Selecciona o arrastra un archivo Excel primero', 'error'); return; }
    var formData = new FormData();
    formData.append('archivo', archivo);
    var btn = document.getElementById('btnSubir');
    btn.disabled = true; btn.textContent = '⏳ Procesando...';
    mostrarMensaje('Procesando archivo...', 'loading');
    console.log('[Relaciones] Subiendo archivo:', archivo.name);
    try {
var response = await fetch('/api/relaciones/upload', { method: 'POST', body: formData, credentials: 'include' });
        console.log('[Relaciones] Respuesta status:', response.status);
        var data = await response.json();
        console.log('[Relaciones] Respuesta data:', data);
// Mostrar debug info prominente
        if (data.debug) {
            console.log('=== DEBUG INFO ===');
            console.log('archivo:', data.debug.archivo);
            console.log('filasProcesadas:', data.debug.filasProcesadas);
            console.log('erroresInsert:', data.debug.erroresInsert);
            console.log('primerErrorInsert:', data.debug.primerErrorInsert);
            console.log('mensajeDebug:', JSON.stringify(data.debug.mensajeDebug, null, 2));
        }
        if (!response.ok) {
            mostrarMensaje('❌ ' + (data.error || 'Error ' + response.status), 'error'); 
            console.error('[Relaciones] Error response:', data);
            btn.disabled = false; btn.textContent = '📤 Subir y Procesar'; 
            return; 
        }
        // Si total es 0, mostrar error con debug info
        var dbg = data.debug ? (data.debug.mensajeDebug || data.debug) : null;
        if (data.total === 0 && dbg) {
            var msgError = '❌ No se insertaron registros. ';
            if (dbg.erroresInsert > 0 && dbg.primerErrorInsert) {
                msgError += 'Error DB: ' + dbg.primerErrorInsert.error;
            } else if (dbg.filasProblematicas > 0 && dbg.primerProblema) {
                msgError += 'Razón: ' + dbg.primerProblema.reason + '. Fila: ' + dbg.primerProblema.row;
            } else {
                msgError += 'Excel vacío o sin datos válidos';
            }
            mostrarMensaje(msgError, 'error');
            console.error('[Relaciones] Debug completo:', dbg);
        } else {
            mostrarMensaje('✅ ' + data.total + ' registros — 🔵 ' + data.altas + ' ALTAS, 🔴 ' + data.bajas + ' BAJAS', 'success');
            document.getElementById('upload-section').style.display = 'none';
            await cargarStats();
            await cargarRelaciones();
            mostrarSecciones();
        }
    } catch (error) { 
        console.error('[Relaciones] Error:', error); 
        mostrarMensaje('❌ Error al conectar con el servidor: ' + error.message, 'error'); 
    }
    btn.disabled = false; btn.textContent = '📤 Subir y Procesar';
});

function mostrarMensaje(texto, tipo) {
    var div = document.getElementById('uploadMensaje');
    div.textContent = texto; div.className = 'upload-mensaje ' + tipo;
}

function mostrarSecciones() {
    document.getElementById('relacionesStats').style.display = 'grid';
    document.getElementById('relacionesFilters').style.display = 'block';
    document.getElementById('relacionesCards').style.display = 'block';
    document.getElementById('relacionesEmpty').style.display = 'none';
}

// ================== STATS ==================
async function cargarStats() {
    try {
        var response = await fetch('/api/relaciones/stats', { credentials: 'include' });
        var data = await response.json();
        document.getElementById('statTotal').textContent = data.total.toLocaleString();
        document.getElementById('statAltas').textContent = data.altas.toLocaleString();
        document.getElementById('statBajas').textContent = data.bajas.toLocaleString();
        document.getElementById('statOps').textContent = (Number(data.ops_altas) + Number(data.ops_bajas)).toLocaleString();
    } catch (error) { console.error('Error cargando stats:', error); }
}

// ================== LISTAR RELACIONES ==================
async function cargarRelaciones() {
    var grid = document.getElementById('cardsGrid');
    grid.innerHTML = '<div class="cards-loading">⏳ Cargando...</div>';
    try {
        var params = new URLSearchParams();
        params.append('estado', estadoActual);
        params.append('q', busquedaActual);
        params.append('fecha_desde', fechaDesdeActual);
        params.append('fecha_hasta', fechaHastaActual);
        params.append('orden', ordenActual);
        params.append('direccion', direccionActual);
        params.append('limite', limite);
        params.append('offset', (paginaActual - 1) * limite);
        var response = await fetch('/api/relaciones?' + params.toString(), { credentials: 'include' });
        var data = await response.json();
        datosActuales = data.data || [];
        totalResultados = data.total || 0;

        // Cargar últimas gestiones para todas las relaciones visibles
        if (datosActuales.length > 0) {
            await cargarUltimasGestiones(datosActuales);
        }

        renderizarCards(datosActuales);
        actualizarPaginacion();
        document.getElementById('resultCount').textContent = totalResultados + ' resultado' + (totalResultados !== 1 ? 's' : '');
        var tieneDatos = datosActuales.length > 0;
        document.getElementById('btnExportar').style.display = tieneDatos ? 'inline-block' : 'none';
        document.getElementById('btnReupload').style.display = tieneDatos ? 'inline-block' : 'none';
    } catch (error) { console.error('Error cargando relaciones:', error); grid.innerHTML = '<div class="cards-loading">❌ Error al cargar datos</div>'; }
}

// Cargar últimas gestiones en batch
async function cargarUltimasGestiones(datos) {
    var ids = datos.map(function(r) { return r.id; }).join(',');
    try {
        var response = await fetch('/api/relaciones/gestiones/ultimas?ids=' + ids, { credentials: 'include' });
        var gestiones = await response.json();
        for (var i = 0; i < datos.length; i++) {
            var g = gestiones[datos[i].id];
            if (g) {
                datos[i].gestion_id = g.id;
                datos[i].gestion_tipo = g.tipo_gestion;
                datos[i].gestion_obs = g.observacion;
                datos[i].gestion_fecha = g.fecha_gestion;
            }
        }
    } catch (error) { console.error('Error cargando gestiones batch:', error); }
}

// ================== RENDERIZAR CARDS ==================
function renderizarCards(datos) {
    var grid = document.getElementById('cardsGrid');
    if (!datos || datos.length === 0) {
        grid.innerHTML = '<div class="cards-loading" style="color:#9ca3af;">No se encontraron resultados</div>';
        return;
    }
    var html = '';
    for (var i = 0; i < datos.length; i++) {
        var r = datos[i];
        var estadoClass = r.estado_relacion === 'ALTA' ? 'estado-ALTA' : 'estado-BAJA';
        var badgeClass = r.estado_relacion === 'ALTA' ? 'badge-ALTA' : 'badge-BAJA';
        var badgeIcon = r.estado_relacion === 'ALTA' ? '🔵' : '🔴';

        var fechaFinRelacion = r.fecha_fin_relacion ? formatFecha(r.fecha_fin_relacion) : '—';
        var fechaFinCredito = r.fecha_fin_credito ? formatFecha(r.fecha_fin_credito) : '—';
        var fechaFinFidelizacion = r.fecha_fin_fidelizacion ? formatFecha(r.fecha_fin_fidelizacion) : '—';
        var proximaBaja = r.proxima_baja ? formatFecha(r.proxima_baja) : '—';
        var inicioRelacion = r.fecha_inicio_relacion ? formatFecha(r.fecha_inicio_relacion) : '—';

        var gestionada = r.gestion_id ? true : false;
        var ultimaGestion = r.gestion_tipo || '';

        var motivoHtml = '';
        if (r.estado_relacion === 'BAJA' && r.motivo_ruptura) {
            motivoHtml = '<div class="card-footer">' +
                '<span class="motivo-label">💬 Motivo:</span>' +
                '<span class="motivo-value has-content">' + escapar(r.motivo_ruptura) + '</span></div>';
        }

        html += '<div class="relacion-card ' + estadoClass + '">' +
            '<div class="card-header">' +
                '<span class="card-badge ' + badgeClass + '">' + badgeIcon + ' ' + r.estado_relacion + '</span>' +
                '<span class="card-identificacion">' + escapar(r.identificacion) + '</span>' +
                '<span class="card-ops"># ' + (r.numero_operaciones || 0) + '</span>' +
            '</div>' +
            '<div class="card-body">' +
                '<div class="card-field card-nombre">' +
                    '<span class="field-icon">👤</span>' +
                    '<span class="field-value">' + escapar(r.cliente) + '</span>' +
                '</div>' +
                '<div class="card-field">' +
                    '<span class="field-icon">📱</span>' +
                    '<span class="field-value">' + escapar(r.celular) + '</span>' +
                '</div>' +
                '<div class="card-dates">' +
                    '<div class="card-date"><span class="date-label">📅 Inicio</span><span class="date-value">' + inicioRelacion + '</span></div>' +
                    '<div class="card-date"><span class="date-label">🏁 Fin Rel.</span><span class="date-value">' + fechaFinRelacion + '</span></div>' +
                    '<div class="card-date"><span class="date-label">🏁 Fin Créd.</span><span class="date-value">' + fechaFinCredito + '</span></div>' +
                    '<div class="card-date"><span class="date-label">⏳ Próx. Baja</span><span class="date-value">' + proximaBaja + '</span></div>' +
                    '<div class="card-date"><span class="date-label">🔄 Fideliz.</span><span class="date-value">' + fechaFinFidelizacion + '</span></div>' +
                '</div>' +
            '</div>' +
            motivoHtml +
            '<div class="card-acciones">' +
                '<button class="btn-card btn-card-call" onclick="gestionarRelacion(' + r.id + ', \'Llamada\')">📞 Llamada</button>' +
                '<button class="btn-card btn-card-whatsapp" onclick="gestionarRelacion(' + r.id + ', \'WhatsApp\')">💬 WhatsApp</button>' +
                '<button class="btn-card btn-card-whatsapp-direct" onclick="abrirWhatsAppRelacion(' + r.id + ', \'' + escapar(r.celular) + '\', \'' + escapar(r.cliente) + '\')">💬 Directo</button>' +
                '<button class="btn-card btn-card-seguimiento" onclick="gestionarRelacion(' + r.id + ', \'Seguimiento\')">📋 Seguimiento</button>' +
                (gestionada ? '<button class="btn-card btn-card-ver" onclick="verGestionRelacion(' + r.id + ')">👁️ Ver (' + ultimaGestion + ')</button>' : '') +
                '<button class="btn-card btn-card-historial" onclick="verHistorialRelacion(' + r.id + ')">📋 Historial</button>' +
            '</div>' +
        '</div>';
    }
    grid.innerHTML = html;
}

function escapar(texto) {
    if (!texto) return '';
    return String(texto).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function formatFecha(fecha) {
    if (!fecha) return '';
    var partes = String(fecha).split('T');
    return partes[0];
}

// ================== FILTROS ==================
function filtrarPorEstado(estado) {
    estadoActual = estado; paginaActual = 1;
    document.querySelectorAll('.pill').forEach(function(p) { p.classList.remove('pill-active'); });
    document.querySelectorAll('.pill').forEach(function(p) {
        if (p.getAttribute('data-estado') === estado) p.classList.add('pill-active');
    });
    cargarRelaciones();
}

function buscarRelaciones() { busquedaActual = document.getElementById('searchInput').value; paginaActual = 1; cargarRelaciones(); }
function aplicarFiltros() { fechaDesdeActual = document.getElementById('fechaDesde').value; fechaHastaActual = document.getElementById('fechaHasta').value; paginaActual = 1; cargarRelaciones(); }
function limpiarFiltros() {
    document.getElementById('searchInput').value = ''; document.getElementById('fechaDesde').value = ''; document.getElementById('fechaHasta').value = '';
    busquedaActual = ''; fechaDesdeActual = ''; fechaHastaActual = ''; paginaActual = 1; cargarRelaciones();
}
function cambiarOrden() {
    var select = document.getElementById('ordenSelect');
    var partes = select.value.split('_');
    ordenActual = partes[0]; direccionActual = partes[1]; paginaActual = 1; cargarRelaciones();
}
function mostrarUpload() {
    document.getElementById('upload-section').style.display = 'block';
    document.getElementById('btnReupload').style.display = 'none';
    document.getElementById('uploadMensaje').className = 'upload-mensaje';
    document.getElementById('uploadMensaje').textContent = '';
    document.getElementById('fileInput').value = '';
}

// ================== PAGINACIÓN ==================
function cambiarPagina(delta) {
    var totalPaginas = Math.ceil(totalResultados / limite);
    var nuevaPagina = paginaActual + delta;
    if (nuevaPagina < 1 || nuevaPagina > totalPaginas) return;
    paginaActual = nuevaPagina; cargarRelaciones();
}
function actualizarPaginacion() {
    var totalPaginas = Math.ceil(totalResultados / limite);
    document.getElementById('pageInfo').textContent = 'Página ' + paginaActual + ' de ' + (totalPaginas || 1);
    document.getElementById('btnPrev').disabled = paginaActual <= 1;
    document.getElementById('btnNext').disabled = paginaActual >= totalPaginas;
}

// ================== EXPORTAR EXCEL ==================
async function exportarExcelRelaciones() { await exportarTodasLasRelaciones(); }
async function exportarTodasLasRelaciones() {
    try {
        var params = new URLSearchParams();
        params.append('estado', estadoActual); params.append('q', busquedaActual);
        params.append('fecha_desde', fechaDesdeActual); params.append('fecha_hasta', fechaHastaActual);
        params.append('orden', ordenActual); params.append('direccion', direccionActual);
        params.append('limite', 10000); params.append('offset', 0);
        var response = await fetch('/api/relaciones?' + params.toString(), { credentials: 'include' });
        var data = await response.json();
        var todos = data.data || [];
        if (!todos || todos.length === 0) { alert('No hay datos para exportar'); return; }
        var datosAExportar = [];
        for (var i = 0; i < todos.length; i++) {
            var r = todos[i];
            datosAExportar.push({
                'IDENTIFICACIÓN': r.identificacion || '', 'CLIENTE': r.cliente || '', 'CELULAR': r.celular || '',
                'ESTADO RELACIÓN': r.estado_relacion || '', 'FECHA INICIO RELACIÓN': r.fecha_inicio_relacion || '',
                'FECHA FIN RELACIÓN': r.fecha_fin_relacion || '', 'FECHA FIN CRÉDITO': r.fecha_fin_credito || '',
                'PRÓXIMA BAJA': r.proxima_baja || '', '# OPERACIONES': r.numero_operaciones || 0
            });
        }
        var ws = XLSX.utils.json_to_sheet(datosAExportar);
        var wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Relaciones');
        var nombreArchivo = 'Relaciones_' + (estadoActual || 'Todas') + '_' + new Date().toISOString().split('T')[0] + '.xlsx';
        XLSX.writeFile(wb, nombreArchivo);
    } catch (error) { console.error('Error exportando:', error); alert('Error al exportar'); }
}

// ================== GESTIÓN DE RELACIONES ==================

// Abrir modal de gestión para una relación
function gestionarRelacion(relacionId, tipo) {
    var r = datosActuales.find(function(d) { return d.id == relacionId; });
    if (!r) { alert('Relación no encontrada'); return; }

    var tipos = ['Llamada', 'WhatsApp', 'Seguimiento', 'Cobranza', 'Cita', 'Completada', 'Otro'];
    var opciones = '';
    for (var i = 0; i < tipos.length; i++) {
        opciones += '<option value="' + tipos[i] + '" ' + (tipos[i] === tipo ? 'selected' : '') + '>' + tipos[i] + '</option>';
    }

    var contenido = '<div class="modal-gestion">' +
        '<h2>📋 Gestionar Relación</h2>' +
        '<div class="modal-info">' +
            '<p><strong>Cliente:</strong> ' + escapar(r.cliente) + '</p>' +
            '<p><strong>Identificación:</strong> ' + escapar(r.identificacion) + '</p>' +
            '<p><strong>Celular:</strong> ' + escapar(r.celular) + '</p>' +
        '</div>' +
        '<div class="modal-form">' +
            '<label>📋 Tipo de Gestión:</label>' +
            '<select id="tipo-gestion-modal">' + opciones + '</select>' +
            '<label>📝 Observación:</label>' +
            '<textarea id="observacion-modal" rows="4" placeholder="Escriba su observación..."></textarea>' +
            '<div class="modal-botones">' +
                '<button class="btn-cancelar" onclick="cerrarModal()">Cancelar</button>' +
                '<button class="btn-guardar" onclick="guardarGestionRelacion(' + relacionId + ')">💾 Guardar</button>' +
            '</div>' +
        '</div></div>';

    crearModal(contenido);
}

// Guardar gestión de relación
async function guardarGestionRelacion(relacionId) {
    var tipo = document.getElementById('tipo-gestion-modal').value;
    var observacion = document.getElementById('observacion-modal').value.trim();
    if (!observacion) { alert('Por favor escriba una observación'); return; }

    var btn = document.querySelector('.btn-guardar');
    btn.textContent = '💾 Guardando...'; btn.disabled = true;
    try {
        var response = await fetch('/api/relaciones/gestiones', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ relacion_id: relacionId, tipo_gestion: tipo, observacion: observacion })
        });
        var resultado = await response.json();
        if (response.ok && !resultado.error) {
            alert('✅ Gestión guardada correctamente');
            cerrarModal();
            await cargarRelaciones();
        } else {
            alert('Error: ' + (resultado.error || 'Error desconocido'));
        }
    } catch (error) {
        console.error('Error guardando:', error);
        alert('Error al guardar la gestión');
    } finally {
        btn.textContent = '💾 Guardar'; btn.disabled = false;
    }
}

// Ver última gestión
async function verGestionRelacion(relacionId) {
    try {
        var response = await fetch('/api/relaciones/gestiones/' + relacionId, { credentials: 'include' });
        var gestiones = await response.json();
        if (!gestiones || gestiones.length === 0) { alert('No hay gestión registrada'); return; }
        var g = gestiones[0];
        var contenido = '<div class="modal-gestion">' +
            '<h2>📋 Última Gestión</h2>' +
            '<div class="modal-info">' +
                '<p><strong>Tipo:</strong> ' + (g.tipo_gestion || '—') + '</p>' +
                '<p><strong>Fecha:</strong> ' + (g.fecha_gestion || '—') + '</p>' +
                '<p><strong>Observación:</strong></p>' +
                '<div class="modal-observacion">' + (g.observacion || 'Sin observación') + '</div>' +
            '</div>' +
            '<button class="btn-cerrar" onclick="cerrarModal()" style="margin-top:12px;padding:8px 20px;background:#f3f4f6;border:none;border-radius:8px;cursor:pointer;">Cerrar</button>' +
        '</div>';
        crearModal(contenido);
    } catch (error) { console.error('Error:', error); alert('Error al cargar gestión'); }
}

// Ver historial completo
async function verHistorialRelacion(relacionId) {
    crearModal('<div class="modal-gestion" style="text-align:center;padding:30px;"><h2>📋 Historial</h2><p>⏳ Cargando...</p></div>');
    try {
        var response = await fetch('/api/relaciones/gestiones/' + relacionId, { credentials: 'include' });
        var gestiones = await response.json();
        var contenido = '<div class="modal-gestion"><h2 style="margin-top:0;">📋 Historial de Gestión</h2>';
        if (!gestiones || gestiones.length === 0) {
            contenido += '<div style="text-align:center;padding:20px;color:#6b7280;">No hay gestiones registradas</div>';
        } else {
            contenido += '<div style="margin-bottom:12px;color:#6b7280;font-size:13px;">📊 Total: ' + gestiones.length + ' gestión(es)</div>';
            contenido += '<div style="max-height:450px;overflow-y:auto;">';
            for (var i = 0; i < gestiones.length; i++) {
                var g = gestiones[i];
                var fecha = g.fecha_gestion ? new Date(g.fecha_gestion).toLocaleString('es-ES') : '—';
                var colores = { 'Llamada': '#d1fae5', 'WhatsApp': '#dcfce7', 'Seguimiento': '#dbeafe', 'Cobranza': '#fee2e2', 'Cita': '#e0e7ff', 'Completada': '#bbf7d0' };
                var color = colores[g.tipo_gestion] || '#f3f4f6';
                contenido += '<div style="display:flex;gap:15px;position:relative;">' +
                    '<div style="display:flex;flex-direction:column;align-items:center;">' +
                        '<div style="width:14px;height:14px;border-radius:50%;background:' + color + ';border:2px solid #9ca3af;flex-shrink:0;"></div>' +
                        (i < gestiones.length - 1 ? '<div style="width:2px;flex:1;background:#e5e7eb;margin:4px 0;"></div>' : '') +
                    '</div>' +
                    '<div style="flex:1;padding-bottom:' + (i < gestiones.length - 1 ? '16px' : '0') + ';">' +
                        '<div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;flex-wrap:wrap;">' +
                            '<span style="background:' + color + ';padding:2px 10px;border-radius:12px;font-size:11px;font-weight:600;">' + g.tipo_gestion + '</span>' +
                            '<span style="font-size:11px;color:#9ca3af;">' + fecha + '</span>' +
                        '</div>' +
                        '<div style="background:#f9fafb;padding:10px 12px;border-radius:8px;font-size:13px;color:#374151;">' + (g.observacion || 'Sin observación') + '</div>' +
                    '</div></div>';
            }
            contenido += '</div>';
        }
        contenido += '<div style="margin-top:16px;text-align:right;"><button class="btn-cerrar" onclick="cerrarModal()" style="padding:8px 20px;background:#f3f4f6;border:none;border-radius:8px;cursor:pointer;">Cerrar</button></div></div>';
        cerrarModal();
        crearModal(contenido);
    } catch (error) { cerrarModal(); alert('Error al cargar historial'); }
}

// ================== WHATSAPP DIRECTO ==================
function formatearNumeroWhatsApp(celular) {
    var numero = String(celular).replace(/[^0-9]/g, '').replace(/^0+/, '');
    return numero.length > PAIS_LONGITUD_MAX_SIN_CODIGO ? numero : PAIS_CODIGO + numero;
}

function obtenerPrimerNombre(nombreCompleto) {
    if (!nombreCompleto) return '';
    var partes = nombreCompleto.trim().split(/\s+/);
    return partes[0] || '';
}

function generarMensajeWhatsApp(nombreCompleto) {
    var primerNombre = obtenerPrimerNombre(nombreCompleto);
    var saludo = primerNombre ? 'Hola ' + primerNombre + ' 👋' : 'Hola 👋';
    return saludo + '\nCrédito Resuelve a las órdenes 💳✨\n\nTu crédito rescate esta aprobado con solo el 15% de entrada 🙌\nQué necesitas para tu hogar?, te ayudamos a hacerlo posible 📲';
}

function abrirWhatsAppRelacion(relacionId, celular, cliente) {
    if (!celular) { alert('Esta relación no tiene número de celular'); return; }
    var contenido = '<div class="modal-gestion">' +
        '<h2>💬 WhatsApp Directo</h2>' +
        '<div class="modal-info">' +
            '<p><strong>Cliente:</strong> ' + escapar(cliente) + '</p>' +
            '<p><strong>Celular:</strong> ' + celular + '</p>' +
        '</div>' +
        '<div class="modal-form">' +
            '<label>📝 Mensaje:</label>' +
            '<textarea id="whatsapp-mensaje" rows="5" placeholder="Escriba su mensaje..." style="margin-bottom:12px;">' + generarMensajeWhatsApp(cliente) + '</textarea>' +
            '<div class="modal-botones">' +
                '<button class="btn-cancelar" onclick="cerrarModal()">Cancelar</button>' +
                '<button class="btn-guardar" onclick="enviarWhatsAppRelacion(' + relacionId + ', \'' + celular + '\')">📤 Enviar</button>' +
            '</div>' +
        '</div></div>';
    crearModal(contenido);
}

async function enviarWhatsAppRelacion(relacionId, celular) {
    var mensaje = document.getElementById('whatsapp-mensaje').value.trim();
    if (!mensaje) { alert('Escriba un mensaje para enviar'); return; }
    var btn = document.querySelector('.btn-guardar');
    btn.textContent = '⏳ Enviando...'; btn.disabled = true;
    try {
        // Guardar gestión
        var response = await fetch('/api/relaciones/gestiones', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ relacion_id: relacionId, tipo_gestion: 'WhatsApp', observacion: mensaje })
        });
        var resultado = await response.json();
        if (!response.ok || resultado.error) throw new Error(resultado.error || 'Error');
        // Abrir WhatsApp Web
        var numeroFormateado = formatearNumeroWhatsApp(celular);
        var urlWhatsApp = 'https://wa.me/' + numeroFormateado + '?text=' + encodeURIComponent(mensaje);
        window.open(urlWhatsApp, '_blank');
        alert('✅ Mensaje enviado y gestión guardada');
        cerrarModal();
        await cargarRelaciones();
    } catch (error) { alert('Error: ' + error.message); }
    finally { btn.textContent = '📤 Enviar'; btn.disabled = false; }
}

// ================== MODAL ==================
function crearModal(contenido) {
    var existente = document.getElementById('modal-generico');
    if (existente) existente.remove();
    var overlay = document.createElement('div');
    overlay.id = 'modal-generico';
    overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);z-index:9999;display:flex;align-items:center;justify-content:center;';
    var modal = document.createElement('div');
    modal.style.cssText = 'background:white;border-radius:16px;max-width:600px;width:90%;max-height:90vh;overflow:auto;box-shadow:0 20px 60px rgba(0,0,0,0.4);padding:30px;';
    modal.innerHTML = contenido;
    overlay.onclick = function(e) { if (e.target === overlay) cerrarModal(); };
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
}

function cerrarModal() {
    var modal = document.getElementById('modal-generico');
    if (modal) modal.remove();
}

// ================== INICIO ==================
async function iniciar() {
    try {
        var response = await fetch('/api/relaciones/stats', { credentials: 'include' });
        var stats = await response.json();
        if (stats.total > 0) {
            document.getElementById('upload-section').style.display = 'none';
            await cargarStats();
            await cargarRelaciones();
            mostrarSecciones();
        }
    } catch (error) { console.error('Error al iniciar:', error); }
}

iniciar();
