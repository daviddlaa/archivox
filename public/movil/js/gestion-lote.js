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
            html += '<div class="campaña-chip-acciones">';
            html += '<button class="campaña-chip-editar" onclick="event.stopPropagation(); abrirModalEditarCampanaMovil(' + g.id + ', \'' + escaparParaAtributo(g.nombre || 'Gestión #' + g.id) + '\', \'' + escaparParaAtributo(g.descripcion || '') + '\', \'' + (g.fecha_limite || '') + '\', \'' + (g.estado || 'Activa') + '\')" title="Editar campaña">✏️</button>';
            html += '<button class="campaña-chip-borrar" onclick="event.stopPropagation(); confirmarEliminarCampañaMovil(' + g.id + ', \'' + escaparParaAtributo(g.nombre || 'Gestión #' + g.id) + '\', ' + (g.total_solicitudes || 0) + ', ' + (g.gestionadas || 0) + ')" title="Eliminar campaña">🗑️</button>';
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
        
        // Mostrar botón de exportar Excel
        var containerExportar = document.getElementById('exportar-excel-container');
        if (containerExportar) containerExportar.style.display = 'block';
        
        // Mostrar botón de agregar solicitudes
        var containerAgregar = document.getElementById('agregar-solicitudes-container');
        if (containerAgregar) containerAgregar.style.display = 'block';

        solicitudes = datosGestion.solicitudes || [];
        console.log('[movil-cargarDatos] Solicitudes:', solicitudes.length);
        if (solicitudes.length > 0) {
            console.log('[movil-cargarDatos] Primeras 3 gestion_obs:', 
                solicitudes.slice(0, 3).map(function(s) { 
                    return {id: s.id_solicitud, obs: s.gestion_obs, tipo: s.tipo_gestion}; 
                })
            );
        }
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
        var destacada = sol.destacado == 1;

        html += '<div class="sol-card ' + (gestionada ? 'gestionada' : '') + (destacada ? ' destacada' : '') + '" data-gestion-id="' + (sol.gestion_id || '') + '">';
        html += '<div class="sol-header">';
        html += '<div class="sol-id">#' + sol.id_solicitud + '</div>';
        html += '<div class="sol-header-badges">';
        if (destacada) {
            html += '<span class="sol-destacado-badge sol-destacado-badge-on" onclick="event.stopPropagation(); toggleDestacado(\'' + sol.id_solicitud + '\', 0)" title="Quitar destacado">⭐ Destacada</span>';
        } else {
            html += '<span class="sol-destacado-badge sol-destacado-badge-off" onclick="event.stopPropagation(); toggleDestacado(\'' + sol.id_solicitud + '\', 1)" title="Destacar tarjeta">☆ Destacar</span>';
        }
        html += '<div class="sol-badge estado-' + estado.replace(/\s+/g,'') + '">' + estado + '</div>';
        html += '</div>';
        html += '</div>';

        html += '<div class="sol-nombre sol-nombre-copy" onclick="copiarNombreCedula(\'' + escaparParaAtributo(sol.nombre || '') + '\', \'' + escaparParaAtributo(sol.cedula || '') + '\')" title="Copiar nombre completo y cédula">' + (sol.nombre || 'Sin nombre') + '</div>';
        html += '<div class="sol-datos">';
        html += '<span class="sol-dato-copy" onclick="copiarTexto(\'' + escaparParaAtributo(sol.cedula || '') + '\', \'cédula\')" title="Copiar cédula">🆔 ' + (sol.cedula || '—') + '</span>';
        html += '<span class="sol-dato-copy" onclick="copiarTexto(\'' + escaparParaAtributo(sol.celular || '') + '\', \'teléfono\')" title="Copiar teléfono">📱 ' + (sol.celular || '—') + '</span>';
        html += '<span class="sol-chat-icon" onclick="abrirWhatsAppMovil(\'' + escaparParaAtributo(sol.celular || '') + '\', \'\')" title="Abrir chat WhatsApp">💬</span>';
        html += '<span>🏷️ ' + (sol.segmento || '—') + '</span>';
        html += '</div>';

        if (observacion) {
            html += '<div class="sol-obs">' + observacion + '</div>';
        }

html += '<div class="sol-botones">';
        // Acciones compactas de la tarjeta
        html += '<button class="btn-sol btn-sol-call" onclick="llamarDesdeGestionLote(\'' + (sol.celular || "") + '\')">📞</button>';
        html += '<button class="btn-sol btn-sol-primary btn-sol-small" onclick="abrirGestion(\'' + sol.id_solicitud + '\', \'Seguimiento\')">Seguimiento</button>';
        html += "<button class=\"btn-sol btn-sol-call btn-sol-small\" onclick=\"abrirGestionWhatsApp('" + sol.id_solicitud + "', '" + escaparParaAtributo(sol.celular || '') + "')\">💬 Directo</button>";
        
        // Botón ver gestión (si tiene gestión registrada)
        if (gestionada) {
            html += '<button class="btn-sol btn-sol-ver btn-sol-small" onclick="verGestion(\'' + sol.id_solicitud + '\')">Ver</button>';
        }
        
        // Botón historial para TODAS las cards
        html += '<button class="btn-sol btn-sol-historial btn-sol-small" onclick="verHistorial(\'' + sol.id_solicitud + '\')">Historial</button>';
        
        // Botón quitar de campaña
        html += '<button class="btn-sol btn-sol-quitar btn-sol-small" onclick="confirmarQuitarSolicitud(\'' + sol.id_solicitud + '\', \'' + escaparParaAtributo(sol.nombre || '') + '\')">❌ Quitar</button>';
        
        html += '</div>';

        html += '</div>'; // sol-card
    }

    container.innerHTML = html;
}

function escaparParaHTML(texto) {
    return String(texto || '')
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

function escaparParaAtributo(texto) {
    return String(texto || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

function copiarNombreCedula(nombre, cedula) {
    var valorNombre = String(nombre || '').trim();
    var valorCedula = String(cedula || '').trim();
    var texto = '';

    if (valorNombre && valorCedula) {
        texto = valorNombre + ' - ' + valorCedula;
    } else if (valorNombre) {
        texto = valorNombre;
    } else if (valorCedula) {
        texto = valorCedula;
    }

    if (!texto) {
        alert('No hay nombre ni cédula para copiar');
        return;
    }

    copiarTexto(texto, 'nombre y cédula');
}

function copiarTexto(texto, etiqueta) {
    var valor = String(texto || '').trim();
    if (!valor) {
        alert('No hay ' + etiqueta + ' para copiar');
        return;
    }

    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(valor).then(function() {
            alert(etiqueta.charAt(0).toUpperCase() + etiqueta.slice(1) + ' copiada');
        });
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
    alert(etiqueta.charAt(0).toUpperCase() + etiqueta.slice(1) + ' copiada');
}

function llamarDesdeGestionLote(celular) {
    if (!celular) {
        alert('No hay número de celular');
        return;
    }
    var numeroLimpio = String(celular).replace(/\D/g, '');
    if (!numeroLimpio) {
        alert('No hay número de celular');
        return;
    }
    window.location.href = 'tel:' + numeroLimpio;
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
    
    // Toggle destacar
    var destacadoActual = sol.destacado == 1;
    contenido += '<label style="display:flex;align-items:center;gap:8px;margin-bottom:12px;cursor:pointer;padding:10px 12px;background:' + (destacadoActual ? '#fffbeb' : '#f9fafb') + ';border-radius:8px;border:1px solid ' + (destacadoActual ? '#f59e0b' : '#e5e7eb') + ';">';
    contenido += '<input type="checkbox" id="toggle-destacar" ' + (destacadoActual ? 'checked' : '') + ' style="width:18px;height:18px;">';
    contenido += '<span style="font-size:13px;color:' + (destacadoActual ? '#92400e' : '#6b7280') + ';">⭐ Destacar tarjeta</span>';
    contenido += '</label>';
    
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
            // Guardar destacado si cambió
            var checkboxDestacar = document.getElementById('toggle-destacar');
            if (checkboxDestacar) {
                var solActual = solicitudes.find(function(s) { return s.id_solicitud == solicitudId; });
                var nuevoDestacado = checkboxDestacar.checked ? 1 : 0;
                if (solActual && nuevoDestacado !== (solActual.destacado || 0)) {
                    await fetch('/api/excel/solicitudes/' + solicitudId + '/destacar', {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ destacado: nuevoDestacado })
                    });
                }
            }
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

// Alternar destacado de una solicitud
async function toggleDestacado(solicitudId, nuevoEstado) {
    try {
        var response = await fetch('/api/excel/solicitudes/' + solicitudId + '/destacar', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ destacado: nuevoEstado })
        });
        
        var resultado = await response.json();
        
        if (response.ok && !resultado.error) {
            await cargarDatosGestionMovil();
        }
    } catch (error) {
        console.error('[movil] Error alternando destacado:', error);
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

// Ver historial completo de gestiones de una solicitud (móvil)
async function verHistorial(solicitudId) {
    try {
        crearModal('<div class="modal-gestion" style="text-align:center;padding:20px;"><h2>📋 Historial</h2><p>⏳ Cargando...</p></div>');
        
        var response = await fetch('/api/excel/gestiones/' + solicitudId);
        if (!response.ok) throw new Error('Error al cargar historial');
        
        var gestiones = await response.json();
        
        var contenido = '';
        contenido += '<div class="modal-gestion">';
        contenido += '<h2 style="margin-top:0;font-size:16px;">📋 Historial - Solicitud #' + solicitudId + '</h2>';
        
        if (!gestiones || gestiones.length === 0) {
            contenido += '<div style="text-align:center;padding:15px;color:#6b7280;font-size:13px;">No hay gestiones registradas</div>';
        } else {
            contenido += '<div style="margin-bottom:8px;color:#6b7280;font-size:12px;">📊 Total: ' + gestiones.length + ' gestione(s)</div>';
            contenido += '<div style="max-height:350px;overflow-y:auto;">';
            
            var coloresTipo = {
                'Pendiente': '#fef3c7',
                'Llamada': '#d1fae5',
                'WhatsApp': '#dcfce7',
                'Seguimiento': '#dbeafe',
                'Cobranza': '#fee2e2',
                'Cita': '#e0e7ff',
                'Completada': '#bbf7d0'
            };
            
            for (var i = 0; i < gestiones.length; i++) {
                var g = gestiones[i];
                var fecha = g.fecha_gestion ? new Date(g.fecha_gestion).toLocaleString('es-ES') : '—';
                var isLast = i === gestiones.length - 1;
                var colorBadge = coloresTipo[g.tipo_gestion] || '#f3f4f6';
                
                contenido += '<div style="display:flex;gap:12px;position:relative;">';
                // Timeline dot + line
                contenido += '<div style="display:flex;flex-direction:column;align-items:center;">';
                contenido += '<div style="width:12px;height:12px;border-radius:50%;background:' + colorBadge + ';border:2px solid #9ca3af;flex-shrink:0;"></div>';
                if (!isLast) {
                    contenido += '<div style="width:2px;flex:1;background:#e5e7eb;margin:4px 0;"></div>';
                }
                contenido += '</div>';
                // Content
                contenido += '<div style="flex:1;padding-bottom:' + (isLast ? '0' : '12px') + ';">';
                contenido += '<div style="display:flex;align-items:center;gap:6px;margin-bottom:3px;flex-wrap:wrap;">';
                contenido += '<span style="background:' + colorBadge + ';padding:1px 8px;border-radius:10px;font-size:10px;font-weight:600;color:#374151;">' + (g.tipo_gestion || '—') + '</span>';
                contenido += '<span style="font-size:10px;color:#9ca3af;">' + fecha + '</span>';
                contenido += '</div>';
                contenido += '<div style="background:#f9fafb;padding:8px 10px;border-radius:6px;font-size:12px;color:#374151;line-height:1.4;">' + (g.observacion || 'Sin observación') + '</div>';
                contenido += '</div>';
                contenido += '</div>';
            }
            
            contenido += '</div>';
        }
        
        contenido += '<div style="margin-top:12px;text-align:right;">';
        contenido += '<button class="btn-cerrar" onclick="cerrarModal()" style="padding:8px 20px;background:#f3f4f6;border:none;border-radius:8px;cursor:pointer;font-size:14px;">Cerrar</button>';
        contenido += '</div>';
        contenido += '</div>';
        
        cerrarModal();
        crearModal(contenido);
        
    } catch (error) {
        console.error('[movil] Error cargando historial:', error);
        cerrarModal();
        alert('Error al cargar el historial');
    }
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

// ================== QUITAR SOLICITUD DE CAMPAÑA (MÓVIL) ==================

function confirmarQuitarSolicitud(solicitudId, nombreCliente) {
    var contenido = '';
    contenido += '<div class="modal-gestion">';
    contenido += '<h2>❌ Quitar Solicitud #' + solicitudId + '</h2>';
    contenido += '<div class="modal-info">';
    contenido += '<p><strong>Solicitud:</strong> #' + solicitudId + '</p>';
    contenido += '<p><strong>Cliente:</strong> ' + (nombreCliente || '—') + '</p>';
    contenido += '<p><strong>Campaña:</strong> ' + (datosGestion ? datosGestion.nombre : '—') + '</p>';
    contenido += '</div>';
    contenido += '<div class="modal-advertencia">';
    contenido += '<p>⚠️ <strong>¿Estás seguro?</strong></p>';
    contenido += '<ul style="padding-left: 20px; margin: 8px 0; font-size: 13px;">';
    contenido += '<li>La solicitud será quitada de esta campaña.</li>';
    contenido += '<li>Las gestiones registradas NO se eliminarán.</li>';
    contenido += '<li>Esta acción es <strong>IRREVERSIBLE</strong>.</li>';
    contenido += '</ul>';
    contenido += '</div>';
    contenido += '<div class="modal-botones">';
    contenido += '<button class="btn-cancelar" onclick="cerrarModal()">Cancelar</button>';
    contenido += '<button class="btn-eliminar" id="btn-confirmar-quitar" onclick="quitarSolicitudDeCampana(' + solicitudId + ')">❌ Quitar</button>';
    contenido += '</div>';
    contenido += '</div>';
    
    crearModal(contenido);
}

async function quitarSolicitudDeCampana(solicitudId) {
    var btn = document.getElementById('btn-confirmar-quitar');
    if (btn) { btn.textContent = '⏳ Quitando...'; btn.disabled = true; }
    
    try {
        var response = await fetch('/api/gestiones-maestro/' + gestionId + '/quitar-solicitud', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ solicitud_id: parseInt(solicitudId) })
        });
        
        var resultado = await response.json();
        
        if (response.ok && !resultado.error) {
            alert('✅ Solicitud quitada de la campaña');
            cerrarModal();
            await cargarDatosGestionMovil();
            await cargarListaCampanas();
        } else {
            alert('Error: ' + (resultado.error || 'Error al quitar solicitud'));
            if (btn) { btn.textContent = '❌ Quitar'; btn.disabled = false; }
        }
    } catch (error) {
        console.error('[movil] Error quitando solicitud:', error);
        alert('Error al quitar la solicitud');
        if (btn) { btn.textContent = '❌ Quitar'; btn.disabled = false; }
    }
}

// ================== AGREGAR SOLICITUDES A CAMPAÑA (MÓVIL - REDISEÑADO) ==================

function abrirModalAgregarSolicitudesMovil() {
    // Crear overlay y bottom sheet
    var overlay = document.createElement('div');
    overlay.id = 'modal-agregar-movil';
    overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.4);z-index:10000;display:flex;align-items:flex-end;justify-content:center;animation:fadeIn 0.2s ease;';
    
    var sheet = document.createElement('div');
    sheet.style.cssText = 'background:white;width:100%;max-height:85vh;border-radius:20px 20px 0 0;display:flex;flex-direction:column;overflow:hidden;animation:slideUp 0.3s ease;box-shadow:0 -10px 40px rgba(0,0,0,0.15);';
    
    // === HEADER ===
    sheet.innerHTML = '<div style="display:flex;align-items:center;justify-content:space-between;padding:16px 18px 12px;border-bottom:1px solid #e5e7eb;flex-shrink:0;">' +
        '<h2 style="margin:0;font-size:17px;color:#1f2937;">➕ Agregar Solicitudes</h2>' +
        '<button onclick="cerrarModalAgregarMovil()" style="background:#f3f4f6;border:none;border-radius:50%;width:32px;height:32px;font-size:16px;cursor:pointer;display:flex;align-items:center;justify-content:center;color:#6b7280;">✕</button>' +
        '</div>' +
        // === BARRA DE BÚSQUEDA ===
        '<div style="padding:12px 18px 8px;flex-shrink:0;">' +
        '<input type="text" id="busqueda-agregar" autofocus placeholder="🔍 Buscar por nombre, cédula o teléfono..." style="width:100%;padding:14px 16px;border:2px solid #e5e7eb;border-radius:12px;font-size:16px;outline:none;box-sizing:border-box;transition:border-color 0.2s;" oninput="buscarSolicitudesParaAgregarMovil(event)" onfocus="this.style.borderColor=\'#6366f1\'" onblur="this.style.borderColor=\'#e5e7eb\'">' +
        '</div>' +
        // === CONTADOR DE SELECCIONADOS ===
        '<div id="seleccionados-agregar" style="display:none;padding:8px 18px;flex-shrink:0;">' +
        '<div style="background:#eef2ff;padding:8px 14px;border-radius:10px;font-size:13px;color:#4338ca;font-weight:600;">✅ <span id="contador-seleccionados">0</span> solicitude(s) seleccionada(s)</div>' +
        '</div>' +
        // === LISTA DE RESULTADOS ===
        '<div id="resultados-agregar" style="flex:1;overflow-y:auto;padding:8px 18px;min-height:120px;">' +
        '<div style="text-align:center;padding:40px 10px;color:#9ca3af;font-size:14px;">🔍 Escribe al menos 2 caracteres para buscar</div>' +
        '</div>' +
        // === BOTÓN AGREGAR (STICKY BOTTOM) ===
        '<div style="padding:12px 18px 20px;border-top:1px solid #e5e7eb;flex-shrink:0;">' +
        '<button id="btn-agregar-solicitudes" onclick="agregarSolicitudesSeleccionadasMovil()" disabled style="width:100%;padding:16px;background:linear-gradient(135deg,#6366f1,#4f46e5);color:white;border:none;border-radius:12px;font-size:16px;font-weight:700;cursor:pointer;transition:all 0.2s;opacity:0.5;">➕ Agregar (0)</button>' +
        '</div>';
    
    overlay.appendChild(sheet);
    document.body.appendChild(overlay);
    
    // Cerrar al tocar el overlay (fuera del sheet)
    overlay.addEventListener('click', function(e) {
        if (e.target === overlay) cerrarModalAgregarMovil();
    });
    
    // Auto-focus al input después de que el DOM se actualice
    setTimeout(function() {
        var input = document.getElementById('busqueda-agregar');
        if (input) input.focus();
    }, 300);
}

function cerrarModalAgregarMovil() {
    var modal = document.getElementById('modal-agregar-movil');
    if (modal) {
        modal.style.transition = 'opacity 0.2s ease';
        modal.style.opacity = '0';
        setTimeout(function() { modal.remove(); }, 200);
    }
    // Limpiar selecciones
    solicitudesSeleccionadas = {};
}

// Agregar keyframes animation al cargar la página
(function() {
    var style = document.createElement('style');
    style.textContent = '@keyframes slideUp { from { transform:translateY(100%); } to { transform:translateY(0); } } @keyframes fadeIn { from { opacity:0; } to { opacity:1; } }';
    document.head.appendChild(style);
})();

var solicitudesDisponibles = [];
var solicitudesSeleccionadas = {};

async function buscarSolicitudesParaAgregarMovil(event) {
    var termino = event.target.value.trim();
    var resultadosContainer = document.getElementById('resultados-agregar');
    
    if (!termino || termino.length < 2) {
        resultadosContainer.innerHTML = '<div class="agregar-vacio">Escribe al menos 2 caracteres para buscar</div>';
        return;
    }
    
    resultadosContainer.innerHTML = '<div class="agregar-cargando">🔍 Buscando...</div>';
    
    try {
        var response = await fetch('/api/excel/solicitudes/buscar?q=' + encodeURIComponent(termino));
        if (!response.ok) throw new Error('Error en búsqueda');
        
        var data = await response.json();
        
        // Obtener IDs ya en la campaña
        if (!datosGestion || !datosGestion.solicitudes_ids) {
            resultadosContainer.innerHTML = '<div class="agregar-vacio">Error: no hay datos de campaña</div>';
            return;
        }
        
        var idsEnCampana = [];
        try {
            idsEnCampana = JSON.parse(datosGestion.solicitudes_ids);
        } catch (e) {
            console.error('[movil] Error parseando solicitudes_ids:', e);
        }
        
        var lista = Array.isArray(data) ? data : (data.data || []);
        solicitudesDisponibles = [];
        
        for (var i = 0; i < lista.length; i++) {
            var sol = lista[i];
            var idSol = sol.id_solicitud || sol.id;
            if (idsEnCampana.indexOf(idSol) === -1) {
                solicitudesDisponibles.push(sol);
            }
        }
        
        if (solicitudesDisponibles.length === 0) {
            resultadosContainer.innerHTML = '<div class="agregar-vacio">No se encontraron solicitudes disponibles</div>';
            return;
        }
        
        var html = '';
        for (var i = 0; i < solicitudesDisponibles.length; i++) {
            var sol = solicitudesDisponibles[i];
            var solId = sol.id_solicitud || sol.id;
            var isSelected = solicitudesSeleccionadas[solId] ? 'selected' : '';
            
            html += '<div class="agregar-item ' + isSelected + '" onclick="toggleSeleccionSolicitudMovil(' + solId + ')">';
            html += '<div class="agregar-item-check">' + (isSelected ? '✅' : '⬜') + '</div>';
            html += '<div class="agregar-item-info">';
            html += '<div class="agregar-item-nombre">#' + solId + ' - ' + (sol.nombre || 'Sin nombre') + '</div>';
            html += '<div class="agregar-item-datos">🆔 ' + (sol.cedula || '—') + ' | 📱 ' + (sol.celular || '—') + '</div>';
            html += '</div>';
            html += '</div>';
        }
        
        resultadosContainer.innerHTML = html;
        actualizarBotonAgregarMovil();
        
    } catch (error) {
        console.error('[movil] Error en búsqueda:', error);
        resultadosContainer.innerHTML = '<div class="agregar-error">Error al buscar: ' + error.message + '</div>';
    }
}

function toggleSeleccionSolicitudMovil(solicitudId) {
    if (solicitudesSeleccionadas[solicitudId]) {
        delete solicitudesSeleccionadas[solicitudId];
    } else {
        solicitudesSeleccionadas[solicitudId] = true;
    }
    
    var items = document.querySelectorAll('.agregar-item');
    items.forEach(function(item) {
        var onclick = item.getAttribute('onclick') || '';
        var match = onclick.match(/toggleSeleccionSolicitudMovil\((\d+)\)/);
        if (match) {
            var id = parseInt(match[1]);
            if (solicitudesSeleccionadas[id]) {
                item.classList.add('selected');
                item.querySelector('.agregar-item-check').textContent = '✅';
            } else {
                item.classList.remove('selected');
                item.querySelector('.agregar-item-check').textContent = '⬜';
            }
        }
    });
    
    actualizarBotonAgregarMovil();
}

function actualizarBotonAgregarMovil() {
    var count = Object.keys(solicitudesSeleccionadas).length;
    var btn = document.getElementById('btn-agregar-solicitudes');
    var contador = document.getElementById('contador-seleccionados');
    var container = document.getElementById('seleccionados-agregar');
    
    if (btn) {
        btn.textContent = '➕ Agregar (' + count + ')';
        btn.disabled = count === 0;
    }
    if (contador) contador.textContent = count;
    if (container) container.style.display = count > 0 ? 'block' : 'none';
}

async function agregarSolicitudesSeleccionadasMovil() {
    var ids = Object.keys(solicitudesSeleccionadas).map(function(id) { return parseInt(id); });
    
    if (ids.length === 0) {
        alert('Selecciona al menos una solicitud');
        return;
    }
    
    var btn = document.getElementById('btn-agregar-solicitudes');
    if (btn) { btn.textContent = '⏳ Agregando...'; btn.disabled = true; }
    
    try {
        var response = await fetch('/api/gestiones-maestro/' + gestionId + '/agregar-solicitudes', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ solicitudes_ids: ids })
        });
        
        var resultado = await response.json();
        
        if (response.ok && !resultado.error) {
            alert('✅ ' + resultado.mensaje);
            solicitudesSeleccionadas = {};
            cerrarModalAgregarMovil();
            await cargarDatosGestionMovil();
            await cargarListaCampanas();
        } else {
            alert('Error: ' + (resultado.error || 'Error al agregar solicitudes'));
            if (btn) { btn.textContent = '➕ Agregar (' + ids.length + ')'; btn.disabled = false; }
        }
    } catch (error) {
        console.error('[movil] Error agregando solicitudes:', error);
        alert('Error al agregar las solicitudes');
        if (btn) { btn.textContent = '➕ Agregar (' + ids.length + ')'; btn.disabled = false; }
    }
}

// ================== EXPORTAR CAMPAÑA A EXCEL ==================

function exportarExcelGestionLote() {
    var datos = todasLasSolicitudes;
    
    if (!datos || datos.length === 0) {
        alert('No hay datos para exportar');
        return;
    }
    
    var datosAExportar = [];
    for (var i = 0; i < datos.length; i++) {
        var sol = datos[i];
        datosAExportar.push({
            'Cédula': sol.cedula || '',
            'Nombre': sol.nombre || '',
            'Teléfono': sol.celular || '',
            'Segmento': sol.segmento || '',
            'Estado': sol.tipo_gestion || 'Pendiente',
            'Observación': sol.gestion_obs || ''
        });
    }
    
    var wb = XLSX.utils.book_new();
    var ws = XLSX.utils.json_to_sheet(datosAExportar);
    
    ws['!cols'] = [
        {wch: 12},
        {wch: 30},
        {wch: 15},
        {wch: 15},
        {wch: 15},
        {wch: 50}
    ];
    
    var nombreCampana = (datosGestion && datosGestion.nombre) || 'campana';
    var nombreArchivo = 'campana_' + nombreCampana.replace(/[^a-zA-Z0-9]/g, '_') + '_' + new Date().toISOString().slice(0, 10) + '.xlsx';
    
    XLSX.utils.book_append_sheet(wb, ws, 'Campaña');
    XLSX.writeFile(wb, nombreArchivo);
    
    alert('Se exportaron ' + datos.length + ' registros a Excel');
}

// ================== EDITAR CAMPAÑA (MÓVIL) ==================

function abrirModalEditarCampanaMovil(id, nombre, descripcion, fechaLimite, estado) {
    var nombreEsc = escaparParaHTML(nombre);
    var descEsc = escaparParaHTML(descripcion);
    
    var overlay = document.createElement('div');
    overlay.id = 'modal-editar-campana-movil';
    overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.4);z-index:10000;display:flex;align-items:flex-end;justify-content:center;animation:fadeIn 0.2s ease;';
    
    var sheet = document.createElement('div');
    sheet.style.cssText = 'background:white;width:100%;max-height:80vh;border-radius:20px 20px 0 0;display:flex;flex-direction:column;overflow:hidden;animation:slideUp 0.3s ease;box-shadow:0 -10px 40px rgba(0,0,0,0.15);';
    
    sheet.innerHTML = 
        '<div style="display:flex;align-items:center;justify-content:space-between;padding:16px 18px 12px;border-bottom:1px solid #e5e7eb;flex-shrink:0;">' +
            '<h2 style="margin:0;font-size:17px;color:#1f2937;">✏️ Editar Campaña</h2>' +
            '<button onclick="cerrarModalEditarCampanaMovil()" style="background:#f3f4f6;border:none;border-radius:50%;width:32px;height:32px;font-size:16px;cursor:pointer;display:flex;align-items:center;justify-content:center;color:#6b7280;">✕</button>' +
        '</div>' +
        '<div style="padding:16px 18px 20px;overflow-y:auto;flex:1;">' +
            '<form id="form-editar-campana-movil" onsubmit="event.preventDefault(); guardarEdicionCampanaMovil(' + id + ')">' +
            '<label style="display:block;font-weight:600;font-size:13px;color:#374151;margin-bottom:6px;">📋 Nombre de la campaña:</label>' +
            '<input type="text" id="edit-nombre-movil" value="' + nombreEsc + '" placeholder="Nombre de la campaña" required style="width:100%;padding:14px 16px;border:2px solid #e5e7eb;border-radius:10px;font-size:15px;margin-bottom:16px;box-sizing:border-box;outline:none;transition:border-color 0.2s;" onfocus="this.style.borderColor=\'#6366f1\'" onblur="this.style.borderColor=\'#e5e7eb\'">' +
            
            '<label style="display:block;font-weight:600;font-size:13px;color:#374151;margin-bottom:6px;">📝 Descripción (opcional):</label>' +
            '<textarea id="edit-descripcion-movil" rows="3" placeholder="Descripción de la campaña..." style="width:100%;padding:14px 16px;border:2px solid #e5e7eb;border-radius:10px;font-size:15px;margin-bottom:16px;box-sizing:border-box;font-family:inherit;resize:vertical;outline:none;transition:border-color 0.2s;" onfocus="this.style.borderColor=\'#6366f1\'" onblur="this.style.borderColor=\'#e5e7eb\'">' + descEsc + '</textarea>' +
            
            '<label style="display:block;font-weight:600;font-size:13px;color:#374151;margin-bottom:6px;">📅 Fecha límite (opcional):</label>' +
            '<input type="date" id="edit-fecha-limite-movil" value="' + fechaLimite + '" style="width:100%;padding:14px 16px;border:2px solid #e5e7eb;border-radius:10px;font-size:15px;margin-bottom:16px;box-sizing:border-box;outline:none;transition:border-color 0.2s;" onfocus="this.style.borderColor=\'#6366f1\'" onblur="this.style.borderColor=\'#e5e7eb\'">' +
            
            '<label style="display:block;font-weight:600;font-size:13px;color:#374151;margin-bottom:6px;">📊 Estado:</label>' +
            '<div style="display:flex;gap:10px;margin-bottom:8px;">' +
                '<label style="flex:1;display:flex;align-items:center;justify-content:center;gap:6px;padding:12px 16px;background:' + (estado === 'Activa' ? '#eef2ff' : '#f9fafb') + ';border:2px solid ' + (estado === 'Activa' ? '#6366f1' : '#e5e7eb') + ';border-radius:10px;cursor:pointer;transition:all 0.2s;" onclick="seleccionarEstadoMovil(\'Activa\')">' +
                    '<span style="font-size:18px;">🟢</span>' +
                    '<span style="font-weight:600;font-size:14px;color:' + (estado === 'Activa' ? '#4338ca' : '#6b7280') + '">Activa</span>' +
                '</label>' +
                '<label style="flex:1;display:flex;align-items:center;justify-content:center;gap:6px;padding:12px 16px;background:' + (estado === 'Completada' ? '#eef2ff' : '#f9fafb') + ';border:2px solid ' + (estado === 'Completada' ? '#6366f1' : '#e5e7eb') + ';border-radius:10px;cursor:pointer;transition:all 0.2s;" onclick="seleccionarEstadoMovil(\'Completada\')">' +
                    '<span style="font-size:18px;">✅</span>' +
                    '<span style="font-weight:600;font-size:14px;color:' + (estado === 'Completada' ? '#4338ca' : '#6b7280') + '">Completada</span>' +
                '</label>' +
            '</div>' +
            '<input type="hidden" id="edit-estado-movil" value="' + estado + '">' +
            
            '<div style="display:flex;gap:10px;margin-top:20px;">' +
                '<button type="button" onclick="cerrarModalEditarCampanaMovil()" style="flex:1;padding:14px;background:#f3f4f6;color:#374151;border:none;border-radius:10px;font-size:15px;font-weight:600;cursor:pointer;">Cancelar</button>' +
                '<button type="submit" style="flex:1;padding:14px;background:linear-gradient(135deg,#6366f1,#4f46e5);color:white;border:none;border-radius:10px;font-size:15px;font-weight:700;cursor:pointer;">💾 Guardar</button>' +
            '</div>' +
            '</form>' +
        '</div>';
    
    overlay.appendChild(sheet);
    document.body.appendChild(overlay);
    
    overlay.addEventListener('click', function(e) {
        if (e.target === overlay) cerrarModalEditarCampanaMovil();
    });
}

function cerrarModalEditarCampanaMovil() {
    var modal = document.getElementById('modal-editar-campana-movil');
    if (modal) {
        modal.style.transition = 'opacity 0.2s ease';
        modal.style.opacity = '0';
        setTimeout(function() { modal.remove(); }, 200);
    }
}

function seleccionarEstadoMovil(estado) {
    document.getElementById('edit-estado-movil').value = estado;
    // Actualizar estilos visuales
    var labels = document.querySelectorAll('#modal-editar-campana-movil label[onclick^="seleccionarEstadoMovil"]');
    labels.forEach(function(label) {
        var onclick = label.getAttribute('onclick') || '';
        var isSelected = onclick.indexOf("'" + estado + "'") !== -1;
        if (isSelected) {
            label.style.background = '#eef2ff';
            label.style.borderColor = '#6366f1';
            var span = label.querySelector('span:last-child');
            if (span) span.style.color = '#4338ca';
        } else {
            label.style.background = '#f9fafb';
            label.style.borderColor = '#e5e7eb';
            var span = label.querySelector('span:last-child');
            if (span) span.style.color = '#6b7280';
        }
    });
}

async function guardarEdicionCampanaMovil(id) {
    var nombre = document.getElementById('edit-nombre-movil').value.trim();
    var descripcion = document.getElementById('edit-descripcion-movil').value.trim();
    var fechaLimite = document.getElementById('edit-fecha-limite-movil').value;
    var estado = document.getElementById('edit-estado-movil').value;
    
    if (!nombre) {
        alert('El nombre de la campaña es requerido');
        return;
    }
    
    // Deshabilitar botones
    var submitBtn = document.querySelector('#form-editar-campana-movil button[type="submit"]');
    var cancelBtn = document.querySelector('#form-editar-campana-movil button[type="button"]');
    if (submitBtn) { submitBtn.textContent = '⏳ Guardando...'; submitBtn.disabled = true; }
    if (cancelBtn) cancelBtn.disabled = true;
    
    try {
        var response = await fetch('/api/gestiones-maestro/' + id, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                nombre: nombre,
                descripcion: descripcion,
                fecha_limite: fechaLimite || null,
                estado: estado
            })
        });
        
        var resultado = await response.json();
        
        if (response.ok && !resultado.error) {
            alert('✅ Campaña actualizada correctamente');
            cerrarModalEditarCampanaMovil();
            await cargarListaCampanas();
            // Si es la campaña activa, actualizar el título
            if (String(gestionId) === String(id)) {
                var tituloEl = document.getElementById('gestion-titulo');
                if (tituloEl) tituloEl.textContent = nombre;
            }
        } else {
            alert('Error: ' + (resultado.error || 'Error al actualizar campaña'));
            if (submitBtn) { submitBtn.textContent = '💾 Guardar'; submitBtn.disabled = false; }
            if (cancelBtn) cancelBtn.disabled = false;
        }
    } catch (error) {
        console.error('[movil] Error editando campaña:', error);
        alert('Error al actualizar la campaña');
        if (submitBtn) { submitBtn.textContent = '💾 Guardar'; submitBtn.disabled = false; }
        if (cancelBtn) cancelBtn.disabled = false;
    }
}

// ================== FIN EDITAR CAMPAÑA (MÓVIL) ==================

// ================== ELIMINAR CAMPAÑA (MÓVIL) ==================

function confirmarEliminarCampañaMovil(id, nombre, total, gestionadas) {
    var pendientes = total - gestionadas;
    
    var overlay = document.createElement('div');
    overlay.id = 'modal-eliminar-campana-movil';
    overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.4);z-index:10000;display:flex;align-items:flex-end;justify-content:center;animation:fadeIn 0.2s ease;';
    
    var sheet = document.createElement('div');
    sheet.style.cssText = 'background:white;width:100%;max-height:70vh;border-radius:20px 20px 0 0;display:flex;flex-direction:column;overflow:hidden;animation:slideUp 0.3s ease;box-shadow:0 -10px 40px rgba(0,0,0,0.15);';
    
    var nombreEsc = escaparParaHTML(nombre);
    
    sheet.innerHTML = 
        '<div style="display:flex;align-items:center;justify-content:space-between;padding:16px 18px 12px;border-bottom:1px solid #e5e7eb;flex-shrink:0;">' +
            '<h2 style="margin:0;font-size:17px;color:#dc2626;">🗑️ Eliminar Campaña</h2>' +
            '<button onclick="cerrarModalEliminarCampanaMovil()" style="background:#f3f4f6;border:none;border-radius:50%;width:32px;height:32px;font-size:16px;cursor:pointer;display:flex;align-items:center;justify-content:center;color:#6b7280;">✕</button>' +
        '</div>' +
        '<div style="padding:16px 18px 20px;overflow-y:auto;flex:1;">' +
            '<div style="background:#fef2f2;padding:16px;border-radius:12px;margin-bottom:16px;">' +
                '<p style="margin:0 0 8px;font-size:14px;color:#991b1b;"><strong>Campaña:</strong> ' + nombreEsc + '</p>' +
                '<p style="margin:0 0 8px;font-size:13px;color:#991b1b;">📄 Total solicitudes: ' + total + '</p>' +
                '<p style="margin:0 0 8px;font-size:13px;color:#991b1b;">✓ Gestionadas: ' + gestionadas + '</p>' +
                '<p style="margin:0;font-size:13px;color:#991b1b;">⏳ Pendientes: ' + pendientes + '</p>' +
            '</div>' +
            '<div style="background:#fef3c7;border:1px solid #f59e0b;padding:14px;border-radius:10px;margin-bottom:16px;">' +
                '<p style="margin:0 0 6px;font-weight:bold;font-size:13px;color:#92400e;">⚠️ IMPORTANTE:</p>' +
                '<ul style="margin:0;padding-left:18px;font-size:12px;color:#92400e;">' +
                    '<li style="margin-bottom:4px;">Se eliminarán <strong>TODAS las gestiones</strong> registradas.</li>' +
                    '<li style="margin-bottom:4px;">Esta acción es <strong>IRREVERSIBLE</strong>.</li>' +
                    '<li>Los datos de las solicitudes originales NO se eliminarán.</li>' +
                '</ul>' +
            '</div>' +
            '<div style="display:flex;gap:10px;margin-top:20px;">' +
                '<button type="button" onclick="cerrarModalEliminarCampanaMovil()" style="flex:1;padding:14px;background:#f3f4f6;color:#374151;border:none;border-radius:10px;font-size:15px;font-weight:600;cursor:pointer;">Cancelar</button>' +
                '<button type="button" id="btn-eliminar-campana-movil" onclick="eliminarCampañaMovil(' + id + ')" style="flex:1;padding:14px;background:#dc2626;color:white;border:none;border-radius:10px;font-size:15px;font-weight:700;cursor:pointer;">🗑️ Eliminar</button>' +
            '</div>' +
        '</div>';
    
    overlay.appendChild(sheet);
    document.body.appendChild(overlay);
    
    overlay.addEventListener('click', function(e) {
        if (e.target === overlay) cerrarModalEliminarCampanaMovil();
    });
}

function cerrarModalEliminarCampanaMovil() {
    var modal = document.getElementById('modal-eliminar-campana-movil');
    if (modal) {
        modal.style.transition = 'opacity 0.2s ease';
        modal.style.opacity = '0';
        setTimeout(function() { modal.remove(); }, 200);
    }
}

async function eliminarCampañaMovil(id) {
    var btn = document.getElementById('btn-eliminar-campana-movil');
    if (btn) { btn.textContent = '⏳ Eliminando...'; btn.disabled = true; }
    
    try {
        var response = await fetch('/api/gestiones-maestro/' + id, {
            method: 'DELETE'
        });
        
        var resultado = await response.json();
        
        if (response.ok && !resultado.error) {
            alert('✅ Campaña eliminada correctamente');
            cerrarModalEliminarCampanaMovil();
            
            // Si era la campaña activa, recargar sin ID
            if (String(gestionId) === String(id)) {
                window.location.href = '/m/gestion-lote';
            } else {
                await cargarListaCampanas();
            }
        } else {
            alert('Error: ' + (resultado.error || 'Error al eliminar'));
            if (btn) { btn.textContent = '🗑️ Eliminar'; btn.disabled = false; }
        }
    } catch (error) {
        console.error('[movil] Error eliminando campaña:', error);
        alert('Error al eliminar la campaña');
        if (btn) { btn.textContent = '🗑️ Eliminar'; btn.disabled = false; }
    }
}

// ================== FIN ELIMINAR CAMPAÑA (MÓVIL) ==================

// Iniciar
init();

// ================== WHATSAPP CON IMAGEN INDIVIDUAL ==================

// Obtener el nombre completo del cliente para el saludo del mensaje
function obtenerNombreParaMensaje(nombreCompleto) {
    if (!nombreCompleto) return '';
    return String(nombreCompleto).trim().replace(/\s+/g, ' ');
}

// Generar mensaje predeterminado de WhatsApp con el nombre completo del cliente
function generarMensajeWhatsApp(nombreCompleto) {
    var nombreParaSaludo = obtenerNombreParaMensaje(nombreCompleto);
    var saludo = nombreParaSaludo ? 'Hola ' + nombreParaSaludo + ' 👋' : 'Hola 👋';
    return saludo + '\nCrédito Resuelve a las órdenes 💳✨\n\nTu crédito esta aprobado 🙌\nQué necesitas para tu hogar?, te ayudamos a hacerlo posible 📲';
}

// Abrir modal de WhatsApp para una solicitud (solo texto, sin imagen)
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
    contenido += '<h2>💬 WhatsApp Directo - Solicitud #' + solicitudId + '</h2>';
    contenido += '<div class="modal-info">';
    contenido += '<p><strong>Nombre:</strong> ' + (sol.nombre || '—') + '</p>';
    contenido += '<p><strong>Celular:</strong> ' + celular + '</p>';
    contenido += '</div>';
    contenido += '<div class="modal-form">';
    contenido += '<label>📝 Mensaje:</label>';
    var mensajeDefecto = generarMensajeWhatsApp(sol.nombre);
    var opcionesMensajes = [
        { texto: mensajeDefecto, etiqueta: 'Mensaje predeterminado' },
        { texto: 'Hola ' + (sol.nombre || '') + ' 👋\nCrédito Resuelve a las órdenes 💳✨\n\nTu crédito está aprobado 🙌\n¿Deseas que te ayudemos con tu hogar? 📲', etiqueta: 'Aprobación rápida' },
        { texto: 'Hola ' + (sol.nombre || '') + ' 👋\nTe contactamos de Crédito Resuelve 💳\n\nEstamos listos para ayudarte con tu crédito. ¿Cuándo te parece conversar? 📲', etiqueta: 'Seguimiento simple' },
        { texto: 'Hola ' + (sol.nombre || '') + ' 👋\nQuedamos atentos a tus necesidades.\n\nSi gustas, te compartimos más información sobre tu crédito. 📲', etiqueta: 'Consulta general' }
    ];
    contenido += '<div style="display:flex; flex-wrap:wrap; gap:8px; margin-bottom:10px;">';
    for (var i = 0; i < opcionesMensajes.length; i++) {
        contenido += '<button type="button" class="btn-plantilla-whatsapp" data-index="' + i + '" data-opciones="' + encodeURIComponent(JSON.stringify(opcionesMensajes)) + '" onclick="cambiarMensajeWhatsAppDesdeBoton(this)">' + opcionesMensajes[i].etiqueta + '</button>';
    }
    contenido += '</div>';
    contenido += '<textarea id="whatsapp-img-mensaje" rows="5" placeholder="Escriba su mensaje..." style="margin-bottom: 12px;">' + mensajeDefecto + '</textarea>';
    contenido += '<div style="padding: 12px; background: #f0fdf4; border-radius: 8px; border: 1px solid #86efac; margin-bottom: 12px;">';
    contenido += '<div style="display: flex; align-items: center; gap: 8px;">';
    contenido += '<span style="font-size: 18px;">📱</span>';
    contenido += '<span style="font-size: 13px; color: #166534;">Se abrirá WhatsApp con el mensaje y el número de la solicitud.</span>';
    contenido += '</div>';
    contenido += '<div style="margin-top: 8px; display: flex; align-items: center; gap: 8px;">';
    contenido += '<input type="checkbox" id="whatsapp-abrir-web" checked style="width: 18px; height: 18px;">';
    contenido += '<span style="font-size: 12px; color: #374151;">Abrir WhatsApp al enviar</span>';
    contenido += '</div>';
    contenido += '<div style="margin-top: 6px; display: flex; align-items: center; gap: 8px;">';
    contenido += '<input type="checkbox" id="whatsapp-guardar" style="width: 18px; height: 18px;">';
    contenido += '<span style="font-size: 12px; color: #6b7280;">Guardar gestión en el historial</span>';
    contenido += '</div>';
    contenido += '</div>';
    contenido += '<div class="modal-botones">';
    contenido += '<button class="btn-cancelar" onclick="cerrarModal()">Cancelar</button>';
    contenido += '<button class="btn-guardar" id="btn-whatsapp-img" onclick="enviarWhatsApp(\'' + solicitudId + '\', \'' + celular + '\')">📤 Enviar</button>';
    contenido += '</div>';
    contenido += '</div>';
    contenido += '</div>';
    
    crearModal(contenido);
}

function cambiarMensajeWhatsAppDesdeBoton(boton) {
    var textarea = document.getElementById('whatsapp-img-mensaje');
    if (!textarea || !boton) return;
    var index = parseInt(boton.getAttribute('data-index'), 10);
    var opcionesJson = decodeURIComponent(boton.getAttribute('data-opciones') || '');
    var opciones = JSON.parse(opcionesJson);
    if (opciones[index] && opciones[index].texto) {
        textarea.value = opciones[index].texto;
    }
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

// Enviar WhatsApp (solo texto, sin imagen)
async function enviarWhatsApp(solicitudId, celular) {
    var mensaje = document.getElementById('whatsapp-img-mensaje').value.trim();
    var checkboxAbrir = document.getElementById('whatsapp-abrir-web');
    var abrirApp = checkboxAbrir ? checkboxAbrir.checked : true;
    
    if (!mensaje) {
        alert('Escriba un mensaje para enviar');
        return;
    }
    
    var btn = document.getElementById('btn-whatsapp-img');
    btn.textContent = '⏳ Guardando...';
    btn.disabled = true;
    
    var checkboxGuardar = document.getElementById('whatsapp-guardar');
    var guardar = checkboxGuardar ? checkboxGuardar.checked : false;
    
    try {
        // ===== PASO 1: Guardar gestión SOLO si el checkbox está marcado =====
        if (guardar) {
            var response = await fetch('/api/excel/gestiones', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    solicitud_id: solicitudId,
                    tipo_gestion: 'WhatsApp',
                    observacion: mensaje,
                    gestion_maestro_id: gestionId
                })
            });
            
            var resultado = await response.json();
            
            if (!response.ok || resultado.error) {
                throw new Error(resultado.error || 'Error al guardar gestión');
            }
        }
        
        // ===== PASO 2: Abrir WhatsApp app =====
        if (abrirApp) {
            abrirWhatsAppMovil(celular, mensaje);
        }
        
        if (guardar) {
            alert('✅ Mensaje enviado y gestión guardada');
            cerrarModal();
            await cargarDatosGestionMovil();
        } else {
            alert('✅ Mensaje enviado');
            cerrarModal();
        }
        
    } catch (error) {
        console.error('[WhatsApp Movil] Error:', error);
        alert('Error: ' + error.message);
    } finally {
        btn.textContent = '📤 Enviar';
        btn.disabled = false;
    }
}

