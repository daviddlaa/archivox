// Solicitudes móvil - cards con buscador en tiempo real
let todosDatos = [];
let datosFilas = {};
let filasSeleccionadas = [];
let filtros = { estado: '', segmento: '', busqueda: '' };
let ultimasGestiones = {}; // Almacenar última gestión de cada solicitud

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

function actualizarContador() {
    const contador = document.getElementById('seleccionadas-count');
    const actionsFloating = document.getElementById('actions-floating');
    
    if (contador) contador.textContent = filasSeleccionadas.length;
    if (actionsFloating) {
        actionsFloating.style.display = filasSeleccionadas.length > 0 ? 'flex' : 'none';
    }
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
        
        const res = await fetch('/api/excel/solicitudes?limite=50&offset=0');
        var result = await res.json();
        
        // Compatibilidad: el backend ahora devuelve { data, total, limite, offset } o array directo
        var datosRecibidos = Array.isArray(result) ? result : (result.data || []);
        
        // Guardar datos
        todosDatos = datosRecibidos;
        currentOffset = datosRecibidos.length;
        
        // Verificar si hay más datos
        var total = Array.isArray(result) ? result.length : (result.total || 0);
        hasMoreData = datosRecibidos.length < total;
        
        document.getElementById('totalRegistros').textContent = total;
        
        // Cargar últimas gestines de cada solicitud
        await cargarUltimasGestiones();
        
        renderizarFiltros();
        aplicarFiltros();
        
        // Inicializar infinite scroll
        initInfiniteScroll();
        
        console.log('Datos cargados:', todosDatos.length, 'total:', total);
    } catch (e) {
        console.error('Error cargando:', e);
    }
}

// Cargar más datos (para infinite scroll)
async function cargarMas() {
    if (isLoading || !hasMoreData) return;
    
    isLoading = true;
    
    // Mostrar indicador de carga
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
            // Agregar nuevos datos a la lista
            for (var i = 0; i < nuevosDatos.length; i++) {
                todosDatos.push(nuevosDatos[i]);
            }
            
            currentOffset += nuevosDatos.length;
            
            // Verificar si hay más datos
            var total = Array.isArray(result) ? result.length : (result.total || 0);
            hasMoreData = currentOffset < total;
            
// Actualizar visualización
            aplicarFiltros();
            
            console.log('Más datos cargados:', nuevosDatos.length, 'total en memoria:', todosDatos.length);
        } else {
            hasMoreData = false;
        }
        
    } catch (error) {
        console.error('Error cargando más datos:', error);
    } finally {
        isLoading = false;
        
        // Actualizar indicador
        if (sentinel) {
            if (hasMoreData) {
                sentinel.innerHTML = '<span class="loader-text">📜 Scroll para cargar más...</span>';
            } else {
                sentinel.innerHTML = '<span class="loader-text">✅ No hay más registros</span>';
            }
        }
    }
}

// Cargar últimas gestines de cada solicitud - EN LOTES PEQUEÑOS
async function cargarUltimasGestiones() {
    try {
        // Obtener IDs únicos de las solicitudes
        const ids = todosDatos.map(d => d.id_solicitud).filter(Boolean);
        
        if (ids.length === 0) return;
        
        // Cargar en lotes de 25 para evitar errores
        const TAMANO_LOTE = 25;
        
        for (let i = 0; i < ids.length; i += TAMANO_LOTE) {
            const lote = ids.slice(i, i + TAMANO_LOTE);
            
            try {
                const idsString = lote.join(',');
                const res = await fetch('/api/excel/gestiones/ultimas?ids=' + encodeURIComponent(idsString));
                
                if (res.ok) {
                    const gestionsObj = await res.json();
                    // Merge con las existentes
                    for (const id in gestionsObj) {
                        ultimasGestiones[id] = gestionsObj[id];
                    }
                } else {
                    // Fallback para este lote: cargar una por una
                    for (const id of lote) {
                        try {
                            const res2 = await fetch('/api/excel/gestiones/' + id);
                            if (res2.ok) {
                                const gestines = await res2.json();
                                if (gestines && gestines.length > 0) {
                                    ultimasGestiones[id] = gestines[0];
                                }
                            }
                        } catch (e) {
                            // Silenciar errores
                        }
                    }
                }
            } catch (e) {
                // Fallback para este lote
                for (const id of lote) {
                    try {
                        const res2 = await fetch('/api/excel/gestiones/' + id);
                        if (res2.ok) {
                            const gestines = await res2.json();
                            if (gestines && gestines.length > 0) {
                                ultimasGestiones[id] = gestines[0];
                            }
                        }
                    } catch (e2) {
                        // Silenciar
                    }
                }
            }
            
            // Delay pequeño entre lotes para evitar rate limit
            if (i + TAMANO_LOTE < ids.length) {
                await new Promise(r => setTimeout(r, 150));
            }
        }
        
        console.log('Últimas gestines cargadas:', Object.keys(ultimasGestiones).length);
    } catch (e) {
        console.error('Error en cargarUltimasGestiones:', e);
    }
}

// Renderizar botones de filtros dinámicos
function renderizarFiltros() {
    // Estados
    const estados = [...new Set(todosDatos.map(d => d.estado).filter(Boolean))];
    const estadoBtns = document.getElementById('filtro-estado');
    estadoBtns.innerHTML = '<button class="btn active" data-value="">Todos</button>';
    estados.forEach(e => {
        estadoBtns.innerHTML += `<button class="btn" data-value="${e}">${e}</button>`;
    });
    
    // Segmentos
    const segmentos = [...new Set(todosDatos.map(d => d.segmento).filter(Boolean))];
    const segmentoBtns = document.getElementById('filtro-segmento');
    segmentoBtns.innerHTML = '<button class="btn active" data-value="">Todos</button>';
    segmentos.forEach(s => {
        segmentoBtns.innerHTML += `<button class="btn" data-value="${s}">${s}</button>`;
    });
    
    // Adjuntar eventos
    adjuntarEventos();
}

// Adjuntar eventos a los botones
function adjuntarEventos() {
    // Estado buttons
    document.querySelectorAll('#filtro-estado .btn').forEach(btn => {
        btn.onclick = function() {
            document.querySelectorAll('#filtro-estado .btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            filtros.estado = this.dataset.value;
            aplicarFiltros();
        };
    });
    
    // Segmento buttons
    document.querySelectorAll('#filtro-segmento .btn').forEach(btn => {
        btn.onclick = function() {
            document.querySelectorAll('#filtro-segmento .btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            filtros.segmento = this.dataset.value;
            aplicarFiltros();
        };
    });
    
    // Buscador en tiempo real
    const input = document.getElementById('cedula');
    input.oninput = function() {
        filtros.busqueda = this.value.toLowerCase();
        aplicarFiltros();
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

// Renderizar cards de clientes
function renderizarCards(datos) {
    const container = document.getElementById('cards-container');
    if (!datos.length) {
        container.innerHTML = '<div class="no-data">No hay solicitudes</div>';
        return;
    }
    
    // Limpiar datosFilas al renderizar
    datosFilas = {};
    
    // Guardar sentinel existente antes de reemplazar
    var sentinelExistente = document.getElementById('infinite-scroll-sentinel');
    
    container.innerHTML = datos.map(d => {
        // Guardar datos para usar después
        datosFilas[d.id_solicitud] = d;
        
        const seleccionado = filasSeleccionadas.indexOf(d.id_solicitud) > -1 ? 'seleccionada' : '';
        
        // Obtener última gestión si existe
        const ultimaGestion = ultimasGestiones[d.id_solicitud];
        let gestionHTML = '';
        
        if (ultimaGestion) {
            const fechaCorta = formatFechaGestion(ultimaGestion.fecha_gestion);
            const obsCorta = ultimaGestion.observacion ? (ultimaGestion.observacion.length > 50 ? ultimaGestion.observacion.substring(0, 50) + '...' : ultimaGestion.observacion) : 'Sin observación';
            gestionHTML = `
            <div class="ultima-gestion" style="margin: 10px 0; padding: 10px; background: #f8fafc; border-radius: 8px; border-left: 3px solid #2563eb;">
                <div style="font-size: 11px; color: #6b7280; font-weight: 600;">📋 ${ultimaGestion.tipo_gestion || 'N/A'}</div>
                <div style="font-size: 12px; color: #374151; margin-top: 4px;">${obsCorta}</div>
                <div style="font-size: 10px; color: #9ca3af; margin-top: 4px;">${fechaCorta}</div>
            </div>
            `;
        }
        
return `
        <div class="client-card ${seleccionado}" id="card-${d.id_solicitud}" onclick="toggleCard('${d.id_solicitud}')">
            <div class="card-head">
                <span class="client-id">#${d.id_solicitud}</span>
                <span class="badge estado-${d.estado}">${d.estado || 'N/A'}</span>
            </div>
            <div class="client-name">${d.nombre || 'Sin nombre'}</div>
            <div class="client-cedula">Cédula: ${d.cedula || 'N/A'}</div>
            <div class="client-celular">📱 ${d.celular || 'N/A'}</div>
            
            <!-- Última Gestión -->
            ${gestionHTML}
            
            <div class="input-codigo-plus-container" style="margin: 8px 0;">
                <input type="text" class="input-codigo-plus" value="${d.codigo_plus || ''}" data-id="${d.id_solicitud}" placeholder="Código Plus" autocomplete="off" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:6px;font-size:12px;" onblur="guardarCodigoPlus(this)">
            </div>
            <div class="card-acciones" style="margin: 8px 0; display: flex; gap: 8px;">
                <button class="btn-accion-movil btn-gestiones-movil" onclick="event.stopPropagation(); abrirGestionesMovil('${d.id_solicitud}')" style="flex:1; padding: 8px; background: #fef3c7; border: none; border-radius: 6px; font-size: 12px; cursor: pointer;">📋 Gestiones</button>
                <button class="btn-accion-movil btn-completar-movil" onclick="event.stopPropagation(); abrirCompletarMovil('${d.id_solicitud}')" style="flex:1; padding: 8px; background: #d1fae5; border: none; border-radius: 6px; font-size: 12px; cursor: pointer;">✏️ Completar</button>
            </div>
            <div class="tags">
                <span class="tag">${d.segmento || 'N/A'}</span>
                <span class="tag">${d.producto || 'N/A'}</span>
                <span class="tag">${d.fecha_solicitud || 'N/A'}</span>
            </div>
        </div>
`;
    }).join('');
    
    // Recrear el sentinel para infinite scroll
    recrearSentinel();
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

// ================== CÓDIGO PLUS ==================

// Guardar código plus cuando el input pierde el foco
function guardarCodigoPlus(input) {
    var id = input.dataset.id;
    var codigo_plus = input.value.trim();
    
    // Mostrar indicador de guardado
    input.style.backgroundColor = '#fef3c7';
    
    fetch('/api/excel/solicitudes/' + id + '/codigo-plus', {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ codigo_plus: codigo_plus })
    })
    .then(function(response) {
        return response.json();
    })
    .then(function(resultado) {
        if (response.ok) {
            // Mostrar guardado exitoso
            input.style.backgroundColor = '#dcfce7';
            setTimeout(function() {
                input.style.backgroundColor = '';
            }, 1000);
            console.log('Código Plus guardado:', resultado);
        } else {
            // Mostrar error
            input.style.backgroundColor = '#fee2e2';
            console.error('Error:', resultado.error);
            alert('Error al guardar: ' + resultado.error);
        }
    })
    .catch(function(err) {
        console.error('Error guardando código plus:', err);
        input.style.backgroundColor = '#fee2e2';
    });
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

// Iniciar al cargar página
window.addEventListener('DOMContentLoaded', init);
