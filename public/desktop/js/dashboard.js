// Funciones del menú hamburguesa
function toggleMenu() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.querySelector('.menu-overlay');
    sidebar.classList.toggle('movil');
    sidebar.classList.toggle('active');
    overlay.classList.toggle('active');
}

// Gráficos
let chartEstados = null;
let chartSegmentos = null;

const colores = [
    '#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', 
    '#f97316', '#eab308', '#22c55e', '#14b8a6',
    '#06b6d4', '#3b82f6'
];

const coloresEstado = {
    'Activo': '#22c55e',
    'Activa': '#22c55e',
    'Rechazado': '#ef4444',
    'Rechazada': '#ef4444',
    'Pendiente': '#f59e0b',
    ' 默认': '#6366f1'
};

async function cargarDashboard() {
    try {
        const response = await fetch('/api/excel/dashboard');
        const datos = await response.json();
        
        document.getElementById('totalSolicitudes').textContent = datos.total.toLocaleString();
        document.getElementById('totalActivadas').textContent = datos.activadas.toLocaleString();
        document.getElementById('totalRechazadas').textContent = datos.rechazadas.toLocaleString();
        document.getElementById('totalPendientes').textContent = datos.pendientes.toLocaleString();
    } catch (error) {
        console.error('Error cargando dashboard:', error);
    }
}

async function cargarEstados() {
    try {
        const response = await fetch('/api/excel/dashboard/estados');
        const estados = await response.json();
        
        const labels = estados.map(e => e.estado);
        const data = estados.map(e => e.total);
        
        renderChartEstados(labels, data);
    } catch (error) {
        console.error('Error cargando estados:', error);
    }
}

async function cargarSegmentos() {
    try {
        const response = await fetch('/api/excel/dashboard/segmentos');
        const segmentos = await response.json();
        
        const labels = segmentos.map(s => s.segmento);
        const data = segmentos.map(s => s.total);
        
        renderChartSegmentos(labels, data);
    } catch (error) {
        console.error('Error cargando segmentos:', error);
    }
}

function renderChartEstados(labels, data) {
    const ctx = document.getElementById('chartEstados').getContext('2d');
    
    if (chartEstados) {
        chartEstados.destroy();
    }
    
    const bgColors = labels.map(label => {
        const nombre = label.toLowerCase();
        if (nombre.includes('activo') || nombre.includes('activa')) return '#22c55e';
        if (nombre.includes('rechazado') || nombre.includes('rechazada')) return '#ef4444';
        if (nombre.includes('pendiente')) return '#f59e0b';
        return colores[labels.indexOf(label) % colores.length];
    });
    
    chartEstados = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Cantidad',
                data: data,
                backgroundColor: bgColors,
                borderRadius: 8,
                borderSkipped: false,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            indexAxis: 'y',
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    backgroundColor: '#1f2937',
                    padding: 12,
                    cornerRadius: 8,
                    titleFont: { size: 14, weight: 'bold' },
                    bodyFont: { size: 13 }
                }
            },
            scales: {
                x: {
                    grid: {
                        display: false
                    },
                    ticks: {
                        font: { size: 12 }
                    }
                },
                y: {
                    grid: {
                        display: false
                    },
                    ticks: {
                        font: { size: 13, weight: '500' }
                    }
                }
            }
        }
    });
}

function renderChartSegmentos(labels, data) {
    const ctx = document.getElementById('chartSegmentos').getContext('2d');
    
    if (chartSegmentos) {
        chartSegmentos.destroy();
    }
    
    const bgColors = labels.map((_, i) => colores[i % colores.length]);
    
    chartSegmentos = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: bgColors,
                borderWidth: 3,
                borderColor: '#ffffff',
                hoverOffset: 10
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '60%',
            plugins: {
                legend: {
                    position: 'right',
                    labels: {
                        padding: 15,
                        usePointStyle: true,
                        pointStyle: 'circle',
                        font: { size: 12 }
                    }
                },
                tooltip: {
                    backgroundColor: '#1f2937',
                    padding: 12,
                    cornerRadius: 8,
                    titleFont: { size: 14, weight: 'bold' },
                    bodyFont: { size: 13 }
                }
            }
        }
    });
}

async function actualizarDashboard() {
    await cargarEstados();
    await cargarSegmentos();
}

async function iniciarDashboard() {
    await cargarDashboard();
    await actualizarDashboard();
}

iniciarDashboard();

setInterval(() => {
    cargarDashboard();
}, 5000);

// Botón cerrar sesión
document.getElementById('btnLogout')?.addEventListener('click', async (e) => {
    e.preventDefault();
    if (confirm('¿Cerrar sesión?')) {
        try {
            await fetch('/api/auth/logout', { method: 'POST' });
            window.location.href = '/login';
        } catch (error) {
            console.error('Error al cerrar sesión:', error);
        }
    }
});

// ================== LIMPIAR SOLICITUDES ==================

// Función para limpiar todas las solicitudes del usuario
async function limpiarSolicitudes() {
    // Primero obtener el total de solicitudes para mostrar en la confirmación
    try {
        const responseDash = await fetch('/api/excel/dashboard');
        const datos = await responseDash.json();
        const total = parseInt(datos.total) || 0;
        
        if (total === 0) {
            alert('No hay solicitudes para eliminar.');
            return;
        }
        
        // Mostrar confirmación
        const confirmar = confirm(
            '¿Estás seguro de eliminar todas tus solicitudes?\n\n' +
            'Esta acción no se puede deshacer.\n' +
            'Total de solicitudes a eliminar: ' + total.toLocaleString()
        );
        
        if (!confirmar) {
            return;
        }
        
        // Segunda confirmación para seguridad
        const confirmar2 = confirm(
            '⚠️ CONFIRMACIÓN FINAL ⚠️\n\n' +
            'Se eliminarán ' + total.toLocaleString() + ' solicitudes.\n' +
            '¿Continuar?'
        );
        
        if (!confirmar2) {
            return;
        }
        
        // Deshabilitar botón mientras procesa
        const btn = document.getElementById('btn-limpiar');
        const btnMovil = document.getElementById('btn-limpiar-movil');
        
        if (btn) {
            btn.textContent = '⏳ Eliminando...';
            btn.disabled = true;
        }
        if (btnMovil) {
            btnMovil.textContent = '⏳ Eliminando...';
            btnMovil.disabled = true;
        }
        
        // Ejecutar la limpieza
        const response = await fetch('/api/excel/solicitudes', {
            method: 'DELETE'
        });
        
        const resultado = await response.json();
        
        if (response.ok) {
            alert('✅ ' + resultado.mensaje + '\n\n' + 'Se eliminaron: ' + resultado.eliminadas.toLocaleString() + ' solicitudes');
            
            // Recargar dashboard
            await cargarDashboard();
            await actualizarDashboard();
        } else {
            alert('Error: ' + resultado.error);
        }
        
        // Restaurar botón
        if (btn) {
            btn.textContent = '🧹 Limpiar Todo';
            btn.disabled = false;
        }
        if (btnMovil) {
            btnMovil.textContent = '🧹 Limpiar Todo';
            btnMovil.disabled = false;
        }
        
    } catch (error) {
        console.error('Error al limpiar solicitudes:', error);
        alert('Error al procesar la solicitud. Verifica la conexión.');
        
        // Restaurar botón en caso de error
        const btn = document.getElementById('btn-limpiar');
        const btnMovil = document.getElementById('btn-limpiar-movil');
        
        if (btn) {
            btn.textContent = '🧹 Limpiar Todo';
            btn.disabled = false;
        }
        if (btnMovil) {
            btnMovil.textContent = '🧹 Limpiar Todo';
            btnMovil.disabled = false;
        }
    }
}
