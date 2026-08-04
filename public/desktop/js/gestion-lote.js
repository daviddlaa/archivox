console.log('Cargando gestion-lote.js...');

// Variables globales
var gestionId = null;
var datosGestion = null;
var solicitudes = [];
var todasLasSolicitudes = [];
var campañas = [];
var _esLider = false;
var _equipoActual = null;
var _agentesEquipo = [];
var filtroSemaforo = null;
var SEMAFORO_ORDEN = ['sin_clasificar', 'verde', 'amarillo', 'rojo'];
var SEMAFORO_LABELS = {
    sin_clasificar: 'Sin clasificar',
    verde: 'Verde',
    amarillo: 'Amarillo',
    rojo: 'Rojo'
};
var _recomendacionDesktopIndex = 0;
var _recomendacionDesktopTimer = null;
var _recomendacionDesktopContexto = null;

// Popover de campañas en el header
var CampanasPopover = {
    isOpen: false,

    toggle: function(event) {
        if (event) {
            event.preventDefault();
            event.stopPropagation();
        }
        if (this.isOpen) {
            this.close();
        } else {
            this.open();
        }
    },

    open: function() {
        var popover = document.getElementById('campañas-popover');
        var selector = document.getElementById('campañas-selector');
        var btn = document.getElementById('btn-campañas');
        if (!popover || !selector) return;

        CampanaMoreMenu.close();
        popover.hidden = false;
        selector.classList.add('open');
        if (btn) btn.setAttribute('aria-expanded', 'true');
        this.isOpen = true;

        var active = popover.querySelector('.campaña-card.active');
        if (active && typeof active.scrollIntoView === 'function') {
            active.scrollIntoView({ block: 'nearest' });
        }
    },

    close: function() {
        var popover = document.getElementById('campañas-popover');
        var selector = document.getElementById('campañas-selector');
        var btn = document.getElementById('btn-campañas');
        if (!popover || !selector) return;

        popover.hidden = true;
        selector.classList.remove('open');
        if (btn) btn.setAttribute('aria-expanded', 'false');
        this.isOpen = false;
    }
};

var CampanaMoreMenu = {
    isOpen: false,

    toggle: function(event) {
        if (event) {
            event.preventDefault();
            event.stopPropagation();
        }
        if (this.isOpen) this.close();
        else this.open();
    },

    open: function() {
        var menu = document.getElementById('campana-more-menu');
        var btn = document.getElementById('btn-campana-more');
        var wrap = document.getElementById('campana-more');
        if (!menu || !wrap || wrap.hidden) return;
        CampanasPopover.close();
        menu.hidden = false;
        if (btn) btn.setAttribute('aria-expanded', 'true');
        this.isOpen = true;
    },

    close: function() {
        var menu = document.getElementById('campana-more-menu');
        var btn = document.getElementById('btn-campana-more');
        if (!menu) return;
        menu.hidden = true;
        if (btn) btn.setAttribute('aria-expanded', 'false');
        this.isOpen = false;
    }
};

var CampanaRail = {
    storageKey: 'campanas_rail_open_desktop',

    isOpen: function() {
        try {
            var v = localStorage.getItem(this.storageKey);
            if (v === null) return true;
            return v !== '0';
        } catch (e) {
            return true;
        }
    },

    apply: function() {
        var workspace = document.getElementById('campana-workspace');
        var rail = document.getElementById('campana-rail');
        var btn = document.getElementById('btn-rail-toggle');
        if (!workspace || !rail) return;
        var open = this.isOpen();
        workspace.classList.toggle('rail-collapsed', !open);
        if (btn) {
            btn.setAttribute('aria-expanded', String(open));
            btn.classList.toggle('is-collapsed', !open);
            btn.textContent = open ? 'Estado' : 'Estado ▸';
            btn.title = open ? 'Ocultar panel de estado' : 'Mostrar panel de estado';
        }
    },

    show: function() {
        var workspace = document.getElementById('campana-workspace');
        var rail = document.getElementById('campana-rail');
        var btn = document.getElementById('btn-rail-toggle');
        var panel = document.getElementById('panel-progreso');
        if (workspace) workspace.classList.add('workspace-active');
        if (rail) rail.hidden = false;
        if (btn) btn.hidden = false;
        if (panel) panel.style.display = 'block';
        this.apply();
    },

    toggle: function() {
        var open = !this.isOpen();
        try { localStorage.setItem(this.storageKey, open ? '1' : '0'); } catch (e) {}
        this.apply();
    }
};

document.addEventListener('click', function(e) {
    if (CampanasPopover.isOpen) {
        var selector = document.getElementById('campañas-selector');
        if (selector && !selector.contains(e.target)) {
            CampanasPopover.close();
        }
    }
    if (CampanaMoreMenu.isOpen) {
        var more = document.getElementById('campana-more');
        if (more && !more.contains(e.target)) {
            CampanaMoreMenu.close();
        }
    }
});

// Navegación por teclado — j/k entre cards, 1-4 semáforo, / búsqueda
var _cardNavIndex = -1;

function _cardElements() {
    return Array.prototype.slice.call(document.querySelectorAll('#lista-solicitudes .sol-card'));
}

function _cardSelect(idx) {
    var cards = _cardElements();
    if (!cards.length) return;
    var prev = document.querySelector('#lista-solicitudes .sol-card.card-focused');
    if (prev) prev.classList.remove('card-focused');
    _cardNavIndex = Math.max(0, Math.min(idx, cards.length - 1));
    var el = cards[_cardNavIndex];
    el.classList.add('card-focused');
    el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && CampanaMoreMenu.isOpen) { CampanaMoreMenu.close(); return; }
    if (e.key === 'Escape' && CampanasPopover.isOpen) { CampanasPopover.close(); return; }
    if (e.key === 'Escape') {
        var focused = document.querySelector('#lista-solicitudes .sol-card.card-focused');
        if (focused) { focused.classList.remove('card-focused'); _cardNavIndex = -1; }
        return;
    }
    var tag = (e.target.tagName || '').toLowerCase();
    var inInput = tag === 'input' || tag === 'textarea' || tag === 'select' || e.target.isContentEditable;
    if (inInput) return;

    if (e.key === '/' || (e.key === 'k' && (e.ctrlKey || e.metaKey))) {
        e.preventDefault();
        var busq = document.getElementById('busqueda');
        if (busq) busq.focus();
        return;
    }
    if (e.key === 'j') { _cardSelect(_cardNavIndex + 1); return; }
    if (e.key === 'k') { _cardSelect(_cardNavIndex - 1); return; }
    if (e.key === 'Enter') {
        var cards = _cardElements();
        if (_cardNavIndex >= 0 && _cardNavIndex < cards.length) {
            var btn = cards[_cardNavIndex].querySelector('.sol-ultima-gestion');
            if (btn) btn.click();
        }
        return;
    }
    var keyMap = { '1': 'sin_clasificar', '2': 'amarillo', '3': 'verde', '4': 'rojo' };
    if (keyMap[e.key]) { setFiltroSemaforo(keyMap[e.key]); return; }
    if (e.key === '0') { setFiltroSemaforo(null); return; }
});

// Obtener ID de la gestión de la URL
function obtenerGestionId() {
    var urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('id');
}

// Cargar datos de la gestión al iniciar
async function init() {
    console.log('[init] Iniciando carga de gestion-lote...');
    
    await cargarListaCampanas();
    console.log('[init] Campañas cargadas, verificando ID en URL...');
    
    gestionId = obtenerGestionId();
    console.log('[init] gestionId desde URL:', gestionId);
    
    if (gestionId) {
        console.log('[init] Cargando datos de gestión:', gestionId);
        await cargarDatosGestion();
        marcarCampañaActiva(gestionId);
        console.log('[init] Carga completa');
    } else {
        console.log('[init] No hay ID en URL, mostrando solo lista de campañas');
    }
}

// Determinar si el usuario actual es líder
async function verificarRolUsuario() {
    try {
        var res = await fetch('/api/auth/sesion');
        var sesion = await res.json();
        if (sesion.autenticado && sesion.usuario) {
            _esLider = !!(sesion.usuario.es_lider || sesion.usuario.rol === 'superadmin' || sesion.usuario.rol === 'admin');
            _equipoActual = sesion.usuario.equipo_id || null;
            return _esLider;
        }
    } catch (e) {
        console.error('[verificarRolUsuario] Error:', e);
    }
    return false;
}

// Cargar agentes del equipo del líder
async function cargarAgentesEquipo(equipoId) {
    if (!equipoId) return [];
    try {
        var res = await fetch('/api/equipos/' + equipoId + '/dashboard');
        var data = await res.json();
        _agentesEquipo = data.agentes || [];
        return _agentesEquipo;
    } catch (e) {
        console.error('[cargarAgentesEquipo] Error:', e);
        _agentesEquipo = [];
        return [];
    }
}

// Cargar lista de todas las campañas en el popover del header
async function cargarListaCampanas() {
    try {
        console.log('[cargarListaCampanas] Iniciando fetch...');
        
        await verificarRolUsuario();
        if (_esLider && _equipoActual) {
            await cargarAgentesEquipo(_equipoActual);
        }
        
        var container = document.getElementById('lista-campañas');
        var countEl = document.getElementById('campañas-count');
        
        var controller = new AbortController();
        var timeoutId = setTimeout(function() { controller.abort(); console.log('[cargarListaCampanas] Timeout!'); }, 10000);
        
        var response = await fetch('/api/gestiones-maestro', { signal: controller.signal });
        clearTimeout(timeoutId);
        
        console.log('[cargarListaCampanas] Response status:', response.status);
        
        if (!response.ok) {
            throw new Error('Error al cargar (status: ' + response.status + ')');
        }
        
        campañas = await response.json();
        console.log('[cargarListaCampanas] Campañas recibidas:', campañas ? campañas.length : 0);

        if (countEl) {
            countEl.textContent = campañas && campañas.length ? String(campañas.length) : '';
        }
        
        if (!campañas || campañas.length === 0) {
            container.innerHTML = '<div class="empty">'+
                '<p>No hay campañas.</p>'+
                '<p>Ve a Solicitudes para crear una.</p>'+
                '</div>';
            return;
        }
        
        var html = '';
        
        for (var i = 0; i < campañas.length; i++) {
            var g = campañas[i];
            var completadas = parseInt(g.completadas || 0, 10);
            var pct = g.total_solicitudes > 0 ? Math.round((completadas / g.total_solicitudes) * 100) : 0;
            var isActive = gestionId && String(g.id) === String(gestionId) ? 'active' : '';
            
            html += '<div class="campaña-card ' + isActive + '" data-campaña-id="' + g.id + '" onclick="seleccionarCampaña(' + g.id + ')">';
            
            html += '<div class="campaña-nombre">';
            html += '<span class="campaña-id">#' + g.id + '</span>';
            html += '<span>' + escaparParaHTML(g.nombre || 'Sin nombre') + '</span>';
            html += '</div>';
            
            if (g.asignado_a) {
                var agenteNombre = g.asignado_username || 'Agente #' + g.asignado_a;
                html += '<div class="campaña-asignacion" style="margin-bottom:4px;">👤 ' + escaparParaHTML(agenteNombre) + '</div>';
            } else {
                html += '<div class="campaña-asignacion campaña-asignacion-pendiente" style="margin-bottom:4px;">⬜ Sin asignar</div>';
            }
            
            html += '<div class="campaña-stats">';
            html += '<span>📄 ' + (g.total_solicitudes || 0) + '</span>';
            html += '<span>✓ ' + completadas + ' completadas</span>';
            html += '<span>📊 ' + pct + '%</span>';
            html += '</div>';
            
            html += '<div class="campaña-progreso">';
            html += '<div class="campaña-progreso-barra" style="width: ' + pct + '%;"></div>';
            html += '</div>';
            
            var estadoClase = (g.estado === 'Completada' || pct === 100) ? 'completada' : 'activa';
            html += '<span class="campaña-estado ' + estadoClase + '">' + escaparParaHTML(g.estado || 'Activa') + '</span>';
            
            html += '<div class="campaña-acciones-grid">';
            
            if (_esLider && _agentesEquipo.length > 0) {
                html += '<button type="button" class="campaña-btn-accion campaña-btn-asignar" onclick="event.stopPropagation(); CampanasPopover.close(); abrirModalAsignarAgente(' + g.id + ', \'' + escaparParaAtributo(g.nombre || 'Gestión #' + g.id) + '\', ' + (g.asignado_a || 'null') + ')" title="Asignar a agente">👤 Asignar</button>';
            } else {
                html += '<button type="button" class="campaña-btn-accion campaña-btn-asignar" onclick="event.stopPropagation(); CampanasPopover.close(); abrirModalEditarCampana(' + g.id + ', \'' + escaparParaAtributo(g.nombre || 'Gestión #' + g.id) + '\', \'' + escaparParaAtributo(g.descripcion || '') + '\', \'' + (g.fecha_limite || '') + '\', \'' + (g.estado || 'Activa') + '\')" title="Editar campaña">✏️ Editar</button>';
            }
            
            html += '<button type="button" class="campaña-btn-accion campaña-btn-eliminar" onclick="event.stopPropagation(); CampanasPopover.close(); confirmarEliminarCampaña(' + g.id + ', \'' + escaparParaAtributo(g.nombre || 'Gestión #' + g.id) + '\', ' + (g.total_solicitudes || 0) + ', ' + (g.gestionadas || 0) + ')" title="Eliminar campaña">🗑️ Eliminar</button>';
            
            html += '</div>';
            html += '</div>';
        }
        
        container.innerHTML = html;
        
    } catch (error) {
        console.error('Error cargando lista:', error);
        var listEl = document.getElementById('lista-campañas');
        if (listEl) {
            listEl.innerHTML = '<div class="error">Error al cargar las campañas</div>';
        }
    }
}

// Seleccionar una campaña
function seleccionarCampaña(id) {
    gestionId = id;
    marcarCampañaActiva(id);
    CampanasPopover.close();
    window.location.href = '/gestion-lote?id=' + id;
}

// Marcar campaña como activa en el popover
function marcarCampañaActiva(id) {
    var cards = document.querySelectorAll('.campaña-card');
    for (var i = 0; i < cards.length; i++) {
        cards[i].classList.remove('active');
    }
    
    var card = document.querySelector('.campaña-card[data-campaña-id="' + id + '"]');
    if (card) {
        card.classList.add('active');
    }
}

// Cargar datos de la gestión (unifica cargarGestion + cargarSolicitudes)
async function cargarDatosGestion() {
    try {
        console.log('[cargarDatosGestion] Cargando gestión ID:', gestionId);
        var container = document.getElementById('lista-solicitudes');
        if (container) container.innerHTML = '<div class="loading">Cargando solicitudes...</div>';
        
        // Timeout de 10 segundos para el fetch
        var controller = new AbortController();
        var timeoutId = setTimeout(function() { controller.abort(); console.log('[cargarDatosGestion] Timeout!'); }, 10000);
        
        var response = await fetch('/api/gestiones-maestro/' + gestionId, { signal: controller.signal });
        clearTimeout(timeoutId);
        
        console.log('[cargarDatosGestion] Response status:', response.status);
        
        if (!response.ok) {
            var errorData = await response.json().catch(function() { return {}; });
            throw new Error(errorData.error || 'Error al cargar la gestión (status: ' + response.status + ')');
        }
        
        datosGestion = await response.json();
        filtroSemaforo = null;
        
        actualizarTituloCampana(datosGestion.nombre || 'Gestión #' + gestionId);
        
        // Mostrar workspace: lista + rail + filtros
        var filtrosRow = document.getElementById('filtros-row');
        if (filtrosRow) filtrosRow.style.display = 'flex';

        var kpiStrip = document.getElementById('header-kpi-strip');
        if (kpiStrip) kpiStrip.hidden = false;

        var campanaMore = document.getElementById('campana-more');
        if (campanaMore) campanaMore.hidden = false;

        CampanaRail.show();
        initRecomendacionesCollapsed('desktop');
        
        solicitudes = datosGestion.solicitudes || [];
        console.log('[cargarDatosGestion] Solicitudes recibidas:', solicitudes.length);
        if (solicitudes.length > 0) {
            // JSON.stringify para ver valores exactos sin expandir en consola
            var primeras3 = solicitudes.slice(0, 3).map(function(s) { 
                return {id: s.id_solicitud, obs: s.gestion_obs, tipo: s.tipo_gestion}; 
            });
            console.log('[cargarDatosGestion] Primeras 3 gestion_obs:', JSON.stringify(primeras3));
        }
        todasLasSolicitudes = [...solicitudes];
        
        actualizarProgreso();
        renderizarSolicitudes(solicitudes);
        
    } catch (error) {
        console.error('Error cargando datos de gestión:', error);
        var errContainer = document.getElementById('lista-solicitudes');
        if (errContainer) errContainer.innerHTML = '<div class="error">Error al cargar: ' + error.message + '</div>';
        actualizarTituloCampana('Error al cargar gestión', true);
    }
}

// Título + estado textual según KPIs
function actualizarTituloCampana(nombre, esError) {
    var tituloEl = document.getElementById('gestion-nombre');
    var estadoEl = document.getElementById('gestion-estado');
    if (!tituloEl) return;

    if (nombre) {
        tituloEl.textContent = nombre;
    }

    if (esError) {
        tituloEl.classList.remove('is-active');
        if (estadoEl) {
            estadoEl.hidden = true;
            estadoEl.textContent = '';
            estadoEl.removeAttribute('data-estado');
        }
        return;
    }

    tituloEl.classList.add('is-active');
    if (estadoEl) {
        actualizarEstadoCampanaTexto();
    }
}

function actualizarEstadoCampanaTexto() {
    var estadoEl = document.getElementById('gestion-estado');
    if (!estadoEl) return;
    if (!datosGestion) {
        estadoEl.hidden = true;
        return;
    }
    estadoEl.hidden = false;

    var total = datosGestion.total_solicitudes || 0;
    var completadas = (solicitudes || []).filter(function(sol) { return sol.tipo_gestion === 'Completada'; }).length;
    var pendientes = Math.max(total - completadas, 0);
    var porcentaje = total > 0 ? Math.round((completadas / total) * 100) : 0;
    var texto = '';
    var clave = 'vacia';

    if (total === 0) {
        texto = 'Sin solicitudes';
        clave = 'vacia';
    } else if (completadas >= total) {
        texto = 'Completada · ' + completadas + '/' + total + ' solicitudes';
        clave = 'completada';
    } else if (completadas === 0) {
        texto = 'En curso · 0/' + total + ' completadas';
        clave = 'sin-iniciar';
    } else if (porcentaje >= 75) {
        texto = 'Casi lista · ' + porcentaje + '% · ' + pendientes + ' pendiente' + (pendientes === 1 ? '' : 's');
        clave = 'casi-lista';
    } else {
        texto = 'En curso · ' + porcentaje + '% · ' + pendientes + ' pendiente' + (pendientes === 1 ? '' : 's');
        clave = 'en-curso';
    }

    estadoEl.textContent = texto;
    estadoEl.setAttribute('data-estado', clave);
}

function normalizarSemaforo(valor) {
    var v = String(valor || 'sin_clasificar');
    if (SEMAFORO_ORDEN.indexOf(v) === -1) return 'sin_clasificar';
    return v;
}

function contarSemaforoLocal(lista) {
    var conteo = { sin_clasificar: 0, rojo: 0, amarillo: 0, verde: 0 };
    var arr = lista || [];
    for (var i = 0; i < arr.length; i++) {
        var key = normalizarSemaforo(arr[i].semaforo);
        conteo[key] = (conteo[key] || 0) + 1;
    }
    return conteo;
}

function actualizarBarraSemaforo(conteoExterno) {
    var lista = todasLasSolicitudes.length ? todasLasSolicitudes : solicitudes;
    var conteo = conteoExterno || contarSemaforoLocal(lista);
    var total = 0;
    var k;
    for (k = 0; k < SEMAFORO_ORDEN.length; k++) {
        total += conteo[SEMAFORO_ORDEN[k]] || 0;
    }
    if (!total && datosGestion) {
        total = datosGestion.total_solicitudes || 0;
    }

    var totalEl = document.getElementById('total-solicitudes');
    if (totalEl) totalEl.textContent = total;

    for (k = 0; k < SEMAFORO_ORDEN.length; k++) {
        var key = SEMAFORO_ORDEN[k];
        var n = conteo[key] || 0;
        var countEl = document.getElementById('count-' + key);
        if (countEl) countEl.textContent = n;

        var btn = document.querySelector('.semaforo-seg[data-semaforo="' + key + '"]');
        if (!btn) continue;
        if (n === 0) btn.classList.add('is-empty');
        else btn.classList.remove('is-empty');
        if (filtroSemaforo === key) btn.classList.add('active');
        else btn.classList.remove('active');
    }

    var clearBtn = document.getElementById('btn-semaforo-todos');
    if (clearBtn) {
        clearBtn.style.display = filtroSemaforo ? 'inline-flex' : 'none';
    }
    actualizarChipFiltroSemaforo();

    actualizarSiguienteAccion(conteo, total);
    actualizarRecomendacionesDesktop(conteo, total);
}

function actualizarChipFiltroSemaforo() {
    var chip = document.getElementById('btn-filtro-semaforo-chip');
    if (!chip) return;
    if (!filtroSemaforo) {
        chip.style.display = 'none';
        chip.textContent = '';
        return;
    }
    var labels = {
        sin_clasificar: 'Sin clasificar',
        amarillo: 'Seguimiento',
        verde: 'Encaminadas',
        rojo: 'En espera'
    };
    chip.textContent = 'Filtro: ' + (labels[filtroSemaforo] || filtroSemaforo) + ' ✕';
    chip.style.display = 'inline-flex';
}

var BUENAS_PRACTICAS_DESKTOP = [
    { icon: '📞', title: 'Prioriza la llamada cuando sea posible.', text: 'La conversación ayuda a resolver dudas y detectar el interés real del cliente.' },
    { icon: '📋', title: 'Registra la gestión durante la conversación.', text: 'Mantener el historial actualizado evita olvidos y facilita el trabajo del equipo.' },
    { icon: '⏰', title: 'No dejes seguimientos pendientes para después.', text: 'Registrar la gestión en el momento mejora la calidad de la información.' },
    { icon: '💬', title: 'Personaliza cada conversación de WhatsApp.', text: 'Usa el nombre del cliente y adapta el mensaje en lugar de repetir textos idénticos.' },
    { icon: '👤', title: 'Cuida la identidad de tu cuenta.', text: 'Un nombre comercial y una fotografía profesional transmiten mayor confianza.' },
    { icon: '📅', title: 'Respeta los horarios de contacto.', text: 'Evita enviar mensajes muy temprano o muy tarde para cuidar la experiencia del cliente.' },
    { icon: '🚫', title: 'Alterna llamadas y mensajes.', text: 'Mantener conversaciones naturales ayuda a evitar restricciones en WhatsApp.' },
    { icon: '↔️', title: 'Espera una respuesta antes de insistir.', text: 'Una buena tasa de respuesta es más valiosa que enviar muchos mensajes seguidos.' }
];

function actualizarRecomendacionesDesktop(conteo, total) {
    var panel = document.getElementById('recomendaciones-panel');
    if (!panel) return;
    var activas = (solicitudes || []).filter(function(sol) { return sol.tipo_gestion !== 'Completada'; });
    var antiguas = activas.filter(function(sol) {
        if (!sol.fecha_gestion) return false;
        var fecha = new Date(sol.fecha_gestion).getTime();
        return !isNaN(fecha) && Date.now() - fecha > 48 * 60 * 60 * 1000;
    }).length;
    var contexto;
    if (activas.length === 0 && total > 0) contexto = { icon: '✓', title: 'La campaña terminó su ciclo.', text: 'Revisa el historial para conservar las buenas prácticas del equipo.' };
    else if (conteo.amarillo >= 3 || (total > 0 && conteo.amarillo / total >= .25)) contexto = { icon: '📌', title: 'Hay varios seguimientos por retomar.', text: 'Trabajar las solicitudes amarillas puede ayudarte a mantener el avance.' };
    else if (conteo.sin_clasificar >= 3 || (total > 0 && conteo.sin_clasificar / total >= .25)) contexto = { icon: '🧭', title: 'Clasifica antes de continuar.', text: 'Ordenar las solicitudes pendientes permitirá priorizar mejor el trabajo.' };
    else if (antiguas >= 3) contexto = { icon: '⏰', title: 'Hay seguimientos sin actividad reciente.', text: 'Retomarlos puede mejorar el avance de la campaña.' };
    else if (conteo.rojo >= 3) contexto = { icon: '⏳', title: 'Hay solicitudes en espera.', text: 'Respeta el tiempo antes de volver a contactar y trabaja primero las amarillas.' };
    else contexto = { icon: '💡', title: 'Registra cada gestión mientras conversas.', text: 'Un historial actualizado evita olvidos y facilita el seguimiento.' };
    _recomendacionDesktopContexto = contexto;
    var icon = document.getElementById('recomendacion-icon');
    var title = document.getElementById('recomendacion-titulo');
    var text = document.getElementById('recomendacion-texto');
    if (icon) icon.textContent = contexto.icon;
    if (title) title.textContent = contexto.title;
    if (text) text.textContent = contexto.text;
    mostrarBuenaPracticaDesktop();
    if (!_recomendacionDesktopTimer) {
        _recomendacionDesktopTimer = setInterval(mostrarBuenaPracticaDesktop, 9000);
    }
}

function mostrarBuenaPracticaDesktop() {
    var container = document.getElementById('buenas-practicas');
    if (!container) return;
    var practica = BUENAS_PRACTICAS_DESKTOP[_recomendacionDesktopIndex % BUENAS_PRACTICAS_DESKTOP.length];
    _recomendacionDesktopIndex++;
    container.innerHTML = '<span class="buena-practica-item"><b>' + practica.icon + '</b><span><strong>' + practica.title + '</strong><small>' + practica.text + '</small></span></span>';
}

function recoStorageKey(modo) {
    return modo === 'mobile' ? 'campanas_reco_open_mobile' : 'campanas_reco_open_desktop';
}

function initRecomendacionesCollapsed(modo) {
    var contenido = document.getElementById(modo === 'mobile' ? 'recomendaciones-mobile-contenido' : 'recomendaciones-contenido');
    var boton = document.querySelector(modo === 'mobile' ? '.recomendaciones-mobile-header button' : '.recomendaciones-header button');
    if (!contenido || !boton) return;
    var open = false;
    try { open = localStorage.getItem(recoStorageKey(modo)) === '1'; } catch (e) {}
    contenido.hidden = !open;
    boton.textContent = open ? 'Ocultar' : 'Mostrar';
    boton.setAttribute('aria-expanded', String(open));
}

function toggleRecomendaciones(modo) {
    var contenido = document.getElementById(modo === 'mobile' ? 'recomendaciones-mobile-contenido' : 'recomendaciones-contenido');
    var boton = document.querySelector(modo === 'mobile' ? '.recomendaciones-mobile-header button' : '.recomendaciones-header button');
    if (!contenido || !boton) return;
    var oculto = contenido.hidden;
    contenido.hidden = !oculto;
    boton.textContent = oculto ? 'Ocultar' : 'Mostrar';
    boton.setAttribute('aria-expanded', String(oculto));
    try { localStorage.setItem(recoStorageKey(modo), oculto ? '1' : '0'); } catch (e) {}
}

function formatearTiempoRelativo(fecha) {
    if (!fecha) return null;
    var timestamp = new Date(fecha).getTime();
    if (isNaN(timestamp)) return null;
    var minutos = Math.max(0, Math.floor((Date.now() - timestamp) / 60000));
    if (minutos < 1) return 'Hace un momento';
    if (minutos < 60) return 'Hace ' + minutos + ' minuto' + (minutos === 1 ? '' : 's');
    var horas = Math.floor(minutos / 60);
    if (horas < 24) return 'Hace ' + horas + ' hora' + (horas === 1 ? '' : 's');
    var dias = Math.floor(horas / 24);
    return 'Hace ' + dias + ' día' + (dias === 1 ? '' : 's');
}

function actualizarResumenCampana(total, gestionadas, porcentaje) {
    var porcentajeEl = document.getElementById('avance-porcentaje');
    var resumenEl = document.getElementById('avance-resumen');
    var restanteEl = document.getElementById('avance-restante');
    var fillEl = document.getElementById('avance-fill');
    var trackEl = document.querySelector('.avance-track');
    var completadas = (todasLasSolicitudes || []).filter(function(sol) { return sol.tipo_gestion === 'Completada'; }).length;
    var pendiente = Math.max(total - completadas, 0);

    if (porcentajeEl) porcentajeEl.textContent = porcentaje + '%';
    if (resumenEl) resumenEl.textContent = completadas + '/' + total;
    if (restanteEl) {
        restanteEl.textContent = pendiente > 0
            ? pendiente + ' pendiente' + (pendiente === 1 ? '' : 's')
            : (total > 0 ? 'Completada' : 'Sin solicitudes');
    }
    if (fillEl) fillEl.style.width = porcentaje + '%';
    if (trackEl) trackEl.setAttribute('aria-valuenow', porcentaje);

    var actividad = null;
    (todasLasSolicitudes || []).forEach(function(sol) {
        if (sol.fecha_gestion) {
            var fecha = new Date(sol.fecha_gestion).getTime();
            if (!isNaN(fecha) && (!actividad || fecha > actividad.timestamp)) {
                actividad = { timestamp: fecha, texto: formatearTiempoRelativo(sol.fecha_gestion), tipo: sol.tipo_gestion || 'Gestión' };
            }
        }
    });
    var ultimaEl = document.getElementById('ultima-actividad');
    var detalleEl = document.getElementById('actividad-detalle');
    var actividadEl = document.getElementById('actividad-campana');
    var pausaBadge = document.getElementById('header-pausa-badge');
    var enPausa = !!actividad && (Date.now() - actividad.timestamp) > 8 * 60 * 60 * 1000;
    if (ultimaEl) ultimaEl.textContent = actividad ? actividad.texto : 'Sin actividad registrada';
    if (detalleEl) detalleEl.textContent = actividad ? actividad.tipo + ' registrada en la campaña' : 'Cuando registres una gestión, aparecerá aquí.';
    if (actividadEl) actividadEl.classList.toggle('actividad-antigua', enPausa);
    if (pausaBadge) pausaBadge.hidden = !enPausa;
}

function actualizarSiguienteAccion(conteo, total) {
    var textoEl = document.getElementById('siguiente-accion-texto');
    var btn = document.getElementById('siguiente-accion-btn');
    if (!textoEl || !btn) return;
    var prioridad = null;
    var activas = (solicitudes || []).filter(function(sol) { return sol.tipo_gestion !== 'Completada'; });
    if (conteo.amarillo > 0) {
        prioridad = { semaforo: 'amarillo', texto: 'Seguimiento (' + conteo.amarillo + ')' };
    } else if (conteo.sin_clasificar > 0) {
        prioridad = { semaforo: 'sin_clasificar', texto: 'Clasificar (' + conteo.sin_clasificar + ')' };
    } else if (conteo.rojo > 0) {
        prioridad = { semaforo: 'rojo', texto: 'En espera (' + conteo.rojo + ') · no contactar' };
    } else if (total > 0 && activas.some(function(sol) {
        return !sol.gestion_id || !sol.tipo_gestion || sol.tipo_gestion === 'Pendiente';
    })) {
        prioridad = { semaforo: null, texto: 'Registrar siguiente gestión' };
    }
    textoEl.textContent = prioridad ? prioridad.texto : (total > 0 && activas.length === 0 ? 'Campaña completada' : (total > 0 ? 'Al día' : 'Sin solicitudes'));
    btn.style.display = prioridad && prioridad.semaforo ? 'inline-flex' : 'none';
    btn.textContent = 'Ver';
    btn.dataset.semaforo = prioridad && prioridad.semaforo ? prioridad.semaforo : '';
}

function ejecutarSiguienteAccion() {
    var btn = document.getElementById('siguiente-accion-btn');
    var valor = btn && btn.dataset.semaforo;
    if (valor) {
        setFiltroSemaforo(valor);
        var lista = document.getElementById('lista-solicitudes');
        if (lista) lista.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

function mostrarConfirmacionGestion(mensaje) {
    var anterior = document.querySelector('.campana-toast');
    if (anterior) anterior.remove();
    var toast = document.createElement('div');
    toast.className = 'campana-toast';
    toast.textContent = '✓ ' + mensaje;
    document.body.appendChild(toast);
    requestAnimationFrame(function() { toast.classList.add('visible'); });
    setTimeout(function() {
        toast.classList.remove('visible');
        setTimeout(function() { if (toast.parentNode) toast.remove(); }, 180);
    }, 2200);
}

function setFiltroSemaforo(valor) {
    if (valor && filtroSemaforo === valor) {
        filtroSemaforo = null;
    } else {
        filtroSemaforo = valor || null;
    }
    actualizarBarraSemaforo();
    renderizarSolicitudes(todasLasSolicitudes);
}

function animarSemaforoHaciaBarra(originEl, valorSemaforo) {
    try {
        var target = document.querySelector('.semaforo-seg[data-semaforo="' + valorSemaforo + '"]');
        if (!originEl || !target) {
            if (target) {
                target.classList.remove('bump');
                void target.offsetWidth;
                target.classList.add('bump');
                var c = target.querySelector('.semaforo-seg-count');
                if (c) {
                    c.classList.remove('bump-num');
                    void c.offsetWidth;
                    c.classList.add('bump-num');
                }
            }
            return;
        }

        var from = originEl.getBoundingClientRect();
        var to = target.getBoundingClientRect();
        var fly = document.createElement('div');
        fly.className = 'semaforo-fly ' + valorSemaforo;
        var startX = from.left + from.width / 2 - 6;
        var startY = from.top + from.height / 2 - 6;
        var endX = to.left + to.width / 2 - 6;
        var endY = to.top + to.height / 2 - 6;
        fly.style.left = '0';
        fly.style.top = '0';
        fly.style.transform = 'translate(' + startX + 'px,' + startY + 'px) scale(1)';
        document.body.appendChild(fly);

        requestAnimationFrame(function() {
            fly.style.transform = 'translate(' + endX + 'px,' + endY + 'px) scale(0.45)';
            fly.style.opacity = '0.15';
        });

        setTimeout(function() {
            if (fly.parentNode) fly.parentNode.removeChild(fly);
            target.classList.remove('bump');
            void target.offsetWidth;
            target.classList.add('bump');
            var countEl = target.querySelector('.semaforo-seg-count');
            if (countEl) {
                countEl.classList.remove('bump-num');
                void countEl.offsetWidth;
                countEl.classList.add('bump-num');
            }
        }, 560);
    } catch (e) {
        console.warn('[animarSemaforoHaciaBarra]', e);
    }
}

async function cambiarSemaforoSolicitud(idSolicitud, semaforo, eventRef) {
    if (!gestionId) return;
    var valor = normalizarSemaforo(semaforo);
    var originBtn = (eventRef && eventRef.currentTarget) || (typeof event !== 'undefined' ? event && event.target : null);

    var prev = null;
    for (var p = 0; p < todasLasSolicitudes.length; p++) {
        if (String(todasLasSolicitudes[p].id_solicitud) === String(idSolicitud)) {
            prev = normalizarSemaforo(todasLasSolicitudes[p].semaforo);
            break;
        }
    }
    if (prev === valor) return;

    try {
        var response = await fetch(
            '/api/gestiones-maestro/' + gestionId + '/solicitudes/' + encodeURIComponent(idSolicitud) + '/semaforo',
            {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ semaforo: valor })
            }
        );
        var data = await response.json().catch(function() { return {}; });
        if (!response.ok) {
            alert(data.error || 'No se pudo actualizar el semáforo');
            return;
        }

        for (var i = 0; i < todasLasSolicitudes.length; i++) {
            if (String(todasLasSolicitudes[i].id_solicitud) === String(idSolicitud)) {
                todasLasSolicitudes[i].semaforo = valor;
            }
        }
        for (var j = 0; j < solicitudes.length; j++) {
            if (String(solicitudes[j].id_solicitud) === String(idSolicitud)) {
                solicitudes[j].semaforo = valor;
            }
        }

        if (originBtn) {
            animarSemaforoHaciaBarra(originBtn, valor);
            var card = originBtn.closest ? originBtn.closest('.sol-card') : null;
            if (card) {
                card.classList.remove('sol-semaforo-flash');
                void card.offsetWidth;
                card.classList.add('sol-semaforo-flash');
            }
        } else {
            animarSemaforoHaciaBarra(null, valor);
        }

        if (data.semaforo_conteos) {
            actualizarBarraSemaforo(data.semaforo_conteos);
        } else {
            actualizarBarraSemaforo();
        }
        renderizarSolicitudes(todasLasSolicitudes);
    } catch (e) {
        console.error('[cambiarSemaforoSolicitud]', e);
        alert('Error al actualizar el semáforo');
    }
}

// Actualizar progreso
function actualizarProgreso() {
    if (!datosGestion) return;
    
    var total = datosGestion.total_solicitudes || 0;
    var gestionadas = 0;
    var completadas = 0;
    
    // Contar gestionadas (tipo_gestion — sin cambios)
    solicitudes.forEach(function(sol) {
        if (sol.gestion_id && sol.tipo_gestion && sol.tipo_gestion !== 'Pendiente') {
            gestionadas++;
        }
        if (sol.tipo_gestion === 'Completada') completadas++;
    });
    
    var pendientes = Math.max(total - completadas, 0);
    var porcentaje = total > 0 ? Math.round((completadas / total) * 100) : 0;
    
    var elTotal = document.getElementById('total-solicitudes');
    var elGest = document.getElementById('gestionadas');
    var elPend = document.getElementById('pendientes');
    var elPct = document.getElementById('progreso-porcentaje');
    var elBar = document.getElementById('barra-progreso');
    if (elTotal) elTotal.textContent = total;
    if (elGest) elGest.textContent = gestionadas;
    if (elPend) elPend.textContent = pendientes;
    if (elPct) elPct.textContent = porcentaje + '%';
    if (elBar) elBar.style.width = porcentaje + '%';

    actualizarResumenCampana(total, gestionadas, porcentaje);
    actualizarBarraSemaforo();
    actualizarEstadoCampanaTexto();
}

// Renderizar lista de solicitudes
function renderizarSolicitudes(lista) {
    var container = document.getElementById('lista-solicitudes');
    // Guardar posición de scroll antes de re-render
    var scrollY = container ? container.scrollTop : 0;
    
    if (!lista || lista.length === 0) {
        container.innerHTML = '<div class="empty">No hay solicitudes en esta gestión</div>';
        return;
    }
    
    var busquedaEl = document.getElementById('busqueda');
    var filtroEstadoEl = document.getElementById('filtro-estado');
    var busqueda = busquedaEl ? busquedaEl.value.toLowerCase() : '';
    var filtroEstado = filtroEstadoEl ? filtroEstadoEl.value : '';
    
    // Filtrar
    var filtradas = lista.filter(function(sol) {
        // Filtro por búsqueda
        if (busqueda) {
            var matchId = sol.id_solicitud && String(sol.id_solicitud).includes(busqueda);
            var matchCedula = sol.cedula && sol.cedula.toString().toLowerCase().includes(busqueda);
            var matchNombre = sol.nombre && sol.nombre.toLowerCase().includes(busqueda);
            var matchCelular = sol.celular && sol.celular.toString().includes(busqueda);
            if (!matchId && !matchCedula && !matchNombre && !matchCelular) return false;
        }
        
        // Filtro por tipo de seguimiento (sin cambios)
        if (filtroEstado) {
            var estadoActual = sol.tipo_gestion || 'Pendiente';
            if (estadoActual !== filtroEstado) return false;
        }

        // Filtro por semáforo operativo
        if (filtroSemaforo) {
            if (sol.tipo_gestion === 'Completada') return false;
            if (normalizarSemaforo(sol.semaforo) !== filtroSemaforo) return false;
        }
        
        return true;
    });
    
    var completadas = filtradas.filter(function(sol) { return sol.tipo_gestion === 'Completada'; });
    var activas = filtradas.filter(function(sol) { return sol.tipo_gestion !== 'Completada'; });

    if (filtradas.length === 0) {
        container.innerHTML = '<div class="empty">No hay solicitudes que coincidan con los filtros</div>';
        return;
    }
    
    // Ordenar: destacadas primero (🔥 al inicio), luego por prioridad de semáforo
    var PRIORIDAD_SEMAFORO = { amarillo: 0, sin_clasificar: 1, verde: 2, rojo: 3 };
    activas.sort(function(a, b) {
        if (a.destacado == 1 && b.destacado != 1) return -1;
        if (a.destacado != 1 && b.destacado == 1) return 1;
        var pa = PRIORIDAD_SEMAFORO[normalizarSemaforo(a.semaforo)] || 4;
        var pb = PRIORIDAD_SEMAFORO[normalizarSemaforo(b.semaforo)] || 4;
        return pa - pb;
    });
    completadas.sort(function(a, b) {
        return new Date(b.fecha_gestion || 0).getTime() - new Date(a.fecha_gestion || 0).getTime();
    });
    
    var html = activas.length ? '<section class="solicitudes-activas"><div class="solicitudes-seccion-heading"><div><span class="solicitudes-seccion-kicker">Trabajo activo</span><strong>Solicitudes por gestionar</strong></div><span class="solicitudes-seccion-count">' + activas.length + '</span></div>' : '';
    
    for (var i = 0; i < activas.length; i++) {
        var sol = activas[i];
        var estado = sol.tipo_gestion || 'Pendiente';
        var observacion = sol.gestion_obs || '';
        var semaforo = normalizarSemaforo(sol.semaforo);
        
        var coloresEstado = {
            'Pendiente': '#fef3c7',
            'Llamada': '#d1fae5',
            'WhatsApp': '#dcfce7',
            'Seguimiento': '#dbeafe',
            'Cobranza': '#fee2e2',
            'Cita': '#e0e7ff',
            'Completada': '#bbf7d0'
        };
        
        var colorFondo = coloresEstado[estado] || '#f3f4f6';
        var gestionada = estado !== 'Pendiente';
        
        var destacada = sol.destacado == 1;
        html += '<div class="sol-card ' + (gestionada ? 'gestionada' : 'pendiente') + ' sol-semaforo-' + semaforo + (destacada ? ' destacada' : '') + '" data-id="' + sol.id_solicitud + '">';
        
        // Header — nombre y estado de gestión; el semáforo ocupa una fila propia
        html += '<div class="sol-header">';
        html += '<div class="sol-header-left">';
        if (destacada) {
            html += '<span class="sol-destacado-badge sol-destacado-badge-on" onclick="event.stopPropagation(); toggleDestacado(\'' + sol.id_solicitud + '\', 0, event)" title="Quitar destacado">🔥 Destacada</span>';
        } else {
            html += '<span class="sol-destacado-badge sol-destacado-badge-off" onclick="event.stopPropagation(); toggleDestacado(\'' + sol.id_solicitud + '\', 1, event)" title="Destacar tarjeta">🔥 Destacar</span>';
        }
        html += '<span class="sol-estado" style="background:' + colorFondo + ';">' + estado + '</span>';
        html += '</div>';
        // Selector segmentado: el estado operativo debe ser visible y accionable
        html += '<div class="sol-semaforo-switch" role="group" aria-label="Estado de espera">';
        for (var s = 0; s < SEMAFORO_ORDEN.length; s++) {
            var keyS = SEMAFORO_ORDEN[s];
            var activeCls = semaforo === keyS ? ' active' : '';
            html += '<button type="button" class="sol-semaforo-switch-segment ' + keyS + activeCls + '" data-val="' + keyS + '" onclick="event.stopPropagation(); cambiarSemaforoSolicitud(\'' + sol.id_solicitud + '\', \'' + keyS + '\', event)" title="' + SEMAFORO_LABELS[keyS] + '" aria-label="' + SEMAFORO_LABELS[keyS] + '"><span class="sol-semaforo-switch-dot"></span><span class="sol-semaforo-switch-text">' + SEMAFORO_LABELS[keyS] + '</span></button>';
        }
        html += '</div>';
        html += '</div>';
        
        // Info
        html += '<div class="sol-info">';
        html += '<div class="sol-nombre-row"><div class="sol-nombre sol-nombre-copy" onclick="copiarNombreCedula(\'' + escaparParaAtributo(sol.nombre || '') + '\', \'' + escaparParaAtributo(sol.cedula || '') + '\')" title="Copiar nombre completo y cédula">' + (sol.nombre || 'Sin nombre') + '</div><span class="sol-segmento">' + (sol.segmento || 'Sin segmento') + '</span></div>';
        html += '<div class="sol-datos">';
        html += '<span class="sol-dato-copy" onclick="copiarTexto(\'' + escaparParaAtributo(sol.cedula || '') + '\', \'cédula\')" title="Copiar cédula">🆔 ' + (sol.cedula || '—') + '</span>';
        html += '<span class="sol-dato-copy" onclick="copiarTexto(\'' + escaparParaAtributo(sol.celular || '') + '\', \'teléfono\')" title="Copiar teléfono">📱 ' + (sol.celular || '—') + '</span>';
        html += '<span class="sol-chat-icon" onclick="abrirWhatsAppDesktop(\'' + escaparParaAtributo(sol.celular || '') + '\', \'\')" title="Abrir chat WhatsApp">💬</span>';
        html += '</div>';
        html += '</div>';
        
        // Última gestión: el bloque completo abre el mismo detalle que antes abría "Ver".
        if (gestionada) {
            html += '<button type="button" class="sol-ultima-gestion" onclick="verGestion(\'' + sol.id_solicitud + '\')" title="Abrir última gestión">';
            html += '<span class="sol-ultima-gestion-top"><strong>Última gestión</strong><span>' + (formatearTiempoRelativo(sol.fecha_gestion) || 'Fecha no disponible') + '</span></span>';
            html += '<span class="sol-ultima-gestion-tipo">' + (estado || 'Gestión') + '</span>';
            html += '<span class="sol-ultima-gestion-obs">' + (observacion || 'Sin observación registrada') + '</span>';
            html += '</button>';
        } else {
            html += '<div class="sol-ultima-gestion vacia"><strong>Sin gestión registrada</strong><span>Esta solicitud aún no tiene una gestión.</span></div>';
        }
        
        // Acciones (desktop: sin botón Llamar)
        html += '<div class="sol-acciones">';
        
        html += '<button class="btn-accion btn-seguimiento" onclick="abrirGestion(\'' + sol.id_solicitud + '\', \'Seguimiento\')">📋 Seguimiento</button>';
        html += "<button class=\"btn-accion btn-whatsapp-img\" onclick=\"abrirGestionWhatsApp('" + sol.id_solicitud + "', '" + escaparParaAtributo(sol.celular || '') + "')\">💬 Directo</button>";
        
        html += '<button class="btn-accion tertiary" onclick="verHistorial(\'' + sol.id_solicitud + '\')">📋 Historial</button>';
        
        html += '<button class="btn-accion btn-quitar-solicitud" onclick="confirmarQuitarSolicitud(\'' + sol.id_solicitud + '\', \'' + escaparParaAtributo(sol.nombre || '') + '\')">❌ Quitar</button>';
        
        html += '</div>';
        
        html += '</div>';
    }
    
    if (activas.length) html += '</section>';
    if (completadas.length) {
        var completadasAbiertas = activas.length === 0;
        html += '<section class="solicitudes-completadas"><button type="button" class="completadas-heading' + (completadasAbiertas ? ' open' : '') + '" onclick="toggleCompletadasDesktop(this)" aria-expanded="' + completadasAbiertas + '"><span><strong>✓ Solicitudes completadas</strong><small>El ciclo de estas solicitudes terminó</small></span><span class="completadas-heading-right"><b>' + completadas.length + '</b><span class="completadas-chevron">⌄</span></span></button><div class="completadas-lista"' + (completadasAbiertas ? '' : ' hidden') + '>';
        completadas.forEach(function(solCompletada) { html += renderizarTarjetaCompletada(solCompletada); });
        html += '</div></section>';
    }
    container.innerHTML = html;
    // Restaurar posición de scroll si el contenido es lo suficientemente largo
    if (scrollY > 0 && container.scrollHeight > scrollY) {
        container.scrollTop = scrollY;
    }
}

function renderizarTarjetaCompletada(sol) {
    var observacion = escaparParaHTML(sol.gestion_obs || 'Sin observación registrada');
    var fecha = formatearTiempoRelativo(sol.fecha_gestion) || 'Fecha no disponible';
    var nombre = escaparParaHTML(sol.nombre || 'Sin nombre');
    return '<article class="sol-card sol-card-completada" data-id="' + sol.id_solicitud + '">' +
        '<div class="completada-card-top"><span class="completada-badge">✓ Completada</span><span>' + fecha + '</span></div>' +
        '<div class="sol-nombre-row"><div class="sol-nombre">' + nombre + '</div><span class="sol-segmento">' + (sol.segmento || 'Sin segmento') + '</span></div>' +
        '<div class="sol-datos"><span>🆔 ' + (sol.cedula || '—') + '</span><span>📱 ' + (sol.celular || '—') + '</span></div>' +
        '<div class="completada-card-gestion"><strong>' + (sol.tipo_gestion || 'Completada') + '</strong><span>' + observacion + '</span></div>' +
        '<div class="sol-acciones"><button class="btn-accion tertiary" onclick="verGestion(\'' + sol.id_solicitud + '\')">📋 Ver gestión</button><button class="btn-accion tertiary" onclick="verHistorial(\'' + sol.id_solicitud + '\')">📋 Historial</button><button class="btn-accion btn-quitar-solicitud" onclick="confirmarQuitarSolicitud(\'' + sol.id_solicitud + '\', \'' + escaparParaAtributo(sol.nombre || '') + '\')">❌ Quitar</button></div>' +
        '</article>';
}

function toggleCompletadasDesktop(button) {
    var lista = button && button.nextElementSibling;
    if (!lista) return;
    var abierta = !lista.hidden;
    lista.hidden = abierta;
    button.setAttribute('aria-expanded', String(!abierta));
    button.classList.toggle('open', !abierta);
}

function escaparParaAtributo(texto) {
    return String(texto || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

function copiarNombreCedula(nombre, cedula) {
    var valorNombre = String(nombre || '').trim();
    var valorCedula = String(cedula || '').trim();
    var texto = '';

    if (valorNombre && valorCedula) {
        texto = valorNombre + ' - ' + valorCedula;
    } else if (valorNombre) {
        texto = valorNombre;
    } else if (valorCedula) {
        texto = valorCedula;
    }

    if (!texto) {
        alert('No hay nombre ni cédula para copiar');
        return;
    }

    copiarTexto(texto, 'nombre y cédula');
}

function copiarTexto(texto, etiqueta) {
    var valor = String(texto || '').trim();
    if (!valor) {
        alert('No hay ' + etiqueta + ' para copiar');
        return;
    }

    var copiarYNotificar = function() {
        alert(etiqueta.charAt(0).toUpperCase() + etiqueta.slice(1) + ' copiada');
    };

    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(valor).then(copiarYNotificar).catch(function() {
            fallbackCopy(valor, etiqueta, copiarYNotificar);
        });
        return;
    }

    fallbackCopy(valor, etiqueta, copiarYNotificar);
}

function fallbackCopy(texto, etiqueta, callback) {
    var textarea = document.createElement('textarea');
    textarea.value = texto;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
    if (callback) callback();
}

// Abrir modal de gestión para una solicitud
function abrirGestion(solicitudId, tipo) {
    var sol = solicitudes.find(function(s) { return s.id_solicitud == solicitudId; });
    
    if (!sol) {
        alert('Solicitud no encontrada');
        return;
    }
    
    var opcionesDropdown = '';
    var opciones = ['Llamada', 'WhatsApp', 'Seguimiento', 'Cobranza', 'Cita', 'Completada', 'Otro'];
    
    for (var i = 0; i < opciones.length; i++) {
        var selected = opciones[i] === tipo ? 'selected' : '';
        opcionesDropdown += '<option value="' + opciones[i] + '" ' + selected + '>' + opciones[i] + '</option>';
    }
    
    var contenido = '';
    
    contenido += '<div class="modal-gestion">';
    contenido += '<h2>📋 Gestionar Solicitud #' + solicitudId + '</h2>';
    
    // Info del cliente
    contenido += '<div class="modal-info">';
    contenido += '<p><strong>Nombre:</strong> ' + (sol.nombre || '—') + '</p>';
    contenido += '<p><strong>Cédula:</strong> ' + (sol.cedula || '—') + '</p>';
    contenido += '<p><strong>Celular:</strong> ' + (sol.celular || '—') + '</p>';
    contenido += '</div>';
    
    // Formulario
    contenido += '<div class="modal-form">';
    contenido += '<label>📋 Tipo de Gestión:</label>';
    contenido += '<select id="tipo-gestion-modal">' + opcionesDropdown + '</select>';
    
    contenido += '<label>📝 Observación:</label>';
    contenido += '<textarea id="observacion-modal" rows="4" placeholder="Escriba su observación..."></textarea>';
    
    // Toggle destacar
    var destacadoActual = sol.destacado == 1;
    contenido += '<label style="display:flex;align-items:center;gap:8px;margin-bottom:12px;cursor:pointer;padding:10px 12px;background:' + (destacadoActual ? '#fffbeb' : '#f9fafb') + ';border-radius:8px;border:1px solid ' + (destacadoActual ? '#f59e0b' : '#e5e7eb') + ';">';
    contenido += '<input type="checkbox" id="toggle-destacar" ' + (destacadoActual ? 'checked' : '') + ' style="width:18px;height:18px;">';
    contenido += '<span style="font-size:13px;color:' + (destacadoActual ? '#92400e' : '#6b7280') + ';">🔥 Destacar tarjeta</span>';
    contenido += '</label>';
    
    contenido += '<div class="modal-botones">';
    contenido += '<button class="btn-cancelar" onclick="cerrarModal()">Cancelar</button>';
    contenido += '<button class="btn-guardar" onclick="guardarGestionIndividual(\'' + solicitudId + '\')">💾 Guardar</button>';
    contenido += '</div>';
    contenido += '</div>';
    contenido += '</div>';
    
    crearModal(contenido);
}

// Alternar destacado de una solicitud (solo badge; no cambia color de tarjeta)
async function toggleDestacado(solicitudId, nuevoEstado, eventRef) {
    var badgeEl = (eventRef && eventRef.currentTarget) || (typeof event !== 'undefined' && event ? event.target : null);
    try {
        var response = await fetch('/api/gestiones-maestro/' + gestionId + '/solicitudes/' + encodeURIComponent(solicitudId) + '/destacar', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ destacado: Number(nuevoEstado) })
        });
        
        var resultado = await response.json().catch(function() { return {}; });
        
        if (!response.ok || resultado.error) {
            alert(resultado.error || 'No se pudo actualizar el destacado');
            return;
        }

        var val = Number(nuevoEstado) === 1 ? 1 : 0;
        for (var i = 0; i < todasLasSolicitudes.length; i++) {
            if (String(todasLasSolicitudes[i].id_solicitud) === String(solicitudId)) {
                todasLasSolicitudes[i].destacado = val;
            }
        }
        for (var j = 0; j < solicitudes.length; j++) {
            if (String(solicitudes[j].id_solicitud) === String(solicitudId)) {
                solicitudes[j].destacado = val;
            }
        }

        renderizarSolicitudes(todasLasSolicitudes);

        // Animación del badge recién pintado
        setTimeout(function() {
            var cards = document.querySelectorAll('.sol-card[data-id="' + solicitudId + '"]');
            if (cards.length > 0) {
                var badge = cards[0].querySelector('.sol-destacado-badge');
                if (badge) {
                    badge.classList.remove('pop');
                    void badge.offsetWidth;
                    badge.classList.add('pop');
                }
            }
        }, 30);
    } catch (error) {
        console.error('Error alternando destacado:', error);
        alert('Error al actualizar el destacado');
    }
}

// Guardar gestión individual
async function guardarGestionIndividual(solicitudId) {
    var tipo = document.getElementById('tipo-gestion-modal').value;
    var observacion = document.getElementById('observacion-modal').value.trim();
    
    if (!observacion) {
        alert('Por favor escriba una observación');
        return;
    }
    
    var btn = document.querySelector('.btn-guardar');
    btn.textContent = '💾 Guardando...';
    btn.disabled = true;
    
    try {
        var bodyLote = {
            solicitud_id: solicitudId,
            tipo_gestion: tipo,
            observacion: observacion,
            gestion_maestro_id: gestionId
        };

        var response = await fetch('/api/excel/gestiones', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(bodyLote)
        });
        
        var resultado = await response.json();
        
        if (response.ok && !resultado.error) {
            // Guardar destacado si cambió
            var checkboxDestacar = document.getElementById('toggle-destacar');
            if (checkboxDestacar) {
                var solActual = solicitudes.find(function(s) { return s.id_solicitud == solicitudId; });
                var nuevoDestacado = checkboxDestacar.checked ? 1 : 0;
                if (solActual && nuevoDestacado !== (solActual.destacado || 0)) {
                    await fetch('/api/gestiones-maestro/' + gestionId + '/solicitudes/' + encodeURIComponent(solicitudId) + '/destacar', {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ destacado: nuevoDestacado })
                    });
                }
            }
            mostrarConfirmacionGestion('Una gestión más completada');
            cerrarModal();
            cargarDatosGestion();
        } else {
            alert('Error: ' + (resultado.error || 'Error desconocido'));
        }
    } catch (error) {
        console.error('Error guardando gestión:', error);
        alert('Error al guardar la gestión');
    } finally {
        btn.textContent = '💾 Guardar';
        btn.disabled = false;
    }
}

// Ver gestión existente
function verGestion(solicitudId) {
    var sol = solicitudes.find(function(s) { return s.id_solicitud == solicitudId; });
    
    if (!sol || !sol.gestion_id) {
        alert('No hay gestión registrada');
        return;
    }
    
    var contenido = '';
    
    contenido += '<div class="modal-ver">';
    contenido += '<h2>📋 Gestión - Solicitud #' + solicitudId + '</h2>';
    contenido += '<div class="modal-info">';
    contenido += '<p><strong>Tipo:</strong> ' + (sol.tipo_gestion || '—') + '</p>';
    contenido += '<p><strong>Fecha:</strong> ' + (sol.fecha_gestion || '—') + '</p>';
    contenido += '<p><strong>Observación:</strong></p>';
    contenido += '<div class="modal-observacion">' + (sol.gestion_obs || 'Sin observación') + '</div>';
    contenido += '</div>';
    contenido += '<button class="btn-cerrar" onclick="cerrarModal()">Cerrar</button>';
    contenido += '</div>';
    
    crearModal(contenido);
}

// Ver historial completo de gestiones de una solicitud
async function verHistorial(solicitudId) {
    try {
        crearModal('<div class="modal-gestion" style="text-align:center;padding:30px;"><h2>📋 Historial</h2><p>⏳ Cargando...</p></div>');
        
        var response = await fetch('/api/gestiones-maestro/' + gestionId + '/solicitudes/' + encodeURIComponent(solicitudId) + '/historial');
        if (!response.ok) throw new Error('Error al cargar historial');
        
        var gestiones = await response.json();
        
        var contenido = '';
        contenido += '<div class="modal-gestion">';
        contenido += '<h2 style="margin-top:0;">📋 Historial - Solicitud #' + solicitudId + '</h2>';
        
        if (!gestiones || gestiones.length === 0) {
            contenido += '<div style="text-align:center;padding:20px;color:#6b7280;">No hay gestiones registradas para esta solicitud</div>';
        } else {
            contenido += '<div style="margin-bottom:12px;color:#6b7280;font-size:13px;">📊 Total: ' + gestiones.length + ' gestione(s)</div>';
            contenido += '<div style="max-height:450px;overflow-y:auto;">';
            
            var coloresTipo = {
                'Pendiente': '#fef3c7',
                'Llamada': '#d1fae5',
                'WhatsApp': '#dcfce7',
                'Seguimiento': '#dbeafe',
                'Cobranza': '#fee2e2',
                'Cita': '#e0e7ff',
                'Completada': '#bbf7d0'
            };
            
            for (var i = 0; i < gestiones.length; i++) {
                var g = gestiones[i];
                var fecha = g.fecha_gestion ? new Date(g.fecha_gestion).toLocaleString('es-ES') : '—';
                var isLast = i === gestiones.length - 1;
                var colorBadge = coloresTipo[g.tipo_gestion] || '#f3f4f6';
                
                contenido += '<div style="display:flex;gap:15px;position:relative;">';
                // Timeline dot + line
                contenido += '<div style="display:flex;flex-direction:column;align-items:center;">';
                contenido += '<div style="width:14px;height:14px;border-radius:50%;background:' + colorBadge + ';border:2px solid #9ca3af;flex-shrink:0;"></div>';
                if (!isLast) {
                    contenido += '<div style="width:2px;flex:1;background:#e5e7eb;margin:4px 0;"></div>';
                }
                contenido += '</div>';
                // Content
                contenido += '<div style="flex:1;padding-bottom:' + (isLast ? '0' : '16px') + ';">';
                contenido += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;flex-wrap:wrap;">';
                contenido += '<span style="background:' + colorBadge + ';padding:2px 10px;border-radius:12px;font-size:11px;font-weight:600;color:#374151;">' + (g.tipo_gestion || '—') + '</span>';
                if (g.vendedor) contenido += '<span style="font-size:11px;color:#2563eb;font-weight:600;">🏷️ ' + g.vendedor + '</span>';
                contenido += '<span style="font-size:11px;color:#9ca3af;">' + fecha + '</span>';
                contenido += '</div>';
                contenido += '<div style="background:#f9fafb;padding:10px 12px;border-radius:8px;font-size:13px;color:#374151;line-height:1.5;">' + (g.observacion || 'Sin observación') + '</div>';
                contenido += '</div>';
                contenido += '</div>';
            }
            
            contenido += '</div>';
        }
        
        contenido += '<div style="margin-top:16px;text-align:right;">';
        contenido += '<button class="btn-cerrar" onclick="cerrarModal()" style="padding:8px 20px;background:#f3f4f6;border:none;border-radius:8px;cursor:pointer;font-size:14px;">Cerrar</button>';
        contenido += '</div>';
        contenido += '</div>';
        
        // Cerrar modal de carga y abrir con datos
        cerrarModal();
        crearModal(contenido);
        
    } catch (error) {
        console.error('Error cargando historial:', error);
        cerrarModal();
        alert('Error al cargar el historial');
    }
}

// Crear modal genérico


// Cerrar modal


// Eventos
document.getElementById('busqueda').addEventListener('input', function() {
    renderizarSolicitudes(todasLasSolicitudes);
});

document.getElementById('filtro-estado').addEventListener('change', function() {
    renderizarSolicitudes(todasLasSolicitudes);
});

// ================== QUITAR SOLICITUD DE CAMPAÑA ==================

function confirmarQuitarSolicitud(solicitudId, nombreCliente) {
    var contenido = '';
    contenido += '<div class="modal-gestion">';
    contenido += '<h2>❌ Quitar Solicitud #' + solicitudId + '</h2>';
    contenido += '<div class="modal-info">';
    contenido += '<p><strong>Solicitud:</strong> #' + solicitudId + '</p>';
    contenido += '<p><strong>Cliente:</strong> ' + (nombreCliente || '—') + '</p>';
    contenido += '<p><strong>Campaña:</strong> ' + (datosGestion ? datosGestion.nombre : '—') + '</p>';
    contenido += '</div>';
    contenido += '<div class="modal-advertencia">';
    contenido += '<p>⚠️ <strong>¿Estás seguro?</strong></p>';
    contenido += '<ul>';
    contenido += '<li>La solicitud será quitada de esta campaña.</li>';
    contenido += '<li>Las gestiones registradas NO se eliminarán.</li>';
    contenido += '<li>Esta acción es <strong>IRREVERSIBLE</strong>.</li>';
    contenido += '</ul>';
    contenido += '</div>';
    contenido += '<div class="modal-botones">';
    contenido += '<button class="btn-cancelar" onclick="cerrarModal()">Cancelar</button>';
    contenido += '<button class="btn-eliminar" id="btn-confirmar-quitar" onclick="quitarSolicitudDeCampana(' + solicitudId + ')">❌ Quitar</button>';
    contenido += '</div>';
    contenido += '</div>';
    
    crearModal(contenido);
}

async function quitarSolicitudDeCampana(solicitudId) {
    var btn = document.getElementById('btn-confirmar-quitar');
    if (btn) { btn.textContent = '⏳ Quitando...'; btn.disabled = true; }
    
    try {
        var response = await fetch('/api/gestiones-maestro/' + gestionId + '/quitar-solicitud', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ solicitud_id: parseInt(solicitudId) })
        });
        
        var resultado = await response.json();
        
        if (response.ok && !resultado.error) {
            alert('✅ Solicitud quitada de la campaña');
            cerrarModal();
            await cargarDatosGestion();
            await cargarListaCampanas();
        } else {
            alert('Error: ' + (resultado.error || 'Error al quitar solicitud'));
            if (btn) { btn.textContent = '❌ Quitar'; btn.disabled = false; }
        }
    } catch (error) {
        console.error('Error quitando solicitud:', error);
        alert('Error al quitar la solicitud');
        if (btn) { btn.textContent = '❌ Quitar'; btn.disabled = false; }
    }
}

// ================== AGREGAR SOLICITUDES A CAMPAÑA ==================

function abrirModalAgregarSolicitudes() {
    var contenido = '';
    contenido += '<div class="modal-agregar-solicitudes">';
    contenido += '<h2>➕ Agregar Solicitudes a la Campaña</h2>';
    
    // Búsqueda
    contenido += '<div class="modal-agregar-busqueda">';
    contenido += '<input type="text" id="busqueda-agregar" placeholder="🔍 Buscar por cédula, nombre o teléfono..." oninput="buscarSolicitudesParaAgregar(event)">';
    contenido += '</div>';
    
    // Lista de resultados
    contenido += '<div id="resultados-agregar" class="resultados-agregar">';
    contenido += '<div class="agregar-vacio">Escribe para buscar solicitudes disponibles</div>';
    contenido += '</div>';
    
    // Seleccionados
    contenido += '<div id="seleccionados-agregar" class="seleccionados-agregar" style="display:none;">';
    contenido += '<p><strong>Seleccionados:</strong> <span id="contador-seleccionados">0</span></p>';
    contenido += '</div>';
    
    contenido += '<div class="modal-botones">';
    contenido += '<button class="btn-cancelar" onclick="cerrarModal()">Cancelar</button>';
    contenido += '<button class="btn-guardar" id="btn-agregar-solicitudes" onclick="agregarSolicitudesSeleccionadas()" disabled>➕ Agregar (0)</button>';
    contenido += '</div>';
    contenido += '</div>';
    
    crearModal(contenido);
}

var solicitudesDisponibles = [];
var solicitudesSeleccionadas = {};

async function buscarSolicitudesParaAgregar(event) {
    var termino = event.target.value.trim();
    var resultadosContainer = document.getElementById('resultados-agregar');
    
    if (!termino || termino.length < 2) {
        resultadosContainer.innerHTML = '<div class="agregar-vacio">Escribe al menos 2 caracteres para buscar</div>';
        return;
    }
    
    resultadosContainer.innerHTML = '<div class="agregar-cargando">🔍 Buscando...</div>';
    
    try {
        var response = await fetch('/api/excel/solicitudes/buscar?q=' + encodeURIComponent(termino));
        if (!response.ok) throw new Error('Error en búsqueda');
        
        var data = await response.json();
        
        // Obtener IDs ya en la campaña
        if (!datosGestion || !datosGestion.solicitudes_ids) {
            resultadosContainer.innerHTML = '<div class="agregar-vacio">Error: no hay datos de campaña</div>';
            return;
        }
        
        var idsEnCampana = [];
        try {
            idsEnCampana = JSON.parse(datosGestion.solicitudes_ids);
        } catch (e) {
            console.error('Error parseando solicitudes_ids:', e);
        }
        
        // Filtrar solo las que NO están en la campaña
        solicitudesDisponibles = [];
        
        // Determinar si data es un array o tiene propiedad solicitudes
        var lista = Array.isArray(data) ? data : (data.data || []);
        
        for (var i = 0; i < lista.length; i++) {
            var sol = lista[i];
            var idSol = sol.id_solicitud || sol.id;
            if (idsEnCampana.indexOf(idSol) === -1) {
                solicitudesDisponibles.push(sol);
            }
        }
        
        if (solicitudesDisponibles.length === 0) {
            resultadosContainer.innerHTML = '<div class="agregar-vacio">No se encontraron solicitudes disponibles</div>';
            return;
        }
        
        var html = '';
        for (var i = 0; i < solicitudesDisponibles.length; i++) {
            var sol = solicitudesDisponibles[i];
            var solId = sol.id_solicitud || sol.id;
            var isSelected = solicitudesSeleccionadas[solId] ? 'selected' : '';
            
            html += '<div class="agregar-item ' + isSelected + '" onclick="toggleSeleccionSolicitud(' + solId + ')">';
            html += '<div class="agregar-item-check">' + (isSelected ? '✅' : '⬜') + '</div>';
            html += '<div class="agregar-item-info">';
            html += '<div class="agregar-item-nombre">#' + solId + ' - ' + (sol.nombre || 'Sin nombre') + '</div>';
            html += '<div class="agregar-item-datos">🆔 ' + (sol.cedula || '—') + ' | 📱 ' + (sol.celular || '—') + '</div>';
            html += '</div>';
            html += '</div>';
        }
        
        resultadosContainer.innerHTML = html;
        actualizarBotonAgregar();
        
    } catch (error) {
        console.error('Error en búsqueda:', error);
        resultadosContainer.innerHTML = '<div class="agregar-error">Error al buscar: ' + error.message + '</div>';
    }
}

function toggleSeleccionSolicitud(solicitudId) {
    if (solicitudesSeleccionadas[solicitudId]) {
        delete solicitudesSeleccionadas[solicitudId];
    } else {
        solicitudesSeleccionadas[solicitudId] = true;
    }
    
    // Actualizar visual
    var items = document.querySelectorAll('.agregar-item');
    items.forEach(function(item) {
        var onclick = item.getAttribute('onclick') || '';
        var match = onclick.match(/toggleSeleccionSolicitud\((\d+)\)/);
        if (match) {
            var id = parseInt(match[1]);
            if (solicitudesSeleccionadas[id]) {
                item.classList.add('selected');
                item.querySelector('.agregar-item-check').textContent = '✅';
            } else {
                item.classList.remove('selected');
                item.querySelector('.agregar-item-check').textContent = '⬜';
            }
        }
    });
    
    actualizarBotonAgregar();
}

function actualizarBotonAgregar() {
    var count = Object.keys(solicitudesSeleccionadas).length;
    var btn = document.getElementById('btn-agregar-solicitudes');
    var contador = document.getElementById('contador-seleccionados');
    var container = document.getElementById('seleccionados-agregar');
    
    if (btn) {
        btn.textContent = '➕ Agregar (' + count + ')';
        btn.disabled = count === 0;
    }
    if (contador) contador.textContent = count;
    if (container) container.style.display = count > 0 ? 'block' : 'none';
}

async function agregarSolicitudesSeleccionadas() {
    var ids = Object.keys(solicitudesSeleccionadas).map(function(id) { return parseInt(id); });
    
    if (ids.length === 0) {
        alert('Selecciona al menos una solicitud');
        return;
    }
    
    var btn = document.getElementById('btn-agregar-solicitudes');
    if (btn) { btn.textContent = '⏳ Agregando...'; btn.disabled = true; }
    
    try {
        var response = await fetch('/api/gestiones-maestro/' + gestionId + '/agregar-solicitudes', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ solicitudes_ids: ids })
        });
        
        var resultado = await response.json();
        
        if (response.ok && !resultado.error) {
            alert('✅ ' + resultado.mensaje);
            solicitudesSeleccionadas = {};
            cerrarModal();
            await cargarDatosGestion();
            await cargarListaCampanas();
        } else {
            alert('Error: ' + (resultado.error || 'Error al agregar solicitudes'));
            if (btn) { btn.textContent = '➕ Agregar (' + ids.length + ')'; btn.disabled = false; }
        }
    } catch (error) {
        console.error('Error agregando solicitudes:', error);
        alert('Error al agregar las solicitudes');
        if (btn) { btn.textContent = '➕ Agregar (' + ids.length + ')'; btn.disabled = false; }
    }
}

// ================== EXPORTAR CAMPAÑA A EXCEL ==================

function exportarExcelGestionLote() {
    var datos = todasLasSolicitudes;
    
    if (!datos || datos.length === 0) {
        alert('No hay datos para exportar');
        return;
    }
    
    var datosAExportar = [];
    for (var i = 0; i < datos.length; i++) {
        var sol = datos[i];
        datosAExportar.push({
            'Cédula': sol.cedula || '',
            'Nombre': sol.nombre || '',
            'Teléfono': sol.celular || '',
            'Segmento': sol.segmento || '',
            'Estado': sol.tipo_gestion || 'Pendiente',
            'Observación': sol.gestion_obs || ''
        });
    }
    
    var wb = XLSX.utils.book_new();
    var ws = XLSX.utils.json_to_sheet(datosAExportar);
    
    ws['!cols'] = [
        {wch: 12},
        {wch: 30},
        {wch: 15},
        {wch: 15},
        {wch: 15},
        {wch: 50}
    ];
    
    var nombreCampana = (datosGestion && datosGestion.nombre) || 'campana';
    var nombreArchivo = 'campana_' + nombreCampana.replace(/[^a-zA-Z0-9]/g, '_') + '_' + new Date().toISOString().slice(0, 10) + '.xlsx';
    
    XLSX.utils.book_append_sheet(wb, ws, 'Campaña');
    XLSX.writeFile(wb, nombreArchivo);
    
    alert('Se exportaron ' + datos.length + ' registros a Excel');
}

// Iniciar
init();

// ================== WHATSAPP CON IMAGEN INDIVIDUAL ==================

// ================== CONFIGURACIÓN WHATSAPP ==================
// Código de país para números sin prefijo internacional
// Ecuador = 593, Nicaragua = 505, Costa Rica = 506, etc.
var PAIS_CODIGO = '593';
// Longitud máxima de un número nacional (sin código de país)
// Ecuador móvil = 9 dígitos, fijo = 7-8 dígitos
var PAIS_LONGITUD_MAX_SIN_CODIGO = 9;

// Formatear número para WhatsApp: agrega código de país si es necesario
function formatearNumeroWhatsApp(celular) {
    var numero = String(celular).replace(/[^0-9]/g, '');
    
    // Quitar cero(s) a la izquierda (ej: 099XXXXXXXX → 99XXXXXXXX)
    numero = numero.replace(/^0+/, '');
    
    // Si el número ya tiene código de país (más largo que la longitud máxima local), usarlo directo
    if (numero.length > PAIS_LONGITUD_MAX_SIN_CODIGO) {
        return numero;
    }
    
    // Si es un número local (sin código de país), agregar el código configurado
    return PAIS_CODIGO + numero;
}

// Función para llamar al cliente (desktop)
function llamarDesdeGestionLoteDesktop(celular) {
    if (!celular) { alert('No hay número de celular'); return; }
    var numeroLimpio = String(celular).replace(/\D/g, '');
    if (!numeroLimpio) { alert('No hay número de celular'); return; }
    window.open('tel:' + numeroLimpio, '_self');
}

// Función para abrir WhatsApp Web (desktop: wa.me)
function abrirWhatsAppDesktop(celular, mensaje) {
    var numeroFormateado = formatearNumeroWhatsApp(celular);
    
    console.log('[WhatsApp Desktop] Número original:', celular, '→ formateado:', numeroFormateado);
    
    var urlWhatsApp = 'https://wa.me/' + numeroFormateado;
    if (mensaje) {
        urlWhatsApp += '?text=' + encodeURIComponent(mensaje);
    }
    console.log('[WhatsApp Desktop] Abriendo:', urlWhatsApp);
    var win = window.open(urlWhatsApp, '_blank');
    if (!win) {
        alert('Por favor permite ventanas emergentes para WhatsApp');
    }
}

// Obtener el nombre completo del cliente para el saludo del mensaje
function obtenerNombreParaMensaje(nombreCompleto) {
    if (!nombreCompleto) return '';
    return String(nombreCompleto).trim().replace(/\s+/g, ' ');
}

// Generar mensaje predeterminado de WhatsApp con el nombre completo del cliente
function generarMensajeWhatsApp(nombreCompleto) {
    var nombreParaSaludo = obtenerNombreParaMensaje(nombreCompleto);
    var saludo = nombreParaSaludo ? 'Hola ' + nombreParaSaludo + ' 👋' : 'Hola 👋';
    return saludo + '\nCrédito Resuelve a las órdenes 💳✨\n\nTu crédito esta aprobado 🙌\nQué necesitas para tu hogar?, te ayudamos a hacerlo posible 📲';
}

// Reemplazar la variable {nombre} con el nombre del cliente
function aplicarVariableNombre(contenido, nombreCliente) {
    var nombre = obtenerNombreParaMensaje(nombreCliente) || '';
    return String(contenido || '').replace(/\{nombre\}/g, nombre);
}

// Abrir modal de WhatsApp para una solicitud (solo texto, sin imagen)
async function abrirGestionWhatsApp(solicitudId, celular) {
    var sol = solicitudes.find(function(s) { return s.id_solicitud == solicitudId; });
    
    if (!sol) {
        alert('Solicitud no encontrada');
        return;
    }
    
    // Validar que tenga celular
    if (!celular || celular === '') {
        alert('Esta solicitud no tiene número de celular');
        return;
    }
    
    // Cargar plantillas del usuario (reemplazan los mensajes fijos)
    var plantillasUsuario = [];
    try {
        var resPlantillas = await fetch('/api/plantillas', { credentials: 'include' });
        var dataPlantillas = await resPlantillas.json();
        plantillasUsuario = (dataPlantillas && dataPlantillas.data) || [];
    } catch (e) {
        plantillasUsuario = [];
    }
    
    var contenido = '';
    
    contenido += '<div class="modal-gestion">';
    contenido += '<h2>💬 WhatsApp Directo - Solicitud #' + solicitudId + '</h2>';
    
    // Info del cliente
    contenido += '<div class="modal-info">';
    contenido += '<p><strong>Nombre:</strong> ' + escaparParaHTML(sol.nombre || '—') + '</p>';
    contenido += '<p><strong>Celular:</strong> ' + escaparParaHTML(celular) + '</p>';
    contenido += '</div>';
    
    // Formulario
    contenido += '<div class="modal-form">';
    contenido += '<label>📝 Mensaje:</label>';
    var mensajeDefecto = generarMensajeWhatsApp(sol.nombre);

    // Plantillas del usuario con {nombre} reemplazado
    var opcionesMensajes = [];
    for (var p = 0; p < plantillasUsuario.length; p++) {
        opcionesMensajes.push({
            texto: aplicarVariableNombre(plantillasUsuario[p].contenido, sol.nombre),
            etiqueta: plantillasUsuario[p].nombre || ('Plantilla ' + (p + 1))
        });
    }
    var mensajeInicial = opcionesMensajes.length ? opcionesMensajes[0].texto : mensajeDefecto;

    if (opcionesMensajes.length > 0) {
        contenido += '<div style="display:flex; flex-wrap:wrap; gap:8px; margin-bottom:10px;">';
        for (var i = 0; i < opcionesMensajes.length; i++) {
            contenido += '<button type="button" class="btn-plantilla-whatsapp" data-index="' + i + '" data-opciones="' + encodeURIComponent(JSON.stringify(opcionesMensajes)) + '" onclick="cambiarMensajeWhatsAppDesdeBoton(this)">' + escaparParaHTML(opcionesMensajes[i].etiqueta) + '</button>';
        }
        contenido += '</div>';
    }
    contenido += '<textarea id="whatsapp-img-mensaje" rows="5" placeholder="Escriba su mensaje..." style="margin-bottom: 12px;">' + escaparParaHTML(mensajeInicial) + '</textarea>';
    
    // Info de WhatsApp
    contenido += '<div style="padding: 12px; background: #f0fdf4; border-radius: 8px; border: 1px solid #86efac; margin-bottom: 12px;">';
    contenido += '<div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">';
    contenido += '<span style="font-size: 16px;">💻</span>';
    contenido += '<span style="font-size: 13px; color: #166534;">Se abrirá WhatsApp con el mensaje y el número de la solicitud.</span>';
    contenido += '</div>';
    contenido += '<label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">';
    contenido += '<input type="checkbox" id="whatsapp-abrir-web" checked style="width: 18px; height: 18px;">';
    contenido += '<span style="font-size: 13px; color: #374151;">Abrir WhatsApp al enviar</span>';
    contenido += '</label>';
    contenido += '<label style="display: flex; align-items: center; gap: 8px; cursor: pointer; margin-top: 6px;">';
    contenido += '<input type="checkbox" id="whatsapp-guardar" style="width: 18px; height: 18px;">';
    contenido += '<span style="font-size: 13px; color: #6b7280;">Guardar gestión en el historial</span>';
    contenido += '</label>';
    contenido += '</div>';
    
    contenido += '<div class="modal-botones">';
    contenido += '<button class="btn-cancelar" onclick="cerrarModal()">Cancelar</button>';
    contenido += '<button class="btn-guardar" id="btn-whatsapp-img" onclick="enviarWhatsApp(\'' + escaparParaAtributo(solicitudId) + '\', \'' + escaparParaAtributo(celular) + '\')">📤 Enviar</button>';
    contenido += '</div>';
    contenido += '</div>';
    contenido += '</div>';
    
    crearModal(contenido);
}

function cambiarMensajeWhatsAppDesdeBoton(boton) {
    var textarea = document.getElementById('whatsapp-img-mensaje');
    if (!textarea || !boton) return;
    var index = parseInt(boton.getAttribute('data-index'), 10);
    var opcionesJson = decodeURIComponent(boton.getAttribute('data-opciones') || '');
    var opciones = JSON.parse(opcionesJson);
    if (opciones[index] && opciones[index].texto) {
        textarea.value = opciones[index].texto;
    }
}

// ================== ELIMINAR CAMPAÑA ==================

// Mostrar modal de confirmación para eliminar campaña
function confirmarEliminarCampaña(id, nombre, total, gestionadas) {
    var contenido = '';
    
    contenido += '<div class="modal-eliminar">';
    contenido += '<h2>🗑️ Eliminar Campaña</h2>';
    
    contenido += '<div class="modal-info-eliminar">';
    contenido += '<p><strong>Campaña:</strong> ' + nombre + '</p>';
    contenido += '<p><strong>Total Solicitudes:</strong> ' + total + '</p>';
    contenido += '<p><strong>Gestionadas:</strong> ' + gestionadas + '</p>';
    contenido += '<p><strong>Pendientes:</strong> ' + (total - gestionadas) + '</p>';
    contenido += '</div>';
    
    // Advertencia
    contenido += '<div class="modal-advertencia">';
    contenido += '<p>⚠️ <strong>IMPORTANTE:</strong></p>';
    contenido += '<ul>';
contenido += '<li>Se eliminarán <strong>TODAS las gestione</strong> registradas en estas ' + total + ' solicitudes.</li>';
    contenido += '<li>Esta acción es <strong>IRREVERSIBLE</strong>.</li>';
    contenido += '<li>Los datos de las solicitudes originale NO se eliminarán.</li>';
    contenido += '</ul>';
    contenido += '</div>';
    
    contenido += '<div class="modal-botones">';
    contenido += '<button class="btn-cancelar" onclick="cerrarModal()">Cancelar</button>';
    contenido += '<button class="btn-eliminar" id="btn-eliminar-campaña" onclick="eliminarCampaña(' + id + ')">🗑️ Eliminar</button>';
    contenido += '</div>';
    contenido += '</div>';
    
    crearModal(contenido);
}

// Eliminar campaña
async function eliminarCampaña(id) {
    var btn = document.getElementById('btn-eliminar-campaña');
    btn.textContent = '⏳ Eliminando...';
    btn.disabled = true;
    
    try {
        var response = await fetch('/api/gestiones-maestro/' + id, {
            method: 'DELETE'
        });
        
        var resultado = await response.json();
        
        if (response.ok && !resultado.error) {
            alert('✅ Campaña eliminada correctamente');
            cerrarModal();
            
            // Si era la campaña activa, redirigir
            if (String(gestionId) === String(id)) {
                window.location.href = '/gestion-lote';
            } else {
                cargarListaCampanas();
            }
        } else {
            alert('Error: ' + (resultado.error || 'Error al eliminar'));
            btn.textContent = '🗑️ Eliminar';
            btn.disabled = false;
        }
    } catch (error) {
        console.error('Error eliminando:', error);
        alert('Error al eliminar la campaña');
        btn.textContent = '🗑️ Eliminar';
        btn.disabled = false;
    }
}

function escaparParaHTML(texto) {
    return String(texto || '')
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

// ================== ASIGNAR CAMPAÑA A AGENTE ==================

function abrirModalAsignarAgente(campaniaId, nombreCampania, asignadoActual) {
    if (!_esLider || _agentesEquipo.length === 0) {
        alert('No tienes agentes en tu equipo para asignar');
        return;
    }
    
    var contenido = '';
    contenido += '<div class="modal-asignar">';
    contenido += '<h2>👤 Asignar Campaña</h2>';
    contenido += '<p style="margin-bottom:16px;color:#6b7280;"><strong>Campaña:</strong> ' + escaparParaHTML(nombreCampania) + '</p>';
    
    contenido += '<div class="modal-asignar-lista">';
    
    // Opción: quitar asignación si ya tiene una
    if (asignadoActual && asignadoActual !== null) {
        contenido += '<div class="asignar-item asignar-item-quitar" onclick="quitarAsignacionAgente(' + campaniaId + ')">';
        contenido += '<div class="asignar-item-check">❌</div>';
        contenido += '<div class="asignar-item-info">';
        contenido += '<div class="asignar-item-nombre">Quitar asignación actual</div>';
        contenido += '<div class="asignar-item-datos">La campaña quedará sin agente asignado</div>';
        contenido += '</div>';
        contenido += '</div>';
    }
    
    for (var i = 0; i < _agentesEquipo.length; i++) {
        var agente = _agentesEquipo[i];
        var isActive = agente.is_active;
        var esAsignado = String(agente.id) === String(asignadoActual);
        var claseItem = 'asignar-item';
        if (esAsignado) claseItem += ' asignar-item-actual';
        if (!isActive) claseItem += ' asignar-item-inactivo';
        
        contenido += '<div class="' + claseItem + '" onclick="' + (!esAsignado && isActive ? 'asignarAgente(' + campaniaId + ', ' + agente.id + ')' : '') + '">';
        if (esAsignado) {
            contenido += '<div class="asignar-item-check">✅</div>';
        } else {
            contenido += '<div class="asignar-item-check">👤</div>';
        }
        contenido += '<div class="asignar-item-info">';
        contenido += '<div class="asignar-item-nombre">' + escaparParaHTML(agente.nombre || agente.username) + '</div>';
        contenido += '<div class="asignar-item-datos">@' + escaparParaHTML(agente.username) + ' · ' + parseInt(agente.asignadas || 0) + ' asignadas</div>';
        if (esAsignado) {
            contenido += '<span style="font-size:11px;color:#059669;font-weight:600;">✅ Actualmente asignado</span>';
        }
        if (!isActive) {
            contenido += '<span style="font-size:11px;color:#dc2626;font-weight:600;">🔴 Inactivo</span>';
        }
        contenido += '</div>';
        contenido += '</div>';
    }
    
    contenido += '</div>';
    
    contenido += '<div class="modal-botones" style="margin-top:16px;">';
    contenido += '<button class="btn-cancelar" onclick="cerrarModal()">Cerrar</button>';
    contenido += '</div>';
    contenido += '</div>';
    
    crearModal(contenido);
}

async function asignarAgente(campaniaId, agenteId) {
    try {
        var response = await fetch('/api/gestiones-maestro/' + campaniaId + '/asignar-agente', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ agente_id: agenteId })
        });
        
        var resultado = await response.json();
        
        if (response.ok) {
            alert('✅ ' + resultado.mensaje);
            cerrarModal();
            await cargarListaCampanas();
            if (String(campaniaId) === String(gestionId)) {
                await cargarDatosGestion();
            }
        } else {
            alert('Error: ' + (resultado.error || 'Error al asignar agente'));
        }
    } catch (error) {
        console.error('Error asignando agente:', error);
        alert('Error al asignar agente: ' + error.message);
    }
}

async function quitarAsignacionAgente(campaniaId) {
    if (!confirm('¿Estás seguro de quitar la asignación de esta campaña?')) return;
    
    try {
        var response = await fetch('/api/gestiones-maestro/' + campaniaId + '/quitar-asignacion', {
            method: 'PUT'
        });
        
        var resultado = await response.json();
        
        if (response.ok) {
            alert('✅ ' + resultado.mensaje);
            cerrarModal();
            await cargarListaCampanas();
        } else {
            alert('Error: ' + (resultado.error || 'Error al quitar asignación'));
        }
    } catch (error) {
        console.error('Error quitando asignación:', error);
        alert('Error al quitar asignación: ' + error.message);
    }
}

// ================== EDITAR CAMPAÑA ==================

function abrirModalEditarCampana(id, nombre, descripcion, fechaLimite, estado) {
    var nombreEsc = escaparParaHTML(nombre);
    var descEsc = escaparParaHTML(descripcion);
    
    var contenido = '';
    
    contenido += '<div class="modal-editar-campana">';
    contenido += '<h2>✏️ Editar Campaña</h2>';
    
    contenido += '<div class="modal-editar-form">';
    
    contenido += '<label>📋 Nombre de la campaña:</label>';
    contenido += '<input type="text" id="edit-nombre" value="' + nombreEsc + '" placeholder="Nombre de la campaña" style="width:100%;padding:10px 12px;border:2px solid #e2e8f0;border-radius:8px;font-size:14px;margin-bottom:12px;box-sizing:border-box;">';
    
    contenido += '<label>📝 Descripción (opcional):</label>';
    contenido += '<textarea id="edit-descripcion" rows="3" placeholder="Descripción de la campaña..." style="width:100%;padding:10px 12px;border:2px solid #e2e8f0;border-radius:8px;font-size:14px;margin-bottom:12px;box-sizing:border-box;font-family:inherit;resize:vertical;">' + descEsc + '</textarea>';
    
    contenido += '<label>📅 Fecha límite (opcional):</label>';
    contenido += '<input type="date" id="edit-fecha-limite" value="' + fechaLimite + '" style="width:100%;padding:10px 12px;border:2px solid #e2e8f0;border-radius:8px;font-size:14px;margin-bottom:12px;box-sizing:border-box;">';
    
    contenido += '<label>📊 Estado:</label>';
    contenido += '<select id="edit-estado" style="width:100%;padding:10px 12px;border:2px solid #e2e8f0;border-radius:8px;font-size:14px;margin-bottom:4px;box-sizing:border-box;">';
    contenido += '<option value="Activa"' + (estado === 'Activa' ? ' selected' : '') + '>🟢 Activa</option>';
    contenido += '<option value="Completada"' + (estado === 'Completada' ? ' selected' : '') + '>✅ Completada</option>';
    contenido += '</select>';
    
    contenido += '</div>';
    
    contenido += '<div class="modal-botones">';
    contenido += '<button class="btn-cancelar" onclick="cerrarModal()">Cancelar</button>';
    contenido += '<button class="btn-guardar" id="btn-guardar-editar-campana" onclick="guardarEdicionCampana(' + id + ')">💾 Guardar cambios</button>';
    contenido += '</div>';
    contenido += '</div>';
    
    crearModal(contenido);
}

async function guardarEdicionCampana(id) {
    var nombre = document.getElementById('edit-nombre').value.trim();
    var descripcion = document.getElementById('edit-descripcion').value.trim();
    var fechaLimite = document.getElementById('edit-fecha-limite').value;
    var estado = document.getElementById('edit-estado').value;
    
    if (!nombre) {
        alert('El nombre de la campaña es requerido');
        return;
    }
    
    var btn = document.getElementById('btn-guardar-editar-campana');
    if (btn) { btn.textContent = '⏳ Guardando...'; btn.disabled = true; }
    
    try {
        var response = await fetch('/api/gestiones-maestro/' + id, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                nombre: nombre,
                descripcion: descripcion,
                fecha_limite: fechaLimite || null,
                estado: estado
            })
        });
        
        var resultado = await response.json();
        
        if (response.ok && !resultado.error) {
            alert('✅ Campaña actualizada correctamente');
            cerrarModal();
            await cargarListaCampanas();
            if (String(gestionId) === String(id)) {
                if (datosGestion) datosGestion.nombre = nombre;
                actualizarTituloCampana(nombre);
            }
        } else {
            alert('Error: ' + (resultado.error || 'Error al actualizar campaña'));
            if (btn) { btn.textContent = '💾 Guardar cambios'; btn.disabled = false; }
        }
    } catch (error) {
        console.error('Error editando campaña:', error);
        alert('Error al actualizar la campaña');
        if (btn) { btn.textContent = '💾 Guardar cambios'; btn.disabled = false; }
    }
}

// ================== FIN EDITAR CAMPAÑA ==================

// ================== FIN ELIMINAR CAMPAÑA ==================

// Enviar WhatsApp (solo texto, sin imagen)
async function enviarWhatsApp(solicitudId, celular) {
    var mensaje = document.getElementById('whatsapp-img-mensaje').value.trim();
    var checkboxAbrir = document.getElementById('whatsapp-abrir-web');
    var abrirWeb = checkboxAbrir ? checkboxAbrir.checked : true;
    
    if (!mensaje) {
        alert('Escriba un mensaje para enviar');
        return;
    }
    
    var btn = document.getElementById('btn-whatsapp-img');
    btn.textContent = '⏳ Guardando...';
    btn.disabled = true;
    
    var checkboxGuardar = document.getElementById('whatsapp-guardar');
    var guardar = checkboxGuardar ? checkboxGuardar.checked : false;
    
    try {
        // ===== PASO 1: Guardar gestión SOLO si el checkbox está marcado =====
        if (guardar) {
            var response = await fetch('/api/excel/gestiones', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    solicitud_id: solicitudId,
                    tipo_gestion: 'WhatsApp',
                    observacion: mensaje,
                    gestion_maestro_id: gestionId
                })
            });
            
            var resultado = await response.json();
            
            if (!response.ok || resultado.error) {
                throw new Error(resultado.error || 'Error al guardar gestión');
            }
        }
        
        // ===== PASO 2: Abrir WhatsApp Web =====
        if (abrirWeb) {
            abrirWhatsAppDesktop(celular, mensaje);
        }
        
        if (guardar) {
            alert('✅ Mensaje enviado y gestión guardada');
            cerrarModal();
            await cargarDatosGestion();
        } else {
            alert('✅ Mensaje enviado');
            cerrarModal();
        }
        
    } catch (error) {
        console.error('[WhatsApp Desktop] Error:', error);
        alert('Error: ' + error.message);
    } finally {
        btn.textContent = '📤 Enviar';
        btn.disabled = false;
    }
}

