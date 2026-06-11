// Cargar datos de ventas mensuales
document.addEventListener('DOMContentLoaded', async () => {
    try {
        // Verificar sesión
        const sessionRes = await fetch('/api/auth/sesion');
        if (!sessionRes.ok) {
            window.location.href = '/login';
            return;
        }

        // Cargar ventas mensuales
        const ventasRes = await fetch('/api/excel/dashboard/ventas-mensuales');
        const ventasData = await ventasRes.json();
        
        // Cargar datos del dashboard para totales
        const dashboardRes = await fetch('/api/excel/dashboard');
        const dashboardData = await dashboardRes.json();

        // Actualizar totales
        document.getElementById('totalActivadas').textContent = dashboardData.activadas || 0;
        
        // Calcular ventas de este mes
        const hoy = new Date();
        const mesActual = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}`;
        const ventaEsteMes = ventasData.find(v => v.mes === mesActual);
        document.getElementById('ventasEsteMes').textContent = ventaEsteMes ? ventaEsteMes.total : 0;
        
        // Calcular promedio mensual
        const promedio = ventasData.length > 0 
            ? Math.round(ventasData.reduce((sum, v) => sum + parseInt(v.total), 0) / ventasData.length)
            : 0;
        document.getElementById('promedioMensual').textContent = promedio;

        // Crear gráfico
        const meses = [];
        const totals = [];
        
        // Últimos 12 meses
        for (let i = 11; i >= 0; i--) {
            const fecha = new Date();
            fecha.setMonth(fecha.getMonth() - i);
            const mesKey = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`;
            const mesNombre = fecha.toLocaleDateString('es-ES', { month: 'short', year: 'numeric' });
            
            const venta = ventasData.find(v => v.mes === mesKey);
            meses.push(mesNombre);
            totals.push(venta ? parseInt(venta.total) : 0);
        }

        // Gráfico de ventas
        const ctx = document.getElementById('chartVentas').getContext('2d');
        new Chart(ctx, {
            type: 'bar',
            data: {
                labels: meses,
                datasets: [{
                    label: 'Ventas Activadas',
                    data: totals,
                    backgroundColor: 'rgba(99, 102, 241, 0.8)',
                    borderColor: 'rgba(99, 102, 241, 1)',
                    borderWidth: 1,
                    borderRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            stepSize: 1
                        }
                    }
                }
            }
        });

    } catch (error) {
        console.error('Error al cargar ventas:', error);
    }
});

// Cerrar sesión
document.getElementById('btnLogout')?.addEventListener('click', async (e) => {
    e.preventDefault();
    try {
        await fetch('/api/auth/logout', { method: 'POST' });
        window.location.href = '/login';
    } catch (error) {
        console.error('Error al cerrar sesión:', error);
    }
});
