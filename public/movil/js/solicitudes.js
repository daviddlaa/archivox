// ============================================================================
// SOLICITUDES MÓVIL - VERSIÓN OPTIMIZADA
// ============================================================================
// Mejoras: AbortController, cache, persistencia de filtros, carga paralela
// ============================================================================

console.log('[Solicitudes Móvil] Versión optimizada cargando...');

let todosDatos = [];
let datosFilas = {};
let filasSeleccionadas = [];
let idsVisibles = [];
let filtros = { estado: '', segmento: '', busqueda: '' };

// Toggle selección de card
function toggleCard(id) {
    const card = document.getElementById('card-' + id);
    if (!card) return;
    
    if (filasSeleccionadas.indexOf(id) === -1) {
        filasSeleccionadas.push(id);
        card.classList.add('seleccionada');
    } else {
        filasSeleccionadas = filasSeleccionadas.filter(f => f !== id);
        card.classList.remove('seleccionada');
    }
    
    actualizarContador();
}

function toggleSeleccionarTodasVisibles() {
    if (!idsVisibles.length) return;

    const todasSeleccionadas = idsVisibles.every(function(id) {
        return filasSeleccionadas.indexOf(id) !== -1;
    });

    idsVisibles.forEach(function(id) {
        const card = document.getElementById('card-' + id);
        if (!card) return;

        if (todasSeleccionadas) {
            filasSeleccionadas = filasSeleccionadas.filter(function(filaId) {
                return filaId !== id;
            });
            card.classList.remove('seleccionada');
        } else if (filasSeleccionadas.indexOf(id) === -1) {
            filasSeleccionadas.push(id);
            card.classList.add('seleccionada');
        }
    });

    actualizarContador();
}

function actualizarContador() {
    const contador = document.getElementById('seleccionadas-count');
    const actionBar = document.getElementById('mobile-action-bar');
    const actionBarCount = document.getElementById('action-bar-count');
    const btnSeleccionarTodo = document.getElementById('btn-seleccionar-todo');
    
    if (contador) contador.textContent = filasSeleccionadas.length;
    
    // Mostrar/ocultar la bottom action bar con animación
    if (actionBar && actionBarCount) {
        actionBarCount.textContent = filasSeleccionadas.length;
        if (filasSeleccionadas.length > 0) {
            // Show bar with slide-up animation
            actionBar.classList.remove('closing');
            actionBar.style.display = 'block';
            // Force reflow for animation
            void actionBar.offsetWidth;
            actionBar.classList.add('visible');
        } else {
            // Hide with closing animation
            actionBar.classList.remove('visible');
            actionBar.classList.add('closing');
            // Wait for animation to finish before hiding
            setTimeout(function() {
                if (filasSeleccionadas.length === 0) {
                    actionBar.style.display = 'none';
                    actionBar.classList.remove('closing');
                }
            }, 250);
        }
    }

    if (btnSeleccionarTodo) {
        if (!idsVisibles.length) {
            btnSeleccionarTodo.disabled = true;
            btnSeleccionarTodo.textContent = 'Seleccionar todo';
        } else {
            const todasSeleccionadas = idsVisibles.every(function(id) {
                return filasSeleccionadas.indexOf(id) !== -1;
            });
            btnSeleccionarTodo.disabled = false;
            btnSeleccionarTodo.textContent = todasSeleccionadas ? 'Deseleccionar todo' : 'Seleccionar todo';
        }
    }
}

// Cancelar selección en móvil - deselecciona todo
function cancelarSeleccionMovil() {
    // Remover clase de todas las cards seleccionadas
    document.querySelectorAll('.solicitud-card.seleccionada').forEach(function(card) {
        card.classList.remove('seleccionada');
    });
    // Limpiar array de selección
    filasSeleccionadas = [];
    actualizarContador();
}

function enviarWhatsApp() {
    if (filasSeleccionadas.length === 0) {
        alert('Selecciona al menos una card primero');
        return;
    }
    
    let mensaje = 'Hola, te comparto los datos de las solicitudes:\n\n';
    
    filasSeleccionadas.forEach(function(id) {
        var datos = datosFilas[id];
        if (datos) {
            mensaje += '📋 Solicitud: ' + datos.id_solicitud + '\n';
            mensaje += '👤 Nombre: ' + datos.nombre + '\n';
            mensaje += '📱 Cédula: ' + datos.cedula + '\n';
            mensaje += '📞 Celular: ' + datos.celular + '\n';
            mensaje += '-------------------\n';
        }
    });
    
    var urlWhatsApp = 'https://wa.me/?text=' + encodeURIComponent(mensaje);
    window.open(urlWhatsApp, '_blank');
}

function copiarDatos() {
    if (filasSeleccionadas.length === 0) {
        alert('Selecciona al menos una card primero');
        return;
    }
    
    let texto = '';
    
    filasSeleccionadas.forEach(function(id) {
        var datos = datosFilas[id];
        if (datos) {
            texto += datos.celular + ' - ' + datos.nombre + ' - ' + datos.cedula + '\n';
        }
    });
    
    navigator.clipboard.writeText(texto).then(function() {
        alert('Datos copiados al portapapeles: ' + texto);
    }).catch(function(err) {
        console.error('Error al copiar:', err);
        alert('Error al copiar datos');
    });
}

// ================== INFINITE SCROLL (COMO TIKTOK) ==================

// AbortController para cancelar peticiones duplicadas
let activeController = null;

// Cache simple en memoria (TTL 30s)
const queryCache = new Map();
const CACHE_TTL = 30000;

function getCacheKey(q, estado, segmento, offset) {
    return q + '|' + estado + '|' + segmento + '|' + offset;
}
function getFromCache(q, estado, segmento, offset) {
    const key = getCacheKey(q, estado, segmento, offset);
    const entry = queryCache.get(key);
    if (entry && Date.now() - entry.timestamp < CACHE_TTL) return entry.data;
    queryCache.delete(key);
    return null;
}
function setCache(q, estado, segmento, offset, data) {
    const key = getCacheKey(q, estado, segmento, offset);
    queryCache.set(key, { data: data, timestamp: Date.now() });
}

// Variables para infinite scroll
var currentOffset = 0;
var isLoading = false;
var hasMoreData = true;
var TAMANO_LOTE = 100;

// Inicializar infinite scroll
function initInfiniteScroll() {
    // Crear elemento sentinel para Intersection Observer
    var sentinel = document.getElementById('infinite-scroll-sentinel');
    if (!sentinel) {
        sentinel = document.createElement('div');
        sentinel.id = 'infinite-scroll-sentinel';
        sentinel.style.cssText = 'height: 60px; display: flex; align-items: center; justify-content: center; color: #6b7280; font-size: 14px; padding: 15px;';
        sentinel.innerHTML = '<span class="loader-text">📜 Scroll para cargar más...</span>';
        
        var container = document.getElementById('cards-container');
        if (container) {
            container.appendChild(sentinel);
        }
    }
    
    // Configurar Intersection Observer
    if ('IntersectionObserver' in window) {
        var observer = new IntersectionObserver(function(entries) {
            var entry = entries[0];
            if (entry.isIntersecting && hasMoreData && !isLoading) {
                cargarMas();
            }
        }, {
            rootMargin: '100px'
        });
        
        observer.observe(sentinel);
    }
}

// Cargar datos iniciales
async function init() {
    try {
        // resetear variables
        currentOffset = 0;
        todosDatos = [];
        
        await cargarLoteInicial();
        renderizarFiltros();
        
        // Inicializar infinite scroll
        initInfiniteScroll();
    } catch (e) {
        console.error('Error cargando:', e);
    }
}

// Cargar lote inicial de solicitudes (sin filtros)
async function cargarLoteInicial() {
    isLoading = true;
    try {
        var res = await fetch('/api/excel/solicitudes?limite=' + TAMANO_LOTE + '&offset=0');
        var result = await res.json();
        
        var nuevosDatos = Array.isArray(result) ? result : (result.data || []);
        var total = Array.isArray(result) ? result.length : (result.total || 0);
        
        todosDatos = nuevosDatos;
        currentOffset = nuevosDatos.length;
        hasMoreData = currentOffset < total;
        
        document.getElementById('totalRegistros').textContent = total;
        renderizarCards(todosDatos);
    } catch (error) {
        console.error('Error cargando lote inicial:', error);
    } finally {
        isLoading = false;
        recrearSentinel();
    }
}

// Cargar más datos (para infinite scroll)
async function cargarMas() {
    if (isLoading || !hasMoreData) return;
    
    isLoading = true;
    
    // Si hay filtros activos, usar búsqueda paginada
    if (busquedaActiva || filtros.estado || filtros.segmento) {
        await buscarEnServidor(false, currentOffset);
        isLoading = false;
        recrearSentinel();
        return;
    }
    
    await cargarMasSolicitudes();
}

// Cargar más solicitudes (sin filtros)
async function cargarMasSolicitudes() {
    if (isLoading || !hasMoreData) return;
    
    isLoading = true;
    
    var sentinel = document.getElementById('infinite-scroll-sentinel');
    if (sentinel) {
        sentinel.innerHTML = '<span class="loader-text">⏳ Cargando más...</span>';
    }
    
    try {
        var nuevoOffset = currentOffset;
        var res = await fetch('/api/excel/solicitudes?limite=' + TAMANO_LOTE + '&offset=' + nuevoOffset);
        var result = await res.json();
        
        var nuevosDatos = Array.isArray(result) ? result : (result.data || []);
        
        if (nuevosDatos.length > 0) {
            for (var i = 0; i < nuevosDatos.length; i++) {
                todosDatos.push(nuevosDatos[i]);
            }
            
            currentOffset += nuevosDatos.length;
            
            var total = Array.isArray(result) ? result.length : (result.total || 0);
            hasMoreData = currentOffset < total;
            
            aplicarFiltros();
            
            console.log('Más datos cargados:', nuevosDatos.length, 'total en memoria:', todosDatos.length);
        } else {
            hasMoreData = false;
        }
        
    } catch (error) {
        console.error('Error cargando más datos:', error);
    } finally {
        isLoading = false;
        
        if (sentinel) {
            if (hasMoreData) {
                sentinel.innerHTML = '<span class="loader-text">📜 Scroll para cargar más...</span>';
            } else {
                sentinel.innerHTML = '<span class="loader-text">✅ No hay más registros</span>';
            }
        }
    }
}



// Renderizar botones de filtros dinámicos
function renderizarFiltros() {
    // Estados
    const estados = [...new Set(todosDatos.map(d => d.estado).filter(Boolean))];
    const estadoBtns = document.getElementById('filtro-estado');
    estadoBtns.innerHTML = '<button class="filtro-btn active" data-value="">Todos</button>';
    estados.forEach(e => {
        estadoBtns.innerHTML += `<button class="filtro-btn" data-value="${e}">${e}</button>`;
    });
    
    // Segmentos
    const segmentos = [...new Set(todosDatos.map(d => d.segmento).filter(Boolean))];
    const segmentoBtns = document.getElementById('filtro-segmento');
    segmentoBtns.innerHTML = '<button class="filtro-btn active" data-value="">Todos</button>';
    segmentos.forEach(s => {
        segmentoBtns.innerHTML += `<button class="filtro-btn" data-value="${s}">${s}</button>`;
    });
    
    // Adjuntar eventos
    adjuntarEventos();
}

// ================== BÚSQUEDA EN SERVIDOR ==================
// Nueva implementación: buscar directamente en el servidor
var busquedaActiva = false;
var debounceBusqueda;

// ================== BÚSQUEDA UNIFICADA EN SERVIDOR ==================
// Función única para buscar y filtrar: mantiene paginación siempre activa

async function buscarEnServidor(resetOffset = false, extraOffset = null) {
    // Cancelar petición anterior
    if (activeController) activeController.abort();
    activeController = new AbortController();
    var signal = activeController.signal;

    try {
        var inputBusqueda = document.getElementById('cedula');
        var termino = inputBusqueda ? inputBusqueda.value.trim() : '';
        var tieneFiltros = !!(termino || filtros.estado || filtros.segmento);
        var nuevoOffset = (extraOffset !== null) ? extraOffset : (resetOffset ? 0 : currentOffset);
        
        // Verificar cache
        var cached = resetOffset ? getFromCache(termino, filtros.estado, filtros.segmento, 0) : null;
        if (cached) {
            todosDatos = cached;
            currentOffset = cached.length;
            hasMoreData = currentOffset < (cached.total || 0);
            document.getElementById('totalRegistros').textContent = cached.total || cached.length;
            document.getElementById('mostrando').textContent = cached.length;
            renderizarCards(cached);
            return;
        }
        
        if (tieneFiltros) {
            var url = '/api/excel/solicitudes/buscar?q=' + encodeURIComponent(termino || '%') + '&limite=' + TAMANO_LOTE + '&offset=' + nuevoOffset;
            if (filtros.estado) url += '&estado=' + encodeURIComponent(filtros.estado);
            if (filtros.segmento) url += '&segmento=' + encodeURIComponent(filtros.segmento);
            
            var response = await fetch(url, { signal: signal });
            var result = await response.json();
            var datosRecibidos = Array.isArray(result) ? result : (result.data || []);
            var total = Array.isArray(result) ? result.length : (result.total || 0);
            
            if (resetOffset) {
                todosDatos = datosRecibidos;
                currentOffset = datosRecibidos.length;
                datosRecibidos.total = total;
                setCache(termino, filtros.estado, filtros.segmento, 0, datosRecibidos);
            } else {
                for (var i = 0; i < datosRecibidos.length; i++) todosDatos.push(datosRecibidos[i]);
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
        
        console.log('Búsqueda/filtro:', todosDatos.length, 'resultados - q:', termino || '(ninguno)', 'Estado:', filtros.estado || '(todos)', 'Segmento:', filtros.segmento || '(todos)', 'hasMore:', hasMoreData);
    } catch (error) {
        if (error.name !== 'AbortError') console.error('Error en búsqueda unificada:', error);
    } finally {
        activeController = null;
    }
}

// Función para buscar con debounce
function buscarConDebounce() {
    clearTimeout(debounceBusqueda);
    debounceBusqueda = setTimeout(function() {
        buscarEnServidor(true); // Reset offset al buscar
    }, 300);
}

// Adjuntar eventos a los botones - NUEVO: filtra directamente del servidor
function adjuntarEventos() {
    // Estado buttons
    document.querySelectorAll('#filtro-estado .filtro-btn').forEach(btn => {
        btn.onclick = function() {
            document.querySelectorAll('#filtro-estado .filtro-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            filtros.estado = this.dataset.value;
            buscarEnServidor(true); // Reset offset al cambiar filtro
        };
    });
    
    // Segmento buttons
    document.querySelectorAll('#filtro-segmento .filtro-btn').forEach(btn => {
        btn.onclick = function() {
            document.querySelectorAll('#filtro-segmento .filtro-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            filtros.segmento = this.dataset.value;
            buscarEnServidor(true); // Reset offset al cambiar filtro
        };
    });
    
// Buscador en tiempo real - NUEVA VERSIÓN: buscar en servidor
    const input = document.getElementById('cedula');
    input.oninput = function() {
        buscarConDebounce(); // Busca en servidor con debounce, respeta filtros activos
    };
}

// Aplicar filtros y renderizar
function aplicarFiltros() {
    const filtrados = todosDatos.filter(d => {
        if (filtros.estado && d.estado !== filtros.estado) return false;
        if (filtros.segmento && d.segmento !== filtros.segmento) return false;
if (filtros.busqueda) {
            const q = filtros.busqueda;
            const matchCedula = d.cedula && d.cedula.toString().includes(q);
            const matchNombre = d.nombre && d.nombre.toLowerCase().includes(q);
            const matchCelular = d.celular && d.celular.toString().includes(q);
            if (!matchCedula && !matchNombre && !matchCelular) return false;
        }
        return true;
    });
    
    document.getElementById('mostrando').textContent = filtrados.length;
    renderizarCards(filtrados);
}

// Renderizar cards de clientes (estructura unificada 5 filas)
function renderizarCards(datos) {
    const container = document.getElementById('cards-container');
    idsVisibles = Array.isArray(datos) ? datos.map(function(d) {
        return d.id_solicitud;
    }) : [];

    if (!datos.length) {
        container.innerHTML = '<div class="estado-vacio"><div class="vacio-icon">📋</div>No hay solicitudes</div>';
        actualizarContador();
        return;
    }

    datosFilas = {};

    var coloresEstado = {
        'ACTIVADA': '#dcfce7',
        'RECHAZADA': '#fee2e2',
        'DEVUELTA': '#fef3c7',
        'APROBADA PARA LIBERACIÓN': '#d1fae5'
    };
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

    container.innerHTML = datos.map(function(item) {
        datosFilas[item.id_solicitud] = item;
        var id = item.id_solicitud || '';
        var seleccionado = filasSeleccionadas.indexOf(id) > -1 ? 'seleccionada' : '';
        var estadoClase = 'estado-' + (item.estado || '').replace(/\s+/g, '').toUpperCase();
        var colorEstado = coloresEstado[item.estado] || '#f3f4f6';
        var colorGestion = coloresGestion[item.ultima_gestion_tipo] || '#f3f4f6';
        var fechaGestion = item.ultima_gestion_fecha ? new Date(item.ultima_gestion_fecha).toLocaleString('es-ES') : '';

        var html = '';
        html += '<div class="solicitud-card ' + seleccionado + '" id="card-' + id + '" onclick="toggleCard(\'' + id + '\')">';

        // FILA 1: Segmento + Estado (sin ID para evitar desbordamiento)
        html += '  <div class="card-fila-1">';
        html += '    <span class="card-badge badge-segmento">' + (item.segmento || 'Sin segmento') + '</span>';
        html += '    <span class="card-badge badge-estado ' + estadoClase + '" style="background:' + colorEstado + ';">' + (item.estado || 'Sin estado') + '</span>';
        html += '  </div>';

        // FILA 2: Nombre
        html += '  <div class="card-fila-2" onclick="event.stopPropagation(); copiarNombreCedula(\'' + escaparParaAtributo(item.nombre || '') + '\', \'' + escaparParaAtributo(item.cedula || '') + '\')" title="Copiar nombre + cédula">';
        html +=      (item.nombre || 'Sin nombre') + ' 📋';
        html += '  </div>';

        // FILA 3: Botones (4 en móvil: Gestiones, WhatsApp, Completar, Llamar)
        // Diseñado con icono + label para touch targets grandes tipo app nativa
        html += '  <div class="card-fila-3">';
        html += '    <button class="card-btn btn-gestiones" onclick="event.stopPropagation(); abrirGestionesMovil(\'' + id + '\')"><span class="btn-icon">📋</span><span class="btn-label">Gestiones</span></button>';
        html += '    <button class="card-btn btn-whatsapp" onclick="event.stopPropagation(); abrirWhatsAppChatMovil(\'' + escaparParaAtributo(item.celular || '') + '\')"><span class="btn-icon">💬</span><span class="btn-label">WhatsApp</span></button>';
        html += '    <button class="card-btn btn-completar" onclick="event.stopPropagation(); abrirCompletarInfoMovil(\'' + id + '\')"><span class="btn-icon">✏️</span><span class="btn-label">Completar</span></button>';
        html += '    <button class="card-btn btn-llamar" onclick="event.stopPropagation(); llamarCliente(\'' + escaparParaAtributo(item.celular || '') + '\')"><span class="btn-icon">📞</span><span class="btn-label">Llamar</span></button>';
        html += '    <div class="card-actions-more-movil" onclick="event.stopPropagation();">';
        html += '      <button class="card-btn btn-more-movil" onclick="toggleCardMenuMovil(event, \'' + id + '\')" title="Más acciones">⋮</button>';
        html += '      <div class="card-dropdown-menu-movil" id="card-menu-movil-' + id + '">';
        html += '        <button class="dropdown-item" onclick="event.stopPropagation(); abrirEditarSolicitudMovil(\'' + id + '\'); cerrarTodosLosMenusMovil()">✏️ Editar</button>';
        html += '        <div class="dropdown-divider"></div>';
        html += '        <button class="dropdown-item dropdown-item-danger" onclick="event.stopPropagation(); confirmarEliminarSolicitudMovil(\'' + id + '\'); cerrarTodosLosMenusMovil()">🗑️ Eliminar</button>';
        html += '      </div>';
        html += '    </div>';
        html += '  </div>';

        // FILA 4: Seguimiento
        if (item.ultima_gestion_tipo) {
            html += '  <div class="card-fila-4">';
            html += '    <div class="seguimiento-header">';
            html += '      <span class="seguimiento-badge" style="background:' + colorGestion + ';">📋 ' + item.ultima_gestion_tipo + '</span>';
            if (fechaGestion) {
                html += '      <span class="seguimiento-fecha">' + fechaGestion + '</span>';
            }
            html += '    </div>';
            if (item.ultima_gestion_obs) {
                html += '    <div class="seguimiento-obs" title="' + escaparParaAtributo(item.ultima_gestion_obs) + '">' + item.ultima_gestion_obs + '</div>';
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
        return html;
    }).join('');

    recrearSentinel();
    actualizarContador();
}

// Recrear el sentinel para infinite scroll
function recrearSentinel() {
    var container = document.getElementById('cards-container');
    if (!container) return;
    
    // Verificar si ya existe
    var sentinel = document.getElementById('infinite-scroll-sentinel');
    if (sentinel) {
        // Actualizar texto según estado
        if (isLoading) {
            sentinel.innerHTML = '<span class="loader-text">⏳ Cargando más...</span>';
        } else if (hasMoreData) {
            sentinel.innerHTML = '<span class="loader-text">📜 Desliza para cargar más...</span>';
        } else {
            sentinel.innerHTML = '<span class="loader-text">✅ No hay más registros</span>';
        }
        return;
    }
    
    // Crear nuevo sentinel
    sentinel = document.createElement('div');
    sentinel.id = 'infinite-scroll-sentinel';
    sentinel.style.cssText = 'height: 60px; display: flex; align-items: center; justify-content: center; color: #6b7280; font-size: 14px; padding: 15px;';
    sentinel.innerHTML = hasMoreData ? '<span class="loader-text">📜 Desliza para cargar más...</span>' : '<span class="loader-text">✅ No hay más registros</span>';
    container.appendChild(sentinel);
    
    // Configurar Intersection Observer si no existe
    if ('IntersectionObserver' in window) {
        var observer = new IntersectionObserver(function(entries) {
            var entry = entries[0];
            if (entry.isIntersecting && hasMoreData && !isLoading) {
                console.log('Infinite scroll: Detectado - cargando más...');
                cargarMas();
            }
        }, {
            rootMargin: '200px'
        });
        
        observer.observe(sentinel);
    }
}

// ================== LLAMADA Y WHATSAPP ==================

// Función para llamar al cliente
function llamarCliente(celular) {
    if (!celular) {
        alert('No hay número de celular');
        return;
    }
    // Limpiar el número - remover cualquier carácter que no sea dígito
    var numeroLimpio = celular.replace(/\D/g, '');
    window.location.href = 'tel:' + numeroLimpio;
}

// Función para enviar WhatsApp al cliente
function whatsAppCliente(celular, nombre) {
    if (!celular) {
        alert('No hay número de celular');
        return;
    }
    // Limpiar el número - remover cualquier carácter que no sea dígito
    var numeroLimpio = celular.replace(/\D/g, '');
    
    // Agregar código de país si no existe (+593 para Ecuador)
    // Verificar si ya tiene código de país (empieza con 593) o código largo internacional
    if (!numeroLimpio.startsWith('593') && numeroLimpio.length <= 10) {
        numeroLimpio = '593' + numeroLimpio;
    }
    
    // Mensaje predeterminado
    var mensaje = encodeURIComponent('Hola ' + (nombre || '') + ', te contactamos de Archivox. ¿En qué podemos ayudarte?');
    
    // Abrir WhatsApp
    var urlWhatsApp = 'https://wa.me/' + numeroLimpio + '?text=' + mensaje;
    window.open(urlWhatsApp, '_blank');
}

// ================== GESTIONES Y COMPLETAR EN MÓVIL ==================

// Opciones de tipo de gestión
let opcionesTipoGestion = [
    'Seguimiento',
    'Cobranza',
    'Llamada',
    'WhatsApp',
    'Reclamo',
    'Cita',
    'Otro'
];

// Función para escapar texto para usar en atributos HTML onclick
function escaparParaAtributo(texto) {
    return String(texto || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

// Función para copiar nombre + cédula al portapapeles
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
    } else {
        alert('No hay datos para copiar');
        return;
    }

    navigator.clipboard.writeText(texto).then(function() {
        alert('Copiado: ' + texto);
    }).catch(function(err) {
        console.error('Error al copiar:', err);
        alert('Error al copiar al portapapeles');
    });
}

// Función para abrir WhatsApp sin texto predefinido (móvil)
function abrirWhatsAppChatMovil(celular) {
    if (!celular) {
        alert('No hay número de celular');
        return;
    }
    var numeroLimpio = celular.replace(/\D/g, '');
    if (!numeroLimpio.startsWith('593') && numeroLimpio.length <= 10) {
        numeroLimpio = '593' + numeroLimpio;
    }
    window.open('https://wa.me/' + numeroLimpio, '_blank');
}

// Función para obtener la fecha y hora actual formateada
function getFechaHoraActual() {
    let ahora = new Date();
    let dia = String(ahora.getDate()).padStart(2, '0');
    let mes = String(ahora.getMonth() + 1).padStart(2, '0');
    let anio = ahora.getFullYear();
    let hora = String(ahora.getHours()).padStart(2, '0');
    let minuto = String(ahora.getMinutes()).padStart(2, '0');
    let segundo = String(ahora.getSeconds()).padStart(2, '0');
    return dia + '/' + mes + '/' + anio + ' ' + hora + ':' + minuto + ':' + segundo;
}

// Función para formatear fecha de gestión
function formatFechaGestion(fecha) {
    if (!fecha) return '';
    let d = new Date(fecha);
    let dia = String(d.getDate()).padStart(2, '0');
    let mes = String(d.getMonth() + 1).padStart(2, '0');
    let anio = d.getFullYear();
    let hora = String(d.getHours()).padStart(2, '0');
    let minuto = String(d.getMinutes()).padStart(2, '0');
    return dia + '/' + mes + '/' + anio + ' ' + hora + ':' + minuto;
}

// Función para abrir modal de Gestiones en móvil
function abrirGestionesMovil(id) {
    var datos = datosFilas[id];
    if (!datos) {
        alert('No se encontraron datos para esta solicitud');
        return;
    }
    
    // Crear opciones del dropdown
    let opcionesDropdown = '';
    for (let i = 0; i < opcionesTipoGestion.length; i++) {
        opcionesDropdown += '<option value="' + opcionesTipoGestion[i] + '">' + opcionesTipoGestion[i] + '</option>';
    }
    
let contenido = '';
    contenido += '<div style="padding: 20px; background: white; min-height: 100vh;">';
    contenido += '<h2 style="margin-top: 0; color: #1f2937; font-size: 18px;">📋 Gestiones - Solicitud #' + id + '</h2>';
    contenido += '<div style="background: #f3f4f6; padding: 12px; border-radius: 8px; margin-bottom: 15px; font-size: 13px;">';
    contenido += '<p><strong>Nombre:</strong> ' + (datos.nombre || 'N/A') + '</p>';
    contenido += '<p><strong>Cédula:</strong> ' + (datos.cedula || 'N/A') + '</p>';
contenido += '<p><strong>Celular:</strong> ' + (datos.celular || 'N/A') + '</p>';
    // Botones de Llamar y WhatsApp en el modal de Gestiones
    contenido += '<div style="display: flex; gap: 8px; margin: 10px 0;">';
    contenido += '<button onclick="llamarCliente(\'' + (datos.celular || '') + '\')" style="flex:1; padding: 10px; background: #10b981; color: white; border: none; border-radius: 6px; font-size: 13px; cursor: pointer; font-weight: 600;">📞 Llamar</button>';
    contenido += '<button onclick="whatsAppCliente(\'' + (datos.celular || '') + '\', \'' + (datos.nombre || '') + '\')" style="flex:1; padding: 10px; background: #25D366; color: white; border: none; border-radius: 6px; font-size: 13px; cursor: pointer; font-weight: 600;">💬 WhatsApp</button>';
    contenido += '</div>';
    contenido += '<p><strong>Estado:</strong> <span style="background:#dcfce7;padding:2px 8px;border-radius:10px;font-size:12px;">' + (datos.estado || 'N/A') + '</span></p>';
    contenido += '<p><strong>Segmento:</strong> ' + (datos.segmento || 'N/A') + '</p>';
    contenido += '<p><strong>Fecha Ingreso:</strong> ' + (datos.fecha_solicitud || 'N/A') + '</p>';
    contenido += '</div>';
    
    // Sección de nueva gestión
    contenido += '<div style="border: 2px solid #2563eb; border-radius: 8px; padding: 15px; margin-bottom: 15px; background: #eff6ff;">';
    contenido += '<h3 style="margin-top: 0; color: #1f2937; font-size: 16px;">➕ Nueva Gestión</h3>';
    
    // Fecha y hora (automático)
    contenido += '<label style="display: block; font-weight: 600; margin-bottom: 4px; font-size: 13px;">📅 Fecha y Hora:</label>';
    contenido += '<input type="text" id="fecha-gestion" value="' + getFechaHoraActual() + '" readonly style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 6px; font-size: 14px; background: #f3f4f6; color: #6b7280; margin-bottom: 12px;">';
    
    // Tipo de gestión (dropdown)
    contenido += '<label style="display: block; font-weight: 600; margin-bottom: 4px; font-size: 13px;">📋 Tipo de Gestión:</label>';
    contenido += '<select id="tipo-gestion" style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 6px; font-size: 14px; margin-bottom: 12px; background: white;">';
    contenido += opcionesDropdown;
    contenido += '</select>';
    
    // Observación
    contenido += '<label style="display: block; font-weight: 600; margin-bottom: 4px; font-size: 13px;">📝 Observación:</label>';
    contenido += '<textarea id="observacion-gestion" rows="4" style="width: 100%; padding: 12px; border: 1px solid #ddd; border-radius: 6px; font-size: 14px; resize: vertical; margin-bottom: 12px; box-sizing: border-box;" placeholder="Escriba su observación aquí..."></textarea>';
    
    // Botón guardar
    contenido += '<button onclick="guardarGestionMovil(\'' + id + '\')" style="width: 100%; padding: 12px; background: #2563eb; color: white; border: none; border-radius: 6px; font-size: 14px; font-weight: 600; cursor: pointer;">💾 Guardar Gestión</button>';
    contenido += '</div>';
    
    // Historial de gestiones
    contenido += '<div id="historial-gestiones" style="margin-top: 15px;">';
    contenido += '<h3 style="color: #1f2937; font-size: 16px;">📜 Historial de Gestiones</h3>';
    contenido += '<div id="lista-historial" style="text-align: center; padding: 20px; color: #6b7280;">Cargando...</div>';
    contenido += '</div>';
    
    // Botón cerrar
    contenido += '<div style="margin-top: 20px;">';
    contenido += '<button onclick="cerrarModal()" style="width: 100%; padding: 12px; background: #f3f4f6; border: none; border-radius: 8px; cursor: pointer; font-size: 14px;">✕ Cerrar</button>';
    contenido += '</div>';
    contenido += '</div>';
    
    crearModalMovil(contenido);
    
    // Cargar historial de gestines
    cargarHistorialGestionesMovil(id);
}

// Función para abrir modal de Completar en móvil
function abrirCompletarMovil(id) {
    var datos = datosFilas[id];
    if (!datos) {
        alert('No se encontraron datos para esta solicitud');
        return;
    }
    
    var contenido = '';
    contenido += '<div style="padding: 20px; background: white; min-height: 100vh;">';
    contenido += '<h2 style="margin-top: 0; color: #1f2937; font-size: 18px;">✏️ Completar Información - #' + id + '</h2>';
    contenido += '<div style="background: #f3f4f6; padding: 12px; border-radius: 8px; margin-bottom: 15px; font-size: 13px;">';
    contenido += '<p><strong>Nombre:</strong> ' + (datos.nombre || 'N/A') + '</p>';
    contenido += '<p><strong>Cédula:</strong> ' + (datos.cedula || 'N/A') + '</p>';
    contenido += '</div>';
    contenido += '<label style="display: block; font-weight: 600; margin-bottom: 8px; font-size: 14px;">Código Plus:</label>';
    contenido += '<input type="text" id="codigo-plus-completar" value="' + (datos.codigo_plus || '') + '" style="width: 100%; padding: 12px; border: 1px solid #ddd; border-radius: 8px; font-size: 14px; margin-bottom: 15px; box-sizing: border-box;" placeholder="Ingrese código plus">';
    contenido += '<label style="display: block; font-weight: 600; margin-bottom: 8px; font-size: 14px;">Observaciones:</label>';
    contenido += '<textarea id="observaciones" rows="5" style="width: 100%; padding: 12px; border: 1px solid #ddd; border-radius: 8px; font-size: 14px; resize: vertical; box-sizing: border-box;" placeholder="Escriba observaciones..."></textarea>';
    contenido += '<div style="margin-top: 20px; display: flex; gap: 10px;">';
    contenido += '<button onclick="cerrarModal()" style="flex:1; padding: 12px; background: #f3f4f6; border: none; border-radius: 8px; cursor: pointer; font-size: 14px;">Cancelar</button>';
    contenido += '<button onclick="guardarCompletarMovil(\'' + id + '\')" style="flex:1; padding: 12px; background: #2563eb; color: white; border: none; border-radius: 8px; cursor: pointer; font-size: 14px;">💾 Guardar</button>';
    contenido += '</div>';
    contenido += '</div>';
    
    crearModalMovil(contenido);
}

// Función para crear modal en móvil
function crearModalMovil(contenido) {
    var modalExistente = document.getElementById('modal-movil');
    if (modalExistente) {
        modalExistente.remove();
    }
    
    var overlay = document.createElement('div');
    overlay.id = 'modal-movil';
    overlay.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: white; z-index: 9999; overflow-y: auto;';
    
    overlay.innerHTML = contenido;
    document.body.appendChild(overlay);
}

// Función para cerrar modal en móvil
function cerrarModal() {
    var modal = document.getElementById('modal-movil');
    if (modal) {
        modal.remove();
    }
}

// Función para cargar historial de gestines en móvil
async function cargarHistorialGestionesMovil(id) {
    var container = document.getElementById('lista-historial');
    if (!container) return;
    
    try {
        var response = await fetch('/api/excel/gestiones/' + id);
        
        if (!response.ok) {
            container.innerHTML = '<div style="color: red;">Error al cargar historial</div>';
            return;
        }
        
        var gestines = await response.json();
        
        if (!gestines || gestines.length === 0) {
            container.innerHTML = '<div style="padding: 15px; text-align: center; color: #6b7280; background: #f9fafb; border-radius: 8px;">No hay gestines registradas</div>';
            return;
        }
        
        var html = '';
        var coloresTipo = {
            'Seguimiento': '#dbeafe',
            'Cobranza': '#fee2e2',
            'Llamada': '#d1fae5',
            'WhatsApp': '#dcfce7',
            'Reclamo': '#fef3c7',
            'Cita': '#e0e7ff',
            'Otro': '#f3f4f6'
        };
        
        for (var i = 0; i < gestines.length; i++) {
            var g = gestines[i];
            var color = coloresTipo[g.tipo_gestion] || '#f3f4f6';
            var fechaFormateada = formatFechaGestion(g.fecha_gestion);
            
            html += '<div style="background: ' + color + '; padding: 12px; border-radius: 8px; margin-bottom: 10px;">';
            html += '<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">';
            html += '<span style="font-weight: 600; font-size: 13px; color: #1f2937;">📋 ' + (g.tipo_gestion || '') + '</span>';
            html += '<span style="font-size: 11px; color: #6b7280;">' + fechaFormateada + '</span>';
            html += '</div>';
            
            if (g.observacion) {
                html += '<div style="font-size: 13px; color: #374151; line-height: 1.4; margin-bottom: 8px;">' + g.observacion + '</div>';
            }
            
            // Botones de editar y eliminar
            html += '<div style="display: flex; gap: 8px; justify-content: flex-end;">';
            html += '<button onclick="editarGestionMovil(\'' + g.id + '\', \'' + id + '\')" style="padding: 6px 12px; background: #2563eb; color: white; border: none; border-radius: 4px; font-size: 12px; cursor: pointer;">✏️ Editar</button>';
            html += '<button onclick="confirmarEliminarGestionMovil(\'' + g.id + '\', \'' + id + '\')" style="padding: 6px 12px; background: #dc2626; color: white; border: none; border-radius: 4px; font-size: 12px; cursor: pointer;">🗑️ Eliminar</button>';
            html += '</div>';
            html += '</div>';
        }
        
        container.innerHTML = html;
        
    } catch (error) {
        console.error('Error cargando historial:', error);
        container.innerHTML = '<div style="color: red;">Error al cargar historial</div>';
    }
}

// ================== GESTIÓN POR LOTES (MÓVIL) ==================

// Función para generar informe de las solicitudes seleccionadas (móvil)
function generarInformeSeleccionadasMovil() {
    var informe = {
        total: filasSeleccionadas.length,
        porEstado: {},
        porSegmento: {},
        porProducto: {},
        celularesUnicos: []
    };
    
    var celularesVistos = {};
    
    filasSeleccionadas.forEach(function(id) {
        var datos = datosFilas[id];
        if (datos) {
            // Por Estado
            var estado = datos.estado || 'Sin Estado';
            informe.porEstado[estado] = (informe.porEstado[estado] || 0) + 1;
            
            // Por Segmento
            var segmento = datos.segmento || 'Sin Segmento';
            informe.porSegmento[segmento] = (informe.porSegmento[segmento] || 0) + 1;
            
            // Por Producto
            var producto = datos.producto || 'Sin Producto';
            informe.porProducto[producto] = (informe.porProducto[producto] || 0) + 1;
            
            // Celulares únicos
            if (datos.celular && !celularesVistos[datos.celular]) {
                celularesVistos[datos.celular] = true;
                informe.celularesUnicos.push(datos.celular);
            }
        }
    });
    
    return informe;
}

// Abrir modal para crear nueva gestión por lotes en móvil CON INFORME Y PLAN DE ACCIÓN
async function abrirModalNuevaGestionMovil() {
    if (filasSeleccionadas.length === 0) {
        alert('Selecciona al menos una card primero');
        return;
    }

    // Obtener datos de sesión y agentes del equipo (para líderes)
    var agentesDisponibles = [];
    var esLider = false;
    
    try {
        var sesionRes = await fetch('/api/auth/sesion');
        var sesionData = await sesionRes.json();
        if (sesionData.autenticado) {
            esLider = !!(sesionData.usuario.es_lider || sesionData.usuario.rol === 'superadmin' || sesionData.usuario.rol === 'admin');
            if (esLider && sesionData.usuario.equipo_id) {
                try {
                    var dashboardRes = await fetch('/api/equipos/' + sesionData.usuario.equipo_id + '/dashboard');
                    if (dashboardRes.ok) {
                        var dashboardData = await dashboardRes.json();
                        agentesDisponibles = dashboardData.agentes || [];
                    }
                } catch (e) {
                    console.error('[abrirModalNuevaGestionMovil] Error cargando agentes:', e);
                }
            }
        }
    } catch (e) {
        console.error('[abrirModalNuevaGestionMovil] Error obteniendo sesión:', e);
    }

    // Generar informe
    var informe = generarInformeSeleccionadasMovil();
    
    // Opciones de tipo de gestión
    var opcionesTipoGestionModal = '';
    ['Seguimiento', 'Cobranza', 'Llamada', 'WhatsApp', 'Reclamo', 'Cita', 'Otro'].forEach(function(tipo) {
        opcionesTipoGestionModal += '<option value="' + tipo + '">' + tipo + '</option>';
    });

    // Generar selector de agente (solo para líderes)
    var agenteSelectorHTML = '';
    if (esLider) {
        if (agentesDisponibles.length > 0) {
            var opcionesAgentes = '<option value="">Sin asignar</option>';
            for (var a = 0; a < agentesDisponibles.length; a++) {
                var ag = agentesDisponibles[a];
                var nombreAgente = ag.nombre || ag.username || 'Agente #' + ag.id;
                opcionesAgentes += '<option value="' + ag.id + '">' + nombreAgente + '</option>';
            }
            agenteSelectorHTML = '<label style="display:block; font-weight:600; margin-bottom:6px; font-size:12px; color:#374151;">👤 Asignar a:</label>' +
                '<select id="agente-id-movil" style="width:100%; padding:10px; border:1px solid #ddd; border-radius:8px; font-size:14px; margin-bottom:12px; background:white;">' +
                opcionesAgentes + '</select>';
        } else {
            agenteSelectorHTML = '<div style="background: #fef3c7; color: #92400e; padding: 8px 12px; border-radius: 6px; font-size: 12px; margin-bottom: 10px; text-align: center; font-weight: 600;">⚠️ No hay agentes disponibles en tu equipo</div>';
        }
    }

    var contenido = '';
    contenido += '<div style="padding: 20px; background: white; min-height: 100vh;">';
    contenido += '<h2 style="margin-top:0; color:#1f2937; font-size:18px;">🚀 Crear campaña</h2>';
    
    // ================== 📊 INFORME (MÓVIL) ==================
    contenido += '<div style="background: #f0f9ff; border: 2px solid #0ea5e9; border-radius: 12px; padding: 12px; margin-bottom: 15px;">';
    contenido += '<h3 style="margin-top:0; color:#0369a1; font-size:14px;">📊 INFORME</h3>';
    contenido += '<div style="display:grid; grid-template-columns: 1fr 1fr; gap:8px;">';
    
    // Total
    contenido += '<div style="background:white; padding:10px; border-radius:8px; text-align:center;">';
    contenido += '<div style="font-size:20px; font-weight:bold; color:#1f2937;">' + informe.total + '</div>';
    contenido += '<div style="font-size:10px; color:#6b7280;">Total</div>';
    contenido += '</div>';
    
    // Celulares únicos
    contenido += '<div style="background:white; padding:10px; border-radius:8px; text-align:center;">';
    contenido += '<div style="font-size:20px; font-weight:bold; color:#059669;">' + informe.celularesUnicos.length + '</div>';
    contenido += '<div style="font-size:10px; color:#6b7280;">Celulares</div>';
    contenido += '</div>';
    
    // Por Estado (resumen)
    contenido += '<div style="background:white; padding:8px; border-radius:8px; grid-column:1/-1;">';
    contenido += '<div style="font-size:11px; font-weight:600; color:#374151; margin-bottom:4px;">📌 Estado</div>';
    contenido += '<div style="display:flex; flex-wrap:wrap; gap:4px;">';
    Object.keys(informe.porEstado).forEach(function(estado) {
        var count = informe.porEstado[estado];
        contenido += '<span style="background:#e0e7ff; padding:2px 6px; border-radius:8px; font-size:9px; color:#3730a3;">' + estado.substring(0,8) + ':' + count + '</span>';
    });
    contenido += '</div></div>';
    
    // Por Segmento (resumen)
    contenido += '<div style="background:white; padding:8px; border-radius:8px; grid-column:1/-1;">';
    contenido += '<div style="font-size:11px; font-weight:600; color:#374151; margin-bottom:4px;">🏷️ Segmento</div>';
    contenido += '<div style="display:flex; flex-wrap:wrap; gap:4px;">';
    Object.keys(informe.porSegmento).forEach(function(segmento) {
        var count = informe.porSegmento[segmento];
        contenido += '<span style="background:#fef3c7; padding:2px 6px; border-radius:8px; font-size:9px; color:#92400e;">' + segmento.substring(0,10) + ':' + count + '</span>';
    });
    contenido += '</div></div>';
    
    contenido += '</div>'; // fin grid
    contenido += '</div>'; // fin informe
    
    // ================== 📋 PLAN DE ACCIÓN (MÓVIL) ==================
    contenido += '<div style="background: #f0fdf4; border: 2px solid #22c55e; border-radius: 12px; padding: 12px; margin-bottom: 15px;">';
    contenido += '<h3 style="margin-top:0; color:#166534; font-size:14px;">📋 PLAN DE ACCIÓN</h3>';
    
    contenido += '<label style="display:block; font-weight:600; margin-bottom:6px; font-size:12px;">📝 Nombre:</label>';
    contenido += '<input type="text" id="nombre-gestion-movil" style="width:100%; padding:10px; border:1px solid #ddd; border-radius:8px; font-size:14px; margin-bottom:12px;" placeholder="Ej: Gestión Cobranza Enero 2025">';
    
    contenido += '<label style="display:block; font-weight:600; margin-bottom:6px; font-size:12px;">📋 Tipo:</label>';
    contenido += '<select id="tipo-gestion-lote-movil" style="width:100%; padding:10px; border:1px solid #ddd; border-radius:8px; font-size:14px; margin-bottom:12px; background:white;">';
    contenido += opcionesTipoGestionModal;
    contenido += '</select>';
    
    // Agregar selector de agente (solo líder)
    contenido += agenteSelectorHTML;
    
    contenido += '<label style="display:block; font-weight:600; margin-bottom:6px; font-size:12px;">🎯 Objetivo:</label>';
    contenido += '<textarea id="descripcion-gestion-movil" rows="3" style="width:100%; padding:10px; border:1px solid #ddd; border-radius:8px; font-size:14px; margin-bottom:12px;" placeholder="¿Cuál es el objetivo...?"></textarea>';
    
    contenido += '<label style="display:block; font-weight:600; margin-bottom:6px; font-size:12px;">📅 Fecha Límite:</label>';
    contenido += '<input type="date" id="fecha-limite-gestion-movil" style="width:100%; padding:10px; border:1px solid #ddd; border-radius:8px; font-size:14px; margin-bottom:12px;">';
    
    contenido += '</div>'; // fin plan de acción
    
    contenido += '<div style="display:flex; gap:10px;">';
    contenido += '<button onclick="cerrarModal()" style="flex:1; padding:12px; background:#f3f4f6; border:none; border-radius:8px;">Cancelar</button>';
    contenido += '<button onclick="crearGestionLoteMovil()" id="btn-crear-gestion-movil" style="flex:1; padding:12px; background:#2563eb; color:white; border:none; border-radius:8px; font-weight:600;">🚀 Crear</button>';
    contenido += '</div>';
    contenido += '</div>';

    crearModalMovil(contenido);
}

// Enviar petición para crear gestión por lotes desde móvil
async function crearGestionLoteMovil() {
    var nombre = document.getElementById('nombre-gestion-movil').value.trim();
    var descripcion = document.getElementById('descripcion-gestion-movil').value.trim();
    var fecha_limite = document.getElementById('fecha-limite-gestion-movil').value || null;

    if (!nombre) {
        alert('Por favor ingresa un nombre para la gestión');
        return;
    }

    var btn = document.getElementById('btn-crear-gestion-movil');
    if (btn) { btn.textContent = '⏳ Creando...'; btn.disabled = true; }

    try {
        var response = await fetch('/api/gestiones-maestro', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                nombre: nombre,
                descripcion: descripcion,
                fecha_limite: fecha_limite,
                solicitudes_ids: filasSeleccionadas
            })
        });

        var resultado = await response.json();
        if (response.ok && resultado.id) {
            alert('Gestión creada correctamente');
            cerrarModal();
            // Navegar a la vista de gestión por lotes (intentar ruta móvil primero)
            try { window.location.href = '/m/gestion-lote?id=' + resultado.id; } catch (e) { window.location.href = '/gestion-lote?id=' + resultado.id; }
        } else {
            alert('Error: ' + (resultado.error || 'Error desconocido'));
        }
    } catch (error) {
        console.error('Error creando gestión móvil:', error);
        alert('Error al crear gestión');
    } finally {
        if (btn) { btn.textContent = '🚀 Crear Gestión'; btn.disabled = false; }
    }
}

// ================== AGREGAR A CAMPAÑA EXISTENTE (MÓVIL) ==================

var campanaSeleccionadaIdMovil = null;

// Abrir modal para agregar solicitudes a una campaña existente (móvil)
async function abrirModalAgregarCampanaMovil() {
    if (filasSeleccionadas.length === 0) {
        alert('Selecciona al menos una card primero');
        return;
    }

    var contenido = '';
    contenido += '<div style="padding: 20px; background: white; min-height: 100vh;">';
    contenido += '<h2 style="margin-top:0; color:#1f2937; font-size:18px;">➕ Agregar a Campaña</h2>';
    contenido += '<div style="background: #e0e7ff; padding: 8px 12px; border-radius: 8px; font-size: 13px; font-weight: 600; color: #3730a3; margin-bottom: 15px; display: inline-block;">' + filasSeleccionadas.length + ' solicitudes seleccionadas</div>';
    contenido += '<div id="campanas-list-movil" style="text-align: center; padding: 40px; color: #6b7280;">⏳ Cargando campañas...</div>';
    contenido += '<div style="margin-top: 20px; display: flex; gap: 10px;">';
    contenido += '<button onclick="cerrarModal()" style="flex:1; padding: 12px; background: #f3f4f6; border: none; border-radius: 8px; cursor: pointer; font-size: 14px;">Cancelar</button>';
    contenido += '</div>';
    contenido += '</div>';

    crearModalMovil(contenido);

    // Cargar campañas
    try {
        var response = await fetch('/api/gestiones-maestro', {
            credentials: 'include'
        });
        if (!response.ok) throw new Error('Error al cargar campañas');
        var campanas = await response.json();
        renderizarListaCampanasMovil(campanas);
    } catch (error) {
        console.error('Error cargando campañas móvil:', error);
        var listContainer = document.getElementById('campanas-list-movil');
        if (listContainer) {
            listContainer.innerHTML = '<div style="color: #dc2626;">❌ Error al cargar campañas</div>';
        }
    }
}

// Renderizar lista de campañas (móvil)
function renderizarListaCampanasMovil(campanas) {
    var container = document.getElementById('campanas-list-movil');
    if (!container) return;

    if (!campanas || campanas.length === 0) {
        container.innerHTML = '<div style="text-align: center; padding: 40px; color: #6b7280;">📭 No hay campañas creadas aún.<br><br><button onclick="cerrarModal(); abrirModalNuevaGestionMovil()" style="padding: 12px 24px; background: #2563eb; color: white; border: none; border-radius: 8px; font-weight: 600; cursor: pointer; font-size: 14px;">🚀 Crear nueva campaña</button></div>';
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

        html += '<div class="campana-item-select-movil" data-id="' + c.id + '" style="background: #f8fafc; border: 2px solid #e5e7eb; border-radius: 10px; padding: 14px; cursor: pointer; transition: all 0.2s ease;" onclick="seleccionarCampanaMovil(this, \'' + c.id + '\')">';
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
    html += '<button id="btn-confirmar-agregar-movil" onclick="confirmarAgregarCampanaMovil()" disabled style="width: 100%; padding: 14px; background: #9ca3af; color: white; border: none; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: not-allowed; transition: all 0.2s ease;">Selecciona una campaña</button>';
    html += '</div>';

    container.innerHTML = html;

    // Agregar hover effect con JS
    var items = container.querySelectorAll('.campana-item-select-movil');
    for (var j = 0; j < items.length; j++) {
        items[j].addEventListener('mouseenter', function() {
            if (!this.classList.contains('seleccionada')) {
                this.style.borderColor = '#93c5fd';
                this.style.background = '#f0f5ff';
            }
        });
        items[j].addEventListener('mouseleave', function() {
            if (!this.classList.contains('seleccionada')) {
                this.style.borderColor = '#e5e7eb';
                this.style.background = '#f8fafc';
            }
        });
    }
}

// Seleccionar una campaña (móvil)
function seleccionarCampanaMovil(elemento, id) {
    var items = document.querySelectorAll('.campana-item-select-movil');
    for (var i = 0; i < items.length; i++) {
        items[i].classList.remove('seleccionada');
        items[i].style.borderColor = '#e5e7eb';
        items[i].style.background = '#f8fafc';
    }

    elemento.classList.add('seleccionada');
    elemento.style.borderColor = '#2563eb';
    elemento.style.background = '#eff6ff';

    campanaSeleccionadaIdMovil = id;

    var btn = document.getElementById('btn-confirmar-agregar-movil');
    if (btn) {
        btn.disabled = false;
        btn.style.background = '#2563eb';
        btn.style.cursor = 'pointer';
        btn.textContent = '➕ Agregar a esta campaña';
    }
}

// Confirmar y agregar solicitudes a la campaña (móvil)
async function confirmarAgregarCampanaMovil() {
    if (!campanaSeleccionadaIdMovil) {
        alert('Selecciona una campaña primero');
        return;
    }

    if (filasSeleccionadas.length === 0) {
        alert('No hay solicitudes seleccionadas');
        return;
    }

    var btn = document.getElementById('btn-confirmar-agregar-movil');
    if (btn) {
        btn.textContent = '⏳ Agregando...';
        btn.disabled = true;
    }

    try {
        var response = await fetch('/api/gestiones-maestro/' + campanaSeleccionadaIdMovil + '/agregar-solicitudes', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
                solicitudes_ids: filasSeleccionadas
            })
        });

        var resultado = await response.json();

        if (response.ok) {
            alert('✅ ' + (resultado.mensaje || 'Solicitudes agregadas correctamente'));
            cerrarModal();
            // Ir a la campaña
            try { window.location.href = '/m/gestion-lote?id=' + campanaSeleccionadaIdMovil; } catch (e) { window.location.href = '/gestion-lote?id=' + campanaSeleccionadaIdMovil; }
        } else {
            alert('Error: ' + (resultado.error || 'Error desconocido'));
            if (btn) {
                btn.textContent = '➕ Agregar a esta campaña';
                btn.disabled = false;
            }
        }
    } catch (error) {
        console.error('Error agregando a campaña:', error);
        alert('Error al agregar solicitudes: ' + error.message);
        if (btn) {
            btn.textContent = '➕ Agregar a esta campaña';
            btn.disabled = false;
        }
    }
}

// Función para editar una gestión en móvil
function editarGestionMovil(gestionId, solicitudId) {
    fetch('/api/excel/gestiones/' + solicitudId)
        .then(function(res) { return res.json(); })
        .then(function(gestines) {
            var gestion = gestines.find(function(g) { return g.id == gestionId; });
            if (!gestion) {
                alert('Gestión no encontrada');
                return;
            }
            
            var opcionesDropdown = '';
            for (var i = 0; i < opcionesTipoGestion.length; i++) {
                var selected = opcionesTipoGestion[i] === gestion.tipo_gestion ? 'selected' : '';
                opcionesDropdown += '<option value="' + opcionesTipoGestion[i] + '" ' + selected + '>' + opcionesTipoGestion[i] + '</option>';
            }
            
            var contenido = '';
            contenido += '<div style="padding: 20px; background: white; min-height: 100vh;">';
            contenido += '<h2 style="margin-top: 0; color: #1f2937; font-size: 18px;">✏️ Editar Gestión</h2>';
            
            contenido += '<label style="display: block; font-weight: 600; margin-bottom: 4px; font-size: 13px;">📋 Tipo de Gestión:</label>';
            contenido += '<select id="tipo-gestion-editar" style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 6px; font-size: 14px; margin-bottom: 12px; background: white;">';
            contenido += opcionesDropdown;
            contenido += '</select>';
            
            contenido += '<label style="display: block; font-weight: 600; margin-bottom: 4px; font-size: 13px;">📝 Observación:</label>';
            contenido += '<textarea id="observacion-editar" rows="4" style="width: 100%; padding: 12px; border: 1px solid #ddd; border-radius: 6px; font-size: 14px; resize: vertical; margin-bottom: 12px; box-sizing: border-box;">' + (gestion.observacion || '') + '</textarea>';
            
            contenido += '<div style="display: flex; gap: 10px;">';
            contenido += '<button onclick="cerrarModal()" style="flex:1; padding: 12px; background: #f3f4f6; border: none; border-radius: 8px; cursor: pointer; font-size: 14px;">Cancelar</button>';
            contenido += '<button onclick="guardarEdicionGestionMovil(\'' + gestionId + '\', \'' + solicitudId + '\')" style="flex:1; padding: 12px; background: #2563eb; color: white; border: none; border-radius: 8px; cursor: pointer; font-size: 14px;">💾 Guardar</button>';
            contenido += '</div>';
            contenido += '</div>';
            
            crearModalMovil(contenido);
        })
        .catch(function(err) {
            console.error('Error:', err);
            alert('Error al cargar gestión');
        });
}

// Función para guardar la edición en móvil
function guardarEdicionGestionMovil(gestionId, solicitudId) {
    var tipo = document.getElementById('tipo-gestion-editar').value;
    var observacion = document.getElementById('observacion-editar').value.trim();
    
    if (!tipo) {
        alert('Por favor seleccione un tipo de gestión');
        return;
    }
    
    fetch('/api/excel/gestiones/' + gestionId, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo_gestion: tipo, observacion: observacion })
    })
    .then(function(res) { return res.json(); })
    .then(function(resultado) {
        if (resultado && !resultado.error) {
            alert('Gestión actualizada correctamente');
            cerrarModal();
            cargarHistorialGestionesMovil(solicitudId);
        } else {
            alert('Error: ' + (resultado.error || 'Error desconocidos'));
        }
    })
    .catch(function(err) {
        console.error('Error:', err);
        alert('Error al guardar');
    });
}

// Función para confirmar y eliminar en móvil
function confirmarEliminarGestionMovil(gestionId, solicitudId) {
    if (!confirm('¿Está seguro de eliminar esta gestión?')) {
        return;
    }
    
    fetch('/api/excel/gestiones/' + gestionId, {
        method: 'DELETE'
    })
    .then(function(res) { return res.json(); })
    .then(function(resultado) {
        if (resultado && !resultado.error) {
            alert('Gestión eliminada correctamente');
            cargarHistorialGestionesMovil(solicitudId);
        } else {
            alert('Error: ' + (resultado.error || 'Error desconocido'));
        }
    })
    .catch(function(err) {
        console.error('Error:', err);
        alert('Error al eliminar');
    });
}

// Función para guardar gestión en móvil
function guardarGestionMovil(id) {
    var tipo = document.getElementById('tipo-gestion');
    var observacion = document.getElementById('observacion-gestion');
    
    if (!tipo || !observacion) {
        alert('Error: No se encontraron los campos del formulario');
        return;
    }
    
    var tipo_gestion = tipo.value;
    var obs = observacion.value.trim();
    
    if (!tipo_gestion) {
        alert('Por favor seleccione un tipo de gestión');
        return;
    }
    
    if (!obs) {
        alert('Por favor escriba una observación');
        return;
    }
    
    // Mostrar indicador de guardado
    var btn = document.querySelector('button[onclick="guardarGestionMovil(\'' + id + '\')"]');
    if (btn) {
        btn.textContent = '💾 Guardando...';
        btn.disabled = true;
    }
    
    fetch('/api/excel/gestiones', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            solicitud_id: id,
            tipo_gestion: tipo_gestion,
            observacion: obs
        })
})
    .then(function(res) {
        return res.json();
    })
    .then(function(resultado) {
        if (resultado && !resultado.error) {
            // Recargar historial
            cargarHistorialGestionesMovil(id);
            
            // Limpiar campos
            document.getElementById('observacion-gestion').value = '';
            document.getElementById('tipo-gestion').selectedIndex = 0;
            
            // Actualizar fecha/hora
            var fechaInput = document.getElementById('fecha-gestion');
            if (fechaInput) {
                fechaInput.value = getFechaHoraActual();
            }
            
            alert('Gestión guardada correctamente');
        } else {
            alert('Error: ' + (resultado.error || 'Error desconocido'));
        }
    })
    .catch(function(err) {
        console.error('Error guardando gestión:', err);
        alert('Error al guardar la gestión');
    })
    .finally(function() {
        if (btn) {
            btn.textContent = '💾 Guardar Gestión';
            btn.disabled = false;
        }
    });
}

// Función para guardar completar en móvil
function guardarCompletarMovil(id) {
    var codigo_plus = document.getElementById('codigo-plus-completar').value.trim();
    var observaciones = document.getElementById('observaciones').value.trim();
    
    // Guardar código plus si cambió
    var datos = datosFilas[id];
    if (codigo_plus && codigo_plus !== (datos.codigo_plus || '')) {
        fetch('/api/excel/solicitudes/' + id + '/codigo-plus', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ codigo_plus: codigo_plus })
        }).then(function(response) {
            return response.json();
        }).then(function(resultado) {
            if (response.ok) {
                console.log('Código Plus actualizado:', resultado);
                init(); // Recargar datos
            }
        });
    }
    
    alert('Información guardada para solicitud #' + id);
    cerrarModal();
}

// ================== COMPLETAR INFO (NUEVO) ==================

// Abrir modal de Completar Información con formulario completo
async function abrirCompletarInfoMovil(id) {
    var datos = datosFilas[id];
    if (!datos) {
        alert('No se encontraron datos para esta solicitud');
        return;
    }
    
    // Intentar cargar datos completos existentes (incluyendo referencias)
    var codigoPlus = datos.codigo_plus || '';
    var correoElectronico = datos.correo_electronico || '';
    var direccion = datos.direccion || '';
    var direccionTrabajo = datos.direccion_trabajo || '';
    var ocupacion = datos.ocupacion || '';
    var ingresoMensual = datos.ingreso_mensual || '';
    var referencias = [];
    
    try {
        var res = await fetch('/api/excel/solicitudes/' + id + '/completa');
        if (res.ok) {
            var data = await res.json();
            codigoPlus = data.codigo_plus || codigoPlus;
            correoElectronico = data.correo_electronico || correoElectronico;
            direccion = data.direccion || direccion;
            direccionTrabajo = data.direccion_trabajo || direccionTrabajo;
            ocupacion = data.ocupacion || ocupacion;
            ingresoMensual = data.ingreso_mensual || ingresoMensual;
            referencias = data.referencias || [];
        }
    } catch (e) {
        console.error('Error cargando datos completos:', e);
    }
    
    // Asegurar 3 slots de referencia
    while (referencias.length < 3) {
        referencias.push({ nombre: '', telefono: '', relacion: '' });
    }
    
    // Generar HTML de referencias
    var htmlReferencias = '';
    for (var i = 0; i < 3; i++) {
        var r = referencias[i] || {};
        var num = i + 1;
        var opcionesRelacion = ['Amigo', 'Familiar', 'Vecino', 'Compañero', 'Otro'].map(function(rel) {
            var selected = rel === r.relacion ? 'selected' : '';
            return '<option value="' + rel + '" ' + selected + '>' + rel + '</option>';
        }).join('');
        
        htmlReferencias += `
            <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:12px;margin-bottom:12px;">
                <div style="font-size:12px;font-weight:600;color:#374151;margin-bottom:8px;">👤 Referencia #${num}</div>
                <label style="display:block;font-size:12px;font-weight:600;margin-bottom:4px;color:#4b5563;">Nombres y Apellidos:</label>
                <input type="text" id="ref-${num}-nombre" value="${escaparParaAtributo(r.nombre)}" style="width:100%;padding:10px;border:1px solid #ddd;border-radius:6px;font-size:14px;margin-bottom:8px;box-sizing:border-box;" placeholder="Nombre completo">
                <label style="display:block;font-size:12px;font-weight:600;margin-bottom:4px;color:#4b5563;">📞 Teléfono:</label>
                <input type="tel" id="ref-${num}-telefono" value="${escaparParaAtributo(r.telefono)}" style="width:100%;padding:10px;border:1px solid #ddd;border-radius:6px;font-size:14px;margin-bottom:8px;box-sizing:border-box;" placeholder="Número de teléfono">
                <label style="display:block;font-size:12px;font-weight:600;margin-bottom:4px;color:#4b5563;">🤝 Relación:</label>
                <select id="ref-${num}-relacion" style="width:100%;padding:10px;border:1px solid #ddd;border-radius:6px;font-size:14px;background:white;box-sizing:border-box;">
                    <option value="">Seleccionar...</option>
                    ${opcionesRelacion}
                </select>
            </div>
        `;
    }
    
    var contenido = '';
    contenido += '<div style="padding: 20px; background: white; min-height: 100vh;">';
    contenido += '<h2 style="margin-top: 0; color: #1f2937; font-size: 18px;">✏️ Completar Información</h2>';
    
    // Datos del cliente (solo lectura)
    contenido += '<div style="background: #f3f4f6; padding: 12px; border-radius: 8px; margin-bottom: 15px; font-size: 13px;">';
    contenido += '<p><strong>👤 Cliente:</strong> ' + (datos.nombre || 'N/A') + '</p>';
    contenido += '<p><strong>🆔 Cédula:</strong> ' + (datos.cedula || 'N/A') + '</p>';
    contenido += '<p><strong>📱 Celular:</strong> ' + (datos.celular || 'N/A') + '</p>';
    contenido += '</div>';
    
    // Información Adicional
    contenido += '<div style="border: 2px solid #818cf8; border-radius: 8px; padding: 15px; margin-bottom: 15px; background: #eef2ff;">';
    contenido += '<h3 style="margin-top:0; color:#4338ca; font-size:15px;">📋 Información Adicional</h3>';
    
    contenido += '<label style="display:block;font-weight:600;margin-bottom:4px;font-size:12px;color:#374151;">📦 Código Plus:</label>';
    contenido += '<input type="text" id="codigo-plus-completar" value="' + escaparParaAtributo(codigoPlus) + '" style="width:100%;padding:10px;border:1px solid #ddd;border-radius:6px;font-size:14px;margin-bottom:10px;box-sizing:border-box;" placeholder="Código Plus">';
    
    contenido += '<label style="display:block;font-weight:600;margin-bottom:4px;font-size:12px;color:#374151;">📍 Dirección:</label>';
    contenido += '<input type="text" id="direccion-completar" value="' + escaparParaAtributo(direccion) + '" style="width:100%;padding:10px;border:1px solid #ddd;border-radius:6px;font-size:14px;margin-bottom:10px;box-sizing:border-box;" placeholder="Dirección de domicilio">';
    
    contenido += '<label style="display:block;font-weight:600;margin-bottom:4px;font-size:12px;color:#374151;">🏢 Dirección de Trabajo:</label>';
    contenido += '<input type="text" id="direccion-trabajo-completar" value="' + escaparParaAtributo(direccionTrabajo) + '" style="width:100%;padding:10px;border:1px solid #ddd;border-radius:6px;font-size:14px;margin-bottom:10px;box-sizing:border-box;" placeholder="Dirección de trabajo">';
    
    contenido += '<label style="display:block;font-weight:600;margin-bottom:4px;font-size:12px;color:#374151;">💼 Ocupación:</label>';
    contenido += '<input type="text" id="ocupacion-completar" value="' + escaparParaAtributo(ocupacion) + '" style="width:100%;padding:10px;border:1px solid #ddd;border-radius:6px;font-size:14px;margin-bottom:10px;box-sizing:border-box;" placeholder="Ocupación">';
    
    contenido += '<label style="display:block;font-weight:600;margin-bottom:4px;font-size:12px;color:#374151;">📧 Correo Electrónico:</label>';
    contenido += '<input type="email" id="correo-completar" value="' + escaparParaAtributo(correoElectronico) + '" style="width:100%;padding:10px;border:1px solid #ddd;border-radius:6px;font-size:14px;margin-bottom:10px;box-sizing:border-box;" placeholder="cliente@ejemplo.com">';
    
    contenido += '<label style="display:block;font-weight:600;margin-bottom:4px;font-size:12px;color:#374151;">💰 Ingreso Mensual:</label>';
    contenido += '<input type="number" step="0.01" min="0" id="ingreso-mensual-completar" value="' + (ingresoMensual || '') + '" style="width:100%;padding:10px;border:1px solid #ddd;border-radius:6px;font-size:14px;margin-bottom:0;box-sizing:border-box;" placeholder="0.00">';
    
    contenido += '</div>';
    
    // Referencias
    contenido += '<div style="border: 2px solid #22c55e; border-radius: 8px; padding: 15px; margin-bottom: 15px; background: #f0fdf4;">';
    contenido += '<h3 style="margin-top:0; color:#166534; font-size:15px;">👥 Referencias Personales</h3>';
    contenido += htmlReferencias;
    contenido += '</div>';
    
    // Botón guardar
    contenido += '<button onclick="guardarCompletarInfoMovil(\'' + id + '\')" style="width:100%;padding:14px;background:#2563eb;color:white;border:none;border-radius:8px;font-size:15px;font-weight:600;cursor:pointer;">💾 Guardar Información</button>';
    
    // Botón cerrar
    contenido += '<button onclick="cerrarModal()" style="width:100%;padding:12px;background:#f3f4f6;border:none;border-radius:8px;cursor:pointer;font-size:14px;margin-top:10px;">✕ Cerrar</button>';
    
    contenido += '</div>';
    
    crearModalMovil(contenido);
}

// Guardar información completa (código plus, dirección, referencias, etc.)
function guardarCompletarInfoMovil(id) {
    var codigo_plus = document.getElementById('codigo-plus-completar').value.trim();
    var correo_electronico = document.getElementById('correo-completar').value.trim();
    var direccion = document.getElementById('direccion-completar').value.trim();
    var direccion_trabajo = document.getElementById('direccion-trabajo-completar').value.trim();
    var ocupacion = document.getElementById('ocupacion-completar').value.trim();
    var ingresoInput = document.getElementById('ingreso-mensual-completar').value.trim();
    var ingreso_mensual = ingresoInput ? (parseFloat(ingresoInput) || null) : null;
    
    // Recoger referencias (solo las que tienen nombre)
    var referencias = [];
    for (var i = 1; i <= 3; i++) {
        var nombre = document.getElementById('ref-' + i + '-nombre').value.trim();
        var telefono = document.getElementById('ref-' + i + '-telefono').value.trim();
        var relacion = document.getElementById('ref-' + i + '-relacion').value;
        
        referencias.push({
            nombre: nombre,
            telefono: telefono,
            relacion: relacion
        });
    }
    
    // Mostrar indicador de guardado
    var btn = document.querySelector('button[onclick="guardarCompletarInfoMovil(\'' + id + '\')"]');
    if (btn) {
        btn.textContent = '⏳ Guardando...';
        btn.disabled = true;
    }
    
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
            referencias: referencias
        })
    })
    .then(function(response) { return response.json(); })
    .then(function(resultado) {
        if (!resultado.error) {
            alert('Información guardada correctamente');
            cerrarModal();
        } else {
            alert('Error: ' + (resultado.error || 'Error desconocido'));
        }
    })
    .catch(function(err) {
        console.error('Error guardando completar info:', err);
        alert('Error al guardar: ' + err.message);
    })
    .finally(function() {
        if (btn) {
            btn.textContent = '💾 Guardar Información';
            btn.disabled = false;
        }
    });
}

// ================== EXPORTAR A EXCEL ==================

// Función para exportar las filas seleccionadas a Excel real (.xlsx)
function exportarExcel() {
    if (filasSeleccionadas.length === 0) {
        alert('Selecciona al menos una card primero');
        return;
    }
    
    // Crear datos para exportar
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
    
    // Crear libro de trabajo con SheetJS
    var wb = XLSX.utils.book_new();
    var ws = XLSX.utils.json_to_sheet(datosAExportar);
    
    // Agregar columna con ancho automático
    var wscols = [
        {wch: 10}, {wch: 15}, {wch: 12}, {wch: 30}, {wch: 12}, 
        {wch: 15}, {wch: 15}, {wch: 20}, {wch: 15}
    ];
    ws['!cols'] = wscols;
    
    XLSX.utils.book_append_sheet(wb, ws, 'Solicitudes');
    
    // Generar nombre de archivo con fecha
    var fecha = getFechaHoraActual().replace(/[\s:]/g, '-');
    var nombreArchivo = 'solicitudes_seleccionadas_' + fecha + '.xlsx';
    
    // Descargar archivo Excel
    XLSX.writeFile(wb, nombreArchivo);
    
    alert('Se exportaron ' + datosAExportar.length + ' registros a Excel');
}

// ============================================================================
// NUEVA SOLICITUD MANUAL - Versión Móvil
// ============================================================================

let estadosDisponiblesMovil = [];
let segmentosDisponiblesMovil = [];

// Abrir modal de nueva solicitud (móvil)
async function abrirModalNuevaSolicitudMovil() {
    // Cargar estados y segmentos dinámicamente
    if (estadosDisponiblesMovil.length === 0) {
        try {
            var res = await fetch('/api/excel/dashboard/estados', { credentials: 'include' });
            if (res.ok) {
                var data = await res.json();
                estadosDisponiblesMovil = data.map(function(e) { return e.estado; });
                if (estadosDisponiblesMovil.indexOf('SIN ESTADO') === -1) estadosDisponiblesMovil.unshift('SIN ESTADO');
            }
        } catch (e) { console.error('Error cargando estados:', e); }
    }
    if (segmentosDisponiblesMovil.length === 0) {
        try {
            var res = await fetch('/api/excel/dashboard/segmentos', { credentials: 'include' });
            if (res.ok) {
                var data = await res.json();
                segmentosDisponiblesMovil = data.map(function(s) { return s.segmento; });
            }
        } catch (e) { console.error('Error cargando segmentos:', e); }
    }

    var estadosOptions = '<option value="SIN ESTADO">SIN ESTADO</option>';
    for (var i = 0; i < estadosDisponiblesMovil.length; i++) {
        if (estadosDisponiblesMovil[i] !== 'SIN ESTADO') {
            estadosOptions += '<option value="' + estadosDisponiblesMovil[i] + '">' + estadosDisponiblesMovil[i] + '</option>';
        }
    }

    var segmentosOptions = '<option value="">Sin segmento</option>';
    for (var i = 0; i < segmentosDisponiblesMovil.length; i++) {
        segmentosOptions += '<option value="' + segmentosDisponiblesMovil[i] + '">' + segmentosDisponiblesMovil[i] + '</option>';
    }

    var html = '';
    html += '<div class="ns-movil-overlay" id="ns-movil-overlay">';
    html += '  <div class="ns-movil-header">';
    html += '    <h2>➕ Nueva Solicitud</h2>';
    html += '    <button class="ns-close-btn" onclick="cerrarModalNuevaSolicitudMovil()" aria-label="Cerrar">✕</button>';
    html += '  </div>';
    html += '  <div class="ns-movil-body">';

    // Advertencia de duplicado
    html += '    <div class="ns-movil-duplicado-warning" id="ns-movil-duplicado-warning">⚠️ <span id="ns-movil-duplicado-msg"></span></div>';

    // Sección: Información Principal (campos más importantes primero)
    html += '    <div class="ns-movil-section ns-movil-section-primary">';
    html += '      <div class="ns-movil-section-title">📋 Información Principal</div>';
    html += '      <div class="ns-movil-field">';
    html += '        <label>🆔 Cédula <span class="required">*</span></label>';
    html += '        <input type="text" id="ns-movil-cedula" placeholder="10 dígitos" maxlength="10" inputmode="numeric" oninput="validarCedulaMovil()" onblur="verificarDuplicadoCedulaMovil()">';
    html += '        <div class="validation-feedback" id="ns-movil-cedula-feedback"></div>';
    html += '      </div>';
    html += '      <div class="ns-movil-field">';
    html += '        <label>📝 Nombre <span class="required">*</span></label>';
    html += '        <input type="text" id="ns-movil-nombre" placeholder="Nombre completo" oninput="validarNombreMovil()">';
    html += '        <div class="validation-feedback" id="ns-movil-nombre-feedback"></div>';
    html += '      </div>';
    html += '      <div class="ns-movil-field">';
    html += '        <label>📞 Teléfono <span class="required">*</span></label>';
    html += '        <input type="tel" id="ns-movil-celular" placeholder="0991234567" maxlength="10" inputmode="numeric" oninput="validarCelularMovil()">';
    html += '        <div class="validation-feedback" id="ns-movil-celular-feedback"></div>';
    html += '      </div>';
    html += '      <div class="ns-movil-field">';
    html += '        <label>🏷️ Segmento</label>';
    html += '        <select id="ns-movil-segmento">' + segmentosOptions + '</select>';
    html += '      </div>';
    html += '      <div class="ns-movil-field">';
    html += '        <label>📌 Estado <span class="required">*</span></label>';
    html += '        <select id="ns-movil-estado">' + estadosOptions + '</select>';
    html += '      </div>';
    html += '    </div>';

    // Sección: Información Adicional (campos secundarios / opcionales)
    html += '    <div class="ns-movil-section ns-movil-section-secondary">';
    html += '      <div class="ns-movil-section-title">📦 Más Información <span class="optional-badge">Opcional</span></div>';
    html += '      <div class="ns-movil-field">';
    html += '        <label>📦 Producto</label>';
    html += '        <input type="text" id="ns-movil-producto" placeholder="Ej: Crédito">';
    html += '      </div>';
    html += '      <div class="ns-movil-field">';
    html += '        <label>🔢 Código Plus</label>';
    html += '        <input type="text" id="ns-movil-codigo-plus" placeholder="Código interno">';
    html += '      </div>';
    html += '      <div class="ns-movil-field">';
    html += '        <label>📧 Correo Electrónico</label>';
    html += '        <input type="email" id="ns-movil-correo" placeholder="cliente@ejemplo.com" inputmode="email" oninput="validarCorreoMovil()">';
    html += '        <div class="validation-feedback" id="ns-movil-correo-feedback"></div>';
    html += '      </div>';
    html += '      <div class="ns-movil-field">';
    html += '        <label>📍 Dirección</label>';
    html += '        <input type="text" id="ns-movil-direccion" placeholder="Dirección domiciliaria">';
    html += '      </div>';
    html += '      <div class="ns-movil-field">';
    html += '        <label>💼 Ocupación</label>';
    html += '        <input type="text" id="ns-movil-ocupacion" placeholder="Ej: Comerciante">';
    html += '      </div>';
    html += '      <div class="ns-movil-field">';
    html += '        <label>💰 Ingreso Mensual</label>';
    html += '        <input type="number" id="ns-movil-ingreso" placeholder="0.00" step="0.01" min="0" inputmode="decimal">';
    html += '      </div>';
    html += '    </div>';

    html += '  </div>'; // fin body
    html += '  <div class="ns-movil-footer">';
    html += '    <button class="ns-btn-cancel" onclick="cerrarModalNuevaSolicitudMovil()">Cancelar</button>';
    html += '    <button class="ns-btn-submit" id="ns-movil-submit-btn" onclick="guardarNuevaSolicitudMovil()">💾 Guardar</button>';
    html += '  </div>';
    html += '</div>';

    // Agregar al body
    var modalExistente = document.getElementById('ns-movil-overlay');
    if (modalExistente) modalExistente.remove();
    document.body.insertAdjacentHTML('beforeend', html);

    // Foco inicial
    setTimeout(function() {
        var input = document.getElementById('ns-movil-nombre');
        if (input) input.focus();
    }, 300);
}

function cerrarModalNuevaSolicitudMovil() {
    var overlay = document.getElementById('ns-movil-overlay');
    if (overlay) overlay.remove();
}

// ===== VALIDACIONES MÓVIL =====

function validarNombreMovil() {
    var input = document.getElementById('ns-movil-nombre');
    var feedback = document.getElementById('ns-movil-nombre-feedback');
    if (!input || !feedback) return;
    var val = input.value.trim();
    if (val.length === 0) {
        input.className = 'error';
        feedback.className = 'validation-feedback error';
        feedback.textContent = '❌ El nombre es obligatorio';
    } else if (val.length < 3) {
        input.className = 'error';
        feedback.className = 'validation-feedback error';
        feedback.textContent = '❌ Mínimo 3 caracteres';
    } else {
        input.className = 'valid';
        feedback.className = 'validation-feedback ok';
        feedback.textContent = '✅ Válido';
    }
}

function validarCedulaMovil() {
    var input = document.getElementById('ns-movil-cedula');
    var feedback = document.getElementById('ns-movil-cedula-feedback');
    if (!input || !feedback) return;
    var val = input.value.replace(/\D/g, '');
    input.value = val;
    if (val.length === 0) {
        input.className = 'error';
        feedback.className = 'validation-feedback error';
        feedback.textContent = '❌ La cédula es obligatoria';
    } else if (val.length !== 10) {
        input.className = 'error';
        feedback.className = 'validation-feedback error';
        feedback.textContent = '❌ Debe tener 10 dígitos';
    } else {
        var suma = 0;
        for (var i = 0; i < 9; i++) {
            var digito = parseInt(val[i]);
            if (i % 2 === 0) {
                digito *= 2;
                if (digito > 9) digito -= 9;
            }
            suma += digito;
        }
        var digitoVerificador = (10 - (suma % 10)) % 10;
        if (parseInt(val[9]) === digitoVerificador) {
            input.className = 'valid';
            feedback.className = 'validation-feedback ok';
            feedback.textContent = '✅ Cédula válida';
        } else {
            input.className = 'error';
            feedback.className = 'validation-feedback error';
            feedback.textContent = '❌ Dígito verificador inválido';
        }
    }
}

function validarCelularMovil() {
    var input = document.getElementById('ns-movil-celular');
    var feedback = document.getElementById('ns-movil-celular-feedback');
    if (!input || !feedback) return;
    var val = input.value.replace(/\D/g, '');
    input.value = val;
    if (val.length === 0) {
        input.className = 'error';
        feedback.className = 'validation-feedback error';
        feedback.textContent = '❌ El celular es obligatorio';
    } else if (val.length !== 10) {
        input.className = 'error';
        feedback.className = 'validation-feedback error';
        feedback.textContent = '❌ Debe tener 10 dígitos';
    } else if (!val.startsWith('09')) {
        input.className = 'error';
        feedback.className = 'validation-feedback error';
        feedback.textContent = '❌ Debe empezar con 09';
    } else {
        input.className = 'valid';
        feedback.className = 'validation-feedback ok';
        feedback.textContent = '✅ Válido';
    }
}

function validarCorreoMovil() {
    var input = document.getElementById('ns-movil-correo');
    var feedback = document.getElementById('ns-movil-correo-feedback');
    if (!input || !feedback) return;
    var val = input.value.trim();
    if (val.length === 0) {
        input.className = '';
        feedback.className = 'validation-feedback';
        feedback.textContent = '';
    } else if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) {
        input.className = 'valid';
        feedback.className = 'validation-feedback ok';
        feedback.textContent = '✅ Formato válido';
    } else {
        input.className = 'error';
        feedback.className = 'validation-feedback error';
        feedback.textContent = '❌ Formato inválido';
    }
}

var debounceDuplicadoMovil = null;
function verificarDuplicadoCedulaMovil() {
    var input = document.getElementById('ns-movil-cedula');
    var warning = document.getElementById('ns-movil-duplicado-warning');
    var warningMsg = document.getElementById('ns-movil-duplicado-msg');
    if (!input || !warning || !warningMsg) return;
    var cedula = input.value.trim();
    if (cedula.length !== 10) { warning.classList.remove('visible'); return; }
    clearTimeout(debounceDuplicadoMovil);
    debounceDuplicadoMovil = setTimeout(async function() {
        try {
            var res = await fetch('/api/excel/solicitudes/buscar?q=' + encodeURIComponent(cedula) + '&limite=1', { credentials: 'include' });
            if (res.ok) {
                var data = await res.json();
                var solicitudes = data.data || [];
                if (solicitudes.length > 0) {
                    warning.classList.add('visible');
                    warningMsg.textContent = 'Ya existe una solicitud con esta cédula: #' + solicitudes[0].id_solicitud + ' - ' + (solicitudes[0].nombre || '');
                } else {
                    warning.classList.remove('visible');
                }
            }
        } catch (e) { console.error('Error:', e); }
    }, 500);
}

// ===== GUARDAR NUEVA SOLICITUD MÓVIL =====
async function guardarNuevaSolicitudMovil() {
    var nombre = document.getElementById('ns-movil-nombre').value.trim();
    var cedula = document.getElementById('ns-movil-cedula').value.trim();
    var celular = document.getElementById('ns-movil-celular').value.trim();

    if (!nombre) { document.getElementById('ns-movil-nombre').focus(); validarNombreMovil(); return; }
    if (!cedula || cedula.length !== 10) { document.getElementById('ns-movil-cedula').focus(); validarCedulaMovil(); return; }
    if (!celular || celular.length !== 10) { document.getElementById('ns-movil-celular').focus(); validarCelularMovil(); return; }

    var btn = document.getElementById('ns-movil-submit-btn');
    if (btn) { btn.disabled = true; btn.textContent = '⏳ Guardando...'; }

    try {
        var body = {
            nombre: nombre,
            cedula: cedula,
            celular: celular,
            estado: document.getElementById('ns-movil-estado').value,
            correo_electronico: document.getElementById('ns-movil-correo').value.trim() || undefined,
            segmento: document.getElementById('ns-movil-segmento').value || undefined,
            producto: document.getElementById('ns-movil-producto').value.trim() || undefined,
            codigo_plus: document.getElementById('ns-movil-codigo-plus').value.trim() || undefined,
            direccion: document.getElementById('ns-movil-direccion').value.trim() || undefined,
            ocupacion: document.getElementById('ns-movil-ocupacion').value.trim() || undefined,
            ingreso_mensual: document.getElementById('ns-movil-ingreso').value ? parseFloat(document.getElementById('ns-movil-ingreso').value) : undefined
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
            if (resultado.duplicado_advertencia) {
                msg += '\n⚠️ Ya existe otra con la misma cédula';
            }
            alert(msg);
            cerrarModalNuevaSolicitudMovil();
            if (typeof init === 'function') init();
        } else {
            alert('❌ Error: ' + (resultado.error || 'Error desconocido'));
        }
    } catch (error) {
        console.error('Error:', error);
        alert('❌ Error al guardar: ' + error.message);
    } finally {
        if (btn) { btn.disabled = false; btn.textContent = '💾 Guardar'; }
    }
}

// ============================================================================
// MENÚ CONTEXTUAL MÓVIL (⋮) - Editar / Eliminar en Cards
// ============================================================================

function toggleCardMenuMovil(event, id) {
    event.stopPropagation();
    cerrarTodosLosMenusMovil(id);
    var menu = document.getElementById('card-menu-movil-' + id);
    if (menu) {
        menu.classList.toggle('visible');
    }
}

function cerrarTodosLosMenusMovil(excludeId) {
    document.querySelectorAll('.card-dropdown-menu-movil').forEach(function(m) {
        if (excludeId && m.id === 'card-menu-movil-' + excludeId) return;
        m.classList.remove('visible');
    });
}

if (!window._cardMenuMovilListenerAttached) {
    window._cardMenuMovilListenerAttached = true;
    document.addEventListener('click', function(e) {
        if (!e.target.closest('.card-actions-more-movil')) {
            cerrarTodosLosMenusMovil();
        }
    });
}

// Abrir modal de edición de solicitud en móvil
async function abrirEditarSolicitudMovil(id) {
    var datos = datosFilas[id];
    if (!datos) {
        // Intentar cargar desde el servidor
        try {
            var res = await fetch('/api/excel/solicitudes/' + id, { credentials: 'include' });
            if (!res.ok) {
                alert('No se encontraron datos para esta solicitud');
                return;
            }
            datos = await res.json();
            datosFilas[id] = datos;
        } catch (e) {
            console.error('Error cargando solicitud:', e);
            alert('No se encontraron datos para esta solicitud');
            return;
        }
    }
    
    // Cargar estados y segmentos disponibles
    var estadosOptions = '<option value="">Seleccionar...</option>';
    var segmentosOptions = '<option value="">Seleccionar...</option>';
    
    try {
        var resEstados = await fetch('/api/excel/dashboard/estados', { credentials: 'include' });
        if (resEstados.ok) {
            var estadosData = await resEstados.json();
            estadosOptions = '<option value="">Seleccionar...</option>';
            for (var e = 0; e < estadosData.length; e++) {
                var selected = estadosData[e].estado === datos.estado ? 'selected' : '';
                estadosOptions += '<option value="' + estadosData[e].estado + '" ' + selected + '>' + estadosData[e].estado + '</option>';
            }
        }
    } catch (err) { console.error('Error cargando estados:', err); }
    
    try {
        var resSegmentos = await fetch('/api/excel/dashboard/segmentos', { credentials: 'include' });
        if (resSegmentos.ok) {
            var segmentosData = await resSegmentos.json();
            segmentosOptions = '<option value="">Seleccionar...</option>';
            for (var s = 0; s < segmentosData.length; s++) {
                var selected = segmentosData[s].segmento === datos.segmento ? 'selected' : '';
                segmentosOptions += '<option value="' + segmentosData[s].segmento + '" ' + selected + '>' + segmentosData[s].segmento + '</option>';
            }
        }
    } catch (err) { console.error('Error cargando segmentos:', err); }
    
    // Construir contenido del modal móvil
    var contenido = '';
    contenido += '<div class="editar-movil-container" style="padding: 0; background: white; min-height: 100vh; display: flex; flex-direction: column;">';
    contenido += '  <div class="editar-movil-header" style="display: flex; justify-content: space-between; align-items: center; padding: 16px 20px; border-bottom: 1px solid #e5e7eb; background: #f9fafb; position: sticky; top: 0; z-index: 10;">';
    contenido += '    <h2 style="margin: 0; font-size: 17px; color: #1f2937; font-weight: 700;">✏️ Editar Solicitud #' + id + '</h2>';
    contenido += '    <button onclick="cerrarModal()" style="background: transparent; border: none; font-size: 22px; cursor: pointer; color: #6b7280; width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; border-radius: 50%;">✕</button>';
    contenido += '  </div>';
    
    contenido += '  <div style="padding: 16px 20px; flex: 1; overflow-y: auto;">';
    
    // Información del cliente
    contenido += '    <div style="background: #f3f4f6; border-radius: 10px; padding: 14px; margin-bottom: 16px; font-size: 13px;">';
    contenido += '      <p style="margin: 0 0 6px 0;"><strong>👤 Cliente:</strong> ' + (datos.nombre || 'N/A') + '</p>';
    contenido += '      <p style="margin: 0 0 6px 0;"><strong>🆔 Cédula:</strong> ' + (datos.cedula || 'N/A') + '</p>';
    contenido += '      <p style="margin: 0;"><strong>📱 Celular:</strong> ' + (datos.celular || 'N/A') + '</p>';
    contenido += '    </div>';
    
    // Campos editables
    contenido += '    <div style="border: 2px solid #818cf8; border-radius: 10px; padding: 16px; background: #eef2ff; margin-bottom: 16px;">';
    contenido += '      <h3 style="margin: 0 0 14px 0; color: #4338ca; font-size: 15px; font-weight: 700;">📝 Campos Editables</h3>';
    
    contenido += '      <div style="margin-bottom: 14px;">';
    contenido += '        <label for="editar-estado-movil" style="display: block; font-weight: 600; margin-bottom: 6px; font-size: 13px; color: #374151;">📌 Estado</label>';
    contenido += '        <select id="editar-estado-movil" style="width: 100%; padding: 12px 14px; border: 2px solid #c7d2fe; border-radius: 8px; font-size: 15px; background: white; color: #1f2937; appearance: auto;">' + estadosOptions + '</select>';
    contenido += '      </div>';
    
    contenido += '      <div style="margin-bottom: 4px;">';
    contenido += '        <label for="editar-segmento-movil" style="display: block; font-weight: 600; margin-bottom: 6px; font-size: 13px; color: #374151;">🏷️ Segmento</label>';
    contenido += '        <select id="editar-segmento-movil" style="width: 100%; padding: 12px 14px; border: 2px solid #c7d2fe; border-radius: 8px; font-size: 15px; background: white; color: #1f2937; appearance: auto;">' + segmentosOptions + '</select>';
    contenido += '      </div>';
    
    contenido += '    </div>';
    contenido += '  </div>';
    
    // Footer con botones
    contenido += '  <div style="padding: 16px 20px; border-top: 1px solid #e5e7eb; background: white; display: flex; gap: 10px;">';
    contenido += '    <button onclick="cerrarModal()" style="flex: 1; padding: 14px; background: #f3f4f6; border: none; border-radius: 10px; font-size: 15px; font-weight: 600; color: #374151; cursor: pointer;">Cancelar</button>';
    contenido += '    <button id="editar-btn-save-movil" onclick="guardarEditarSolicitudMovil(\'' + id + '\')" style="flex: 1; padding: 14px; background: #6366f1; color: white; border: none; border-radius: 10px; font-size: 15px; font-weight: 600; cursor: pointer;">💾 Guardar Cambios</button>';
    contenido += '  </div>';
    contenido += '</div>';
    
    crearModalMovil(contenido);
}

// Guardar cambios de edición en móvil
async function guardarEditarSolicitudMovil(id) {
    var estado = document.getElementById('editar-estado-movil').value;
    var segmento = document.getElementById('editar-segmento-movil').value;
    
    var btn = document.getElementById('editar-btn-save-movil');
    if (btn) { btn.disabled = true; btn.textContent = '⏳ Guardando...'; }
    
    try {
        var body = {};
        if (estado) body.estado = estado;
        if (segmento) body.segmento = segmento;
        
        if (!body.estado && !body.segmento) {
            alert('Selecciona al menos un campo para actualizar');
            if (btn) { btn.disabled = false; btn.textContent = '💾 Guardar Cambios'; }
            return;
        }
        
        var response = await fetch('/api/excel/solicitudes/' + id + '/editar', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(body)
        });
        
        var resultado = await response.json();
        
        if (response.ok) {
            alert('✅ Solicitud #' + id + ' actualizada correctamente');
            cerrarModal();
            if (typeof init === 'function') init();
        } else {
            alert('❌ Error: ' + (resultado.error || 'Error desconocido'));
        }
    } catch (error) {
        console.error('Error guardando edición:', error);
        alert('❌ Error al guardar: ' + error.message);
    } finally {
        if (btn) { btn.disabled = false; btn.textContent = '💾 Guardar Cambios'; }
    }
}

function confirmarEliminarSolicitudMovil(id) {
    var datos = datosFilas[id];
    var nombre = datos ? (datos.nombre || 'desconocido') : 'desconocido';
    
    if (!confirm('¿Eliminar solicitud #' + id + ' de ' + nombre + '?\n\nEsta acción NO se puede deshacer.')) {
        return;
    }
    
    eliminarSolicitudMovil(id);
}

async function eliminarSolicitudMovil(id) {
    try {
        var response = await fetch('/api/excel/solicitudes/' + id, {
            method: 'DELETE',
            credentials: 'include'
        });
        var resultado = await response.json();
        
        if (response.ok) {
            alert('✅ Solicitud eliminada');
            if (typeof init === 'function') init();
        } else {
            alert('❌ Error: ' + (resultado.error || 'Error desconocido'));
        }
    } catch (error) {
        console.error('Error:', error);
        alert('❌ Error al eliminar');
    }
}

// Iniciar al cargar página
window.addEventListener('DOMContentLoaded', function() {
    init();
    
    // Auto-abrir modal si viene del dashboard
    if (sessionStorage.getItem('abrirNuevaSolicitud') === 'true') {
        sessionStorage.removeItem('abrirNuevaSolicitud');
        setTimeout(function() {
            abrirModalNuevaSolicitudMovil();
        }, 500);
    }
});
