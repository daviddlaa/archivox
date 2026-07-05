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
            var id = cb.value;
            if (filasSeleccionadas.indexOf(id) === -1) {
                filasSeleccionadas.push(id);
            }
            // Buscar fila o card padre - funciona para tabla Y cards
            var fila = cb.closest('tr') || cb.closest('.cliente-card');
            if (fila) {
                fila.classList.add('fila-seleccionada');
            }
        });
    } else {
        checkboxes.forEach(function(cb) {
            cb.checked = false;
        });
        filasSeleccionadas = [];
        checkboxes.forEach(function(cb) {
            // Buscar fila o card padre - funciona para tabla Y cards
            var fila = cb.closest('tr') || cb.closest('.cliente-card');
            if (fila) {
                fila.classList.remove('fila-seleccionada');
            }
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
    var btnGestion = document.getElementById('btn-gestion');
    var actionsInline = document.getElementById('actions-inline');
    var contadorInline = document.getElementById('seleccionadas-inline');
    
    if (contador) {
        contador.textContent = filasSeleccionadas.length;
    }
    
    // Actualizar contador inline
    if (contadorInline) {
        contadorInline.textContent = filasSeleccionadas.length;
    }
    
    // Mostrar/ocultar botón de Gestión y Agregar a Campaña según selección
    if (btnGestion) {
        if (filasSeleccionadas.length > 0) {
            btnGestion.style.display = 'inline-flex';
        } else {
            btnGestion.style.display = 'none';
        }
    }
    var btnAgregarCampana = document.getElementById('btn-agregar-campana');
    if (btnAgregarCampana) {
        if (filasSeleccionadas.length > 0) {
            btnAgregarCampana.style.display = 'inline-flex';
        } else {
            btnAgregarCampana.style.display = 'none';
        }
    }
    
    // Mostrar/ocultar toolbar inline (arriba de las cards)
    if (actionsInline) {
        if (filasSeleccionadas.length > 0) {
            actionsInline.style.display = 'flex';
        } else {
            actionsInline.style.display = 'none';
        }
    }
}

// ================== GESTIÓN POR LOTES ==================

// Función para generar informe de las solicitudes seleccionadas
function generarInformeSeleccionadas() {
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

// Función para abrir modal de nueva gestión CON INFORME Y PLAN DE ACCIÓN (3 COLUMNAS)
function abrirModalNuevaGestion() {
    if (filasSeleccionadas.length === 0) {
        alert('Selecciona al menos una solicitud primero');
        return;
    }
    
    // Generar informe
    var informe = generarInformeSeleccionadas();
    
    // Opciones de tipo de gestión
    var opcionesTipoGestionModal = '';
    ['Seguimiento', 'Cobranza', 'Llamada', 'WhatsApp', 'Reclamo', 'Cita', 'Otro'].forEach(function(tipo) {
        opcionesTipoGestionModal += '<option value="' + tipo + '">' + tipo + '</option>';
    });
    
    var contenido = '';
    contenido += '<div style="padding: 24px; max-width: 1200px; margin: 0 auto; display: flex; flex-direction: column; max-height: calc(98vh - 48px);">';
    
    // ===== HEADER =====
    contenido += '<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 18px; flex-shrink: 0;">';
    contenido += '<h2 style="margin: 0; color: #1f2937; font-size: 22px;">🚀 Crear campaña</h2>';
    contenido += '<span style="background: #e0e7ff; color: #3730a3; padding: 6px 14px; border-radius: 20px; font-size: 13px; font-weight: 600;">' + filasSeleccionadas.length + ' solicitudes seleccionadas</span>';
    contenido += '</div>';
    
    // ===== 3 COLUMNAS =====
    contenido += '<div style="display: grid; grid-template-columns: 1fr 1fr 1.3fr; gap: 16px; flex: 1; min-height: 0;">';
    
    // === COL 1: INFORME - Métricas ===
    contenido += '<div style="background: #f0f9ff; border: 2px solid #0ea5e9; border-radius: 12px; padding: 16px; display: flex; flex-direction: column;">';
    contenido += '<h3 style="margin: 0 0 12px 0; color: #0369a1; font-size: 15px;">📊 INFORME</h3>';
    
    // Total + Celulares side by side
    contenido += '<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 10px;">';
    contenido += '<div style="background: white; padding: 10px; border-radius: 8px; text-align: center;">';
    contenido += '<div style="font-size: 26px; font-weight: bold; color: #1f2937;">' + informe.total + '</div>';
    contenido += '<div style="font-size: 10px; color: #6b7280; font-weight: 600; text-transform: uppercase;">Total</div>';
    contenido += '</div>';
    contenido += '<div style="background: white; padding: 10px; border-radius: 8px; text-align: center;">';
    contenido += '<div style="font-size: 26px; font-weight: bold; color: #059669;">' + informe.celularesUnicos.length + '</div>';
    contenido += '<div style="font-size: 10px; color: #6b7280; font-weight: 600; text-transform: uppercase;">Celulares</div>';
    contenido += '</div>';
    contenido += '</div>';
    
    // Por Estado
    contenido += '<div style="background: white; padding: 10px; border-radius: 8px; flex: 1; overflow-y: auto;">';
    contenido += '<div style="font-size: 11px; font-weight: 600; color: #374151; margin-bottom: 6px;">📌 Por Estado</div>';
    contenido += '<div style="display: flex; flex-wrap: wrap; gap: 4px;">';
    Object.keys(informe.porEstado).forEach(function(estado) {
        var count = informe.porEstado[estado];
        contenido += '<span style="background: #e0e7ff; padding: 2px 8px; border-radius: 10px; font-size: 10px; color: #3730a3; font-weight: 600;">' + estado + ': ' + count + '</span>';
    });
    contenido += '</div>';
    contenido += '</div>';
    
    contenido += '</div>'; // fin col 1
    
    // === COL 2: INFORME - Detalles ===
    contenido += '<div style="background: #f0f9ff; border: 2px solid #0ea5e9; border-radius: 12px; padding: 16px; display: flex; flex-direction: column;">';
    
    // Por Segmento
    contenido += '<div style="background: white; padding: 10px; border-radius: 8px; margin-bottom: 8px; flex: 1; overflow-y: auto;">';
    contenido += '<div style="font-size: 11px; font-weight: 600; color: #374151; margin-bottom: 6px;">🏷️ Por Segmento</div>';
    contenido += '<div style="display: flex; flex-wrap: wrap; gap: 4px;">';
    Object.keys(informe.porSegmento).forEach(function(segmento) {
        var count = informe.porSegmento[segmento];
        contenido += '<span style="background: #fef3c7; padding: 2px 8px; border-radius: 10px; font-size: 10px; color: #92400e; font-weight: 600;">' + segmento + ': ' + count + '</span>';
    });
    contenido += '</div>';
    contenido += '</div>';
    
    // Por Producto
    contenido += '<div style="background: white; padding: 10px; border-radius: 8px; flex: 1; overflow-y: auto;">';
    contenido += '<div style="font-size: 11px; font-weight: 600; color: #374151; margin-bottom: 6px;">📦 Por Producto</div>';
    contenido += '<div style="display: flex; flex-wrap: wrap; gap: 4px;">';
    Object.keys(informe.porProducto).forEach(function(producto) {
        var count = informe.porProducto[producto];
        contenido += '<span style="background: #dcfce7; padding: 2px 8px; border-radius: 10px; font-size: 10px; color: #166534; font-weight: 600;">' + producto + ': ' + count + '</span>';
    });
    contenido += '</div>';
    contenido += '</div>';
    
    contenido += '</div>'; // fin col 2
    
    // === COL 3: PLAN DE ACCIÓN ===
    contenido += '<div style="background: #f0fdf4; border: 2px solid #22c55e; border-radius: 12px; padding: 16px; display: flex; flex-direction: column;">';
    contenido += '<h3 style="margin: 0 0 12px 0; color: #166534; font-size: 15px;">📋 PLAN DE ACCIÓN</h3>';
    
    contenido += '<div style="flex: 1;">';
    contenido += '<label style="display: block; font-weight: 600; margin-bottom: 4px; font-size: 12px; color: #374151;">📝 Nombre:</label>';
    contenido += '<input type="text" id="nombre-gestion" style="width: 100%; padding: 9px 10px; border: 2px solid #e5e7eb; border-radius: 8px; font-size: 13px; margin-bottom: 10px; box-sizing: border-box;" placeholder="Ej: Gestión Cobranza Enero 2025">';
    
    contenido += '<label style="display: block; font-weight: 600; margin-bottom: 4px; font-size: 12px; color: #374151;">📋 Tipo:</label>';
    contenido += '<select id="tipo-gestion-lote" style="width: 100%; padding: 9px 10px; border: 2px solid #e5e7eb; border-radius: 8px; font-size: 13px; margin-bottom: 10px; background: white; box-sizing: border-box;">';
    contenido += opcionesTipoGestionModal;
    contenido += '</select>';
    
    contenido += '<label style="display: block; font-weight: 600; margin-bottom: 4px; font-size: 12px; color: #374151;">🎯 Objetivo:</label>';
    contenido += '<textarea id="descripcion-gestion" rows="2" style="width: 100%; padding: 9px 10px; border: 2px solid #e5e7eb; border-radius: 8px; font-size: 13px; resize: none; margin-bottom: 10px; box-sizing: border-box;" placeholder="¿Cuál es el objetivo de esta gestión...?"></textarea>';
    
    contenido += '<label style="display: block; font-weight: 600; margin-bottom: 4px; font-size: 12px; color: #374151;">📅 Fecha Límite:</label>';
    contenido += '<input type="date" id="fecha-limite-gestion" style="width: 100%; padding: 9px 10px; border: 2px solid #e5e7eb; border-radius: 8px; font-size: 13px; margin-bottom: 0; box-sizing: border-box;">';
    contenido += '</div>';
    
    contenido += '</div>'; // fin col 3
    
    contenido += '</div>'; // fin grid 3 columnas
    
    // ===== BOTONES =====
    contenido += '<div style="display: flex; gap: 10px; justify-content: flex-end; padding-top: 14px; margin-top: 16px; border-top: 2px solid #e5e7eb; flex-shrink: 0;">';
    contenido += '<button onclick="cerrarModal()" class="btn-modal-cancelar">Cancelar</button>';
    contenido += '<button onclick="crearGestionLote()" class="btn-modal-crear">🚀 Crear Gestión</button>';
    contenido += '</div>';
    
    contenido += '</div>'; // fin container

    
    crearModal(contenido);
}

// Función para crear gestión por lotes
async function crearGestionLote() {
    var nombre = document.getElementById('nombre-gestion').value.trim();
    var descripcion = document.getElementById('descripcion-gestion').value.trim();
    var fecha_limite = document.getElementById('fecha-limite-gestion').value;
    
    console.log('[crearGestionLote] Iniciando con', filasSeleccionadas.length, 'solicitudes');
    
    if (!nombre) {
        alert('Por favor ingresa un nombre para la gestión');
        return;
    }
    
    var btn = document.querySelector('button[onclick="crearGestionLote()"]');
    if (btn) {
        btn.textContent = '⏳ Creando...';
        btn.disabled = true;
    }
    
    try {
        console.log('[crearGestionLote] Enviando request al servidor...');
        
        var response = await fetch('/api/gestiones-maestro', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
                nombre: nombre,
                descripcion: descripcion,
                fecha_limite: fecha_limite || null,
                solicitudes_ids: filasSeleccionadas
            })
        });
        
        console.log('[crearGestionLote] Response status:', response.status);
        
        var resultado = await response.json();
        console.log('[crearGestionLote] Resultado JSON:', JSON.stringify(resultado));
        console.log('[crearGestionLote] response.ok:', response.ok, 'resultado.id:', resultado && resultado.id, 'typeof:', typeof (resultado && resultado.id));
        
        if (response.ok && resultado && resultado.id) {
            alert('Gestión creada correctamente');
            cerrarModal();
            // Ir a la página de gestión por lotes
            window.location.href = '/gestion-lote?id=' + resultado.id;
        } else {
            var msg = '';
            if (resultado && typeof resultado.error === 'string') {
                msg = resultado.error;
            } else if (resultado && resultado.mensaje) {
                msg = resultado.mensaje;
            } else {
                msg = 'Error desconocido - la respuesta no contiene id';
                if (resultado) msg += ' (respuesta: ' + JSON.stringify(resultado).substring(0, 100) + ')';
            }
            if (resultado && resultado.detalle) msg += '\nDetalle: ' + resultado.detalle;
            alert('Error: ' + msg);
            console.error('[crearGestionLote] Error - respuesta inesperada:', JSON.stringify(resultado));
        }
    } catch (error) {
        console.error('[crearGestionLote] Error completa:', error);
        alert('Error al crear la gestión: ' + error.message);
    } finally {
        if (btn) {
            btn.textContent = '🚀 Crear Gestión';
            btn.disabled = false;
        }
    }
}

// ================== AGREGAR A CAMPAÑA EXISTENTE ==================

var campanaSeleccionadaId = null;

// Abrir modal para agregar solicitudes seleccionadas a una campaña existente
async function abrirModalAgregarCampana() {
    if (filasSeleccionadas.length === 0) {
        alert('Selecciona al menos una solicitud primero');
        return;
    }

    var contenido = '';
    contenido += '<div style="padding: 24px; max-width: 600px; margin: 0 auto;">';
    contenido += '<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 18px;">';
    contenido += '<h2 style="margin: 0; color: #1f2937; font-size: 20px;">➕ Agregar a Campaña</h2>';
    contenido += '<span style="background: #e0e7ff; color: #3730a3; padding: 6px 14px; border-radius: 20px; font-size: 13px; font-weight: 600;">' + filasSeleccionadas.length + ' solicitudes</span>';
    contenido += '</div>';
    contenido += '<div id="campanas-list" style="text-align: center; padding: 40px; color: #6b7280;">⏳ Cargando campañas...</div>';
    contenido += '<div style="display: flex; gap: 10px; justify-content: flex-end; padding-top: 14px; margin-top: 16px; border-top: 2px solid #e5e7eb;">';
    contenido += '<button onclick="cerrarModal()" class="btn-modal-cancelar">Cancelar</button>';
    contenido += '</div>';
    contenido += '</div>';

    crearModal(contenido);

    // Cargar campañas
    try {
        var response = await fetch('/api/gestiones-maestro', {
            credentials: 'include'
        });
        if (!response.ok) throw new Error('Error al cargar campañas');
        var campanas = await response.json();
        renderizarListaCampanas(campanas);
    } catch (error) {
        console.error('Error cargando campañas:', error);
        var listContainer = document.getElementById('campanas-list');
        if (listContainer) {
            listContainer.innerHTML = '<div style="color: #dc2626;">❌ Error al cargar campañas</div>';
        }
    }
}

// Renderizar lista de campañas en el modal
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

        var estadoColor = '#6b7280';
        var estadoBg = '#f3f4f6';
        if (c.estado === 'activa') { estadoColor = '#065f46'; estadoBg = '#dcfce7'; }
        else if (c.estado === 'completada') { estadoColor = '#1e40af'; estadoBg = '#dbeafe'; }
        else if (c.estado === 'pausada') { estadoColor = '#92400e'; estadoBg = '#fef3c7'; }

        html += '<div class="campana-item-select" data-id="' + c.id + '" style="background: #f8fafc; border: 2px solid #e5e7eb; border-radius: 10px; padding: 14px; cursor: pointer; transition: all 0.2s ease;" onclick="seleccionarCampana(this, \'' + c.id + '\')">';
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
    html += '<button id="btn-confirmar-agregar" onclick="confirmarAgregarACampana()" disabled style="padding: 12px 30px; background: #9ca3af; color: white; border: none; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: not-allowed; transition: all 0.2s ease;">Selecciona una campaña</button>';
    html += '</div>';

    container.innerHTML = html;

    // Agregar hover effect con JS
    var items = container.querySelectorAll('.campana-item-select');
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

// Seleccionar una campaña
function seleccionarCampana(elemento, id) {
    // Deseleccionar todas
    var items = document.querySelectorAll('.campana-item-select');
    for (var i = 0; i < items.length; i++) {
        items[i].classList.remove('seleccionada');
        items[i].style.borderColor = '#e5e7eb';
        items[i].style.background = '#f8fafc';
    }

    // Seleccionar esta
    elemento.classList.add('seleccionada');
    elemento.style.borderColor = '#2563eb';
    elemento.style.background = '#eff6ff';

    campanaSeleccionadaId = id;

    // Habilitar botón
    var btn = document.getElementById('btn-confirmar-agregar');
    if (btn) {
        btn.disabled = false;
        btn.style.background = '#2563eb';
        btn.style.cursor = 'pointer';
        btn.textContent = '➕ Agregar a esta campaña';
    }
}

// Confirmar y agregar solicitudes a la campaña seleccionada
async function confirmarAgregarACampana() {
    if (!campanaSeleccionadaId) {
        alert('Selecciona una campaña primero');
        return;
    }

    if (filasSeleccionadas.length === 0) {
        alert('No hay solicitudes seleccionadas');
        return;
    }

    var btn = document.getElementById('btn-confirmar-agregar');
    if (btn) {
        btn.textContent = '⏳ Agregando...';
        btn.disabled = true;
    }

    try {
        var response = await fetch('/api/gestiones-maestro/' + campanaSeleccionadaId + '/agregar-solicitudes', {
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
            window.location.href = '/gestion-lote?id=' + campanaSeleccionadaId;
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

// ================== EXPORTAR A EXCEL ==================

// Función para exportar las filas seleccionadas a Excel real (.xlsx)
function exportarExcel() {
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
    
    // Crear libro de trabajo con SheetJS
    var wb = XLSX.utils.book_new();
    var ws = XLSX.utils.json_to_sheet(datosAExportar);
    
    // Agregar columna con ancho automático
    var wscols = [
        {wch: 10}, // Solicitud
        {wch: 15}, // Estado
        {wch: 12}, // Cédula
        {wch: 30}, // Nombre
        {wch: 12}, // Celular
        {wch: 15}, // Código Plus
        {wch: 15}, // Segmento
        {wch: 20}, // Producto
        {wch: 15}  // Fecha
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

function obtenerFilasSeleccionadas() {
    return filasSeleccionadas;
}

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

// Función para abrir WhatsApp sin texto predefinido (escritorio)
function abrirWhatsAppChatEscritorio(celular) {
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

// Función para formatear número WhatsApp con código de país (+593 para Ecuador)
function formatearWhatsApp(celular) {
    if (!celular) return '';
    // Limpiar el número - remover cualquier carácter que no sea dígito
    var numeroLimpio = celular.replace(/\D/g, '');
    
    // Agregar código de país si no existe (+593 para Ecuador)
    if (!numeroLimpio.startsWith('593') && numeroLimpio.length <= 10) {
        numeroLimpio = '593' + numeroLimpio;
    }
    
    return numeroLimpio;
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

// Renderizar cards para móvil y escritorio
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
    
for (var i = 0; i < datos.length; i++) {
        var item = datos[i];
        var estadoClase = (item.estado || '').replace(/ /g, '-').toUpperCase();
        var colorEstado = coloresEstado[item.estado] || '#f3f4f6';
        var id = item.id_solicitud || '';
        var seleccionado = filasSeleccionadas.indexOf(id) > -1 ? 'fila-seleccionada' : '';
        
        html += '<div class="cliente-card ' + seleccionado + '" data-id="' + id + '">';
        
        // Header con checkbox y estado
        html += '  <div class="cliente-header">';
        html += '    <input type="checkbox" class="cliente-checkbox checkbox-fila" value="' + id + '" ' + (seleccionado ? 'checked' : '') + '>';
        html += '    <span class="cliente-id">#' + id + '</span>';
        html += '    <span class="cliente-estado" style="background:' + colorEstado + ';">' + (item.estado || '') + '</span>';
        html += '  </div>';
        
        // Nombre del cliente - click para copiar nombre + cédula
        html += '  <div class="cliente-nombre" onclick="copiarNombreCedula(\'' + escaparParaAtributo(item.nombre || '') + '\', \'' + escaparParaAtributo(item.cedula || '') + '\')" title="Copiar nombre + cédula" style="cursor:pointer;">' + (item.nombre || '') + ' 📋</div>';
        
        // Info row: Cédula y Celular
        html += '  <div class="cliente-info-row">';
        html += '    <span>📍 ' + (item.cedula || '—') + '</span>';
        html += '    <span>📱 ' + (item.celular || '—') + '</span>';
        html += '  </div>';
        
        // Última gestión (si existe)
        if (item.ultima_gestion_tipo) {
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
            var observacionTruncada = item.ultima_gestion_obs ? item.ultima_gestion_obs.substring(0, 60) + (item.ultima_gestion_obs.length > 60 ? '...' : '') : '';
            
            html += '  <div class="cliente-ultima-gestion">';
            html += '    <span class="ultima-gestion-badge" style="background:' + colorGestion + ';">📋 ' + item.ultima_gestion_tipo + '</span>';
            if (fechaGestion) {
                html += '    <span class="ultima-gestion-fecha">' + fechaGestion + '</span>';
            }
            if (observacionTruncada) {
                html += '    <div class="ultima-gestion-obs">' + observacionTruncada + '</div>';
            }
            html += '  </div>';
        } else {
            html += '  <div class="cliente-ultima-gestion vacia">';
            html += '    <span class="ultima-gestion-sin">Sin gestiones</span>';
            html += '  </div>';
        }
        
        // Detalles
        html += '  <div class="cliente-detalle">';
        html += '    <span class="cliente-tag">🏷️ ' + (item.segmento || '—') + '</span>';
        html += '    <span class="cliente-tag">📦 ' + (item.producto || '—') + '</span>';
        html += '    <span class="cliente-tag">📅 ' + (item.fecha_solicitud || '—') + '</span>';
        html += '  </div>';
        
        // Botones de acciones
        html += '  <div class="card-actions">';
        html += '    <button class="card-action-btn card-gestiones-btn" onclick="abrirGestiones(\'' + id + '\')">📋 Gestiones</button>';
        html += '    <button class="card-action-btn card-whatsapp-btn" onclick="abrirWhatsAppChatEscritorio(\'' + escaparParaAtributo(item.celular || '') + '\')">💬 WhatsApp</button>';
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

// ================== BÚSQUEDA EN SERVIDOR ==================
// Nueva implementación: buscar directamente en el servidor
var busquedaActiva = false;
var debounceBusqueda;

// ================== BÚSQUEDA UNIFICADA EN SERVIDOR ==================
// Función única para buscar y filtrar: lee el término del input + filtros activos
async function buscarEnServidor() {
    try {
        var inputBusqueda = document.getElementById('cedula');
        var termino = inputBusqueda ? inputBusqueda.value.trim() : '';
        
        // Si hay término de búsqueda, usarlo; si no, % para traer todos
        var url = termino
            ? '/api/excel/solicitudes/buscar?q=' + encodeURIComponent(termino)
            : '/api/excel/solicitudes/buscar?q=%';
        
        // Agregar filtros activos siempre
        if (estadoActual) {
            url += '&estado=' + encodeURIComponent(estadoActual);
        }
        if (segmentoActual) {
            url += '&segmento=' + encodeURIComponent(segmentoActual);
        }
        
        var response = await fetch(url);
        var result = await response.json();
        
        var datosRecibidos = Array.isArray(result) ? result : (result.data || []);
        
        // Guardar datos
        todosDatos = datosRecibidos;
        hasMoreData = false; // Deshabilitar infinite scroll cuando hay filtros/búsqueda
        
        // Actualizar total
        var total = Array.isArray(result) ? result.length : (result.total || 0);
        document.getElementById('totalRegistros').textContent = total;
        document.getElementById('mostrando').textContent = datosRecibidos.length;
        
        // Renderizar
        renderizarTabla(datosRecibidos);
        
        console.log('Búsqueda/filtro unificado:', datosRecibidos.length, 'resultados - q:', termino || '(todos)', 'Estado:', estadoActual || '(todos)', 'Segmento:', segmentoActual || '(todos)');
    } catch (error) {
        console.error('Error en búsqueda unificada:', error);
    }
}

// Función para buscar con debounce
function buscarConDebounce() {
    clearTimeout(debounceBusqueda);
    
    var inputBusqueda = document.getElementById('cedula');
    var termino = inputBusqueda ? inputBusqueda.value.trim() : '';
    
    // Activar/desactivar modo búsqueda según si hay término
    busquedaActiva = !!termino;
    
    // Siempre llamar a la función unificada (con o sin término)
    debounceBusqueda = setTimeout(function() {
        buscarEnServidor();
    }, 300);
}

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

// Configurar eventos de los botones - NUEVO: filtra directamente del servidor
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
            buscarEnServidor(); // Llama a la función unificada (respeta búsqueda actual)
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
            buscarEnServidor(); // Llama a la función unificada (respeta búsqueda actual)
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

// ================== INFINITE SCROLL (COMO TIKTOK) ==================

// Variables para infinite scroll
var currentOffset = 0;
var currentLimit = 50;
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
        sentinel.style.cssText = 'height: 60px; display: flex; align-items: center; justify-content: center; color: #6b7280; font-size: 14px;';
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
        
        var response = await fetch('/api/excel/solicitudes?limite=' + currentLimit + '&offset=0');
        var result = await response.json();
        
        // Compatibilidad: el backend ahora devuelve { data, total, limite, offset } o array directo
        var datosRecibidos = Array.isArray(result) ? result : (result.data || []);
        
        // Guardar datos
        todosDatos = datosRecibidos;
        currentOffset = datosRecibidos.length;
        
        // Verificar si hay más datos
        var total = Array.isArray(result) ? result.length : (result.total || 0);
        hasMoreData = datosRecibidos.length < total;
        
document.getElementById('totalRegistros').textContent = total;
        
        // Renderizar las cards
        aplicarFiltros();
        
        // Inicializar infinite scroll
        initInfiniteScroll();
        
        console.log('Datos cargados:', todosDatos.length, 'total:', total);
    } catch (error) {
        console.error('Error cargando datos:', error);
    }
}

// Cargar más datos (para infinite scroll)
async function cargarMas() {
    if (isLoading || !hasMoreData || busquedaActiva) return; // No cargar más durante búsqueda activa
    
    isLoading = true;
    
    // Mostrar indicador de carga
    var sentinel = document.getElementById('infinite-scroll-sentinel');
    if (sentinel) {
        sentinel.innerHTML = '<span class="loader-text">⏳ Cargando más...</span>';
    }
    
    try {
        var nuevoOffset = currentOffset;
        var response = await fetch('/api/excel/solicitudes?limite=' + TAMANO_LOTE + '&offset=' + nuevoOffset);
        var result = await response.json();
        
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

// Renderizar tabla con los datos filtrados (ahora solo usa cards)
function renderizarTabla(datos) {
    // Ya no usamos la tabla, solo las cards
    // Guardar datos para uso posterior
    datosFilas = {};
    for (var i = 0; i < datos.length; i++) {
        var item = datos[i];
        var id = item.id_solicitud || '';
        datosFilas[id] = item;
    }
    
    // Renderizar solo las cards (no la tabla)
    renderizarCards(datos);
    
    // IMPORTANTE: Recrear sentinel después de renderizar cards
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
    sentinel.style.cssText = 'height: 60px; display: flex; align-items: center; justify-content: center; color: #6b7280; font-size: 14px; padding: 20px;';
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

// Búsqueda en vivo (live search) con debounce - NUEVA VERSIÓN: buscar en servidor
if (document.getElementById('cedula')) {
    document.getElementById('cedula').oninput = function() {
        buscarConDebounce(); // Busca en servidor con debounce, respeta filtros activos
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
    
// Layout de 3 columnas independientes
    contenido += '<div class="gestion-layout">';
    
    // === COLUMNA 1: Info Cliente ===
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
    
    // === COLUMNA 2: Nueva Gestion ===
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
    
    // === COLUMNA 3: Historial ===
    contenido += '<div class="gestion-derecha">';
    contenido += '<h3>📜 Historial de Gestiones</h3>';
    contenido += '<div id="lista-historial" class="historial-container">Cargando...</div>';
    contenido += '</div>';
    
    contenido += '</div>'; // Fin layout
    
    crearModal(contenido);
    
    // Cargar historial
    cargarHistorialGestiones(id);
}

// Función para abrir modal de Completar Información (3 columnas, sin scroll)
function abrirCompletar(id) {
    var datos = datosFilas[id];
    if (!datos) {
        alert('No se encontraron datos para esta solicitud');
        return;
    }

    fetch('/api/excel/solicitudes/' + id + '/completa')
        .then(function(res) { return res.json(); })
        .then(function(data) {
            var d = data; // La API devuelve los campos directo, no anidados en .solicitud
            var refs = data.referencias || [];

            var contenido = '';
            contenido += '<div class="completar-container">';

            // ===== HEADER =====
            contenido += '<div class="completar-header">';
            contenido += '<h2>✏️ Completar Información <span class="completar-id">#' + id + '</span></h2>';
            contenido += '<button class="btn-cerrar" onclick="cerrarModal()">✕</button>';
            contenido += '</div>';

            // ===== BODY: 3 COLUMNAS =====
            contenido += '<div class="completar-body">';

            // === COL 1: INFO CLIENTE ===
            contenido += '<div class="completar-col completar-col-info">';
            contenido += '<h3>👤 Información del Cliente</h3>';
            contenido += '<div class="completar-info-grid">';
            contenido += '<div class="completar-info-item"><span class="info-label">Solicitud</span><span class="info-value">#' + id + '</span></div>';
            contenido += '<div class="completar-info-item"><span class="info-label">Nombre</span><span class="info-value">' + (datos.nombre || 'N/A') + '</span></div>';
            contenido += '<div class="completar-info-item"><span class="info-label">Cédula</span><span class="info-value">' + (datos.cedula || 'N/A') + '</span></div>';
            contenido += '<div class="completar-info-item"><span class="info-label">Celular</span><span class="info-value">' + (datos.celular || 'N/A') + '</span></div>';
            contenido += '<div class="completar-info-item"><span class="info-label">Estado</span><span class="info-value">' + (datos.estado || 'N/A') + '</span></div>';
            contenido += '<div class="completar-info-item"><span class="info-label">Segmento</span><span class="info-value">' + (datos.segmento || 'N/A') + '</span></div>';
            contenido += '<div class="completar-info-item"><span class="info-label">Producto</span><span class="info-value">' + (datos.producto || 'N/A') + '</span></div>';
            contenido += '</div>';
            contenido += '</div>';

            // === COL 2: DATOS PERSONALES ===
            contenido += '<div class="completar-col completar-col-datos">';
            contenido += '<h3>📋 Datos Personales</h3>';
            contenido += '<div class="completar-scroll">';

            contenido += '<div class="completar-field">';
            contenido += '<label for="codigo-plus-completar">🔢 Código Plus</label>';
            contenido += '<input type="text" id="codigo-plus-completar" value="' + (d.codigo_plus || '') + '" placeholder="Código Plus">';
            contenido += '</div>';

            contenido += '<div class="completar-field">';
            contenido += '<label for="direccion-completar">📍 Dirección</label>';
            contenido += '<input type="text" id="direccion-completar" value="' + (d.direccion || '') + '" placeholder="Dirección domiciliaria">';
            contenido += '</div>';

            contenido += '<div class="completar-field">';
            contenido += '<label for="direccion-trabajo-completar">🏢 Dirección de Trabajo</label>';
            contenido += '<input type="text" id="direccion-trabajo-completar" value="' + (d.direccion_trabajo || '') + '" placeholder="Dirección de trabajo">';
            contenido += '</div>';

            contenido += '<div class="completar-field">';
            contenido += '<label for="ocupacion-completar">💼 Ocupación</label>';
            contenido += '<input type="text" id="ocupacion-completar" value="' + (d.ocupacion || '') + '" placeholder="Ej: Comerciante">';
            contenido += '</div>';

            contenido += '<div class="completar-field">';
            contenido += '<label for="correo-completar">📧 Correo Electrónico</label>';
            contenido += '<input type="email" id="correo-completar" value="' + (d.correo_electronico || '') + '" placeholder="cliente@ejemplo.com">';
            contenido += '</div>';

            contenido += '<div class="completar-field">';
            contenido += '<label for="ingreso-mensual-completar">💰 Ingreso Mensual</label>';
            contenido += '<input type="number" id="ingreso-mensual-completar" value="' + (d.ingreso_mensual || '') + '" step="0.01" min="0" placeholder="0.00">';
            contenido += '</div>';

            contenido += '</div>'; // fin .completar-scroll
            contenido += '</div>'; // fin col 2

            // === COL 3: REFERENCIAS ===
            contenido += '<div class="completar-col completar-col-refs">';
            contenido += '<h3>👥 Referencias</h3>';

            for (var i = 1; i <= 3; i++) {
                var ref = refs[i - 1] || {};
                contenido += '<div class="completar-ref-card">';
                contenido += '<div class="completar-ref-title">Referencia #' + i + '</div>';
                contenido += '<div class="completar-ref-grid">';
                contenido += '<input type="text" id="ref-' + i + '-nombre" value="' + (ref.nombre || '') + '" placeholder="Nombre y Apellido">';
                contenido += '<input type="text" id="ref-' + i + '-telefono" value="' + (ref.telefono || '') + '" placeholder="Teléfono">';
                contenido += '<input type="text" id="ref-' + i + '-relacion" value="' + (ref.relacion || '') + '" placeholder="Relación (amigo/familiar)">';
                contenido += '</div>';
                contenido += '</div>';
            }

            contenido += '</div>'; // fin col 3

            contenido += '</div>'; // fin .completar-body

            // ===== FOOTER =====
            contenido += '<div class="completar-footer">';
            contenido += '<button onclick="cerrarModal()" class="btn-modal-cancelar">Cancelar</button>';
            contenido += '<button onclick="guardarCompletar(\'' + id + '\')" class="btn-modal-crear">💾 Guardar Cambios</button>';
            contenido += '</div>';

            contenido += '</div>'; // fin .completar-container

            crearModal(contenido);
        })
        .catch(function(err) {
            console.error('Error cargando datos completos:', err);
            alert('Error al cargar datos. Intente de nuevo.');
        });
}

// Función para abrir modal de Completar Información (V2 - 3 columnas sin scroll)
// ELIMINADA - reemplazada por abrirCompletar() con 3 columnas
function crearModal(contenido) {
    // Eliminar modal existente si hay
    var modalExistente = document.getElementById('modal-generico');
    if (modalExistente) {
        modalExistente.remove();
    }
    
    var overlay = document.createElement('div');
    overlay.id = 'modal-generico';
    overlay.className = 'modal-overlay';
    
    var modal = document.createElement('div');
    modal.className = 'modal-content';
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

// Función para cargar historial de gestiones
async function cargarHistorialGestiones(id) {
    console.log('DEBUG cargarHistorialGestiones - iniando con id:', id);
    
    var container = document.getElementById('lista-historial');
    if (!container) {
        console.log('DEBUG cargarHistorialGestiones - container no encontrado');
        return;
    }
    
    container.innerHTML = '<div style="padding:15px;text-align:center;color:#6b7280;">Cargando gestiones...</div>';
    console.log('DEBUG cargarHistorialGestiones - fetchingAPI...');
    
    try {
        var response = await fetch('/api/excel/gestiones/' + id);
        console.log('DEBUG cargarHistorialGestiones - response:', response.status);
        
        if (!response.ok) {
            container.innerHTML = '<div style="color: red;">Error al cargar historial</div>';
            return;
        }
        
var gestiones = await response.json();
        console.log('DEBUG cargarHistorialGestiones - gestiones:', gestiones);
        console.log('DEBUG cargarHistorialGestiones - gestiones.length:', gestiones ? gestiones.length : 'undefined');
        
        if (!gestiones || gestiones.length === 0) {
            container.innerHTML = '<div style="padding: 15px; text-align: center; color: #6b7280; background: #f9fafb; border-radius: 8px;">No hay gestiones registradas</div>';
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
        
        for (var i = 0; i < gestiones.length; i++) {
            var g = gestiones[i];
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
        .then(function(gestiones) {
            var gestion = gestiones.find(function(g) { return g.id == gestionId; });
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

// Función para guardar completar información (todos los campos)
function guardarCompletar(id) {
    var codigo_plus = document.getElementById('codigo-plus-completar').value.trim();
    var correo_electronico = document.getElementById('correo-completar').value.trim();
    var direccion = document.getElementById('direccion-completar').value.trim();
    var direccion_trabajo = document.getElementById('direccion-trabajo-completar').value.trim();
    var ocupacion = document.getElementById('ocupacion-completar').value.trim();
    var ingresoInput = document.getElementById('ingreso-mensual-completar').value.trim();
    var ingreso_mensual = ingresoInput ? parseFloat(ingresoInput) : null;
    
    // Recoger referencias
    var referencias = [];
    for (var i = 1; i <= 3; i++) {
        var nombre = document.getElementById('ref-' + i + '-nombre').value.trim();
        var telefono = document.getElementById('ref-' + i + '-telefono').value.trim();
        var relacion = document.getElementById('ref-' + i + '-relacion').value.trim();
        if (nombre || telefono || relacion) {
            referencias.push({ nombre: nombre, telefono: telefono, relacion: relacion });
        }
    }
    
    var btn = document.querySelector('button[onclick="guardarCompletar(\'' + id + '\')"]');
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
    .then(function(response) {
        return response.json().then(function(data) {
            if (response.ok) {
                alert('Información guardada correctamente');
                cerrarModal();
                if (typeof init === 'function') init();
            } else {
                alert('Error: ' + (data.error || 'Error al guardar'));
            }
        });
    })
    .catch(function(err) {
        console.error('Error guardando:', err);
        alert('Error al guardar la información');
    })
    .finally(function() {
        if (btn) {
            btn.textContent = '💾 Guardar';
            btn.disabled = false;
        }
    });
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
            // Buscar fila o card padre - funciona para tabla Y cards
            var fila = cb.closest('tr') || cb.closest('.cliente-card');
            if (fila) {
                fila.classList.remove('fila-seleccionada');
            }
        });
        filasSeleccionadas = [];
    } else {
        // Marcar todas
        filasSeleccionadas = [];
        checkboxes.forEach(function(cb) {
            cb.checked = true;
            var id = cb.value;
            if (filasSeleccionadas.indexOf(id) === -1) {
                filasSeleccionadas.push(id);
            }
            // Buscar fila o card padre - funciona para tabla Y cards
            var fila = cb.closest('tr') || cb.closest('.cliente-card');
            if (fila) {
                fila.classList.add('fila-seleccionada');
            }
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
