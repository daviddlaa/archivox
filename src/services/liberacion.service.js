// ============================================================================
// SERVICIO DE LIBERACIÓN / REACTIVACIÓN SIN COMPRA
// ============================================================================
// Detecta solicitudes en estado 'APROBADA PARA LIBERACIÓN' que llevan más de
// 6 meses (según fecha_solicitud) y que NO tienen una relación activa (ALTA)
// con su usuario en la tabla `relaciones`. Cuando eso ocurre, si el cliente
// compra la venta NO se refleja en el usuario. Las solicitudes separadas con
// la bandera "ya no aplica para crédito" (no_aplica_credito = 0) se excluyen.
// Este servicio permite:
//   1. Contar y listar esas solicitudes (banner + listado).
//   2. Crear una campaña (gestiones_maestro) para reactivarlas.
//   3. Activarlas en lote (estado -> 'ACTIVADA') sin exigir una compra.
//
// El corte de 6 meses se calcula en JS y se pasa como parámetro para ser
// compatible con SQLite y PostgreSQL (el wrapper src/config/db.js convierte
// los placeholders).
// ============================================================================

const pool = require('../config/db');
const cache = require('../config/cache');

const ESTADO_APROBADA = 'APROBADA PARA LIBERACIÓN';
const ESTADO_ACTIVADA = 'ACTIVADA';
const MESES_CORTE = 6;

function getRows(result) {
    if (result && result.rows) return result.rows;
    return result || [];
}

function getFirstRow(result) {
    const rows = getRows(result);
    return rows.length > 0 ? rows[0] : null;
}

// Fecha de corte como "YYYY-MM-DD" (hoy menos 6 meses). La comparación
// lexicográfica funciona con fechas "YYYY-MM-DD HH:MM:SS" en ambos motores.
function getFechaCorte() {
    const d = new Date();
    d.setMonth(d.getMonth() - MESES_CORTE);
    const p = function(n) { return (n < 10 ? '0' : '') + n; };
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
}

// ============================================================================
// WHERE COMÚN: solicitudes liberadas caducadas sin relación activa
// ============================================================================
// Una relación BAJA o inexistente se considera "sin relación": solo una
// relación en estado ALTA (por usuario + cédula) evita la alerta.
// Si sinUsuario es true, se omite la cláusula usuario_id (para resúmenes
// globales por usuario en el scheduler).
// ============================================================================
function buildWhereLiberacion(alias, paramIndex, sinUsuario) {
    const a = alias || 's';
    const usuarioClause = sinUsuario ? '' : `${a}.usuario_id = $${paramIndex}`;
    const paramsUsed = sinUsuario ? paramIndex : paramIndex + 1;
    return `
        ${usuarioClause}${usuarioClause ? ' AND ' : ''}${a}.estado = $${paramsUsed}
        AND ${a}.fecha_solicitud IS NOT NULL
        AND ${a}.fecha_solicitud != ''
        AND ${a}.fecha_solicitud < $${paramsUsed + 1}
        AND COALESCE(${a}.no_aplica_credito, 1) = 1
        AND NOT EXISTS (
            SELECT 1 FROM relaciones r
            WHERE r.usuario_id = ${a}.usuario_id
              AND r.identificacion = ${a}.cedula
              AND r.estado_relacion = 'ALTA'
        )`;
}

// ============================================================================
// CONTAR SOLICITUDES DE LIBERACIÓN DE UN USUARIO
// ============================================================================
async function contarSolicitudesLiberacion(usuarioId) {
    const params = [usuarioId, ESTADO_APROBADA, getFechaCorte()];
    const result = await pool.query(
        `SELECT COUNT(*) as total FROM solicitudes s WHERE ${buildWhereLiberacion('s', 1)}`,
        params
    );
    const row = getFirstRow(result);
    return parseInt(row && row.total) || 0;
}

// ============================================================================
// LISTAR SOLICITUDES DE LIBERACIÓN (paginated)
// ============================================================================
async function getSolicitudesLiberacion(usuarioId, opts) {
    const limite = Math.min(parseInt(opts && opts.limite) || 100, 500);
    const offset = Math.max(parseInt(opts && opts.offset) || 0, 0);
    const q = (opts && opts.q ? String(opts.q).trim() : '');

    const params = [usuarioId, ESTADO_APROBADA, getFechaCorte()];
    let paramIndex = 4;

    let filtroQ = '';
    if (q) {
        filtroQ = ` AND (s.id_solicitud LIKE $${paramIndex} OR s.cedula LIKE $${paramIndex + 1} OR LOWER(s.nombre) LIKE LOWER($${paramIndex + 2}) OR s.celular LIKE $${paramIndex + 3})`;
        params.push('%' + q + '%', '%' + q + '%', '%' + q + '%', '%' + q + '%');
        paramIndex += 4;
    }

    const baseSql = `FROM solicitudes s WHERE ${buildWhereLiberacion('s', 1)}`;
    const countResult = await pool.query(
        `SELECT COUNT(*) as total ${baseSql}${filtroQ}`,
        params
    );
    const total = parseInt((getFirstRow(countResult) || {}).total) || 0;

    const dataResult = await pool.query(
        `SELECT s.*, gm.nombre as nombre_campana
         FROM solicitudes s
         LEFT JOIN gestiones_maestro gm ON s.campana_id = gm.id
         WHERE ${buildWhereLiberacion('s', 1)}${filtroQ}
         ORDER BY s.fecha_solicitud ASC, s.id_solicitud DESC
         LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
        params.concat([limite, offset])
    );

    return { data: getRows(dataResult), total: total, limite: limite, offset: offset };
}

// ============================================================================
// RESUMEN POR USUARIO (para el scheduler de alertas)
// ============================================================================
// Solo usuarios activos que tengan al menos una solicitud de liberación.
// ============================================================================
async function getResumenPorUsuario() {
    const params = [ESTADO_APROBADA, getFechaCorte()];
    const result = await pool.query(
        `SELECT u.id as usuario_id, u.username, COUNT(*) as total
         FROM solicitudes s
         INNER JOIN usuarios u ON u.id = s.usuario_id
         WHERE ${buildWhereLiberacion('s', 1, true)}
         GROUP BY u.id, u.username
         HAVING COUNT(*) > 0`,
        params
    );
    return getRows(result);
}

// ============================================================================
// ACTIVAR SIN COMPRA (en lote, con campaña opcional)
// ============================================================================
// 1. Valida que los ids pertenezcan al usuario y estén en estado APROBADA.
// 2. Si crearCampana: crea una gestión_maestro con esos ids + puente semáforo.
// 3. Cambia estado a ACTIVADA (registrando historial) para cada solicitud.
// ============================================================================
async function activarSinCompra(usuarioId, payload) {
    const ids = (Array.isArray(payload && payload.ids) ? payload.ids : [])
        .map(Number).filter(Boolean);
    if (ids.length === 0) {
        throw new Error('Se requiere al menos una solicitud');
    }
    const crearCampana = !!(payload && payload.crear_campana);
    const nombreCampana = (payload && payload.nombre_campana ? String(payload.nombre_campana).trim() : '');

    // Solo solicitudes del usuario, actualmente en estado APROBADA y que aún
    // aplican para crédito (no separadas con la bandera "ya no aplica").
    const placeholders = ids.map(function() { return '?'; }).join(',');
    const existentes = await pool.query(
        `SELECT id_solicitud, estado FROM solicitudes
         WHERE usuario_id = ? AND estado = ? AND COALESCE(no_aplica_credito, 1) = 1 AND id_solicitud IN (${placeholders})`,
        [usuarioId, ESTADO_APROBADA].concat(ids)
    );
    const validos = getRows(existentes).map(function(r) { return Number(r.id_solicitud); });
    if (validos.length === 0) {
        throw new Error('No hay solicitudes válidas para activar');
    }

    let campana_id = null;

    // 1) Crear campaña de activación si se solicita
    if (crearCampana) {
        if (!nombreCampana) {
            throw new Error('El nombre de la campaña es requerido');
        }
        const resultGM = await pool.query(
            `INSERT INTO gestiones_maestro (nombre, descripcion, usuario_id, equipo_id, total_solicitudes, gestionadas, fecha_limite, solicitudes_ids)
             VALUES (?, ?, ?, ?, ?, 0, ?, ?)`,
            [nombreCampana, payload.descripcion || 'Activación sin compra de solicitudes liberadas', usuarioId, payload.equipo_id || null, validos.length, payload.fecha_limite || null, JSON.stringify(validos)]
        );
        campana_id = resultGM.lastInsertRowid;
        if (!campana_id) {
            throw new Error('No se pudo crear la campaña de activación');
        }

        // Puente semáforo: todas entran como sin_clasificar
        for (const sid of validos) {
            try {
                await pool.query(
                    `INSERT INTO gestiones_maestro_solicitudes (gestion_maestro_id, id_solicitud, semaforo, updated_by)
                     VALUES (?, ?, 'sin_clasificar', ?)`,
                    [campana_id, sid, usuarioId]
                );
            } catch (e) {
                console.error('[Liberación] Error insertando semáforo id=' + sid + ':', e.message);
            }
        }
        // Vincular campana_id en las solicitudes
        try {
            await pool.query(
                `UPDATE solicitudes SET campana_id = ? WHERE usuario_id = ? AND id_solicitud IN (${placeholders})`,
                [campana_id, usuarioId].concat(validos)
            );
        } catch (e) {
            console.error('[Liberación] Error vinculando campana_id:', e.message);
        }
    }

    // 2) Activar cada solicitud (estado -> ACTIVADA + historial)
    let activadas = 0;
    for (const sid of validos) {
        try {
            await pool.query(
                `UPDATE solicitudes SET estado = ?, fecha_actualizacion = CURRENT_TIMESTAMP
                 WHERE id_solicitud = ? AND usuario_id = ?`,
                [ESTADO_ACTIVADA, sid, usuarioId]
            );
            try {
                await pool.query(
                    `INSERT INTO historial_actualizaciones (solicitud_id, usuario_id, campo, valor_anterior, valor_nuevo)
                     VALUES (?, ?, 'estado', ?, ?)`,
                    [sid, usuarioId, ESTADO_APROBADA, ESTADO_ACTIVADA]
                );
            } catch (e) {
                console.error('[Liberación] Error guardando historial id=' + sid + ':', e.message);
            }
            activadas++;
        } catch (e) {
            console.error('[Liberación] Error activando id=' + sid + ':', e.message);
        }
    }

    // 3) Invalidar caché
    try { cache.invalidateDashboard(usuarioId); } catch (e) { /* silencioso */ }
    try { cache.invalidateCatalogosUsuario(usuarioId); } catch (e) { /* silencioso */ }
    try { cache.invalidateAllCampanas(); } catch (e) { /* silencioso */ }

    return { activadas: activadas, campana_id: campana_id };
}

module.exports = {
    ESTADO_APROBADA,
    ESTADO_ACTIVADA,
    MESES_CORTE,
    getFechaCorte,
    contarSolicitudesLiberacion,
    getSolicitudesLiberacion,
    getResumenPorUsuario,
    activarSinCompra,
};