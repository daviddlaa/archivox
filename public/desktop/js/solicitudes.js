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
html += '<td><input type="text" class="input-codigo-plus" value="' + (item.codigo_plus || '') + '" data-id="' + id + '" placeholder="Ingrese código" autocomplete="off"></td>';
            html += '<td>' + (item.segmento || '') + '</td>';
            html += '<td>' + (item.producto || '') + '</td>';
            html += '<td>' + (item.fecha_solicitud || '') + '</td>';
            html += '<td class="td-acciones">';
            html += '<button class="btn-accion btn-gestiones" onclick="abrirGestiones(\'' + id + '\')" title="Gestiones">📋</button>';
            html += '<button class="btn-accion btn-completar" onclick="abrirCompletar(\'' + id + '\')" title="Completar información">✏️</button>';
            html += '</td>';
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

// Función para abrir modal de Gestiones
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
    contenido += '<div style="padding: 20px; max-height: 80vh; overflow-y: auto;">';
    contenido += '<h2 style="margin-top: 0; color: #1f2937;">📋 Gestiones - Solicitud #' + id + '</h2>';
    contenido += '<div style="background: #f3f4f6; padding: 15px; border-radius: 8px; margin-bottom: 15px;">';
    contenido += '<p><strong>Nombre:</strong> ' + (datos.nombre || 'N/A') + '</p>';
    contenido += '<p><strong>Cédula:</strong> ' + (datos.cedula || 'N/A') + '</p>';
    contenido += '<p><strong>Celular:</strong> ' + (datos.celular || 'N/A') + '</p>';
    contenido += '<p><strong>Estado:</strong> ' + (datos.estado || 'N/A') + '</p>';
    contenido += '</div>';
    
    // Sección de nueva gestión
    contenido += '<div style="border: 2px solid #2563eb; border-radius: 8px; padding: 15px; margin-bottom: 15px; background: #eff6ff;">';
    contenido += '<h3 style="margin-top: 0; color: #1f2937; font-size: 16px;">➕ Nueva Gestión</h3>';
    
    // Fecha y hora (automático)
    contenido += '<div style="display: flex; gap: 10px; margin-bottom: 12px;">';
    contenido += '<div style="flex: 1;">';
    contenido += '<label style="display: block; font-weight: 600; margin-bottom: 4px; font-size: 13px;">📅 Fecha y Hora:</label>';
    contenido += '<input type="text" id="fecha-gestion" value="' + getFechaHoraActual() + '" readonly style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 6px; font-size: 14px; background: #f3f4f6; color: #6b7280;">';
    contenido += '</div>';
    contenido += '</div>';
    
    // Tipo de gestión (dropdown)
    contenido += '<label style="display: block; font-weight: 600; margin-bottom: 4px; font-size: 13px;">📋 Tipo de Gestión:</label>';
    contenido += '<select id="tipo-gestion" style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 6px; font-size: 14px; margin-bottom: 12px; background: white;">';
    contenido += opcionesDropdown;
    contenido += '</select>';
    
    // Observación
    contenido += '<label style="display: block; font-weight: 600; margin-bottom: 4px; font-size: 13px;">📝 Observación:</label>';
    contenido += '<textarea id="observacion-gestion" rows="4" style="width: 100%; padding: 12px; border: 1px solid #ddd; border-radius: 6px; font-size: 14px; resize: vertical; margin-bottom: 12px;" placeholder="Escriba su observación aquí..."></textarea>';
    
    // Botón guardar
    contenido += '<button onclick="guardarGestion(\'' + id + '\')" style="width: 100%; padding: 12px; background: #2563eb; color: white; border: none; border-radius: 6px; font-size: 14px; font-weight: 600; cursor: pointer;">💾 Guardar Gestión</button>';
    contenido += '</div>';
    
    // Historial de gestiones
    contenido += '<div id="historial-gestiones" style="margin-top: 15px;">';
    contenido += '<h3 style="color: #1f2937; font-size: 16px;">📜 Historial de Gestiones</h3>';
    contenido += '<div id="lista-historial" style="text-align: center; padding: 20px; color: #6b7280;">Cargando...</div>';
    contenido += '</div>';
    
    // Botones cerrar
    contenido += '<div style="margin-top: 20px; display: flex; justify-content: flex-end;">';
    contenido += '<button onclick="cerrarModal()" style="padding: 10px 20px; background: #f3f4f6; border: none; border-radius: 8px; cursor: pointer;">✕ Cerrar</button>';
    contenido += '</div>';
    contenido += '</div>';
    
    crearModal(contenido);
    
    // Cargar historial de gestines
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

// Función para crear modal genérico
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
    modal.style.cssText = 'background: white; border-radius: 12px; max-width: 500px; width: 90%; max-height: 90vh; overflow-y: auto; box-shadow: 0 10px 40px rgba(0,0,0,0.3);';
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

// Inicializar
cargarTotales();
cargarEstados();
cargarSegmentos();
cargarSolicitudes();
configurarEventosCheckboxes();
configurarEventosCodigoPlus();
actualizarContador();
