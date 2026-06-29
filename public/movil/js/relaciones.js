// ================== ESTADO GLOBAL ==================
var estadoActualMovil = '';
var busquedaActualMovil = '';
var fechaDesdeActualMovil = '';
var fechaHastaActualMovil = '';
var datosActualesMovil = [];

// ================== WHATSAPP CONFIG ==================
var PAIS_CODIGO = '593';
var PAIS_LONGITUD_MAX_SIN_CODIGO = 9;

// ================== UPLOAD ==================
var dropZoneMovil = document.getElementById('dropZoneMovil');
var fileInputMovil = document.getElementById('fileInputMovil');

dropZoneMovil.addEventListener('click', function() { fileInputMovil.click(); });
dropZoneMovil.addEventListener('dragover', function(e) { e.preventDefault(); dropZoneMovil.classList.add('dragover'); });
dropZoneMovil.addEventListener('dragleave', function() { dropZoneMovil.classList.remove('dragover'); });
dropZoneMovil.addEventListener('drop', function(e) {
    e.preventDefault(); dropZoneMovil.classList.remove('dragover');
    if (e.dataTransfer.files.length > 0) fileInputMovil.files = e.dataTransfer.files;
});

document.getElementById('formUploadRelacionesMovil').addEventListener('submit', async function(e) {
    e.preventDefault();
    var archivo = fileInputMovil.files[0];
    if (!archivo) { mostrarMensajeMovil('Selecciona un archivo Excel primero', 'error'); return; }
    var formData = new FormData();
    formData.append('archivo', archivo);
    var btn = document.getElementById('btnSubirMovil');
    btn.disabled = true; btn.textContent = '⏳ Procesando...';
    mostrarMensajeMovil('Procesando archivo...', 'loading');
    console.log('[Relaciones] Subiendo archivo:', archivo.name);
    try {
var response = await fetch('/api/relaciones/upload', { method: 'POST', body: formData, credentials: 'include' });
        console.log('[Relaciones] Respuesta status:', response.status);
        var data = await response.json();
        console.log('[Relaciones] Respuesta data:', data);
        // Mostrar debug info prominente
        if (data.debug) {
            console.log('=== DEBUG INFO ===');
            console.log(data.debug);
        }
        if (!response.ok) {
            mostrarMensajeMovil('❌ ' + (data.error || 'Error ' + response.status), 'error'); 
            console.error('[Relaciones] Error response:', data);
            btn.disabled = false; btn.textContent = '📤 Subir y Procesar'; 
            return; 
        }
// Si total es 0, mostrar error con debug info
        if (data.total === 0 && data.debug && data.debug.mensajeDebug) {
            var dbg = data.debug.mensajeDebug;
            var msgError = '❌ No se procesaron registros. Razón: ';
            if (dbg.filasProblematicas > 0 && dbg.primerProblema) {
                msgError += dbg.primerProblema.reason + '. Fila: ' + dbg.primerProblema.row;
            } else {
                msgError += 'Excel vacío o sin datos válidos';
            }
            mostrarMensajeMovil(msgError, 'error');
            console.error('[Relaciones] Debug completo:', dbg);
        } else {
            mostrarMensajeMovil('✅ ' + data.total + ' registros — 🔵 ' + data.altas + ' ALTAS, 🔴 ' + data.bajas + ' BAJAS', 'success');
            document.getElementById('uploadSectionMovil').style.display = 'none';
            await cargarStatsMovil(); await cargarRelacionesMovil(); mostrarSeccionesMovil();
        }
    } catch (error) { 
        console.error('[Relaciones] Error:', error); 
        mostrarMensajeMovil('❌ Error de conexión: ' + error.message, 'error'); 
    }
    btn.disabled = false; btn.textContent = '📤 Subir y Procesar';
});

function mostrarMensajeMovil(texto, tipo) {
    var div = document.getElementById('uploadMensajeMovil');
    div.textContent = texto; div.className = 'upload-msg ' + tipo;
}

function mostrarSeccionesMovil() {
    document.getElementById('statsMovil').style.display = 'grid';
    document.getElementById('filtersMovil').style.display = 'block';
    document.getElementById('cardsSectionMovil').style.display = 'block';
    document.getElementById('emptyMovil').style.display = 'none';
}

// ================== STATS ==================
async function cargarStatsMovil() {
    try {
        var response = await fetch('/api/relaciones/stats', { credentials: 'include' });
        var data = await response.json();
        document.getElementById('statTotalMovil').textContent = data.total;
        document.getElementById('statAltasMovil').textContent = data.altas;
        document.getElementById('statBajasMovil').textContent = data.bajas;
        document.getElementById('statOpsMovil').textContent = Number(data.ops_altas) + Number(data.ops_bajas);
    } catch (error) { console.error('Error stats:', error); }
}

// ================== LISTAR ==================
async function cargarRelacionesMovil() {
    var grid = document.getElementById('cardsGridMovil');
    grid.innerHTML = '<div style="text-align:center;padding:20px;color:#6366f1;">⏳ Cargando...</div>';
    try {
        var params = new URLSearchParams();
        params.append('estado', estadoActualMovil); params.append('q', busquedaActualMovil);
        params.append('fecha_desde', fechaDesdeActualMovil); params.append('fecha_hasta', fechaHastaActualMovil);
        params.append('orden', 'cliente'); params.append('direccion', 'ASC');
        params.append('limite', 200); params.append('offset', 0);
        var response = await fetch('/api/relaciones?' + params.toString(), { credentials: 'include' });
        var data = await response.json();
        datosActualesMovil = data.data || [];

        // Cargar últimas gestiones batch
        if (datosActualesMovil.length > 0) {
            var ids = datosActualesMovil.map(function(r) { return r.id; }).join(',');
            try {
                var resG = await fetch('/api/relaciones/gestiones/ultimas?ids=' + ids, { credentials: 'include' });
                var gestiones = await resG.json();
                for (var i = 0; i < datosActualesMovil.length; i++) {
                    var g = gestiones[datosActualesMovil[i].id];
                    if (g) { datosActualesMovil[i].gestion_id = g.id; datosActualesMovil[i].gestion_tipo = g.tipo_gestion; }
                }
            } catch (e) { console.error('Error batch gestiones:', e); }
        }

        renderizarCardsMovil(datosActualesMovil);
        var total = data.total || 0;
        document.getElementById('resultCountMovil').textContent = total + ' resultado' + (total !== 1 ? 's' : '');
        var tieneDatos = datosActualesMovil.length > 0;
        document.getElementById('btnExportarMovil').style.display = tieneDatos ? 'inline-block' : 'none';
        document.getElementById('btnReuploadMovil').style.display = tieneDatos ? 'inline-block' : 'none';
    } catch (error) {
        console.error('Error cargando:', error);
        grid.innerHTML = '<div style="text-align:center;padding:20px;color:#ef4444;">❌ Error al cargar</div>';
    }
}

// ================== RENDERIZAR CARDS MÓVIL ==================
function renderizarCardsMovil(datos) {
    var grid = document.getElementById('cardsGridMovil');
    if (!datos || datos.length === 0) {
        grid.innerHTML = '<div style="text-align:center;padding:20px;color:#9ca3af;">Sin resultados</div>';
        return;
    }
    var html = '';
    for (var i = 0; i < datos.length; i++) {
        var r = datos[i];
        var estadoClass = r.estado_relacion === 'ALTA' ? 'estado-ALTA' : 'estado-BAJA';
        var badgeClass = r.estado_relacion === 'ALTA' ? 'badge-ALTA' : 'badge-BAJA';
        var badgeIcon = r.estado_relacion === 'ALTA' ? '🔵' : '🔴';
        var gestionada = r.gestion_id ? true : false;

        var inicioRelacion = r.fecha_inicio_relacion ? formatFechaMovil(r.fecha_inicio_relacion) : '—';
        var fechaFinCredito = r.fecha_fin_credito ? formatFechaMovil(r.fecha_fin_credito) : '—';
        var proximaBaja = r.proxima_baja ? formatFechaMovil(r.proxima_baja) : '—';

        html += '<div class="card-movil ' + estadoClass + '">' +
            '<div class="card-movil-header">' +
                '<span class="badge-movil ' + badgeClass + '">' + badgeIcon + ' ' + r.estado_relacion + '</span>' +
                '<span class="card-movil-id">' + escaparMovil(r.identificacion) + '</span>' +
                '<span class="card-movil-ops">#' + (r.numero_operaciones || 0) + '</span>' +
            '</div>' +
            '<div class="card-movil-body">' +
                '<div class="card-movil-nombre">👤 ' + escaparMovil(r.cliente) + '</div>' +
                '<div class="card-movil-telefono">📱 ' + escaparMovil(r.celular) + '</div>' +
                '<div class="card-movil-fechas">' +
                    '<span>📅 ' + inicioRelacion + '</span>' +
                    '<span>🏁 ' + fechaFinCredito + '</span>' +
                    '<span>⏳ ' + proximaBaja + '</span>' +
                '</div>' +
            '</div>' +
            '<div class="card-movil-acciones">' +
                '<button class="btn-sm-movil btn-sm-call" onclick="llamarRelacionMovil(\'' + escaparMovil(r.celular) + '\')">📞</button>' +
                '<button class="btn-sm-movil btn-sm-whatsapp" onclick="gestionarRelacionMovil(' + r.id + ', \'WhatsApp\')">💬</button>' +
                '<button class="btn-sm-movil btn-sm-direct" onclick="abrirWhatsAppRelacionMovil(' + r.id + ', \'' + escaparMovil(r.celular) + '\', \'' + escaparMovil(r.cliente) + '\')">💬→</button>' +
                (gestionada ? '<button class="btn-sm-movil btn-sm-ver" onclick="verGestionRelacionMovil(' + r.id + ')">👁️</button>' : '') +
                '<button class="btn-sm-movil btn-sm-historial" onclick="verHistorialRelacionMovil(' + r.id + ')">📋</button>' +
            '</div>' +
        '</div>';
    }
    grid.innerHTML = html;
}

function escaparMovil(texto) {
    if (!texto) return '';
    return String(texto).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function formatFechaMovil(fecha) {
    if (!fecha) return '';
    var partes = String(fecha).split('T');
    return partes[0];
}

// ================== FILTROS ==================
function filtrarPorEstadoMovil(estado) {
    estadoActualMovil = estado;
    document.querySelectorAll('#filtersMovil .pill').forEach(function(p) { p.classList.remove('pill-active'); });
    document.querySelectorAll('#filtersMovil .pill').forEach(function(p) {
        if (p.getAttribute('data-estado') === estado) p.classList.add('pill-active');
    });
    cargarRelacionesMovil();
}

function buscarRelacionesMovil() { busquedaActualMovil = document.getElementById('searchInputMovil').value; cargarRelacionesMovil(); }
function aplicarFiltrosMovil() { fechaDesdeActualMovil = document.getElementById('fechaDesdeMovil').value; fechaHastaActualMovil = document.getElementById('fechaHastaMovil').value; cargarRelacionesMovil(); }
function mostrarUploadMovil() {
    document.getElementById('uploadSectionMovil').style.display = 'block';
    document.getElementById('btnReuploadMovil').style.display = 'none';
    document.getElementById('uploadMensajeMovil').className = 'upload-msg';
    document.getElementById('uploadMensajeMovil').textContent = '';
    document.getElementById('fileInputMovil').value = '';
}

// ================== EXPORTAR ==================
async function exportarExcelRelacionesMovil() {
    try {
        var params = new URLSearchParams();
        params.append('estado', estadoActualMovil); params.append('q', busquedaActualMovil);
        params.append('fecha_desde', fechaDesdeActualMovil); params.append('fecha_hasta', fechaHastaActualMovil);
        params.append('orden', 'cliente'); params.append('direccion', 'ASC');
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
                '# OPERACIONES': r.numero_operaciones || 0
            });
        }
        var ws = XLSX.utils.json_to_sheet(datosAExportar);
        var wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Relaciones');
        var nombreArchivo = 'Relaciones_' + (estadoActualMovil || 'Todas') + '_' + new Date().toISOString().split('T')[0] + '.xlsx';
        XLSX.writeFile(wb, nombreArchivo);
    } catch (error) { console.error('Error exportando:', error); alert('Error al exportar'); }
}

// ================== GESTIÓN MÓVIL ==================
function gestionarRelacionMovil(relacionId, tipo) {
    var r = datosActualesMovil.find(function(d) { return d.id == relacionId; });
    if (!r) { alert('Relación no encontrada'); return; }
    var tipos = ['Llamada', 'WhatsApp', 'Seguimiento', 'Cobranza', 'Cita', 'Completada', 'Otro'];
    var opciones = '';
    for (var i = 0; i < tipos.length; i++) { opciones += '<option value="' + tipos[i] + '" ' + (tipos[i] === tipo ? 'selected' : '') + '>' + tipos[i] + '</option>'; }
    var contenido = '<div class="modal-gestion">' +
        '<h2 style="font-size:16px;">📋 Gestionar</h2>' +
        '<div class="modal-info"><p><strong>' + escaparMovil(r.cliente) + '</strong></p><p>' + escaparMovil(r.identificacion) + ' | 📱 ' + escaparMovil(r.celular) + '</p></div>' +
        '<div class="modal-form">' +
            '<label>📋 Tipo:</label><select id="tipo-gestion-modal-movil">' + opciones + '</select>' +
            '<label>📝 Observación:</label><textarea id="observacion-modal-movil" rows="3" placeholder="Escriba su observación..."></textarea>' +
            '<div class="modal-botones" style="display:flex;gap:8px;margin-top:12px;">' +
                '<button class="btn-cancelar" onclick="cerrarModalMovil()" style="flex:1;padding:10px;background:#f3f4f6;border:none;border-radius:8px;">Cancelar</button>' +
                '<button class="btn-guardar" onclick="guardarGestionRelacionMovil(' + relacionId + ')" style="flex:1;padding:10px;background:#6366f1;color:white;border:none;border-radius:8px;">💾 Guardar</button>' +
            '</div>' +
        '</div></div>';
    crearModalMovil(contenido);
}

async function guardarGestionRelacionMovil(relacionId) {
    var tipo = document.getElementById('tipo-gestion-modal-movil').value;
    var observacion = document.getElementById('observacion-modal-movil').value.trim();
    if (!observacion) { alert('Escriba una observación'); return; }
    try {
        var response = await fetch('/api/relaciones/gestiones', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ relacion_id: relacionId, tipo_gestion: tipo, observacion: observacion })
        });
        var resultado = await response.json();
        if (response.ok && !resultado.error) {
            alert('✅ Gestión guardada'); cerrarModalMovil(); await cargarRelacionesMovil();
        } else { alert('Error: ' + (resultado.error || 'Error')); }
    } catch (error) { console.error('Error:', error); alert('Error al guardar'); }
}

async function verGestionRelacionMovil(relacionId) {
    try {
        var response = await fetch('/api/relaciones/gestiones/' + relacionId, { credentials: 'include' });
        var gestiones = await response.json();
        if (!gestiones || gestiones.length === 0) { alert('No hay gestión'); return; }
        var g = gestiones[0];
        var contenido = '<div class="modal-gestion"><h2 style="font-size:16px;">👁️ Última Gestión</h2>' +
            '<div class="modal-info"><p><strong>' + g.tipo_gestion + '</strong> — ' + (g.fecha_gestion || '') + '</p>' +
            '<div style="background:#f9fafb;padding:10px;border-radius:8px;margin-top:8px;font-size:13px;">' + (g.observacion || 'Sin obs') + '</div></div>' +
            '<button onclick="cerrarModalMovil()" style="margin-top:12px;width:100%;padding:10px;background:#f3f4f6;border:none;border-radius:8px;">Cerrar</button></div>';
        crearModalMovil(contenido);
    } catch (error) { alert('Error al cargar'); }
}

async function verHistorialRelacionMovil(relacionId) {
    crearModalMovil('<div class="modal-gestion" style="text-align:center;padding:20px;"><p>⏳ Cargando...</p></div>');
    try {
        var response = await fetch('/api/relaciones/gestiones/' + relacionId, { credentials: 'include' });
        var gestiones = await response.json();
        var contenido = '<div class="modal-gestion"><h2 style="font-size:16px;margin-top:0;">📋 Historial</h2>';
        if (!gestiones || gestiones.length === 0) { contenido += '<p style="text-align:center;color:#6b7280;">Sin gestiones</p>'; }
        else {
            for (var i = 0; i < gestiones.length; i++) {
                var g = gestiones[i];
                var colores = { 'Llamada': '#d1fae5', 'WhatsApp': '#dcfce7', 'Seguimiento': '#dbeafe', 'Cobranza': '#fee2e2' };
                var color = colores[g.tipo_gestion] || '#f3f4f6';
                contenido += '<div style="display:flex;gap:10px;margin-bottom:8px;">' +
                    '<div style="width:10px;height:10px;border-radius:50%;background:' + color + ';margin-top:4px;flex-shrink:0;"></div>' +
                    '<div><span style="background:' + color + ';padding:1px 8px;border-radius:8px;font-size:10px;font-weight:600;">' + g.tipo_gestion + '</span>' +
                    '<div style="font-size:12px;color:#374151;margin-top:4px;">' + (g.observacion || '') + '</div></div></div>';
            }
        }
        contenido += '<button onclick="cerrarModalMovil()" style="margin-top:12px;width:100%;padding:10px;background:#f3f4f6;border:none;border-radius:8px;">Cerrar</button></div>';
        cerrarModalMovil(); crearModalMovil(contenido);
    } catch (error) { cerrarModalMovil(); alert('Error al cargar'); }
}

// ================== LLAMADA MÓVIL ==================
function llamarRelacionMovil(celular) {
    if (!celular) {
        alert('No hay número de celular');
        return;
    }
    var numeroLimpio = String(celular).replace(/\D/g, '');
    window.location.href = 'tel:' + numeroLimpio;
}

// ================== WHATSAPP MÓVIL ==================
function formatearNumeroWhatsAppMovil(celular) {
    var numero = String(celular).replace(/[^0-9]/g, '').replace(/^0+/, '');
    return numero.length > PAIS_LONGITUD_MAX_SIN_CODIGO ? numero : PAIS_CODIGO + numero;
}

function obtenerPrimerNombreMovil(nombreCompleto) {
    if (!nombreCompleto) return '';
    return nombreCompleto.trim().split(/\s+/)[0] || '';
}

function generarMensajeWhatsAppMovil(nombreCompleto) {
    var nombre = obtenerPrimerNombreMovil(nombreCompleto);
    var saludo = nombre ? 'Hola ' + nombre + ' 👋' : 'Hola 👋';
    return saludo + '\nCrédito Resuelve a las órdenes 💳✨\n\nTu crédito rescate esta aprobado con solo el 15% de entrada 🙌\nQué necesitas para tu hogar?, te ayudamos a hacerlo posible 📲';
}

function abrirWhatsAppRelacionMovil(relacionId, celular, cliente) {
    if (!celular) { alert('Sin número de celular'); return; }
    var contenido = '<div class="modal-gestion"><h2 style="font-size:16px;">💬 WhatsApp</h2>' +
        '<div class="modal-info"><p><strong>' + escaparMovil(cliente) + '</strong> | 📱 ' + celular + '</p></div>' +
        '<div class="modal-form">' +
            '<label>📝 Mensaje:</label>' +
            '<textarea id="whatsapp-mensaje-movil" rows="4" style="margin-bottom:10px;">' + generarMensajeWhatsAppMovil(cliente) + '</textarea>' +
            '<div style="display:flex;gap:8px;">' +
                '<button onclick="cerrarModalMovil()" style="flex:1;padding:10px;background:#f3f4f6;border:none;border-radius:8px;">Cancelar</button>' +
                '<button onclick="enviarWhatsAppRelacionMovil(' + relacionId + ',\'' + celular + '\')" style="flex:1;padding:10px;background:#25d366;color:white;border:none;border-radius:8px;">📤 Enviar</button>' +
            '</div>' +
        '</div></div>';
    crearModalMovil(contenido);
}

async function enviarWhatsAppRelacionMovil(relacionId, celular) {
    var mensaje = document.getElementById('whatsapp-mensaje-movil').value.trim();
    if (!mensaje) { alert('Escriba un mensaje'); return; }
    try {
        var response = await fetch('/api/relaciones/gestiones', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ relacion_id: relacionId, tipo_gestion: 'WhatsApp', observacion: mensaje })
        });
        var resultado = await response.json();
        if (!response.ok || resultado.error) throw new Error(resultado.error || 'Error');
        var numero = formatearNumeroWhatsAppMovil(celular);
        window.open('whatsapp://send?phone=' + numero + '&text=' + encodeURIComponent(mensaje), '_blank');
        alert('✅ Gestión guardada');
        cerrarModalMovil(); await cargarRelacionesMovil();
    } catch (error) { alert('Error: ' + error.message); }
}

// ================== MODAL MÓVIL ==================
function crearModalMovil(contenido) {
    var existente = document.getElementById('modal-generico-movil');
    if (existente) existente.remove();
    var overlay = document.createElement('div');
    overlay.id = 'modal-generico-movil';
    overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);z-index:9999;display:flex;align-items:center;justify-content:center;';
    var modal = document.createElement('div');
    modal.style.cssText = 'background:white;border-radius:14px;max-width:500px;width:92%;max-height:85vh;overflow:auto;box-shadow:0 10px 40px rgba(0,0,0,0.3);padding:20px;';
    modal.innerHTML = contenido;
    overlay.onclick = function(e) { if (e.target === overlay) cerrarModalMovil(); };
    overlay.appendChild(modal); document.body.appendChild(overlay);
}

function cerrarModalMovil() {
    var modal = document.getElementById('modal-generico-movil');
    if (modal) modal.remove();
}

// ================== INICIO ==================
async function iniciarMovil() {
    try {
        var response = await fetch('/api/relaciones/stats', { credentials: 'include' });
        var stats = await response.json();
        if (stats.total > 0) {
            document.getElementById('uploadSectionMovil').style.display = 'none';
            await cargarStatsMovil(); await cargarRelacionesMovil(); mostrarSeccionesMovil();
        }
    } catch (error) { console.error('Error al iniciar:', error); }
}

iniciarMovil();
