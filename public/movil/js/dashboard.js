// ============================================================================
// PROTECCIÓN SUPERADMIN: Redirigir al Panel de Administración
// El SuperAdmin no debe cargar el dashboard operativo
// ============================================================================
(function() {
    fetch('/api/auth/sesion')
        .then(function(r) { return r.json(); })
        .then(function(data) {
            if (data.autenticado && data.usuario.is_superadmin) {
                window.location.href = '/m/admin';
            }
        })
        .catch(function() {});
})();

// Dashboard móvil
async function cargarDatos() {
    try {
        // Fetch stats
        const resStats = await fetch('/api/excel/dashboard');
        const datos = await resStats.json();
        
        document.getElementById('totalSolicitudes').textContent = datos.total || 0;
        document.getElementById('totalActivadas').textContent = datos.activadas || 0;
        document.getElementById('totalRechazadas').textContent = datos.rechazadas || 0;
        document.getElementById('totalAprobadas').textContent = datos.pendientes || 0;
        
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
                labels: ['Activadas', 'Rechazadas', 'Aprobadas', 'Devueltas'],
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

// Reemplazar acceso a Relaciones por Gestión de Equipo si el usuario es líder
async function ajustarAccesoRapido() {
    try {
        const res = await fetch('/api/auth/sesion');
        const data = await res.json();
        if (data.autenticado && data.usuario.es_lider) {
            const relaLink = document.getElementById('heroRelaciones');
            const eqLink = document.getElementById('heroGestionEquipo');
            if (relaLink) relaLink.style.display = 'none';
            if (eqLink) eqLink.style.display = '';
        }
    } catch (e) { /* ignore */ }
}

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

// Ajustar accesos rápidos al cargar
window.addEventListener('DOMContentLoaded', function() {
    ajustarAccesoRapido();
    initDashCarousel();
    initDashWidgetCarousel();
    igualarAlturaWidgetSlides();
    Promise.all([cargarCampañasActivas(), cargarUltimasSolicitudes(), cargarUltimasGestiones()])
        .then(igualarAlturaWidgetSlides)
        .catch(function() { igualarAlturaWidgetSlides(); });
});

// Iguala la altura de los slides del carrusel de widgets (campañas / solicitudes)
function igualarAlturaWidgetSlides() {
    var carousel = document.getElementById('dashWidgetCarousel');
    if (!carousel) return;
    var slides = carousel.querySelectorAll('.dash-widget-slide');
    if (slides.length < 2) return;
    carousel.style.height = 'auto';
    var max = 0;
    slides.forEach(function(s) { max = Math.max(max, s.offsetHeight); });
    if (max > 0) carousel.style.height = max + 'px';
}

window.addEventListener('resize', igualarAlturaWidgetSlides);

// ============================================================================
// LOOP INFINITO POR GESTO TÁCTIL
// Permite quedarse en cualquier slide; solo un swipe extra desde el último
// regresa suave al primero (y viceversa desde el primero hacia el último).
// ============================================================================
function configurarLoopTouch(carousel, getUltimaPos) {
    if (!carousel) return;
    var umbral = 55;
    var startX = null, startY = null, enUltima = false, enPrimera = false;

    carousel.addEventListener('touchstart', function(e) {
        if (e.touches.length !== 1) { startX = null; return; }
        startX = e.touches[0].clientX;
        startY = e.touches[0].clientY;
        enUltima = carousel.scrollLeft >= getUltimaPos() - 1;
        enPrimera = carousel.scrollLeft <= 1;
    }, { passive: true });

    carousel.addEventListener('touchcancel', function() { startX = null; }, { passive: true });

    carousel.addEventListener('touchend', function(e) {
        if (startX === null) return;
        var t = e.changedTouches[0];
        var dX = t.clientX - startX;
        var dY = t.clientY - startY;
        startX = null;
        if (Math.abs(dX) < umbral || Math.abs(dX) < Math.abs(dY)) return;
        if (enUltima && dX < 0) {
            carousel.scrollTo({ left: 0, behavior: 'smooth' });
        } else if (enPrimera && dX > 0) {
            carousel.scrollTo({ left: getUltimaPos(), behavior: 'smooth' });
        }
    }, { passive: true });
}

// ============================================================================
// CARRUSEL DESLIZABLE (herramientas / KPIs / estados / segmentos)
// ============================================================================
function initDashCarousel() {
    var carousel = document.getElementById('dashCarousel');
    if (!carousel) return;
    var slides = carousel.querySelectorAll('.dash-slide');
    var dots = Array.prototype.slice.call(document.querySelectorAll('.dash-dot'));
    if (slides.length < 2 || !dots.length) return;
    var step = slides[1].offsetLeft - slides[0].offsetLeft;

    function actualizarDotActivo() {
        var index = Math.max(0, Math.min(dots.length - 1, Math.round(carousel.scrollLeft / step)));
        dots.forEach(function(dot, i) {
            dot.classList.toggle('active', i === index);
        });
    }

    carousel.addEventListener('scroll', actualizarDotActivo, { passive: true });
    dots.forEach(function(dot, i) {
        dot.addEventListener('click', function() {
            carousel.scrollTo({ left: i * step, behavior: 'smooth' });
        });
    });
    configurarLoopTouch(carousel, function() { return (slides.length - 1) * step; });
    window.addEventListener('resize', function() {
        step = slides[1].offsetLeft - slides[0].offsetLeft;
        actualizarDotActivo();
    });
}

// ============================================================================
// CARRUSEL DE WIDGETS (campañas activas / últimas solicitudes)
// ============================================================================
function initDashWidgetCarousel() {
    var carousel = document.getElementById('dashWidgetCarousel');
    if (!carousel) return;
    var slides = carousel.querySelectorAll('.dash-widget-slide');
    var dots = Array.prototype.slice.call(document.querySelectorAll('.dash-widget-dot'));
    if (slides.length < 2 || !dots.length) return;
    var step = slides[1].offsetLeft - slides[0].offsetLeft;

    function actualizarDotActivo() {
        var index = Math.max(0, Math.min(dots.length - 1, Math.round(carousel.scrollLeft / step)));
        dots.forEach(function(dot, i) {
            dot.classList.toggle('active', i === index);
        });
    }

    carousel.addEventListener('scroll', actualizarDotActivo, { passive: true });
    dots.forEach(function(dot, i) {
        dot.addEventListener('click', function() {
            carousel.scrollTo({ left: i * step, behavior: 'smooth' });
        });
    });
    configurarLoopTouch(carousel, function() { return (slides.length - 1) * step; });
    window.addEventListener('resize', function() {
        step = slides[1].offsetLeft - slides[0].offsetLeft;
        actualizarDotActivo();
    });
}

// ============================================================================
// WIDGET CAMPAÑAS ACTIVAS
// ============================================================================
function segmentoSemaforoHtml(conteo, clase) {
    var n = parseInt(conteo || 0, 10);
    if (!n) return '';
    return '<span class="campana-widget-semaforo-seg ' + clase + '" style="flex:' + n + '"></span>';
}

function escapeHtmlMovil(texto) {
    return String(texto == null ? '' : texto)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function truncarTexto(texto, max) {
    var t = String(texto == null ? '' : texto);
    if (t.length <= max) return t;
    return t.slice(0, Math.max(0, max - 1)) + '…';
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
            container.innerHTML = '<div class="campanas-widget-empty">No hay campañas activas.<br><a href="/m/gestion-lote">Crear o ver campañas</a></div>';
            igualarAlturaWidgetSlides();
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
            html += '<a class="campana-widget-item" href="/m/gestion-lote?id=' + encodeURIComponent(g.id) + '">' +
                '<span class="campana-widget-icon">📋</span>' +
                '<span class="campana-widget-info">' +
                '<span class="campana-widget-name">' + escapeHtmlMovil(truncarTexto(g.nombre || 'Campaña #' + g.id, 30)) + '</span>' +
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
        igualarAlturaWidgetSlides();
    } catch (e) {
        console.error('Error cargando campañas activas:', e);
        container.innerHTML = '<div class="campanas-widget-empty">No se pudieron cargar las campañas.</div>';
        igualarAlturaWidgetSlides();
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
            container.innerHTML = '<div class="campanas-widget-empty">No hay solicitudes.<br><a href="/m/solicitudes">Ver solicitudes</a></div>';
            igualarAlturaWidgetSlides();
            return;
        }

        var html = '';
        for (var i = 0; i < lista.length; i++) {
            var s = lista[i];
            var estado = s.estado || 'Sin estado';
            var color = coloresEstadoSolWidget[estado] || '#f3f4f6';
            html += '<a class="campana-widget-item" href="/m/solicitudes">' +
                '<span class="campana-widget-icon">📋</span>' +
                '<span class="campana-widget-info">' +
                '<span class="campana-widget-name">' + escapeHtmlMovil(truncarTexto(s.nombre || 'Sin nombre', 26)) + '</span>' +
                '<span class="sol-widget-meta">' +
                '<span class="sol-widget-badge" style="background:' + color + ';">' + escapeHtmlMovil(estado) + '</span>' +
                (s.cedula ? '<span class="sol-widget-cedula">· ' + escapeHtmlMovil(truncarTexto(s.cedula, 15)) + '</span>' : '') +
                '</span>' +
                '</span>' +
                '<span class="campana-widget-chevron">›</span>' +
                '</a>';
        }
        container.innerHTML = html;
        igualarAlturaWidgetSlides();
    } catch (e) {
        console.error('Error cargando últimas solicitudes:', e);
        container.innerHTML = '<div class="campanas-widget-empty">No se pudieron cargar las solicitudes.</div>';
        igualarAlturaWidgetSlides();
    }
}

// ============================================================================
// WIDGET ÚLTIMAS GESTIONES (historial de las últimas 5 gestiones)
// Líder: últimas gestiones de su equipo (con nombre del agente).
// Resto de usuarios: sus propias últimas gestiones.
// Estilo: timeline "últimas actividades" (ver docs/feature-historial-campana.md).
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
            linkVerTodas.href = (esLider && equipoId) ? '/m/equipo' : '/m/gestiones';
        }

        var lista;
        if (esLider && equipoId) {
            var res = await fetch('/api/equipos/' + equipoId + '/gestiones?limite=5');
            if (!res.ok) throw new Error('status ' + res.status);
            var result = await res.json();
            lista = Array.isArray(result) ? result : (result.data || []);
        } else {
            var res2 = await fetch('/api/excel/gestiones/todas?limite=5');
            if (!res2.ok) throw new Error('status ' + res2.status);
            var result2 = await res2.json();
            lista = Array.isArray(result2) ? result2 : (result2.data || []);
        }

        if (!lista.length) {
            container.innerHTML = '<div class="campanas-widget-empty">No hay gestiones registradas.<br><a href="/m/gestiones">Ver gestiones</a></div>';
            igualarAlturaWidgetSlides();
            return;
        }

        var html = '';
        for (var i = 0; i < lista.length; i++) {
            var g = lista[i];
            var isLast = i === lista.length - 1;
            var color = coloresTipoGestion[g.tipo_gestion] || '#f3f4f6';
            var fecha = formatearFechaWidget(g.fecha_gestion);
            var principal = esLider
                ? (g.agente_nombre || g.agente_username || 'Agente')
                : (g.nombre || 'Sin nombre');
            var linea = esLider
                ? '#' + g.solicitud_id + (g.cliente_nombre ? ' · ' + truncarTexto(g.cliente_nombre, 20) : '')
                : '#' + g.solicitud_id + (g.cedula ? ' · 🆔 ' + truncarTexto(g.cedula, 15) : '');
            var obs = g.observacion ? truncarTexto(g.observacion, 80) : '';

            html += '<div class="ges-widget-item">' +
                '<div class="ges-widget-rail">' +
                '<span class="ges-widget-dot" style="background:' + color + ';"></span>' +
                (isLast ? '' : '<span class="ges-widget-line"></span>') +
                '</div>' +
                '<div class="ges-widget-body">' +
                '<div class="ges-widget-top">' +
                '<span class="ges-widget-name">' + escapeHtmlMovil(truncarTexto(principal, 26)) + '</span>' +
                '</div>' +
                '<div class="ges-widget-meta">' + escapeHtmlMovil(linea) + '</div>' +
                '<div class="ges-widget-badges">' +
                '<span class="ges-widget-badge" style="background:' + color + ';">' + escapeHtmlMovil(g.tipo_gestion || '—') + '</span>' +
                '<span class="ges-widget-fecha">⏱️ ' + escapeHtmlMovil(fecha) + '</span>' +
                '</div>' +
                (obs ? '<div class="ges-widget-obs">' + escapeHtmlMovil(obs) + '</div>' : '') +
                '</div>' +
                '</div>';
        }
        container.innerHTML = html;
        igualarAlturaWidgetSlides();
    } catch (e) {
        console.error('Error cargando últimas gestiones:', e);
        container.innerHTML = '<div class="campanas-widget-empty">No se pudieron cargar las gestiones.</div>';
        igualarAlturaWidgetSlides();
    }
}
