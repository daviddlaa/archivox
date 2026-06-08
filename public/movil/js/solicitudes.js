// Solicitudes móvil - cards con buscador en tiempo real
let todosDatos = [];
let datosFilas = {};
let filasSeleccionadas = [];
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

// Cargar datos al iniciar
async function init() {
    try {
        const res = await fetch('/api/excel/solicitudes');
        todosDatos = await res.json();
        
        document.getElementById('totalRegistros').textContent = todosDatos.length;
        renderizarFiltros();
        aplicarFiltros();
    } catch (e) {
        console.error('Error cargando:', e);
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
            if (!matchCedula && !matchNombre) return false;
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
    
    container.innerHTML = datos.map(d => {
        // Guardar datos para usar después
        datosFilas[d.id_solicitud] = d;
        
        const seleccionado = filasSeleccionadas.indexOf(d.id_solicitud) > -1 ? 'seleccionada' : '';
        
        return `
        <div class="client-card ${seleccionado}" id="card-${d.id_solicitud}" onclick="toggleCard('${d.id_solicitud}')">
            <div class="card-head">
                <span class="client-id">#${d.id_solicitud}</span>
                <span class="badge estado-${d.estado}">${d.estado || 'N/A'}</span>
            </div>
            <div class="client-name">${d.nombre || 'Sin nombre'}</div>
            <div class="client-cedula">Cédula: ${d.cedula || 'N/A'}</div>
            <div class="tags">
                <span class="tag">${d.segmento || 'N/A'}</span>
                <span class="tag">${d.producto || 'N/A'}</span>
                <span class="tag">${d.fecha_solicitud || 'N/A'}</span>
            </div>
        </div>
        `;
    }).join('');
}

// Iniciar al cargar página
window.addEventListener('DOMContentLoaded', init);
