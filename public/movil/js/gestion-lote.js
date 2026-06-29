console.log('Cargando movil/gestion-lote.js...');

var gestionId = null;
var datosGestion = null;
var solicitudes = [];
var todasLasSolicitudes = [];
var campañas = [];

function obtenerGestionId() {
    var urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('id');
}

async function init() {
    console.log('[movil-init] Iniciando carga de gestion-lote...');
    try {
        await cargarListaCampanas();
        console.log('[movil-init] Campañas cargadas');

        gestionId = obtenerGestionId();
        console.log('[movil-init] gestionId:', gestionId);
        
        if (gestionId) {
            await cargarDatosGestionMovil();
            marcarCampañaActiva(gestionId);
            console.log('[movil-init] Carga completa');
        }
    } catch (error) {
        console.error('[movil-init] Error:', error);
    }
}

async function cargarListaCampanas() {
    try {
        console.log('[movil-campanas] Fetching campaigns...');
        var container = document.getElementById('lista-campañas');
        
        var controller = new AbortController();
        var timeoutId = setTimeout(function() { controller.abort(); }, 10000);
        var response = await fetch('/api/gestiones-maestro', { signal: controller.signal });
        clearTimeout(timeoutId);
        
        console.log('[movil-campanas] Response:', response.status);
        if (!response.ok) throw new Error('Error al cargar campañas (status: ' + response.status + ')');
        campañas = await response.json();

        if (!campañas || campañas.length === 0) {
            container.innerHTML = '<div class="sin-campana"><div class="sin-campana-icon">📋</div><p>No hay campañas. Ve a Solicitudes para crear una.</p></div>';
            return;
        }

        var html = '';
        for (var i = 0; i < campañas.length; i++) {
            var g = campañas[i];
            var pct = g.total_solicitudes > 0 ? Math.round((g.gestionadas / g.total_solicitudes) * 100) : 0;
            var isActive = gestionId && String(g.id) === String(gestionId) ? 'active' : '';

            html += '<div class="campaña-chip ' + isActive + '" onclick="seleccionarCampaña(' + g.id + ')">';
            html += '<div class="campaña-chip-nombre">' + (g.nombre || 'Sin nombre') + '</div>';
            html += '<div class="campaña-chip-stats">';
            html += '<span>📄 ' + (g.total_solicitudes || 0) + '</span>';
            html += '<span>✓ ' + (g.gestionadas || 0) + '</span>';
            html += '<span>' + pct + '%</span>';
            html += '</div>';
            html += '</div>';
        }

        container.innerHTML = html;
    } catch (error) {
        console.error('Error cargando campañas:', error);
        var container = document.getElementById('lista-campañas');
        if (container) container.innerHTML = '<div class="sin-campana"><p>Error al cargar campañas</p></div>';
    }
}

function seleccionarCampaña(id) {
    gestionId = id;
    marcarCampañaActiva(id);
    window.location.href = '/m/gestion-lote?id=' + id;
}

function marcarCampañaActiva(id) {
    var chips = document.querySelectorAll('.campaña-chip');
    chips.forEach(function(c) { c.classList.remove('active'); });
    var chip = document.querySelector('.campaña-chip[onclick="seleccionarCampaña(' + id + ')"]');
    if (chip) {
        chip.classList.add('active');
        // Desplazar el chip al centro del scroll horizontal (si aplica)
        try {
            var container = document.getElementById('lista-campañas');
            if (container && typeof chip.scrollIntoView === 'function') {
                chip.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
            }
        } catch (e) {
            // no bloquear si scroll falla
            console.warn('No se pudo desplazar el chip:', e);
        }
    }
}

// Unifica cargarGestion + cargarSolicitudes en móvil
async function cargarDatosGestionMovil() {
    try {
        console.log('[movil-cargarDatos] Cargando gestión ID:', gestionId);
        var container = document.getElementById('lista-solicitudes');
        if (container) container.innerHTML = '<div class="sin-campana"><p>Cargando solicitudes...</p></div>';

        var controller = new AbortController();
        var timeoutId = setTimeout(function() { controller.abort(); }, 10000);
        var response = await fetch('/api/gestiones-maestro/' + gestionId, { signal: controller.signal });
        clearTimeout(timeoutId);
        
        console.log('[movil-cargarDatos] Response:', response.status);
        if (!response.ok) throw new Error('Error al cargar gestión (status: ' + response.status + ')');

        datosGestion = await response.json();
        
        var titulo = document.getElementById('gestion-titulo');
        if (titulo) titulo.textContent = datosGestion.nombre || 'Gestión #' + gestionId;

        var panel = document.getElementById('panel-progreso');
        if (panel) panel.style.display = 'block';
        var filtros = document.getElementById('filtros-row');
        if (filtros) filtros.style.display = 'block';

        solicitudes = datosGestion.solicitudes || [];
        console.log('[movil-cargarDatos] Solicitudes:', solicitudes.length);
        todasLasSolicitudes = solicitudes.slice();

        renderizarSolicitudes(solicitudes);
        actualizarProgreso();
    } catch (error) {
        console.error('[movil-cargarDatos] Error:', error);
        var container = document.getElementById('lista-solicitudes');
        if (container) container.innerHTML = '<div class="sin-campana"><p>Error: ' + error.message + '</p></div>';
    }
}

function actualizarProgreso() {
    if (!datosGestion) return;
    var total = datosGestion.total_solicitudes || 0;
    var gestionadas = 0;

    solicitudes.forEach(function(sol) {
        if (sol.gestion_id && sol.tipo_gestion && sol.tipo_gestion !== 'Pendiente') gestionadas++;
    });

    var pendientes = total - gestionadas;
    var porcentaje = total > 0 ? Math.round((gestionadas / total) * 100) : 0;

    var elTotal = document.getElementById('total-solicitudes'); if (elTotal) elTotal.textContent = total;
    var elGes = document.getElementById('gestionadas'); if (elGes) elGes.textContent = gestionadas;
    var elPen = document.getElementById('pendientes'); if (elPen) elPen.textContent = pendientes;
    var elPct = document.getElementById('progreso-porcentaje'); if (elPct) elPct.textContent = porcentaje + '%';
    var barra = document.getElementById('barra-progreso'); if (barra) barra.style.width = porcentaje + '%';
    var barraContainer = document.getElementById('progreso-barra-container'); if (barraContainer) barraContainer.style.display = 'block';
}

function renderizarSolicitudes(lista) {
    var container = document.getElementById('lista-solicitudes');
    if (!lista || lista.length === 0) {
        container.innerHTML = '<div class="sin-campana"><p>No hay solicitudes en esta gestión</p></div>';
        return;
    }

    var busqueda = (document.getElementById('busqueda') && document.getElementById('busqueda').value.toLowerCase()) || '';
    var filtroEstado = (document.getElementById('filtro-estado') && document.getElementById('filtro-estado').value) || '';

    var filtradas = lista.filter(function(sol) {
        if (busqueda) {
            var matchId = sol.id_solicitud && String(sol.id_solicitud).includes(busqueda);
            var matchCedula = sol.cedula && sol.cedula.toString().toLowerCase().includes(busqueda);
            var matchNombre = sol.nombre && sol.nombre.toLowerCase().includes(busqueda);
            var matchCelular = sol.celular && sol.celular.toString().includes(busqueda);
            if (!matchId && !matchCedula && !matchNombre && !matchCelular) return false;
        }
        if (filtroEstado) {
            var estadoActual = sol.tipo_gestion || 'Pendiente';
            if (estadoActual !== filtroEstado) return false;
        }
        return true;
    });

    if (filtradas.length === 0) {
        container.innerHTML = '<div class="sin-campana"><p>No hay solicitudes que coincidan con los filtros</p></div>';
        return;
    }

    var html = '';
    for (var i = 0; i < filtradas.length; i++) {
        var sol = filtradas[i];
        var estado = sol.tipo_gestion || 'Pendiente';
        var observacion = sol.gestion_obs || '';
        var gestionada = estado !== 'Pendiente';

        html += '<div class="sol-card ' + (gestionada ? 'gestionada' : '') + '" data-gestion-id="' + (sol.gestion_id || '') + '">';
        html += '<div class="sol-header">';
        html += '<div class="sol-id">#' + sol.id_solicitud + '</div>';
        html += '<div class="sol-badge estado-' + estado.replace(/\s+/g,'') + '">' + estado + '</div>';
        html += '</div>';

        html += '<div class="sol-nombre">' + (sol.nombre || 'Sin nombre') + '</div>';
        html += '<div class="sol-datos">';
        html += '<span>📍 ' + (sol.cedula || '—') + '</span>';
        html += '<span>📱 ' + (sol.celular || '—') + '</span>';
        html += '<span>🏷️ ' + (sol.segmento || '—') + '</span>';
        html += '</div>';

        if (observacion) {
            html += '<div class="sol-obs">' + observacion + '</div>';
        }

html += '<div class="sol-botones">';
        if (!gestionada) {
            html += '<button class="btn-sol btn-sol-call" onclick="abrirGestion(\'' + sol.id_solicitud + '\', \'Llamada\')">📞 Llamada</button>';
            html += '<button class="btn-sol btn-sol-whatsapp" onclick="abrirGestion(\'' + sol.id_solicitud + '\', \'WhatsApp\')">💬 WhatsApp</button>';
            html += '<button class="btn-sol btn-sol-whatsapp-img" onclick="abrirGestionWhatsApp(\'' + sol.id_solicitud + '\', \'' + (sol.celular || '') + '\')">📷 WhatsApp c/Imagen</button>';
            html += '<button class="btn-sol btn-sol-seguimiento" onclick="abrirGestion(\'' + sol.id_solicitud + '\', \'Seguimiento\')">📋 Seguimiento</button>';
            html += '<button class="btn-sol btn-sol-cobranza" onclick="abrirGestion(\'' + sol.id_solicitud + '\', \'Cobranza\')">💰 Cobranza</button>';
            html += '<button class="btn-sol btn-sol-completar" onclick="abrirGestion(\'' + sol.id_solicitud + '\', \'Completada\')">✅ Completar</button>';
        } else {
            html += '<button class="btn-sol btn-sol-ver" onclick="verGestion(\'' + sol.id_solicitud + '\')">👁️ Ver</button>';
        }
        html += '</div>';

        html += '</div>'; // sol-card
    }

    container.innerHTML = html;
}

function abrirGestion(solicitudId, tipo) {
    var sol = solicitudes.find(function(s) { return s.id_solicitud == solicitudId; });
    if (!sol) {
        alert('Solicitud no encontrada');
        return;
    }

    // Activar y desplazar la campaña asociada (comportamiento similar a escritorio)
    try {
        if (sol.gestion_id) {
            marcarCampañaActiva(sol.gestion_id);
        }
    } catch (e) {
        console.warn('Error marcando campaña activa:', e);
    }

    var opciones = ['Llamada', 'WhatsApp', 'Seguimiento', 'Cobranza', 'Cita', 'Completada', 'Otro'];
    var opcionesDropdown = '';
    for (var i = 0; i < opciones.length; i++) {
        var selected = opciones[i] === tipo ? 'selected' : '';
        opcionesDropdown += '<option value="' + opciones[i] + '" ' + selected + '>' + opciones[i] + '</option>';
    }

    var contenido = '';
    contenido += '<div class="modal-gestion">';
    contenido += '<h2>📋 Gestionar Solicitud #' + solicitudId + '</h2>';
    contenido += '<div class="modal-info">';
    contenido += '<p><strong>Nombre:</strong> ' + (sol.nombre || '—') + '</p>';
    contenido += '<p><strong>Cédula:</strong> ' + (sol.cedula || '—') + '</p>';
    contenido += '<p><strong>Celular:</strong> ' + (sol.celular || '—') + '</p>';
    contenido += '</div>';
    contenido += '<div class="modal-form">';
    contenido += '<label>📋 Tipo de Gestión:</label>';
    contenido += '<select id="tipo-gestion-modal">' + opcionesDropdown + '</select>';
    contenido += '<label>📝 Observación:</label>';
    contenido += '<textarea id="observacion-modal" rows="4" placeholder="Escriba su observación..."></textarea>';
    contenido += '<div class="modal-botones">';
    contenido += '<button class="btn-cancelar" onclick="cerrarModal()">Cancelar</button>';
    contenido += '<button class="btn-guardar" onclick="guardarGestionIndividual(\'' + solicitudId + '\')">💾 Guardar</button>';
    contenido += '</div>'; 
    contenido += '</div>';
    contenido += '</div>';

    crearModal(contenido);
}

async function guardarGestionIndividual(solicitudId) {
    var tipo = document.getElementById('tipo-gestion-modal').value;
    var observacion = document.getElementById('observacion-modal').value.trim();
    if (!observacion) { alert('Por favor escriba una observación'); return; }

    var btn = document.querySelector('.btn-guardar');
    if (btn) { btn.textContent = '💾 Guardando...'; btn.disabled = true; }

    try {
        var response = await fetch('/api/excel/gestiones', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                solicitud_id: solicitudId,
                tipo_gestion: tipo,
                observacion: observacion,
                gestion_maestro_id: gestionId
            })
        });

        var resultado = await response.json();
        if (response.ok && !resultado.error) {
            alert('Gestión guardada correctamente');
            cerrarModal();
            cargarDatosGestionMovil();
        } else {
            alert('Error: ' + (resultado.error || 'Error desconocido'));
        }
    } catch (error) {
        console.error('Error guardando gestión:', error);
        alert('Error al guardar la gestión');
    } finally {
        if (btn) { btn.textContent = '💾 Guardar'; btn.disabled = false; }
    }
}

function verGestion(solicitudId) {
    var sol = solicitudes.find(function(s) { return s.id_solicitud == solicitudId; });
    if (!sol || !sol.gestion_id) { alert('No hay gestión registrada'); return; }

    var contenido = '';
    contenido += '<div class="modal-ver">';
    contenido += '<h2>📋 Gestión - Solicitud #' + solicitudId + '</h2>';
    contenido += '<div class="modal-info">';
    contenido += '<p><strong>Tipo:</strong> ' + (sol.tipo_gestion || '—') + '</p>';
    contenido += '<p><strong>Fecha:</strong> ' + (sol.fecha_gestion || '—') + '</p>';
    contenido += '<p><strong>Observación:</strong></p>';
    contenido += '<div class="modal-observacion">' + (sol.gestion_obs || 'Sin observación') + '</div>';
    contenido += '</div>';
    contenido += '<button class="btn-cerrar" onclick="cerrarModal()">Cerrar</button>';
    contenido += '</div>';

    crearModal(contenido);
}

function crearModal(contenido) {
    var modalExistente = document.getElementById('modal-generico');
    if (modalExistente) modalExistente.remove();

    var overlay = document.createElement('div');
    overlay.id = 'modal-generico';
    overlay.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 9999; display: flex; align-items: center; justify-content: center;';

    var modal = document.createElement('div');
    modal.style.cssText = 'background: white; border-radius: 16px; max-width: 600px; width: 90%; max-height: 90vh; overflow: auto; box-shadow: 0 20px 60px rgba(0,0,0,0.4); padding: 20px;';
    modal.innerHTML = contenido;

    overlay.onclick = function(e) { if (e.target === overlay) cerrarModal(); };

    overlay.appendChild(modal);
    document.body.appendChild(overlay);
}

function cerrarModal() {
    var modal = document.getElementById('modal-generico'); if (modal) modal.remove();
}

// Eventos
var busqEl = document.getElementById('busqueda'); if (busqEl) busqEl.addEventListener('input', function() { renderizarSolicitudes(todasLasSolicitudes); });
var filtroEl = document.getElementById('filtro-estado'); if (filtroEl) filtroEl.addEventListener('change', function() { renderizarSolicitudes(todasLasSolicitudes); });

// Iniciar
init();

// ================== WHATSAPP CON IMAGEN INDIVIDUAL ==================

// Abrir modal de WhatsApp con imagen para una solicitud específica
function abrirGestionWhatsApp(solicitudId, celular) {
    var sol = solicitudes.find(function(s) { return s.id_solicitud == solicitudId; });
    
    if (!sol) {
        alert('Solicitud no encontrada');
        return;
    }
    
    if (!celular || celular === '') {
        alert('Esta solicitud no tiene número de celular');
        return;
    }
    
    var contenido = '';
    
    contenido += '<div class="modal-gestion">';
    contenido += '<h2>📷 WhatsApp c/Imagen - Solicitud #' + solicitudId + '</h2>';
    contenido += '<div class="modal-info">';
    contenido += '<p><strong>Nombre:</strong> ' + (sol.nombre || '—') + '</p>';
    contenido += '<p><strong>Celular:</strong> ' + celular + '</p>';
    contenido += '</div>';
    contenido += '<div class="modal-form">';
    contenido += '<label>📝 Mensaje:</label>';
    contenido += '<textarea id="whatsapp-img-mensaje" rows="3" placeholder="Escriba su mensaje..."></textarea>';
    contenido += '<label>📎 Seleccionar Imagen:</label>';
    contenido += '<input type="file" id="whatsapp-img-input" accept="image/jpeg,image/png,image/webp" onchange="previsualizarWhatsAppImg(event)">';
    contenido += '<div id="whatsapp-img-preview-container" style="display: none; margin-top: 12px; text-align: center;">';
    contenido += '<img id="whatsapp-img-preview" style="max-width: 150px; max-height: 150px; border-radius: 8px; border: 2px solid #e2e8f0;">';
    contenido += '<div style="margin-top: 8px;"><button type="button" onclick="quitarWhatsAppImg()" style="padding: 6px 12px; background: #fee2e2; border: none; border-radius: 4px; cursor: pointer;">Quitar Imagen</button></div>';
    contenido += '</div>';                    contenido += '<div style="margin-top: 16px; padding: 12px; background: #f0fdf4; border-radius: 8px; border: 1px solid #86efac;">';
    contenido += '<div style="display: flex; align-items: center; gap: 8px;">';
    contenido += '<span style="font-size: 18px;">📱</span>';
    contenido += '<span style="font-size: 13px; color: #166534;">Se abrirá WhatsApp en tu dispositivo con el mensaje pre-llenado.</span>';
    contenido += '</div>';
    contenido += '<div style="margin-top: 8px; display: flex; align-items: center; gap: 8px;">';
    contenido += '<input type="checkbox" id="whatsapp-abrir-web" checked style="width: 18px; height: 18px;">';
    contenido += '<span style="font-size: 12px; color: #374151;">Abrir WhatsApp al enviar</span>';
    contenido += '</div>';
    contenido += '</div>';
    contenido += '<div class="modal-botones">';
    contenido += '<button class="btn-cancelar" onclick="cerrarModal()">Cancelar</button>';
    contenido += '<button class="btn-guardar" id="btn-whatsapp-img" onclick="enviarWhatsAppImagen(\'' + solicitudId + '\', \'' + celular + '\')">📤 Enviar</button>';
    contenido += '</div>';
    contenido += '</div>';
    contenido += '</div>';
    
    crearModal(contenido);
}

// Previsualizar imagen para WhatsApp individual
function previsualizarWhatsAppImg(event) {
    var file = event.target.files[0];
    if (!file) return;
    
    var tiposPermitidos = ['image/jpeg', 'image/png', 'image/webp'];
    if (!tiposPermitidos.includes(file.type)) {
        alert('Solo se permiten imágenes JPG, PNG o WebP');
        event.target.value = '';
        return;
    }
    
    if (file.size > 5 * 1024 * 1024) {
        alert('La imagen no puede superar 5MB');
        event.target.value = '';
        return;
    }
    
    var reader = new FileReader();
    reader.onload = function(e) {
        var container = document.getElementById('whatsapp-img-preview-container');
        var img = document.getElementById('whatsapp-img-preview');
        if (container && img) {
            container.style.display = 'block';
            img.src = e.target.result;
        }
    };
    reader.readAsDataURL(file);
}

// Quitar imagen de WhatsApp individual
function quitarWhatsAppImg() {
    var input = document.getElementById('whatsapp-img-input');
    var container = document.getElementById('whatsapp-img-preview-container');
    if (input) input.value = '';
    if (container) container.style.display = 'none';
}

// ================== CONFIGURACIÓN WHATSAPP ==================
// Código de país para números sin prefijo internacional
// Ecuador = 593, Nicaragua = 505, Costa Rica = 506, etc.
var PAIS_CODIGO = '593';
// Longitud máxima de un número nacional (sin código de país)
// Ecuador móvil = 9 dígitos, fijo = 7-8 dígitos
var PAIS_LONGITUD_MAX_SIN_CODIGO = 9;

// Formatear número para WhatsApp: agrega código de país si es necesario
function formatearNumeroWhatsApp(celular) {
    var numero = String(celular).replace(/[^0-9]/g, '');
    
    // Quitar cero(s) a la izquierda (ej: 099XXXXXXXX → 99XXXXXXXX)
    numero = numero.replace(/^0+/, '');
    
    // Si el número ya tiene código de país (más largo que la longitud máxima local), usarlo directo
    if (numero.length > PAIS_LONGITUD_MAX_SIN_CODIGO) {
        return numero;
    }
    
    // Si es un número local (sin código de país), agregar el código configurado
    return PAIS_CODIGO + numero;
}

// Abrir WhatsApp en móvil (app nativa si está instalada, o web como fallback)
function abrirWhatsAppMovil(celular, mensaje) {
    var numeroFormateado = formatearNumeroWhatsApp(celular);
    
    console.log('[WhatsApp Movil] Número original:', celular, '→ formateado:', numeroFormateado);
    
    var texto = mensaje ? '&text=' + encodeURIComponent(mensaje) : '';
    
    // 1. Intentar deep link de WhatsApp app (whatsapp://)
    var urlApp = 'whatsapp://send?phone=' + numeroFormateado + texto;
    
    // 2. Fallback: universal link que abre la app o el navegador
    var urlUniversal = 'https://api.whatsapp.com/send?phone=' + numeroFormateado + texto;
    
    console.log('[WhatsApp Movil] Deep link:', urlApp);
    
    // Intentar deep link primero
    var win = window.open(urlApp, '_blank');
    
    // Si no se pudo (popup bloqueado o deep link no funciona), usar universal link
    if (!win) {
        console.log('[WhatsApp Movil] Fallback a universal link:', urlUniversal);
        win = window.open(urlUniversal, '_blank');
    }
    
    // Último recurso: redirigir directamente
    if (!win) {
        console.log('[WhatsApp Movil] Fallback final: redirigiendo...');
        window.location.href = urlUniversal;
    }
}

// Enviar WhatsApp con imagen (móvil optimizado)
async function enviarWhatsAppImagen(solicitudId, celular) {
    var mensaje = document.getElementById('whatsapp-img-mensaje').value.trim();
    var fileInput = document.getElementById('whatsapp-img-input');
    var file = fileInput ? fileInput.files[0] : null;
    var checkboxAbrir = document.getElementById('whatsapp-abrir-web');
    var abrirApp = checkboxAbrir ? checkboxAbrir.checked : true;
    
    if (!mensaje && !file) {
        alert('Escriba un mensaje o seleccione una imagen');
        return;
    }
    
    var btn = document.getElementById('btn-whatsapp-img');
    btn.textContent = '⏳ Procesando...';
    btn.disabled = true;
    
    // Variable para evitar que el flujo caiga al fallback si Web Share ya funcionó
    var shareCompletado = false;
    
    try {
        // ===== PASO 1: Intentar compartir con Web Share API (imagen + texto directo a WhatsApp) =====
        if (file && typeof navigator.share !== 'undefined' && navigator.canShare) {
            try {
                var shareData = {
                    text: mensaje || '📋 Gestión de solicitud #' + solicitudId,
                    files: [file]
                };
                
                if (navigator.canShare(shareData)) {
                    console.log('[WhatsApp Movil] Usando Web Share API para compartir imagen');
                    await navigator.share(shareData);
                    
                    // Guardar gestión
                    await guardarGestionWhatsApp(solicitudId, mensaje, null);
                    shareCompletado = true;
                    
                    alert('✅ Gestión guardada');
                    cerrarModal();
                    await cargarDatosGestionMovil();
                    btn.textContent = '📤 Enviar';
                    btn.disabled = false;
                    return;
                }
            } catch (shareError) {
                // Si el usuario canceló el share, no hacemos nada
                if (shareError.name === 'AbortError') {
                    console.log('[WhatsApp Movil] Usuario canceló el compartir');
                    btn.textContent = '📤 Enviar';
                    btn.disabled = false;
                    return;
                }
                console.log('[WhatsApp Movil] Web Share no disponible, usando fallback:', shareError.message);
            }
        }
        
        // Si Web Share ya completó, salir sin ejecutar fallback
        if (shareCompletado) {
            btn.textContent = '📤 Enviar';
            btn.disabled = false;
            return;
        }
        
        // ===== PASO 2: Fallback - Subir imagen y abrir WhatsApp con URL =====
        console.log('[WhatsApp Movil] Usando modo fallback (subir imagen + URL en texto)');
        
        var imagenUrl = null;
        if (file) {
            var formData = new FormData();
            formData.append('imagen', file);
            
            var uploadResponse = await fetch('/api/excel/upload-imagen', {
                method: 'POST',
                body: formData
            });
            
            if (!uploadResponse.ok) {
                var errorText = await uploadResponse.text();
                console.error('[WhatsApp Movil] Error upload-imagen:', errorText);
                throw new Error('Error al subir imagen: ' + uploadResponse.status);
            }
            
            var uploadResult = await uploadResponse.json();
            if (!uploadResult.success) {
                throw new Error(uploadResult.error || 'Error al subir imagen');
            }
            imagenUrl = uploadResult.url;
            console.log('[WhatsApp Movil] Imagen subida:', imagenUrl);
        }
        
        // ===== PASO 3: Construir mensaje =====
        var textoWhatsApp = mensaje;
        if (imagenUrl) {
            textoWhatsApp = (mensaje ? mensaje + '\n\n' : '') + '📷 Ver imagen: ' + imagenUrl;
        }
        
        // ===== PASO 4: Guardar gestión =====
        await guardarGestionWhatsApp(solicitudId, mensaje, imagenUrl);
        
        // ===== PASO 5: Abrir WhatsApp app =====
        if (abrirApp) {
            abrirWhatsAppMovil(celular, textoWhatsApp);
        }
        
        alert('✅ Gestión guardada');
        cerrarModal();
        await cargarDatosGestionMovil();
        
    } catch (error) {
        console.error('[WhatsApp Movil] Error:', error);
        alert('Error: ' + error.message);
    } finally {
        btn.textContent = '📤 Enviar';
        btn.disabled = false;
    }
}

// Función auxiliar para guardar gestión de WhatsApp
async function guardarGestionWhatsApp(solicitudId, mensaje, imagenUrl) {
    var observacion = mensaje || '';
    if (imagenUrl) {
        observacion = (mensaje ? mensaje + '\n\n' : '') + '[Imagen: ' + imagenUrl + ']';
    }
    
    var response = await fetch('/api/excel/gestiones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            solicitud_id: solicitudId,
            tipo_gestion: 'WhatsApp',
            observacion: observacion,
            gestion_maestro_id: gestionId
        })
    });
    
    var resultado = await response.json();
    
    if (!response.ok || resultado.error) {
        throw new Error(resultado.error || 'Error al guardar gestión');
    }
    
    return resultado;
}

