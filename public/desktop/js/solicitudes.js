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

// Renderizar cards para móvil
function renderizarCards(datos) {
    var container = document.getElementById('cards-container');
    if (!container) return;
    
    if (!datos.length) {
        container.innerHTML = '<div style="text-align:center;padding:20px;color:#6b7280;">No se encontraron registros</div>';
        return;
    }
    
    var html = '';
    var coloresEstado = {
        'ACTIVADA': '#dcfce7',
        'RECHAZADA': '#fee2e2',
        'DEVUELTA': '#fef3c7',
        'APROBADA PARA LIBERACIÓN': '#d1fae5'
    };
    
    for (var i = 0; i < datos.length; i++) {
        var item = datos[i];
        var estadoClase = (item.estado || '').replace(/ /g, '-').toUpperCase();
        var colorEstado = coloresEstado[item.estado] || '#f3f4f6';
        
        html += '<div class="cliente-card">';
        html += '  <div class="cliente-header">';
        html += '    <span class="cliente-id">#' + (item.id_solicitud || '') + '</span>';
        html += '    <span class="cliente-estado" style="background:' + colorEstado + ';">' + (item.estado || '') + '</span>';
        html += '  </div>';
        html += '  <div class="cliente-nombre">' + (item.nombre || '') + '</div>';
        html += '  <div class="cliente-cedula">Cédula: ' + (item.cedula || '') + '</div>';
        html += '  <div class="cliente-detalle">';
        html += '    <span class="cliente-tag">📍 ' + (item.segmento || '') + '</span>';
        html += '    <span class="cliente-tag">📦 ' + (item.producto || '') + '</span>';
        html += '    <span class="cliente-tag">📅 ' + (item.fecha_solicitud || '') + '</span>';
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
            cargarSolicitudes();
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
            cargarSolicitudes();
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

// Cargar las solicitudes
async function cargarSolicitudes() {
    try {
        var cedula = document.getElementById('cedula').value;
        var params = '';

        if (estadoActual) params += 'estado=' + encodeURIComponent(estadoActual) + '&';
        if (segmentoActual) params += 'segmento=' + encodeURIComponent(segmentoActual) + '&';
        if (cedula) {
            // Buscar por nombre, cédula o teléfono
            params += 'nombre=' + encodeURIComponent(cedula) + '&';
            params += 'telefono=' + encodeURIComponent(cedula) + '&';
        }
        params += 'orden=' + columnaOrdenar + '&direccion=' + ordenActual;

        var response = await fetch('/api/excel/solicitudes?' + params);

        if (!response.ok) throw new Error('Error response');

var datos = await response.json();

        console.log('Datos recibidos:', datos.length);
        console.log('Primer registro:', datos[0]);

        var tabla = document.getElementById('tabla');
        var mostrando = document.getElementById('mostrando');

        tabla.innerHTML = '';
        mostrando.textContent = datos.length ? datos.length : 0;

if (!datos.length) {
            tabla.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:20px;">No se encontraron registros</td></tr>';
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
            html += '<td>' + (item.segmento || '') + '</td>';
            html += '<td>' + (item.producto || '') + '</td>';
            html += '<td>' + (item.fecha_solicitud || '') + '</td>';
            html += '</tr>';
        }

tabla.innerHTML = html;
        actualizarEncabezados();
        actualizarCheckboxes();
        
        // Renderizar cards para móvil
        renderizarCards(datos);

    } catch (error) {
        console.error('Error:', error);
        document.getElementById('tabla').innerHTML = '<tr><td colspan="8" style="color:red;text-align:center;padding:20px;">Error al cargar datos</td></tr>';
    }
}

// Búsqueda en vivo (live search) - busca por nombre, cédula o teléfono
var debounceTimer;
document.getElementById('cedula').oninput = function() {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(function() {
        cargarSolicitudes();
    }, 300);
};

// Función para buscar también por teléfono (se envía como parámetro "telefono")
function buscarPorTelefono() {
    var cedula = document.getElementById('cedula').value;
    cargarSolicitudes();
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

// Inicializar
cargarTotales();
cargarEstados();
cargarSegmentos();
cargarSolicitudes();
configurarEventosCheckboxes();
actualizarContador();
