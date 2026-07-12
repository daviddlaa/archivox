// Gráficos
let chartEstados = null;
let chartSegmentos = null;

const colores = [
    '#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', 
    '#f97316', '#eab308', '#22c55e', '#14b8a6',
    '#06b6d4', '#3b82f6'
];

// ============================================================================
// MI EQUIPO - Información del equipo del usuario (FASE 8)
// ============================================================================
async function cargarMiEquipo() {
    try {
        const res = await fetch('/api/equipos/mi-equipo');
        if (!res.ok) return;
        const data = await res.json();

        if (!data || data.id === undefined || data.id === null) {
            // Usuario sin equipo
            return;
        }

        const section = document.getElementById('miEquipoSection');
        section.style.display = 'block';

        document.getElementById('miEquipoNombre').textContent = `🏢 ${escapeHtml(data.nombre || 'Mi Equipo')}`;
        document.getElementById('miEquipoDesc').textContent = data.descripcion || 'Panel de información del equipo';

        // Badge de rol
        const rolBadge = document.getElementById('miEquipoRolBadge');
        try {
            const sesRes = await fetch('/api/auth/sesion');
            const ses = await sesRes.json();
            if (ses.autenticado) {
                if (ses.usuario.es_lider || ses.usuario.rol === 'superadmin' || ses.usuario.rol === 'admin') {
                    rolBadge.textContent = '👑 Líder';
                    rolBadge.className = 'mi-equipo-role-badge role-lider';
                } else if (ses.usuario.rol === 'agente') {
                    rolBadge.textContent = '🔹 Agente';
                    rolBadge.className = 'mi-equipo-role-badge role-agente';
                } else {
                    rolBadge.textContent = '👤 Miembro';
                    rolBadge.className = 'mi-equipo-role-badge role-miembro';
                }
            }
        } catch (e) { /* ignore */ }

        // Cargar líder y stats
        const equipoId = data.id;
        const [miembrosRes, dashboardRes] = await Promise.all([
            fetch(`/api/equipos/${equipoId}/miembros`),
            fetch(`/api/equipos/${equipoId}/dashboard`)
        ]);

        if (miembrosRes.ok) {
            const miembros = await miembrosRes.json();
            const miembrosArr = miembros.data || miembros || [];
            const activos = miembrosArr.filter(m => !m.fecha_salida);
            const lider = activos.find(m => m.es_lider);

            document.getElementById('miEquipoLider').textContent = lider
                ? escapeHtml(lider.usuario_username || lider.usuario_nombre || 'Asignado')
                : 'Sin asignar';
            document.getElementById('miEquipoAgentes').textContent = activos.length;
        }

        if (dashboardRes.ok) {
            const dash = await dashboardRes.json();
            document.getElementById('miEquipoAsignaciones').textContent =
                (dash.totales?.asignadas || 0).toLocaleString();
        }

    } catch (err) {
        console.error('[Dashboard] Error cargando Mi Equipo:', err);
    }
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/[&<>"']/g, function(c) {
        return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c] || c;
    });
}

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
    await cargarMiEquipo();
    await actualizarDashboard();
}

iniciarDashboard();

// Polling reducido: cada 60 segundos (antes era 5s)
// Para 50 usuarios concurrentes, esto reduce el tráfico del dashboard
// de ~10 req/s a ~0.83 req/s
setInterval(() => {
    cargarDashboard();
}, 60000);

