// ============================================================================
// PROTECCIÓN SUPERADMIN: Redirigir al Panel de Administración
// El SuperAdmin no debe cargar el dashboard operativo
// ============================================================================
(function() {
    fetch('/api/auth/sesion')
        .then(function(r) { return r.json(); })
        .then(function(data) {
            if (data.autenticado && data.usuario.is_superadmin) {
                window.location.href = '/admin';
            }
        })
        .catch(function() {});
})();

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
        // Primero verificar si el usuario es líder
        const sesRes = await fetch('/api/auth/sesion');
        const ses = await sesRes.json();
        const esLider = ses.autenticado && ses.usuario.es_lider;

        // Mostrar/ocultar botón Gestión de Equipo en quick links
        const gestionBtn = document.getElementById('btnGestionEquipo');
        if (gestionBtn) {
            gestionBtn.style.display = esLider ? '' : 'none';
        }

        // Si no es líder, ocultar la tarjeta de equipo y salir
        if (!esLider) {
            const section = document.getElementById('miEquipoSection');
            if (section) section.style.display = 'none';
            return;
        }

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
        document.getElementById('totalAprobadas').textContent = datos.pendientes.toLocaleString();
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
    ajustarSlideEquipo();
    initDashdCarousel();
    initDashdWidgetsCarousel();
    personalizarBienvenida();
    igualarAlturaDashdWidgetsSlides();
    Promise.all([cargarCampañasActivas(), cargarUltimasSolicitudes(), cargarUltimasGestiones()])
        .then(igualarAlturaDashdWidgetsSlides)
        .catch(function() { igualarAlturaDashdWidgetsSlides(); });
}

iniciarDashboard();

// ============================================================================
// CARRUSEL PRINCIPAL DEL DASHBOARD DE ESCRITORIO
// 4 slides: Bienvenida / KPIs (equipo o stats) / Estados / Segmentos
// Navegación: dots + flechas ‹ › con loop, siguiendo el patrón del móvil.
// ============================================================================
function igualarAlturaDashdSlides() {
    var track = document.getElementById('dashdTrack');
    if (!track) return;
    var slides = track.querySelectorAll('.dashd-slide');
    if (slides.length < 2) return;
    track.style.height = 'auto';
    var max = 0;
    slides.forEach(function(s) { max = Math.max(max, s.offsetHeight); });
    if (max > 0) track.style.height = max + 'px';
}

function initDashdCarousel() {
    var track = document.getElementById('dashdTrack');
    if (!track) return;
    var slides = track.querySelectorAll('.dashd-slide');
    var dots = Array.prototype.slice.call(document.querySelectorAll('.dashd-dot'));
    var prev = document.getElementById('dashdPrev');
    var next = document.getElementById('dashdNext');
    if (slides.length < 2 || !dots.length) return;
    var step = slides[1].offsetLeft - slides[0].offsetLeft;

    function indiceActual() {
        return Math.max(0, Math.min(dots.length - 1, Math.round(track.scrollLeft / step)));
    }

    function irA(index) {
        track.scrollTo({ left: index * step, behavior: 'smooth' });
    }

    function actualizarDotActivo() {
        var index = indiceActual();
        dots.forEach(function(dot, i) {
            dot.classList.toggle('active', i === index);
        });
    }

    track.addEventListener('scroll', actualizarDotActivo, { passive: true });

    dots.forEach(function(dot, i) {
        dot.addEventListener('click', function() { irA(i); });
    });

    if (prev) {
        prev.addEventListener('click', function() {
            var i = indiceActual() - 1;
            irA(i < 0 ? slides.length - 1 : i);
        });
    }
    if (next) {
        next.addEventListener('click', function() {
            var i = indiceActual() + 1;
            irA(i >= slides.length ? 0 : i);
        });
    }

    window.addEventListener('resize', function() {
        step = slides[1].offsetLeft - slides[0].offsetLeft;
        actualizarDotActivo();
        igualarAlturaDashdSlides();
    });
}

// ============================================================================
// PASARELA DE WIDGETS (campañas / solicitudes / gestiones)
// Mismo patrón que el carrusel principal: flechas ‹ › con loop + dots.
// ============================================================================
// Los 3 widgets (campañas / solicitudes / gestiones) se muestran en línea
// (grid de 3 columnas con el mismo alto). Ya no hay scroll horizontal ni dots.
function igualarAlturaDashdWidgetsSlides() {
    var track = document.getElementById('dashdWidgetsTrack');
    if (!track) return;
    var cards = track.querySelectorAll('.dashd-widget-card');
    if (cards.length < 2) return;
    track.style.height = 'auto';
    var max = 0;
    cards.forEach(function(c) { max = Math.max(max, c.offsetHeight); });
    if (max > 0) track.style.height = max + 'px';
}

function initDashdWidgetsCarousel() {
    var track = document.getElementById('dashdWidgetsTrack');
    if (!track) return;
    // Layout en línea: solo se igualan las alturas de las tarjetas.
    igualarAlturaDashdWidgetsSlides();
    window.addEventListener('resize', igualarAlturaDashdWidgetsSlides);
}

// Slide 2: mostrar el equipo si eres líder; si no, las 4 stats
function ajustarSlideEquipo() {
    var team = document.getElementById('miEquipoSection');
    var stats = document.getElementById('dashboardStats');
    if (!team || !stats) return;
    var conEquipo = team.style.display !== 'none' && team.style.display !== '';
    stats.style.display = conEquipo ? 'none' : '';
    igualarAlturaDashdSlides();
}

// Slide 1: saludo personalizado con el nombre del usuario logueado
async function personalizarBienvenida() {
    var titulo = document.getElementById('welcomeTitulo');
    if (!titulo) return;
    try {
        var res = await fetch('/api/auth/sesion');
        var ses = await res.json();
        if (ses.autenticado && ses.usuario && ses.usuario.nombre) {
            var nombre = String(ses.usuario.nombre).trim().split(/\s+/)[0] || '';
            if (nombre) {
                titulo.textContent = '¡Bienvenido, ' + escapeHtml(nombre) + '!';
                return;
            }
        }
    } catch (e) { /* saludo genérico */ }
    titulo.textContent = '¡Bienvenido!';
}

// ============================================================================
// WIDGET ÚLTIMAS CAMPAÑAS ACTIVAS
// ============================================================================
function segmentoSemaforoHtml(conteo, clase) {
    var n = parseInt(conteo || 0, 10);
    if (!n) return '';
    return '<span class="campana-widget-semaforo-seg ' + clase + '" style="flex:' + n + '"></span>';
}

async function cargarCampañasActivas() {
    var container = document.getElementById('campanas-activas-lista');
    if (!container) return;
    try {
        var res = await fetch('/api/gestiones-maestro');
        if (!res.ok) throw new Error('status ' + res.status);
        var lista = await res.json();
        var activas = (lista || []).filter(function(c) {
            return String(c.estado || 'activa').toLowerCase() === 'activa';
        });

        if (!activas.length) {
            container.innerHTML = '<div class="campanas-widget-cta">' +
                '<span class="campanas-widget-cta-icon">🚀</span>' +
                '<span class="campanas-widget-cta-title">Todavía no tienes campañas activas</span>' +
                '<span class="campanas-widget-cta-sub">Crea una campaña para gestionar tus solicitudes en lote</span>' +
                '<a class="campanas-widget-cta-btn" href="/gestion-lote">➕ Crear campaña</a>' +
                '</div>';
            return;
        }

        var html = '';
        for (var i = 0; i < activas.length; i++) {
            var g = activas[i];
            var total = parseInt(g.total_solicitudes || 0, 10);
            var comp = parseInt(g.completadas || 0, 10);
            var pct = total > 0 ? Math.round((comp / total) * 100) : 0;
            var segSemaforo = segmentoSemaforoHtml(g.semaforo_verde, 'seg-verde')
                + segmentoSemaforoHtml(g.semaforo_amarillo, 'seg-amarillo')
                + segmentoSemaforoHtml(g.semaforo_rojo, 'seg-rojo')
                + segmentoSemaforoHtml(g.semaforo_sin_clasificar, 'seg-sin');
            if (!segSemaforo) segSemaforo = '<span class="campana-widget-semaforo-seg seg-vacio"></span>';
            html += '<a class="campana-widget-item" href="/gestion-lote?id=' + encodeURIComponent(g.id) + '">' +
                '<span class="campana-widget-icon">📋</span>' +
                '<span class="campana-widget-info">' +
                '<span class="campana-widget-name">' + escapeHtml(truncarTexto(g.nombre || 'Campaña #' + g.id, 30)) + '</span>' +
                '<span class="campana-widget-semaforo">' + segSemaforo + '</span>' +
                '<span class="campana-widget-stats">' + comp + ' de ' + total + ' · ' + pct + '%</span>' +
                '</span>' +
                '<span class="campana-widget-chevron">›</span>' +
                '</a>';
        }
        container.innerHTML = html;
        var item = container.querySelector('.campana-widget-item');
        container.style.maxHeight = item ? (item.offsetHeight * 4 + 8 * 3) + 'px' : '';
        container.style.overflowY = 'auto';
    } catch (e) {
        console.error('Error cargando campañas activas:', e);
        container.innerHTML = '<div class="campanas-widget-empty">No se pudieron cargar las campañas.</div>';
    }
}

// ============================================================================
// WIDGET ÚLTIMAS SOLICITUDES
// ============================================================================
var coloresEstadoSolWidget = {
    'ACTIVADA': '#dcfce7',
    'RECHAZADA': '#fee2e2',
    'DEVUELTA': '#fef3c7',
    'APROBADA PARA LIBERACIÓN': '#d1fae5'
};

async function cargarUltimasSolicitudes() {
    var container = document.getElementById('ultimas-solicitudes-lista');
    if (!container) return;
    try {
        var res = await fetch('/api/excel/solicitudes?limite=4');
        if (!res.ok) throw new Error('status ' + res.status);
        var result = await res.json();
        var lista = Array.isArray(result) ? result : (result.data || []);

        if (!lista.length) {
            container.innerHTML = '<div class="campanas-widget-cta">' +
                '<span class="campanas-widget-cta-icon">📋</span>' +
                '<span class="campanas-widget-cta-title">Aún no tienes solicitudes</span>' +
                '<span class="campanas-widget-cta-sub">Importa tu base de clientes o crea una solicitud manual</span>' +
                '<span class="campanas-widget-cta-btns">' +
                '<a class="campanas-widget-cta-btn" href="/importar">📤 Importar solicitudes</a>' +
                '<a class="campanas-widget-cta-btn campanas-widget-cta-btn-secondary" href="/solicitudes">➕ Nueva solicitud</a>' +
                '</span>' +
                '</div>';
            return;
        }

        var html = '';
        for (var i = 0; i < lista.length; i++) {
            var s = lista[i];
            var estado = s.estado || 'Sin estado';
            var color = coloresEstadoSolWidget[estado] || '#f3f4f6';
            html += '<a class="campana-widget-item" href="/solicitudes">' +
                '<span class="campana-widget-icon">📋</span>' +
                '<span class="campana-widget-info">' +
                '<span class="campana-widget-name">' + escapeHtml(truncarTexto(s.nombre || 'Sin nombre', 26)) + '</span>' +
                '<span class="sol-widget-meta">' +
                '<span class="sol-widget-badge" style="background:' + color + ';">' + escapeHtml(estado) + '</span>' +
                (s.cedula ? '<span class="sol-widget-cedula">· ' + escapeHtml(truncarTexto(s.cedula, 15)) + '</span>' : '') +
                '</span>' +
                '</span>' +
                '<span class="campana-widget-chevron">›</span>' +
                '</a>';
        }
        container.innerHTML = html;
    } catch (e) {
        console.error('Error cargando últimas solicitudes:', e);
        container.innerHTML = '<div class="campanas-widget-empty">No se pudieron cargar las solicitudes.</div>';
    }
}

// ============================================================================
// WIDGET ÚLTIMAS GESTIONES (últimas 4 gestiones, tarjeta igual a las demás)
// Líder: últimas gestiones de su equipo (con nombre del agente).
// Resto de usuarios: sus propias últimas gestiones.
// Estilo: tarjeta .campana-widget-item (ver docs/informe-armonia-widgets-movil.md).
// ============================================================================
var coloresTipoGestion = {
    'Pendiente': '#fef3c7',
    'Llamada': '#d1fae5',
    'WhatsApp': '#dcfce7',
    'Seguimiento': '#dbeafe',
    'Cobranza': '#fee2e2',
    'Cita': '#e0e7ff',
    'Completada': '#bbf7d0',
    'Recordatorio': '#ffedd5',
    'Otro': '#f3f4f6'
};

function truncarTexto(texto, max) {
    if (!texto) return '';
    if (String(texto).length <= max) return String(texto);
    return String(texto).substring(0, max - 3) + '...';
}

function formatearFechaWidget(fecha) {
    if (!fecha) return '—';
    var d = new Date(fecha);
    if (isNaN(d.getTime())) return '—';
    var ahora = new Date();
    var hoy = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate());
    var dia = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    var diff = Math.round((hoy.getTime() - dia.getTime()) / 86400000);
    var hora = d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
    if (diff <= 0) return 'Hoy · ' + hora;
    if (diff === 1) return 'Ayer · ' + hora;
    if (diff < 7) return 'El ' + ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'][d.getDay()] + ' · ' + hora;
    var semanas = Math.floor(diff / 7);
    if (semanas <= 4) return 'Hace ' + (semanas === 1 ? 'una semana' : semanas + ' semanas') + ' · ' + hora;
    var meses = Math.floor(diff / 30);
    if (meses <= 11) return 'Hace ' + (meses === 1 ? 'un mes' : meses + ' meses') + ' · ' + hora;
    return d.toLocaleDateString('es-ES') + ' · ' + hora;
}

async function cargarUltimasGestiones() {
    var container = document.getElementById('ultimas-gestiones-lista');
    if (!container) return;
    try {
        var sesRes = await fetch('/api/auth/sesion');
        var ses = await sesRes.json();
        var esLider = !!(ses.autenticado && ses.usuario && ses.usuario.es_lider);
        var equipoId = ses.autenticado && ses.usuario ? ses.usuario.equipo_id : null;

        var linkVerTodas = document.getElementById('ultimas-gestiones-link');
        if (linkVerTodas) {
            linkVerTodas.href = (esLider && equipoId) ? '/equipo' : '/gestiones';
        }

        var lista;
        if (esLider && equipoId) {
            var res = await fetch('/api/equipos/' + equipoId + '/gestiones?limite=4');
            if (!res.ok) throw new Error('status ' + res.status);
            var result = await res.json();
            lista = Array.isArray(result) ? result : (result.data || []);
        } else {
            var res2 = await fetch('/api/excel/gestiones/todas?limite=4');
            if (!res2.ok) throw new Error('status ' + res2.status);
            var result2 = await res2.json();
            lista = Array.isArray(result2) ? result2 : (result2.data || []);
        }

        if (!lista.length) {
            container.innerHTML = '<div class="campanas-widget-cta">' +
                '<span class="campanas-widget-cta-icon">📝</span>' +
                '<span class="campanas-widget-cta-title">Aún no has registrado gestiones</span>' +
                '<span class="campanas-widget-cta-sub">Gestiona tus solicitudes o crea una campaña para trabajar en lote</span>' +
                '<span class="campanas-widget-cta-btns">' +
                '<a class="campanas-widget-cta-btn" href="/solicitudes">📋 Ir a solicitudes</a>' +
                '<a class="campanas-widget-cta-btn campanas-widget-cta-btn-secondary" href="/gestion-lote">🚀 Crear campaña</a>' +
                '</span>' +
                '</div>';
            return;
        }

        // Tarjeta igual a campañas/solicitudes (icono + nombre + meta + chevron)
        var verTodas = document.getElementById('ultimas-gestiones-link');
        var hrefTodas = verTodas ? verTodas.href : '/gestiones';
        var html = '';
        for (var i = 0; i < lista.length; i++) {
            var g = lista[i];
            var color = coloresTipoGestion[g.tipo_gestion] || '#f3f4f6';
            var fecha = formatearFechaWidget(g.fecha_gestion);
            var principal = esLider
                ? (g.agente_nombre || g.agente_username || 'Agente')
                : (g.nombre || 'Sin nombre');
            var linea = esLider
                ? '#' + g.solicitud_id + (g.cliente_nombre ? ' · ' + truncarTexto(g.cliente_nombre, 24) : '')
                : '#' + g.solicitud_id + (g.cedula ? ' · 🆔 ' + truncarTexto(g.cedula, 18) : '');
            var obs = g.observacion ? truncarTexto(g.observacion, 90) : '';
            var tipo = (g.tipo_gestion || '—');

            html += '<a class="campana-widget-item" href="' + hrefTodas + '">' +
                '<span class="campana-widget-icon" style="background:' + color + ';">📝</span>' +
                '<span class="campana-widget-info">' +
                '<span class="campana-widget-name">' + escapeHtml(truncarTexto(principal, 28)) + '</span>' +
                '<span class="ges-widget-meta">' + escapeHtml(linea) + '</span>' +
                '<span class="campana-widget-badges">' +
                '<span class="campana-widget-badge-tipo" style="background:' + color + ';">' + escapeHtml(tipo) + '</span>' +
                '<span class="campana-widget-fecha">⏱️ ' + escapeHtml(fecha) + '</span>' +
                '</span>' +
                (obs ? '<span class="campana-widget-obs">' + escapeHtml(obs) + '</span>' : '') +
                '</span>' +
                '<span class="campana-widget-chevron">›</span>' +
                '</a>';
        }
        container.innerHTML = html;
        igualarAlturaDashdWidgetsSlides();
    } catch (e) {
        console.error('Error cargando últimas gestiones:', e);
        container.innerHTML = '<div class="campanas-widget-empty">No se pudieron cargar las gestiones.</div>';
        igualarAlturaDashdWidgetsSlides();
    }
}

// Polling reducido: cada 60 segundos (antes era 5s)
// Para 50 usuarios concurrentes, esto reduce el tráfico del dashboard
// de ~10 req/s a ~0.83 req/s
setInterval(() => {
    cargarDashboard();
}, 60000);

