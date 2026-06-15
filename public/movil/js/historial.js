// Variables de paginación (móvil)
let paginaActual = 1;
const limitePorPagina = 20;
let totalRegistros = 0;

// Cargar historial al iniciar
document.addEventListener('DOMContentLoaded', () => {
    cargarHistorial();
});

async function cargarHistorial() {
    const offset = (paginaActual - 1) * limitePorPagina;
    
    const params = new URLSearchParams({
        limite: limitePorPagina,
        offset: offset
    });

    const campo = document.getElementById('filtroCampo')?.value;
    const fechaInicio = document.getElementById('fechaInicio')?.value;
    const fechaFin = document.getElementById('fechaFin')?.value;

    if (campo) params.append('campo', campo);
    if (fechaInicio) params.append('fechaInicio', fechaInicio);
    if (fechaFin) params.append('fechaFin', fechaFin);

    try {
        const response = await fetch(`/api/excel/historial?${params}`, {
            credentials: 'include'
        });

        if (!response.ok) {
            throw new Error('Error al cargar');
        }

        const data = await response.json();
        
        totalRegistros = data.total;
        renderizarLista(data.data);
        actualizarPaginacion();
        
    } catch (error) {
        console.error('Error:', error);
        document.getElementById('listaHistorial').innerHTML = `
            <div style="text-align: center; padding: 20px; color: red;">
                Error al cargar el historial
            </div>
        `;
    }
}

function renderizarLista(registros) {
    const container = document.getElementById('listaHistorial');
    
    if (!registros || registros.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 20px;">
                No hay actualizaciones registradas
            </div>
        `;
        return;
    }

    let html = '';
    for (const reg of registros) {
        const fecha = new Date(reg.fecha_actualizacion).toLocaleString('es-ES');
        
        html += `
            <div class="item-historial">
                <div class="header">
                    <span class="id">ID: ${reg.solicitud_id}</span>
                    <span class="campo ${reg.campo}">${reg.campo}</span>
                </div>
                <div class="valores">
                    <span class="anterior">${reg.valor_anterior || '-'}</span> 
                    ➝ 
                    <span class="nuevo">${reg.valor_nuevo || '-'}</span>
                </div>
                <div class="fecha">${fecha}</div>
            </div>
        `;
    }

    container.innerHTML = html;
}

function actualizarPaginacion() {
    const totalPaginas = Math.ceil(totalRegistros / limitePorPagina);
    
    document.getElementById('totalRegistros').textContent = `${totalRegistros} registros`;
    document.getElementById('infoPagina').textContent = `Página ${paginaActual} de ${totalPaginas}`;
    
    document.getElementById('btnAnterior').disabled = paginaActual === 1;
    document.getElementById('btnSiguiente').disabled = paginaActual >= totalPaginas;
}

function paginaAnterior() {
    if (paginaActual > 1) {
        paginaActual--;
        cargarHistorial();
    }
}

function paginaSiguiente() {
    const totalPaginas = Math.ceil(totalRegistros / limitePorPagina);
    if (paginaActual < totalPaginas) {
        paginaActual++;
        cargarHistorial();
    }
}
