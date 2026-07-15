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

    var contenido = '';
    contenido += '<div style="padding: 24px; max-width: 600px; margin: 0 auto;">';
    contenido += '<h2 style="margin: 0 0 12px 0; color: #1f2937; font-size: 20px;">➕ Agregar a Campaña</h2>';
    contenido += '<div style="background: #e0e7ff; padding: 8px 14px; border-radius: 8px; font-size: 13px; font-weight: 600; color: #3730a3; margin-bottom: 15px;">' + filasSeleccionadas.length + ' solicitudes seleccionadas</div>';
    contenido += '<div id="campanas-list-desktop" style="text-align: center; padding: 40px; color: #6b7280;">⏳ Cargando campañas...</div>';
    contenido += '<div style="margin-top: 20px; display: flex; gap: 10px; justify-content: flex-end;">';
    contenido += '<button onclick="cerrarModal()" class="btn-modal-cancelar">Cancelar</button>';
    contenido += '</div>';
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

        html += '<div class="campana-item-select" data-id="' + c.id + '" style="background: #f8fafc; border: 2px solid #e5e7eb; border-radius: 10px; padding: 14px; cursor: pointer; transition: all 0.2s ease;" onclick="seleccionarCampanaDesktop(this, \'' + c.id + '\')" onmouseenter="this.style.borderColor=\x27#93c5fd\x27;this.style.background=\x27#f0f5ff\x27" onmouseleave="var isSel=this.classList.contains(\x27seleccionada\x27);if(!isSel){this.style.borderColor=\x27#e5e7eb\x27;this.style.background=\x27#f8fafc\x27}">';
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
    html += '<div style="margin-top: 12px; text-align: center;">';
    html += '<button id="btn-confirmar-agregar" onclick="confirmarAgregarCampanaDesktop()" disabled style="width: 100%; padding: 14px; background: #9ca3af; color: white; border: none; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: not-allowed; transition: all 0.2s ease;">Selecciona una campaña</button>';
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
            alert('✅ ' + (resultado.mensaje || 'Solicitudes agregadas correctamente'));
            cerrarModal();
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
// RENDERIZAR CARDS
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

    var html = '';
    for (var i = 0; i < datos.length; i++) {
        var item = datos[i];
        if (!item) continue;
        var id = item.id_solicitud || '';
        var seleccionado = filasSeleccionadas.indexOf(id) > -1 ? 'seleccionada' : '';
        var estadoClase = 'estado-' + (item.estado || '').replace(/\s+/g, '').toUpperCase();

        // Colores para estado badge
        var coloresEstado = {
            'ACTIVADA': '#dcfce7',
            'RECHAZADA': '#fee2e2',
            'DEVUELTA': '#fef3c7',
            'APROBADA PARA LIBERACIÓN': '#d1fae5'
        };
        var colorEstado = coloresEstado[item.estado] || '#f3f4f6';

        // Colores para tipo de gestión
        var coloresGestion = {
            'Seguimiento': '#dbeafe',
            'Cobranza': '#fee2e2',
            'Llamada': '#d1fae5',
            'WhatsApp': '#dcfce7',
            'Reclamo': '#fef3c7',
            'Cita': '#e0e7ff',
            'Completada': '#bbf7d0',
            'Otro': '#f3f4f6'
        };
        var colorGestion = coloresGestion[item.ultima_gestion_tipo] || '#f3f4f6';
        var fechaGestion = item.ultima_gestion_fecha ? new Date(item.ultima_gestion_fecha).toLocaleString('es-ES') : '';

        html += '<div class="solicitud-card ' + seleccionado + '" data-id="' + id + '" onclick="toggleCardDesktop(\'' + id + '\', event)">';

        // FILA 1: Checkbox + ID + Segmento + Estado
        html += '  <div class="card-fila-1">';
        html += '    <div class="card-checkbox-wrapper" onclick="event.stopPropagation()">';
        html += '      <input type="checkbox" class="checkbox-fila card-checkbox" value="' + id + '" onchange="toggleFilaCheckbox(this)" ' + (seleccionado ? 'checked' : '') + '>';
        html += '    </div>';
        html += '    <span class="card-id">#' + id + '</span>';
        html += '    <span class="card-badge badge-segmento" title="' + (item.segmento || 'Sin segmento') + '">' + (item.segmento || '—') + '</span>';
        html += '    <span class="card-badge badge-estado ' + estadoClase + '" style="background:' + colorEstado + ';">' + (item.estado || 'Sin estado') + '</span>';
        html += '  </div>';

        // FILA 2: Nombre
        html += '  <div class="card-fila-2" title="' + (item.nombre || 'Sin nombre') + '">';
        html +=      (item.nombre || 'Sin nombre');
        html += '  </div>';

        // FILA 3: Botones de acción
        html += '  <div class="card-fila-3">';
        html += '    <button class="card-btn btn-gestiones" onclick="event.stopPropagation(); abrirGestionesCard(' + id + ')">📋 Gestiones</button>';
        html += '    <button class="card-btn btn-whatsapp" onclick="event.stopPropagation(); whatsAppClienteDesktop(\'' + (item.celular || '') + '\', \'' + escaparParaAtributoDesktop(item.nombre || '') + '\')">💬 WhatsApp</button>';
        html += '    <button class="card-btn btn-completar" onclick="event.stopPropagation(); abrirCompletarInfoCard(' + id + ')">✏️ Completar</button>';
        html += '    <div class="card-actions-more" onclick="event.stopPropagation()">';
        html += '      <button class="card-btn btn-more" onclick="toggleCardMenuDesktop(event, \'' + id + '\')" title="Más acciones">⋮</button>';
        html += '      <div class="card-dropdown-menu" id="card-menu-desktop-' + id + '">';
        html += '        <button class="dropdown-item" onclick="event.stopPropagation(); abrirEditarSolicitudDesktop(\'' + id + '\'); cerrarTodosLosMenusDesktop()">✏️ Editar</button>';
        html += '        <div class="dropdown-divider"></div>';
        html += '        <button class="dropdown-item dropdown-item-danger" onclick="event.stopPropagation(); confirmarEliminarSolicitudDesktop(\'' + id + '\'); cerrarTodosLosMenusDesktop()">🗑️ Eliminar</button>';
        html += '      </div>';
        html += '    </div>';
        html += '  </div>';

        // FILA 4: Seguimiento (última gestión)
        if (item.ultima_gestion_tipo) {
            html += '  <div class="card-fila-4">';
            html += '    <div class="seguimiento-header">';
            html += '      <span class="seguimiento-badge" style="background:' + colorGestion + ';">📋 ' + item.ultima_gestion_tipo + '</span>';
            if (fechaGestion) html += '      <span class="seguimiento-fecha">' + fechaGestion + '</span>';
            html += '    </div>';
            if (item.ultima_gestion_obs) {
                html += '    <div class="seguimiento-obs" title="' + escaparParaAtributoDesktop(item.ultima_gestion_obs) + '">' + item.ultima_gestion_obs + '</div>';
            }
            html += '  </div>';
        } else {
            html += '  <div class="card-fila-4 vacia">Sin gestiones</div>';
        }

        // FILA 5: Producto + Fecha
        html += '  <div class="card-fila-5">';
        html += '    <span class="card-tag">📦 <span>' + (item.producto || '—') + '</span></span>';
        html += '    <span class="card-tag">📅 <span>' + (item.fecha_solicitud || '—') + '</span></span>';
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
                var container = document.getElementById('filtro-estado');
                if (container) {
                    var html = '<button class="filtro-btn' + (estadoActual === '' ? ' active' : '') + '" data-value="">Todos</button>';
                    for (var i = 0; i < data.length; i++) {
                        var e = data[i].estado || data[i];
                        var activo = estadoActual === e ? ' active' : '';
                        html += '<button class="filtro-btn' + activo + '" data-value="' + e.replace(/'/g, '&#39;') + '">' + e + '</button>';
                    }
                    container.innerHTML = html;
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
                var container = document.getElementById('filtro-segmento');
                if (container) {
                    var html = '<button class="filtro-btn' + (segmentoActual === '' ? ' active' : '') + '" data-value="">Todos</button>';
                    for (var i = 0; i < data.length; i++) {
                        var s = data[i].segmento || data[i];
                        var activo = segmentoActual === s ? ' active' : '';
                        html += '<button class="filtro-btn' + activo + '" data-value="' + s.replace(/'/g, '&#39;') + '">' + s + '</button>';
                    }
                    container.innerHTML = html;
                }
            }
        }
    } catch (error) {
        console.error('[Solicitudes] Error cargando segmentos:', error);
    }
}

// ============================================================================
// CONFIGURAR EVENTOS DE CHECKBOXES Y FILTROS
// ============================================================================
function configurarEventosCheckboxes() {
    // Event delegation: en lugar de attach a cada .filtro-btn (que son reemplazados),
    // escuchamos en el contenedor padre y delegamos según el target
    var filtroEstado = document.getElementById('filtro-estado');
    var filtroSegmento = document.getElementById('filtro-segmento');

    function manejarClickFiltro(container, esEstado) {
        return function(e) {
            var btn = e.target.closest('.filtro-btn');
            if (!btn) return;
            container.querySelectorAll('.filtro-btn').forEach(function(b) { b.classList.remove('active'); });
            btn.classList.add('active');
            if (esEstado) {
                estadoActual = btn.dataset.value;
            } else {
                segmentoActual = btn.dataset.value;
            }
            persistirEstado();
            actualizarInfoPanel();
            buscarEnServidor(true);
        };
    }

    if (filtroEstado) filtroEstado.onclick = manejarClickFiltro(filtroEstado, true);
    if (filtroSegmento) filtroSegmento.onclick = manejarClickFiltro(filtroSegmento, false);

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
}

// ============================================================================
// ACTUALIZAR INFO PANEL
// ============================================================================
function actualizarInfoPanel() {
    var resumenEstado = document.getElementById('resumen-estado');
    var resumenSegmento = document.getElementById('resumen-segmento');
    if (resumenEstado) resumenEstado.textContent = estadoActual || 'Todos';
    if (resumenSegmento) resumenSegmento.textContent = segmentoActual || 'Todos';
}

// ============================================================================
// RESTAURAR FILTROS UI DESDE SESSIONSTORAGE
// ============================================================================
function restaurarFiltrosUI() {
    // Los botones de filtro ya se restauran desde cargarEstados/cargarSegmentos
    // porque toman el valor de estadoActual/segmentoActual
    actualizarInfoPanel();
}

// ============================================================================
// APLICAR FILTROS (CLIENT-SIDE)
// ============================================================================
function aplicarFiltros() {
    // Esta función se llama después de cargar más datos
    // Para mantener consistencia, renderizamos todo de nuevo
    renderizarCards(todosDatos);
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
            {wch: 15}, {wch: 15}, {wch: 20}, {wch: 15}
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
    persistirEstado();

    // Reset UI
    document.querySelectorAll('#filtro-estado .filtro-btn').forEach(function(b) { b.classList.remove('active'); });
    document.querySelectorAll('#filtro-segmento .filtro-btn').forEach(function(b) { b.classList.remove('active'); });
    var btnTodosEstado = document.querySelector('#filtro-estado .filtro-btn[data-value=""]');
    var btnTodosSegmento = document.querySelector('#filtro-segmento .filtro-btn[data-value=""]');
    if (btnTodosEstado) btnTodosEstado.classList.add('active');
    if (btnTodosSegmento) btnTodosSegmento.classList.add('active');

    var inputBusqueda = document.getElementById('cedula');
    if (inputBusqueda) inputBusqueda.value = '';

    actualizarInfoPanel();
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
            renderizarCards([]);
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
            ingreso_mensual: document.getElementById('ns-desktop-ingreso').value ? parseFloat(document.getElementById('ns-desktop-ingreso').value) : undefined
        };

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

    fetch('/api/excel/gestiones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            solicitud_id: id,
            tipo_gestion: tipo.value,
            observacion: observacion.value.trim()
        })
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
    var mensaje = encodeURIComponent('Hola ' + (nombre || '') + ', te contactamos de Archivox. ¿En qué podemos ayudarte?');
    window.open('https://wa.me/' + numeroLimpio + '?text=' + mensaje, '_blank');
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
        var contenido = '';
        contenido += '<div class="nueva-solicitud-overlay">';
        contenido += '  <div class="nueva-solicitud-modal" style="max-width:500px;">';
        contenido += '    <div class="ns-header" style="background:linear-gradient(135deg,#6366f1,#4f46e5);">';
        contenido += '      <h2>✏️ Completar Información</h2>';
        contenido += '      <button class="ns-close-btn" onclick="cerrarModal()">✕</button>';
        contenido += '    </div>';
        contenido += '    <div class="ns-body">';
        contenido += '      <div style="background:#f3f4f6;padding:12px;border-radius:8px;margin-bottom:15px;">';
        contenido += '        <p><strong>Cliente:</strong> ' + (datos.nombre || 'N/A') + ' | <strong>Cédula:</strong> ' + (datos.cedula || 'N/A') + '</p>';
        contenido += '      </div>';
        contenido += '      <div class="ns-field" style="margin-bottom:12px;">';
        contenido += '        <label>🔢 Código Plus</label>';
        contenido += '        <input type="text" id="codigo-plus-completar-desktop" value="' + escaparParaAtributoDesktop(codigoPlus) + '" placeholder="Código Plus">';
        contenido += '      </div>';
        contenido += '    </div>';
        contenido += '    <div class="ns-footer">';
        contenido += '      <button class="ns-btn-cancel" onclick="cerrarModal()">Cancelar</button>';
        contenido += '      <button class="ns-btn-submit" onclick="guardarCompletarInfoDesktop(\'' + id + '\')">💾 Guardar</button>';
        contenido += '    </div>';
        contenido += '  </div>';
        contenido += '</div>';

        var overlay = document.querySelector('.nueva-solicitud-overlay');
        if (overlay) overlay.remove();
        document.body.insertAdjacentHTML('beforeend', contenido);
    })
    .catch(function(err) {
        console.error('Error cargando datos completos:', err);
        alert('Error al cargar datos');
    });
}

function guardarCompletarInfoDesktop(id) {
    var codigo_plus = document.getElementById('codigo-plus-completar-desktop').value.trim();
    if (!codigo_plus) { alert('Ingresa un código plus'); return; }

    fetch('/api/excel/solicitudes/' + id + '/codigo-plus', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ codigo_plus: codigo_plus })
    })
    .then(function(res) { return res.json(); })
    .then(function(resultado) {
        if (!resultado.error) {
            alert('Código Plus actualizado');
            cerrarModal();
            init();
        } else {
            alert('Error: ' + resultado.error);
        }
    })
    .catch(function(err) {
        console.error('Error:', err);
        alert('Error al guardar');
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
            renderizarCards(todosDatos);
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
// INICIALIZACIÓN - LLAMAR A init() CUANDO EL DOM ESTÉ LISTO
// ============================================================================
document.addEventListener('DOMContentLoaded', function() {
    init();
});
