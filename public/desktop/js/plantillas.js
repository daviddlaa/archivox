// ================== PLANTILLAS DESKTOP ==================
var MAX_PLANTILLAS = 5;
var plantillas = [];

// ================== CARGA INICIAL ==================
async function cargarPlantillas() {
    var grid = document.getElementById('plantillasGrid');
    var empty = document.getElementById('plantillasEmpty');

    grid.innerHTML = '<div class="plantillas-loading">⏳ Cargando plantillas...</div>';
    empty.style.display = 'none';

    try {
        var response = await fetch('/api/plantillas', { credentials: 'include' });
        var data = await response.json();
        if (!response.ok) {
            throw new Error(data.error || 'Error al cargar');
        }

        plantillas = data.data || [];
        if (data.max) MAX_PLANTILLAS = Number(data.max) || 5;
        actualizarContador();
        renderizarPlantillas();

        // Mostrar empty state si no hay plantillas
        if (plantillas.length === 0) {
            grid.innerHTML = '';
            empty.style.display = 'block';
        }
    } catch (error) {
        console.error('[Plantillas] Error cargando:', error);
        grid.innerHTML = '<div class="plantillas-loading" style="color:#dc2626;">❌ Error al cargar: ' + error.message + '</div>';
    }
}

// ================== CONTADOR ==================
function actualizarContador() {
    var contador = document.getElementById('contadorPlantillas');
    var fill = document.getElementById('limiteFill');
    var btn = document.getElementById('btnNuevaPlantilla');

    contador.textContent = plantillas.length;
    var maxEl = document.getElementById('maxPlantillas');
    if (maxEl) maxEl.textContent = MAX_PLANTILLAS;
    var pct = Math.min((plantillas.length / MAX_PLANTILLAS) * 100, 100);
    fill.style.width = pct + '%';

    if (plantillas.length >= MAX_PLANTILLAS) {
        btn.disabled = true;
        btn.title = 'Límite de ' + MAX_PLANTILLAS + ' plantillas alcanzado';
        btn.textContent = '🚫 Límite alcanzado';
    } else {
        btn.disabled = false;
        btn.title = '';
        btn.textContent = '✨ Nueva plantilla';
    }
}

// ================== RENDERIZADO ==================
function renderizarPlantillas() {
    var grid = document.getElementById('plantillasGrid');
    if (!plantillas.length) return;

    var html = '';
    for (var i = 0; i < plantillas.length; i++) {
        var p = plantillas[i];
        var contenidoHtml = escaparHTML(p.contenido || '').replace(/\{nombre\}/g, '<span class="nombre-var">{nombre}</span>');
        var fecha = formatearFecha(p.creada_en);

        html += '<div class="plantilla-card" data-id="' + p.id + '">';
        html += '<div class="plantilla-card-header">';
        html += '<div class="plantilla-card-nombre"><span class="plantilla-card-icon">💬</span><span>' + escaparHTML(p.nombre || 'Sin nombre') + '</span></div>';
        html += '<span class="plantilla-card-num">#' + (i + 1) + '</span>';
        html += '</div>';
        html += '<div class="plantilla-card-body">';
        html += '<div class="plantilla-card-contenido">' + contenidoHtml + '</div>';
        html += '</div>';
        html += '<div class="plantilla-card-footer">';
        html += '<span class="plantilla-card-fecha">📅 Creada ' + fecha + '</span>';
        html += '<div class="plantilla-card-acciones">';
        html += '<button class="btn-plantilla-accion btn-plantilla-editar" onclick="abrirModalPlantilla(' + p.id + ')">✏️ Editar</button>';
        html += '<button class="btn-plantilla-accion btn-plantilla-eliminar" onclick="eliminarPlantilla(' + p.id + ', \'' + escaparJS(p.nombre || '') + '\')">🗑️</button>';
        html += '</div>';
        html += '</div>';
        html += '</div>';
    }
    grid.innerHTML = html;
}

function escaparHTML(texto) {
    if (!texto) return '';
    return String(texto)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function escaparJS(texto) {
    if (!texto) return '';
    return String(texto).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

function formatearFecha(fecha) {
    if (!fecha) return '—';
    try {
        return new Date(fecha).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch (e) {
        return String(fecha);
    }
}

// ================== MODAL CREAR / EDITAR ==================
var plantillaEditandoId = null;

function abrirModalPlantilla(id) {
    plantillaEditandoId = id || null;

    var editando = null;
    for (var i = 0; i < plantillas.length; i++) {
        if (String(plantillas[i].id) === String(id)) {
            editando = plantillas[i];
            break;
        }
    }

    var nombre = editando ? editando.nombre : '';
    var contenido = editando ? editando.contenido : '';

    var contenidoHtml = '<div class="modal-plantilla-form">';
    contenidoHtml += '<div class="modal-plantilla-error" id="plantilla-error"></div>';
    contenidoHtml += '<div>';
    contenidoHtml += '<label>✏️ Nombre de la plantilla</label>';
    contenidoHtml += '<input type="text" id="plantilla-nombre" maxlength="100" placeholder="Ej: Aprobación rápida" value="' + escaparAtributo(nombre) + '">';
    contenidoHtml += '</div>';
    contenidoHtml += '<div>';
    contenidoHtml += '<label>📝 Mensaje</label>';
    contenidoHtml += '<textarea id="plantilla-contenido" maxlength="2000" rows="6" placeholder="Escribe tu mensaje aquí...">' + escaparTextoArea(contenido) + '</textarea>';
    contenidoHtml += '</div>';
    contenidoHtml += '<div class="plantilla-var-helper" onclick="insertarVariableNombre()" title="Insertar {nombre} en el mensaje">';
    contenidoHtml += '<span>➕</span><span>Insertar <span class="plantilla-var-chip">{nombre}</span> — se reemplaza con el nombre del cliente</span>';
    contenidoHtml += '</div>';
    contenidoHtml += '<div class="plantilla-caracteres" id="plantilla-caracteres">0 / 2000</div>';
    contenidoHtml += '</div>';

    Modal.abrir(
        '<div class="modal-header">' +
            '<h2>' + (editando ? '✏️ Editar plantilla' : '✨ Nueva plantilla') + '</h2>' +
            '<button class="modal-close-btn" onclick="Modal.cerrar()">✕</button>' +
        '</div>' +
        '<div class="modal-body">' + contenidoHtml + '</div>' +
        '<div class="modal-footer">' +
            '<button class="modal-btn modal-btn-cancel" onclick="Modal.cerrar()">Cancelar</button>' +
            '<button class="modal-btn modal-btn-primary" onclick="guardarPlantilla()">💾 Guardar</button>' +
        '</div>'
    );

    // Contador de caracteres
    var textarea = document.getElementById('plantilla-contenido');
    var contador = document.getElementById('plantilla-caracteres');
    textarea.addEventListener('input', function() {
        var n = textarea.value.length;
        contador.textContent = n + ' / 2000';
        contador.classList.toggle('over', n > 2000);
    });
    contador.textContent = textarea.value.length + ' / 2000';
    setTimeout(function() { textarea.focus(); }, 100);
}

function escaparAtributo(texto) {
    return String(texto || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escaparTextoArea(texto) {
    return String(texto || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function insertarVariableNombre() {
    var textarea = document.getElementById('plantilla-contenido');
    if (!textarea) return;
    var inicio = textarea.selectionStart || 0;
    var fin = textarea.selectionEnd || 0;
    var valor = textarea.value;
    textarea.value = valor.substring(0, inicio) + '{nombre}' + valor.substring(fin);
    textarea.focus();
    var nuevaPos = inicio + '{nombre}'.length;
    textarea.setSelectionRange(nuevaPos, nuevaPos);
    textarea.dispatchEvent(new Event('input'));
}

// ================== GUARDAR ==================
async function guardarPlantilla() {
    var nombre = document.getElementById('plantilla-nombre').value.trim();
    var contenido = document.getElementById('plantilla-contenido').value.trim();
    var errorEl = document.getElementById('plantilla-error');

    errorEl.classList.remove('visible');

    if (!nombre) { mostrarErrorModal('El nombre de la plantilla es obligatorio'); return; }
    if (!contenido) { mostrarErrorModal('El contenido del mensaje es obligatorio'); return; }

    var url = '/api/plantillas';
    var metodo = 'POST';
    if (plantillaEditandoId) {
        url += '/' + plantillaEditandoId;
        metodo = 'PUT';
    }

    try {
        var response = await fetch(url, {
            method: metodo,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nombre: nombre, contenido: contenido })
        });
        var data = await response.json();

        if (!response.ok) {
            mostrarErrorModal(data.error || 'Error al guardar la plantilla');
            return;
        }

        Modal.cerrar();
        mostrarToast(plantillaEditandoId ? '✅ Plantilla actualizada correctamente' : '✅ Plantilla creada correctamente');
        await cargarPlantillas();
    } catch (error) {
        console.error('[Plantillas] Error guardando:', error);
        mostrarErrorModal('Error de conexión: ' + error.message);
    }
}

function mostrarErrorModal(mensaje) {
    var errorEl = document.getElementById('plantilla-error');
    if (errorEl) {
        errorEl.textContent = '⚠️ ' + mensaje;
        errorEl.classList.add('visible');
    }
}

// ================== ELIMINAR ==================
function eliminarPlantilla(id, nombre) {
    Modal.confirmar({
        titulo: 'Eliminar plantilla',
        mensaje: '¿Seguro que quieres eliminar la plantilla <strong>"' + escaparHTML(nombre) + '"</strong>? Esta acción no se puede deshacer.',
        icono: '🗑️',
        textoConfirmar: 'Eliminar',
        tipo: 'danger',
        onConfirm: async function() {
            try {
                var response = await fetch('/api/plantillas/' + id, { method: 'DELETE', credentials: 'include' });
                var data = await response.json();
                if (!response.ok) {
                    alert(data.error || 'Error al eliminar');
                    return;
                }
                mostrarToast('🗑️ Plantilla eliminada');
                await cargarPlantillas();
            } catch (error) {
                console.error('[Plantillas] Error eliminando:', error);
                alert('Error de conexión: ' + error.message);
            }
        }
    });
}

// ================== TOAST ==================
function mostrarToast(mensaje) {
    var anterior = document.querySelector('.plantillas-toast');
    if (anterior) anterior.remove();
    var toast = document.createElement('div');
    toast.className = 'plantillas-toast';
    toast.textContent = mensaje;
    document.body.appendChild(toast);
    requestAnimationFrame(function() { toast.classList.add('visible'); });
    setTimeout(function() {
        toast.classList.remove('visible');
        setTimeout(function() { if (toast.parentNode) toast.remove(); }, 300);
    }, 2200);
}

// ================== INICIO ==================
cargarPlantillas();
