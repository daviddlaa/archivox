// Dashboard móvil
async function cargarDatos() {
    try {
        // Fetch stats
        const resStats = await fetch('/api/excel/dashboard');
        const datos = await resStats.json();
        
        document.getElementById('totalSolicitudes').textContent = datos.total || 0;
        document.getElementById('totalActivadas').textContent = datos.activadas || 0;
        document.getElementById('totalRechazadas').textContent = datos.rechazadas || 0;
        document.getElementById('totalPendientes').textContent = datos.pendientes || 0;
        
        // Fetch segmentos
        const resSeg = await fetch('/api/excel/dashboard/segmentos');
        const segmentos = await resSeg.json();
        
        renderCharts(datos, segmentos);
    } catch (e) {
        console.error('Error:', e);
    }
}

function renderCharts(datos, segmentos) {
    // Gráfico de Estados
    const ctx1 = document.getElementById('chartEstados');
    if (ctx1) {
        new Chart(ctx1.getContext('2d'), {
            type: 'doughnut',
            data: {
                labels: ['Activadas', 'Rechazadas', 'Pendientes', 'Devueltas'],
                datasets: [{
                    data: [datos.activadas || 0, datos.rechazadas || 0, datos.pendientes || 0, datos.devueltas || 0],
                    backgroundColor: ['#10b981', '#ef4444', '#f59e0b', '#fbbf24']
                }]
            },
            options: { responsive: true, maintainAspectRatio: false }
        });
    }
    
    // Gráfico de Segmentos
    const ctx2 = document.getElementById('chartSegmentos');
    if (ctx2 && segmentos && segmentos.length > 0) {
        const labels = segmentos.map(s => s.segmento);
        const values = segmentos.map(s => s.total);
        new Chart(ctx2.getContext('2d'), {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{
                    data: values,
                    backgroundColor: ['#6366f1', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316']
                }]
            },
            options: { responsive: true, maintainAspectRatio: false }
        });
    }
}

// Función para abrir nueva solicitud desde el dashboard móvil
function abrirNuevaSolicitudDesdeDash() {
    // Navegar a solicitudes y automáticamente abrir el modal después de cargar
    sessionStorage.setItem('abrirNuevaSolicitud', 'true');
    window.location.href = '/m/solicitudes';
    return false;
}

// Polling reducido: el dashboard móvil solo carga al iniciar y al volver a la página
// No hay setInterval porque en móvil se recarga al navegar
window.addEventListener('DOMContentLoaded', cargarDatos);

// Botón cerrar sesión
document.getElementById('btnLogout')?.addEventListener('click', async (e) => {
    e.preventDefault();
    if (confirm('¿Cerrar sesión?')) {
        try {
            await fetch('/api/auth/logout', { method: 'POST' });
            window.location.href = '/m/login';
        } catch (error) {
            console.error('Error al cerrar sesión:', error);
        }
    }
});
