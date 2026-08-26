// ============================================================================
// MÓDULO DE SOLICITUDES - VERSIÓN OPTIMIZADA
// ============================================================================
// Mejoras implementadas:
// 1. AbortController para cancelar peticiones duplicadas en vuelo
// 2. Cache simple en memoria para resultados recientes (TTL 30s)
// 3. Estado de filtros persistente en sessionStorage
// 4. Inicialización paralela (totales + datos simultáneamente)
// 5. LATERAL JOIN en consultas SQL para mejor rendimiento
// 6. Debounce con cancelación de request anterior
// 7. Carga diferida de filtros (después de datos principales)
// ============================================================================

console.log('[Solicitudes] Versión optimizada cargando...');

// ============================================================================
// CONFIGURACIÓN
// ============================================================================
const CONFIG = {
    TAMANO_LOTE: 100,
    DEBOUNCE_MS: 300,
    CACHE_TTL: 30000        // 30 segundos
};

// ============================================================================
// ESTADO GLOBAL
// ============================================================================
let currentOffset = 0;
let isLoading = false;
let hasMoreData = true;
let todosDatos = [];
let datosFilas = {};
let filasSeleccionadas = [];
let busquedaActiva = false;
let debounceBusqueda = null;
let activeController = null;

// Filtros con persistencia
let estadoActual = sessionStorage.getItem('sol_estado') || '';
let segmentoActual = sessionStorage.getItem('sol_segmento') || '';
let fechaDesdeActual = sessionStorage.getItem('sol_fecha_desde') || '';
let fechaHastaActual = sessionStorage.getItem('sol_fecha_hasta') || '';
let vendedorActual = sessionStorage.getItem('sol_vendedor') || '';
let campanaActual = sessionStorage.getItem('sol_campana') || '';
let vistaActual = sessionStorage.getItem('sol_vista') || 'cards';
var TAMANO_LOTE = CONFIG.TAMANO_LOTE;

// Cache de consultas
const queryCache = new Map();

// Variables legacy
let campanaSeleccionadaId = null;
let campanaSeleccionadaNombre = '';

// ============================================================================
// UTILIDADES
// ============================================================================
function getCacheKey(q, estado, segmento, offset, fechaDesde, fechaHasta, vendedor, campana) {
    return `${q}|${estado}|${segmento}|${offset}|${fechaDesde}|${fechaHasta}|${vendedor}|${campana}`;
}
function getFromCache(q, estado, segmento, offset, fechaDesde, fechaHasta, vendedor, campana) {
    const key = getCacheKey(q, estado, segmento, offset, fechaDesde, fechaHasta, vendedor, campana);
    const entry = queryCache.get(key);
    if (entry && Date.now() - entry.timestamp < CONFIG.CACHE_TTL) {
        return entry.data;
    }
    queryCache.delete(key);
    return null;
}
function setCache(q, estado, segmento, offset, data, fechaDesde, fechaHasta, vendedor, campana) {
    const key = getCacheKey(q, estado, segmento, offset, fechaDesde, fechaHasta, vendedor, campana);
    queryCache.set(key, { data, timestamp: Date.now() });
}
function persistirEstado() {
    try {
        sessionStorage.setItem('sol_estado', estadoActual);
        sessionStorage.setItem('sol_segmento', segmentoActual);
        sessionStorage.setItem('sol_fecha_desde', fechaDesdeActual);
        sessionStorage.setItem('sol_fecha_hasta', fechaHastaActual);
        sessionStorage.setItem('sol_vendedor', vendedorActual);
        sessionStorage.setItem('sol_campana', campanaActual);
    } catch (e) { /* ignore */ }
}

// ============================================================================
// CAMBIO DE VISTA (Cards / Tabla)
// ============================================================================
function cambiarVista(tipo) {
    vistaActual = tipo;
    try { sessionStorage.setItem('sol_vista', tipo); } catch (e) { /* ignore */ }

    var btnCards = document.getElementById('btn-vista-cards');
    var btnTabla = document.getElementById('btn-vista-tabla');
    var panelCards = document.getElementById('cards-panel');
    var panelTabla = document.getElementById('tabla-panel');

    if (btnCards) btnCards.classList.toggle('active', tipo === 'cards');
    if (btnTabla) btnTabla.classList.toggle('active', tipo === 'tabla');
    if (panelCards) panelCards.style.display = tipo === 'cards' ? '' : 'none';
    if (panelTabla) panelTabla.style.display = tipo === 'tabla' ? '' : 'none';

    renderizarVistaActual(todosDatos);
}

function renderizarVistaActual(datos) {
    if (vistaActual === 'tabla') {
        renderizarTabla(datos);
    } else {
        renderizarCards(datos);
    }
}

function renderizarTabla(datos) {
    var tbody = document.getElementById('tabla-body');
    if (!tbody) return;

    if (!datos || !datos.length) {
        tbody.innerHTML = '<tr><td colspan="11" class="tabla-vacio">📋 No hay solicitudes</td></tr>';
        actualizarContador();
        return;
    }

    var coloresEstado = {
        'ACTIVADA': '#dcfce7', 'RECHAZADA': '#fee2e2', 'DEVUELTA': '#fef3c7',
        'APROBADA PARA LIBERACIÓN': '#d1fae5'
    };

    var html = '';
    for (var i = 0; i < datos.length; i++) {
        var item = datos[i];
        if (!item) continue;
        var id = item.id_solicitud || '';
        var seleccionado = filasSeleccionadas.indexOf(id) > -1;
        var noAplica = item.no_aplica_credito == 0;
        var colorEstado = coloresEstado[item.estado] || '#f3f4f6';

        var rowClass = seleccionado ? 'seleccionada' : '';
        if (noAplica) rowClass += ' no-aplica-row';

        html += '<tr class="' + rowClass.trim() + '" data-id="' + id + '" onclick="toggleRowDesktop(\'' + id + '\', event)">';

        // Checkbox
        html += '<td class="col-check" onclick="event.stopPropagation()">';
        html += '<input type="checkbox" class="checkbox-fila card-checkbox" value="' + id + '" onchange="toggleFilaCheckbox(this)" ' + (seleccionado ? 'checked' : '') + '>';
        html += '</td>';

        // ID
        html += '<td class="col-id">' + id + '</td>';

        // Nombre
        html += '<td class="col-nombre">' + panelEscapeHtml(item.nombre || 'Sin nombre') + '</td>';

        // Cédula
        html += '<td class="col-cedula">' + panelEscapeHtml(item.cedula || '—') + '</td>';

        // Estado (badge)
        html += '<td class="col-estado">';
        html += '<span class="tabla-estado-badge" style="background:' + colorEstado + ';">' + (item.estado || '—') + '</span>';
        if (noAplica) html += ' <span class="tabla-noaplica-badge" title="No aplica para crédito">👎</span>';
        html += '</td>';

        // Segmento
        html += '<td class="col-segmento">' + (item.segmento || '—') + '</td>';

        // Producto
        html += '<td class="col-producto">' + (item.producto || '—') + '</td>';

        // Fecha
        html += '<td class="col-fecha">' + (item.fecha_solicitud || '—') + '</td>';

        // Vendedor (solo Lider+)
        if (_esLider) {
            html += '<td class="col-vendedor">' + (item.vendedor || '—') + '</td>';
        }

        // Campaña
        html += '<td class="col-campana">';
        if (item.campana_id && item.nombre_campana) {
            html += '<a class="tabla-campana-link" href="/gestion-lote?id=' + encodeURIComponent(item.campana_id) + '&card=' + encodeURIComponent(id) + '" onclick="event.stopPropagation()">📢 ' + panelEscapeHtml(item.nombre_campana) + '</a>';
        } else {
            html += '<span class="tabla-campana-vacia">📭 Sin campaña</span>';
        }
        html += '</td>';

        // Acciones
        html += '<td class="col-acciones" onclick="event.stopPropagation()">';
        html += '<div class="tabla-acciones">';
        html += '<button class="tabla-acciones-btn" onclick="abrirGestionesCard(' + id + ')" title="Gestiones">📋</button>';
        html += '<button class="tabla-acciones-btn" onclick="abrirCompletarInfoCard(' + id + ')" title="Completar info">✏️</button>';
        html += '<button class="tabla-acciones-btn" onclick="whatsAppClienteDesktop(\'' + (item.celular || '') + '\', \'' + escaparParaAtributoDesktop(item.nombre || '') + '\')" title="WhatsApp">💬</button>';
        html += '<button class="tabla-acciones-btn btn-eliminar-tabla" onclick="confirmarEliminarSolicitudDesktop(' + id + ')" title="Eliminar">🗑️</button>';
        html += '</div>';
        html += '</td>';

        html += '</tr>';
    }

    tbody.innerHTML = html;
    recrearSentinelTabla();
    actualizarContador();
}

function toggleRowDesktop(id, event) {
    if (event && event.target && (event.target.tagName === 'BUTTON' || event.target.tagName === 'A' || event.target.tagName === 'INPUT')) return;
    toggleCardDesktop(id, event);
}

function recrearSentinelTabla() {
    var panel = document.getElementById('tabla-panel');
    if (!panel) return;
    var existing = document.getElementById('infinite-scroll-sentinel-table');
    if (existing) {
        existing.innerHTML = isLoading ? '<span class="loader-text">⏳ Cargando más...</span>'
            : hasMoreData ? '<span class="loader-text">📜 Desliza para cargar más...</span>'
            : '<span class="loader-text">✅ No hay más registros</span>';
        return;
    }
    var sentinel = document.createElement('tr');
    sentinel.id = 'infinite-scroll-sentinel-table';
    sentinel.innerHTML = '<td colspan="11" style="text-align:center; padding:20px; color:#6b7280; font-size:14px;">' +
        (hasMoreData ? '📜 Desliza para cargar más...' : '✅ No hay más registros') + '</td>';
    panel.querySelector('tbody').appendChild(sentinel);
}

function toggleFilaCheckboxTodosTabla(checkbox) {
    var checks = document.querySelectorAll('#tabla-body .card-checkbox');
    checks.forEach(function(ch) {
        ch.checked = checkbox.checked;
        toggleFilaCheckbox(ch);
    });
}

// ============================================================================
// INICIALIZACIÓN CONSOLIDADA
// ============================================================================
async function init() {
    try {
        currentOffset = 0;
        todosDatos = [];
        
        // Cargar sesión para obtener nivel de rol
        try {
            var sesionRes = await fetch('/api/auth/sesion');
            var sesionData = await sesionRes.json();
            if (sesionData.autenticado) {
                var rol = (sesionData.usuario?.rol || '').toLowerCase();
                var nivelMap = { superadmin: 100, admin: 50, lider: 30, agente: 20, user: 10 };
                _nivelRol = nivelMap[rol] || 0;
                _esLider = _nivelRol >= 30;
                if (_esLider) mostrarFiltrosLider();
            }
        } catch (e) { console.error('[Solicitudes] Error cargando sesión:', e); }

        // Restaurar vista persistida (cards/tabla)
        var btnCards = document.getElementById('btn-vista-cards');
        var btnTabla = document.getElementById('btn-vista-tabla');
        var panelCards = document.getElementById('cards-panel');
        var panelTabla = document.getElementById('tabla-panel');
        if (btnCards) btnCards.classList.toggle('active', vistaActual === 'cards');
        if (btnTabla) btnTabla.classList.toggle('active', vistaActual === 'tabla');
        if (panelCards) panelCards.style.display = vistaActual === 'cards' ? '' : 'none';
        if (panelTabla) panelTabla.style.display = vistaActual === 'tabla' ? '' : 'none';

        // Ocultar columna vendedor si no es Lider+
        if (!_esLider) {
            var colVendedorTh = document.getElementById('col-vendedor-th');
            if (colVendedorTh) colVendedorTh.style.display = 'none';
        }

        // Cargar datos y dashboard en paralelo (2 requests en lugar de 4+)
        await Promise.all([
            cargarLoteInicial(),
            cargarTotales()
        ]);

        // Cargar filtros después de los datos (diferido para no bloquear)
        setTimeout(() => {
            cargarEstados();
            cargarSegmentos();
        }, 100);

        initInfiniteScroll();
        configurarEventosCheckboxes();
        actualizarInfoPanel();
        restaurarFiltrosUI();

        // Re-aplicar filtros persistidos para que la lista coincida con la UI restaurada
        if (estadoActual || segmentoActual || campanaActual || fechaDesdeActual || fechaHastaActual || vendedorActual) {
            buscarEnServidor(true);
        }
    } catch (error) {
        console.error('[Solicitudes] Error init:', error);
    }
}

// ============================================================================
// CARGA DE DATOS
// ============================================================================
async function cargarLoteInicial() {
    isLoading = true;
    try {
        const response = await fetch(`/api/excel/solicitudes?limite=${CONFIG.TAMANO_LOTE}&offset=0`);
        const result = await response.json();
        const nuevosDatos = Array.isArray(result) ? result : (result.data || []);
        const total = Array.isArray(result) ? result.length : (result.total || 0);
        todosDatos = nuevosDatos;
        currentOffset = nuevosDatos.length;
        hasMoreData = currentOffset < total;
        document.getElementById('totalRegistros').textContent = total;
        document.getElementById('mostrando').textContent = todosDatos.length;
        renderizarVistaActual(todosDatos);
    } catch (error) {
        console.error('[Solicitudes] Error cargando lote inicial:', error);
    } finally {
        isLoading = false;
        recrearSentinel();
    }
}

// Búsqueda con AbortController y cache
async function buscarEnServidor(resetOffset, extraOffset) {
    if (activeController) activeController.abort();
    activeController = new AbortController();
    const signal = activeController.signal;

    const inputBusqueda = document.getElementById('cedula');
    const termino = inputBusqueda ? inputBusqueda.value.trim() : '';
    const tieneFiltros = !!(termino || estadoActual || segmentoActual || campanaActual);
    const nuevoOffset = (extraOffset !== null) ? extraOffset : (resetOffset ? 0 : currentOffset);

    const cached = resetOffset ? getFromCache(termino, estadoActual, segmentoActual, 0, fechaDesdeActual, fechaHastaActual, vendedorActual, campanaActual) : null;
    if (cached) {
        todosDatos = cached;
        currentOffset = cached.length;
        hasMoreData = currentOffset < (cached.total || 0);
        document.getElementById('totalRegistros').textContent = cached.total || cached.length;
        document.getElementById('mostrando').textContent = cached.length;
        renderizarVistaActual(cached);
        return;
    }

    try {
        if (tieneFiltros || fechaDesdeActual || fechaHastaActual || vendedorActual) {
            let url = `/api/excel/solicitudes/buscar?q=${encodeURIComponent(termino || '%')}&limite=${CONFIG.TAMANO_LOTE}&offset=${nuevoOffset}`;
            if (estadoActual) url += `&estado=${encodeURIComponent(estadoActual)}`;
            if (segmentoActual) url += `&segmento=${encodeURIComponent(segmentoActual)}`;
            // Filtros de fecha disponibles para todos los usuarios
            if (fechaDesdeActual) url += `&fecha_desde=${encodeURIComponent(fechaDesdeActual)}`;
            if (fechaHastaActual) url += `&fecha_hasta=${encodeURIComponent(fechaHastaActual)}`;
            // Filtro de vendedor solo para Lider+
            if (_esLider && vendedorActual) url += `&vendedor=${encodeURIComponent(vendedorActual)}`;
            // Filtro de campaña
            if (campanaActual) url += `&campana=${encodeURIComponent(campanaActual)}`;

            const response = await fetch(url, { signal });
            const result = await response.json();
            const datosRecibidos = Array.isArray(result) ? result : (result.data || []);
            const total = Array.isArray(result) ? result.length : (result.total || 0);

            if (resetOffset) {
                todosDatos = datosRecibidos;
                currentOffset = datosRecibidos.length;
                datosRecibidos.total = total;
                setCache(termino, estadoActual, segmentoActual, 0, datosRecibidos, fechaDesdeActual, fechaHastaActual, vendedorActual, campanaActual);
            } else {
                for (let i = 0; i < datosRecibidos.length; i++) todosDatos.push(datosRecibidos[i]);
                currentOffset += datosRecibidos.length;
            }
            hasMoreData = currentOffset < total;
            busquedaActiva = true;
            document.getElementById('totalRegistros').textContent = total;
            document.getElementById('mostrando').textContent = todosDatos.length;
            renderizarVistaActual(todosDatos);
        } else {
            busquedaActiva = false;
            if (resetOffset) { currentOffset = 0; todosDatos = []; await cargarLoteInicial(); }
            else if (extraOffset !== null) { await cargarMasSolicitudes(); }
        }
    } catch (error) {
        if (error.name !== 'AbortError') console.error('[Solicitudes] Error en búsqueda:', error);
    } finally {
        activeController = null;
    }
}

function buscarConDebounce() {
    clearTimeout(debounceBusqueda);
    debounceBusqueda = setTimeout(function() {
        buscarEnServidor(true);
    }, CONFIG.DEBOUNCE_MS);
}

// Infinite scroll
function initInfiniteScroll() {
    var sentinel = document.getElementById('infinite-scroll-sentinel');
    if (!sentinel) return;
    if ('IntersectionObserver' in window) {
        var observer = new IntersectionObserver(function(entries) {
            var entry = entries[0];
            if (entry.isIntersecting && hasMoreData && !isLoading) cargarMas();
        }, { rootMargin: '200px' });
        observer.observe(sentinel);
    }
}

function recrearSentinel() {
    if (vistaActual === 'tabla') return recrearSentinelTabla();
    var container = document.getElementById('cards-container');
    if (!container) return;
    var sentinel = document.getElementById('infinite-scroll-sentinel');
    if (sentinel) {
        sentinel.innerHTML = isLoading ? '<span class="loader-text">⏳ Cargando más...</span>'
            : hasMoreData ? '<span class="loader-text">📜 Desliza para cargar más...</span>'
            : '<span class="loader-text">✅ No hay más registros</span>';
        return;
    }
    sentinel = document.createElement('div');
    sentinel.id = 'infinite-scroll-sentinel';
    sentinel.style.cssText = 'height: 60px; display: flex; align-items: center; justify-content: center; color: #6b7280; font-size: 14px; padding: 20px;';
    sentinel.innerHTML = hasMoreData ? '<span class="loader-text">📜 Desliza para cargar más...</span>' : '<span class="loader-text">✅ No hay más registros</span>';
    container.appendChild(sentinel);
    initInfiniteScroll();
}

async function cargarMas() {
    if (isLoading || !hasMoreData) return;
    if (busquedaActiva || estadoActual || segmentoActual || campanaActual) {
        await buscarEnServidor(false, currentOffset);
        return;
    }
    await cargarMasSolicitudes();
}

async function cargarMasSolicitudes() {
    if (isLoading || !hasMoreData) return;
    isLoading = true;
    var sentinel = document.getElementById('infinite-scroll-sentinel');
    var sentinelTabla = document.getElementById('infinite-scroll-sentinel-table');
    if (sentinel) sentinel.innerHTML = '<span class="loader-text">⏳ Cargando más...</span>';
    if (sentinelTabla) sentinelTabla.innerHTML = '<td colspan="11" style="text-align:center; padding:20px; color:#6b7280;">⏳ Cargando más...</td>';
    try {
        var nuevoOffset = currentOffset;
        var response = await fetch('/api/excel/solicitudes?limite=' + CONFIG.TAMANO_LOTE + '&offset=' + nuevoOffset);
        var result = await response.json();
        var nuevosDatos = Array.isArray(result) ? result : (result.data || []);
        if (nuevosDatos.length > 0) {
            for (var i = 0; i < nuevosDatos.length; i++) todosDatos.push(nuevosDatos[i]);
            currentOffset += nuevosDatos.length;
            var total = Array.isArray(result) ? result.length : (result.total || 0);
            hasMoreData = currentOffset < total;
            aplicarFiltros();
        } else {
            hasMoreData = false;
        }
    } catch (error) {
        console.error('[Solicitudes] Error cargando más datos:', error);
    } finally {
        isLoading = false;
        var msg = hasMoreData ? '📜 Scroll para cargar más...' : '✅ No hay más registros';
        if (sentinel) sentinel.innerHTML = '<span class="loader-text">' + msg + '</span>';
        if (sentinelTabla) sentinelTabla.innerHTML = '<td colspan="11" style="text-align:center; padding:20px; color:#6b7280; font-size:14px;">' + msg + '</td>';
    }
}

// ============================================================================
// FUNCIONES DE SELECCIÓN
// ============================================================================
function toggleFilaCheckbox(checkbox) {
    var fila = checkbox.closest('tr');
    var id = checkbox.value;
    if (checkbox.checked) {
        if (filasSeleccionadas.indexOf(id) === -1) filasSeleccionadas.push(id);
        if (fila) fila.classList.add('fila-seleccionada');
        // Also add seleccionada class to the card
        var card = checkbox.closest('.solicitud-card');
        if (card) card.classList.add('seleccionada');
    } else {
        var index = filasSeleccionadas.indexOf(id);
        if (index > -1) filasSeleccionadas.splice(index, 1);
        if (fila) fila.classList.remove('fila-seleccionada');
        // Also remove seleccionada class from the card
        var card = checkbox.closest('.solicitud-card');
        if (card) card.classList.remove('seleccionada');
    }
    actualizarCheckboxes();
    actualizarContador();
}

// Click en la tarjeta abre el panel de detalle (la selección solo se hace con el checkbox)
function toggleCardDesktop(id, event) {
    // Si el click fue en un checkbox, botón o input, no hacer nada (ellos manejan su propio evento)
    if (event) {
        var target = event.target;
        if (target.classList.contains('checkbox-fila') ||
            target.classList.contains('card-btn') ||
            target.tagName === 'BUTTON' ||
            target.tagName === 'INPUT' ||
            target.closest('.card-btn') ||
            target.closest('.card-checkbox-wrapper')) {
            return;
        }
    }

    abrirPanelSolicitud(id);
}

function seleccionarTodos() {
    var checkboxTodos = document.getElementById('seleccionar-todos');
    var checkboxes = document.querySelectorAll('.checkbox-fila');
    if (checkboxTodos && checkboxTodos.checked) {
        filasSeleccionadas = [];
        checkboxes.forEach(function(cb) {
            cb.checked = true;
            var id = cb.value;
            if (filasSeleccionadas.indexOf(id) === -1) filasSeleccionadas.push(id);
            var fila = cb.closest('tr') || cb.closest('.cliente-card');
            if (fila) fila.classList.add('fila-seleccionada');
            // Also update card visual state
            var card = cb.closest('.solicitud-card');
            if (card) card.classList.add('seleccionada');
        });
    } else {
        checkboxes.forEach(function(cb) {
            cb.checked = false;
            var fila = cb.closest('tr') || cb.closest('.cliente-card');
            if (fila) fila.classList.remove('fila-seleccionada');
            // Also update card visual state
            var card = cb.closest('.solicitud-card');
            if (card) card.classList.remove('seleccionada');
        });
        filasSeleccionadas = [];
    }
    actualizarContador();
}

function actualizarCheckboxes() {
    var checkboxTodos = document.getElementById('seleccionar-todos');
    if (!checkboxTodos) return;
    var checkboxes = document.querySelectorAll('.checkbox-fila');
    var todosMarcados = checkboxes.length > 0 && filasSeleccionadas.length === checkboxes.length;
    checkboxTodos.checked = todosMarcados;
    checkboxTodos.indeterminate = filasSeleccionadas.length > 0 && filasSeleccionadas.length < checkboxes.length;
}

function actualizarContador() {
    var contador = document.getElementById('seleccionadas-count');
    var selectionBar = document.getElementById('selection-bar');
    var toolbarCount = document.getElementById('seleccionadas-count-toolbar');
    
    if (contador) contador.textContent = filasSeleccionadas.length;
    
    if (selectionBar && toolbarCount) {
        if (filasSeleccionadas.length > 0) {
            toolbarCount.textContent = filasSeleccionadas.length;
            // Remove closing class if present
            selectionBar.classList.remove('closing');
            selectionBar.style.display = 'block';
            // Force reflow for animation
            void selectionBar.offsetWidth;
        } else {
            // Animate out
            selectionBar.classList.add('closing');
            setTimeout(function() {
                if (filasSeleccionadas.length === 0) {
                    selectionBar.style.display = 'none';
                    selectionBar.classList.remove('closing');
                }
            }, 250);
        }
    }
    
    // Actualizar el Floating Action Panel contextual
    actualizarFloatingPanel();
}

// ============================================================================
// FLOATING ACTION PANEL - Panel contextual que sigue al usuario al hacer scroll
// ============================================================================
// MEJORA ANTI-FLICKER:
// - Hysteresis: buffer de 80px para evitar toggle en el borde
// - Máquina de estados para eliminar transiciones duplicadas
// - Debounce más estable (120ms)
// - Eliminación de race conditions en setTimeout
// ============================================================================

// Estados posibles del panel flotante
var _fabState = 'hidden'; // 'hidden' | 'visible' | 'animating-out'

function actualizarFloatingPanel() {
    var panel = document.getElementById('floating-actions-panel');
    var countNum = document.getElementById('floating-count-num');
    
    if (!panel || !countNum) return;
    
    countNum.textContent = filasSeleccionadas.length;
    
    if (filasSeleccionadas.length > 0) {
        var selectionBar = document.getElementById('selection-bar');
        var debeMostrar = false;
        
        if (selectionBar && selectionBar.style.display !== 'none') {
            var rect = selectionBar.getBoundingClientRect();
            // HYSTERESIS: buffer de 80px para evitar parpadeo en el borde
            // Solo mostrar si la barra está COMPLETAMENTE fuera de vista
            if (rect.bottom < -80 || rect.top > window.innerHeight + 80) {
                debeMostrar = true;
            }
        } else {
            debeMostrar = true;
        }
        
        // Máquina de estados: solo actuar si cambia el estado
        if (debeMostrar && _fabState !== 'visible') {
            _fabState = 'visible';
            mostrarFloatingPanel(panel);
        } else if (!debeMostrar && _fabState === 'visible') {
            _fabState = 'animating-out';
            ocultarFloatingPanel(panel);
        }
    } else if (_fabState !== 'hidden') {
        _fabState = 'hidden';
        ocultarFloatingPanel(panel);
    }
}

function mostrarFloatingPanel(panel) {
    if (!panel) panel = document.getElementById('floating-actions-panel');
    if (!panel) return;
    panel.classList.remove('closing', 'hidden');
    panel.style.display = 'block';
    void panel.offsetWidth;
    panel.style.opacity = '1';
}

function ocultarFloatingPanel(panel) {
    if (!panel) panel = document.getElementById('floating-actions-panel');
    if (!panel || panel.style.display !== 'block') return;
    panel.classList.remove('hidden');
    panel.classList.add('closing');
    panel.style.opacity = '0';
    // Usar un solo setTimeout sin reevaluación para evitar race conditions
    var hideTimer = setTimeout(function() {
        if (_fabState === 'hidden' || filasSeleccionadas.length === 0) {
            panel.style.display = 'none';
            panel.classList.remove('closing');
            panel.style.opacity = '';
        } else if (_fabState === 'animating-out') {
            // Si durante la animación se reactivó, restaurar
            _fabState = 'visible';
            panel.style.display = 'block';
            panel.classList.remove('closing');
            panel.style.opacity = '1';
        }
    }, 250);
    // Guardar referencia para cancelar si es necesario
    panel._hideTimer = hideTimer;
}

// Variable para controlar el listener de scroll
var _fabListenersAttached = false;

// Inicializar los listeners de scroll Y resize para el FAB
function initScrollAwareFAB() {
    if (_fabListenersAttached) return;
    _fabListenersAttached = true;
    
    var debounceTimer;
    function handleFabUpdate() {
        if (filasSeleccionadas.length === 0) return;
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(function() {
            actualizarFloatingPanel();
        }, 120); // Aumentado de 50ms a 120ms para mayor estabilidad
    }
    
    window.addEventListener('scroll', handleFabUpdate, { passive: true });
    window.addEventListener('resize', handleFabUpdate, { passive: true });
}

// Inicializar el FAB al cargar
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initScrollAwareFAB);
} else {
    initScrollAwareFAB();
}

// Cancelar selección - deselecciona todo con animación
function cancelarSeleccion() {
    var checkboxes = document.querySelectorAll('.checkbox-fila');
    checkboxes.forEach(function(cb) {
        cb.checked = false;
    });
    
    // Remove selection classes from all cards
    document.querySelectorAll('.solicitud-card').forEach(function(card) {
        card.classList.remove('seleccionada');
    });
    
    document.querySelectorAll('.fila-seleccionada').forEach(function(el) {
        el.classList.remove('fila-seleccionada');
    });
    
    filasSeleccionadas = [];
    actualizarCheckboxes();
    actualizarContador();
}

// ============================================================================
// GESTIÓN POR LOTES
// ============================================================================
function generarInformeSeleccionadas() {
    var informe = { total: filasSeleccionadas.length, porEstado: {}, porSegmento: {}, porProducto: {}, celularesUnicos: [] };
    var celularesVistos = {};
    filasSeleccionadas.forEach(function(id) {
        var datos = datosFilas[id];
        if (datos) {
            var estado = datos.estado || 'Sin Estado';
            informe.porEstado[estado] = (informe.porEstado[estado] || 0) + 1;
            var segmento = datos.segmento || 'Sin Segmento';
            informe.porSegmento[segmento] = (informe.porSegmento[segmento] || 0) + 1;
            var producto = datos.producto || 'Sin Producto';
            informe.porProducto[producto] = (informe.porProducto[producto] || 0) + 1;
            if (datos.celular && !celularesVistos[datos.celular]) {
                celularesVistos[datos.celular] = true;
                informe.celularesUnicos.push(datos.celular);
            }
        }
    });
    return informe;
}

// Variable global para saber si el usuario es líder y su equipo_id
var _esLider = false;
var _nivelRol = 0;
var _equipoId = null;

async function abrirModalNuevaGestion() {
    if (filasSeleccionadas.length === 0) { alert('Selecciona al menos una solicitud primero'); return; }
    
    // Obtener datos de sesión y agentes del equipo (para líderes)
    var agentesDisponibles = [];
    var esLider = false;
    
    try {
        var sesionRes = await fetch('/api/auth/sesion');
        var sesionData = await sesionRes.json();
        if (sesionData.autenticado) {
            esLider = !!(sesionData.usuario.es_lider || sesionData.usuario.rol === 'superadmin' || sesionData.usuario.rol === 'admin');
            _esLider = esLider;
            _equipoId = sesionData.usuario.equipo_id;
            if (esLider && _equipoId) {
                try {
                    var dashboardRes = await fetch('/api/equipos/' + _equipoId + '/dashboard');
                    if (dashboardRes.ok) {
                        var dashboardData = await dashboardRes.json();
                        agentesDisponibles = dashboardData.agentes || [];
                    }
                } catch (e) {
                    console.error('[abrirModalNuevaGestion] Error cargando agentes:', e);
                }
            }
        }
    } catch (e) {
        console.error('[abrirModalNuevaGestion] Error obteniendo sesión:', e);
    }
    
    var informe = generarInformeSeleccionadas();
    var opcionesTipoGestionModal = '';
    ['Seguimiento', 'Cobranza', 'Llamada', 'WhatsApp', 'Reclamo', 'Cita', 'Otro'].forEach(function(tipo) {
        opcionesTipoGestionModal += '<option value="' + tipo + '">' + tipo + '</option>';
    });
    
    var agenteSelectorHTML = '';
    if (esLider) {
        if (agentesDisponibles.length > 0) {
            var opcionesAgentes = '<option value="">Sin asignar</option>';
            for (var a = 0; a < agentesDisponibles.length; a++) {
                var ag = agentesDisponibles[a];
                var nombreAgente = ag.nombre || ag.username || 'Agente #' + ag.id;
                opcionesAgentes += '<option value="' + ag.id + '">' + nombreAgente + '</option>';
            }
            agenteSelectorHTML = '<label style="display: block; font-weight: 600; margin-bottom: 4px; font-size: 12px; color: #374151;">👤 Asignar a:</label>' +
                '<select id="agente-id" style="width: 100%; padding: 9px 10px; border: 2px solid #e5e7eb; border-radius: 8px; font-size: 13px; margin-bottom: 10px; background: white; box-sizing: border-box;">' +
                opcionesAgentes + '</select>';
        } else {
            agenteSelectorHTML = '<div style="background: #fef3c7; color: #92400e; padding: 8px 12px; border-radius: 6px; font-size: 12px; margin-bottom: 10px; text-align: center; font-weight: 600;">⚠️ No hay agentes disponibles en tu equipo</div>';
        }
    }
    
    var contenido = '';
    contenido += '<div style="padding: 24px; max-width: 1200px; margin: 0 auto; display: flex; flex-direction: column; max-height: calc(98vh - 48px);">';
    contenido += '<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 18px; flex-shrink: 0;">';
    contenido += '<h2 style="margin: 0; color: #1f2937; font-size: 22px;">🚀 Crear campaña</h2>';
    contenido += '<span style="background: #e0e7ff; color: #3730a3; padding: 6px 14px; border-radius: 20px; font-size: 13px; font-weight: 600;">' + filasSeleccionadas.length + ' solicitudes seleccionadas</span></div>';
    contenido += '<div style="display: grid; grid-template-columns: 1fr 1fr 1.3fr; gap: 16px; flex: 1; min-height: 0;">';
    // Col 1
    contenido += '<div style="background: #f0f9ff; border: 2px solid #0ea5e9; border-radius: 12px; padding: 16px; display: flex; flex-direction: column;">';
    contenido += '<h3 style="margin: 0 0 12px 0; color: #0369a1; font-size: 15px;">📊 INFORME</h3>';
    contenido += '<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 10px;">';
    contenido += '<div style="background: white; padding: 10px; border-radius: 8px; text-align: center;"><div style="font-size: 26px; font-weight: bold; color: #1f2937;">' + informe.total + '</div><div style="font-size: 10px; color: #6b7280; font-weight: 600; text-transform: uppercase;">Total</div></div>';
    contenido += '<div style="background: white; padding: 10px; border-radius: 8px; text-align: center;"><div style="font-size: 26px; font-weight: bold; color: #059669;">' + informe.celularesUnicos.length + '</div><div style="font-size: 10px; color: #6b7280; font-weight: 600; text-transform: uppercase;">Celulares</div></div></div>';
    contenido += '<div style="background: white; padding: 10px; border-radius: 8px; flex: 1; overflow-y: auto;"><div style="font-size: 11px; font-weight: 600; color: #374151; margin-bottom: 6px;">📌 Por Estado</div><div style="display: flex; flex-wrap: wrap; gap: 4px;">';
    Object.keys(informe.porEstado).forEach(function(e) { contenido += '<span style="background: #e0e7ff; padding: 2px 8px; border-radius: 10px; font-size: 10px; color: #3730a3; font-weight: 600;">' + e + ': ' + informe.porEstado[e] + '</span>'; });
    contenido += '</div></div></div>';
    // Col 2
    contenido += '<div style="background: #f0f9ff; border: 2px solid #0ea5e9; border-radius: 12px; padding: 16px; display: flex; flex-direction: column;">';
    contenido += '<div style="background: white; padding: 10px; border-radius: 8px; margin-bottom: 8px; flex: 1; overflow-y: auto;"><div style="font-size: 11px; font-weight: 600; color: #374151; margin-bottom: 6px;">🏷️ Por Segmento</div><div style="display: flex; flex-wrap: wrap; gap: 4px;">';
    Object.keys(informe.porSegmento).forEach(function(s) { contenido += '<span style="background: #fef3c7; padding: 2px 8px; border-radius: 10px; font-size: 10px; color: #92400e; font-weight: 600;">' + s + ': ' + informe.porSegmento[s] + '</span>'; });
    contenido += '</div></div>';
    contenido += '<div style="background: white; padding: 10px; border-radius: 8px; flex: 1; overflow-y: auto;"><div style="font-size: 11px; font-weight: 600; color: #374151; margin-bottom: 6px;">📦 Por Producto</div><div style="display: flex; flex-wrap: wrap; gap: 4px;">';
    Object.keys(informe.porProducto).forEach(function(p) { contenido += '<span style="background: #dcfce7; padding: 2px 8px; border-radius: 10px; font-size: 10px; color: #166534; font-weight: 600;">' + p + ': ' + informe.porProducto[p] + '</span>'; });
    contenido += '</div></div></div>';
    // Col 3
    contenido += '<div style="background: #f0fdf4; border: 2px solid #22c55e; border-radius: 12px; padding: 16px; display: flex; flex-direction: column;"><h3 style="margin: 0 0 12px 0; color: #166534; font-size: 15px;">📋 PLAN DE ACCIÓN</h3>';
    contenido += '<div style="flex: 1;">';
    contenido += agenteSelectorHTML;
    contenido += '<label style="display: block; font-weight: 600; margin-bottom: 4px; font-size: 12px; color: #374151;">📝 Nombre:</label>';
    contenido += '<input type="text" id="nombre-gestion" style="width: 100%; padding: 9px 10px; border: 2px solid #e5e7eb; border-radius: 8px; font-size: 13px; margin-bottom: 10px; box-sizing: border-box;" placeholder="Ej: Gestión Cobranza Enero 2025">';
    contenido += '<label style="display: block; font-weight: 600; margin-bottom: 4px; font-size: 12px; color: #374151;">📋 Tipo:</label>';
    contenido += '<select id="tipo-gestion-lote" style="width: 100%; padding: 9px 10px; border: 2px solid #e5e7eb; border-radius: 8px; font-size: 13px; margin-bottom: 10px; background: white; box-sizing: border-box;">' + opcionesTipoGestionModal + '</select>';
    contenido += '<label style="display: block; font-weight: 600; margin-bottom: 4px; font-size: 12px; color: #374151;">🎯 Objetivo:</label>';
    contenido += '<textarea id="descripcion-gestion" rows="2" style="width: 100%; padding: 9px 10px; border: 2px solid #e5e7eb; border-radius: 8px; font-size: 13px; resize: none; margin-bottom: 10px; box-sizing: border-box;" placeholder="¿Cuál es el objetivo de esta gestión...?"></textarea>';
    contenido += '<label style="display: block; font-weight: 600; margin-bottom: 4px; font-size: 12px; color: #374151;">📅 Fecha Límite:</label>';
    contenido += '<input type="date" id="fecha-limite-gestion" style="width: 100%; padding: 9px 10px; border: 2px solid #e5e7eb; border-radius: 8px; font-size: 13px; margin-bottom: 0; box-sizing: border-box;"></div></div>';
    contenido += '</div>';
    contenido += '<div style="display: flex; gap: 10px; justify-content: flex-end; padding-top: 14px; margin-top: 16px; border-top: 2px solid #e5e7eb; flex-shrink: 0;">';
    contenido += '<button onclick="cerrarModal()" class="btn-modal-cancelar">Cancelar</button>';
    contenido += '<button onclick="crearGestionLote()" class="btn-modal-crear">🚀 Crear Gestión</button></div></div>';
    crearModal(contenido);
}

async function crearGestionLote() {
    var nombre = document.getElementById('nombre-gestion').value.trim();
    var descripcion = document.getElementById('descripcion-gestion').value.trim();
    var fecha_limite = document.getElementById('fecha-limite-gestion').value;
    if (!nombre) { alert('Por favor ingresa un nombre para la gestión'); return; }
    
    // Obtener agente_id si el líder seleccionó uno
    var agenteInput = document.getElementById('agente-id');
    var agente_id = agenteInput ? (agenteInput.value || null) : null;
    
    var btn = document.querySelector('button[onclick="crearGestionLote()"]');
    if (btn) { btn.textContent = '⏳ Creando...'; btn.disabled = true; }
    try {
        var body = { 
            nombre: nombre, 
            descripcion: descripcion, 
            fecha_limite: fecha_limite || null, 
            solicitudes_ids: filasSeleccionadas
        };
        if (agente_id) {
            body.agente_id = agente_id;
        }
        
        var response = await fetch('/api/gestiones-maestro', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        var resultado = await response.json();
        if (response.ok && resultado && resultado.id) {
            var mensaje = 'Gestión creada correctamente';
            if (resultado.asignado_a) {
                mensaje += '. Asignada al agente seleccionado.';
            }
            alert(mensaje);
            cerrarModal();
            window.location.href = '/gestion-lote?id=' + resultado.id;
        } else {
            alert('Error: ' + ((resultado && resultado.error) || 'Error desconocido'));
        }
    } catch (error) {
        console.error('[crearGestionLote] Error:', error);
        alert('Error al crear la gestión: ' + error.message);
    } finally {
        if (btn) { btn.textContent = '🚀 Crear Gestión'; btn.disabled = false; }
    }
}

// ============================================================================
// AGREGAR A CAMPAÑA EXISTENTE
// ============================================================================

async function abrirModalAgregarCampana() {
    if (filasSeleccionadas.length === 0) {
        alert('Selecciona al menos una solicitud primero');
        return;
    }

    campanaSeleccionadaId = null;
    campanaSeleccionadaNombre = '';

    var contenido = '';
    contenido += '<div style="display: flex; flex-direction: column; max-height: 80vh; overflow: hidden; padding: 24px; max-width: 600px; margin: 0 auto;">';
    contenido += '<div style="flex-shrink: 0; display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 14px;">';
    contenido += '<h2 style="margin: 0; color: #1f2937; font-size: 20px;">➕ Agregar a Campaña</h2>';
    contenido += '<button id="btn-confirmar-agregar" onclick="confirmarAgregarCampanaDesktop()" disabled style="padding: 10px 18px; background: #9ca3af; color: white; border: none; border-radius: 10px; font-size: 14px; font-weight: 600; cursor: not-allowed; transition: all 0.2s ease; white-space: nowrap;">Selecciona una campaña</button>';
    contenido += '</div>';
    contenido += '<div style="flex-shrink: 0; display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 12px;">';
    contenido += '<div style="background: #e0e7ff; padding: 8px 14px; border-radius: 8px; font-size: 13px; font-weight: 600; color: #3730a3;">' + filasSeleccionadas.length + ' solicitudes seleccionadas</div>';
    contenido += '<button onclick="cerrarModal()" class="btn-modal-cancelar">Cancelar</button>';
    contenido += '</div>';
    contenido += '<div id="campanas-list-desktop" style="flex: 1; min-height: 0; overflow-y: auto; text-align: center; padding: 40px; color: #6b7280;">⏳ Cargando campañas...</div>';
    contenido += '</div>';

    crearModal(contenido);

    try {
        var response = await fetch('/api/gestiones-maestro', { credentials: 'include' });
        if (!response.ok) throw new Error('Error al cargar campañas');
        var campanas = await response.json();
        renderizarListaCampanasDesktop(campanas);
    } catch (error) {
        console.error('[abrirModalAgregarCampana] Error:', error);
        var listContainer = document.getElementById('campanas-list-desktop');
        if (listContainer) listContainer.innerHTML = '<div style="color: #dc2626;">❌ Error al cargar campañas</div>';
    }
}

function renderizarListaCampanasDesktop(campanas) {
    var container = document.getElementById('campanas-list-desktop');
    if (!container) return;

    if (!campanas || campanas.length === 0) {
        container.innerHTML = '<div style="text-align: center; padding: 40px; color: #6b7280;">📭 No hay campañas creadas aún.<br><br><button onclick="cerrarModal(); abrirModalNuevaGestion()" style="padding: 12px 24px; background: #2563eb; color: white; border: none; border-radius: 8px; font-weight: 600; cursor: pointer; font-size: 14px;">🚀 Crear nueva campaña</button></div>';
        return;
    }

    var html = '<div style="display: flex; flex-direction: column; gap: 8px;">';
    for (var i = 0; i < campanas.length; i++) {
        var c = campanas[i];
        var gestionadas = parseInt(c.gestionadas || 0);
        var total = parseInt(c.total_solicitudes || 0);
        var progreso = total > 0 ? Math.round((gestionadas / total) * 100) : 0;

        var estadoColor = '#6b7280';
        var estadoBg = '#f3f4f6';
        if (c.estado === 'activa') { estadoColor = '#065f46'; estadoBg = '#dcfce7'; }
        else if (c.estado === 'completada') { estadoColor = '#1e40af'; estadoBg = '#dbeafe'; }
        else if (c.estado === 'pausada') { estadoColor = '#92400e'; estadoBg = '#fef3c7'; }

        var nombreAttr = String(c.nombre || 'Sin nombre').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
        html += '<div class="campana-item-select" data-id="' + c.id + '" data-nombre="' + nombreAttr + '" style="background: #f8fafc; border: 2px solid #e5e7eb; border-radius: 10px; padding: 14px; cursor: pointer; transition: all 0.2s ease;" onclick="seleccionarCampanaDesktop(this, \'' + c.id + '\')" onmouseenter="this.style.borderColor=\x27#93c5fd\x27;this.style.background=\x27#f0f5ff\x27" onmouseleave="var isSel=this.classList.contains(\x27seleccionada\x27);if(!isSel){this.style.borderColor=\x27#e5e7eb\x27;this.style.background=\x27#f8fafc\x27}">';
        html += '<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">';
        html += '<span style="font-weight: 600; font-size: 14px; color: #1f2937;">' + (c.nombre || 'Sin nombre') + '</span>';
        html += '<span style="background: ' + estadoBg + '; color: ' + estadoColor + '; padding: 3px 10px; border-radius: 12px; font-size: 11px; font-weight: 600;">' + (c.estado || '—') + '</span>';
        html += '</div>';
        html += '<div style="display: flex; gap: 15px; font-size: 12px; color: #6b7280;">';
        html += '<span>📋 ' + total + ' solicitudes</span>';
        html += '<span>✅ ' + gestionadas + ' gestionadas</span>';
        html += '<span>📊 ' + progreso + '%</span>';
        html += '</div>';
        html += '</div>';
    }
    html += '</div>';

    container.innerHTML = html;
}

function seleccionarCampanaDesktop(elemento, id) {
    document.querySelectorAll('.campana-item-select').forEach(function(el) {
        el.classList.remove('seleccionada');
        el.style.borderColor = '#e5e7eb';
        el.style.background = '#f8fafc';
    });
    elemento.classList.add('seleccionada');
    elemento.style.borderColor = '#2563eb';
    elemento.style.background = '#eff6ff';
    campanaSeleccionadaId = id;
    campanaSeleccionadaNombre = (elemento.getAttribute('data-nombre') || '').replace(/&quot;/g, '"').replace(/&#39;/g, "'");

    var btn = document.getElementById('btn-confirmar-agregar');
    if (btn) {
        btn.disabled = false;
        btn.style.background = '#2563eb';
        btn.style.cursor = 'pointer';
        btn.textContent = '➕ Agregar a esta campaña';
    }
}

async function confirmarAgregarCampanaDesktop() {
    if (!campanaSeleccionadaId) {
        alert('Selecciona una campaña primero');
        return;
    }
    if (filasSeleccionadas.length === 0) {
        alert('No hay solicitudes seleccionadas');
        return;
    }

    var btn = document.getElementById('btn-confirmar-agregar');
    if (btn) { btn.textContent = '⏳ Agregando...'; btn.disabled = true; }

    try {
        var response = await fetch('/api/gestiones-maestro/' + campanaSeleccionadaId + '/agregar-solicitudes', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ solicitudes_ids: filasSeleccionadas })
        });
        var resultado = await response.json();
        if (response.ok) {
            var nombreCampana = campanaSeleccionadaNombre || 'la campaña';
            var enviadas = (resultado && resultado.agregados) ? resultado.agregados : filasSeleccionadas.length;
            cerrarModal();
            cancelarSeleccion();
            queryCache.clear();
            buscarEnServidor(true);
            if (typeof mostrarToastSimple === 'function') {
                mostrarToastSimple('✅ ' + enviadas + ' solicitudes enviadas a la campaña "' + nombreCampana + '"');
            } else {
                alert('✅ ' + (resultado.mensaje || 'Solicitudes agregadas correctamente'));
            }
        } else {
            alert('Error: ' + (resultado.error || 'Error desconocido'));
            if (btn) { btn.textContent = '➕ Agregar a esta campaña'; btn.disabled = false; }
        }
    } catch (error) {
        console.error('Error agregando a campaña:', error);
        alert('Error al agregar solicitudes: ' + error.message);
        if (btn) { btn.textContent = '➕ Agregar a esta campaña'; btn.disabled = false; }
    }
}

// ============================================================================
// FUNCIONES FALTANTES - Renderizado, filtros, utilidades
// ============================================================================

// ============================================================================
// FLAG "YA NO APLICA PARA CRÉDITO" (DESKTOP)
// ============================================================================

function confirmarNoAplicaCreditoDesktop(id, nuevoValor, tieneCampana) {
    if (nuevoValor === 1) {
        // Revertir: directo
        marcarNoAplicaCreditoDesktop(id, 1);
        return;
    }
    
    var contenido = '';
    contenido += '<div style="padding:24px;max-width:420px;">';
    contenido += '<h2 style="margin:0 0 16px;font-size:18px;color:#dc2626;">👎 Marcar como "Ya no aplica para crédito"</h2>';
    contenido += '<div style="background:#fef2f2;padding:14px;border-radius:12px;margin-bottom:16px;font-size:14px;color:#991b1b;"><strong>Solicitud:</strong> #' + id + '</div>';
    contenido += '<div style="background:#fef3c7;border:1px solid #f59e0b;padding:14px;border-radius:10px;margin-bottom:20px;">';
    contenido += '<p style="margin:0 0 6px;font-weight:bold;font-size:13px;color:#92400e;">⚠️ ¿Estás seguro?</p>';
    contenido += '<ul style="margin:0;padding-left:18px;font-size:12px;color:#92400e;">';
    contenido += '<li style="margin-bottom:4px;">Se marcará como <strong>ya no aplica para crédito</strong>.</li>';
    if (tieneCampana) contenido += '<li style="margin-bottom:4px;">Será <strong>quitada de su campaña actual</strong>.</li>';
    contenido += '<li style="margin-bottom:4px;">Las gestiones registradas <strong>NO</strong> se eliminarán.</li>';
    contenido += '<li>Puedes revertirlo después pulsando 👍.</li>';
    contenido += '</ul>';
    contenido += '</div>';
    contenido += '<div style="display:flex;gap:10px;">';
    contenido += '<button class="btn-cancelar" onclick="cerrarModal()" style="flex:1;padding:12px;background:#f3f4f6;color:#374151;border:none;border-radius:10px;font-size:14px;font-weight:600;cursor:pointer;">Cancelar</button>';
    contenido += '<button class="btn-eliminar" id="btn-confirmar-no-aplica" onclick="marcarNoAplicaCreditoDesktop(' + id + ', 0)" style="flex:1;padding:12px;background:#dc2626;color:white;border:none;border-radius:10px;font-size:14px;font-weight:700;cursor:pointer;">👎 Marcar</button>';
    contenido += '</div>';
    contenido += '</div>';
    crearModal(contenido);
}

async function marcarNoAplicaCreditoDesktop(id, valor) {
    var btn = document.getElementById('btn-confirmar-no-aplica');
    if (btn) { btn.textContent = '⏳ Procesando...'; btn.disabled = true; }
    
    try {
        var response = await fetch('/api/excel/solicitudes/' + encodeURIComponent(id) + '/no-aplica-credito', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ no_aplica_credito: Number(valor) })
        });
        
        var resultado = await response.json().catch(function() { return {}; });
        
        if (!response.ok || resultado.error) {
            alert(resultado.error || 'No se pudo actualizar la solicitud');
            if (btn) { btn.textContent = '👎 Marcar'; btn.disabled = false; }
            return;
        }
        
        if (btn) cerrarModal();
        alert(Number(valor) === 0 ? '✅ Marcada como "ya no aplica para crédito"' : '✅ Solicitud restaurada: aplica para crédito');
        buscarEnServidor(true);
    } catch (error) {
        console.error('Error marcando no aplica crédito:', error);
        alert('Error al actualizar la solicitud');
        if (btn) { btn.textContent = '👎 Marcar'; btn.disabled = false; }
    }
}

// ============================================================================
// RENDERIZAR CARDS (estructura unificada móvil-escritorio)
// ============================================================================
function renderizarCards(datos) {
    var container = document.getElementById('cards-container');
    if (!container) return;

    if (!datos || !datos.length) {
        container.innerHTML = '<div class="estado-vacio"><div class="vacio-icon">📋</div>No hay solicitudes</div>';
        actualizarContador();
        return;
    }

    // Actualizar datos globales
    datosFilas = {};
    datos.forEach(function(d) {
        if (d && d.id_solicitud) datosFilas[d.id_solicitud] = d;
    });

    var coloresEstado = {
        'ACTIVADA': '#dcfce7',
        'RECHAZADA': '#fee2e2',
        'DEVUELTA': '#fef3c7',
        'APROBADA PARA LIBERACIÓN': '#d1fae5'
    };

    var html = '';
    for (var i = 0; i < datos.length; i++) {
        var item = datos[i];
        if (!item) continue;
        var id = item.id_solicitud || '';
        var seleccionado = filasSeleccionadas.indexOf(id) > -1 ? 'seleccionada' : '';
        var estadoClase = 'estado-' + (item.estado || '').replace(/\s+/g, '').toUpperCase();
        var colorEstado = coloresEstado[item.estado] || '#f3f4f6';
        var noAplica = item.no_aplica_credito == 0;

        html += '<div class="solicitud-card ' + seleccionado + (noAplica ? ' no-aplica-credito' : '') + '" data-id="' + id + '" onclick="toggleCardDesktop(\'' + id + '\', event)">';

        // FILA 1: Checkbox + Segmento + Estado
        html += '  <div class="card-fila-1">';
        html += '    <div class="card-checkbox-wrapper" onclick="event.stopPropagation()">';
        html += '      <input type="checkbox" class="checkbox-fila card-checkbox" value="' + id + '" onchange="toggleFilaCheckbox(this)" ' + (seleccionado ? 'checked' : '') + '>';
        html += '    </div>';
        html += '    <span class="card-badge badge-segmento" title="' + (item.segmento || 'Sin segmento') + '">' + (item.segmento || '—') + '</span>';
        html += '    <span class="card-badge badge-estado ' + estadoClase + '" style="background:' + colorEstado + ';">' + (item.estado || 'Sin estado') + '</span>';
        if (noAplica) html += '    <span class="noaplica-mini-badge">👎 No aplica</span>';
        html += '  </div>';

        // FILA 2: Nombre + Cédula (columna)
        html += '  <div class="card-fila-2">';
        html += '    <span class="card-fila-2-nombre">' + panelEscapeHtml(item.nombre || 'Sin nombre') + '</span>';
        html += '    <span class="card-fila-2-cedula">🆔 ' + panelEscapeHtml(item.cedula || 'Sin cédula') + '</span>';
        html += '  </div>';

        // FILA 3: Botones de acción (sin Llamar)
        html += '  <div class="card-fila-3">';
        html += '    <button class="card-btn btn-gestiones" onclick="event.stopPropagation(); abrirGestionesCard(' + id + ')"><span class="btn-icon">📋</span><span class="btn-label">Gestiones</span></button>';
        html += '    <button class="card-btn btn-completar" onclick="event.stopPropagation(); abrirCompletarInfoCard(' + id + ')"><span class="btn-icon">✏️</span><span class="btn-label">Completar</span></button>';
        html += '    <button class="card-btn btn-whatsapp" onclick="event.stopPropagation(); whatsAppClienteDesktop(\'' + (item.celular || '') + '\', \'' + escaparParaAtributoDesktop(item.nombre || '') + '\')"><span class="btn-icon">💬</span><span class="btn-label">WhatsApp</span></button>';
        html += '    <button class="card-btn btn-eliminar" onclick="event.stopPropagation(); confirmarEliminarSolicitudDesktop(' + id + ')"><span class="btn-icon">🗑️</span><span class="btn-label">Eliminar</span></button>';
        html += '  </div>';

        // FILA 4: Link a campaña + toggle No-aplica
        html += '  <div class="card-fila-4">';
        if (item.campana_id && item.nombre_campana) {
            html += '    <a class="campana-link" href="/gestion-lote?id=' + encodeURIComponent(item.campana_id) + '&card=' + encodeURIComponent(id) + '" onclick="event.stopPropagation()"><span>📢 ' + panelEscapeHtml(item.nombre_campana) + ' →</span></a>';
        } else {
            html += '    <span class="campana-link campana-link-vacia"><span>📭 Sin campaña</span></span>';
        }
        html += '    <button type="button" class="noaplica-icon-btn' + (noAplica ? ' activo' : '') + '" onclick="event.stopPropagation(); confirmarNoAplicaCreditoDesktop(' + id + ', ' + (noAplica ? 1 : 0) + ', ' + (item.campana_id ? 1 : 0) + ')" title="' + (noAplica ? 'Restaurar: aplica para crédito' : 'Marcar: ya no aplica para crédito') + '" aria-label="No aplica para crédito">👎</button>';
        html += '  </div>';

        // FILA 5: Producto + Fecha + Vendedor
        html += '  <div class="card-fila-5">';
        html += '    <span class="card-tag">📦 <span>' + (item.producto || '—') + '</span></span>';
        html += '    <span class="card-tag">📅 <span>' + (item.fecha_solicitud || '—') + '</span></span>';
        if (_esLider && item.vendedor) {
            html += '    <span class="card-tag vendedor-badge">👤 <span>' + item.vendedor + '</span></span>';
        }
        html += '  </div>';

        html += '</div>';
    }

    container.innerHTML = html;
    recrearSentinel();
    actualizarContador();
}

// Funciones de escape para atributos HTML
function escaparParaAtributoDesktop(texto) {
    return String(texto || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

// ============================================================================
// CARGAR TOTALES
// ============================================================================
async function cargarTotales() {
    try {
        var res = await fetch('/api/excel/dashboard', { credentials: 'include' });
        if (res.ok) {
            var data = await res.json();
            if (data && data.total !== undefined) {
                document.getElementById('totalRegistros').textContent = data.total;
            }
        }
    } catch (error) {
        console.error('[Solicitudes] Error cargando totales:', error);
    }
}

// ============================================================================
// CARGAR ESTADOS Y SEGMENTOS (FILTROS)
// ============================================================================
async function cargarEstados() {
    try {
        var res = await fetch('/api/excel/dashboard/estados', { credentials: 'include' });
        if (res.ok) {
            var data = await res.json();
            if (data && data.length) {
                var select = document.getElementById('filtro-estado-select');
                if (select) {
                    var html = '<option value="">Todos</option>';
                    html += '<option value="__no_aplica_credito__"' + (estadoActual === '__no_aplica_credito__' ? ' selected' : '') + '>👎 No aplica para crédito</option>';
                    for (var i = 0; i < data.length; i++) {
                        var e = data[i].estado || data[i];
                        var sel = estadoActual === e ? ' selected' : '';
                        html += '<option value="' + String(e).replace(/"/g, '&quot;') + '"' + sel + '>' + e + '</option>';
                    }
                    select.innerHTML = html;
                }
            }
        }
    } catch (error) {
        console.error('[Solicitudes] Error cargando estados:', error);
    }
}

async function cargarSegmentos() {
    try {
        var res = await fetch('/api/excel/dashboard/segmentos', { credentials: 'include' });
        if (res.ok) {
            var data = await res.json();
            if (data && data.length) {
                var select = document.getElementById('filtro-segmento-select');
                if (select) {
                    var html = '<option value="">Todos</option>';
                    for (var i = 0; i < data.length; i++) {
                        var s = data[i].segmento || data[i];
                        var sel = segmentoActual === s ? ' selected' : '';
                        html += '<option value="' + String(s).replace(/"/g, '&quot;') + '"' + sel + '>' + s + '</option>';
                    }
                    select.innerHTML = html;
                }
            }
        }
    } catch (error) {
        console.error('[Solicitudes] Error cargando segmentos:', error);
    }
}

// ============================================================================
// FILTROS LIDER+ (Fecha y Vendedor)
// ============================================================================
function mostrarFiltrosLider() {
    var filtrosLider = document.getElementById('filtrosLider');
    if (filtrosLider) {
        filtrosLider.style.display = 'flex';
        // Restaurar valores de session
        var fd = document.getElementById('fechaDesde');
        var fh = document.getElementById('fechaHasta');
        var fv = document.getElementById('filtroVendedor');
        if (fd && fechaDesdeActual) fd.value = fechaDesdeActual;
        if (fh && fechaHastaActual) fh.value = fechaHastaActual;
        if (fv && vendedorActual) fv.value = vendedorActual;
        cargarVendedores();
    }
}

async function cargarVendedores() {
    try {
        var res = await fetch('/api/excel/solicitudes/vendedores', { credentials: 'include' });
        if (res.ok) {
            var vendedores = await res.json();
            var datalist = document.getElementById('vendedoresList');
            if (datalist) {
                datalist.innerHTML = '';
                vendedores.forEach(function(v) {
                    var option = document.createElement('option');
                    option.value = v;
                    datalist.appendChild(option);
                });
            }
        }
    } catch (e) {
        console.warn('[Solicitudes] No se pudo cargar lista de vendedores:', e);
    }
}

function aplicarFiltrosLider() {
    var fd = document.getElementById('fechaDesde');
    var fh = document.getElementById('fechaHasta');
    var fv = document.getElementById('filtroVendedor');
    fechaDesdeActual = fd ? fd.value : '';
    fechaHastaActual = fh ? fh.value : '';
    vendedorActual = fv ? fv.value.trim() : '';
    sessionStorage.setItem('sol_fecha_desde', fechaDesdeActual);
    sessionStorage.setItem('sol_fecha_hasta', fechaHastaActual);
    sessionStorage.setItem('sol_vendedor', vendedorActual);
    buscarEnServidor(true);
}


// ============================================================================
// CONFIGURAR EVENTOS DE CHECKBOXES Y FILTROS
// ============================================================================
function configurarEventosCheckboxes() {
    // Selects de filtro (Estado y Segmento): se aplican al cambiar
    var selectEstado = document.getElementById('filtro-estado-select');
    var selectSegmento = document.getElementById('filtro-segmento-select');

    if (selectEstado) {
        selectEstado.onchange = function() {
            estadoActual = this.value;
            persistirEstado();
            buscarEnServidor(true);
        };
    }
    if (selectSegmento) {
        selectSegmento.onchange = function() {
            segmentoActual = this.value;
            persistirEstado();
            buscarEnServidor(true);
        };
    }

    var selectCampana = document.getElementById('filtro-campana-select');
    if (selectCampana) {
        selectCampana.onchange = function() {
            campanaActual = this.value;
            persistirEstado();
            buscarEnServidor(true);
        };
    }

    // Filtros de líder (Fecha Desde/Hasta y Vendedor): se aplican al cambiar
    var fd = document.getElementById('fechaDesde');
    var fh = document.getElementById('fechaHasta');
    var fv = document.getElementById('filtroVendedor');
    if (fd) fd.onchange = aplicarFiltrosLider;
    if (fh) fh.onchange = aplicarFiltrosLider;
    if (fv) {
        var timerVendedor = null;
        fv.oninput = function() {
            clearTimeout(timerVendedor);
            timerVendedor = setTimeout(aplicarFiltrosLider, 400);
        };
    }

    // Evento para el buscador
    var inputBusqueda = document.getElementById('cedula');
    if (inputBusqueda) {
        inputBusqueda.oninput = function() {
            buscarConDebounce();
        };
    }

    // Evento para el checkbox "seleccionar todos"
    var chkTodos = document.getElementById('seleccionar-todos');
    if (chkTodos) {
        chkTodos.onchange = function() {
            seleccionarTodos();
        };
    }

    // Cerrar el menú de acciones al hacer clic fuera o con Escape
    document.addEventListener('click', function(e) {
        var dropdown = document.getElementById('menu-acciones-dropdown');
        if (dropdown && dropdown.classList.contains('visible') && !e.target.closest('.menu-acciones')) {
            dropdown.classList.remove('visible');
        }
    });
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') cerrarMenuAcciones();
    });
}

// ============================================================================
// MENÚ DE ACCIONES DEL HEADER (⋮)
// ============================================================================
function toggleMenuAcciones(event) {
    if (event) event.stopPropagation();
    var dropdown = document.getElementById('menu-acciones-dropdown');
    if (dropdown) dropdown.classList.toggle('visible');
}

function cerrarMenuAcciones() {
    var dropdown = document.getElementById('menu-acciones-dropdown');
    if (dropdown) dropdown.classList.remove('visible');
}

// ============================================================================
// ACTUALIZAR INFO PANEL
// ============================================================================
function actualizarInfoPanel() {
    var resumenEstado = document.getElementById('resumen-estado');
    var resumenSegmento = document.getElementById('resumen-segmento');
    if (resumenEstado) resumenEstado.textContent = estadoActual === '__no_aplica_credito__' ? 'No aplica para crédito' : (estadoActual || 'Todos');
    if (resumenSegmento) resumenSegmento.textContent = segmentoActual || 'Todos';
}

// ============================================================================
// RESTAURAR FILTROS UI DESDE SESSIONSTORAGE
// ============================================================================
function restaurarFiltrosUI() {
    // Los botones de filtro ya se restauran desde cargarEstados/cargarSegmentos
    // porque toman el valor de estadoActual/segmentoActual
    // Restaurar valores de fecha (disponibles para todos los usuarios)
    var fd = document.getElementById('fechaDesde');
    var fh = document.getElementById('fechaHasta');
    if (fd && fechaDesdeActual) fd.value = fechaDesdeActual;
    if (fh && fechaHastaActual) fh.value = fechaHastaActual;
    // Restaurar select de campaña
    var selCampana = document.getElementById('filtro-campana-select');
    if (selCampana && campanaActual) selCampana.value = campanaActual;
    actualizarInfoPanel();
}

// ============================================================================
// APLICAR FILTROS (CLIENT-SIDE)
// ============================================================================
function aplicarFiltros() {
    // Esta función se llama después de cargar más datos
    // Para mantener consistencia, renderizamos todo de nuevo
    renderizarVistaActual(todosDatos);
    document.getElementById('mostrando').textContent = todosDatos.length;
}

// ============================================================================
// EXPORTAR SELECCIONADAS A EXCEL
// ============================================================================
function exportarSeleccionadas() {
    if (filasSeleccionadas.length === 0) {
        alert('Selecciona al menos una solicitud primero');
        return;
    }
    exportarExcel();
}

function exportarExcel() {
    if (filasSeleccionadas.length === 0) {
        alert('Selecciona al menos una solicitud primero');
        return;
    }

    var datosAExportar = [];
    filasSeleccionadas.forEach(function(id) {
        var datos = datosFilas[id];
        if (datos) {
            datosAExportar.push({
                'Solicitud': datos.id_solicitud,
                'Estado': datos.estado,
                'Cédula': datos.cedula,
                'Nombre': datos.nombre,
                'Celular': datos.celular,
                'Código Plus': datos.codigo_plus,
                'Observaciones': datos.observaciones,
                'Segmento': datos.segmento,
                'Producto': datos.producto,
                'Fecha Solicitud': datos.fecha_solicitud
            });
        }
    });

    if (datosAExportar.length === 0) {
        alert('No hay datos para exportar');
        return;
    }

    if (typeof XLSX !== 'undefined') {
        var wb = XLSX.utils.book_new();
        var ws = XLSX.utils.json_to_sheet(datosAExportar);
        var wscols = [
            {wch: 10}, {wch: 15}, {wch: 12}, {wch: 30}, {wch: 12},
            {wch: 15}, {wch: 30}, {wch: 15}, {wch: 20}, {wch: 15}
        ];
        ws['!cols'] = wscols;
        XLSX.utils.book_append_sheet(wb, ws, 'Solicitudes');
        var fecha = new Date().toISOString().replace(/[:.]/g, '-');
        XLSX.writeFile(wb, 'solicitudes_seleccionadas_' + fecha + '.xlsx');
        alert('Se exportaron ' + datosAExportar.length + ' registros a Excel');
    } else {
        alert('La librería Excel no está disponible. Recarga la página.');
    }
}

// ============================================================================
// MARCAR / DESMARCAR SELECCIONADAS
// ============================================================================
function marcarSeleccionadas() {
    var chkTodos = document.getElementById('seleccionar-todos');
    if (chkTodos) {
        chkTodos.checked = !chkTodos.checked;
        seleccionarTodos();
    }
}

// ============================================================================
// LIMPIAR FILTROS
// ============================================================================
function limpiarFiltros() {
    estadoActual = '';
    segmentoActual = '';
    campanaActual = '';
    persistirEstado();

    // Reset selects de estado y segmento
    var selectEstado = document.getElementById('filtro-estado-select');
    var selectSegmento = document.getElementById('filtro-segmento-select');
    var selectCampana = document.getElementById('filtro-campana-select');
    if (selectEstado) selectEstado.value = '';
    if (selectSegmento) selectSegmento.value = '';
    if (selectCampana) selectCampana.value = '';

    // Reset filtros de líder (fechas y vendedor)
    var fd = document.getElementById('fechaDesde');
    var fh = document.getElementById('fechaHasta');
    var fv = document.getElementById('filtroVendedor');
    if (fd) fd.value = '';
    if (fh) fh.value = '';
    if (fv) fv.value = '';
    fechaDesdeActual = '';
    fechaHastaActual = '';
    vendedorActual = '';
    sessionStorage.removeItem('sol_fecha_desde');
    sessionStorage.removeItem('sol_fecha_hasta');
    sessionStorage.removeItem('sol_vendedor');
    sessionStorage.removeItem('sol_campana');

    var inputBusqueda = document.getElementById('cedula');
    if (inputBusqueda) inputBusqueda.value = '';

    currentOffset = 0;
    todosDatos = [];
    cargarLoteInicial();
}

// ============================================================================
// BORRAR TODAS LAS SOLICITUDES
// ============================================================================
function borrarTodas() {
    if (!confirm('⚠️ ¿Estás SEGURO de que quieres eliminar TODAS las solicitudes?\nEsta acción NO se puede deshacer.')) {
        return;
    }
    if (!confirm('🔴 CONFIRMACIÓN FINAL:\n¿Eliminar permanentemente todos los registros?')) {
        return;
    }

    var btn = document.querySelector('.accion-btn.peligro');
    if (btn) { btn.textContent = '⏳ Eliminando...'; btn.disabled = true; }

    fetch('/api/excel/limpiar', {
        method: 'DELETE',
        credentials: 'include'
    })
    .then(function(res) { return res.json(); })
    .then(function(resultado) {
        if (resultado && !resultado.error) {
            alert('✅ ' + (resultado.mensaje || 'Solicitudes eliminadas'));
            currentOffset = 0;
            todosDatos = [];
            filasSeleccionadas = [];
            hasMoreData = false;
            document.getElementById('totalRegistros').textContent = '0';
            document.getElementById('mostrando').textContent = '0';
            renderizarVistaActual([]);
        } else {
            alert('Error: ' + (resultado.error || 'Error desconocido'));
        }
    })
    .catch(function(err) {
        console.error('Error borrando solicitudes:', err);
        alert('Error al eliminar: ' + err.message);
    })
    .finally(function() {
        if (btn) { btn.textContent = '🗑️ Borrar'; btn.disabled = false; }
    });
}

// ============================================================================
// NUEVA SOLICITUD MANUAL - Versión Desktop
// ============================================================================

let estadosDisponibles = [];
let segmentosDisponibles = [];

function abrirModalNuevaSolicitud() {
    // Cargar estados y segmentos desde el catálogo inteligente
    Promise.all([
        fetch('/api/catalogos/estados', { credentials: 'include' }).then(function(r) { return r.ok ? r.json() : []; }),
        fetch('/api/catalogos/segmentos', { credentials: 'include' }).then(function(r) { return r.ok ? r.json() : []; })
    ]).then(function(resultados) {
        var estadosData = resultados[0] || [];
        var segmentosData = resultados[1] || [];

        estadosDisponibles = Array.isArray(estadosData) ? estadosData : estadosData.map(function(e) { return e.estado || e; });
        segmentosDisponibles = Array.isArray(segmentosData) ? segmentosData : segmentosData.map(function(s) { return s.segmento || s; });

        if (estadosDisponibles.indexOf('SIN ESTADO') === -1) estadosDisponibles.unshift('SIN ESTADO');

        var estadosOptions = '';
        for (var i = 0; i < estadosDisponibles.length; i++) {
            estadosOptions += '<option value="' + estadosDisponibles[i] + '">' + estadosDisponibles[i] + '</option>';
        }

        var segmentosOptions = '<option value="">Sin segmento</option>';
        for (var i = 0; i < segmentosDisponibles.length; i++) {
            segmentosOptions += '<option value="' + segmentosDisponibles[i] + '">' + segmentosDisponibles[i] + '</option>';
        }

        var contenido = '';
        contenido += '<div class="nueva-solicitud-overlay" id="ns-desktop-overlay">';
        contenido += '  <div class="nueva-solicitud-modal">';
        contenido += '    <div class="ns-header">';
        contenido += '      <h2>➕ Nueva Solicitud</h2>';
        contenido += '      <button class="ns-close-btn" onclick="cerrarModalNuevaSolicitudDesktop()" aria-label="Cerrar">✕</button>';
        contenido += '    </div>';
        contenido += '    <div class="ns-body">';

        // Advertencia de duplicado
        contenido += '      <div class="ns-duplicado-warning" id="ns-desktop-duplicado-warning">⚠️ <span id="ns-desktop-duplicado-msg"></span></div>';

        // Sección Principal
        contenido += '      <div class="ns-section ns-section-primary">';
        contenido += '        <div class="ns-section-title">📋 Información Principal</div>';
        contenido += '        <div class="ns-grid-2">';
        contenido += '          <div class="ns-field">';
        contenido += '            <label>🆔 Cédula <span class="required">*</span></label>';
        contenido += '            <input type="text" id="ns-desktop-cedula" placeholder="10 dígitos" maxlength="10" inputmode="numeric">';
        contenido += '          </div>';
        contenido += '          <div class="ns-field">';
        contenido += '            <label>📝 Nombre <span class="required">*</span></label>';
        contenido += '            <input type="text" id="ns-desktop-nombre" placeholder="Nombre completo">';
        contenido += '          </div>';
        contenido += '          <div class="ns-field">';
        contenido += '            <label>📞 Teléfono <span class="required">*</span></label>';
        contenido += '            <input type="tel" id="ns-desktop-celular" placeholder="0991234567" maxlength="10" inputmode="numeric">';
        contenido += '          </div>';
        contenido += '          <div class="ns-field">';
        contenido += '            <label>🏷️ Segmento</label>';
        contenido += '            <select id="ns-desktop-segmento">' + segmentosOptions + '</select>';
        contenido += '          </div>';
        contenido += '          <div class="ns-field">';
        contenido += '            <label>📌 Estado <span class="required">*</span></label>';
        contenido += '            <select id="ns-desktop-estado">' + estadosOptions + '</select>';
        contenido += '          </div>';
        contenido += '        </div>';
        contenido += '        <div class="ns-field ns-field-full">';
        contenido += '          <label>📝 Observaciones <span class="optional-badge">Opcional</span></label>';
        contenido += '          <textarea id="ns-desktop-observaciones" rows="3" placeholder="Escriba aquí cualquier observación o nota adicional..."></textarea>';
        contenido += '        </div>';
        contenido += '      </div>';

        // Sección Adicional
        contenido += '      <div class="ns-section ns-section-secondary">';
        contenido += '        <div class="ns-section-title">📦 Más Información <span class="optional-badge">Opcional</span></div>';
        contenido += '        <div class="ns-grid-2">';
        contenido += '          <div class="ns-field">';
        contenido += '            <label>📦 Producto</label>';
        contenido += '            <input type="text" id="ns-desktop-producto" placeholder="Ej: Crédito">';
        contenido += '          </div>';
        contenido += '          <div class="ns-field">';
        contenido += '            <label>🔢 Código Plus</label>';
        contenido += '            <input type="text" id="ns-desktop-codigo-plus" placeholder="Código interno">';
        contenido += '          </div>';
        contenido += '          <div class="ns-field">';
        contenido += '            <label>📧 Correo Electrónico</label>';
        contenido += '            <input type="email" id="ns-desktop-correo" placeholder="cliente@ejemplo.com">';
        contenido += '          </div>';
        contenido += '          <div class="ns-field">';
        contenido += '            <label>📍 Dirección</label>';
        contenido += '            <input type="text" id="ns-desktop-direccion" placeholder="Dirección domiciliaria">';
        contenido += '          </div>';
        contenido += '          <div class="ns-field">';
        contenido += '            <label>💼 Ocupación</label>';
        contenido += '            <input type="text" id="ns-desktop-ocupacion" placeholder="Ej: Comerciante">';
        contenido += '          </div>';
        contenido += '          <div class="ns-field">';
        contenido += '            <label>💰 Ingreso Mensual</label>';
        contenido += '            <input type="number" id="ns-desktop-ingreso" placeholder="0.00" step="0.01" min="0">';
        contenido += '          </div>';
        contenido += '          <div class="ns-field" id="ns-desktop-vendedor-field" style="display:none;">';
        contenido += '            <label>👤 Vendedor</label>';
        contenido += '            <input type="text" id="ns-desktop-vendedor" placeholder="Nombre del vendedor">';
        contenido += '          </div>';
        contenido += '        </div>';
        contenido += '      </div>';

        contenido += '    </div>';
        contenido += '    <div class="ns-footer">';
        contenido += '      <button class="ns-btn-cancel" onclick="cerrarModalNuevaSolicitudDesktop()">Cancelar</button>';
        contenido += '      <button class="ns-btn-submit" id="ns-desktop-submit-btn" onclick="guardarNuevaSolicitudDesktop()">💾 Guardar</button>';
        contenido += '    </div>';
        contenido += '  </div>';
        contenido += '</div>';

        // Insertar en el body
        var overlayExistente = document.getElementById('ns-desktop-overlay');
        if (overlayExistente) overlayExistente.remove();
        document.body.insertAdjacentHTML('beforeend', contenido);

        setTimeout(function() {
            var input = document.getElementById('ns-desktop-nombre');
            if (input) input.focus();
            fetch('/api/auth/sesion').then(function(r){ return r.json(); }).then(function(sesion) {
                if (sesion.autenticado) {
                    var rol = sesion.usuario.rol;
                    var esLider = (rol === 'lider' || rol === 'admin' || rol === 'superadmin');
                    var vf = document.getElementById('ns-desktop-vendedor-field');
                    if (vf) vf.style.display = esLider ? 'block' : 'none';
                }
            }).catch(function(){});
        }, 300);
    }).catch(function(err) {
        console.error('Error cargando datos para nueva solicitud:', err);
        alert('Error al preparar el formulario. Intenta de nuevo.');
    });
}

function cerrarModalNuevaSolicitudDesktop() {
    var overlay = document.getElementById('ns-desktop-overlay');
    if (overlay) overlay.remove();
}

async function guardarNuevaSolicitudDesktop() {
    var nombre = document.getElementById('ns-desktop-nombre').value.trim();
    var cedula = document.getElementById('ns-desktop-cedula').value.trim();
    var celular = document.getElementById('ns-desktop-celular').value.trim();

    if (!nombre) { alert('El nombre es obligatorio'); document.getElementById('ns-desktop-nombre').focus(); return; }
    if (!cedula || cedula.length !== 10) { alert('La cédula debe tener 10 dígitos'); document.getElementById('ns-desktop-cedula').focus(); return; }
    if (!celular || celular.length !== 10) { alert('El celular debe tener 10 dígitos'); document.getElementById('ns-desktop-celular').focus(); return; }

    var btn = document.getElementById('ns-desktop-submit-btn');
    if (btn) { btn.disabled = true; btn.textContent = '⏳ Guardando...'; }

    try {
        var body = {
            nombre: nombre,
            cedula: cedula,
            celular: celular,
            estado: document.getElementById('ns-desktop-estado').value,
            correo_electronico: document.getElementById('ns-desktop-correo').value.trim() || undefined,
            segmento: document.getElementById('ns-desktop-segmento').value || undefined,
            producto: document.getElementById('ns-desktop-producto').value.trim() || undefined,
            codigo_plus: document.getElementById('ns-desktop-codigo-plus').value.trim() || undefined,
            direccion: document.getElementById('ns-desktop-direccion').value.trim() || undefined,
            ocupacion: document.getElementById('ns-desktop-ocupacion').value.trim() || undefined,
            ingreso_mensual: document.getElementById('ns-desktop-ingreso').value ? parseFloat(document.getElementById('ns-desktop-ingreso').value) : undefined,
            observaciones: document.getElementById('ns-desktop-observaciones').value.trim() || undefined
        };

        var vendedorField = document.getElementById('ns-desktop-vendedor');
        if (vendedorField) {
            var vendedorVal = vendedorField.value.trim();
            if (vendedorVal) body.vendedor = vendedorVal;
        }

        var response = await fetch('/api/excel/solicitudes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(body)
        });

        var resultado = await response.json();

        if (response.ok) {
            var msg = '✅ Solicitud #' + resultado.id_solicitud + ' creada';
            if (resultado.duplicado_advertencia) msg += '\n⚠️ Ya existe otra con la misma cédula';
            alert(msg);
            cerrarModalNuevaSolicitudDesktop();
            init();
        } else {
            alert('❌ Error: ' + (resultado.error || 'Error desconocido'));
        }
    } catch (error) {
        console.error('Error creando solicitud:', error);
        alert('❌ Error al guardar: ' + error.message);
    } finally {
        if (btn) { btn.disabled = false; btn.textContent = '💾 Guardar'; }
    }
}

// ============================================================================
// FUNCIONES DE ACCIÓN EN CARDS (Desktop)
// ============================================================================

function abrirGestionesCard(id) {
    var datos = datosFilas[id];
    if (!datos) {
        alert('No se encontraron datos para esta solicitud');
        return;
    }

    // Usar el modal existente de gestión
    var opcionesDropdown = '';
    ['Seguimiento', 'Cobranza', 'Llamada', 'WhatsApp', 'Reclamo', 'Cita', 'Otro'].forEach(function(tipo) {
        opcionesDropdown += '<option value="' + tipo + '">' + tipo + '</option>';
    });

    var contenido = '';
    contenido += '<div style="padding: 24px; max-width: 800px; margin: 0 auto;">';
    contenido += '<h2 style="margin-top: 0; color: #1f2937;">📋 Gestiones - Solicitud #' + id + '</h2>';
    contenido += '<div style="background: #f3f4f6; padding: 12px; border-radius: 8px; margin-bottom: 15px;">';
    contenido += '<p><strong>Nombre:</strong> ' + (datos.nombre || 'N/A') + ' | <strong>Cédula:</strong> ' + (datos.cedula || 'N/A') + '</p>';
    contenido += '<p><strong>Celular:</strong> ' + (datos.celular || 'N/A') + ' | <strong>Estado:</strong> ' + (datos.estado || 'N/A') + '</p>';
    contenido += '</div>';

    // Nueva gestión
    contenido += '<div style="border: 2px solid #2563eb; border-radius: 8px; padding: 15px; margin-bottom: 15px; background: #eff6ff;">';
    contenido += '<h3 style="margin-top: 0;">➕ Nueva Gestión</h3>';
    contenido += '<label style="display:block; font-weight:600; margin-bottom:4px; font-size:13px;">📋 Tipo:</label>';
    contenido += '<select id="tipo-gestion-desktop" style="width:100%; padding:10px; border:1px solid #ddd; border-radius:6px; font-size:14px; margin-bottom:12px;">' + opcionesDropdown + '</select>';
    contenido += '<label style="display:block; font-weight:600; margin-bottom:4px; font-size:13px;">📝 Observación:</label>';
    contenido += '<textarea id="observacion-gestion-desktop" rows="3" style="width:100%; padding:10px; border:1px solid #ddd; border-radius:6px; font-size:14px; margin-bottom:12px; box-sizing:border-box;"></textarea>';
    contenido += '<button onclick="guardarGestionDesktop(\'' + id + '\')" style="padding:12px 24px; background:#2563eb; color:white; border:none; border-radius:8px; font-weight:600; cursor:pointer;">💾 Guardar Gestión</button>';
    contenido += '</div>';

    // Historial
    contenido += '<div id="historial-gestiones-desktop" style="margin-top:15px;">';
    contenido += '<h3 style="color:#1f2937;">📜 Historial</h3>';
    contenido += '<div id="lista-historial-desktop" style="text-align:center; padding:20px; color:#6b7280;">Cargando...</div>';
    contenido += '</div>';

    contenido += '<div style="margin-top:20px;"><button onclick="cerrarModal()" style="padding:12px 24px; background:#f3f4f6; border:none; border-radius:8px; cursor:pointer;">✕ Cerrar</button></div>';
    contenido += '</div>';

    crearModal(contenido);
    cargarHistorialGestionesDesktop(id);
}

async function cargarHistorialGestionesDesktop(id) {
    var container = document.getElementById('lista-historial-desktop');
    if (!container) return;

    try {
        var response = await fetch('/api/excel/gestiones/' + id);
        if (!response.ok) { container.innerHTML = '<div style="color:red;">Error al cargar historial</div>'; return; }
        var gestiones = await response.json();

        if (!gestiones || gestiones.length === 0) {
            container.innerHTML = '<div style="padding:15px; text-align:center; color:#6b7280;">No hay gestiones registradas</div>';
            return;
        }

        var html = '';
        var coloresTipo = {
            'Seguimiento': '#dbeafe', 'Cobranza': '#fee2e2', 'Llamada': '#d1fae5',
            'WhatsApp': '#dcfce7', 'Reclamo': '#fef3c7', 'Cita': '#e0e7ff', 'Otro': '#f3f4f6'
        };

        for (var i = 0; i < gestiones.length; i++) {
            var g = gestiones[i];
            var color = coloresTipo[g.tipo_gestion] || '#f3f4f6';
            var fecha = g.fecha_gestion ? new Date(g.fecha_gestion).toLocaleString('es-ES') : '';

            html += '<div style="background:' + color + '; padding:12px; border-radius:8px; margin-bottom:10px;">';
            html += '<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">';
            html += '<span style="font-weight:600; font-size:13px;">📋 ' + (g.tipo_gestion || '') + '</span>';
            html += '<span style="font-size:11px; color:#6b7280;">' + fecha + '</span>';
            html += '</div>';
            if (g.resultado && g.tipo_gestion === 'Llamada') {
                var resLabels = {
                    'no_contesta': '📵 No contestó', 'numero_invalido': '📛 Número incorrecto',
                    'no_interesado': '🙅 No interesado', 'interesado': '👍 Interesado',
                    'derivado': '🤝 Derivado a vendedor', 'venta': '💰 Venta',
                    'descalificado': '🚫 Descalificado', 'seguimiento': '🔄 Seguimiento', 'otro': '📝 Otro'
                };
                var resLabel = resLabels[g.resultado] || g.resultado;
                var resColores = {
                    'no_contesta': '#e5e7eb', 'numero_invalido': '#fef3c7', 'no_interesado': '#fee2e2',
                    'interesado': '#d1fae5', 'derivado': '#dbeafe', 'venta': '#bbf7d0',
                    'descalificado': '#f3e8ff', 'seguimiento': '#dbeafe', 'otro': '#f9fafb'
                };
                var resBg = resColores[g.resultado] || '#f3f4f6';
                html += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">';
                html += '<span style="background:' + resBg + ';padding:2px 10px;border-radius:12px;font-size:11px;font-weight:600;color:#374151;">📞 ' + resLabel + '</span>';
                if (g.duracion_seg != null) {
                    var durM = Math.floor(g.duracion_seg / 60);
                    var durS = g.duracion_seg % 60;
                    html += '<span style="font-size:11px;color:#9ca3af;">⏱️ ' + (durM < 10 ? '0' : '') + durM + ':' + (durS < 10 ? '0' : '') + durS + '</span>';
                }
                html += '</div>';
            }
            if (g.observacion) html += '<div style="font-size:13px; color:#374151;">' + g.observacion + '</div>';
            html += '</div>';
        }

        container.innerHTML = html;
    } catch (error) {
        console.error('Error cargando historial:', error);
        container.innerHTML = '<div style="color:red;">Error al cargar historial</div>';
    }
}

function guardarGestionDesktop(id) {
    var tipo = document.getElementById('tipo-gestion-desktop');
    var observacion = document.getElementById('observacion-gestion-desktop');
    if (!tipo || !observacion) { alert('Error en el formulario'); return; }

    var btn = document.querySelector('button[onclick="guardarGestionDesktop(\'' + id + '\')"]');
    if (btn) { btn.textContent = '⏳ Guardando...'; btn.disabled = true; }

    var body = {
        solicitud_id: id,
        tipo_gestion: tipo.value,
        observacion: observacion.value.trim()
    };

    fetch('/api/excel/gestiones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    })
    .then(function(res) { return res.json(); })
    .then(function(resultado) {
        if (resultado && !resultado.error) {
            document.getElementById('observacion-gestion-desktop').value = '';
            cargarHistorialGestionesDesktop(id);
            alert('Gestión guardada');
        } else {
            alert('Error: ' + (resultado.error || 'Error desconocido'));
        }
    })
    .catch(function(err) {
        console.error('Error:', err);
        alert('Error al guardar');
    })
    .finally(function() {
        if (btn) { btn.textContent = '💾 Guardar Gestión'; btn.disabled = false; }
    });
}

// ============================================================================
// WHATSAPP DESKTOP
// ============================================================================
function whatsAppClienteDesktop(celular, nombre) {
    if (!celular) { alert('No hay número de celular'); return; }
    var numeroLimpio = celular.replace(/\D/g, '');
    if (!numeroLimpio.startsWith('593') && numeroLimpio.length <= 10) {
        numeroLimpio = '593' + numeroLimpio;
    }
    window.open('https://wa.me/' + numeroLimpio, '_blank');
}

// ============================================================================
// COMPLETAR INFO DESKTOP
// ============================================================================
function abrirCompletarInfoCard(id) {
    var datos = datosFilas[id];
    if (!datos) { alert('No se encontraron datos'); return; }

    // Cargar datos completos
    fetch('/api/excel/solicitudes/' + id + '/completa', { credentials: 'include' })
    .then(function(res) { return res.ok ? res.json() : null; })
    .then(function(data) {
        var codigoPlus = (data && data.codigo_plus) || datos.codigo_plus || '';
        var correo = (data && data.correo_electronico) || datos.correo_electronico || '';
        var direccion = (data && data.direccion) || datos.direccion || '';
        var direccionTrabajo = (data && data.direccion_trabajo) || datos.direccion_trabajo || '';
        var ocupacion = (data && data.ocupacion) || datos.ocupacion || '';
        var ingreso = (data && data.ingreso_mensual) || datos.ingreso_mensual || '';
        var observaciones = (data && data.observaciones) || datos.observaciones || '';
        var referencias = (data && data.referencias) || [];

        while (referencias.length < 3) {
            referencias.push({ nombre: '', telefono: '', relacion: '' });
        }

        // Generar HTML de referencias
        var opcionesRelacion = ['Amigo', 'Familiar', 'Vecino', 'Compañero', 'Otro'];
        var htmlRef = '';
        for (var i = 0; i < 3; i++) {
            var r = referencias[i] || {};
            var num = i + 1;
            var selectOpciones = '<option value="">Seleccionar...</option>';
            for (var j = 0; j < opcionesRelacion.length; j++) {
                var sel = opcionesRelacion[j] === r.relacion ? 'selected' : '';
                selectOpciones += '<option value="' + opcionesRelacion[j] + '" ' + sel + '>' + opcionesRelacion[j] + '</option>';
            }
            htmlRef += '<div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:12px;margin-bottom:12px;">';
            htmlRef += '  <div style="font-size:12px;font-weight:600;color:#374151;margin-bottom:8px;">👤 Referencia #' + num + '</div>';
            htmlRef += '  <label style="display:block;font-size:12px;font-weight:600;margin-bottom:4px;color:#4b5563;">Nombres y Apellidos:</label>';
            htmlRef += '  <input type="text" id="ref-desktop-' + num + '-nombre" value="' + escaparParaAtributoDesktop(r.nombre) + '" style="width:100%;padding:10px;border:1px solid #ddd;border-radius:6px;font-size:14px;margin-bottom:8px;box-sizing:border-box;" placeholder="Nombre completo">';
            htmlRef += '  <label style="display:block;font-size:12px;font-weight:600;margin-bottom:4px;color:#4b5563;">📞 Teléfono:</label>';
            htmlRef += '  <input type="tel" id="ref-desktop-' + num + '-telefono" value="' + escaparParaAtributoDesktop(r.telefono) + '" style="width:100%;padding:10px;border:1px solid #ddd;border-radius:6px;font-size:14px;margin-bottom:8px;box-sizing:border-box;" placeholder="Número de teléfono">';
            htmlRef += '  <label style="display:block;font-size:12px;font-weight:600;margin-bottom:4px;color:#4b5563;">🤝 Relación:</label>';
            htmlRef += '  <select id="ref-desktop-' + num + '-relacion" style="width:100%;padding:10px;border:1px solid #ddd;border-radius:6px;font-size:14px;background:white;box-sizing:border-box;">' + selectOpciones + '</select>';
            htmlRef += '</div>';
        }

        var contenido = '';
        contenido += '<div style="padding:24px;max-width:660px;margin:0 auto;">';
        contenido += '  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">';
        contenido += '    <h2 style="margin:0;color:#1f2937;font-size:20px;">✏️ Completar Información</h2>';
        contenido += '    <button onclick="cerrarModal()" style="width:32px;height:32px;border:none;background:#f3f4f6;border-radius:8px;cursor:pointer;font-size:15px;color:#374151;" aria-label="Cerrar">✕</button>';
        contenido += '  </div>';

        // Datos del cliente (solo lectura)
        contenido += '<div style="background:#f3f4f6;padding:12px;border-radius:8px;margin-bottom:15px;font-size:13px;">';
        contenido += '  <p style="margin:0 0 4px 0;"><strong>👤 Cliente:</strong> ' + (datos.nombre || 'N/A') + '</p>';
        contenido += '  <p style="margin:0 0 4px 0;"><strong>🆔 Cédula:</strong> ' + (datos.cedula || 'N/A') + '</p>';
        contenido += '  <p style="margin:0;"><strong>📱 Celular:</strong> ' + (datos.celular || 'N/A') + '</p>';
        contenido += '</div>';

        // Información Adicional
        contenido += '<div style="border:2px solid #818cf8;border-radius:8px;padding:15px;margin-bottom:15px;background:#eef2ff;">';
        contenido += '  <h3 style="margin:0 0 12px 0;color:#4338ca;font-size:15px;">📋 Información Adicional</h3>';
        contenido += '  <label style="display:block;font-weight:600;margin-bottom:4px;font-size:12px;color:#374151;">📦 Código Plus:</label>';
        contenido += '  <input type="text" id="codigo-plus-completar-desktop" value="' + escaparParaAtributoDesktop(codigoPlus) + '" style="width:100%;padding:10px;border:1px solid #ddd;border-radius:6px;font-size:14px;margin-bottom:10px;box-sizing:border-box;" placeholder="Código Plus">';
        contenido += '  <label style="display:block;font-weight:600;margin-bottom:4px;font-size:12px;color:#374151;">📍 Dirección:</label>';
        contenido += '  <input type="text" id="direccion-completar-desktop" value="' + escaparParaAtributoDesktop(direccion) + '" style="width:100%;padding:10px;border:1px solid #ddd;border-radius:6px;font-size:14px;margin-bottom:10px;box-sizing:border-box;" placeholder="Dirección de domicilio">';
        contenido += '  <label style="display:block;font-weight:600;margin-bottom:4px;font-size:12px;color:#374151;">🏢 Dirección de Trabajo:</label>';
        contenido += '  <input type="text" id="direccion-trabajo-completar-desktop" value="' + escaparParaAtributoDesktop(direccionTrabajo) + '" style="width:100%;padding:10px;border:1px solid #ddd;border-radius:6px;font-size:14px;margin-bottom:10px;box-sizing:border-box;" placeholder="Dirección de trabajo">';
        contenido += '  <label style="display:block;font-weight:600;margin-bottom:4px;font-size:12px;color:#374151;">💼 Ocupación:</label>';
        contenido += '  <input type="text" id="ocupacion-completar-desktop" value="' + escaparParaAtributoDesktop(ocupacion) + '" style="width:100%;padding:10px;border:1px solid #ddd;border-radius:6px;font-size:14px;margin-bottom:10px;box-sizing:border-box;" placeholder="Ocupación">';
        contenido += '  <label style="display:block;font-weight:600;margin-bottom:4px;font-size:12px;color:#374151;">📧 Correo Electrónico:</label>';
        contenido += '  <input type="email" id="correo-completar-desktop" value="' + escaparParaAtributoDesktop(correo) + '" style="width:100%;padding:10px;border:1px solid #ddd;border-radius:6px;font-size:14px;margin-bottom:10px;box-sizing:border-box;" placeholder="cliente@ejemplo.com">';
        contenido += '  <label style="display:block;font-weight:600;margin-bottom:4px;font-size:12px;color:#374151;">💰 Ingreso Mensual:</label>';
        contenido += '  <input type="number" step="0.01" min="0" id="ingreso-mensual-completar-desktop" value="' + (ingreso || '') + '" style="width:100%;padding:10px;border:1px solid #ddd;border-radius:6px;font-size:14px;margin-bottom:10px;box-sizing:border-box;" placeholder="0.00">';
        contenido += '  <label style="display:block;font-weight:600;margin-bottom:4px;font-size:12px;color:#374151;">📝 Observaciones:</label>';
        contenido += '  <textarea id="observaciones-completar-desktop" rows="3" style="width:100%;padding:10px;border:1px solid #ddd;border-radius:6px;font-size:14px;margin-bottom:0;box-sizing:border-box;resize:vertical;" placeholder="Escriba aquí cualquier observación o nota adicional...">' + escaparParaAtributoDesktop(observaciones) + '</textarea>';
        contenido += '</div>';

        // Referencias
        contenido += '<div style="border:2px solid #22c55e;border-radius:8px;padding:15px;margin-bottom:15px;background:#f0fdf4;">';
        contenido += '  <h3 style="margin:0 0 12px 0;color:#166534;font-size:15px;">👥 Referencias Personales</h3>';
        contenido += htmlRef;
        contenido += '</div>';

        // Botones
        contenido += '<div style="display:flex;gap:10px;justify-content:flex-end;">';
        contenido += '  <button onclick="cerrarModal()" class="btn-modal-cancelar">Cancelar</button>';
        contenido += '  <button onclick="guardarCompletarInfoDesktop(\'' + id + '\')" class="btn-modal-crear">💾 Guardar Información</button>';
        contenido += '</div>';
        contenido += '</div>';

        crearModal(contenido);
    })
    .catch(function(err) {
        console.error('Error cargando datos completos:', err);
        alert('Error al cargar datos');
    });
}

function guardarCompletarInfoDesktop(id) {
    var codigo_plus = document.getElementById('codigo-plus-completar-desktop').value.trim();
    var correo_electronico = document.getElementById('correo-completar-desktop').value.trim();
    var direccion = document.getElementById('direccion-completar-desktop').value.trim();
    var direccion_trabajo = document.getElementById('direccion-trabajo-completar-desktop').value.trim();
    var ocupacion = document.getElementById('ocupacion-completar-desktop').value.trim();
    var ingresoInput = document.getElementById('ingreso-mensual-completar-desktop').value.trim();
    var ingreso_mensual = ingresoInput ? (parseFloat(ingresoInput) || null) : null;
    var observaciones = document.getElementById('observaciones-completar-desktop').value.trim();

    var referencias = [];
    for (var i = 1; i <= 3; i++) {
        referencias.push({
            nombre: document.getElementById('ref-desktop-' + i + '-nombre').value.trim(),
            telefono: document.getElementById('ref-desktop-' + i + '-telefono').value.trim(),
            relacion: document.getElementById('ref-desktop-' + i + '-relacion').value
        });
    }

    var btn = document.querySelector('button[onclick="guardarCompletarInfoDesktop(\'' + id + '\')"]');
    if (btn) { btn.textContent = '⏳ Guardando...'; btn.disabled = true; }

    fetch('/api/excel/solicitudes/' + id + '/completar-info', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            codigo_plus: codigo_plus,
            correo_electronico: correo_electronico,
            direccion: direccion,
            direccion_trabajo: direccion_trabajo,
            ocupacion: ocupacion,
            ingreso_mensual: ingreso_mensual,
            observaciones: observaciones,
            referencias: referencias
        })
    })
    .then(function(res) { return res.json(); })
    .then(function(resultado) {
        if (!resultado.error) {
            alert('Información guardada correctamente');
            cerrarModal();
            init();
        } else {
            alert('Error: ' + resultado.error);
        }
    })
    .catch(function(err) {
        console.error('Error:', err);
        alert('Error al guardar');
    })
    .finally(function() {
        if (btn) { btn.textContent = '💾 Guardar Información'; btn.disabled = false; }
    });
}

// ============================================================================
// MENÚ CONTEXTUAL DESKTOP (⋮)
// ============================================================================
function toggleCardMenuDesktop(event, id) {
    event.stopPropagation();
    cerrarTodosLosMenusDesktop(id);
    var menu = document.getElementById('card-menu-desktop-' + id);
    if (menu) menu.classList.toggle('visible');
}

function cerrarTodosLosMenusDesktop(excludeId) {
    document.querySelectorAll('.card-dropdown-menu').forEach(function(m) {
        if (excludeId && m.id === 'card-menu-desktop-' + excludeId) return;
        m.classList.remove('visible');
    });
}

// Click fuera del menú para cerrarlo
if (!window._cardMenuDesktopListenerAttached) {
    window._cardMenuDesktopListenerAttached = true;
    document.addEventListener('click', function(e) {
        if (!e.target.closest('.card-actions-more')) {
            cerrarTodosLosMenusDesktop();
        }
    });
}

// ============================================================================
// EDITAR SOLICITUD DESKTOP
// ============================================================================
async function abrirEditarSolicitudDesktop(id) {
    var datos = datosFilas[id];
    if (!datos) {
        try {
            var res = await fetch('/api/excel/solicitudes/' + id, { credentials: 'include' });
            if (!res.ok) { alert('No se encontraron datos'); return; }
            datos = await res.json();
            datosFilas[id] = datos;
        } catch (e) {
            console.error('Error:', e);
            alert('No se encontraron datos');
            return;
        }
    }

    // Cargar estados y segmentos
    try {
        var resEstados = await fetch('/api/excel/dashboard/estados', { credentials: 'include' });
        var resSegmentos = await fetch('/api/excel/dashboard/segmentos', { credentials: 'include' });

        var estadosData = resEstados.ok ? await resEstados.json() : [];
        var segmentosData = resSegmentos.ok ? await resSegmentos.json() : [];

        var estadosOptions = '<option value="">Seleccionar...</option>';
        for (var e = 0; e < estadosData.length; e++) {
            var selected = (estadosData[e].estado || estadosData[e]) === datos.estado ? 'selected' : '';
            estadosOptions += '<option value="' + (estadosData[e].estado || estadosData[e]) + '" ' + selected + '>' + (estadosData[e].estado || estadosData[e]) + '</option>';
        }

        var segmentosOptions = '<option value="">Seleccionar...</option>';
        for (var s = 0; s < segmentosData.length; s++) {
            var selected = (segmentosData[s].segmento || segmentosData[s]) === datos.segmento ? 'selected' : '';
            segmentosOptions += '<option value="' + (segmentosData[s].segmento || segmentosData[s]) + '" ' + selected + '>' + (segmentosData[s].segmento || segmentosData[s]) + '</option>';
        }

        var contenido = '';
        contenido += '<div id="editar-solicitud-modal-overlay">';
        contenido += '  <div class="editar-solicitud-modal">';
        contenido += '    <div class="editar-header">';
        contenido += '      <h2>✏️ Editar Solicitud #' + id + '</h2>';
        contenido += '      <button class="editar-close-btn" onclick="cerrarEditarSolicitudDesktop()">✕</button>';
        contenido += '    </div>';
        contenido += '    <div class="editar-body">';
        contenido += '      <div class="editar-info-cliente">';
        contenido += '        <div class="editar-info-item"><span class="info-label">Nombre</span><span class="info-value">' + (datos.nombre || '—') + '</span></div>';
        contenido += '        <div class="editar-info-item"><span class="info-label">Cédula</span><span class="info-value">' + (datos.cedula || '—') + '</span></div>';
        contenido += '        <div class="editar-info-item"><span class="info-label">Celular</span><span class="info-value">' + (datos.celular || '—') + '</span></div>';
        contenido += '      </div>';
        contenido += '      <div class="editar-campos">';
        contenido += '        <div class="editar-campo"><label>📌 Estado</label><select class="editar-select" id="editar-estado-desktop">' + estadosOptions + '</select></div>';
        contenido += '        <div class="editar-campo"><label>🏷️ Segmento</label><select class="editar-select" id="editar-segmento-desktop">' + segmentosOptions + '</select></div>';
        contenido += '      </div>';
        contenido += '    </div>';
        contenido += '    <div class="editar-footer">';
        contenido += '      <button class="editar-btn-cancel" onclick="cerrarEditarSolicitudDesktop()">Cancelar</button>';
        contenido += '      <button class="editar-btn-save" onclick="guardarEditarSolicitudDesktop(\'' + id + '\')">💾 Guardar Cambios</button>';
        contenido += '    </div>';
        contenido += '  </div>';
        contenido += '</div>';

        var overlayExistente = document.getElementById('editar-solicitud-modal-overlay');
        if (overlayExistente) overlayExistente.remove();
        document.body.insertAdjacentHTML('beforeend', contenido);
    } catch (err) {
        console.error('Error:', err);
        alert('Error al preparar edición');
    }
}

function cerrarEditarSolicitudDesktop() {
    var overlay = document.getElementById('editar-solicitud-modal-overlay');
    if (overlay) overlay.remove();
}

async function guardarEditarSolicitudDesktop(id) {
    var estado = document.getElementById('editar-estado-desktop').value;
    var segmento = document.getElementById('editar-segmento-desktop').value;

    if (!estado && !segmento) { alert('No hay cambios para guardar'); return; }

    var btn = document.querySelector('.editar-btn-save');
    if (btn) { btn.textContent = '⏳ Guardando...'; btn.disabled = true; }

    try {
        var response = await fetch('/api/excel/solicitudes/' + id + '/editar', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ estado: estado, segmento: segmento })
        });
        var resultado = await response.json();

        if (response.ok) {
            alert(resultado.mensaje || 'Solicitud actualizada');
            cerrarEditarSolicitudDesktop();
            init();
        } else {
            alert('Error: ' + (resultado.error || 'Error desconocido'));
        }
    } catch (err) {
        console.error('Error:', err);
        alert('Error al guardar');
    } finally {
        if (btn) { btn.textContent = '💾 Guardar Cambios'; btn.disabled = false; }
    }
}

// ============================================================================
// ELIMINAR SOLICITUD DESKTOP
// ============================================================================
function confirmarEliminarSolicitudDesktop(id) {
    if (!confirm('¿Estás seguro de eliminar la solicitud #' + id + '?')) return;

    fetch('/api/excel/solicitudes/' + id, { method: 'DELETE', credentials: 'include' })
    .then(function(res) { return res.json(); })
    .then(function(resultado) {
        if (!resultado.error) {
            alert('Solicitud eliminada');
            // Remover de la lista
            todosDatos = todosDatos.filter(function(d) { return d.id_solicitud != id; });
            filasSeleccionadas = filasSeleccionadas.filter(function(f) { return f != id; });
            delete datosFilas[id];
            renderizarVistaActual(todosDatos);
            document.getElementById('totalRegistros').textContent = todosDatos.length;
            document.getElementById('mostrando').textContent = todosDatos.length;
            cargarTotales();
        } else {
            alert('Error: ' + resultado.error);
        }
    })
    .catch(function(err) {
        console.error('Error:', err);
        alert('Error al eliminar');
    });
}

// ============================================================================
// PANEL LATERAL DE DETALLE DESKTOP (DRAWER)
// ============================================================================
var _panelSolicitudId = null;

function inicialesNombre(nombre) {
    var partes = String(nombre || '').trim().split(/\s+/).filter(Boolean);
    var ini = '';
    if (partes.length >= 2) {
        ini = (partes[0][0] || '') + (partes[partes.length - 1][0] || '');
    } else if (partes.length === 1) {
        ini = partes[0].substring(0, 2);
    }
    return (ini || '?').toUpperCase();
}

function panelEscapeHtml(texto) {
    return String(texto == null ? '' : texto).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function estadoPanelColor(estado) {
    var colores = {
        'ACTIVADA': '#dcfce7',
        'RECHAZADA': '#fee2e2',
        'DEVUELTA': '#fef3c7',
        'APROBADA PARA LIBERACIÓN': '#d1fae5'
    };
    return colores[estado] || '#f3f4f6';
}

function formatIngreso(valor) {
    if (valor === null || valor === undefined || valor === '') return '—';
    var num = parseFloat(valor);
    if (isNaN(num)) return String(valor);
    return num.toLocaleString('es-EC', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function panelCampo(label, valor) {
    return '<div class="panel-campo"><span class="panel-campo-label">' + label + '</span><span class="panel-campo-value">' + panelEscapeHtml(valor) + '</span></div>';
}

function panelSeccion(titulo, contenido, grid) {
    var attr = (grid === false) ? '' : ' class="panel-seccion-grid"';
    return '<div class="panel-seccion"><div class="panel-seccion-titulo">' + titulo + '</div><div' + attr + '>' + contenido + '</div></div>';
}

function renderPanelReferencias(referencias) {
    if (!referencias || !referencias.length) return '<div class="panel-texto">Sin referencias registradas</div>';
    var html = '';
    for (var i = 0; i < referencias.length; i++) {
        var r = referencias[i] || {};
        if (!r.nombre && !r.telefono) continue;
        html += '<div class="panel-ref">';
        html += '  <div class="panel-ref-nombre">👤 ' + panelEscapeHtml(r.nombre || 'Sin nombre') + '</div>';
        html += '  <div class="panel-ref-detalle">📞 ' + panelEscapeHtml(r.telefono || '—') + (r.relacion ? ' · 🤝 ' + panelEscapeHtml(r.relacion) : '') + '</div>';
        html += '</div>';
    }
    return html || '<div class="panel-texto">Sin referencias registradas</div>';
}

function renderPanelUltimaGestion(datos) {
    if (!datos.ultima_gestion_tipo) return '<div class="panel-texto">Sin gestiones registradas</div>';
    var fecha = datos.ultima_gestion_fecha ? new Date(datos.ultima_gestion_fecha).toLocaleString('es-ES') : '';
    var html = '<div class="panel-gestion-tipo">📋 ' + panelEscapeHtml(datos.ultima_gestion_tipo) + '</div>';
    if (fecha) html += '<div class="panel-gestion-fecha">' + fecha + '</div>';
    if (datos.ultima_gestion_obs) html += '<div class="panel-gestion-obs">' + panelEscapeHtml(datos.ultima_gestion_obs) + '</div>';
    return html;
}

function renderPanelDetalle(datos, info) {
    var nombre = datos.nombre || 'Sin nombre';
    var celular = datos.celular || '';
    var html = '';

    html += '<div class="panel-acciones">';
    html += '  <button class="panel-accion-btn" onclick="whatsAppClienteDesktop(\'' + escaparParaAtributoDesktop(celular) + '\', \'' + escaparParaAtributoDesktop(nombre) + '\')">💬 <span>WhatsApp</span></button>';
    html += '</div>';

    html += panelSeccion('👤 Datos Personales',
        panelCampo('Cédula', datos.cedula) +
        panelCampo('Celular', datos.celular) +
        panelCampo('Correo', info.correo_electronico || datos.correo_electronico)
    );

    html += panelSeccion('📍 Ubicación',
        panelCampo('Dirección', info.direccion || datos.direccion) +
        panelCampo('Dirección de Trabajo', info.direccion_trabajo || datos.direccion_trabajo)
    );

    html += panelSeccion('💼 Laboral / Económico',
        panelCampo('Ocupación', info.ocupacion || datos.ocupacion) +
        panelCampo('Ingreso Mensual', formatIngreso(info.ingreso_mensual || datos.ingreso_mensual))
    );

    var detalle = panelCampo('Producto', datos.producto) +
        panelCampo('Código Plus', info.codigo_plus || datos.codigo_plus) +
        panelCampo('Segmento', datos.segmento) +
        panelCampo('Fecha Solicitud', datos.fecha_solicitud);
    if (_esLider && datos.vendedor) detalle += panelCampo('Vendedor', datos.vendedor);
    if (datos.nombre_campana) detalle += panelCampo('Campaña', datos.nombre_campana);
    html += panelSeccion('📦 Detalles', detalle);

    var observaciones = info.observaciones || datos.observaciones;
    html += panelSeccion('📝 Observaciones', '<div class="panel-texto">' + panelEscapeHtml(observaciones || 'Sin observaciones') + '</div>', false);

    html += panelSeccion('👥 Referencias', renderPanelReferencias(info.referencias), false);

    html += panelSeccion('🕐 Última Gestión', renderPanelUltimaGestion(datos), false);

    return html;
}

function renderPanelFooterDetalle(id) {
    return '<button class="panel-footer-btn panel-btn-primary" onclick="abrirEditarEnPanel(\'' + id + '\')">✏️ Editar</button>' +
           '<button class="panel-footer-btn panel-btn-danger" onclick="confirmarEliminarDesdePanel(\'' + id + '\')">🗑️ Eliminar</button>';
}

function confirmarEliminarDesdePanel(id) {
    cerrarPanelSolicitud();
    confirmarEliminarSolicitudDesktop(id);
}

function crearEstructuraPanel() {
    var existente = document.getElementById('panel-solicitud-overlay');
    if (existente) return;

    var html = '';
    html += '<div class="panel-solicitud-overlay" id="panel-solicitud-overlay" onclick="cerrarPanelSolicitud()">';
    html += '  <aside class="panel-solicitud" onclick="event.stopPropagation()">';
    html += '    <div class="panel-solicitud-header">';
    html += '      <div class="panel-solicitud-avatar" id="panel-solicitud-avatar">?</div>';
    html += '      <div class="panel-solicitud-info">';
    html += '        <div class="panel-solicitud-nombre" id="panel-solicitud-nombre">—</div>';
    html += '        <div class="panel-solicitud-estado" id="panel-solicitud-estado"></div>';
    html += '      </div>';
    html += '      <button class="panel-solicitud-close" onclick="cerrarPanelSolicitud()" aria-label="Cerrar">✕</button>';
    html += '    </div>';
    html += '    <div class="panel-solicitud-body" id="panel-solicitud-body"><div class="panel-loading">⏳ Cargando...</div></div>';
    html += '    <div class="panel-solicitud-footer" id="panel-solicitud-footer"></div>';
    html += '  </aside>';
    html += '</div>';

    document.body.insertAdjacentHTML('beforeend', html);

    requestAnimationFrame(function() {
        var overlay = document.getElementById('panel-solicitud-overlay');
        var aside = overlay ? overlay.querySelector('.panel-solicitud') : null;
        if (overlay) overlay.classList.add('abierto-overlay');
        if (aside) aside.classList.add('abierto');
    });
}

function actualizarPanelHeader(datos) {
    var nombre = datos.nombre || 'Sin nombre';
    var avatar = document.getElementById('panel-solicitud-avatar');
    var nombreEl = document.getElementById('panel-solicitud-nombre');
    var estadoEl = document.getElementById('panel-solicitud-estado');
    if (avatar) avatar.textContent = inicialesNombre(nombre);
    if (nombreEl) nombreEl.textContent = nombre;
    if (estadoEl) {
        estadoEl.textContent = datos.estado || 'Sin estado';
        estadoEl.style.background = estadoPanelColor(datos.estado);
    }
}

function cerrarPanelSolicitud() {
    var overlay = document.getElementById('panel-solicitud-overlay');
    if (!overlay || overlay.dataset.cerrando) return;
    overlay.dataset.cerrando = '1';

    overlay.classList.remove('abierto-overlay');
    var aside = overlay.querySelector('.panel-solicitud');
    if (aside) aside.classList.remove('abierto');

    setTimeout(function() {
        if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
    }, 320);

    _panelSolicitudId = null;
}

if (!window._panelSolicitudEscAttached) {
    window._panelSolicitudEscAttached = true;
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') cerrarPanelSolicitud();
    });
}

function abrirPanelSolicitud(id) {
    var datos = datosFilas[id];
    if (!datos) return;

    crearEstructuraPanel();
    _panelSolicitudId = id;
    actualizarPanelHeader(datos);
    cargarPanelSolicitud(id);
}

function cargarPanelSolicitud(id) {
    var datos = datosFilas[id];
    if (!datos) return;

    var body = document.getElementById('panel-solicitud-body');
    var footer = document.getElementById('panel-solicitud-footer');
    if (body) body.innerHTML = '<div class="panel-loading">⏳ Cargando...</div>';
    if (footer) footer.innerHTML = '';

    fetch('/api/excel/solicitudes/' + id + '/completa', { credentials: 'include' })
    .then(function(res) { return res.ok ? res.json() : null; })
    .then(function(data) {
        if (body) body.innerHTML = renderPanelDetalle(datos, data || {});
        if (footer) footer.innerHTML = renderPanelFooterDetalle(id);
    })
    .catch(function() {
        if (body) body.innerHTML = renderPanelDetalle(datos, {});
        if (footer) footer.innerHTML = renderPanelFooterDetalle(id);
    });
}

function panelFormCampo(label, inputHtml) {
    return '<div class="panel-form-grupo"><label class="panel-form-label">' + label + '</label>' + inputHtml + '</div>';
}

async function renderPanelEditar(id, datos, info) {
    var body = document.getElementById('panel-solicitud-body');
    var footer = document.getElementById('panel-solicitud-footer');

    var estadosOptions = '<option value="">Seleccionar...</option>';
    var segmentosOptions = '<option value="">Seleccionar...</option>';
    try {
        var resEstados = await fetch('/api/excel/dashboard/estados', { credentials: 'include' });
        var resSegmentos = await fetch('/api/excel/dashboard/segmentos', { credentials: 'include' });
        var estadosData = resEstados.ok ? await resEstados.json() : [];
        var segmentosData = resSegmentos.ok ? await resSegmentos.json() : [];
        for (var e = 0; e < estadosData.length; e++) {
            var val = estadosData[e].estado || estadosData[e];
            var sel = val === datos.estado ? 'selected' : '';
            estadosOptions += '<option value="' + panelEscapeHtml(val) + '" ' + sel + '>' + panelEscapeHtml(val) + '</option>';
        }
        for (var s = 0; s < segmentosData.length; s++) {
            var val2 = segmentosData[s].segmento || segmentosData[s];
            var sel2 = val2 === datos.segmento ? 'selected' : '';
            segmentosOptions += '<option value="' + panelEscapeHtml(val2) + '" ' + sel2 + '>' + panelEscapeHtml(val2) + '</option>';
        }
    } catch (err) {
        console.error('Error cargando estados/segmentos:', err);
    }

    var referencias = (info.referencias || []).slice();
    while (referencias.length < 3) {
        referencias.push({ nombre: '', telefono: '', relacion: '' });
    }
    var opcionesRelacion = ['Amigo', 'Familiar', 'Vecino', 'Compañero', 'Otro'];
    var htmlRef = '';
    for (var i = 0; i < 3; i++) {
        var r = referencias[i] || {};
        var num = i + 1;
        var selectOpciones = '<option value="">Seleccionar...</option>';
        for (var j = 0; j < opcionesRelacion.length; j++) {
            var selRel = opcionesRelacion[j] === r.relacion ? 'selected' : '';
            selectOpciones += '<option value="' + opcionesRelacion[j] + '" ' + selRel + '>' + opcionesRelacion[j] + '</option>';
        }
        htmlRef += '<div class="panel-ref-form">';
        htmlRef += '  <div class="panel-ref-form-titulo">👤 Referencia #' + num + '</div>';
        htmlRef += '  <label class="panel-form-label">Nombres y Apellidos</label>';
        htmlRef += '  <input type="text" class="panel-input" id="panel-ref-' + num + '-nombre" value="' + panelEscapeHtml(r.nombre) + '" placeholder="Nombre completo">';
        htmlRef += '  <label class="panel-form-label">📞 Teléfono</label>';
        htmlRef += '  <input type="tel" class="panel-input" id="panel-ref-' + num + '-telefono" value="' + panelEscapeHtml(r.telefono) + '" placeholder="Número de teléfono">';
        htmlRef += '  <label class="panel-form-label">🤝 Relación</label>';
        htmlRef += '  <select class="panel-select" id="panel-ref-' + num + '-relacion">' + selectOpciones + '</select>';
        htmlRef += '</div>';
    }

    var html = '';
    html += '<div class="panel-form-encabezado"><strong>Cliente:</strong> ' + panelEscapeHtml(datos.nombre || 'N/A') + ' · <strong>#' + id + '</strong></div>';

    html += panelSeccion('📌 Estado y Segmento',
        panelFormCampo('📌 Estado', '<select class="panel-select" id="panel-editar-estado">' + estadosOptions + '</select>') +
        panelFormCampo('🏷️ Segmento', '<select class="panel-select" id="panel-editar-segmento">' + segmentosOptions + '</select>')
    );

    html += panelSeccion('📋 Información Adicional',
        panelFormCampo('📦 Código Plus', '<input type="text" class="panel-input" id="panel-codigo-plus" value="' + panelEscapeHtml(info.codigo_plus || '') + '" placeholder="Código Plus">') +
        panelFormCampo('📍 Dirección', '<input type="text" class="panel-input" id="panel-direccion" value="' + panelEscapeHtml(info.direccion || '') + '" placeholder="Dirección de domicilio">') +
        panelFormCampo('🏢 Dirección de Trabajo', '<input type="text" class="panel-input" id="panel-direccion-trabajo" value="' + panelEscapeHtml(info.direccion_trabajo || '') + '" placeholder="Dirección de trabajo">') +
        panelFormCampo('💼 Ocupación', '<input type="text" class="panel-input" id="panel-ocupacion" value="' + panelEscapeHtml(info.ocupacion || '') + '" placeholder="Ocupación">') +
        panelFormCampo('📧 Correo Electrónico', '<input type="email" class="panel-input" id="panel-correo" value="' + panelEscapeHtml(info.correo_electronico || '') + '" placeholder="cliente@ejemplo.com">') +
        panelFormCampo('💰 Ingreso Mensual', '<input type="number" step="0.01" min="0" class="panel-input" id="panel-ingreso" value="' + panelEscapeHtml(info.ingreso_mensual || '') + '" placeholder="0.00">') +
        '<div class="panel-form-grupo panel-form-grupo-ancho"><label class="panel-form-label">📝 Observaciones</label><textarea class="panel-textarea" id="panel-observaciones" rows="3" placeholder="Escriba aquí cualquier observación o nota adicional...">' + panelEscapeHtml(info.observaciones || '') + '</textarea></div>'
    );

    html += panelSeccion('👥 Referencias Personales', htmlRef, false);

    if (body) body.innerHTML = html;
    if (body) body.scrollTop = 0;
    if (footer) {
        footer.innerHTML = '<button class="panel-footer-btn panel-btn-secondary" onclick="cargarPanelSolicitud(' + id + ')">← Volver</button>' +
                           '<button class="panel-footer-btn panel-btn-primary" id="panel-btn-guardar" onclick="guardarPanelEditarSolicitud(' + id + ')">💾 Guardar</button>';
    }
}

function abrirEditarEnPanel(id) {
    var datos = datosFilas[id];
    if (!datos) return;

    crearEstructuraPanel();
    _panelSolicitudId = id;
    actualizarPanelHeader(datos);

    var body = document.getElementById('panel-solicitud-body');
    var footer = document.getElementById('panel-solicitud-footer');
    if (body) body.innerHTML = '<div class="panel-loading">⏳ Cargando formulario...</div>';
    if (footer) footer.innerHTML = '';

    fetch('/api/excel/solicitudes/' + id + '/completa', { credentials: 'include' })
    .then(function(res) { return res.ok ? res.json() : null; })
    .then(function(data) {
        renderPanelEditar(id, datos, data || {});
    })
    .catch(function() {
        renderPanelEditar(id, datos, {});
    });
}

async function guardarPanelEditarSolicitud(id) {
    var estado = document.getElementById('panel-editar-estado').value;
    var segmento = document.getElementById('panel-editar-segmento').value;

    var codigo_plus = document.getElementById('panel-codigo-plus').value.trim();
    var correo_electronico = document.getElementById('panel-correo').value.trim();
    var direccion = document.getElementById('panel-direccion').value.trim();
    var direccion_trabajo = document.getElementById('panel-direccion-trabajo').value.trim();
    var ocupacion = document.getElementById('panel-ocupacion').value.trim();
    var ingresoInput = document.getElementById('panel-ingreso').value.trim();
    var ingreso_mensual = ingresoInput ? (parseFloat(ingresoInput) || null) : null;
    var observaciones = document.getElementById('panel-observaciones').value.trim();

    var referencias = [];
    for (var i = 1; i <= 3; i++) {
        referencias.push({
            nombre: document.getElementById('panel-ref-' + i + '-nombre').value.trim(),
            telefono: document.getElementById('panel-ref-' + i + '-telefono').value.trim(),
            relacion: document.getElementById('panel-ref-' + i + '-relacion').value
        });
    }

    var btn = document.getElementById('panel-btn-guardar');
    if (btn) { btn.textContent = '⏳ Guardando...'; btn.disabled = true; }

    try {
        if (estado || segmento) {
            var res1 = await fetch('/api/excel/solicitudes/' + id + '/editar', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ estado: estado, segmento: segmento })
            });
            if (!res1.ok) {
                var err1 = await res1.json().catch(function() { return {}; });
                throw new Error(err1.error || 'Error al actualizar estado/segmento');
            }
        }

        var res2 = await fetch('/api/excel/solicitudes/' + id + '/completar-info', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                codigo_plus: codigo_plus,
                correo_electronico: correo_electronico,
                direccion: direccion,
                direccion_trabajo: direccion_trabajo,
                ocupacion: ocupacion,
                ingreso_mensual: ingreso_mensual,
                observaciones: observaciones,
                referencias: referencias
            })
        });
        var resultado = await res2.json();
        if (resultado.error) throw new Error(resultado.error);

        alert('Solicitud actualizada correctamente');
        cerrarPanelSolicitud();
        init();
    } catch (err) {
        console.error('Error:', err);
        alert('Error: ' + err.message);
    } finally {
        if (btn) { btn.textContent = '💾 Guardar'; btn.disabled = false; }
    }
}

// ============================================================================
// LIBERACIÓN / REACTIVACIÓN SIN COMPRA
// Solicitudes en APROBADA PARA LIBERACIÓN con más de 6 meses y sin relación
// activa. Banner de alerta + listado modal + activación en lote (con o sin
// campaña).
// ============================================================================
var liberacionDatos = [];
var liberacionSeleccion = new Set();

async function cargarBannerLiberacion() {
    try {
        var res = await fetch('/api/liberacion/contar');
        var data = await res.json();
        var total = (data && data.total) || 0;
        var campana = data && data.campana_automatica;
        var banner = document.getElementById('liberacion-banner');
        var bannerCampana = document.getElementById('liberacion-banner-con-campana');
        if (!banner) return;

        if (total === 0) {
            banner.classList.remove('visible');
            if (bannerCampana) bannerCampana.style.display = 'none';
            return;
        }

        if (campana && campana.id) {
            // Existe campaña automática → mostrar banner de campaña creada
            banner.classList.remove('visible');
            if (bannerCampana) {
                var countCampana = document.getElementById('liberacion-campana-total');
                if (countCampana) countCampana.textContent = campana.total_solicitudes || total;
                var linkCampana = document.getElementById('liberacion-campana-link');
                if (linkCampana) linkCampana.href = '/gestion-lote?id=' + campana.id;
                bannerCampana.style.display = '';
            }
        } else {
            // Sin campaña automática → mostrar banner original
            if (bannerCampana) bannerCampana.style.display = 'none';
            var countEl = document.getElementById('liberacion-count');
            if (countEl) countEl.textContent = total;
            banner.classList.add('visible');
        }
    } catch (e) {
        console.error('[Liberación] Error cargando banner:', e);
    }
}

function ocultarBannerLiberacion() {
    var banner = document.getElementById('liberacion-banner');
    if (banner) banner.classList.remove('visible');
}

async function cargarDatosLiberacion() {
    var res = await fetch('/api/liberacion?limite=500');
    var data = await res.json();
    liberacionDatos = (data && data.data) || [];
    liberacionSeleccion = new Set();
    return liberacionDatos;
}

function renderFilaLiberacion(s) {
    var id = Number(s.id_solicitud);
    var sel = liberacionSeleccion.has(id);
    return '<div class="liberacion-fila' + (sel ? ' seleccionada' : '') + '" data-id="' + id + '" onclick="toggleLiberacionSel(' + id + ', this)">' +
        '<input type="checkbox" ' + (sel ? 'checked' : '') + '>' +
        '<div class="liberacion-fila-info">' +
            '<div class="liberacion-fila-nombre">#' + id + ' · ' + panelEscapeHtml(s.nombre || 'Sin nombre') + '</div>' +
            '<div class="liberacion-fila-meta">' +
                '<span>🆔 ' + panelEscapeHtml(s.cedula || '-') + '</span>' +
                '<span>📱 ' + panelEscapeHtml(s.celular || '-') + '</span>' +
                '<span>📅 ' + panelEscapeHtml(String(s.fecha_solicitud || '').slice(0, 10)) + '</span>' +
                (s.segmento ? '<span class="liberacion-fila-segmento">' + panelEscapeHtml(s.segmento) + '</span>' : '') +
            '</div>' +
        '</div>' +
    '</div>';
}

async function abrirListadoLiberacion() {
    Modal.abrir('<div class="liberacion-modal">' +
        '<div class="liberacion-modal-header"><h2>⚠️ Solicitudes liberadas por reactivar</h2><button class="modal-close-btn" onclick="Modal.cerrar()">✕</button></div>' +
        '<p class="liberacion-modal-sub">APROBADA PARA LIBERACIÓN con más de 6 meses y sin relación activa. Si compran, la venta no se refleja.</p>' +
        '<div class="liberacion-toolbar">' +
            '<span id="liberacion-total-seleccion">0 seleccionadas</span>' +
            '<button class="liberacion-btn-select-all" onclick="seleccionarTodasLiberacion()">✓ Seleccionar todo</button>' +
        '</div>' +
        '<div class="liberacion-lista" id="liberacion-lista"><div class="liberacion-vacio">⏳ Cargando...</div></div>' +
        '<div class="liberacion-modal-acciones" id="liberacion-modal-acciones">' +
            '<button class="liberacion-btn liberacion-btn-cancelar" onclick="Modal.cerrar()">Cancelar</button>' +
            '<button class="liberacion-btn liberacion-btn-activar" onclick="confirmarActivacionLiberacion(false)">✅ Activar sin compra</button>' +
            '<button class="liberacion-btn liberacion-btn-crear" onclick="confirmarActivacionLiberacion(true)">🚀 Crear campaña y activar</button>' +
        '</div>' +
    '</div>', { ancho: 'wide' });
    try {
        await cargarDatosLiberacion();
        var lista = document.getElementById('liberacion-lista');
        if (!lista) return;
        if (liberacionDatos.length === 0) {
            lista.innerHTML = '<div class="liberacion-vacio">🎉 No hay solicitudes para reactivar.</div>';
        } else {
            lista.innerHTML = liberacionDatos.map(renderFilaLiberacion).join('');
        }
        actualizarContadorLiberacion();
    } catch (e) {
        console.error('[Liberación] Error cargando listado:', e);
    }
}

function toggleLiberacionSel(id, filaEl) {
    if (liberacionSeleccion.has(id)) {
        liberacionSeleccion.delete(id);
        if (filaEl) filaEl.classList.remove('seleccionada');
    } else {
        liberacionSeleccion.add(id);
        if (filaEl) filaEl.classList.add('seleccionada');
    }
    if (filaEl) {
        var cb = filaEl.querySelector('input[type=checkbox]');
        if (cb) cb.checked = liberacionSeleccion.has(id);
    }
    actualizarContadorLiberacion();
}

function seleccionarTodasLiberacion() {
    var todas = liberacionDatos.map(function(s) { return Number(s.id_solicitud); });
    var yaTodas = todas.length > 0 && todas.every(function(id) { return liberacionSeleccion.has(id); });
    if (yaTodas) {
        liberacionSeleccion = new Set();
    } else {
        liberacionSeleccion = new Set(todas);
    }
    var lista = document.getElementById('liberacion-lista');
    if (lista) lista.innerHTML = liberacionDatos.map(renderFilaLiberacion).join('');
    actualizarContadorLiberacion();
}

function actualizarContadorLiberacion() {
    var el = document.getElementById('liberacion-total-seleccion');
    if (el) el.textContent = liberacionSeleccion.size + ' seleccionadas';
}

function confirmarActivacionLiberacion(crearCampana) {
    if (liberacionSeleccion.size === 0) {
        alert('Selecciona al menos una solicitud');
        return;
    }
    var ids = Array.from(liberacionSeleccion);
    if (!crearCampana) {
        if (!confirm('¿Activar ' + ids.length + ' solicitud(es) sin compra? Se cambiarán a ACTIVADA y volverán a reflejar la venta.')) return;
        ejecutarActivacionLiberacion(ids, false, null);
        return;
    }
    abrirModalNombreCampanaLiberacion(ids);
}

function abrirModalNombreCampanaLiberacion(ids) {
    Modal.abrir('<div class="liberacion-modal" style="max-width:520px;margin:0 auto;">' +
        '<div class="liberacion-modal-header"><h2>🚀 Crear campaña de activación</h2><button class="modal-close-btn" onclick="Modal.cerrar()">✕</button></div>' +
        '<p class="liberacion-modal-sub">Se creará una campaña con <strong>' + ids.length + '</strong> solicitudes y se activarán sin compra (estado → ACTIVADA).</p>' +
        '<label style="display:block;font-weight:600;margin-bottom:4px;font-size:13px;color:#374151;">📝 Nombre de la campaña:</label>' +
        '<input type="text" id="liberacion-nombre-campana" style="width:100%;padding:10px;border:2px solid #e5e7eb;border-radius:8px;font-size:14px;box-sizing:border-box;margin-bottom:10px;" placeholder="Ej: Activación sin compra - liberadas">' +
        '<div class="liberacion-modal-acciones">' +
            '<button class="liberacion-btn liberacion-btn-cancelar" onclick="Modal.cerrar()">Cancelar</button>' +
            '<button class="liberacion-btn liberacion-btn-crear" onclick="ejecutarActivacionLiberacion(' + JSON.stringify(ids) + ', true, document.getElementById(\'liberacion-nombre-campana\').value)">🚀 Crear y activar</button>' +
        '</div>' +
    '</div>', { ancho: 'narrow' });
    setTimeout(function() {
        var input = document.getElementById('liberacion-nombre-campana');
        if (input) input.focus();
    }, 150);
}

async function ejecutarActivacionLiberacion(ids, crearCampana, nombreCampana) {
    if (crearCampana && !String(nombreCampana || '').trim()) {
        alert('El nombre de la campaña es requerido');
        return;
    }
    try {
        var res = await fetch('/api/liberacion/activar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                ids: ids,
                crear_campana: crearCampana ? true : false,
                nombre_campana: crearCampana ? String(nombreCampana).trim() : null
            })
        });
        var data = await res.json();
        if (!res.ok) {
            alert('Error: ' + (data.error || 'Error desconocido'));
            return;
        }
        Modal.cerrar();
        if (typeof mostrarToastSimple === 'function') {
            mostrarToastSimple('✅ ' + data.mensaje);
        } else {
            alert(data.mensaje);
        }
        if (data.campana_id) {
            window.location.href = '/gestion-lote?id=' + data.campana_id;
        } else {
            cargarBannerLiberacion();
        }
    } catch (e) {
        console.error('[Liberación] Error ejecutando activación:', e);
        alert('Error al activar: ' + e.message);
    }
}

// Acción directa desde el banner: usar todas las solicitudes detectadas
async function abrirModalCrearCampanaLiberacion() {
    try {
        await cargarDatosLiberacion();
    } catch (e) {
        liberacionDatos = [];
    }
    if (liberacionDatos.length === 0) {
        alert('No hay solicitudes para reactivar');
        return;
    }
    var ids = liberacionDatos.map(function(s) { return Number(s.id_solicitud); });
    abrirModalNombreCampanaLiberacion(ids);
}

// ============================================================================
// INICIALIZACIÓN - LLAMAR A init() CUANDO EL DOM ESTÉ LISTO
// ============================================================================
document.addEventListener('DOMContentLoaded', function() {
    init();
    cargarBannerLiberacion();
    try {
        var params = new URLSearchParams(window.location.search);
        if (params.get('liberacion') === '1') {
            setTimeout(abrirListadoLiberacion, 500);
        }
    } catch (e) { /* ignore */ }
});
