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
    } else {
        var index = filasSeleccionadas.indexOf(id);
        if (index > -1) filasSeleccionadas.splice(index, 1);
        if (fila) fila.classList.remove('fila-seleccionada');
    }
    actualizarCheckboxes();
    actualizarContador();
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
        });
    } else {
        checkboxes.forEach(function(cb) {
            cb.checked = false;
            var fila = cb.closest('tr') || cb.closest('.cliente-card');
            if (fila) fila.classList.remove('fila-seleccionada');
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
    var toolbar = document.getElementById('toolbar-flotante');
    var toolbarCount = document.getElementById('seleccionadas-count-toolbar');
    if (contador) contador.textContent = filasSeleccionadas.length;
    if (toolbar && toolbarCount) {
        if (filasSeleccionadas.length > 0) {
            toolbarCount.textContent = filasSeleccionadas.length;
            toolbar.style.display = 'flex';
        } else {
            toolbar.style.display = 'none';
        }
    }
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

function abrirModalNuevaGestion() {
    if (filasSeleccionadas.length === 0) { alert('Selecciona al menos una solicitud primero'); return; }
    var informe = generarInformeSeleccionadas();
    var opcionesTipoGestionModal = '';
    ['Seguimiento', 'Cobranza', 'Llamada', 'WhatsApp', 'Reclamo', 'Cita', 'Otro'].forEach(function(tipo) {
        opcionesTipoGestionModal += '<option value="' + tipo + '">' + tipo + '</option>';
    });
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
    var btn = document.querySelector('button[onclick="crearGestionLote()"]');
    if (btn) { btn.textContent = '⏳ Creando...'; btn.disabled = true; }
    try {
        var response = await fetch('/api/gestiones-maestro', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nombre: nombre, descripcion: descripcion, fecha_limite: fecha_limite || null, solicitudes_ids: filasSeleccionadas })
        });
        var resultado = await response.json();
        if (response.ok && resultado && resultado.id) {
            alert('Gestión creada correctamente');
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
    if (filasSeleccionadas.length === 0) { alert('Selecciona al menos una solicitud primero'); return; }
    var contenido = '';
    contenido += '<div style="padding: 24px; max-width: 600px; margin: 0 auto;"><div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 18px;">';
    contenido += '<h2 style="margin: 0; color: #1f2937; font-size: 20px;">➕ Agregar a Campaña</h2>';
    contenido += '<span style="background: #e0e7ff; color: #3730a3; padding: 6px 14px; border-radius: 20px; font-size: 13px; font-weight: 600;">' + filasSeleccionadas.length + ' solicitudes</span></div>';
    contenido += '<div id="campanas-list" style="text-align: center; padding: 40px; color: #6b7280;">⏳ Cargando campañas...</div>';
    contenido += '<div style="display: flex; gap: 10px; justify-content: flex-end; padding-top: 14px; margin-top: 16px; border-top: 2px solid #e5e7eb;">';
    contenido += '<button onclick="cerrarModal()" class="btn-modal-cancelar">Cancelar</button></div></div>';
    crearModal(contenido);
    try {
        var response = await fetch('/api/gestiones-maestro', { credentials: 'include' });
        if (!response.ok) throw new Error('Error al cargar campañas');
        var campanas = await response.json();
        renderizarListaCampanas(campanas);
    } catch (error) {
        console.error('Error cargando campañas:', error);
        var listContainer = document.getElementById('campanas-list');
        if (listContainer) listContainer.innerHTML = '<div style="color: #dc2626;">❌ Error al cargar campañas</div>';
    }
}

function renderizarListaCampanas(campanas) {
    var container = document.getElementById('campanas-list');
    if (!container) return;
    if (!campanas || campanas.length === 0) {
        container.innerHTML = '<div style="text-align: center; padding: 40px; color: #6b7280;">📭 No hay campañas creadas aún.<br><br><button onclick="cerrarModal(); abrirModalNuevaGestion()" style="padding: 10px 20px; background: #2563eb; color: white; border: none; border-radius: 8px; font-weight: 600; cursor: pointer;">🚀 Crear nueva campaña</button></div>';
        return;
    }
    var html = '<div style="max-height: 400px; overflow-y: auto; display: flex; flex-direction: column; gap: 8px;">';
    for (var i = 0; i < campanas.length; i++) {
        var c = campanas[i];
        var gestionadas = parseInt(c.gestionadas || 0);
        var total = parseInt(c.total_solicitudes || 0);
        var progreso = total > 0 ? Math.round((gestionadas / total) * 100) : 0;
        var estadoColor = '#6b7280', estadoBg = '#f3f4f6';
        if (c.estado === 'activa') { estadoColor = '#065f46'; estadoBg = '#dcfce7'; }
        else if (c.estado === 'completada') { estadoColor = '#1e40af'; estadoBg = '#dbeafe'; }
        else if (c.estado === 'pausada') { estadoColor = '#92400e'; estadoBg = '#fef3c7'; }
        html += '<div class="campana-item-select" data-id="' + c.id + '" style="background: #f8fafc; border: 2px solid #e5e7eb; border-radius: 10px; padding: 14px; cursor: pointer; transition: all 0.2s ease;" onclick="seleccionarCampana(this, \'' + c.id + '\')">';
        html += '<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;"><span style="font-weight: 600; font-size: 14px; color: #1f2937;">' + (c.nombre || 'Sin nombre') + '</span>';
        html += '<span style="background: ' + estadoBg + '; color: ' + estadoColor + '; padding: 3px 10px; border-radius: 12px; font-size: 11px; font-weight: 600;">' + (c.estado || '—') + '</span></div>';
        html += '<div style="display: flex; gap: 15px; font-size: 12px; color: #6b7280;"><span>📋 ' + total + ' solicitudes</span><span>✅ ' + gestionadas + ' gestionadas</span><span>📊 ' + progreso + '%</span></div></div>';
    }
    html += '</div><div style="margin-top: 12px; text-align: center;">';
    html += '<button id="btn-confirmar-agregar" onclick="confirmarAgregarACampana()" disabled style="padding: 12px 30px; background: #9ca3af; color: white; border: none; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: not-allowed; transition: all 0.2s ease;">Selecciona una campaña</button></div>';
    container.innerHTML = html;
    var items = container.querySelectorAll('.campana-item-select');
    for (var j = 0; j < items.length; j++) {
        items[j].addEventListener('mouseenter', function() { if (!this.classList.contains('seleccionada')) { this.style.borderColor = '#93c5fd'; this.style.background = '#f0f5ff'; } });
        items[j].addEventListener('mouseleave', function() { if (!this.classList.contains('seleccionada')) { this.style.borderColor = '#e5e7eb'; this.style.background = '#f8fafc'; } });
    }
}

function seleccionarCampana(elemento, id) {
    var items = document.querySelectorAll('.campana-item-select');
    for (var i = 0; i < items.length; i++) { items[i].classList.remove('seleccionada'); items[i].style.borderColor = '#e5e7eb'; items[i].style.background = '#f8fafc'; }
    elemento.classList.add('seleccionada'); elemento.style.borderColor = '#2563eb'; elemento.style.background = '#eff6ff';
    campanaSeleccionadaId = id;
    var btn = document.getElementById('btn-confirmar-agregar');
    if (btn) { btn.disabled = false; btn.style.background = '#2563eb'; btn.style.cursor = 'pointer'; btn.textContent = '➕ Agregar a esta campaña'; }
}

async function confirmarAgregarACampana() {
    if (!campanaSeleccionadaId) { alert('Selecciona una campaña primero'); return; }
    if (filasSeleccionadas.length === 0) { alert('No hay solicitudes seleccionadas'); return; }
    var btn = document.getElementById('btn-confirmar-agregar');
    if (btn) { btn.textContent = '⏳ Agregando...'; btn.disabled = true; }
    try {
        var response = await fetch('/api/gestiones-maestro/' + campanaSeleccionadaId + '/agregar-solicitudes', {
            method: 'PUT', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
            body: JSON.stringify({ solicitudes_ids: filasSeleccionadas })
        });
        var resultado = await response.json();
        if (response.ok) { alert('✅ ' + (resultado.mensaje || 'Solicitudes agregadas correctamente')); cerrarModal(); window.location.href = '/gestion-lote?id=' + campanaSeleccionadaId; }
        else { alert('Error: ' + (resultado.error || 'Error desconocido')); if (btn) { btn.textContent = '➕ Agregar a esta campaña'; btn.disabled = false; } }
    } catch (error) { console.error('Error agregando a campaña:', error); alert('Error al agregar solicitudes: ' + error.message); if (btn) { btn.textContent = '➕ Agregar a esta campaña'; btn.disabled = false; } }
}

// ============================================================================
// EXPORTAR A EXCEL
// ============================================================================
function exportarExcel() {
    if (filasSeleccionadas.length === 0) { alert('Selecciona al menos una fila primero'); return; }
    var datosAExportar = [];
    filasSeleccionadas.forEach(function(id) {
        var datos = datosFilas[id];
        if (datos) datosAExportar.push({ 'Solicitud': datos.id_solicitud, 'Estado': datos.estado, 'Cédula': datos.cedula, 'Nombre': datos.nombre, 'Celular': datos.celular, 'Código Plus': datos.codigo_plus, 'Segmento': datos.segmento, 'Producto': datos.producto, 'Fecha Solicitud': datos.fecha_solicitud });
    });
    if (datosAExportar.length === 0) { alert('No hay datos para exportar'); return; }
    var wb = XLSX.utils.book_new(); var ws = XLSX.utils.json_to_sheet(datosAExportar);
    ws['!cols'] = [{wch:10},{wch:15},{wch:12},{wch:30},{wch:12},{wch:15},{wch:15},{wch:20},{wch:15}];
    XLSX.utils.book_append_sheet(wb, ws, 'Solicitudes');
    XLSX.writeFile(wb, 'solicitudes_seleccionadas_' + getFechaHoraActual().replace(/[\s:]/g, '-') + '.xlsx');
    alert('Se exportaron ' + datosAExportar.length + ' registros a Excel');
}

function obtenerFilasSeleccionadas() { return filasSeleccionadas; }
function escaparParaAtributo(texto) { return String(texto || '').replace(/\\/g, '\\\\\\\\').replace(/'/g, "\\'"); }

function copiarNombreCedula(nombre, cedula) {
    var texto = '';
    if (nombre && cedula) texto = nombre + ' - ' + cedula;
    else if (nombre) texto = nombre;
    else if (cedula) texto = cedula;
    else { alert('No hay datos para copiar'); return; }
    navigator.clipboard.writeText(texto).then(function() { alert('Copiado: ' + texto); }).catch(function(err) { console.error('Error al copiar:', err); alert('Error al copiar al portapapeles'); });
}

function abrirWhatsAppChatEscritorio(celular) {
    if (!celular) { alert('No hay número de celular'); return; }
    var numeroLimpio = celular.replace(/\D/g, '');
    if (!numeroLimpio.startsWith('593') && numeroLimpio.length <= 10) numeroLimpio = '593' + numeroLimpio;
    window.open('https://wa.me/' + numeroLimpio, '_blank');
}

function formatearWhatsApp(celular) {
    if (!celular) return '';
    var numeroLimpio = celular.replace(/\D/g, '');
    if (!numeroLimpio.startsWith('593') && numeroLimpio.length <= 10) numeroLimpio = '593' + numeroLimpio;
    return numeroLimpio;
}

function enviarWhatsApp() {
    if (filasSeleccionadas.length === 0) { alert('Selecciona al menos una fila primero'); return; }
    var mensaje = 'Hola, te comparto los datos de las solicitudes:\n\n';
    filasSeleccionadas.forEach(function(id) {
        var datos = datosFilas[id];
        if (datos) mensaje += '📋 Solicitud: ' + datos.id_solicitud + '\n👤 Nombre: ' + datos.nombre + '\n📱 Cédula: ' + datos.cedula + '\n📞 Celular: ' + datos.celular + '\n-------------------\n';
    });
    window.open('https://wa.me/?text=' + encodeURIComponent(mensaje), '_blank');
}

function copiarDatos() {
    if (filasSeleccionadas.length === 0) { alert('Selecciona al menos una fila primero'); return; }
    var texto = '';
    filasSeleccionadas.forEach(function(id) {
        var datos = datosFilas[id];
        if (datos) texto += datos.celular + ' - ' + datos.nombre + ' - ' + datos.cedula + '\n';
    });
    navigator.clipboard.writeText(texto).then(function() { alert('Datos copiados al portapapeles: ' + texto); }).catch(function(err) { console.error('Error al copiar:', err); alert('Error al copiar datos'); });
}

// ============================================================================
// RENDERIZAR CARDS (5 FILAS) - ESTRUCTURA UNIFICADA
// ============================================================================
function renderizarCards(datos) {
    var container = document.getElementById('cards-container');
    if (!container) return;
    if (!datos || !datos.length) {
        container.innerHTML = '<div class="estado-vacio"><div class="vacio-icon">📋</div>No se encontraron registros</div>';
        return;
    }
    var html = '';
    var coloresEstado = { 'ACTIVADA': '#dcfce7', 'RECHAZADA': '#fee2e2', 'DEVUELTA': '#fef3c7', 'APROBADA PARA LIBERACIÓN': '#d1fae5' };
    var coloresGestion = { 'Seguimiento': '#dbeafe', 'Cobranza': '#fee2e2', 'Llamada': '#d1fae5', 'WhatsApp': '#dcfce7', 'Reclamo': '#fef3c7', 'Cita': '#e0e7ff', 'Completada': '#bbf7d0', 'Otro': '#f3f4f6' };

    for (var i = 0; i < datos.length; i++) {
        var item = datos[i];
        var id = item.id_solicitud || '';
        var seleccionado = filasSeleccionadas.indexOf(id) > -1 ? 'seleccionada' : '';
        var estadoClase = 'estado-' + (item.estado || '').replace(/\s+/g, '').toUpperCase();
        var colorEstado = coloresEstado[item.estado] || '#f3f4f6';

        html += '<div class="solicitud-card ' + seleccionado + '" data-id="' + id + '">';
        // FILA 1: Checkbox + ID + Segmento + Estado (con flex wrap controlado)
        html += '  <div class="card-fila-1">';
        html += '    <div class="card-checkbox-wrapper"><input type="checkbox" class="card-checkbox checkbox-fila" value="' + id + '" ' + (seleccionado ? 'checked' : '') + '></div>';
        html += '    <span class="card-id">#' + id + '</span>';
        html += '    <span class="card-badge badge-segmento">' + (item.segmento || 'Sin segmento') + '</span>';
        html += '    <span class="card-badge badge-estado ' + estadoClase + '" style="background:' + colorEstado + ';">' + (item.estado || 'Sin estado') + '</span>';
        html += '  </div>';
        // FILA 2: Nombre
        html += '  <div class="card-fila-2" onclick="copiarNombreCedula(\'' + escaparParaAtributo(item.nombre || '') + '\', \'' + escaparParaAtributo(item.cedula || '') + '\')" title="Copiar nombre + cédula">' + (item.nombre || 'Sin nombre') + ' 📋</div>';
        // FILA 3: Botones
        html += '  <div class="card-fila-3">';
        html += '    <button class="card-btn btn-gestiones" onclick="event.stopPropagation(); abrirGestiones(\'' + id + '\')">📋 Gestiones</button>';
        html += '    <button class="card-btn btn-whatsapp" onclick="event.stopPropagation(); abrirWhatsAppChatEscritorio(\'' + escaparParaAtributo(item.celular || '') + '\')">💬 WhatsApp</button>';
        html += '    <button class="card-btn btn-completar" onclick="event.stopPropagation(); abrirCompletar(\'' + id + '\')">✏️ Completar</button>';
        html += '    <button class="card-btn btn-llamar" onclick="event.stopPropagation(); llamarCliente(\'' + escaparParaAtributo(item.celular || '') + '\')">📞 Llamar</button>';
        html += '  </div>';
        // FILA 4: Seguimiento
        if (item.ultima_gestion_tipo) {
            var colorGestion = coloresGestion[item.ultima_gestion_tipo] || '#f3f4f6';
            var fechaGestion = item.ultima_gestion_fecha ? new Date(item.ultima_gestion_fecha).toLocaleString('es-ES') : '';
            html += '  <div class="card-fila-4"><div class="seguimiento-header"><span class="seguimiento-badge" style="background:' + colorGestion + ';">📋 ' + item.ultima_gestion_tipo + '</span>';
            if (fechaGestion) html += '<span class="seguimiento-fecha">' + fechaGestion + '</span>';
            html += '</div>';
            if (item.ultima_gestion_obs) html += '<div class="seguimiento-obs" title="' + escaparParaAtributo(item.ultima_gestion_obs) + '">' + item.ultima_gestion_obs + '</div>';
            html += '</div>';
        } else { html += '  <div class="card-fila-4 vacia">Sin gestiones</div>'; }
        // FILA 5: Producto + Fecha
        html += '  <div class="card-fila-5">';
        html += '    <span class="card-tag">📦 <span>' + (item.producto || '—') + '</span></span>';
        html += '    <span class="card-tag">📅 <span>' + (item.fecha_solicitud || '—') + '</span></span>';
        html += '  </div>';
        html += '</div>';
    }
    container.innerHTML = html;
}

// ============================================================================
// CARGA DE TOTALES, ESTADOS, SEGMENTOS
// ============================================================================
async function cargarTotales() {
    try {
        var response = await fetch('/api/excel/dashboard');
        var datos = await response.json();
        var totalEl = document.getElementById('totalRegistros');
        if (totalEl) totalEl.textContent = datos.total;
        return datos;
    } catch (error) { console.error('[Solicitudes] Error cargando totales:', error); }
}

async function cargarSegmentos() {
    try {
        var response = await fetch('/api/excel/dashboard/segmentos');
        var datos = await response.json();
        var container = document.getElementById('filtro-segmento');
        if (!container) return;
        container.innerHTML = '<button class="filter-btn active" data-value="">Todos</button>';
        for (var i = 0; i < datos.length; i++) {
            var seg = datos[i];
            var btn = document.createElement('button'); btn.className = 'filter-btn'; btn.dataset.value = seg.segmento; btn.textContent = seg.segmento;
            container.appendChild(btn);
        }
        configurarEventosBotones();
        restaurarFiltrosUI();
    } catch (error) { console.error('[Solicitudes] Error cargando segmentos:', error); }
}

async function cargarEstados() {
    try {
        var response = await fetch('/api/excel/dashboard/estados');
        var datos = await response.json();
        var container = document.getElementById('filtro-estado');
        if (!container) return;
        container.innerHTML = '<button class="filter-btn active" data-value="">Todos</button>';
        var map = { 'ACTIVADA': 'ACTIVADA', 'RECHAZADA': 'RECHAZADA', 'DEVUELTA': 'DEVUELTA', 'APROBADA PARA LIBERACIÓN': 'APROBADA' };
        for (var i = 0; i < datos.length; i++) {
            var est = datos[i];
            var btn = document.createElement('button'); btn.className = 'filter-btn'; btn.dataset.value = est.estado; btn.textContent = map[est.estado] || est.estado;
            container.appendChild(btn);
        }
        configurarEventosBotones();
        restaurarFiltrosUI();
    } catch (error) { console.error('[Solicitudes] Error cargando estados:', error); }
}

function configurarEventosBotones() {
    var botonesEstado = document.querySelectorAll('#filtro-estado .filter-btn');
    for (var i = 0; i < botonesEstado.length; i++) {
        botonesEstado[i].onclick = function() {
            document.querySelectorAll('#filtro-estado .filter-btn').forEach(function(b) { b.classList.remove('active'); });
            this.classList.add('active');
            estadoActual = this.dataset.value;
            persistirEstado();
            buscarEnServidor(true);
        };
    }
    var botonesSegmento = document.querySelectorAll('#filtro-segmento .filter-btn');
    for (var i = 0; i < botonesSegmento.length; i++) {
        botonesSegmento[i].onclick = function() {
            document.querySelectorAll('#filtro-segmento .filter-btn').forEach(function(b) { b.classList.remove('active'); });
            this.classList.add('active');
            segmentoActual = this.dataset.value;
            persistirEstado();
            buscarEnServidor(true);
        };
    }
}

function restaurarFiltrosUI() {
    if (estadoActual) {
        document.querySelectorAll('#filtro-estado .filter-btn').forEach(function(b) { b.classList.remove('active'); if (b.dataset.value === estadoActual) b.classList.add('active'); });
    }
    if (segmentoActual) {
        document.querySelectorAll('#filtro-segmento .filter-btn').forEach(function(b) { b.classList.remove('active'); if (b.dataset.value === segmentoActual) b.classList.add('active'); });
    }
}

function ordenarPorColumna(columna) {
    if (columna === 'id_solicitud') columna = 'id';
    else if (columna === 'fecha_solicitud') columna = 'fecha_solicitud';
    if (columnaOrdenar === columna) { ordenActual = ordenActual === 'ASC' ? 'DESC' : 'ASC'; }
    else { columnaOrdenar = columna; ordenActual = 'ASC'; }
}

function aplicarFiltros() {
    var inputBusqueda = document.getElementById('cedula');
    var busqueda = inputBusqueda ? inputBusqueda.value.toLowerCase() : '';
    var filtrados = todosDatos.filter(function(d) {
        if (estadoActual && d.estado !== estadoActual) return false;
        if (segmentoActual && d.segmento !== segmentoActual) return false;
        if (busqueda) {
            if (!((d.cedula && d.cedula.toString().toLowerCase().includes(busqueda)) || (d.nombre && d.nombre.toLowerCase().includes(busqueda)) || (d.celular && d.celular.toString().includes(busqueda)))) return false;
        }
        return true;
    });
    document.getElementById('mostrando').textContent = filtrados.length;
    renderizarCards(filtrados);
}

// ============================================================================
// MODALES, GESTIONES, COMPLETAR
// ============================================================================
var opcionesTipoGestion = ['Seguimiento', 'Cobranza', 'Llamada', 'WhatsApp', 'Reclamo', 'Cita', 'Otro'];

function getFechaHoraActual() {
    var ahora = new Date();
    return String(ahora.getDate()).padStart(2, '0') + '/' + String(ahora.getMonth() + 1).padStart(2, '0') + '/' + ahora.getFullYear() + ' ' +
           String(ahora.getHours()).padStart(2, '0') + ':' + String(ahora.getMinutes()).padStart(2, '0') + ':' + String(ahora.getSeconds()).padStart(2, '0');
}

function formatFechaGestion(fecha) {
    if (!fecha) return '';
    var d = new Date(fecha);
    return String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0') + '/' + d.getFullYear() + ' ' +
           String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
}

function abrirGestiones(id) {
    var datos = datosFilas[id];
    if (!datos) { alert('No se encontraron datos para esta solicitud'); return; }
    var opcionesDropdown = '';
    for (var i = 0; i < opcionesTipoGestion.length; i++) opcionesDropdown += '<option value="' + opcionesTipoGestion[i] + '">' + opcionesTipoGestion[i] + '</option>';
    var contenido = '';
    contenido += '<div class="gestion-header"><h2>📋 Gestiones - Solicitud #' + id + '</h2><button class="btn-cerrar" onclick="cerrarModal()">✕</button></div>';
    contenido += '<div class="gestion-layout">';
    contenido += '<div class="info-cliente"><h3>👤 Información del Cliente</h3><div class="info-grid">';
    contenido += '<div class="info-item"><span class="info-label">Nombre</span><span class="info-value">' + (datos.nombre || 'N/A') + '</span></div>';
    contenido += '<div class="info-item"><span class="info-label">Cédula</span><span class="info-value">' + (datos.cedula || 'N/A') + '</span></div>';
    contenido += '<div class="info-item"><span class="info-label">Celular</span><span class="info-value">' + (datos.celular || 'N/A') + '</span></div>';
    contenido += '<div class="info-item"><span class="info-label">Estado</span><span class="info-value estado-badge">' + (datos.estado || 'N/A') + '</span></div>';
    contenido += '<div class="info-item"><span class="info-label">Segmento</span><span class="info-value">' + (datos.segmento || 'N/A') + '</span></div>';
    contenido += '<div class="info-item"><span class="info-label">Producto</span><span class="info-value">' + (datos.producto || 'N/A') + '</span></div></div></div>';
    contenido += '<div class="nueva-gestion"><h3>➕ Nueva Gestión</h3>';
    contenido += '<div class="form-group"><label>📅 Fecha y Hora</label><input type="text" id="fecha-gestion" value="' + getFechaHoraActual() + '" readonly class="input-readonly"></div>';
    contenido += '<div class="form-group"><label>📋 Tipo de Gestión</label><select id="tipo-gestion" class="input-select">' + opcionesDropdown + '</select></div>';
    contenido += '<div class="form-group"><label>📝 Observación</label><textarea id="observacion-gestion" rows="5" class="input-textarea" placeholder="Escriba su observación aquí..."></textarea></div>';
    contenido += '<button onclick="guardarGestion(\'' + id + '\')" class="btn-guardar">💾 Guardar Gestión</button></div>';
    contenido += '<div class="gestion-derecha"><h3>📜 Historial de Gestiones</h3><div id="lista-historial" class="historial-container">Cargando...</div></div>';
    contenido += '</div>';
    crearModal(contenido);
    cargarHistorialGestiones(id);
}

function abrirCompletar(id) {
    var datos = datosFilas[id];
    if (!datos) { alert('No se encontraron datos para esta solicitud'); return; }
    fetch('/api/excel/solicitudes/' + id + '/completa').then(function(res) { return res.json(); }).then(function(data) {
        var d = data;
        var refs = data.referencias || [];
        var contenido = '';
        contenido += '<div class="completar-container">';
        contenido += '<div class="completar-header"><h2>✏️ Completar Información <span class="completar-id">#' + id + '</span></h2><button class="btn-cerrar" onclick="cerrarModal()">✕</button></div>';
        contenido += '<div class="completar-body">';
        contenido += '<div class="completar-col completar-col-info"><h3>👤 Información del Cliente</h3><div class="completar-info-grid">';
        contenido += '<div class="completar-info-item"><span class="info-label">Solicitud</span><span class="info-value">#' + id + '</span></div>';
        contenido += '<div class="completar-info-item"><span class="info-label">Nombre</span><span class="info-value">' + (datos.nombre || 'N/A') + '</span></div>';
        contenido += '<div class="completar-info-item"><span class="info-label">Cédula</span><span class="info-value">' + (datos.cedula || 'N/A') + '</span></div>';
        contenido += '<div class="completar-info-item"><span class="info-label">Celular</span><span class="info-value">' + (datos.celular || 'N/A') + '</span></div>';
        contenido += '<div class="completar-info-item"><span class="info-label">Estado</span><span class="info-value">' + (datos.estado || 'N/A') + '</span></div>';
        contenido += '<div class="completar-info-item"><span class="info-label">Segmento</span><span class="info-value">' + (datos.segmento || 'N/A') + '</span></div>';
        contenido += '<div class="completar-info-item"><span class="info-label">Producto</span><span class="info-value">' + (datos.producto || 'N/A') + '</span></div></div></div>';
        contenido += '<div class="completar-col completar-col-datos"><h3>📋 Datos Personales</h3><div class="completar-scroll">';
        contenido += '<div class="completar-field"><label for="codigo-plus-completar">🔢 Código Plus</label><input type="text" id="codigo-plus-completar" value="' + (d.codigo_plus || '') + '" placeholder="Código Plus"></div>';
        contenido += '<div class="completar-field"><label for="direccion-completar">📍 Dirección</label><input type="text" id="direccion-completar" value="' + (d.direccion || '') + '" placeholder="Dirección domiciliaria"></div>';
        contenido += '<div class="completar-field"><label for="direccion-trabajo-completar">🏢 Dirección de Trabajo</label><input type="text" id="direccion-trabajo-completar" value="' + (d.direccion_trabajo || '') + '" placeholder="Dirección de trabajo"></div>';
        contenido += '<div class="completar-field"><label for="ocupacion-completar">💼 Ocupación</label><input type="text" id="ocupacion-completar" value="' + (d.ocupacion || '') + '" placeholder="Ej: Comerciante"></div>';
        contenido += '<div class="completar-field"><label for="correo-completar">📧 Correo Electrónico</label><input type="email" id="correo-completar" value="' + (d.correo_electronico || '') + '" placeholder="cliente@ejemplo.com"></div>';
        contenido += '<div class="completar-field"><label for="ingreso-mensual-completar">💰 Ingreso Mensual</label><input type="number" id="ingreso-mensual-completar" value="' + (d.ingreso_mensual || '') + '" step="0.01" min="0" placeholder="0.00"></div></div></div>';
        contenido += '<div class="completar-col completar-col-refs"><h3>👥 Referencias</h3>';
        for (var i = 1; i <= 3; i++) {
            var ref = refs[i - 1] || {};
            contenido += '<div class="completar-ref-card"><div class="completar-ref-title">Referencia #' + i + '</div><div class="completar-ref-grid">';
            contenido += '<input type="text" id="ref-' + i + '-nombre" value="' + (ref.nombre || '') + '" placeholder="Nombre y Apellido">';
            contenido += '<input type="text" id="ref-' + i + '-telefono" value="' + (ref.telefono || '') + '" placeholder="Teléfono">';
            contenido += '<input type="text" id="ref-' + i + '-relacion" value="' + (ref.relacion || '') + '" placeholder="Relación (amigo/familiar)"></div></div>';
        }
        contenido += '</div></div>';
        contenido += '<div class="completar-footer"><button onclick="cerrarModal()" class="btn-modal-cancelar">Cancelar</button><button onclick="guardarCompletar(\'' + id + '\')" class="btn-modal-crear">💾 Guardar Cambios</button></div></div>';
        crearModal(contenido);
    }).catch(function(err) { console.error('Error cargando datos completos:', err); alert('Error al cargar datos. Intente de nuevo.'); });
}

function crearModal(contenido) {
    var modalExistente = document.getElementById('modal-generico');
    if (modalExistente) modalExistente.remove();
    var overlay = document.createElement('div'); overlay.id = 'modal-generico'; overlay.className = 'modal-overlay';
    var modal = document.createElement('div'); modal.className = 'modal-content'; modal.innerHTML = contenido;
    overlay.onclick = function(e) { if (e.target === overlay) cerrarModal(); };
    overlay.appendChild(modal); document.body.appendChild(overlay);
}

function cerrarModal() {
    var modal = document.getElementById('modal-generico');
    if (modal) modal.remove();
}

async function cargarHistorialGestiones(id) {
    var container = document.getElementById('lista-historial');
    if (!container) return;
    container.innerHTML = '<div style="padding:15px;text-align:center;color:#6b7280;">Cargando gestiones...</div>';
    try {
        var response = await fetch('/api/excel/gestiones/' + id);
        if (!response.ok) { container.innerHTML = '<div style="color: red;">Error al cargar historial</div>'; return; }
        var gestiones = await response.json();
        if (!gestiones || gestiones.length === 0) { container.innerHTML = '<div style="padding: 15px; text-align: center; color: #6b7280; background: #f9fafb; border-radius: 8px;">No hay gestiones registradas</div>'; return; }
        var html = '';
        var coloresTipo = { 'Seguimiento': '#dbeafe', 'Cobranza': '#fee2e2', 'Llamada': '#d1fae5', 'WhatsApp': '#dcfce7', 'Reclamo': '#fef3c7', 'Cita': '#e0e7ff', 'Otro': '#f3f4f6' };
        for (var i = 0; i < gestiones.length; i++) {
            var g = gestiones[i];
            var color = coloresTipo[g.tipo_gestion] || '#f3f4f6';
            html += '<div style="background: ' + color + '; padding: 12px; border-radius: 8px; margin-bottom: 10px;">';
            html += '<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">';
            html += '<span style="font-weight: 600; font-size: 13px; color: #1f2937;">📋 ' + (g.tipo_gestion || '') + '</span>';
            html += '<span style="font-size: 11px; color: #6b7280;">' + formatFechaGestion(g.fecha_gestion) + '</span></div>';
            if (g.observacion) html += '<div style="font-size: 13px; color: #374151; line-height: 1.4; margin-bottom: 8px;">' + g.observacion + '</div>';
            html += '<div style="display: flex; gap: 8px; justify-content: flex-end;">';
            html += '<button onclick="editarGestion(\'' + g.id + '\', \'' + id + '\')" style="padding: 4px 10px; background: #2563eb; color: white; border: none; border-radius: 4px; font-size: 11px; cursor: pointer;">✏️ Editar</button>';
            html += '<button onclick="confirmarEliminarGestion(\'' + g.id + '\', \'' + id + '\')" style="padding: 4px 10px; background: #dc2626; color: white; border: none; border-radius: 4px; font-size: 11px; cursor: pointer;">🗑️ Eliminar</button></div></div>';
        }
        container.innerHTML = html;
    } catch (error) { console.error('Error cargando historial:', error); container.innerHTML = '<div style="color: red;">Error al cargar historial</div>'; }
}

function editarGestion(gestionId, solicitudId) {
    fetch('/api/excel/gestiones/' + solicitudId).then(function(res) { return res.json(); }).then(function(gestiones) {
        var gestion = gestiones.find(function(g) { return g.id == gestionId; });
        if (!gestion) { alert('Gestión no encontrada'); return; }
        var opcionesDropdown = '';
        for (var i = 0; i < opcionesTipoGestion.length; i++) {
            var selected = opcionesTipoGestion[i] === gestion.tipo_gestion ? 'selected' : '';
            opcionesDropdown += '<option value="' + opcionesTipoGestion[i] + '" ' + selected + '>' + opcionesTipoGestion[i] + '</option>';
        }
        var c = '';
        c += '<div style="padding: 20px;"><h2 style="margin-top: 0; color: #1f2937;">✏️ Editar Gestión</h2>';
        c += '<label style="display: block; font-weight: 600; margin-bottom: 4px; font-size: 13px;">📋 Tipo de Gestión:</label>';
        c += '<select id="tipo-gestion-editar" style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 6px; font-size: 14px; margin-bottom: 12px; background: white;">' + opcionesDropdown + '</select>';
        c += '<label style="display: block; font-weight: 600; margin-bottom: 4px; font-size: 13px;">📝 Observación:</label>';
        c += '<textarea id="observacion-editar" rows="4" style="width: 100%; padding: 12px; border: 1px solid #ddd; border-radius: 6px; font-size: 14px; resize: vertical; margin-bottom: 12px;">' + (gestion.observacion || '') + '</textarea>';
        c += '<div style="display: flex; gap: 10px; justify-content: flex-end;"><button onclick="cerrarModal()" style="padding: 10px 20px; background: #f3f4f6; border: none; border-radius: 8px; cursor: pointer;">Cancelar</button>';
        c += '<button onclick="guardarEdicionGestion(\'' + gestionId + '\', \'' + solicitudId + '\')" style="padding: 10px 20px; background: #2563eb; color: white; border: none; border-radius: 8px; cursor: pointer;">💾 Guardar</button></div></div>';
        crearModal(c);
    }).catch(function(err) { console.error('Error:', err); alert('Error al cargar gestión'); });
}

function guardarEdicionGestion(gestionId, solicitudId) {
    var tipo = document.getElementById('tipo-gestion-editar').value;
    var observacion = document.getElementById('observacion-editar').value.trim();
    if (!tipo) { alert('Por favor seleccione un tipo de gestión'); return; }
    fetch('/api/excel/gestiones/' + gestionId, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo_gestion: tipo, observacion: observacion })
    }).then(function(res) { return res.json(); }).then(function(resultado) {
        if (resultado && !resultado.error) { alert('Gestión actualizada correctamente'); cerrarModal(); cargarHistorialGestiones(solicitudId); }
        else { alert('Error: ' + (resultado.error || 'Error desconocido')); }
    }).catch(function(err) { console.error('Error:', err); alert('Error al guardar'); });
}

function confirmarEliminarGestion(gestionId, solicitudId) {
    if (!confirm('¿Está seguro de eliminar esta gestión?')) return;
    fetch('/api/excel/gestiones/' + gestionId, { method: 'DELETE' })
    .then(function(res) { return res.json(); }).then(function(resultado) {
        if (resultado && !resultado.error) { alert('Gestión eliminada correctamente'); cargarHistorialGestiones(solicitudId); }
        else { alert('Error: ' + (resultado.error || 'Error desconocido')); }
    }).catch(function(err) { console.error('Error:', err); alert('Error al eliminar'); });
}

function guardarGestion(id) {
    var tipo = document.getElementById('tipo-gestion');
    var observacion = document.getElementById('observacion-gestion');
    if (!tipo || !observacion) { alert('Error: No se encontraron los campos del formulario'); return; }
    if (!tipo.value) { alert('Por favor seleccione un tipo de gestión'); return; }
    if (!observacion.value.trim()) { alert('Por favor escriba una observación'); return; }
    var btn = document.querySelector('button[onclick="guardarGestion(\'' + id + '\')"]');
    if (btn) { btn.textContent = '💾 Guardando...'; btn.disabled = true; }
    fetch('/api/excel/gestiones', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ solicitud_id: id, tipo_gestion: tipo.value, observacion: observacion.value.trim() })
    }).then(function(res) { return res.json(); }).then(function(resultado) {
        if (resultado && !resultado.error) {
            cargarHistorialGestiones(id);
            document.getElementById('observacion-gestion').value = '';
            document.getElementById('tipo-gestion').selectedIndex = 0;
            document.getElementById('fecha-gestion').value = getFechaHoraActual();
            alert('Gestión guardada correctamente');
        } else { alert('Error: ' + (resultado.error || 'Error desconocido')); }
    }).catch(function(err) { console.error('Error guardando gestión:', err); alert('Error al guardar la gestión'); })
    .finally(function() { if (btn) { btn.textContent = '💾 Guardar Gestión'; btn.disabled = false; } });
}

function guardarCompletar(id) {
    var codigo_plus = document.getElementById('codigo-plus-completar').value.trim();
    var correo_electronico = document.getElementById('correo-completar').value.trim();
    var direccion = document.getElementById('direccion-completar').value.trim();
    var direccion_trabajo = document.getElementById('direccion-trabajo-completar').value.trim();
    var ocupacion = document.getElementById('ocupacion-completar').value.trim();
    var ingresoInput = document.getElementById('ingreso-mensual-completar').value.trim();
    var ingreso_mensual = ingresoInput ? parseFloat(ingresoInput) : null;
    var referencias = [];
    for (var i = 1; i <= 3; i++) {
        var nombre = document.getElementById('ref-' + i + '-nombre').value.trim();
        var telefono = document.getElementById('ref-' + i + '-telefono').value.trim();
        var relacion = document.getElementById('ref-' + i + '-relacion').value.trim();
        if (nombre || telefono || relacion) referencias.push({ nombre: nombre, telefono: telefono, relacion: relacion });
    }
    var btn = document.querySelector('button[onclick="guardarCompletar(\'' + id + '\')"]');
    if (btn) { btn.textContent = '⏳ Guardando...'; btn.disabled = true; }
    fetch('/api/excel/solicitudes/' + id + '/completar-info', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ codigo_plus: codigo_plus, correo_electronico: correo_electronico, direccion: direccion, direccion_trabajo: direccion_trabajo, ocupacion: ocupacion, ingreso_mensual: ingreso_mensual, referencias: referencias })
    }).then(function(response) { return response.json().then(function(data) {
        if (response.ok) { alert('Información guardada correctamente'); cerrarModal(); if (typeof init === 'function') init(); }
        else { alert('Error: ' + (data.error || 'Error al guardar')); }
    }); }).catch(function(err) { console.error('Error guardando:', err); alert('Error al guardar la información'); })
    .finally(function() { if (btn) { btn.textContent = '💾 Guardar'; btn.disabled = false; } });
}

function exportarSeleccionadas() {
    if (filasSeleccionadas.length === 0) { alert('Selecciona al menos una fila primero'); return; }
    var datosAExportar = [];
    filasSeleccionadas.forEach(function(id) {
        var datos = datosFilas[id];
        if (datos) datosAExportar.push({ 'Solicitud': datos.id_solicitud, 'Estado': datos.estado, 'Cédula': datos.cedula, 'Nombre': datos.nombre, 'Celular': datos.celular, 'Código Plus': datos.codigo_plus, 'Segmento': datos.segmento, 'Producto': datos.producto, 'Fecha Solicitud': datos.fecha_solicitud });
    });
    if (datosAExportar.length === 0) { alert('No hay datos para exportar'); return; }
    var csvContent = '\uFEFF'; var headers = Object.keys(datosAExportar[0]); csvContent += headers.join(',') + '\n';
    datosAExportar.forEach(function(row) {
        var values = headers.map(function(header) { var value = row[header] || ''; if (String(value).indexOf(',') > -1 || String(value).indexOf('"') > -1) value = '"' + String(value).replace(/"/g, '""') + '"'; return value; });
        csvContent += values.join(',') + '\n';
    });
    var blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    var link = document.createElement('a'); var url = URL.createObjectURL(blob);
    link.setAttribute('href', url); link.setAttribute('download', 'solicitudes_seleccionadas_' + getFechaHoraActual().replace(/[\s:]/g, '-') + '.csv');
    link.style.visibility = 'hidden'; document.body.appendChild(link); link.click(); document.body.removeChild(link);
    alert('Se exportaron ' + datosAExportar.length + ' registros');
}

function marcarSeleccionadas() {
    var checkboxes = document.querySelectorAll('.checkbox-fila');
    if (filasSeleccionadas.length === checkboxes.length) {
        checkboxes.forEach(function(cb) { cb.checked = false; var fila = cb.closest('tr') || cb.closest('.cliente-card'); if (fila) fila.classList.remove('fila-seleccionada'); });
        filasSeleccionadas = [];
    } else {
        filasSeleccionadas = [];
        checkboxes.forEach(function(cb) {
            cb.checked = true; var id = cb.value;
            if (filasSeleccionadas.indexOf(id) === -1) filasSeleccionadas.push(id);
            var fila = cb.closest('tr') || cb.closest('.cliente-card'); if (fila) fila.classList.add('fila-seleccionada');
        });
    }
    actualizarCheckboxes(); actualizarContador();
}

function limpiarFiltros() {
    document.getElementById('cedula').value = '';
    document.querySelectorAll('#filtro-estado .filter-btn').forEach(function(b) { b.classList.remove('active'); });
    if (document.querySelectorAll('#filtro-estado .filter-btn').length > 0) document.querySelectorAll('#filtro-estado .filter-btn')[0].classList.add('active');
    document.querySelectorAll('#filtro-segmento .filter-btn').forEach(function(b) { b.classList.remove('active'); });
    if (document.querySelectorAll('#filtro-segmento .filter-btn').length > 0) document.querySelectorAll('#filtro-segmento .filter-btn')[0].classList.add('active');
    estadoActual = ''; segmentoActual = '';
    persistirEstado();
    actualizarInfoPanel();
    init();
}

function actualizarInfoPanel() {
    var estadoInfo = document.querySelector('.resumen-texto strong:first-child');
    var segmentoInfo = document.querySelector('.resumen-texto strong:last-child');
    var ultimaActualizacion = document.getElementById('ultima-actualizacion');
    if (estadoInfo) estadoInfo.textContent = estadoActual || 'Todos';
    if (segmentoInfo) segmentoInfo.textContent = segmentoActual || 'Todos';
    if (ultimaActualizacion) ultimaActualizacion.textContent = getFechaHoraActual();
}

async function borrarTodas() {
    if (!confirm('¿Está seguro de BORRAR TODAS las solicitudes?\n\nEsta acción NO se puede deshacer.\n\nSe eliminarán todos los registros de la base de datos.')) return;
    if (!confirm('¿REALMENTE quiere eliminar TODAS las solicitudes?\n\nEsta acción es IRREVERSIBLE.')) return;
    try {
        var btn = document.querySelector('.btn-danger');
        if (btn) { btn.textContent = '🗑️ Eliminando...'; btn.disabled = true; }
        var response = await fetch('/api/excel/limpiar', { method: 'DELETE', credentials: 'include' });
        var resultado = await response.json();
        if (response.ok) {
            alert('✅ ' + resultado.mensaje + '\n\nSe eliminaron: ' + resultado.eliminadas + ' registros');
            cargarTotales(); cargarEstados(); cargarSegmentos(); init();
            filasSeleccionadas = []; datosFilas = {}; actualizarContador();
        } else { alert('❌ Error: ' + (resultado.error || 'Error desconocido')); }
    } catch (error) { console.error('Error al borrar:', error); alert('❌ Error al eliminar las solicitudes'); }
    finally { var btn = document.querySelector('.btn-danger'); if (btn) { btn.textContent = '🗑️ Borrar Todo'; btn.disabled = false; } }
}

// ============================================================================
// ACTUALIZAR CÓDIGO PLUS
// ============================================================================
var debounceCodigoPlus = {};

async function actualizarCodigoPlus(input) {
    var id = input.dataset.id;
    var codigo_plus = input.value.trim();
    if (debounceCodigoPlus[id]) clearTimeout(debounceCodigoPlus[id]);
    input.style.backgroundColor = '#fef3c7';
    debounceCodigoPlus[id] = setTimeout(async function() {
        try {
            var response = await fetch('/api/excel/solicitudes/' + id + '/codigo-plus', {
                method: 'PUT', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ codigo_plus: codigo_plus })
            });
            var resultado = await response.json();
            if (response.ok) { input.style.backgroundColor = '#dcfce7'; setTimeout(function() { input.style.backgroundColor = ''; }, 1000); }
            else { input.style.backgroundColor = '#fee2e2'; console.error('Error:', resultado.error); }
        } catch (error) { console.error('Error guardando código plus:', error); input.style.backgroundColor = '#fee2e2'; }
    }, 500);
}

function configurarEventosCodigoPlus() {
    var tabla = document.getElementById('tabla');
    if (!tabla) return;
    tabla.addEventListener('input', function(e) { if (e.target.classList.contains('input-codigo-plus')) actualizarCodigoPlus(e.target); });
    tabla.addEventListener('blur', function(e) {
        if (e.target.classList.contains('input-codigo-plus')) {
            var input = e.target; var id = input.dataset.id; var codigo_plus = input.value.trim();
            if (debounceCodigoPlus[id]) clearTimeout(debounceCodigoPlus[id]);
            fetch('/api/excel/solicitudes/' + id + '/codigo-plus', {
                method: 'PUT', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ codigo_plus: codigo_plus })
            }).then(function(r) { return r.json(); }).then(function(r) { if (r.ok) { input.style.backgroundColor = '#dcfce7'; setTimeout(function() { input.style.backgroundColor = ''; }, 1000); } }).catch(function(e) { console.error('Error:', e); });
        }
    });
}

function configurarEventosCheckboxes() {
    var checkboxTodos = document.getElementById('seleccionar-todos');
    if (checkboxTodos) checkboxTodos.onclick = function() { seleccionarTodos(); };
    var tabla = document.getElementById('tabla');
    if (tabla) tabla.onclick = function(e) { if (e.target.classList.contains('checkbox-fila')) toggleFilaCheckbox(e.target); };
    var btnWhatsApp = document.getElementById('btn-whatsapp');
    if (btnWhatsApp) btnWhatsApp.onclick = enviarWhatsApp;
    var btnCopy = document.getElementById('btn-copy');
    if (btnCopy) btnCopy.onclick = copiarDatos;
}

// ============================================================================
// EVENTOS DE INICIO
// ============================================================================
if (document.getElementById('cedula')) {
    document.getElementById('cedula').oninput = function() { buscarConDebounce(); };
}

var columnaOrdenar = 'id_solicitud';
var ordenActual = 'DESC';

document.addEventListener('change', function(e) {
    if (e.target.classList.contains('checkbox-fila') && e.target.closest('.cliente-card')) {
        var checkbox = e.target; var id = checkbox.value;
        if (checkbox.checked) { if (filasSeleccionadas.indexOf(id) === -1) filasSeleccionadas.push(id); checkbox.closest('.cliente-card').classList.add('fila-seleccionada'); }
        else { var index = filasSeleccionadas.indexOf(id); if (index > -1) filasSeleccionadas.splice(index, 1); checkbox.closest('.cliente-card').classList.remove('fila-seleccionada'); }
        actualizarContador();
    }
});

window.addEventListener('DOMContentLoaded', function() {
    var inputBusqueda = document.getElementById('cedula');
    if (inputBusqueda) setTimeout(function() { inputBusqueda.focus(); }, 100);
});

// Inicializar con carga paralela optimizada (UNA SOLA LLAMADA)
// init() maneja: cargarLoteInicial, cargarTotales, cargarEstados, cargarSegmentos
init();
configurarEventosCheckboxes();
configurarEventosCodigoPlus();
actualizarContador();
