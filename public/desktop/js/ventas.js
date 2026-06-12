// ================== CONTROL DE VENTAS DEL EQUIPO ==================

let currentMes = '';
let configBonos = { bono1: 3000, bono2: 7000, bono3: 12000, bono4: 20000, bono5: 30000, bono6: 40000, meta_equipo: 40000 };
let vendedores = [];
let grafico = null;

// ================== SWEETALERT CONFIG METAS ==================
function mostrarConfigMetas() {
    const html = `
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; text-align: left;">
            <div><label style="font-size: 12px; color: #6b7280;">Meta 1 ($)</label><input type="number" id="sw-bono1" value="${configBonos.bono1}" style="width: 100%; padding: 8px; border: 1px solid #d1d5db; border-radius: 6px;"></div>
            <div><label style="font-size: 12px; color: #6b7280;">Meta 2 ($)</label><input type="number" id="sw-bono2" value="${configBonos.bono2}" style="width: 100%; padding: 8px; border: 1px solid #d1d5db; border-radius: 6px;"></div>
            <div><label style="font-size: 12px; color: #6b7280;">Meta 3 ($)</label><input type="number" id="sw-bono3" value="${configBonos.bono3}" style="width: 100%; padding: 8px; border: 1px solid #d1d5db; border-radius: 6px;"></div>
            <div><label style="font-size: 12px; color: #6b7280;">Meta 4 ($)</label><input type="number" id="sw-bono4" value="${configBonos.bono4}" style="width: 100%; padding: 8px; border: 1px solid #d1d5db; border-radius: 6px;"></div>
            <div><label style="font-size: 12px; color: #6b7280;">Meta 5 ($)</label><input type="number" id="sw-bono5" value="${configBonos.bono5}" style="width: 100%; padding: 8px; border: 1px solid #d1d5db; border-radius: 6px;"></div>
            <div><label style="font-size: 12px; color: #6b7280;">Meta 6 ($)</label><input type="number" id="sw-bono6" value="${configBonos.bono6}" style="width: 100%; padding: 8px; border: 1px solid #d1d5db; border-radius: 6px;"></div>
            <div style="grid-column: span 2;"><label style="font-size: 12px; color: #6b7280;">Meta Equipo ($)</label><input type="number" id="sw-meta-equipo" value="${configBonos.meta_equipo}" style="width: 100%; padding: 8px; border: 1px solid #d1d5db; border-radius: 6px;"></div>
        </div>
    `;
    
    Swal.fire({
        title: '⚙️ Configurar Metas',
        html: html,
        confirmButtonText: '💾 Guardar',
        confirmButtonColor: '#3b82f6',
        cancelButtonText: 'Cancelar',
        showCancelButton: true,
        width: '500px',
        preConfirm: () => {
            return {
                bono1: parseFloat(document.getElementById('sw-bono1').value) || 3000,
                bono2: parseFloat(document.getElementById('sw-bono2').value) || 7000,
                bono3: parseFloat(document.getElementById('sw-bono3').value) || 12000,
                bono4: parseFloat(document.getElementById('sw-bono4').value) || 20000,
                bono5: parseFloat(document.getElementById('sw-bono5').value) || 30000,
                bono6: parseFloat(document.getElementById('sw-bono6').value) || 40000,
                meta_equipo: parseFloat(document.getElementById('sw-meta-equipo').value) || 40000
            };
        }
    }).then((result) => {
        if (result.isConfirmed && result.value) {
            guardarConfigBonosSweetAlert(result.value);
        }
    });
}

async function guardarConfigBonosSweetAlert(data) {
    const payload = { mes: currentMes, ...data };
    try {
        await fetch('/api/excel/config-bonos', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        
        configBonos = data;
        // Actualizar inputs ocultos
        document.getElementById('bono1').value = data.bono1;
        document.getElementById('bono2').value = data.bono2;
        document.getElementById('bono3').value = data.bono3;
        document.getElementById('bono4').value = data.bono4;
        document.getElementById('bono5').value = data.bono5;
        document.getElementById('bono6').value = data.bono6;
        document.getElementById('metaEquipoInput').value = data.meta_equipo;
        
renderizarCards();
        actualizarResumen();
        actualizarGrafico();
        
        Swal.fire('✅ Guardado', 'Configuración guardada correctamente', 'success');
    } catch (err) {
        console.error('Error guardando config:', err);
        Swal.fire('❌ Error', 'No se pudo guardar la configuración', 'error');
    }
}

// ================== FIN SWEETALERT ==================

// Generar meses del año en curso
function generarMeses() {
    const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    const anio = new Date().getFullYear();
    const selector = document.getElementById('selectorMes');
    
    selector.innerHTML = '';
    meses.forEach((mes, index) => {
        const valor = `${anio}-${String(index + 1).padStart(2, '0')}`;
        const option = document.createElement('option');
        option.value = valor;
        option.textContent = `${mes} ${anio}`;
        selector.appendChild(option);
    });
    
    // Seleccionar mes actual por defecto
    const mesActual = `${anio}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
    selector.value = mesActual;
    currentMes = mesActual;
}

// Calcular meta alcanzada
function calcularMeta(totalVenta) {
    if (totalVenta >= configBonos.bono6) return { nombre: `Meta $${configBonos.bono6.toLocaleString()}`, monto: configBonos.bono6 };
    if (totalVenta >= configBonos.bono5) return { nombre: `Meta $${configBonos.bono5.toLocaleString()}`, monto: configBonos.bono5 };
    if (totalVenta >= configBonos.bono4) return { nombre: `Meta $${configBonos.bono4.toLocaleString()}`, monto: configBonos.bono4 };
    if (totalVenta >= configBonos.bono3) return { nombre: `Meta $${configBonos.bono3.toLocaleString()}`, monto: configBonos.bono3 };
    if (totalVenta >= configBonos.bono2) return { nombre: `Meta $${configBonos.bono2.toLocaleString()}`, monto: configBonos.bono2 };
    if (totalVenta >= configBonos.bono1) return { nombre: `Meta $${configBonos.bono1.toLocaleString()}`, monto: configBonos.bono1 };
    return { nombre: 'Sin meta', monto: 0 };
}

// Calcular siguiente meta
function siguienteMeta(totalVenta) {
    const metas = [configBonos.bono1, configBonos.bono2, configBonos.bono3, configBonos.bono4, configBonos.bono5, configBonos.bono6];
    for (const meta of metas) {
        if (totalVenta < meta) return meta - totalVenta;
    }
    return 0;
}

// Cargar configuración de bonos
async function cargarConfigBonos() {
    try {
        const response = await fetch(`/api/excel/config-bonos?mes=${currentMes}`);
        const data = await response.json();
        if (data && data.bono1) {
            configBonos = data;
            document.getElementById('bono1').value = data.bono1;
            document.getElementById('bono2').value = data.bono2;
            document.getElementById('bono3').value = data.bono3;
            document.getElementById('bono4').value = data.bono4;
            document.getElementById('bono5').value = data.bono5;
            document.getElementById('bono6').value = data.bono6;
            document.getElementById('metaEquipoInput').value = data.meta_equipo;
        }
    } catch (err) {
        console.error('Error cargando config:', err);
    }
}

// Cargar vendedores
async function cargarVendedores() {
    try {
        const response = await fetch(`/api/excel/ventas-equipo?mes=${currentMes}`);
        vendedores = await response.json();
        renderizarCards();
        actualizarResumen();
        actualizarGrafico();
    } catch (err) {
        console.error('Error cargando vendedores:', err);
    }
}

// Obtener siguiente meta
function obtenerSiguienteMeta(totalVenta) {
    const metas = [configBonos.bono1, configBonos.bono2, configBonos.bono3, configBonos.bono4, configBonos.bono5, configBonos.bono6];
    for (const meta of metas) {
        if (totalVenta < meta) return meta;
    }
    return 0;
}

// Renderizar cards (escritorio) - diseño mejorado con más campos
function renderizarCards() {
    const container = document.getElementById('cardsVendedores');
    if (!container) return;
    
    container.innerHTML = '';
    
    if (vendedores.length === 0) {
        container.innerHTML = '<div style="text-align: center; padding: 20px; color: #6b7280; grid-column: span 2;">Sin vendedores. Agrega uno.</div>';
        return;
    }
    
    vendedores.forEach((v, index) => {
        const suma = (parseFloat(v.periodo1) || 0) + (parseFloat(v.periodo2) || 0);
        const meta = calcularMeta(suma);
        const falta = siguienteMeta(suma);
        const siguiente = obtenerSiguienteMeta(suma);
        
        // Meta alcanzada: mostrar "$X" si alcanzó alguna, o "Sin meta" si no
        const metaAlcanzada = meta.monto > 0 ? `$${meta.monto.toLocaleString()}` : 'Sin meta';
        
        // Próxima meta: mostrar la siguiente meta a alcanzar
        const proxMeta = siguiente > 0 ? `$${siguiente.toLocaleString()}` : 'Completado!';
        
        // Estado: mostrar "Aún falta $X" o "Completado!"
        const estadoTexto = falta > 0 ? `Aún falta $${falta.toLocaleString()}` : 'Completado!';
        const estadoClass = falta > 0 ? 'faltante' : 'alcanzado';
        
        // Badge
        const badgeTexto = meta.monto > 0 ? `Meta: $${meta.monto.toLocaleString()}` : 'Sin meta';
        const badgeClass = meta.monto > 0 ? 'alcanzado' : 'sin-meta';
        
        const card = document.createElement('div');
        card.className = 'vendedor-card';
        card.innerHTML = `
            <div class="nombre">
                <input type="text" value="${v.vendedor}" onchange="actualizarVendedor(${index}, 'vendedor', this.value)" placeholder="Nombre del vendedor">
            </div>
            <div class="datos">
                <div class="dato">
                    <label>Total Vendido</label>
                    <div class="valor">$${suma.toLocaleString()}</div>
                </div>
                <div class="dato">
                    <label>Meta Alcanzada</label>
                    <div class="valor">${metaAlcanzada}</div>
                </div>
            </div>
            <div class="datos">
                <div class="dato">
                    <label>Próxima Meta</label>
                    <div class="valor">${proxMeta}</div>
                </div>
                <div class="dato">
                    <label>Estado</label>
                    <div class="estado-badge ${estadoClass}">${estadoTexto}</div>
                </div>
            </div>
            <div class="meta-badge ${badgeClass}">${badgeTexto}</div>
            <div class="inputs">
                <div>
                    <label style="font-size: 12px; color: #6b7280;">P1 ($)</label>
                    <input type="number" value="${v.periodo1 || 0}" onchange="actualizarVendedor(${index}, 'periodo1', this.value)" step="0.01">
                </div>
                <div>
                    <label style="font-size: 12px; color: #6b7280;">P2 ($)</label>
                    <input type="number" value="${v.periodo2 || 0}" onchange="actualizarVendedor(${index}, 'periodo2', this.value)" step="0.01">
                </div>
            </div>
            <div class="btn-accion">
                <button class="btn-eliminar" onclick="eliminarVendedor(${v.id})">🗑️ Eliminar</button>
            </div>
        `;
        container.appendChild(card);
    });
}

// Agregar vendedor
function agregarVendedor() {
    vendedores.push({ id: null, vendedor: '', periodo1: 0, periodo2: 0 });
    renderizarCards();
}

// Actualizar vendedor
function actualizarVendedor(index, campo, valor) {
    vendedores[index][campo] = valor;
    renderizarCards();
    actualizarResumen();
    actualizarGrafico();
}

// Eliminar vendedor
async function eliminarVendedor(id) {
    if (!id || !confirm('¿Eliminar este vendedor?')) return;
    
    try {
        await fetch(`/api/excel/ventas-equipo/${id}`, { method: 'DELETE' });
        cargarVendedores();
    } catch (err) {
        console.error('Error eliminando:', err);
    }
}

// Guardar todo
async function guardarTodo() {
    for (const v of vendedores) {
        if (!v.vendedor || v.vendedor.trim() === '') continue;
        
        try {
            await fetch('/api/excel/ventas-equipo', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    mes: currentMes,
                    vendedor: v.vendedor,
                    periodo1: parseFloat(v.periodo1) || 0,
                    periodo2: parseFloat(v.periodo2) || 0
                })
            });
        } catch (err) {
            console.error('Error guardando:', err);
        }
    }
    
    alert('¡Guardado correctamente!');
    cargarVendedores();
}

// Actualizar resumen
function actualizarResumen() {
    let total = 0;
    let mejor = { nombre: '-', ventas: 0 };
    
    vendedores.forEach(v => {
        const suma = (parseFloat(v.periodo1) || 0) + (parseFloat(v.periodo2) || 0);
        total += suma;
        if (suma > mejor.ventas) {
            mejor = { nombre: v.vendedor, ventas: suma };
        }
    });
    
    document.getElementById('totalEquipo').textContent = `$${total.toLocaleString()}`;
    document.getElementById('metaEquipo').textContent = `Meta: $${configBonos.meta_equipo.toLocaleString()}`;
    document.getElementById('mejorVendedor').textContent = mejor.nombre;
    document.getElementById('ventasMejor').textContent = `$${mejor.ventas.toLocaleString()}`;
    document.getElementById('totalVendedores').textContent = vendedores.length;
}

// Guardar config bonos
async function guardarConfigBonos() {
    const data = {
        mes: currentMes,
        bono1: parseFloat(document.getElementById('bono1').value) || 3000,
        bono2: parseFloat(document.getElementById('bono2').value) || 7000,
        bono3: parseFloat(document.getElementById('bono3').value) || 12000,
        bono4: parseFloat(document.getElementById('bono4').value) || 20000,
        bono5: parseFloat(document.getElementById('bono5').value) || 30000,
        bono6: parseFloat(document.getElementById('bono6').value) || 40000,
        meta_equipo: parseFloat(document.getElementById('metaEquipoInput').value) || 40000
    };
    
    try {
        await fetch('/api/excel/config-bonos', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        
configBonos = data;
        alert('¡Configuración guardada!');
        renderizarCards();
        actualizarResumen();
    } catch (err) {
        console.error('Error guardando config:', err);
    }
}

// Actualizar gráfico (versión pequeña para escritorio)
function actualizarGrafico() {
    const ctx = document.getElementById('graficoVentas');
    if (!ctx) return;
    
    if (grafico) grafico.destroy();
    
    const labels = vendedores.map(v => v.vendedor);
    const datos = vendedores.map(v => (parseFloat(v.periodo1) || 0) + (parseFloat(v.periodo2) || 0));
    
    grafico = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Ventas ($)',
                data: datos,
                backgroundColor: datos.map((v, i) => v >= configBonos.bono3 ? '#10b981' : '#3b82f6'),
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: { legend: { display: false } },
            scales: {
                y: { 
                    beginAtZero: true,
                    ticks: { font: { size: 10 } }
                },
                x: {
                    ticks: { font: { size: 10 } }
                }
            }
        }
    });
}

// Inicializar
document.addEventListener('DOMContentLoaded', () => {
    generarMeses();
    
    document.getElementById('selectorMes').addEventListener('change', (e) => {
        currentMes = e.target.value;
        cargarConfigBonos();
        cargarVendedores();
    });
    
    cargarConfigBonos();
    cargarVendedores();
    
    // Logout
    document.getElementById('btnLogout')?.addEventListener('click', async (e) => {
        e.preventDefault();
        await fetch('/api/auth/logout', { method: 'POST' });
        window.location.href = '/login';
    });
});
