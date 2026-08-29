// ============================================================================
// SCHEDULER DE LIBERACIÓN - Campaña automática semanal
// ============================================================================
// Revisa semanalmente las solicitudes en 'APROBADA PARA LIBERACIÓN' con más
// de 6 meses (fecha_solicitud) y que aún aplican para crédito.
//
// Por cada usuario afectado:
//   1. Crea o reutiliza una campaña automática (es_sistema = 1).
//   2. Mueve las solicitudes de otras campañas hacia la automática.
//   3. Crea UNA notificación in-app con enlace a la campaña (dedup 6 días).
//   4. Emite por SSE (notification.created) + actualiza el contador.
//
// NO cambia el estado de las solicitudes (siguen en APROBADA PARA LIBERACIÓN).
// ============================================================================

const pool = require('../config/db');
const cache = require('../config/cache');
const notificationBus = require('./notificationBus');
const liberacionService = require('./liberacion.service');
const pushService = require('./pushService');

// Cada 7 días (semanal)
const INTERVALO_MS = 7 * 24 * 60 * 60 * 1000;
// Ventana para no duplicar alertas del mismo usuario (6 días < 7 días de ciclo)
const DEDUP_WINDOW_MS = 6 * 24 * 60 * 60 * 1000;
// Marca fija en el título para localizar alertas previas (dedup)
const TITULO_PREFIJO = '⚠️ Solicitudes liberadas por reactivar';
const NOMBRE_CAMPANA_AUTO = 'solicitudes con mas de seis meses en estado aprobado para liberacion';
const TABLA_FALTA = /does not exist|no such table/i;

function getRows(result) {
    if (result && result.rows) return result.rows;
    return result || [];
}

function getFirstRow(result) {
    const rows = getRows(result);
    return rows.length > 0 ? rows[0] : null;
}

// ============================================================================
// OBTENER SOLICITUDES VÁLIDAS PARA LIBERACIÓN DE UN USUARIO
// Retorna array de id_solicitud que califican.
// ============================================================================
async function getSolicitudesValidas(usuarioId) {
    const params = [usuarioId, liberacionService.ESTADO_APROBADA, liberacionService.getFechaCorte()];
    const result = await pool.query(
        `SELECT id_solicitud FROM solicitudes s
         WHERE s.usuario_id = $1
           AND s.estado = $2
           AND s.fecha_solicitud IS NOT NULL
           AND s.fecha_solicitud != ''
           AND s.fecha_solicitud < $3
           AND COALESCE(s.no_aplica_credito, 1) = 1`,
        params
    );
    return getRows(result).map(function(r) { return Number(r.id_solicitud); });
}

// ============================================================================
// BUSCAR CAMPAÑA AUTOMÁTICA EXISTENTE (activa) PARA UN USUARIO
// ============================================================================
async function getCampanaAutomatica(usuarioId) {
    const result = await pool.query(
        `SELECT id, solicitudes_ids FROM gestiones_maestro
         WHERE usuario_id = ? AND es_sistema = 1
           AND nombre = ?
           AND estado = 'activa'
         ORDER BY id DESC LIMIT 1`,
        [usuarioId, NOMBRE_CAMPANA_AUTO]
    );
    return getFirstRow(result);
}

// ============================================================================
// CREAR CAMPAÑA AUTOMÁTICA
// ============================================================================
async function crearCampanaAutomatica(usuarioId, solicitudesIds) {
    const result = await pool.query(
        `INSERT INTO gestiones_maestro
            (nombre, descripcion, usuario_id, es_sistema, estado, total_solicitudes, gestionadas, solicitudes_ids)
         VALUES (?, ?, ?, 1, 'activa', ?, 0, ?)`,
        [
            NOMBRE_CAMPANA_AUTO,
            'Campaña automática semanal - reactivación de solicitudes liberadas',
            usuarioId,
            solicitudesIds.length,
            JSON.stringify(solicitudesIds)
        ]
    );
    const campanaId = result.lastInsertRowid;
    if (!campanaId) {
        throw new Error('No se pudo crear la campaña automática');
    }

    // Insertar puente semáforo para todas las solicitudes
    for (var i = 0; i < solicitudesIds.length; i++) {
        try {
            await pool.query(
                `INSERT INTO gestiones_maestro_solicitudes (gestion_maestro_id, id_solicitud, semaforo, updated_by)
                 VALUES (?, ?, 'sin_clasificar', ?)`,
                [campanaId, solicitudesIds[i], usuarioId]
            );
        } catch (e) {
            console.error('[LiberaciónScheduler] Error insertando semáforo id=' + solicitudesIds[i] + ':', e.message);
        }
    }

    // Vincular campana_id en las solicitudes
    var placeholders = solicitudesIds.map(function() { return '?'; }).join(',');
    try {
        await pool.query(
            `UPDATE solicitudes SET campana_id = ? WHERE usuario_id = ? AND id_solicitud IN (${placeholders})`,
            [campanaId, usuarioId].concat(solicitudesIds)
        );
    } catch (e) {
        console.error('[LiberaciónScheduler] Error vinculando campana_id:', e.message);
    }

    return campanaId;
}

// ============================================================================
// MOVER SOLICITUDES DE OTRAS CAMPAÑAS HACIA LA CAMPAÑA AUTOMÁTICA
// ============================================================================
async function moverSolicitudesACampana(usuarioId, campanaId, solicitudesIds) {
    if (solicitudesIds.length === 0) return;

    // 1. Obtener la campaña destino para conocer sus IDs actuales
    var resultDest = await pool.query(
        'SELECT solicitudes_ids FROM gestiones_maestro WHERE id = ?',
        [campanaId]
    );
    var campanaDest = getFirstRow(resultDest);
    var idsDestino = [];
    try {
        idsDestino = campanaDest && campanaDest.solicitudes_ids
            ? JSON.parse(campanaDest.solicitudes_ids).map(function(id) { return Number(id); })
            : [];
    } catch (e) { /* JSON corrupto, empezar vacío */ }
    var idsDestinoSet = {};
    idsDestino.forEach(function(id) { idsDestinoSet[id] = true; });

    // 2. Filtrar solo las que NO están ya en la campaña destino
    var nuevasIds = solicitudesIds.filter(function(id) { return !idsDestinoSet[id]; });
    if (nuevasIds.length === 0) return;

    // 3. Buscar en qué campaña antigua está cada solicitud
    var placeholders = nuevasIds.map(function() { return '?'; }).join(',');
    var resultOld = await pool.query(
        `SELECT id_solicitud, campana_id FROM solicitudes
         WHERE id_solicitud IN (${placeholders}) AND campana_id IS NOT NULL`,
        nuevasIds
    );
    var solicitudesConCampana = getRows(resultOld);

    // 4. Agrupar por campaña antigua para cleanup en batch
    var porCampanaAntigua = {};
    solicitudesConCampana.forEach(function(r) {
        var oldId = Number(r.campana_id);
        if (oldId && oldId !== campanaId) {
            if (!porCampanaAntigua[oldId]) porCampanaAntigua[oldId] = [];
            porCampanaAntigua[oldId].push(Number(r.id_solicitud));
        }
    });

    // 5. Cleanup de cada campaña antigua
    var campanasAntiguasIds = Object.keys(porCampanaAntigua);
    for (var c = 0; c < campanasAntiguasIds.length; c++) {
        var oldCampanaId = Number(campanasAntiguasIds[c]);
        var idsMover = porCampanaAntigua[oldCampanaId];

        try {
            // Obtener IDs actuales de la campaña antigua
            var resultOldGM = await pool.query(
                'SELECT solicitudes_ids FROM gestiones_maestro WHERE id = ?',
                [oldCampanaId]
            );
            var oldGM = getFirstRow(resultOldGM);
            if (!oldGM) continue;

            var oldIds = [];
            try {
                oldIds = oldGM.solicitudes_ids ? JSON.parse(oldGM.solicitudes_ids).map(function(id) { return Number(id); }) : [];
            } catch (e) { continue; }

            // Quitar los IDs que se mueven
            var idsSet = {};
            idsMover.forEach(function(id) { idsSet[id] = true; });
            var newOldIds = oldIds.filter(function(id) { return !idsSet[id]; });

            // Actualizar JSON y total de la campaña antigua
            await pool.query(
                `UPDATE gestiones_maestro
                 SET solicitudes_ids = ?, total_solicitudes = ?, updated_at = CURRENT_TIMESTAMP
                 WHERE id = ?`,
                [JSON.stringify(newOldIds), newOldIds.length, oldCampanaId]
            );

            // Eliminar filas del puente semáforo
            var oldPlaceholders = idsMover.map(function() { return '?'; }).join(',');
            await pool.query(
                `DELETE FROM gestiones_maestro_solicitudes
                 WHERE gestion_maestro_id = ? AND id_solicitud IN (${oldPlaceholders})`,
                [oldCampanaId].concat(idsMover)
            );

            // Limpiar campana_id de las solicitudes movidas
            await pool.query(
                `UPDATE solicitudes SET campana_id = NULL
                 WHERE campana_id = ? AND id_solicitud IN (${oldPlaceholders})`,
                [oldCampanaId].concat(idsMover)
            );
        } catch (e) {
            console.error('[LiberaciónScheduler] Error limpiando campaña antigua #' + oldCampanaId + ':', e.message);
        }
    }

    // 6. Agregar las nuevas solicitudes a la campaña destino
    var totalActualizado = idsDestino.concat(nuevasIds);
    await pool.query(
        `UPDATE gestiones_maestro
         SET solicitudes_ids = ?, total_solicitudes = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [JSON.stringify(totalActualizado), totalActualizado.length, campanaId]
    );

    // Insertar puente semáforo para las nuevas
    for (var i = 0; i < nuevasIds.length; i++) {
        try {
            await pool.query(
                `INSERT INTO gestiones_maestro_solicitudes (gestion_maestro_id, id_solicitud, semaforo, updated_by)
                 VALUES (?, ?, 'sin_clasificar', ?)`,
                [campanaId, nuevasIds[i], usuarioId]
            );
        } catch (e) {
            console.error('[LiberaciónScheduler] Error insertando semáforo id=' + nuevasIds[i] + ':', e.message);
        }
    }

    // Actualizar campana_id en las solicitudes
    var newPlaceholders = nuevasIds.map(function() { return '?'; }).join(',');
    try {
        await pool.query(
            `UPDATE solicitudes SET campana_id = ? WHERE id_solicitud IN (${newPlaceholders})`,
            [campanaId].concat(nuevasIds)
        );
    } catch (e) {
        console.error('[LiberaciónScheduler] Error vinculando campana_id:', e.message);
    }
}

// ============================================================================
// CREAR ALERTA DE LIBERACIÓN PARA UN USUARIO
// ============================================================================
async function crearAlerta(usuarioId, total, campanaId) {
    var titulo = TITULO_PREFIJO + ' (' + total + ')';
    var mensaje = 'Se creó/reutilizó la campaña automática con ' + total
        + ' solicitudes con más de 6 meses en APROBADA PARA LIBERACIÓN sin relación activa. '
        + 'Revisa la campaña para gestionarlas.';
    var accionUrl = '/gestion-lote?id=' + campanaId;

    // 1. Insertar la notificación
    var ins = await pool.query(
        `INSERT INTO notificaciones (titulo, mensaje, tipo, prioridad, creador_id, destinatario_id, accion_url, accion_texto, fecha_expiracion, accion_modulo, es_novedad, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
        [titulo, mensaje, 'warning', 'alta', usuarioId, usuarioId, accionUrl, 'Ver campaña', null, null, 0]
    );
    var newId = ins.lastInsertRowid;

    // 2. Emitir por SSE
    var notificacion = {
        id: newId,
        titulo: titulo,
        mensaje: mensaje,
        tipo: 'warning',
        prioridad: 'alta',
        destinatario_id: usuarioId,
        accion_url: accionUrl,
        accion_texto: 'Ver campaña',
        accion_modulo: null,
        es_novedad: 0,
        fecha_expiracion: null,
        leida: 0,
        recordatorio_id: null,
        creador_username: null,
        created_at: new Date().toISOString()
    };
    notificationBus.emitir('notification.created', notificacion, usuarioId);
    notificationBus.emitirAUsuario('count.updated', { no_leidas: null }, usuarioId);

    // Push web (si el usuario tiene suscripciones activas; fire-and-forget)
    try {
        await pushService.enviarPushDesdeNotificacion(notificacion);
    } catch (e) {
        console.error('[LiberaciónScheduler] Error push:', e.message);
    }

    return newId;
}

// ============================================================================
// PROCESAR ALERTAS PENDIENTES (flujo principal semanal)
// ============================================================================
// Devuelve false si el esquema aún no existe (para reintentar pronto), true si
// el pase se completó.
async function procesarAlertasLiberacion() {
    try {
        var resumen = await liberacionService.getResumenPorUsuario();
        var ahora = Date.now();
        var procesados = 0;

        for (var i = 0; i < resumen.length; i++) {
            var row = resumen[i];
            try {
                var usuarioId = Number(row.usuario_id);
                var total = parseInt(row.total) || 0;
                if (!usuarioId || total <= 0) continue;

                // 1. Obtener solicitudes válidas de este usuario
                var solicitudesIds = await getSolicitudesValidas(usuarioId);
                if (solicitudesIds.length === 0) continue;

                // 2. Buscar campaña automática existente (activa)
                var campana = await getCampanaAutomatica(usuarioId);
                var campanaId;
                var esNueva = false;

                if (campana) {
                    campanaId = campana.id;
                } else {
                    // Crear nueva campaña automática
                    campanaId = await crearCampanaAutomatica(usuarioId, solicitudesIds);
                    esNueva = true;
                }

                // 3. Mover solicitudes de otras campañas hacia la automática
                await moverSolicitudesACampana(usuarioId, campanaId, solicitudesIds);

                // 4. Dedup: ¿ya existe una alerta de liberación reciente?
                var prev = await pool.query(
                    `SELECT MAX(created_at) as ultima FROM notificaciones
                     WHERE destinatario_id = ? AND tipo = 'warning' AND titulo LIKE ?`,
                    [usuarioId, TITULO_PREFIJO + '%']
                );
                var ultima = getFirstRow(prev);
                var yaAlertado = false;
                if (ultima && ultima.ultima) {
                    var fecha;
                    if (ultima.ultima instanceof Date) {
                        fecha = ultima.ultima;
                    } else {
                        fecha = new Date(String(ultima.ultima).replace(' ', 'T'));
                    }
                    if (!isNaN(fecha.getTime()) && ahora - fecha.getTime() < DEDUP_WINDOW_MS) {
                        yaAlertado = true;
                    }
                }

                if (!yaAlertado) {
                    await crearAlerta(usuarioId, total, campanaId);
                }

                // 5. Invalidar caché
                try { cache.invalidateDashboard(usuarioId); } catch (e) { /* silencioso */ }
                try { cache.invalidateCatalogosUsuario(usuarioId); } catch (e) { /* silencioso */ }
                try { cache.invalidateAllCampanas(); } catch (e) { /* silencioso */ }

                procesados++;
            } catch (e) {
                console.error('[LiberaciónScheduler] Error procesando usuario #' + row.usuario_id + ':', e.message);
            }
        }

        if (procesados > 0) {
            console.log('[LiberaciónScheduler] Usuarios procesados: ' + procesados);
        }
        return true;
    } catch (e) {
        if (TABLA_FALTA.test(e.message)) {
            return false;
        }
        console.error('[LiberaciónScheduler] Error general:', e.message);
        return true;
    }
}

// ============================================================================
// INICIAR SCHEDULER
// ============================================================================
function iniciarLiberacionScheduler() {
    var intervalo = null;
    var reintentos = 0;

    var arrancarCiclo = async function() {
        var ok = await procesarAlertasLiberacion();
        if (ok) {
            reintentos = 0;
            if (!intervalo) {
                intervalo = setInterval(procesarAlertasLiberacion, INTERVALO_MS);
                console.log('[LiberaciónScheduler] Scheduler de liberación activo (semanal)');
            }
            return;
        }
        if (++reintentos <= 6) {
            setTimeout(arrancarCiclo, 5000);
        } else if (!intervalo) {
            intervalo = setInterval(procesarAlertasLiberacion, INTERVALO_MS);
            console.log('[LiberaciónScheduler] Scheduler de liberación activo (semanal)');
        }
    };

    arrancarCiclo();
}

module.exports = {
    iniciarLiberacionScheduler,
    procesarAlertasLiberacion
};
