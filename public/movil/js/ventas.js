// ================== CONTROL DE VENTAS DEL EQUIPO (MÓVIL) ==================

let currentMes = '';
let configBonos = { bono1: 3000, bono2: 7000, bono3: 12000, bono4: 20000, bono5: 30000, bono6: 40000, meta_equipo: 40000 };
let vendedores = [];

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
        width: '350px',
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
        
        renderizarCards();
        actualizarResumen();
        
        Swal.fire('✅ Guardado', 'Configuración guardada correctamente', 'success');
    } catch (err) {
        console.error('Error guardando config:', err);
        Swal.fire('❌ Error', 'No se pudo guardar la configuración', 'error');
    }
}

// ================== FIN SWEETALERT ==================

// ================== RENDERIZAR CARDS (MÓVIL) ==================
function renderizarCards() {
    const container = document.getElementById('cardsVendedores');
    if (!container) return;
    
    container.innerHTML = '';
    
    if (vendedores.length === 0) {
        container.innerHTML = '<div style="text-align: center; padding: 20px; color: #6b7280;">Sin vendedores. Agrega uno.</div>';
        return;
    }
    
    vendedores.forEach((v, index) => {
        const suma = (parseFloat(v.periodo1) || 0) + (parseFloat(v.periodo2) || 0);
        const meta = calcularMeta(suma);
        const falta = siguienteMeta(suma);
        const badgeClass = falta === 0 ? 'alcanzado' : 'faltante';
        
        const card = document.createElement('div');
        card.className = 'vendedor-card';
        card.innerHTML = `
            <div class="nombre">
                <input type="text" value="${v.vendedor}" onchange="actualizarVendedor(${index}, 'vendedor', this.value)" placeholder="Nombre del vendedor" style="width: 100%; font-size: 16px; font-weight: bold; border: 1px solid #d1d5db; border-radius: 6px; padding: 8px;">
            </div>
            <div class="datos">
                <div class="dato">
                    <label>Suma</label>
                    <div class="valor">$${suma.toLocaleString()}</div>
                </div>
                <div class="dato">
                    <label>Falta</label>
                    <div class="valor">${falta > 0 ? '-$' + falta.toLocaleString() : '¡OK!'}</div>
                </div>
            </div>
            <div class="meta-badge ${badgeClass}">${meta.nombre}</div>
            <div class="inputs">
                <div>
                    <label style="font-size: 10px; color: #6b7280;">P1 ($)</label>
                    <input type="number" value="${v.periodo1 || 0}" onchange="actualizarVendedor(${index}, 'periodo1', this.value)" step="0.01">
                </div>
                <div>
                    <label style="font-size: 10px; color: #6b7280;">P2 ($)</label>
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

// ================== FIN CARDS ==================

// Generar meses del año en curso
function generarMeses() {
    const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    const anio = new Date().getFullYear();
    const selector = document.getElementById('selectorMes');
    
    if (!selector) return;
    
    selector.innerHTML = '';
    meses.forEach((mes, index) => {
        const valor = `${anio}-${String(index + 1).padStart(2, '0')}`;
        const option = document.createElement('option');
        option.value = valor;
        option.textContent = `${mes} ${anio}`;
        selector.appendChild(option);
    });
    
    // Seleccionar mes actual
    const mesActual = `${anio}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
    selector.value = mesActual;
    currentMes = mesActual;
}

// Calcular meta alcanzada
function calcularMeta(totalVenta) {
    if (totalVenta >= configBonos.bono6) return { nombre: `$${configBonos.bono6}`, monto: configBonos.bono6 };
    if (totalVenta >= configBonos.bono5) return { nombre: `$${configBonos.bono5}`, monto: configBonos.bono5 };
    if (totalVenta >= configBonos.bono4) return { nombre: `$${configBonos.bono4}`, monto: configBonos.bono4 };
    if (totalVenta >= configBonos.bono3) return { nombre: `$${configBonos.bono3}`, monto: configBonos.bono3 };
    if (totalVenta >= configBonos.bono2) return { nombre: `$${configBonos.bono2}`, monto: configBonos.bono2 };
    if (totalVenta >= configBonos.bono1) return { nombre: `$${configBonos.bono1}`, monto: configBonos.bono1 };
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
    } catch (err) {
        console.error('Error cargando vendedores:', err);
    }
}

// Renderizar tabla
function renderizarTabla() {
    const tbody = document.getElementById('tablaVendedores');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    if (vendedores.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7">Sin vendedores. Agrega uno.</td></tr>';
        return;
    }
    
    vendedores.forEach((v, index) => {
        const suma = (parseFloat(v.periodo1) || 0) + (parseFloat(v.periodo2) || 0);
        const meta = calcularMeta(suma);
        const falta = siguienteMeta(suma);
        
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><input type="text" value="${v.vendedor}" onchange="actualizarVendedor(${index}, 'vendedor', this.value)" placeholder="Nombre"></td>
            <td><input type="number" value="${v.periodo1 || 0}" onchange="actualizarVendedor(${index}, 'periodo1', this.value)"></td>
            <td><input type="number" value="${v.periodo2 || 0}" onchange="actualizarVendedor(${index}, 'periodo2', this.value)"></td>
            <td><strong>$${suma.toLocaleString()}</strong></td>
            <td>${meta.nombre}</td>
            <td>${falta > 0 ? '-$' + falta : 'OK!'}</td>
            <td><button class="btn-eliminar" onclick="eliminarVendedor(${v.id})">X</button></td>
        `;
        tbody.appendChild(tr);
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
}

// Eliminar vendedor
async function eliminarVendedor(id) {
    if (!id || !confirm('¿Eliminar?')) return;
    
    try {
        await fetch(`/api/excel/ventas-equipo/${id}`, { method: 'DELETE' });
        cargarVendedores();
    } catch (err) {
        console.error('Error:', err);
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
            console.error('Error:', err);
        }
    }
    
    alert('¡Guardado!');
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
    
    const elTotal = document.getElementById('totalEquipo');
    const elMejor = document.getElementById('mejorVendedor');
    const ventasMejor = document.getElementById('ventasMejor');
    const metaEq = document.getElementById('metaEquipo');
    
    if (elTotal) elTotal.textContent = '$' + total.toLocaleString();
    if (elMejor) elMejor.textContent = mejor.nombre;
    if (ventasMejor) ventasMejor.textContent = '$' + mejor.ventas.toLocaleString();
    if (metaEq) metaEq.textContent = 'Meta: $' + (configBonos.meta_equipo || 40000).toLocaleString();
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
        meta_equipo: 40000
    };
    
    try {
        await fetch('/api/excel/config-bonos', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        
        configBonos = data;
        alert('¡Config guardada!');
        renderizarTabla();
        actualizarResumen();
    } catch (err) {
        console.error('Error:', err);
    }
}

// Inicializar
document.addEventListener('DOMContentLoaded', () => {
    generarMeses();
    
    const selector = document.getElementById('selectorMes');
    if (selector) {
        selector.addEventListener('change', (e) => {
            currentMes = e.target.value;
            cargarConfigBonos();
            cargarVendedores();
        });
    }
    
    cargarConfigBonos();
    cargarVendedores();
    
    // Logout
    const btnLogout = document.getElementById('btnLogout');
    if (btnLogout) {
        btnLogout.addEventListener('click', async (e) => {
            e.preventDefault();
            await fetch('/api/auth/logout', { method: 'POST' });
            window.location.href = '/m/login';
        });
    }
});
