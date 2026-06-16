console.log('Cargando solicitudes.js...');

// Funciones del menú hamburguesa
function toggleMenu() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.querySelector('.menu-overlay');
    sidebar.classList.toggle('movil');
    sidebar.classList.toggle('active');
    overlay.classList.toggle('active');
}

// Funciones de selección de filas
var filasSeleccionadas = [];
var datosFilas = {}; // Almacenar datos de cada fila por id

function toggleFilaCheckbox(checkbox) {
    var fila = checkbox.closest('tr');
    var id = checkbox.value;
    
    if (checkbox.checked) {
        if (filasSeleccionadas.indexOf(id) === -1) {
            filasSeleccionadas.push(id);
        }
        fila.classList.add('fila-seleccionada');
    } else {
        var index = filasSeleccionadas.indexOf(id);
        if (index > -1) {
            filasSeleccionadas.splice(index, 1);
        }
        fila.classList.remove('fila-seleccionada');
    }
    
    actualizarCheckboxes();
    actualizarContador();
    console.log('Filas seleccionadas:', filasSeleccionadas);
}

function seleccionarTodos() {
    var checkboxTodos = document.getElementById('seleccionar-todos');
    var checkboxes = document.querySelectorAll('.checkbox-fila');
    
    if (checkboxTodos.checked) {
        filasSeleccionadas = [];
        checkboxes.forEach(function(cb) {
            cb.checked = true;
            var fila = cb.closest('tr');
            var id = cb.value;
            if (filasSeleccionadas.indexOf(id) === -1) {
                filasSeleccionadas.push(id);
            }
            fila.classList.add('fila-seleccionada');
        });
    } else {
        checkboxes.forEach(function(cb) {
            cb.checked = false;
        });
        filasSeleccionadas = [];
        checkboxes.forEach(function(cb) {
            var fila = cb.closest('tr');
            fila.classList.remove('fila-seleccionada');
        });
    }
    
    actualizarContador();
    console.log('Filas seleccionadas:', filasSeleccionadas);
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
    var btnWhatsApp = document.getElementById('btn-whatsapp');
    
    if (contador) {
        contador.textContent = filasSeleccionadas.length;
    }
    
    // Mostrar/ocultar botón de WhatsApp según selección
    if (btnWhatsApp) {
        if (filasSeleccionadas.length > 0) {
            btnWhatsApp.style.display = 'inline-flex';
        } else {
            btnWhatsApp.style.display = 'none';
        }
    }
}

function obtenerFilasSeleccionadas() {
    return filasSeleccionadas;
}

// Función para enviar a WhatsApp
function enviarWhatsApp() {
    if (filasSeleccionadas.length === 0) {
        alert('Selecciona al menos una fila primero');
        return;
    }
    
    var mensaje = 'Hola, te comparto los datos de las solicitudes:\n\n';
    
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
    
    // Codificar mensaje para WhatsApp
    var urlWhatsApp = 'https://wa.me/?text=' + encodeURIComponent(mensaje);
    window.open(urlWhatsApp, '_blank');
}

// Función para copiar datos
function copiarDatos() {
    if (filasSeleccionadas.length === 0) {
        alert('Selecciona al menos una fila primero');
        return;
    }
    
    var texto = '';
    
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

// Variable para almacenar últimas gestiones
var ultimasGestiones = {};

// Cargar últimas gestiones para todas las solicitudes -VERSION LIMITADA (50 MAX)
async function cargarUltimasGestiones(ids) {
    if (!ids || ids.length === 0) return;
    
    ultimasGestiones = {};
    
    // Limitar a 50 para evitar error 500 por query muy larga
    var idsLimitados = ids.slice(0, 50);
    
    console.log('Cargando gestinesÚltimas para:', idsLimitados.length, 'solicitudes (de', ids.length, ')');
    
    try {
        // UNA SOLA PETICIÓN con máximo 50 IDs
        var idsString = idsLimitados.join(',');
        var response = await fetch('/api/excel/gestiones/ultimas?ids=' + encodeURIComponent(idsString));
        
        if (response.ok) {
            var gestionessObj = await response.json();
            ultimasGestiones = gestionessObj;
            console.log('Gestines cargadas:', Object.keys(ultimasGestiones).length);
        } else {
            console.error('Error en endpoint batch:', response.status);
        }
    } catch (error) {
        console.error('Error cargando gestines:', error);
    }
}

// Renderizar cards para móvil y escritorio - versión completa con última gestión
function renderizarCards(datos) {
    var container = document.getElementById('cards-container');
    if (!container) return;
    
    if (!datos.length) {
        container.innerHTML = '<div style="text-align:center;padding:40px;color:#6b7280;font-size:16px;grid-column:1/-1;">No se encontraron registros</div>';
        return;
    }
    
    var html = '';
    var coloresEstado = {
        'ACTIVADA': '#dcfce7',
        'RECHAZADA': '#fee2e2',
        'DEVUELTA': '#fef3c7',
        'APROBADA PARA LIBERACIÓN': '#d1fae5'
    };
    
    var coloresTipo = {
        'Seguimiento': '#dbeafe',
        'Cobranza': '#fee2e2',
        'Llamada': '#d1fae5',
        'WhatsApp': '#dcfce7',
        'Reclamo': '#fef3c7',
        'Cita': '#e0e7ff',
        'Otro': '#f3f4f6'
    };
    
    for (var i = 0; i < datos.length; i++) {
        var item = datos[i];
        var estadoClase = (item.estado || '').replace(/ /g, '-').toUpperCase();
        var colorEstado = coloresEstado[item.estado] || '#f3f4f6';
        var id = item.id_solicitud || '';
        var seleccionado = filasSeleccionadas.indexOf(id) > -1 ? 'fila-seleccionada' : '';
        
// Obtener última gestión - convertir id a string para buscar en objeto
        var ultGestion = ultimasGestiones[String(id)];
        var colorGestion = ultGestion ? (coloresTipo[ultGestion.tipo_gestion] || '#f3f4f6') : '#f3f4f6';
        
        html += '<div class="cliente-card ' + seleccionado + '" data-id="' + id + '">';
        
        // Header con checkbox y estado
        html += '  <div class="cliente-header">';
        html += '    <input type="checkbox" class="cliente-checkbox checkbox-fila" value="' + id + '" ' + (seleccionado ? 'checked' : '') + '>';
        html += '    <span class="cliente-id">#' + id + '</span>';
        html += '    <span class="cliente-estado" style="background:' + colorEstado + ';">' + (item.estado || '') + '</span>';
        html += '  </div>';
        
        // Nombre del cliente
        html += '  <div class="cliente-nombre">' + (item.nombre || '') + '</div>';
        
        // Info row: Cédula y Celular
        html += '  <div class="cliente-info-row">';
        html += '    <span>📍 ' + (item.cedula || '—') + '</span>';
        html += '    <span>📱 ' + (item.celular || '—') + '</span>';
        html += '  </div>';
        
        // Detalles
        html += '  <div class="cliente-detalle">';
        html += '    <span class="cliente-tag">🏷️ ' + (item.segmento || '—') + '</span>';
        html += '    <span class="cliente-tag">📦 ' + (item.producto || '—') + '</span>';
        html += '    <span class="cliente-tag">📅 ' + (item.fecha_solicitud || '—') + '</span>';
        html += '  </div>';
        
        // Última gestión (si existe)
        if (ultGestion) {
            html += '  <div class="cliente-ultima-gestion" style="background:' + colorGestion + '; padding: 10px; border-radius: 8px; margin-top: 8px;">';
            html += '    <div style="font-size: 11px; font-weight: 700; color: #1f2937; margin-bottom: 4px;">📋 Última Gestión: ' + (ultGestion.tipo_gestion || '') + '</div>';
            html += '    <div style="font-size: 12px; color: #374151; line-height: 1.3;">' + (ultGestion.observacion || '') + '</div>';
            html += '    <div style="font-size: 10px; color: #6b7280; margin-top: 4px;">📅 ' + formatFechaGestion(ultGestion.fecha_gestion) + '</div>';
            html += '  </div>';
        } else {
            html += '  <div class="cliente-ultima-gestion" style="background:#f3f4f6; padding: 10px; border-radius: 8px; margin-top: 8px;">';
            html += '    <div style="font-size: 12px; color: #6b7280; font-style: italic;">Sin gestiones registradas</div>';
            html += '  </div>';
        }
        
        // Botones de acciones
        html += '  <div class="card-actions">';
        html += '    <button class="card-action-btn card-gestiones-btn" onclick="abrirGestiones(\'' + id + '\')">📋 Gestiones</button>';
        html += '    <button class="card-action-btn card-completar-btn" onclick="abrirCompletar(\'' + id + '\')">✏️ Completar</button>';
        html += '  </div>';
        
        html += '</div>';
    }
    
    container.innerHTML = html;
}

// Variables para filtros activos
var estadoActual = '';
var segmentoActual = '';
var ordenActual = 'DESC';
var columnaOrdenar = 'id_solicitud';
var todosDatos = []; // Almacenar todos los datos para filtrar localmente
var filtros = { estado: '', segmento: '', busqueda: '' };

// Cargar los totales
async function cargarTotales() {
    try {
        var response = await fetch('/api/excel/dashboard');
        var datos = await response.json();
        document.getElementById('totalRegistros').textContent = datos.total;
    } catch (error) {
        console.error('Error cargando totals:', error);
    }
}

// Cargar segmentos
async function cargarSegmentos() {
    try {
        var response = await fetch('/api/excel/dashboard/segmentos');
        var datos = await response.json();
        
        var container = document.getElementById('filtro-segmento');
        container.innerHTML = '<button class="filter-btn active" data-value="">Todos</button>';
        
        for (var i = 0; i < datos.length; i++) {
            var seg = datos[i];
            var btn = document.createElement('button');
            btn.className = 'filter-btn';
            btn.dataset.value = seg.segmento;
            btn.textContent = seg.segmento;
            container.appendChild(btn);
        }
        
        configurarEventosBotones();
        
    } catch (error) {
        console.error('Error cargando segmentos:', error);
    }
}

// Cargar estados
async function cargarEstados() {
    try {
        var response = await fetch('/api/excel/dashboard/estados');
        var datos = await response.json();
        
        var container = document.getElementById('filtro-estado');
        container.innerHTML = '<button class="filter-btn active" data-value="">Todos</button>';
        
        var map = {
            'ACTIVADA': 'ACTIVADA',
            'RECHAZADA': 'RECHAZADA', 
            'DEVUELTA': 'DEVUELTA',
            'APROBADA PARA LIBERACIÓN': 'APROBADA'
        };
        
        for (var i = 0; i < datos.length; i++) {
            var est = datos[i];
            var btn = document.createElement('button');
            btn.className = 'filter-btn';
            btn.dataset.value = est.estado;
            btn.textContent = map[est.estado] || est.estado;
            container.appendChild(btn);
        }
        
        configurarEventosBotones();
        
    } catch (error) {
        console.error('Error cargando estados:', error);
    }
}

// Configurar eventos de los botones
function configurarEventosBotones() {
    // Botones de estado
    var botonesEstado = document.querySelectorAll('#filtro-estado .filter-btn');
    for (var i = 0; i < botonesEstado.length; i++) {
        botonesEstado[i].onclick = function() {
            var botones = document.querySelectorAll('#filtro-estado .filter-btn');
            for (var j = 0; j < botones.length; j++) {
                botones[j].classList.remove('active');
            }
            this.classList.add('active');
            estadoActual = this.dataset.value;
            aplicarFiltros();
        };
    }
    
    // Botones de segmento
    var botonesSegmento = document.querySelectorAll('#filtro-segmento .filter-btn');
    for (var i = 0; i < botonesSegmento.length; i++) {
        botonesSegmento[i].onclick = function() {
            var botones = document.querySelectorAll('#filtro-segmento .filter-btn');
            for (var j = 0; j < botones.length; j++) {
                botones[j].classList.remove('active');
            }
            this.classList.add('active');
            segmentoActual = this.dataset.value;
            aplicarFiltros();
        };
    }
}

// Ordenar por columna
function ordenarPorColumna(columna) {
    if (columnaOrdenar === columna) {
        ordenActual = ordenActual === 'ASC' ? 'DESC' : 'ASC';
    } else {
        columnaOrdenar = columna;
        ordenActual = 'ASC';
    }
    cargarSolicitudes();
}

// Actualizar encabezados
function actualizarEncabezados() {
    var encabezados = document.querySelectorAll('th.sortable');
    for (var i = 0; i < encabezados.length; i++) {
        var th = encabezados[i];
        var col = th.dataset.columna;
        var texto = th.textContent.replace(' ↑', '').replace(' ↓', '');
        if (col === columnaOrdenar) {
            th.textContent = texto + (ordenActual === 'ASC' ? ' ↑' : ' ↓');
        } else {
            th.textContent = texto;
        }
    }
}

// ================== NUEVO SISTEMA DE BÚSQUEDA LOCAL (COMO MÓVIL) ==================

// Cargar todos los datos al iniciar
async function init() {
    try {
        var response = await fetch('/api/excel/solicitudes');
        todosDatos = await response.json();
        
        document.getElementById('totalRegistros').textContent = todosDatos.length;
        
        // Cargar últimas gestiones para todas las solicitudes
        var ids = todosDatos.map(function(d) { return d.id_solicitud; });
        await cargarUltimasGestiones(ids);
        
        // renderizarFiltros() - Los segmentos y estados ya se cargan desde el dashboard
        aplicarFiltros();
        
        console.log('Datos cargados:', todosDatos.length);
    } catch (error) {
        console.error('Error cargando datos:', error);
    }
}

// Aplicar filtros localmente (igual que móvil)
function aplicarFiltros() {
    var inputBusqueda = document.getElementById('cedula');
    var busqueda = inputBusqueda ? inputBusqueda.value.toLowerCase() : '';
    
    var filtrados = todosDatos.filter(function(d) {
        // Filtro por estado
        if (estadoActual && d.estado !== estadoActual) return false;
        
        // Filtro por segmento  
        if (segmentoActual && d.segmento !== segmentoActual) return false;
        
        // Búsqueda por cédula, nombre o celular
        if (busqueda) {
            var matchCedula = d.cedula && d.cedula.toString().toLowerCase().includes(busqueda);
            var matchNombre = d.nombre && d.nombre.toLowerCase().includes(busqueda);
            var matchCelular = d.celular && d.celular.toString().includes(busqueda);
            if (!matchCedula && !matchNombre && !matchCelular) return false;
        }
        
        return true;
    });
    
    document.getElementById('mostrando').textContent = filtrados.length;
    renderizarTabla(filtrados);
}

// Renderizar tabla con los datos filtrados
function renderizarTabla(datos) {
    var tabla = document.getElementById('tabla');
    
    if (!datos.length) {
        tabla.innerHTML = '<tr><td colspan="9" style="text-align:center;padding:20px;">No se encontraron registros</td></tr>';
        return;
    }
    
    var html = '';
    datosFilas = {}; // Limpiar datos anteriores
    
    for (var i = 0; i < datos.length; i++) {
        var item = datos[i];
        var estadoClase = (item.estado || '').replace(/ /g, '-').toUpperCase();
        var id = item.id_solicitud || '';
        var seleccionado = filasSeleccionadas.indexOf(id) > -1 ? 'checked' : '';
        
        // Guardar datos para usar después
        datosFilas[id] = item;
        
        html += '<tr' + (seleccionado ? ' class="fila-seleccionada"' : '') + '>';
        html += '<td class="td-checkbox"><input type="checkbox" class="checkbox-fila" value="' + id + '" ' + seleccionado + '></td>';
        html += '<td>' + id + '</td>';
        html += '<td><span class="estado estado-' + estadoClase + '">' + (item.estado || '') + '</span></td>';
        html += '<td>' + (item.cedula || '') + '</td>';
        html += '<td>' + (item.nombre || '') + '</td>';
        html += '<td>' + (item.celular || '') + '</td>';
        html += '<td><div class="cell-combinado"><span class="codigo-plus-cell">' + (item.codigo_plus || '—') + '</span><span class="segmento-cell">' + (item.segmento || '—') + '</span></div></td>';
        html += '<td><div class="cell-combinado"><span class="producto-cell">' + (item.producto || '—') + '</span><span class="fecha-cell">' + (item.fecha_solicitud || '—') + '</span></div></td>';
        html += '<td class="td-acciones">';
        html += '<button class="btn-accion btn-gestiones" onclick="abrirGestiones(\'' + id + '\')" title="Gestiones">📋</button>';
        html += '<button class="btn-accion btn-completar" onclick="abrirCompletar(\'' + id + '\')" title="Completar información">✏️</button>';
        html += '</td>';
        html += '</tr>';
    }
    
    tabla.innerHTML = html;
    actualizarCheckboxes();
    
    // Renderizar cards para móvil
    renderizarCards(datos);
}

// Búsqueda en vivo (live search) con debounce
var debounceTimer;
if (document.getElementById('cedula')) {
    document.getElementById('cedula').oninput = function() {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(function() {
            aplicarFiltros();
        }, 300);
    };
}

// Evento para ordenar columnas
var encabezados = document.querySelectorAll('th.sortable');
for (var i = 0; i < encabezados.length; i++) {
    encabezados[i].style.cursor = 'pointer';
    encabezados[i].onclick = function() {
        ordenarPorColumna(this.dataset.columna);
    };
}

// Configurar eventos de checkboxes
function configurarEventosCheckboxes() {
    // Checkbox "seleccionar todos"
    var checkboxTodos = document.getElementById('seleccionar-todos');
    if (checkboxTodos) {
        checkboxTodos.onclick = function() {
            seleccionarTodos();
        };
    }
    
    // Checkboxes individuales (usando delegacion de eventos)
    var tabla = document.getElementById('tabla');
    if (tabla) {
        tabla.onclick = function(e) {
            if (e.target.classList.contains('checkbox-fila')) {
                toggleFilaCheckbox(e.target);
            }
        };
    }
    
    // Botón WhatsApp
    var btnWhatsApp = document.getElementById('btn-whatsapp');
    if (btnWhatsApp) {
        btnWhatsApp.onclick = enviarWhatsApp;
    }
    
    // Botón Copiar
    var btnCopy = document.getElementById('btn-copy');
    if (btnCopy) {
        btnCopy.onclick = copiarDatos;
    }
}

// ================== CÓDIGO PLUS ==================

// Variable para debounce de código plus
var debounceCodigoPlus = {};

// Función para actualizar código plus con debounce
async function actualizarCodigoPlus(input) {
    var id = input.dataset.id;
    var codigo_plus = input.value.trim();
    
    // Cancelar actualización previa si existe
    if (debounceCodigoPlus[id]) {
        clearTimeout(debounceCodigoPlus[id]);
    }
    
    // Mostrar indicador de guardado
    input.style.backgroundColor = '#fef3c7';
    
    // Debounce de 500ms
    debounceCodigoPlus[id] = setTimeout(async function() {
        try {
            var response = await fetch('/api/excel/solicitudes/' + id + '/codigo-plus', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ codigo_plus: codigo_plus })
            });
            
            var resultado = await response.json();
            
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
        } catch (error) {
            console.error('Error guardando código plus:', error);
            input.style.backgroundColor = '#fee2e2';
        }
    }, 500);
}

// Configurar eventos de código plus
function configurarEventosCodigoPlus() {
    var tabla = document.getElementById('tabla');
    if (!tabla) return;
    
    tabla.addEventListener('input', function(e) {
        if (e.target.classList.contains('input-codigo-plus')) {
            actualizarCodigoPlus(e.target);
        }
    });
    
    tabla.addEventListener('blur', function(e) {
        if (e.target.classList.contains('input-codigo-plus')) {
            // Guardar inmediatamente al perder foco
            var input = e.target;
            var id = input.dataset.id;
            var codigo_plus = input.value.trim();
            
            if (debounceCodigoPlus[id]) {
                clearTimeout(debounceCodigoPlus[id]);
            }
            
            fetch('/api/excel/solicitudes/' + id + '/codigo-plus', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ codigo_plus: codigo_plus })
            }).then(function(response) {
                return response.json();
            }).then(function(resultado) {
                if (response.ok) {
                    input.style.backgroundColor = '#dcfce7';
                    setTimeout(function() {
                        input.style.backgroundColor = '';
                    }, 1000);
                }
            }).catch(function(err) {
                console.error('Error:', err);
            });
        }
    });
}

// ================== ACCIONES: GESTIONES Y COMPLETAR ==================

// Opciones de tipo de gestión
var opcionesTipoGestion = [
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
    var ahora = new Date();
    var dia = String(ahora.getDate()).padStart(2, '0');
    var mes = String(ahora.getMonth() + 1).padStart(2, '0');
    var anio = ahora.getFullYear();
    var hora = String(ahora.getHours()).padStart(2, '0');
    var minuto = String(ahora.getMinutes()).padStart(2, '0');
    var segundo = String(ahora.getSeconds()).padStart(2, '0');
    return dia + '/' + mes + '/' + anio + ' ' + hora + ':' + minuto + ':' + segundo;
}

// Función para formatear fecha de gestión
function formatFechaGestion(fecha) {
    if (!fecha) return '';
    var d = new Date(fecha);
    var dia = String(d.getDate()).padStart(2, '0');
    var mes = String(d.getMonth() + 1).padStart(2, '0');
    var anio = d.getFullYear();
    var hora = String(d.getHours()).padStart(2, '0');
    var minuto = String(d.getMinutes()).padStart(2, '0');
    return dia + '/' + mes + '/' + anio + ' ' + hora + ':' + minuto;
}

// Función para abrir modal de Gestiones - Layout mejorado para pantallas grandes
function abrirGestiones(id) {
    var datos = datosFilas[id];
    if (!datos) {
        alert('No se encontraron datos para esta solicitud');
        return;
    }
    
    // Crear opciones del dropdown
    var opcionesDropdown = '';
    for (var i = 0; i < opcionesTipoGestion.length; i++) {
        opcionesDropdown += '<option value="' + opcionesTipoGestion[i] + '">' + opcionesTipoGestion[i] + '</option>';
    }
    
    var contenido = '';
    // Header
    contenido += '<div class="gestion-header">';
    contenido += '<h2>📋 Gestiones - Solicitud #' + id + '</h2>';
    contenido += '<button class="btn-cerrar" onclick="cerrarModal()">✕</button>';
    contenido += '</div>';
    
    // Layout de dos columnas
    contenido += '<div class="gestion-layout">';
    
    // Columna Izquierda: Info + Nueva Gestión
    contenido += '<div class="gestion-izquierda">';
    
    // Panel Info Cliente
    contenido += '<div class="info-cliente">';
    contenido += '<h3>👤 Información del Cliente</h3>';
    contenido += '<div class="info-grid">';
    contenido += '<div class="info-item"><span class="info-label">Nombre</span><span class="info-value">' + (datos.nombre || 'N/A') + '</span></div>';
    contenido += '<div class="info-item"><span class="info-label">Cédula</span><span class="info-value">' + (datos.cedula || 'N/A') + '</span></div>';
    contenido += '<div class="info-item"><span class="info-label">Celular</span><span class="info-value">' + (datos.celular || 'N/A') + '</span></div>';
    contenido += '<div class="info-item"><span class="info-label">Estado</span><span class="info-value estado-badge">' + (datos.estado || 'N/A') + '</span></div>';
    contenido += '<div class="info-item"><span class="info-label">Segmento</span><span class="info-value">' + (datos.segmento || 'N/A') + '</span></div>';
    contenido += '<div class="info-item"><span class="info-label">Producto</span><span class="info-value">' + (datos.producto || 'N/A') + '</span></div>';
    contenido += '</div>';
    contenido += '</div>';
    
    // Sección de Nueva Gestión
    contenido += '<div class="nueva-gestion">';
    contenido += '<h3>➕ Nueva Gestión</h3>';
    
    // Fecha y hora
    contenido += '<div class="form-group">';
    contenido += '<label>📅 Fecha y Hora</label>';
    contenido += '<input type="text" id="fecha-gestion" value="' + getFechaHoraActual() + '" readonly class="input-readonly">';
    contenido += '</div>';
    
    // Tipo de gestión
    contenido += '<div class="form-group">';
    contenido += '<label>📋 Tipo de Gestión</label>';
    contenido += '<select id="tipo-gestion" class="input-select">' + opcionesDropdown + '</select>';
    contenido += '</div>';
    
    // Observación
    contenido += '<div class="form-group">';
    contenido += '<label>📝 Observación</label>';
    contenido += '<textarea id="observacion-gestion" rows="5" class="input-textarea" placeholder="Escriba su observación aquí..."></textarea>';
    contenido += '</div>';
    
    // Botón guardar
    contenido += '<button onclick="guardarGestion(\'' + id + '\')" class="btn-guardar">💾 Guardar Gestión</button>';
    contenido += '</div>';
    
    contenido += '</div>'; // Fin columna izquierda
    
    // Columna Derecha: Historial
    contenido += '<div class="gestion-derecha">';
    contenido += '<h3>📜 Historial de Gestiones</h3>';
    contenido += '<div id="lista-historial" class="historial-container">Cargando...</div>';
    contenido += '</div>';
    
    contenido += '</div>'; // Fin layout
    
    crearModal(contenido);
    
    // Cargar historial
    cargarHistorialGestiones(id);
}

// Función para abrir modal de Completar Información
function abrirCompletar(id) {
    var datos = datosFilas[id];
    if (!datos) {
        alert('No se encontraron datos para esta solicitud');
        return;
    }
    
    var contenido = '';
    contenido += '<div style="padding: 20px;">';
    contenido += '<h2 style="margin-top: 0; color: #1f2937;">✏️ Completar Información - Solicitud #' + id + '</h2>';
    contenido += '<div style="background: #f3f4f6; padding: 15px; border-radius: 8px; margin-bottom: 15px;">';
    contenido += '<p><strong>Nombre:</strong> ' + (datos.nombre || 'N/A') + '</p>';
    contenido += '<p><strong>Cédula:</strong> ' + (datos.cedula || 'N/A') + '</p>';
    contenido += '<p><strong>Celular:</strong> ' + (datos.celular || 'N/A') + '</p>';
    contenido += '</div>';
    contenido += '<label style="display: block; font-weight: 600; margin-bottom: 8px;">Código Plus:</label>';
    contenido += '<input type="text" id="codigo-plus-completar" value="' + (datos.codigo_plus || '') + '" style="width: 100%; padding: 12px; border: 1px solid #ddd; border-radius: 8px; font-size: 14px; margin-bottom: 15px;" placeholder="Ingrese código plus">';
    contenido += '<label style="display: block; font-weight: 600; margin-bottom: 8px;">Observaciones:</label>';
    contenido += '<textarea id="observaciones" rows="5" style="width: 100%; padding: 12px; border: 1px solid #ddd; border-radius: 8px; font-size: 14px; resize: vertical;" placeholder="Escriba observaciones adicionales..."></textarea>';
    contenido += '<div style="margin-top: 20px; display: flex; gap: 10px; justify-content: flex-end;">';
    contenido += '<button onclick="cerrarModal()" style="padding: 10px 20px; background: #f3f4f6; border: none; border-radius: 8px; cursor: pointer;">Cancelar</button>';
    contenido += '<button onclick="guardarCompletar(\'' + id + '\')" style="padding: 10px 20px; background: #2563eb; color: white; border: none; border-radius: 8px; cursor: pointer;">💾 Guardar</button>';
    contenido += '</div>';
    contenido += '</div>';
    
    crearModal(contenido);
}

// Función para crear modal genérico - Mejorado para pantallas grandes
function crearModal(contenido) {
    // Eliminar modal existente si hay
    var modalExistente = document.getElementById('modal-generico');
    if (modalExistente) {
        modalExistente.remove();
    }
    
    var overlay = document.createElement('div');
    overlay.id = 'modal-generico';
    overlay.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 9999; display: flex; align-items: center; justify-content: center;';
    
    var modal = document.createElement('div');
    // Modal más grande para pantallas grandes: 950px
    modal.style.cssText = 'background: white; border-radius: 16px; max-width: 950px; width: 95%; max-height: 90vh; overflow-y: auto; box-shadow: 0 20px 60px rgba(0,0,0,0.4);';
    modal.innerHTML = contenido;
    
    // Cerrar al hacer click en el overlay
    overlay.onclick = function(e) {
        if (e.target === overlay) {
            cerrarModal();
        }
    };
    
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
}

// Función para cerrar modal
function cerrarModal() {
    var modal = document.getElementById('modal-generico');
    if (modal) {
        modal.remove();
    }
}

// Función para cargar historial de gestines
async function cargarHistorialGestiones(id) {
    console.log('DEBUG cargarHistorialGestiones - iniando con id:', id);
    
    var container = document.getElementById('lista-historial');
    if (!container) {
        console.log('DEBUG cargarHistorialGestiones - container no encontrado');
        return;
    }
    
    container.innerHTML = '<div style="padding:15px;text-align:center;color:#6b7280;">Cargando gestines...</div>';
    console.log('DEBUG cargarHistorialGestiones - fetchingAPI...');
    
    try {
        var response = await fetch('/api/excel/gestiones/' + id);
        console.log('DEBUG cargarHistorialGestiones - response:', response.status);
        
        if (!response.ok) {
            container.innerHTML = '<div style="color: red;">Error al cargar historial</div>';
            return;
        }
        
var gestines = await response.json();
        console.log('DEBUG cargarHistorialGestiones - gestines:', gestines);
        console.log('DEBUG cargarHistorialGestiones - gestines.length:', gestines ? gestines.length : 'undefined');
        
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
            html += '<button onclick="editarGestion(\'' + g.id + '\', \'' + id + '\')" style="padding: 4px 10px; background: #2563eb; color: white; border: none; border-radius: 4px; font-size: 11px; cursor: pointer;">✏️ Editar</button>';
            html += '<button onclick="confirmarEliminarGestion(\'' + g.id + '\', \'' + id + '\')" style="padding: 4px 10px; background: #dc2626; color: white; border: none; border-radius: 4px; font-size: 11px; cursor: pointer;">🗑️ Eliminar</button>';
            html += '</div>';
            html += '</div>';
        }
        
        container.innerHTML = html;
        
    } catch (error) {
        console.error('Error cargando historial:', error);
        container.innerHTML = '<div style="color: red;">Error al cargar historial</div>';
    }
}

// Función para editar una gestión
function editarGestion(gestionId, solicitudId) {
    // Primero obtener los datos de la gestión
    fetch('/api/excel/gestiones/' + solicitudId)
        .then(function(res) { return res.json(); })
        .then(function(gestines) {
            var gestion = gestines.find(function(g) { return g.id == gestionId; });
            if (!gestion) {
                alert('Gestión no encontrada');
                return;
            }
            
            // Crear opciones del dropdown
            var opcionesDropdown = '';
            for (var i = 0; i < opcionesTipoGestion.length; i++) {
                var selected = opcionesTipoGestion[i] === gestion.tipo_gestion ? 'selected' : '';
                opcionesDropdown += '<option value="' + opcionesTipoGestion[i] + '" ' + selected + '>' + opcionesTipoGestion[i] + '</option>';
            }
            
            var contenido = '';
            contenido += '<div style="padding: 20px;">';
            contenido += '<h2 style="margin-top: 0; color: #1f2937;">✏️ Editar Gestión</h2>';
            
            // Tipo de gestión
            contenido += '<label style="display: block; font-weight: 600; margin-bottom: 4px; font-size: 13px;">📋 Tipo de Gestión:</label>';
            contenido += '<select id="tipo-gestion-editar" style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 6px; font-size: 14px; margin-bottom: 12px; background: white;">';
            contenido += opcionesDropdown;
            contenido += '</select>';
            
            // Observación
            contenido += '<label style="display: block; font-weight: 600; margin-bottom: 4px; font-size: 13px;">📝 Observación:</label>';
            contenido += '<textarea id="observacion-editar" rows="4" style="width: 100%; padding: 12px; border: 1px solid #ddd; border-radius: 6px; font-size: 14px; resize: vertical; margin-bottom: 12px;">' + (gestion.observacion || '') + '</textarea>';
            
            // Botones
            contenido += '<div style="display: flex; gap: 10px; justify-content: flex-end;">';
            contenido += '<button onclick="cerrarModal()" style="padding: 10px 20px; background: #f3f4f6; border: none; border-radius: 8px; cursor: pointer;">Cancelar</button>';
            contenido += '<button onclick="guardarEdicionGestion(\'' + gestionId + '\', \'' + solicitudId + '\')" style="padding: 10px 20px; background: #2563eb; color: white; border: none; border-radius: 8px; cursor: pointer;">💾 Guardar</button>';
            contenido += '</div>';
            contenido += '</div>';
            
            crearModal(contenido);
        })
        .catch(function(err) {
            console.error('Error:', err);
            alert('Error al cargar gestión');
        });
}

// Función para guardar la edición de una gestión
function guardarEdicionGestion(gestionId, solicitudId) {
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
            cargarHistorialGestiones(solicitudId);
        } else {
            alert('Error: ' + (resultado.error || 'Error desconocidos'));
        }
    })
    .catch(function(err) {
        console.error('Error:', err);
        alert('Error al guardar');
    });
}

// Función para confirmar y eliminar una gestión
function confirmarEliminarGestion(gestionId, solicitudId) {
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
            cargarHistorialGestiones(solicitudId);
        } else {
            alert('Error: ' + (resultado.error || 'Error desconocido'));
        }
    })
    .catch(function(err) {
        console.error('Error:', err);
        alert('Error al eliminar');
    });
}

// Función para guardar gestión
function guardarGestion(id) {
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
    var btn = document.querySelector('button[onclick="guardarGestion(\'' + id + '\')"]');
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
            cargarHistorialGestiones(id);
            
            // Limpiar campos
            document.getElementById('observacion-gestion').value = '';
            document.getElementById('tipo-gestion').selectedIndex = 0;
            
            // Actualizar fecha/hora
            document.getElementById('fecha-gestion').value = getFechaHoraActual();
            
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

// Función para guardar completar información
function guardarCompletar(id) {
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
                cargarSolicitudes(); // Recargar tabla
            }
        });
    }
    
    alert('Información guardada para solicitud #' + id);
   cerrarModal();
}

// ================== EXPORTAR SELECCIONADAS ==================

// Función para exportar las filas seleccionadas a Excel/CSV
function exportarSeleccionadas() {
    if (filasSeleccionadas.length === 0) {
        alert('Selecciona al menos una fila primero');
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
    
    // Converter para CSV
    var csvContent = '\uFEFF'; // BOM para UTF-8
    var headers = Object.keys(datosAExportar[0]);
    csvContent += headers.join(',') + '\n';
    
    datosAExportar.forEach(function(row) {
        var values = headers.map(function(header) {
            var value = row[header] || '';
            // Escapar comillas y envolver en comillas si contiene coma
            if (String(value).indexOf(',') > -1 || String(value).indexOf('"') > -1) {
                value = '"' + String(value).replace(/"/g, '""') + '"';
            }
            return value;
        });
        csvContent += values.join(',') + '\n';
    });
    
    // Descargar archivo
    var blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    var link = document.createElement('a');
    var url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'solicitudes_seleccionadas_' + getFechaHoraActual().replace(/[\s:]/g, '-') + '.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    alert('Se exportaron ' + datosAExportar.length + ' registros');
}

// ================== MARCAR SELECCIONADAS ==================

// Función para marcar todas las filas visibles
function marcarSeleccionadas() {
    var checkboxes = document.querySelectorAll('.checkbox-fila');
    
    if (filasSeleccionadas.length === checkboxes.length) {
        // Si ya están todas, desmarcar todas
        checkboxes.forEach(function(cb) {
            cb.checked = false;
            var fila = cb.closest('tr');
            fila.classList.remove('fila-seleccionada');
        });
        filasSeleccionadas = [];
    } else {
        // Marcar todas
        filasSeleccionadas = [];
        checkboxes.forEach(function(cb) {
            cb.checked = true;
            var fila = cb.closest('tr');
            var id = cb.value;
            if (filasSeleccionadas.indexOf(id) === -1) {
                filasSeleccionadas.push(id);
            }
            fila.classList.add('fila-seleccionada');
        });
    }
    
    actualizarCheckboxes();
    actualizarContador();
}

// ================== LIMPIAR FILTROS ==================

// Función para limpiar todos los filtros
function limpiarFiltros() {
    // Limpiar búsqueda
    document.getElementById('cedula').value = '';
    
    // Resetear botones de estado
    var botonesEstado = document.querySelectorAll('#filtro-estado .filter-btn');
    botonesEstado.forEach(function(btn) {
        btn.classList.remove('active');
    });
    botonesEstado[0].classList.add('active');
    
    // Resetear botones de segmento
    var botonesSegmento = document.querySelectorAll('#filtro-segmento .filter-btn');
    botonesSegmento.forEach(function(btn) {
        btn.classList.remove('active');
    });
    botonesSegmento[0].classList.add('active');
    
    // Resetear variables
    estadoActual = '';
    segmentoActual = '';
    columnaOrdenar = 'id_solicitud';
    ordenActual = 'DESC';
    
    // Actualizar info panel
    actualizarInfoPanel();
    
    // Recargar datos con el nuevo sistema
    init();
}

// Actualizar info panel con filtros actuales
function actualizarInfoPanel() {
    var estadoInfo = document.querySelector('.info-panel .info-stat:nth-child(1) .info-value');
    var segmentoInfo = document.querySelector('.info-panel .info-stat:nth-child(2) .info-value');
    var ultimaActualizacion = document.getElementById('ultima-actualizacion');
    
    if (estadoInfo) {
        estadoInfo.textContent = estadoActual || 'Todos';
    }
    if (segmentoInfo) {
        segmentoInfo.textContent = segmentoActual || 'Todos';
    }
    if (ultimaActualizacion) {
        ultimaActualizacion.textContent = getFechaHoraActual();
    }
}

// ================== BORRAR TODAS LAS SOLICITUDES ==================

// Función para borrar todas las solicitudes del usuario actual
async function borrarTodas() {
    if (!confirm('¿Está seguro de BORRAR TODAS las solicitudes?\n\nEsta acción NO se puede deshacer.\n\nSe eliminarán todos los registros de la base de datos.')) {
        return;
    }
    
    // Segunda confirmación
    if (!confirm('¿REALMENTE quiere eliminar TODAS las solicitudes?\n\nEsta acción es IRREVERSIBLE.')) {
        return;
    }
    
    try {
        var btn = document.querySelector('.btn-danger');
        if (btn) {
            btn.textContent = '🗑️ Eliminando...';
            btn.disabled = true;
        }
        
        var response = await fetch('/api/excel/limpiar', {
            method: 'DELETE',
            credentials: 'include'
        });
        
        var resultado = await response.json();
        
        if (response.ok) {
            alert('✅ ' + resultado.mensaje + '\n\nSe eliminaron: ' + resultado.eliminadas + ' registros');
// Recargar datos con el nuevo sistema local
            cargarTotales();
            cargarEstados();
            cargarSegmentos();
            init();
            filasSeleccionadas = [];
            datosFilas = {};
            actualizarContador();
        } else {
            alert('❌ Error: ' + (resultado.error || 'Error desconocido'));
        }
    } catch (error) {
        console.error('Error al borrar:', error);
        alert('❌ Error al eliminar las solicitudes');
    } finally {
        var btn = document.querySelector('.btn-danger');
        if (btn) {
            btn.textContent = '🗑️ Borrar Todo';
            btn.disabled = false;
        }
    }
}

// Inicializar - usar el nuevo sistema de búsqueda local
cargarTotales();
cargarEstados();
cargarSegmentos();
init(); // Cargar todos los datos y aplicar filtros localmente
configurarEventosCheckboxes();
configurarEventosCodigoPlus();
actualizarContador();

// Agregar eventos para checkboxes en las cards
document.addEventListener('change', function(e) {
    if (e.target.classList.contains('checkbox-fila') && e.target.closest('.cliente-card')) {
        var checkbox = e.target;
        var id = checkbox.value;
        
        if (checkbox.checked) {
            if (filasSeleccionadas.indexOf(id) === -1) {
                filasSeleccionadas.push(id);
            }
            checkbox.closest('.cliente-card').classList.add('fila-seleccionada');
        } else {
            var index = filasSeleccionadas.indexOf(id);
            if (index > -1) {
                filasSeleccionadas.splice(index, 1);
            }
            checkbox.closest('.cliente-card').classList.remove('fila-seleccionada');
        }
        
        actualizarContador();
    }
});

// Auto-focus en el input de búsqueda al cargar la página
window.addEventListener('DOMContentLoaded', function() {
    var inputBusqueda = document.getElementById('cedula');
    if (inputBusqueda) {
        setTimeout(function() {
            inputBusqueda.focus();
        }, 100);
    }
});
