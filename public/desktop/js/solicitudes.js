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
var TAMANO_LOTE = CONFIG.TAMANO_LOTE;

// Cache de consultas
const queryCache = new Map();

// Variables legacy
let campanaSeleccionadaId = null;

// ============================================================================
// UTILIDADES
// ============================================================================
function getCacheKey(q, estado, segmento, offset) {
    return `${q}|${estado}|${segmento}|${offset}`;
}
function getFromCache(q, estado, segmento, offset) {
    const key = getCacheKey(q, estado, segmento, offset);
    const entry = queryCache.get(key);
    if (entry && Date.now() - entry.timestamp < CONFIG.CACHE_TTL) {
        return entry.data;
    }
    queryCache.delete(key);
    return null;
}
function setCache(q, estado, segmento, offset, data) {
    const key = getCacheKey(q, estado, segmento, offset);
    queryCache.set(key, { data, timestamp: Date.now() });
}
function persistirEstado() {
    try {
        sessionStorage.setItem('sol_estado', estadoActual);
        sessionStorage.setItem('sol_segmento', segmentoActual);
    } catch (e) { /* ignore */ }
}

// ============================================================================
// INICIALIZACIÓN CONSOLIDADA
// ============================================================================
async function init() {
    try {
        currentOffset = 0;
        todosDatos = [];
        
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
        renderizarCards(todosDatos);
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
    const tieneFiltros = !!(termino || estadoActual || segmentoActual);
    const nuevoOffset = (extraOffset !== null) ? extraOffset : (resetOffset ? 0 : currentOffset);

    const cached = resetOffset ? getFromCache(termino, estadoActual, segmentoActual, 0) : null;
    if (cached) {
        todosDatos = cached;
        currentOffset = cached.length;
        hasMoreData = currentOffset < (cached.total || 0);
        document.getElementById('totalRegistros').textContent = cached.total || cached.length;
        document.getElementById('mostrando').textContent = cached.length;
        renderizarCards(cached);
        return;
    }

    try {
        if (tieneFiltros) {
            let url = `/api/excel/solicitudes/buscar?q=${encodeURIComponent(termino || '%')}&limite=${CONFIG.TAMANO_LOTE}&offset=${nuevoOffset}`;
            if (estadoActual) url += `&estado=${encodeURIComponent(estadoActual)}`;
            if (segmentoActual) url += `&segmento=${encodeURIComponent(segmentoActual)}`;

            const response = await fetch(url, { signal });
            const result = await response.json();
            const datosRecibidos = Array.isArray(result) ? result : (result.data || []);
            const total = Array.isArray(result) ? result.length : (result.total || 0);

            if (resetOffset) {
                todosDatos = datosRecibidos;
                currentOffset = datosRecibidos.length;
                datosRecibidos.total = total;
                setCache(termino, estadoActual, segmentoActual, 0, datosRecibidos);
            } else {
                for (let i = 0; i < datosRecibidos.length; i++) todosDatos.push(datosRecibidos[i]);
                currentOffset += datosRecibidos.length;
            }
            hasMoreData = currentOffset < total;
            busquedaActiva = true;
            document.getElementById('totalRegistros').textContent = total;
            document.getElementById('mostrando').textContent = todosDatos.length;
            renderizarCards(todosDatos);
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
    if (busquedaActiva || estadoActual || segmentoActual) {
        await buscarEnServidor(false, currentOffset);
        return;
    }
    await cargarMasSolicitudes();
}

async function cargarMasSolicitudes() {
    if (isLoading || !hasMoreData) return;
    isLoading = true;
    var sentinel = document.getElementById('infinite-scroll-sentinel');
    if (sentinel) sentinel.innerHTML = '<span class="loader-text">⏳ Cargando más...</span>';
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
        if (sentinel) {
            sentinel.innerHTML = hasMoreData ? '<span class="loader-text">📜 Scroll para cargar más...</span>' : '<span class="loader-text">✅ No hay más registros</span>';
        }
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

// Toggle card selection by clicking on the card itself (desktop)
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
    
    var card = document.querySelector('.solicitud-card[data-id="' + id + '"]');
    if (!card) return;
    
    var checkbox = card.querySelector('.checkbox-fila');
    if (checkbox) {
        checkbox.checked = !checkbox.checked;
        toggleFilaCheckbox(checkbox);
    }
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
    contenido += '<label style="display: block; font-weight: 600; margin-bottom: 4px; font-size: 12px; color: #374151;">
    // Agregar selector de agente (solo visible si el líder tiene agentes)
    contenido += agenteSelectorHTML;
📝 Nombre:</label>';
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
