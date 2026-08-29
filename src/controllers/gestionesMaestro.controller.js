// Dynamic database - SQLite for local, PostgreSQL for production
const pool = require('../config/db');
const cache = require('../config/cache.js');
const notificationBus = require('../services/notificationBus');
const pushService = require('../services/pushService');
const { obtenerEquipoIdValido } = require('../utils/equipo');

// Helper para obtener resultado de queries (compatible con SQLite y PostgreSQL)
function getRows(result) {
    if (result && result.rows) return result.rows;
    return result || [];
}

function getFirstRow(result) {
    if (result.rows && result.rows.length > 0) return result.rows[0];
    if (Array.isArray(result) && result.length > 0) return result[0];
    return null;
}

// Normalizar un datetime NAIVE a string "YYYY-MM-DD HH:MM:SS" en hora de reloj local.
// En PostgreSQL las columnas TIMESTAMP se devuelven como objetos Date que
// res.json() serializa a UTC (toISOString), desplazando la hora en el navegador
// (p.ej. 09:30 → 04:30). Reconstruir con getters locales recupera la hora
// original sin importar la zona horaria del servidor. En SQLite ya es texto.
function naiveDateString(v) {
    if (!v) return v;
    if (v instanceof Date && !isNaN(v.getTime())) {
        var p = function(n) { return (n < 10 ? '0' : '') + n; };
        return v.getFullYear() + '-' + p(v.getMonth() + 1) + '-' + p(v.getDate())
            + ' ' + p(v.getHours()) + ':' + p(v.getMinutes()) + ':' + p(v.getSeconds());
    }
    return String(v).slice(0, 19);
}

// Obtener usuario actual (del middleware de auth)
function getUsuarioId(req) {
    return req.session && req.session.usuario ? req.session.usuario.id : null;
}

// Construir condiciones WHERE para acceso a gestión maestro según el rol
// Líder: campañas propias + campañas de su equipo
// Agente: campañas propias + campañas asignadas a él
// SuperAdmin/Admin: todas
//
// Importante: Cuando includeIdCheck está presente, se combina con AND
// para evitar que un usuario acceda a una campaña incorrecta.
// Ejemplo correcto: WHERE gm.id = 5 AND (gm.usuario_id = 123 OR gm.equipo_id = 456)
// Ejemplo INCORRECTO (evitado): WHERE gm.id = 5 OR gm.usuario_id = 123
function buildGestionAccessWhere(req, includeIdCheck) {
    const usuario_id = getUsuarioId(req);
    const user = req.session.usuario;
    
    let idConditions = [];
    let permConditions = [];
    let params = [];
    
    if (includeIdCheck) {
        idConditions.push('gm.id = ?');
        params.push(includeIdCheck);
    }
    
    if (user.rol === 'superadmin' || user.rol === 'admin') {
        // SuperAdmin/Admin ven todas
        // Si hay ID específico, solo validar que exista
        return {
            idConditions: idConditions,
            permConditions: [],
            params: params,
            hasIdCheck: !!includeIdCheck
        };
    }
    
    // Todos los usuarios ven sus propias campañas
    permConditions.push('gm.usuario_id = ?');
    params.push(usuario_id);
    
    if (user.es_lider && user.equipo_id) {
        // Líder también ve campañas de su equipo
        permConditions.push('gm.equipo_id = ?');
        params.push(user.equipo_id);
    } else if (user.rol === 'agente') {
        // Agente también ve campañas asignadas a él
        permConditions.push('gm.asignado_a = ?');
        params.push(usuario_id);
    }
    
    return {
        idConditions: idConditions,
        permConditions: permConditions,
        params: params,
        hasIdCheck: !!includeIdCheck
    };
}

// Construir SQL completo a partir del resultado de buildGestionAccessWhere
function buildGestionSQL(access, tableAlias) {
    const alias = tableAlias || 'gm';
    let parts = [];
    
    if (access.hasIdCheck) {
        // Combinar ID check con permisos: gm.id = X AND (perm1 OR perm2)
        const idSql = access.idConditions.map(c => c.replace('gm.', alias + '.')).join(' AND ');
        if (access.permConditions.length > 0) {
            const permSql = access.permConditions.map(c => c.replace('gm.', alias + '.')).join(' OR ');
            parts.push('(' + idSql + ' AND (' + permSql + '))');
        } else {
            // SuperAdmin solo necesita el ID check
            parts.push(idSql);
        }
    } else {
        // Listado: perm1 OR perm2
        if (access.permConditions.length > 0) {
            parts.push(access.permConditions.map(c => c.replace('gm.', alias + '.')).join(' OR '));
        } else {
            parts.push('1=1'); // SuperAdmin ve todo
        }
    }
    
    return parts.join(' AND ');
}

// Semáforo operativo por solicitud en campaña (independiente de tipo_gestion)
var SEMAFORO_VALIDOS = ['sin_clasificar', 'rojo', 'amarillo', 'verde'];

function normalizarIdsSolicitud(ids) {
    if (!Array.isArray(ids)) return [];
    var out = [];
    var seen = {};
    for (var i = 0; i < ids.length; i++) {
        var n = Number(ids[i]);
        if (!n || isNaN(n) || seen[n]) continue;
        seen[n] = true;
        out.push(n);
    }
    return out;
}

function conteoSemaforoVacio() {
    return { sin_clasificar: 0, rojo: 0, amarillo: 0, verde: 0 };
}

async function insertarSemaforoSinClasificar(gestionMaestroId, solicitudIds, usuarioId) {
    var ids = normalizarIdsSolicitud(solicitudIds);
    if (ids.length === 0) return 0;
    var insertados = 0;

    try {
        // 1) Una sola query para detectar cuáles ya tienen fila puente
        //    (antes: 1 SELECT por solicitud → N consultas por cada apertura de campaña)
        var placeholders = ids.map(function() { return '?'; }).join(',');
        var exists = await pool.query(
            'SELECT id_solicitud FROM gestiones_maestro_solicitudes WHERE gestion_maestro_id = ? AND id_solicitud IN (' + placeholders + ')',
            [gestionMaestroId].concat(ids)
        );
        var existentes = {};
        getRows(exists).forEach(function(r) { existentes[Number(r.id_solicitud)] = true; });

        // 2) Insertar solo las faltantes (normalmente 0 tras la primera vez)
        for (var i = 0; i < ids.length; i++) {
            var sid = ids[i];
            if (existentes[sid]) continue;
            try {
                await pool.query(
                    `INSERT INTO gestiones_maestro_solicitudes (gestion_maestro_id, id_solicitud, semaforo, updated_by)
                     VALUES (?, ?, 'sin_clasificar', ?)`,
                    [gestionMaestroId, sid, usuarioId || null]
                );
                insertados++;
            } catch (e) {
                console.error('[insertarSemaforoSinClasificar] Error id_solicitud=' + sid + ':', e.message);
            }
        }
    } catch (e) {
        console.error('[insertarSemaforoSinClasificar] Error detectando existentes:', e.message);
    }
    return insertados;
}

async function eliminarSemaforoSolicitudes(gestionMaestroId, solicitudIds) {
    var ids = normalizarIdsSolicitud(solicitudIds);
    for (var i = 0; i < ids.length; i++) {
        try {
            await pool.query(
                'DELETE FROM gestiones_maestro_solicitudes WHERE gestion_maestro_id = ? AND id_solicitud = ?',
                [gestionMaestroId, ids[i]]
            );
        } catch (e) {
            console.error('[eliminarSemaforoSolicitudes] Error:', e.message);
        }
    }
}

async function obtenerConteoSemaforo(gestionMaestroId) {
    var conteo = conteoSemaforoVacio();
    try {
        // "Última gestión" por solicitud vía ventana ROW_NUMBER (compatible SQLite/PG),
        // luego GROUP BY semáforo del puente. Antes: subquery MAX(id) por fila.
        var result = await pool.query(
            `WITH ultima AS (
                SELECT g2.solicitud_id, g2.tipo_gestion
                FROM (
                    SELECT g3.solicitud_id, g3.tipo_gestion,
                           ROW_NUMBER() OVER (PARTITION BY g3.solicitud_id ORDER BY g3.id DESC) AS rn
                    FROM gestiones g3
                    WHERE (g3.gestion_maestro_id = ? OR g3.gestion_maestro_id IS NULL)
                ) g2
                WHERE g2.rn = 1
            )
            SELECT gms.semaforo, COUNT(*) as count
            FROM gestiones_maestro_solicitudes gms
            LEFT JOIN ultima u ON u.solicitud_id = gms.id_solicitud
            WHERE gms.gestion_maestro_id = ?
              AND COALESCE(u.tipo_gestion, 'Pendiente') <> 'Completada'
            GROUP BY gms.semaforo`,
            [gestionMaestroId, gestionMaestroId]
        );
        var rows = getRows(result);
        for (var i = 0; i < rows.length; i++) {
            var key = rows[i].semaforo;
            if (conteo.hasOwnProperty(key)) {
                conteo[key] = parseInt(rows[i].count, 10) || 0;
            }
        }
    } catch (e) {
        console.error('[obtenerConteoSemaforo] Error:', e.message);
    }
    return conteo;
}

// Recalcular el contador "gestionadas" de una campaña a partir de los datos reales.
// Semántica unificada: número de solicitudes de la campaña cuya última gestión
// (dentro de la campaña o sin campaña) existe y no es 'Pendiente'.
// Se invoca desde todos los puntos de escritura para que la columna nunca
// dependa de incrementos manuales (que inflaban el contador con gestiones repetidas).
async function recalcularGestionadas(gestionId) {
    try {
        const resultGM = await pool.query(
            'SELECT solicitudes_ids FROM gestiones_maestro WHERE id = ?',
            [gestionId]
        );
        const gestion = getFirstRow(resultGM);
        if (!gestion) return 0;

        let ids = [];
        try {
            ids = JSON.parse(gestion.solicitudes_ids || '[]').map(Number).filter(Boolean);
        } catch (e) {
            ids = [];
        }

        let count = 0;
        if (ids.length > 0) {
            const placeholders = ids.map(function() { return '?'; }).join(',');
            const result = await pool.query(
                `SELECT COUNT(*) AS count FROM (
                    SELECT g2.solicitud_id, g2.tipo_gestion,
                           ROW_NUMBER() OVER (PARTITION BY g2.solicitud_id ORDER BY g2.id DESC) AS rn
                    FROM gestiones g2
                    WHERE (g2.gestion_maestro_id = ? OR g2.gestion_maestro_id IS NULL)
                      AND g2.solicitud_id IN (${placeholders})
                ) t
                WHERE t.rn = 1 AND t.tipo_gestion <> 'Pendiente'`,
                [gestionId].concat(ids)
            );
            const row = getFirstRow(result);
            count = row ? parseInt(row.count || 0, 10) : 0;
        }

        await pool.query(
            'UPDATE gestiones_maestro SET gestionadas = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [count, gestionId]
        );

        // ================================================================
        // HOOK: marcar filas de envios_solicitudes de esta campaña que ya
        // fueron gestionadas, y notificar al remitente (agente sin líder).
        // No rompe si la tabla aún no existe (dual DB traga errores en SQLite,
        // pero PG lanza → lo amortiguamos con try/catch).
        // ================================================================
        try {
            const envios = await pool.query(
                `SELECT e.id, e.solicitud_id, e.remitente_id, e.destino_id, e.gestionada
                 FROM envios_solicitudes e
                 WHERE e.campana_id = ? AND e.gestionada = 0`,
                [gestionId]
            );
            const filas = getRows(envios);
            for (const f of filas) {
                // ¿La solicitud ya tiene una gestion != Pendiente (última)?
                const gestionadaRes = await pool.query(
                    `SELECT tipo_gestion FROM gestiones g2
                     WHERE g2.solicitud_id = ?
                       AND (g2.gestion_maestro_id = ? OR g2.gestion_maestro_id IS NULL)
                     ORDER BY g2.id DESC LIMIT 1`,
                    [f.solicitud_id, gestionId]
                );
                const ultima = getFirstRow(gestionadaRes);
                if (ultima && String(ultima.tipo_gestion) !== 'Pendiente') {
                    await pool.query(
                        `UPDATE envios_solicitudes SET gestionada = 1, fecha_gestion = CURRENT_TIMESTAMP, gestionada_por = (
                            SELECT MAX(g2.usuario_id) FROM gestiones g2
                            WHERE g2.solicitud_id = ? AND (g2.gestion_maestro_id = ? OR g2.gestion_maestro_id IS NULL)
                         ) WHERE id = ?`,
                        [f.solicitud_id, gestionId, f.id]
                    );

                    // Notificar al remitente si quien gestiona no es el remitente
                    if (f.remitente_id) {
                        try {
                            const qn = await pool.query('SELECT nombre, username FROM usuarios WHERE id = ?', [f.remitente_id]);
                            const rem = getFirstRow(qn);
                            const qg = await pool.query(
                                `SELECT u.nombre, u.username FROM gestiones g2
                                 INNER JOIN usuarios u ON u.id = g2.usuario_id
                                 WHERE g2.solicitud_id = ? AND (g2.gestion_maestro_id = ? OR g2.gestion_maestro_id IS NULL)
                                 ORDER BY g2.id DESC LIMIT 1`,
                                [f.solicitud_id, gestionId]
                            );
                            const gestor = getFirstRow(qg);
                            const nombreGestor = gestor ? (gestor.nombre || gestor.username) : 'el agente destino';
                            const nombreRemitente = rem ? (rem.nombre || rem.username) : null;

                            // Solo notificar si el gestor no es el remitente (evita auto-notificación redundante)
                            if (gestor && Number(gestor.usuario_id) !== Number(f.remitente_id)) {
                                await crearYNotificar({
                                    destinatarioId: f.remitente_id,
                                    titulo: '✅ Tu solicitud fue gestionada',
                                    mensaje: 'La solicitud #' + f.solicitud_id + ' fue gestionada por ' + nombreGestor + '.',
                                    tipo: 'success', prioridad: 'normal',
                                    accionUrl: '/gestion-lote?id=' + gestionId,
                                    accionModulo: 'gestion-lote',
                                    accionTexto: 'Ver campaña',
                                    creadorId: null
                                });
                            }
                            void nombreRemitente;
                        } catch (eNotif) {
                            console.error('[recalcularGestionadas] Error notificando remitente:', eNotif.message);
                        }
                    }
                }
            }
        } catch (eHook) {
            console.error('[recalcularGestionadas] Error hook envios_solicitudes:', eHook.message);
        }

        return count;
    } catch (e) {
        console.error('[recalcularGestionadas] Error:', e.message);
        return null;
    }
}

// GET /api/gestiones-maestro - Listar todas las gestione maestro
async function getGestionesMaestro(req, res) {
    try {
        const usuario_id = getUsuarioId(req);
        if (!usuario_id) {
            return res.status(401).json({ error: 'No autenticado' });
        }

        // Caché por usuario (15s): esta query corre en landing desktop, landing móvil,
        // gestion-lote y solicitudes con 5 subconsultas correlacionadas por campaña.
        const cached = cache.getCampanas(usuario_id);
        if (cached) {
            return res.json(cached);
        }
        
        const access = buildGestionAccessWhere(req, null);
        const sql = `SELECT DISTINCT gm.*,
            (SELECT COUNT(*) FROM gestiones g
             WHERE g.gestion_maestro_id = gm.id
               AND g.tipo_gestion = 'Completada'
               AND g.id = (
                   SELECT MAX(g2.id) FROM gestiones g2
                   WHERE g2.solicitud_id = g.solicitud_id
                     AND (g2.gestion_maestro_id = gm.id OR g2.gestion_maestro_id IS NULL)
               )) AS completadas,
            (SELECT COUNT(*) FROM gestiones_maestro_solicitudes gms_v
             WHERE gms_v.gestion_maestro_id = gm.id
               AND gms_v.semaforo = 'verde'
               AND COALESCE((SELECT g3.tipo_gestion FROM gestiones g3 WHERE g3.id = (
                   SELECT MAX(g4.id) FROM gestiones g4
                   WHERE g4.solicitud_id = gms_v.id_solicitud
                     AND (g4.gestion_maestro_id = gm.id OR g4.gestion_maestro_id IS NULL))), 'Pendiente') <> 'Completada') AS semaforo_verde,
            (SELECT COUNT(*) FROM gestiones_maestro_solicitudes gms_a
             WHERE gms_a.gestion_maestro_id = gm.id
               AND gms_a.semaforo = 'amarillo'
               AND COALESCE((SELECT g3.tipo_gestion FROM gestiones g3 WHERE g3.id = (
                   SELECT MAX(g4.id) FROM gestiones g4
                   WHERE g4.solicitud_id = gms_a.id_solicitud
                     AND (g4.gestion_maestro_id = gm.id OR g4.gestion_maestro_id IS NULL))), 'Pendiente') <> 'Completada') AS semaforo_amarillo,
            (SELECT COUNT(*) FROM gestiones_maestro_solicitudes gms_r
             WHERE gms_r.gestion_maestro_id = gm.id
               AND gms_r.semaforo = 'rojo'
               AND COALESCE((SELECT g3.tipo_gestion FROM gestiones g3 WHERE g3.id = (
                   SELECT MAX(g4.id) FROM gestiones g4
                   WHERE g4.solicitud_id = gms_r.id_solicitud
                     AND (g4.gestion_maestro_id = gm.id OR g4.gestion_maestro_id IS NULL))), 'Pendiente') <> 'Completada') AS semaforo_rojo,
            (SELECT COUNT(*) FROM gestiones_maestro_solicitudes gms_s
             WHERE gms_s.gestion_maestro_id = gm.id
               AND gms_s.semaforo = 'sin_clasificar'
               AND COALESCE((SELECT g3.tipo_gestion FROM gestiones g3 WHERE g3.id = (
                   SELECT MAX(g4.id) FROM gestiones g4
                   WHERE g4.solicitud_id = gms_s.id_solicitud
                     AND (g4.gestion_maestro_id = gm.id OR g4.gestion_maestro_id IS NULL))), 'Pendiente') <> 'Completada') AS semaforo_sin_clasificar
            FROM gestiones_maestro gm WHERE ` + buildGestionSQL(access) + ` ORDER BY gm.created_at DESC`;
        const result = await pool.query(sql, access.params);
        const rows = getRows(result);

        // Auto-reparación del contador: si una campaña quedó con "gestionadas" inflado
        // (restos del antiguo incremento por fila) o negativo, recalcularlo una vez.
        for (let i = 0; i < rows.length; i++) {
            const gestionadasActual = parseInt(rows[i].gestionadas || 0, 10);
            const totalActual = parseInt(rows[i].total_solicitudes || 0, 10);
            if (gestionadasActual > totalActual || gestionadasActual < 0) {
                const recalculado = await recalcularGestionadas(rows[i].id);
                if (recalculado !== null) rows[i].gestionadas = recalculado;
            }
        }

        cache.setCampanas(usuario_id, rows);
        res.json(rows);
    } catch (error) {
        console.error('Error en getGestionesMaestro:', error);
        res.status(500).json({ error: 'Error al buscar gestiones' });
    }
}

// GET /api/gestiones-maestro/:id - Ver una gestión específica con sus solicitudes
async function getGestionMaestroById(req, res) {
    try {
        const usuario_id = getUsuarioId(req);
        if (!usuario_id) {
            return res.status(401).json({ error: 'No autenticado' });
        }
        
        const { id } = req.params;
        
        // Obtener gestión maestro con control de acceso según rol
        const access = buildGestionAccessWhere(req, id);
        const sql = 'SELECT gm.* FROM gestiones_maestro gm WHERE ' + buildGestionSQL(access);
        const resultGM = await pool.query(sql, access.params);
        
        const gestion = getFirstRow(resultGM);
        
        if (!gestion) {
            return res.status(404).json({ error: 'Gestión no encontrada' });
        }
        
        // Obtener IDs de solicitudes guardados como JSON en la campaña
        var solicitudesIds = [];
        try {
            if (gestion.solicitudes_ids) {
                solicitudesIds = JSON.parse(gestion.solicitudes_ids);
            }
        } catch (e) {
            console.error('[getGestionMaestroById] Error parseando solicitudes_ids:', e);
        }
        
        if (solicitudesIds.length === 0) {
            return res.json({
                ...gestion,
                solicitudes: [],
                completadas: 0,
                semaforo_conteos: conteoSemaforoVacio()
            });
        }

        // Asegurar filas puente (campañas viejas o desincronizadas)
        try {
            await insertarSemaforoSinClasificar(id, solicitudesIds, usuario_id);
        } catch (e) {
            console.error('[getGestionMaestroById] ensure semaforo:', e.message);
        }
        
        // Construir placeholders para la cláusula IN
        const placeholders = solicitudesIds.map(function() { return '?'; }).join(',');

        // ============================================================
        // CARGA OPTIMIZADA (antes: 2 subconsultas correlacionadas por
        // fila + N inserts de puente por apertura). Ahora:
        //   1) SELECT plano de solicitudes
        //   2) Ventana ROW_NUMBER → última gestión por solicitud
        //   3) Ventana ROW_NUMBER → último recordatorio pendiente
        //   4) SELECT del semáforo puente
        // Se fusionan en JS manteniendo el mismo contrato de respuesta.
        // ============================================================

        // 1) Solicitudes base (todas las columnas, sin subconsultas por fila)
        const resultSol = await pool.query(
            'SELECT s.* FROM solicitudes s WHERE s.id_solicitud IN (' + placeholders + ')',
            solicitudesIds
        );

        // 2) Última gestión, último recordatorio y semáforo en paralelo
        const [resultUltGestion, resultUltRecordatorio, resultSemaforo] = await Promise.all([
            pool.query(`
                SELECT g2.solicitud_id, g2.id AS gestion_id, g2.tipo_gestion, g2.observacion AS gestion_obs, g2.fecha_gestion
                FROM (
                    SELECT g3.id, g3.solicitud_id, g3.tipo_gestion, g3.observacion, g3.fecha_gestion,
                           ROW_NUMBER() OVER (PARTITION BY g3.solicitud_id ORDER BY g3.id DESC) AS rn
                    FROM gestiones g3
                    WHERE (g3.gestion_maestro_id = ? OR g3.gestion_maestro_id IS NULL)
                      AND g3.solicitud_id IN (${placeholders})
                ) g2
                WHERE g2.rn = 1`,
                [id].concat(solicitudesIds)
            ),
            pool.query(`
                SELECT r2.solicitud_id,
                       r2.id AS recordatorio_id,
                       r2.canal AS recordatorio_canal,
                       r2.fecha_recordatorio AS recordatorio_fecha,
                       r2.nota AS recordatorio_nota,
                       r2.estado AS recordatorio_estado
                FROM (
                    SELECT r3.id, r3.solicitud_id, r3.canal, r3.fecha_recordatorio, r3.nota, r3.estado,
                           ROW_NUMBER() OVER (PARTITION BY r3.solicitud_id ORDER BY r3.id DESC) AS rn
                    FROM recordatorios r3
                    WHERE r3.gestion_maestro_id = ?
                      AND r3.estado = 'pendiente'
                      AND r3.solicitud_id IN (${placeholders})
                ) r2
                WHERE r2.rn = 1`,
                [id].concat(solicitudesIds)
            ),
            pool.query(
                'SELECT gms.id_solicitud, gms.semaforo FROM gestiones_maestro_solicitudes gms WHERE gms.gestion_maestro_id = ? AND gms.id_solicitud IN (' + placeholders + ')',
                [id].concat(solicitudesIds)
            )
        ]);

        // 3) Fusionar en JS (mismo contrato que la query original)
        const gestionPorSolicitud = new Map();
        getRows(resultUltGestion).forEach(function(r) {
            gestionPorSolicitud.set(Number(r.solicitud_id), r);
        });
        const recordatorioPorSolicitud = new Map();
        getRows(resultUltRecordatorio).forEach(function(r) {
            recordatorioPorSolicitud.set(Number(r.solicitud_id), r);
        });
        const semaforoPorSolicitud = new Map();
        getRows(resultSemaforo).forEach(function(r) {
            semaforoPorSolicitud.set(Number(r.id_solicitud), r.semaforo);
        });

        const Solicitudes = getRows(resultSol).map(function(s) {
            const g = gestionPorSolicitud.get(Number(s.id_solicitud));
            const rec = recordatorioPorSolicitud.get(Number(s.id_solicitud));
            return {
                ...s,
                tipo_gestion: (g && g.tipo_gestion) || 'Pendiente',
                gestion_obs: g ? (g.gestion_obs != null ? g.gestion_obs : 'Por gestionar') : 'Por gestionar',
                gestion_id: g ? g.gestion_id : null,
                fecha_gestion: g ? g.fecha_gestion : null,
                semaforo: semaforoPorSolicitud.get(Number(s.id_solicitud)) || 'sin_clasificar',
                recordatorio_id: rec ? rec.recordatorio_id : null,
                recordatorio_canal: rec ? rec.recordatorio_canal : null,
                recordatorio_fecha: rec ? rec.recordatorio_fecha : null,
                recordatorio_nota: rec ? rec.recordatorio_nota : null,
                recordatorio_estado: rec ? rec.recordatorio_estado : null
            };
        });

        // Mantener el orden de la query original: con gestión primero, luego las
        // pendientes; dentro de cada grupo por fecha_gestion DESC.
        function fechaValor(f) {
            if (!f) return 0;
            return new Date(String(f).replace(' ', 'T')).getTime();
        }
        Solicitudes.sort(function(a, b) {
            const aNoG = a.gestion_id == null;
            const bNoG = b.gestion_id == null;
            if (aNoG !== bNoG) return aNoG ? 1 : -1;
            return fechaValor(b.fecha_gestion) - fechaValor(a.fecha_gestion);
        });
        
        // Normalizar el datetime naive del recordatorio (Postgres lo devuelve como Date y
        // res.json lo serializaría a UTC, desplazando la hora en el navegador)
        Solicitudes.forEach(function(s) {
            if (s.recordatorio_fecha) s.recordatorio_fecha = naiveDateString(s.recordatorio_fecha);
        });
        
        console.log('[getGestionMaestroById] Total solicitudes devueltas:', Solicitudes.length);
        if (Solicitudes.length > 0) {
            console.log('[getGestionMaestroById] Primeras 3 gestion_obs:', 
                Solicitudes.slice(0, 3).map(s => ({id: s.id_solicitud, obs: s.gestion_obs, tipo: s.tipo_gestion, semaforo: s.semaforo})));
        }

        const semaforo_conteos = await obtenerConteoSemaforo(id);
        
        // "gestionadas" computado = solicitudes con última gestión real (coherente con el KPI del header)
        const gestionadasComputado = Solicitudes.filter(function(s) {
            return s.gestion_id && s.tipo_gestion && s.tipo_gestion !== 'Pendiente';
        }).length;

        res.json({
            ...gestion,
            solicitudes: Solicitudes,
            completadas: Solicitudes.filter(function(s) { return s.tipo_gestion === 'Completada'; }).length,
            gestionadas: gestionadasComputado,
            semaforo_conteos: semaforo_conteos
        });
    } catch (error) {
        console.error('Error en getGestionMaestroById:', error);
        res.status(500).json({ error: 'Error al buscar gestión' });
    }
}

// GET /api/gestiones-maestro/:id/solicitudes/:solicitudId/historial
// Historial contextual de una solicitud dentro de una campaña accesible.
async function getHistorialSolicitudCampana(req, res) {
    try {
        const usuario_id = getUsuarioId(req);
        if (!usuario_id) return res.status(401).json({ error: 'No autenticado' });

        const { id, solicitudId } = req.params;
        const access = buildGestionAccessWhere(req, id);
        const gestionResult = await pool.query(
            'SELECT gm.id, gm.solicitudes_ids FROM gestiones_maestro gm WHERE ' + buildGestionSQL(access),
            access.params
        );
        const gestion = getFirstRow(gestionResult);
        if (!gestion) return res.status(404).json({ error: 'Campaña no encontrada' });

        let solicitudIds = [];
        try { solicitudIds = JSON.parse(gestion.solicitudes_ids || '[]'); } catch (e) { solicitudIds = []; }
        if (solicitudIds.map(String).indexOf(String(solicitudId)) === -1) {
            return res.status(404).json({ error: 'La solicitud no pertenece a esta campaña' });
        }

        const result = await pool.query(
            `SELECT id, solicitud_id, tipo_gestion, observacion, fecha_gestion, usuario_id, resultado, duracion_seg, gestion_maestro_id
             FROM gestiones
             WHERE solicitud_id = ?
               AND (gestion_maestro_id = ? OR gestion_maestro_id IS NULL)
             ORDER BY fecha_gestion DESC, id DESC`,
            [solicitudId, id]
        );
        res.json(getRows(result));
    } catch (error) {
        console.error('Error getHistorialSolicitudCampana:', error);
        res.status(500).json({ error: 'Error al cargar historial de la campaña' });
    }
}

// GET /api/gestiones-maestro/:id/historial
// Historial GENERAL de gestiones de toda la campaña (todas las solicitudes que siguen en ella).
// Cada entrada es navegable desde el frontend (salta a la tarjeta sin importar su semáforo).
async function getHistorialGeneralCampana(req, res) {
    try {
        const usuario_id = getUsuarioId(req);
        if (!usuario_id) return res.status(401).json({ error: 'No autenticado' });

        const { id } = req.params;
        const access = buildGestionAccessWhere(req, id);
        const gestionResult = await pool.query(
            'SELECT gm.id, gm.nombre, gm.solicitudes_ids FROM gestiones_maestro gm WHERE ' + buildGestionSQL(access),
            access.params
        );
        const gestion = getFirstRow(gestionResult);
        if (!gestion) return res.status(404).json({ error: 'Campaña no encontrada' });

        let solicitudIds = [];
        try { solicitudIds = JSON.parse(gestion.solicitudes_ids || '[]'); } catch (e) { solicitudIds = []; }

        if (solicitudIds.length === 0) {
            return res.json({ gestion: gestion, total: 0, gestiones: [] });
        }

        const placeholders = solicitudIds.map(function() { return '?'; }).join(',');
        const result = await pool.query(`
            SELECT g.id,
                   g.solicitud_id,
                   g.tipo_gestion,
                   g.observacion,
                   g.fecha_gestion,
                   g.usuario_id,
                   g.resultado,
                   g.duracion_seg,
                   u.username AS vendedor,
                   s.nombre AS nombre_cliente,
                   s.cedula,
                   s.celular,
                   CASE WHEN gms.semaforo IS NULL THEN 'sin_clasificar' ELSE gms.semaforo END AS semaforo
            FROM gestiones g
            LEFT JOIN solicitudes s ON s.id_solicitud = g.solicitud_id
            LEFT JOIN usuarios u ON u.id = g.usuario_id
            LEFT JOIN gestiones_maestro_solicitudes gms
                ON gms.gestion_maestro_id = ? AND gms.id_solicitud = g.solicitud_id
            WHERE g.solicitud_id IN (${placeholders})
              AND (g.gestion_maestro_id = ? OR g.gestion_maestro_id IS NULL)
            ORDER BY g.fecha_gestion DESC, g.id DESC
        `, [id].concat(solicitudIds).concat([id]));

        const gestiones = getRows(result);
        res.json({ gestion: gestion, total: gestiones.length, gestiones: gestiones });
    } catch (error) {
        console.error('Error en getHistorialGeneralCampana:', error);
        res.status(500).json({ error: 'Error al cargar el historial general de la campaña' });
    }
}

// PUT /api/gestiones-maestro/:id/solicitudes/:solicitudId/destacar
// Permite destacar una solicitud cuando el usuario tiene acceso operativo a la campaña.
async function destacarSolicitudCampana(req, res) {
    try {
        const usuario_id = getUsuarioId(req);
        if (!usuario_id) return res.status(401).json({ error: 'No autenticado' });

        const { id, solicitudId } = req.params;
        const destacado = Number(req.body && req.body.destacado);
        if (destacado !== 0 && destacado !== 1) {
            return res.status(400).json({ error: 'El campo destacado debe ser 0 o 1' });
        }

        const access = buildGestionAccessWhere(req, id);
        const gestionResult = await pool.query(
            'SELECT gm.id, gm.solicitudes_ids FROM gestiones_maestro gm WHERE ' + buildGestionSQL(access),
            access.params
        );
        const gestion = getFirstRow(gestionResult);
        if (!gestion) return res.status(404).json({ error: 'Campaña no encontrada' });

        let solicitudIds = [];
        try { solicitudIds = JSON.parse(gestion.solicitudes_ids || '[]'); } catch (e) { solicitudIds = []; }
        if (solicitudIds.map(String).indexOf(String(solicitudId)) === -1) {
            return res.status(404).json({ error: 'La solicitud no pertenece a esta campaña' });
        }

        const result = await pool.query(
            `UPDATE solicitudes
             SET destacado = ?, fecha_actualizacion = CURRENT_TIMESTAMP
             WHERE id_solicitud = ?
             RETURNING id_solicitud, destacado`,
            [destacado, solicitudId]
        );
        const actualizado = getFirstRow(result);
        if (!actualizado) return res.status(404).json({ error: 'Solicitud no encontrada' });

        res.json({
            mensaje: destacado === 1 ? 'Solicitud destacada' : 'Solicitud no destacada',
            data: actualizado
        });
    } catch (error) {
        console.error('Error destacarSolicitudCampana:', error);
        res.status(500).json({ error: 'Error al actualizar el destacado' });
    }
}

// POST /api/gestiones-maestro - Crear nueva gestión por lotes
async function createGestionMaestro(req, res) {
    try {
        const usuario_id = getUsuarioId(req);
        console.log('[gestiones-maestro] Usuario ID:', usuario_id);
        console.log('[gestiones-maestro] Session:', req.session);
        
        if (!usuario_id) {
            console.error('[gestiones-maestro] Error: No autenticado - session:', req.session);
            return res.status(401).json({ error: 'No autenticado', detalle: 'Sesión no válida' });
        }
        
        let { nombre, descripcion, fecha_limite, solicitudes_ids, agente_id } = req.body;
        console.log('[gestiones-maestro] Datos recibidos:', { nombre, descripcion, fecha_limite, solicitudes_ids: solicitudes_ids?.length, agente_id });
        
        if (!nombre) {
            return res.status(400).json({ error: 'El nombre es requerido' });
        }
        
        solicitudes_ids = normalizarIdsSolicitud(solicitudes_ids);
        if (solicitudes_ids.length === 0) {
            return res.status(400).json({ error: 'Se requiere al menos una solicitud válida' });
        }
        
        // Obtener equipo_id valido en tiempo real: la sesión puede traer un
        // equipo borrado o del que el usuario fue dado de baja, lo que rompería
        // la FK gestiones_maestro_equipo_id_fkey al insertar. Todo usuario,
        // indistinto de rol o membresía, debe poder crear una campaña.
        const user = req.session.usuario;
        const equipo_id = await obtenerEquipoIdValido(usuario_id, user && user.equipo_id);
        
        let asignado_a = null;
        
        // ============================================================
        // ASIGNACIÓN A AGENTE (solo líderes)
        // ============================================================
        if (agente_id) {
            // Solo el líder (o superadmin/admin) puede asignar un agente al crear
            if (user.rol !== 'superadmin' && user.rol !== 'admin' && !user.es_lider) {
                return res.status(403).json({ error: 'Solo el líder puede asignar campañas a agentes' });
            }
            
            if (!equipo_id) {
                return res.status(400).json({ error: 'No tienes un equipo asignado para asignar agentes' });
            }
            
            // Verificar que el agente existe, está activo y pertenece al mismo equipo
            const checkAgente = await pool.query(
                `SELECT u.id, u.username, u.is_active 
                 FROM usuarios u 
                 INNER JOIN equipo_usuarios eu ON u.id = eu.usuario_id 
                 WHERE u.id = ? AND eu.equipo_id = ? AND eu.fecha_salida IS NULL AND eu.es_lider = 0`,
                [agente_id, equipo_id]
            );
            
            const agente = getFirstRow(checkAgente);
            
            if (!agente) {
                return res.status(400).json({ error: 'El agente no pertenece a tu equipo o no es un agente válido' });
            }
            
            if (!agente.is_active) {
                return res.status(400).json({ error: 'El agente seleccionado está inactivo' });
            }
            
            asignado_a = agente_id;
            console.log('[gestiones-maestro] Campaña será asignada al agente:', agente_id, agente.username);
        }
        
        // Guardar los IDs de solicitudes como JSON en la misma tabla
        // (evita escribir N registros innecesarios en gestiones con 'Pendiente/Por gestionar')
        const solicitudesIdsJson = JSON.stringify(solicitudes_ids);
        
        const resultGM = await pool.query(`
            INSERT INTO gestiones_maestro (nombre, descripcion, usuario_id, equipo_id, total_solicitudes, gestionadas, fecha_limite, solicitudes_ids, asignado_a)
            VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?)
        `, [nombre, descripcion || '', usuario_id, equipo_id, solicitudes_ids.length, fecha_limite || null, solicitudesIdsJson, asignado_a]);
        
        // SQLite usa lastInsertRowid
        const gestion_id = resultGM.lastInsertRowid;
        console.log('[gestiones-maestro] Gestion ID creada:', gestion_id, 'con', solicitudes_ids.length, 'solicitudes', asignado_a ? ', asignada a agente: ' + asignado_a : ', sin asignar');
        
        // ✅ YA NO se insertan registros 'Pendiente/Por gestionar' en la tabla gestiones
        // Los IDs quedan almacenados en gestiones_maestro.solicitudes_ids como JSON
        // Las solicitudes se muestran como 'Pendiente' vía COALESCE en la consulta

        // Puente semáforo: todas entran como sin_clasificar
        try {
            await insertarSemaforoSinClasificar(gestion_id, solicitudes_ids, usuario_id);
        } catch (e) {
            console.error('[gestiones-maestro] Error insertando semáforo:', e.message);
        }

        // Vincular campana_id en las solicitudes (consistencia con admin y liberación)
        try {
            const placeholders = solicitudes_ids.map(function() { return '?'; }).join(',');
            await pool.query(
                `UPDATE solicitudes SET campana_id = ? WHERE id_solicitud IN (` + placeholders + `)`,
                [gestion_id].concat(solicitudes_ids)
            );
        } catch (e) {
            console.error('[gestiones-maestro] Error actualizando campana_id:', e.message);
        }
        
        console.log('[gestiones-maestro] Gestion creada exitosamente, ID:', gestion_id);

        cache.invalidateAllCampanas();
        notificationBus.emitir('campanas.updated', {
            accion: 'creada',
            id: gestion_id,
            nombre: nombre,
            timestamp: new Date().toISOString()
        });
        
        res.json({ 
            id: gestion_id, 
            mensaje: 'Gestión creada correctamente',
            total_solicitudes: solicitudes_ids.length,
            asignado_a: asignado_a
        });
    } catch (error) {
        console.error('[gestiones-maestro] Error completo:', error);
        console.error('[gestiones-maestro] Stack:', error.stack);
        res.status(500).json({ error: 'Error al crear gestión', detalle: error.message });
    }
}

// PUT /api/gestiones-maestro/:id - Actualizar gestión maestro
async function updateGestionMaestro(req, res) {
    try {
        const usuario_id = getUsuarioId(req);
        if (!usuario_id) {
            return res.status(401).json({ error: 'No autenticado' });
        }
        
        const { id } = req.params;
        const { nombre, descripcion, fecha_limite, estado } = req.body;
        
        // Verificar que existe y el usuario tiene acceso
        const access = buildGestionAccessWhere(req, id);
        const checkSql = 'SELECT id FROM gestiones_maestro gm WHERE ' + buildGestionSQL(access);
        const resultCheck = await pool.query(checkSql, access.params);
        
        const existing = getFirstRow(resultCheck);
        
        if (!existing) {
            return res.status(404).json({ error: 'Gestión no encontrada' });
        }
        
        // Actualizar - solo actualizar campos que vienen definidos
        if (nombre !== undefined || descripcion !== undefined || fecha_limite !== undefined || estado !== undefined) {
            const updates = [];
            const params = [];
            
            if (nombre !== undefined) { updates.push('nombre = ?'); params.push(nombre); }
            if (descripcion !== undefined) { updates.push('descripcion = ?'); params.push(descripcion); }
            if (fecha_limite !== undefined) { updates.push('fecha_limite = ?'); params.push(fecha_limite); }
            if (estado !== undefined) { updates.push('estado = ?'); params.push(estado); }
            updates.push('updated_at = CURRENT_TIMESTAMP');
            params.push(id);
            
            await pool.query(`
                UPDATE gestiones_maestro 
                SET ${updates.join(', ')}
                WHERE id = ?
            `, params);
        }
        
        cache.invalidateAllCampanas();
        notificationBus.emitir('campanas.updated', {
            accion: 'renombrada',
            id: Number(id),
            nombre: nombre !== undefined ? nombre : null,
            timestamp: new Date().toISOString()
        });
        res.json({ mensaje: 'Gestión actualizada correctamente' });
    } catch (error) {
        console.error('Error en updateGestionMaestro:', error);
        res.status(500).json({ error: 'Error al actualizar gestión' });
    }
}

// DELETE /api/gestiones-maestro/:id - Eliminar gestión maestro
async function deleteGestionMaestro(req, res) {
    try {
        const usuario_id = getUsuarioId(req);
        if (!usuario_id) {
            return res.status(401).json({ error: 'No autenticado' });
        }
        
        const { id } = req.params;
        
        // Verificar que existe y el usuario tiene acceso
        const access = buildGestionAccessWhere(req, id);
        const checkSql = 'SELECT id FROM gestiones_maestro gm WHERE ' + buildGestionSQL(access);
        const resultCheck = await pool.query(checkSql, access.params);
        
        const existing = getFirstRow(resultCheck);
        
        if (!existing) {
            return res.status(404).json({ error: 'Gestión no encontrada' });
        }
        
        // Eliminar puente semáforo (estado rojo/amarillo/verde específico de la campaña)
        try {
            await pool.query(`
                DELETE FROM gestiones_maestro_solicitudes WHERE gestion_maestro_id = ?
            `, [id]);
        } catch (e) {
            console.error('[deleteGestionMaestro] Error borrando semáforo:', e.message);
        }

        // ✅ CONSERVAR el historial de gestiones: NO se borran, solo se desvinculan de la campaña.
        // Las consultas de historial general usan `gestion_maestro_id IS NULL`, por lo que
        // las gestiones de las solicitudes siguen visibles tras eliminar la campaña.
        try {
            await pool.query(`
                UPDATE gestiones SET gestion_maestro_id = NULL WHERE gestion_maestro_id = ?
            `, [id]);
        } catch (e) {
            console.error('[deleteGestionMaestro] Error desvinculando gestiones de la campaña:', e.message);
        }

        // Limpiar campana_id de las solicitudes para evitar referencias a una campaña inexistente
        try {
            await pool.query(`
                UPDATE solicitudes SET campana_id = NULL WHERE campana_id = ?
            `, [id]);
        } catch (e) {
            console.error('[deleteGestionMaestro] Error limpiando campana_id de solicitudes:', e.message);
        }

        // Limpiar filas huérfanas de la asociación campaña ↔ equipo
        try {
            await pool.query(`
                DELETE FROM campañas_equipo WHERE campaña_id = ?
            `, [id]);
        } catch (e) {
            console.error('[deleteGestionMaestro] Error limpiando campañas_equipo:', e.message);
        }
        
        // Eliminar el maestro
        await pool.query(`
            DELETE FROM gestiones_maestro WHERE id = ?
        `, [id]);
        
        cache.invalidateAllCampanas();
        notificationBus.emitir('campanas.updated', {
            accion: 'eliminada',
            id: Number(id),
            timestamp: new Date().toISOString()
        });
        res.json({ mensaje: 'Campaña eliminada correctamente. El historial de gestiones de las solicitudes se conserva.' });
    } catch (error) {
        console.error('Error en deleteGestionMaestro:', error);
        res.status(500).json({ error: 'Error al eliminar gestión' });
    }
}

// POST /api/gestiones-maestro/:id/recordatorios
// Programar un recordatorio de llamada/mensaje dentro de una campaña accesible.
async function crearRecordatorio(req, res) {
    try {
        const usuario_id = getUsuarioId(req);
        if (!usuario_id) {
            return res.status(401).json({ error: 'No autenticado' });
        }

        const { id } = req.params;
        const { solicitud_id, canal, fecha_recordatorio, nota } = req.body;

        if (!solicitud_id) {
            return res.status(400).json({ error: 'solicitud_id es requerido' });
        }
        if (['Llamada', 'Mensaje'].indexOf(canal) === -1) {
            return res.status(400).json({ error: 'canal debe ser Llamada o Mensaje' });
        }
        if (!fecha_recordatorio) {
            return res.status(400).json({ error: 'fecha_recordatorio es requerida' });
        }
        const fechaNormalizada = String(fecha_recordatorio).replace('T', ' ').slice(0, 19);
        if (isNaN(new Date(fechaNormalizada.replace(' ', 'T')).getTime())) {
            return res.status(400).json({ error: 'fecha_recordatorio no es válida' });
        }

        // Acceso a la campaña
        const access = buildGestionAccessWhere(req, id);
        const resultGM = await pool.query(
            'SELECT gm.id, gm.solicitudes_ids FROM gestiones_maestro gm WHERE ' + buildGestionSQL(access),
            access.params
        );
        const gestion = getFirstRow(resultGM);
        if (!gestion) {
            return res.status(404).json({ error: 'Campaña no encontrada' });
        }

        // La solicitud debe pertenecer a la campaña
        let solicitudIds = [];
        try { solicitudIds = JSON.parse(gestion.solicitudes_ids || '[]'); } catch (e) { solicitudIds = []; }
        if (solicitudIds.map(String).indexOf(String(solicitud_id)) === -1) {
            return res.status(404).json({ error: 'La solicitud no pertenece a esta campaña' });
        }

        // Insertar el recordatorio
        const result = await pool.query(`
            INSERT INTO recordatorios (solicitud_id, gestion_maestro_id, usuario_id, canal, fecha_recordatorio, nota)
            VALUES (?, ?, ?, ?, ?, ?)
        `, [solicitud_id, id, usuario_id, canal, fechaNormalizada, nota || '']);
        const recordatorio_id = result.lastInsertRowid;

        // Registrar también una gestión tipo 'Recordatorio' para el historial
        const resultGestion = await pool.query(`
            INSERT INTO gestiones (solicitud_id, usuario_id, tipo_gestion, observacion, gestion_maestro_id)
            VALUES (?, ?, ?, ?, ?)
        `, [solicitud_id, usuario_id, 'Recordatorio', nota || '', id]);

        // Recalcular el contador real (solicitudes gestionadas, no filas)
        await recalcularGestionadas(id);

        res.json({
            id: recordatorio_id,
            gestion_id: resultGestion.lastInsertRowid,
            mensaje: 'Recordatorio programado correctamente'
        });
    } catch (error) {
        console.error('Error en crearRecordatorio:', error);
        res.status(500).json({ error: 'Error al programar recordatorio' });
    }
}

// PUT /api/gestiones-maestro/:id/recordatorios/:rid/estado
// Marcar un recordatorio como hecho o cancelado.
async function actualizarEstadoRecordatorio(req, res) {
    try {
        const usuario_id = getUsuarioId(req);
        if (!usuario_id) {
            return res.status(401).json({ error: 'No autenticado' });
        }

        const { id, rid } = req.params;
        const { estado } = req.body;

        if (['hecho', 'cancelado'].indexOf(estado) === -1) {
            return res.status(400).json({ error: 'estado debe ser hecho o cancelado' });
        }

        // Acceso a la campaña
        const access = buildGestionAccessWhere(req, id);
        const resultGM = await pool.query(
            'SELECT gm.id FROM gestiones_maestro gm WHERE ' + buildGestionSQL(access),
            access.params
        );
        if (!getFirstRow(resultGM)) {
            return res.status(404).json({ error: 'Campaña no encontrada' });
        }

        const result = await pool.query(`
            UPDATE recordatorios
            SET estado = ?, completed_at = CURRENT_TIMESTAMP
            WHERE id = ? AND gestion_maestro_id = ?
        `, [estado, rid, id]);

        res.json({ mensaje: 'Recordatorio actualizado correctamente' });
    } catch (error) {
        console.error('Error en actualizarEstadoRecordatorio:', error);
        res.status(500).json({ error: 'Error al actualizar recordatorio' });
    }
}

// PUT /api/gestiones-maestro/:id/recordatorios/:rid/posponer
// Reprogramar un recordatorio para una nueva fecha. Vuelve a quedar pendiente
// (notificado = 0) para que el scheduler vuelva a avisar cuando venza.
async function posponerRecordatorio(req, res) {
    try {
        const usuario_id = getUsuarioId(req);
        if (!usuario_id) {
            return res.status(401).json({ error: 'No autenticado' });
        }

        const { id, rid } = req.params;
        const { fecha_recordatorio } = req.body;

        if (!fecha_recordatorio) {
            return res.status(400).json({ error: 'fecha_recordatorio es requerida' });
        }
        const fechaNormalizada = String(fecha_recordatorio).replace('T', ' ').slice(0, 19);
        if (isNaN(new Date(fechaNormalizada.replace(' ', 'T')).getTime())) {
            return res.status(400).json({ error: 'fecha_recordatorio no es válida' });
        }

        // Acceso a la campaña
        const access = buildGestionAccessWhere(req, id);
        const resultGM = await pool.query(
            'SELECT gm.id FROM gestiones_maestro gm WHERE ' + buildGestionSQL(access),
            access.params
        );
        if (!getFirstRow(resultGM)) {
            return res.status(404).json({ error: 'Campaña no encontrada' });
        }

        const result = await pool.query(`
            UPDATE recordatorios
            SET fecha_recordatorio = ?, estado = 'pendiente', notificado = 0, completed_at = NULL
            WHERE id = ? AND gestion_maestro_id = ?
        `, [fechaNormalizada, rid, id]);

        res.json({ mensaje: 'Recordatorio pospuesto correctamente' });
    } catch (error) {
        console.error('Error en posponerRecordatorio:', error);
        res.status(500).json({ error: 'Error al posponer recordatorio' });
    }
}

// GET /api/gestiones-maestro/:id/progreso - Obtener progreso de gestión
async function obtenerProgresoGestion(req, res) {
    try {
        const usuario_id = getUsuarioId(req);
        if (!usuario_id) {
            return res.status(401).json({ error: 'No autenticado' });
        }
        
        const { id } = req.params;
        
        // Obtener gestión maestro con control de acceso
        const access = buildGestionAccessWhere(req, id);
        const sql = 'SELECT gm.* FROM gestiones_maestro gm WHERE ' + buildGestionSQL(access);
        const resultGM = await pool.query(sql, access.params);
        
        const gestion = getFirstRow(resultGM);
        
        if (!gestion) {
            return res.status(404).json({ error: 'Gestión no encontrada' });
        }
        
        // Contar gestiones reales por estado (ya no hay registros 'Pendiente/Por gestionar')
        const resultCount = await pool.query(`
            SELECT tipo_gestion, COUNT(*) as count
            FROM gestiones 
            WHERE gestion_maestro_id = ?
            GROUP BY tipo_gestion
        `, [id]);
        
        const conteo = getRows(resultCount);
        
        // Calcular progreso - todas las gestiones son reales
        const porEstado = {};
        for (const c of conteo) {
            porEstado[c.tipo_gestion] = c.count;
        }

        // Gestionadas = solicitudes distintas con gestión en la campaña (no filas)
        let gestionadas = 0;
        try {
            const resultDistinct = await pool.query(
                'SELECT COUNT(DISTINCT solicitud_id) as count FROM gestiones WHERE gestion_maestro_id = ?',
                [id]
            );
            const distinctRow = getFirstRow(resultDistinct);
            gestionadas = distinctRow ? parseInt(distinctRow.count || 0, 10) : 0;
        } catch (e) {
            console.error('[obtenerProgresoGestion] Error contando gestionadas:', e.message);
        }
        
        res.json({
            id: gestion.id,
            nombre: gestion.nombre,
            total_solicitudes: gestion.total_solicitudes,
            gestionadas: gestionadas,
            pendientes: gestion.total_solicitudes - gestionadas,
            por_estado: porEstado,
            created_at: gestion.created_at,
            updated_at: gestion.updated_at
        });
    } catch (error) {
        console.error('Error en obtenerProgresoGestion:', error);
        res.status(500).json({ error: 'Error al obtener progreso' });
    }
}

// PUT /api/gestiones-maestro/:id/agregar-solicitudes - Agregar solicitudes a una campaña
async function agregarSolicitudesACampana(req, res) {
    try {
        const usuario_id = getUsuarioId(req);
        if (!usuario_id) {
            return res.status(401).json({ error: 'No autenticado' });
        }

        const { id } = req.params;
        let { solicitudes_ids } = req.body;

        solicitudes_ids = normalizarIdsSolicitud(solicitudes_ids);
        if (solicitudes_ids.length === 0) {
            return res.status(400).json({ error: 'Se requiere al menos un ID de solicitud válido' });
        }

        // Obtener la campaña actual con control de acceso
        const access = buildGestionAccessWhere(req, id);
        const checkSql = 'SELECT gm.* FROM gestiones_maestro gm WHERE ' + buildGestionSQL(access);
        const resultGM = await pool.query(checkSql, access.params);

        const gestion = getFirstRow(resultGM);

        if (!gestion) {
            return res.status(404).json({ error: 'Gestión no encontrada' });
        }

        // Parsear IDs existentes (normalizar a números por si están como strings en BD)
        var idsExistentes = [];
        try {
            if (gestion.solicitudes_ids) {
                idsExistentes = JSON.parse(gestion.solicitudes_ids).map(function(id) { return Number(id); });
            }
        } catch (e) {
            console.error('[agregarSolicitudesACampana] Error parseando solicitudes_ids:', e);
        }

        // Normalizar nuevos IDs a números
        var nuevosIds = solicitudes_ids.map(function(id) { return Number(id); });

        // Excluir solicitudes marcadas como "ya no aplica para crédito" (no se pueden agregar a campañas)
        try {
            const placeholdersFlag = nuevosIds.map(function() { return '?'; }).join(',');
            const resultFlag = await pool.query(
                'SELECT id_solicitud FROM solicitudes WHERE no_aplica_credito = 0 AND id_solicitud IN (' + placeholdersFlag + ')',
                nuevosIds
            );
            const flagged = getRows(resultFlag).map(function(r) { return r.id_solicitud; });
            if (flagged.length > 0) {
                return res.status(400).json({
                    error: 'No se pueden agregar solicitudes marcadas como "ya no aplica para crédito"',
                    ids: flagged
                });
            }
        } catch (e) {
            console.error('[agregarSolicitudesACampana] Error verificando no_aplica_credito:', e.message);
        }

        // Agregar nuevos IDs evitando duplicados
        var idsActualizados = [...idsExistentes];
        var agregados = 0;
        var idsRealmenteNuevos = [];
        for (var i = 0; i < nuevosIds.length; i++) {
            var nuevoId = nuevosIds[i];
            if (idsActualizados.indexOf(nuevoId) === -1) {
                idsActualizados.push(nuevoId);
                idsRealmenteNuevos.push(nuevoId);
                agregados++;
            }
        }

        if (agregados === 0) {
            return res.json({ mensaje: 'Las solicitudes ya estaban en la campaña', agregados: 0, total: idsActualizados.length });
        }

        // Guardar los IDs actualizados (primero, para que el recálculo use los ids nuevos)
        const solicitudesIdsJson = JSON.stringify(idsActualizados);
        await pool.query(`
            UPDATE gestiones_maestro 
            SET solicitudes_ids = ?, total_solicitudes = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `, [solicitudesIdsJson, idsActualizados.length, id]);

        // Recalcular gestionadas (solicitudes gestionadas reales, no filas)
        var nuevasGestionadas = await recalcularGestionadas(id);
        if (nuevasGestionadas === null) nuevasGestionadas = gestion.gestionadas || 0;

        // Actualizar campana_id en las solicitudes nuevas
        for (var i = 0; i < idsRealmenteNuevos.length; i++) {
            try {
                await pool.query(
                    'UPDATE solicitudes SET campana_id = ? WHERE id_solicitud = ? AND (campana_id IS NULL OR campana_id != ?)',
                    [id, idsRealmenteNuevos[i], id]
                );
            } catch (e) {
                console.error('[agregarSolicitudesACampana] Error actualizando campana_id:', e);
            }
        }

        // Puente semáforo: solo las realmente nuevas → sin_clasificar
        try {
            await insertarSemaforoSinClasificar(id, idsRealmenteNuevos, usuario_id);
        } catch (e) {
            console.error('[agregarSolicitudesACampana] Error semáforo:', e.message);
        }

        console.log('[agregarSolicitudesACampana] Agregados', agregados, 'solicitudes a campaña', id, 'Total:', idsActualizados.length, 'Gestionadas:', nuevasGestionadas);

        cache.invalidateAllCampanas();

        res.json({
            mensaje: agregados + ' solicitude(s) agregada(s) correctamente',
            agregados: agregados,
            total: idsActualizados.length,
            gestionadas: nuevasGestionadas
        });
    } catch (error) {
        console.error('Error en agregarSolicitudesACampana:', error);
        res.status(500).json({ error: 'Error al agregar solicitudes a la campaña' });
    }
}

// Lógica de BD para quitar una solicitud de una campaña (reutilizable sin contexto HTTP)
// NO elimina gestiones: solo la desvincula de la campaña (usada por quitar-solicitud y por el flag "no aplica crédito")
async function quitarSolicitudDeCampanaDb(gestionId, solicitudIdNum) {
    // Obtener la campaña
    const resultGM = await pool.query('SELECT * FROM gestiones_maestro WHERE id = ?', [gestionId]);
    const gestion = getFirstRow(resultGM);
    if (!gestion) {
        return { error: 'Gestión no encontrada' };
    }

    // Parsear IDs existentes (normalizar a números por si están como strings en BD)
    var idsExistentes = [];
    try {
        if (gestion.solicitudes_ids) {
            idsExistentes = JSON.parse(gestion.solicitudes_ids).map(function(id) { return Number(id); });
        }
    } catch (e) {
        console.error('[quitarSolicitudDeCampanaDb] Error parseando solicitudes_ids:', e);
    }

    // Verificar que la solicitud existe en la campaña
    var index = idsExistentes.indexOf(Number(solicitudIdNum));
    if (index === -1) {
        return { error: 'La solicitud no pertenece a esta campaña' };
    }

    // Quitar el ID
    idsExistentes.splice(index, 1);

    // Guardar los IDs actualizados (primero, para que el recálculo use los ids nuevos)
    const solicitudesIdsJson = JSON.stringify(idsExistentes);
    await pool.query(`
        UPDATE gestiones_maestro 
        SET solicitudes_ids = ?, total_solicitudes = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
    `, [solicitudesIdsJson, idsExistentes.length, gestionId]);

    // Recalcular gestionadas (solicitudes gestionadas reales de la campaña)
    await recalcularGestionadas(gestionId);

    // Limpiar campana_id de la solicitud quitada
    try {
        await pool.query(
            'UPDATE solicitudes SET campana_id = NULL WHERE id_solicitud = ? AND campana_id = ?',
            [solicitudIdNum, gestionId]
        );
    } catch (e) {
        console.error('[quitarSolicitudDeCampanaDb] Error limpiando campana_id:', e);
    }

    // Quitar del puente semáforo
    try {
        await eliminarSemaforoSolicitudes(gestionId, [Number(solicitudIdNum)]);
    } catch (e) {
        console.error('[quitarSolicitudDeCampanaDb] Error semáforo:', e.message);
    }

    return { ok: true, total: idsExistentes.length };
}

// PUT /api/gestiones-maestro/:id/quitar-solicitud - Quitar una solicitud de una campaña
async function quitarSolicitudDeCampana(req, res) {
    try {
        const usuario_id = getUsuarioId(req);
        if (!usuario_id) {
            return res.status(401).json({ error: 'No autenticado' });
        }

        const { id } = req.params;
        const { solicitud_id } = req.body;

        if (!solicitud_id) {
            return res.status(400).json({ error: 'solicitud_id es requerido' });
        }

        // Obtener la campaña actual con control de acceso
        const access = buildGestionAccessWhere(req, id);
        const checkSql = 'SELECT gm.* FROM gestiones_maestro gm WHERE ' + buildGestionSQL(access);
        const resultGM = await pool.query(checkSql, access.params);

        const gestion = getFirstRow(resultGM);

        if (!gestion) {
            return res.status(404).json({ error: 'Gestión no encontrada' });
        }

        const resultado = await quitarSolicitudDeCampanaDb(id, Number(solicitud_id));
        if (resultado.error) {
            return res.status(400).json({ error: resultado.error });
        }

        console.log('[quitarSolicitudDeCampana] Quitada solicitud', solicitud_id, 'de campaña', id, 'Total:', resultado.total);

        cache.invalidateAllCampanas();

        res.json({
            mensaje: 'Solicitud quitada correctamente',
            total: resultado.total
        });
    } catch (error) {
        console.error('Error en quitarSolicitudDeCampana:', error);
        res.status(500).json({ error: 'Error al quitar solicitud de la campaña' });
    }
}

// ============================================================================
// FLAG "YA NO APLICA PARA CRÉDITO" (contexto campaña)
// ============================================================================
// PUT /api/gestiones-maestro/:id/solicitudes/:solicitudId/no-aplica-credito
// no_aplica_credito = 1 → aplica (default) | 0 → ya no aplica
// Al marcar (0), la solicitud SALE de la campaña (las gestiones se conservan).
// Al desmarcar (1), NO vuelve a ninguna campaña automáticamente.
async function marcarNoAplicaCreditoSolicitud(req, res) {
    try {
        const usuario_id = getUsuarioId(req);
        if (!usuario_id) {
            return res.status(401).json({ error: 'No autenticado' });
        }

        const { id, solicitudId } = req.params;
        const nuevoValor = Number(req.body && req.body.no_aplica_credito);
        if (nuevoValor !== 0 && nuevoValor !== 1) {
            return res.status(400).json({ error: 'El campo no_aplica_credito debe ser 0 o 1' });
        }
        const solicitudIdNum = Number(solicitudId);
        if (!solicitudIdNum || isNaN(solicitudIdNum)) {
            return res.status(400).json({ error: 'solicitudId inválido' });
        }

        // Verificar que la campaña existe y el usuario tiene acceso
        const access = buildGestionAccessWhere(req, id);
        const checkSql = 'SELECT gm.id FROM gestiones_maestro gm WHERE ' + buildGestionSQL(access);
        const resultGM = await pool.query(checkSql, access.params);
        const gestion = getFirstRow(resultGM);
        if (!gestion) {
            return res.status(404).json({ error: 'Gestión no encontrada' });
        }

        // Estado actual de la solicitud
        const solResult = await pool.query(
            'SELECT id_solicitud, no_aplica_credito FROM solicitudes WHERE id_solicitud = ?',
            [solicitudIdNum]
        );
        const sol = getFirstRow(solResult);
        if (!sol) {
            return res.status(404).json({ error: 'Solicitud no encontrada' });
        }
        const valorAnterior = sol.no_aplica_credito == null ? 1 : Number(sol.no_aplica_credito);

        let removidaDeCampana = false;

        // Setear el flag primero (dato primario)
        if (valorAnterior !== nuevoValor) {
            await pool.query(
                'UPDATE solicitudes SET no_aplica_credito = ?, fecha_actualizacion = CURRENT_TIMESTAMP WHERE id_solicitud = ?',
                [nuevoValor, solicitudIdNum]
            );

            // Auditoría
            try {
                await pool.query(
                    'INSERT INTO historial_actualizaciones (solicitud_id, usuario_id, campo, valor_anterior, valor_nuevo) VALUES (?, ?, ?, ?, ?)',
                    [solicitudIdNum, usuario_id, 'no_aplica_credito', String(valorAnterior), String(nuevoValor)]
                );
            } catch (e) {
                console.error('[marcarNoAplicaCreditoSolicitud] Error guardando auditoría:', e.message);
            }
        }

        // Al marcar (0): quitar la solicitud de esta campaña
        if (nuevoValor === 0) {
            const resQuitar = await quitarSolicitudDeCampanaDb(id, solicitudIdNum);
            if (resQuitar.error) {
                console.log('[marcarNoAplicaCreditoSolicitud] La solicitud no estaba en la campaña:', resQuitar.error);
            } else {
                removidaDeCampana = true;
            }
        }

        res.json({
            mensaje: nuevoValor === 0
                ? 'Solicitud marcada como "ya no aplica para crédito"'
                : 'Solicitud restaurada: aplica para crédito',
            id_solicitud: solicitudIdNum,
            no_aplica_credito: nuevoValor,
            removida_de_campana: removidaDeCampana
        });
    } catch (error) {
        console.error('Error en marcarNoAplicaCreditoSolicitud:', error);
        res.status(500).json({ error: 'Error al actualizar el flag de crédito' });
    }
}


// ============================================================================
// ASIGNAR CAMPAÑA A AGENTE
// ============================================================================
// PUT /api/gestiones-maestro/:id/asignar-agente
async function asignarAgenteACampana(req, res) {
    try {
        const usuario_id = getUsuarioId(req);
        if (!usuario_id) {
            return res.status(401).json({ error: 'No autenticado' });
        }
        
        const { id } = req.params;
        const { agente_id } = req.body;
        
        if (!agente_id) {
            return res.status(400).json({ error: 'agente_id es requerido' });
        }
        
        const user = req.session.usuario;
        
        // Verificar que la campaña existe y el usuario tiene acceso
        const access = buildGestionAccessWhere(req, id);
        const checkSql = 'SELECT gm.* FROM gestiones_maestro gm WHERE ' + buildGestionSQL(access);
        const resultGM = await pool.query(checkSql, access.params);
        
        const gestion = getFirstRow(resultGM);
        
        if (!gestion) {
            return res.status(404).json({ error: 'Gestión no encontrada' });
        }
        
        console.log('[asignarAgenteACampana] Campaña encontrada, equipo_id:', gestion.equipo_id, 'Usuario equipo_id:', user.equipo_id);
        
        // Si no es superadmin, validar que el usuario es líder o admin del equipo de la campaña
        if (user.rol !== 'superadmin' && user.rol !== 'admin') {
            if (!user.es_lider) {
                return res.status(403).json({ error: 'Solo el líder puede asignar campañas a agentes' });
            }
            if (gestion.equipo_id !== user.equipo_id) {
                return res.status(403).json({ error: 'No puedes asignar campañas que no pertenecen a tu equipo' });
            }
        }
        
        // Validar que el agente pertenece al mismo equipo que la campaña
        const checkAgente = await pool.query(
            'SELECT u.id, u.username FROM usuarios u INNER JOIN equipo_usuarios eu ON u.id = eu.usuario_id WHERE u.id = ? AND eu.equipo_id = ? AND eu.fecha_salida IS NULL AND es_lider = 0',
            [agente_id, gestion.equipo_id]
        );
        
        const agente = getFirstRow(checkAgente);
        
        if (!agente) {
            return res.status(400).json({ error: 'El agente no pertenece al equipo de esta campaña o no es un agente válido' });
        }
        
        // Asignar la campaña al agente
        await pool.query(
            'UPDATE gestiones_maestro SET asignado_a = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [agente_id, id]
        );
        
        console.log('[asignarAgenteACampana] Campaña', id, 'asignada al agente', agente_id);

        cache.invalidateAllCampanas();
        
        res.json({ 
            mensaje: 'Campaña asignada al agente correctamente',
            agente: { id: agente.id, username: agente.username },
            campaña_id: parseInt(id)
        });
    } catch (error) {
        console.error('Error en asignarAgenteACampana:', error);
        res.status(500).json({ error: 'Error al asignar agente a la campaña' });
    }
}

// ============================================================================
// QUITAR ASIGNACIÓN DE AGENTE
// ============================================================================
// PUT /api/gestiones-maestro/:id/quitar-asignacion
async function quitarAsignacionAgente(req, res) {
    try {
        const usuario_id = getUsuarioId(req);
        if (!usuario_id) {
            return res.status(401).json({ error: 'No autenticado' });
        }
        
        const { id } = req.params;
        const user = req.session.usuario;
        
        // Verificar acceso a la campaña
        const access = buildGestionAccessWhere(req, id);
        const checkSql = 'SELECT gm.* FROM gestiones_maestro gm WHERE ' + buildGestionSQL(access);
        const resultGM = await pool.query(checkSql, access.params);
        
        const gestion = getFirstRow(resultGM);
        
        if (!gestion) {
            return res.status(404).json({ error: 'Gestión no encontrada' });
        }
        
        // Solo líder/admin/superadmin pueden quitar asignación
        if (user.rol !== 'superadmin' && user.rol !== 'admin' && !user.es_lider) {
            return res.status(403).json({ error: 'No tienes permiso para quitar asignaciones' });
        }
        
        await pool.query(
            'UPDATE gestiones_maestro SET asignado_a = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [id]
        );
        
        cache.invalidateAllCampanas();
        res.json({ mensaje: 'Asignación de agente removida correctamente', campaña_id: parseInt(id) });
    } catch (error) {
        console.error('Error en quitarAsignacionAgente:', error);
        res.status(500).json({ error: 'Error al quitar asignación' });
    }
}

// PUT /api/gestiones-maestro/:id/solicitudes/:solicitudId/semaforo
async function actualizarSemaforoSolicitud(req, res) {
    try {
        const usuario_id = getUsuarioId(req);
        if (!usuario_id) {
            return res.status(401).json({ error: 'No autenticado' });
        }

        const { id, solicitudId } = req.params;
        const semaforo = req.body && req.body.semaforo ? String(req.body.semaforo).trim() : '';

        if (SEMAFORO_VALIDOS.indexOf(semaforo) === -1) {
            return res.status(400).json({
                error: 'semaforo inválido',
                valores: SEMAFORO_VALIDOS
            });
        }

        const solicitudIdNum = Number(solicitudId);
        if (!solicitudIdNum || isNaN(solicitudIdNum)) {
            return res.status(400).json({ error: 'solicitudId inválido' });
        }

        const access = buildGestionAccessWhere(req, id);
        const checkSql = 'SELECT gm.* FROM gestiones_maestro gm WHERE ' + buildGestionSQL(access);
        const resultGM = await pool.query(checkSql, access.params);
        const gestion = getFirstRow(resultGM);

        if (!gestion) {
            return res.status(404).json({ error: 'Gestión no encontrada' });
        }

        var idsExistentes = [];
        try {
            if (gestion.solicitudes_ids) {
                idsExistentes = normalizarIdsSolicitud(JSON.parse(gestion.solicitudes_ids));
            }
        } catch (e) {
            console.error('[actualizarSemaforoSolicitud] parse solicitudes_ids:', e.message);
        }

        if (idsExistentes.indexOf(solicitudIdNum) === -1) {
            return res.status(400).json({ error: 'La solicitud no pertenece a esta campaña' });
        }

        // Upsert: si no hay fila puente, crear; si hay, actualizar
        var existing = await pool.query(
            'SELECT id FROM gestiones_maestro_solicitudes WHERE gestion_maestro_id = ? AND id_solicitud = ?',
            [id, solicitudIdNum]
        );
        var row = getFirstRow(existing);

        if (row) {
            await pool.query(
                `UPDATE gestiones_maestro_solicitudes
                 SET semaforo = ?, updated_at = CURRENT_TIMESTAMP, updated_by = ?
                 WHERE gestion_maestro_id = ? AND id_solicitud = ?`,
                [semaforo, usuario_id, id, solicitudIdNum]
            );
        } else {
            await pool.query(
                `INSERT INTO gestiones_maestro_solicitudes (gestion_maestro_id, id_solicitud, semaforo, updated_by)
                 VALUES (?, ?, ?, ?)`,
                [id, solicitudIdNum, semaforo, usuario_id]
            );
        }

        const semaforo_conteos = await obtenerConteoSemaforo(id);

        cache.invalidateAllCampanas();

        res.json({
            mensaje: 'Semáforo actualizado',
            id_solicitud: solicitudIdNum,
            semaforo: semaforo,
            semaforo_conteos: semaforo_conteos
        });
    } catch (error) {
        console.error('Error en actualizarSemaforoSolicitud:', error);
        res.status(500).json({ error: 'Error al actualizar semáforo' });
    }
}


// GET /api/gestiones-maestro/recordatorios?desde=&hasta=&estado=
// Lista recordatorios de campañas accesibles en un rango de fechas (calendario).
async function listarRecordatorios(req, res) {
    try {
        const usuario_id = getUsuarioId(req);
        if (!usuario_id) {
            return res.status(401).json({ error: 'No autenticado' });
        }

        const { desde = '', hasta = '', estado = 'pendiente' } = req.query;
        if (!desde || !hasta) {
            return res.status(400).json({ error: 'desde y hasta son requeridos (YYYY-MM-DD)' });
        }

        const access = buildGestionAccessWhere(req, null);
        const accessSql = buildGestionSQL(access);

        let estadoSql = '';
        const params = access.params.slice();
        // fechas naive: inclusive day range
        params.push(String(desde).slice(0, 10) + ' 00:00:00');
        params.push(String(hasta).slice(0, 10) + ' 23:59:59');

        if (estado && estado !== 'todos') {
            estadoSql = ' AND r.estado = ?';
            params.push(estado);
        }

        const sql = `
            SELECT r.id, r.solicitud_id, r.gestion_maestro_id, r.usuario_id, r.canal,
                   r.fecha_recordatorio, r.nota, r.estado, r.notificado, r.created_at, r.completed_at,
                   s.nombre AS cliente_nombre, s.cedula AS cliente_cedula, s.celular AS cliente_celular,
                   gm.nombre AS nombre_campana,
                   u.username AS creador_username
            FROM recordatorios r
            INNER JOIN gestiones_maestro gm ON gm.id = r.gestion_maestro_id
            LEFT JOIN solicitudes s ON s.id_solicitud = r.solicitud_id
            LEFT JOIN usuarios u ON u.id = r.usuario_id
            WHERE (${accessSql})
              AND r.fecha_recordatorio >= ?
              AND r.fecha_recordatorio <= ?
              ${estadoSql}
            ORDER BY r.fecha_recordatorio ASC, r.id ASC
        `;

        const result = await pool.query(sql, params);
        const rows = result.rows || [];
        // Normalizar fechas naive (Postgres Date objects)
        for (let i = 0; i < rows.length; i++) {
            if (rows[i].fecha_recordatorio && typeof naiveDateString === 'function') {
                rows[i].fecha_recordatorio = naiveDateString(rows[i].fecha_recordatorio);
            }
        }
        res.json({ data: rows, total: rows.length });
    } catch (error) {
        console.error('Error en listarRecordatorios:', error);
        res.status(500).json({ error: 'Error al listar recordatorios' });
    }
}

// ============================================================================
// CREAR CAMPAÑA "ASIGNADA POR EL SISTEMA" (superadmin vía /api/admin/campanas)
// ============================================================================
// Crea una campaña para un usuario destino con equipo_id = NULL para que el
// líder de su equipo NO la vea (todos los listados de equipo filtran por
// equipo_id). es_sistema = 1 permite mostrarla como "Asignada por el sistema".
async function crearCampanaSistema(req, res) {
    try {
        const { usuario_id, nombre, descripcion, fecha_limite, solicitudes_ids } = req.body;

        if (!usuario_id) {
            return res.status(400).json({ error: 'El usuario destino es requerido' });
        }
        if (!nombre || !String(nombre).trim()) {
            return res.status(400).json({ error: 'El nombre es requerido' });
        }
        const ids = normalizarIdsSolicitud(solicitudes_ids);
        if (ids.length === 0) {
            return res.status(400).json({ error: 'Se requiere al menos una solicitud' });
        }

        // Verificar que el usuario destino existe y está activo
        const checkUser = await pool.query(
            'SELECT id, username, is_active FROM usuarios WHERE id = ?',
            [parseInt(usuario_id)]
        );
        const destino = getFirstRow(checkUser);
        if (!destino) {
            return res.status(404).json({ error: 'El usuario destino no existe' });
        }
        if (!destino.is_active) {
            return res.status(400).json({ error: 'El usuario destino está inactivo' });
        }

        const solicitudesIdsJson = JSON.stringify(ids);

        const resultGM = await pool.query(`
            INSERT INTO gestiones_maestro (nombre, descripcion, usuario_id, equipo_id, es_sistema, total_solicitudes, gestionadas, fecha_limite, solicitudes_ids, asignado_a)
            VALUES (?, ?, ?, NULL, 1, ?, 0, ?, ?, NULL)
        `, [String(nombre).trim(), descripcion || '', destino.id, ids.length, fecha_limite || null, solicitudesIdsJson]);

        const gestion_id = resultGM.lastInsertRowid;

        // Puente semáforo (todas entran como sin_clasificar)
        try {
            await insertarSemaforoSinClasificar(gestion_id, ids, req.session.usuario.id);
        } catch (e) {
            console.error('[crearCampanaSistema] Error insertando semáforo:', e.message);
        }

        // Vincular solicitudes a la campaña (consistencia con el listado admin)
        try {
            const placeholders = ids.map(function() { return '?'; }).join(',');
            await pool.query(
                `UPDATE solicitudes SET campana_id = ? WHERE id_solicitud IN (` + placeholders + `)`,
                [gestion_id].concat(ids)
            );
        } catch (e) {
            console.error('[crearCampanaSistema] Error actualizando campana_id:', e.message);
        }

        cache.invalidateAllCampanas();

        res.json({
            id: gestion_id,
            mensaje: 'Campaña asignada por el sistema creada correctamente',
            total_solicitudes: ids.length
        });
    } catch (error) {
        console.error('[crearCampanaSistema] Error:', error);
        res.status(500).json({ error: 'Error al crear la campaña del sistema', detalle: error.message });
    }
}

// ============================================================================
// HELPER: Crear una notificación e emitirla por SSE a un usuario
// (mismo patrón que liberacionScheduler / notificaciones.controller)
// ============================================================================
async function crearYNotificar({ destinatarioId, titulo, mensaje, tipo = 'info', prioridad = 'normal', accionUrl = null, accionModulo = null, accionTexto = null, creadorId = null }) {
    const ins = await pool.query(
        `INSERT INTO notificaciones (titulo, mensaje, tipo, prioridad, creador_id, destinatario_id, accion_url, accion_texto, accion_modulo, es_novedad, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, CURRENT_TIMESTAMP)`,
        [titulo, mensaje, tipo, prioridad, creadorId || null, destinatarioId, accionUrl || null, accionTexto || null, accionModulo || null]
    );
    const newId = ins.rows?.[0]?.id || ins.lastInsertRowid;

    const notificacion = {
        id: newId,
        titulo: titulo,
        mensaje: mensaje,
        tipo: tipo,
        prioridad: prioridad,
        destinatario_id: destinatarioId,
        accion_url: accionUrl || null,
        accion_texto: accionTexto || null,
        accion_modulo: accionModulo || null,
        es_novedad: 0,
        fecha_expiracion: null,
        leida: 0,
        recordatorio_id: null,
        creador_username: null,
        created_at: new Date().toISOString()
    };
    try {
        notificationBus.emitir('notification.created', notificacion, destinatarioId);
        notificationBus.emitirAUsuario('count.updated', { no_leidas: null }, destinatarioId);
        // Push web (si el usuario tiene suscripciones activas; fire-and-forget)
        pushService.enviarPushDesdeNotificacion(notificacion);
    } catch (e) {
        console.error('[EnviarSolicitudes] Error SSE:', e.message);
    }
    return newId;
}

// ============================================================================
// ENVIAR SOLICITUDES A UN AGENTE CON LÍDER (agente sin líder → agente con líder)
// ============================================================================
// POST /api/gestiones-maestro/enviar-solicitudes
// Body: { destino_id, solicitudes_ids: [], comentario? }
// - Crea una campaña tripartita (remitente + destino + líder del destino).
// - Inserta una fila por solicitud en envios_solicitudes (trazabilidad).
// - Notifica al destino y al líder de su equipo.
async function enviarSolicitudes(req, res) {
    try {
        const usuario_id = getUsuarioId(req);
        if (!usuario_id) {
            return res.status(401).json({ error: 'No autenticado' });
        }
        const user = req.session.usuario;

        const { destino_id, solicitudes_ids, comentario } = req.body;
        const destinoNum = Number(destino_id);
        const ids = normalizarIdsSolicitud(solicitudes_ids);

        if (!destinoNum || ids.length === 0) {
            return res.status(400).json({ error: 'destino_id y al menos una solicitud son requeridos' });
        }
        if (destinoNum === usuario_id) {
            return res.status(400).json({ error: 'No puedes enviarte solicitudes a ti mismo' });
        }

        // El remitente debe ser un agente SIN líder (no superadmin, no lider,
        // y no debe pertenecer a un equipo con líder).
        if (user.rol === 'superadmin') {
            return res.status(403).json({ error: 'Un superadmin no puede enviar solicitudes' });
        }
        const remTieneLider = await pool.query(
            `SELECT 1 FROM equipo_usuarios eu
             WHERE eu.usuario_id = ? AND eu.fecha_salida IS NULL
               AND EXISTS (
                   SELECT 1 FROM equipo_usuarios eu4
                   INNER JOIN equipos e4 ON e4.id = eu4.equipo_id
                   INNER JOIN usuarios ul ON ul.id = eu4.usuario_id
                   WHERE eu4.equipo_id = eu.equipo_id AND eu4.fecha_salida IS NULL AND eu4.es_lider = 1
                     AND ul.is_active = TRUE
                     AND e4.nombre != 'Sistema'
               )
             LIMIT 1`,
            [usuario_id]
        );
        if (getFirstRow(remTieneLider)) {
            return res.status(403).json({ error: 'Solo los agentes sin líder pueden enviar solicitudes' });
        }

        // El destino debe ser un agente (es_lider=0) que pertenezca a un equipo con líder
        const destResult = await pool.query(
            `SELECT u.id, u.nombre, u.username, u.is_active,
                    e.id as equipo_id, e.nombre as equipo_nombre,
                    (SELECT eu3.usuario_id FROM equipo_usuarios eu3
                     INNER JOIN usuarios ul ON ul.id = eu3.usuario_id
                     WHERE eu3.equipo_id = eu.equipo_id AND eu3.fecha_salida IS NULL AND eu3.es_lider = 1
                       AND ul.is_active = TRUE
                     ORDER BY eu3.id ASC LIMIT 1) as lider_id
             FROM equipo_usuarios eu
             INNER JOIN usuarios u ON eu.usuario_id = u.id
             INNER JOIN equipos e ON eu.equipo_id = e.id
             WHERE eu.usuario_id = ? AND eu.fecha_salida IS NULL AND eu.es_lider = 0
               AND u.rol = 'agente' AND e.nombre != 'Sistema'`,
            [destinoNum]
        );
        const destino = getFirstRow(destResult);
        if (!destino || !destino.lider_id) {
            return res.status(400).json({ error: 'El destino debe ser un agente que tenga líder' });
        }
        if (!destino.is_active) {
            return res.status(400).json({ error: 'El agente destino está inactivo' });
        }

        // Obtener datos del remitente para el nombre de la campaña
        const remitRes = await pool.query('SELECT id, nombre, username FROM usuarios WHERE id = ?', [usuario_id]);
        const remitente = getFirstRow(remitRes) || { nombre: 'Agente' };

        // ================================================================
        // 1. Crear la campaña tripartita
        // ================================================================
        const nombreCampana = 'Envío de ' + (remitente.nombre || remitente.username) + ' → ' + (destino.nombre || destino.username);
        const solicitudesIdsJson = JSON.stringify(ids);

        const resultGM = await pool.query(
            `INSERT INTO gestiones_maestro (nombre, descripcion, usuario_id, equipo_id, estado, total_solicitudes, gestionadas, solicitudes_ids, asignado_a)
             VALUES (?, ?, ?, ?, 'activa', ?, 0, ?, ?)`,
            [nombreCampana, (comentario || 'Solicitud enviada por ' + (remitente.nombre || remitente.username)), usuario_id, destino.equipo_id, ids.length, solicitudesIdsJson, destinoNum]
        );
        const campanaId = resultGM.rows?.[0]?.id || resultGM.lastInsertRowid;

        // Puente semáforo (todas sin_clasificar)
        try {
            await insertarSemaforoSinClasificar(campanaId, ids, usuario_id);
        } catch (e) {
            console.error('[enviarSolicitudes] Error semáforo:', e.message);
        }

        // Vincular campana_id en las solicitudes
        for (const sid of ids) {
            try {
                await pool.query(
                    'UPDATE solicitudes SET campana_id = ? WHERE id_solicitud = ? AND (campana_id IS NULL OR campana_id != ?)',
                    [campanaId, sid, campanaId]
                );
            } catch (e) {
                console.error('[enviarSolicitudes] Error vinculando campana_id ' + sid + ':', e.message);
            }
        }

        // ================================================================
        // 2. Trazabilidad: una fila por solicitud en envios_solicitudes
        // ================================================================
        for (const sid of ids) {
            try {
                await pool.query(
                    `INSERT INTO envios_solicitudes (solicitud_id, remitente_id, destino_id, comentario, equipo_id, campana_id)
                     VALUES (?, ?, ?, ?, ?, ?)`,
                    [sid, usuario_id, destinoNum, comentario || null, destino.equipo_id, campanaId]
                );
            } catch (e) {
                console.error('[enviarSolicitudes] Error insertando envio ' + sid + ':', e.message);
            }
        }

        // ================================================================
        // 3. Invalidar caché
        // ================================================================
        try { cache.invalidateAllCampanas(); } catch (e) { /* silencioso */ }
        try { cache.invalidateDashboard(destinoNum); } catch (e) { /* silencioso */ }

        // ================================================================
        // 4. Notificaciones (destino + líder de su equipo)
        // ================================================================
        const accionUrl = '/gestion-lote?id=' + campanaId;
        const accionModulo = 'gestion-lote';
        const accionTexto = 'Ver campaña';

        // Al agente destino
        await crearYNotificar({
            destinatarioId: destinoNum,
            titulo: '📥 Recibiste ' + ids.length + ' solicitud(es)',
            mensaje: (remitente.nombre || remitente.username) + ' te envió ' + ids.length
                + ' solicitud(es) para gestionar. Revisa la campaña para comenzar.',
            tipo: 'info', prioridad: 'alta',
            accionUrl, accionModulo, accionTexto, creadorId: usuario_id
        });

        // Al líder del equipo del destino
        if (destino.lider_id) {
            await crearYNotificar({
                destinatarioId: destino.lider_id,
                titulo: '📋 Tu agente ' + (destino.nombre || destino.username) + ' recibió ' + ids.length + ' solicitud(es)',
                mensaje: (remitente.nombre || remitente.username) + ' envió ' + ids.length
                    + ' solicitud(es) a tu agente ' + (destino.nombre || destino.username) + '. Puedes gestionarlas o reasignarlas desde la campaña.',
                tipo: 'info', prioridad: 'normal',
                accionUrl, accionModulo, accionTexto, creadorId: usuario_id
            });
        }

        // Auditoría
        try {
            await pool.query(
                `INSERT INTO audit_log (usuario_id, accion, target_type, target_id, detalle, ip_address, created_at)
                 VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
                [usuario_id, 'solicitud.enviada', 'campana', campanaId,
                 JSON.stringify({ destino_id: destinoNum, equipo_id: destino.equipo_id, cantidad: ids.length }),
                 req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip]
            );
        } catch (e) { /* ignora error de auditoría */ }

        res.status(201).json({
            id: campanaId,
            mensaje: ids.length + ' solicitud(es) enviada(s) a ' + (destino.nombre || destino.username),
            total: ids.length
        });
    } catch (error) {
        console.error('Error en enviarSolicitudes:', error);
        res.status(500).json({ error: 'Error al enviar solicitudes', detalle: error.message });
    }
}

// ============================================================================
// REASIGNAR AGENTE DE UNA CAMPAÑA (líder del equipo de la campaña)
// ============================================================================
// POST /api/gestiones-maestro/:id/reasignar-agente
// Body: { nuevo_agente_id }
// - Solo el líder del equipo de la campaña (o superadmin/admin) puede reasignar.
// - El nuevo agente debe pertenecer al mismo equipo.
// - Actualiza gestiones_maestro.asignado_a y la traza en envios_solicitudes
//   (conserva destino_id original, registra nuevo_destino_id).
// - Notifica al remitente, al destino original y al nuevo destino.
async function reasignarAgente(req, res) {
    try {
        const usuario_id = getUsuarioId(req);
        if (!usuario_id) {
            return res.status(401).json({ error: 'No autenticado' });
        }
        const user = req.session.usuario;

        const { id } = req.params;
        const { nuevo_agente_id } = req.body;
        const nuevoAgenteNum = Number(nuevo_agente_id);

        if (!nuevoAgenteNum) {
            return res.status(400).json({ error: 'nuevo_agente_id es requerido' });
        }

        // Acceso a la campaña y obtener equipo + remitente
        const access = buildGestionAccessWhere(req, id);
        const checkSql = 'SELECT gm.* FROM gestiones_maestro gm WHERE ' + buildGestionSQL(access);
        const resultGM = await pool.query(checkSql, access.params);
        const gestion = getFirstRow(resultGM);

        if (!gestion) {
            return res.status(404).json({ error: 'Gestión no encontrada' });
        }

        // Solo líder del equipo (o superadmin/admin) reasigna
        if (user.rol !== 'superadmin' && user.rol !== 'admin') {
            if (!user.es_lider) {
                return res.status(403).json({ error: 'Solo el líder puede reasignar campañas' });
            }
            if (gestion.equipo_id !== user.equipo_id) {
                return res.status(403).json({ error: 'No puedes reasignar campañas que no pertenecen a tu equipo' });
            }
        }

        // El nuevo agente debe pertenecer al mismo equipo que la campaña
        const checkAgente = await pool.query(
            'SELECT u.id, u.nombre, u.username FROM usuarios u INNER JOIN equipo_usuarios eu ON u.id = eu.usuario_id WHERE u.id = ? AND eu.equipo_id = ? AND eu.fecha_salida IS NULL AND es_lider = 0',
            [nuevoAgenteNum, gestion.equipo_id]
        );
        const nuevoAgente = getFirstRow(checkAgente);
        if (!nuevoAgente) {
            return res.status(400).json({ error: 'El nuevo agente no pertenece al equipo de esta campaña o no es un agente válido' });
        }

        const destinoAnteriorNum = gestion.asignado_a ? Number(gestion.asignado_a) : null;

        // Actualizar asignado_a de la campaña
        await pool.query(
            'UPDATE gestiones_maestro SET asignado_a = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [nuevoAgenteNum, id]
        );

        // Trazabilidad: conservar destino original (destino_id) y registrar nuevo_destino_id
        try {
            await pool.query(
                `UPDATE envios_solicitudes
                 SET reasignada = 1, nuevo_destino_id = ?, reasignada_por = ?, fecha_reasignacion = CURRENT_TIMESTAMP
                 WHERE campana_id = ? AND reasignada = 0`,
                [nuevoAgenteNum, usuario_id, Number(id)]
            );
        } catch (e) {
            console.error('[reasignarAgente] Error actualizando envios_solicitudes:', e.message);
        }

        cache.invalidateAllCampanas();

        // ================================================================
        // Notificaciones: remitente + destino original + nuevo destino
        // ================================================================
        const accionUrl = '/gestion-lote?id=' + id;
        const accionModulo = 'gestion-lote';
        const accionTexto = 'Ver campaña';

        const remitenteNombre = null;
        let remitenteId = null;
        try {
            const r = await pool.query('SELECT id, nombre FROM usuarios WHERE id = ?', [gestion.usuario_id]);
            const rr = getFirstRow(r);
            if (rr) { remitenteId = rr.id; remitenteNombre = rr.nombre; }
        } catch (e) { /* silencioso */ }

        const nombreLider = user.nombre || user.username;

        // Al remitente (agente sin líder)
        if (remitenteId && remitenteId !== nuevoAgenteNum) {
            const nombreDestinoAnterior = destinoAnteriorNum ? (await obtenerNombreUsuario(destinoAnteriorNum)) : 'un agente';
            await crearYNotificar({
                destinatarioId: remitenteId,
                titulo: '🔄 Tu solicitud fue reasignada',
                mensaje: 'El líder ' + nombreLider + ' reasignó tu solicitud de ' + nombreDestinoAnterior
                    + ' a ' + (nuevoAgente.nombre || nuevoAgente.username) + '.',
                tipo: 'info', prioridad: 'normal',
                accionUrl, accionModulo, accionTexto, creadorId: usuario_id
            });
        }

        // Al destino original
        if (destinoAnteriorNum && destinoAnteriorNum !== nuevoAgenteNum) {
            await crearYNotificar({
                destinatarioId: destinoAnteriorNum,
                titulo: '🔄 Solicitud reasignada',
                mensaje: 'El líder ' + nombreLider + ' reasignó a ' + (nuevoAgente.nombre || nuevoAgente.username)
                    + ' la solicitud que habías recibido.',
                tipo: 'info', prioridad: 'normal',
                accionUrl, accionModulo, accionTexto, creadorId: usuario_id
            });
        }

        // Al nuevo destino
        await crearYNotificar({
            destinatarioId: nuevoAgenteNum,
            titulo: '📥 Recibiste una solicitud reasignada',
            mensaje: 'El líder ' + nombreLider + ' te asignó la solicitud de la campaña. Revisa la campaña para gestionarla.',
            tipo: 'info', prioridad: 'normal',
            accionUrl, accionModulo, accionTexto, creadorId: usuario_id
        });

        // Auditoría
        try {
            await pool.query(
                `INSERT INTO audit_log (usuario_id, accion, target_type, target_id, detalle, ip_address, created_at)
                 VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
                [usuario_id, 'solicitud.reasignada', 'campana', Number(id),
                 JSON.stringify({ anterior: destinoAnteriorNum, nuevo: nuevoAgenteNum }),
                 req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip]
            );
        } catch (e) { /* ignora error de auditoría */ }

        res.json({
            mensaje: 'Solicitud reasignada a ' + (nuevoAgente.nombre || nuevoAgente.username),
            nuevo_agente_id: nuevoAgenteNum,
            campaña_id: parseInt(id)
        });
    } catch (error) {
        console.error('Error en reasignarAgente:', error);
        res.status(500).json({ error: 'Error al reasignar agente', detalle: error.message });
    }
}

// Helper para obtener el nombre de un usuario (con fallback al id)
async function obtenerNombreUsuario(usuarioId) {
    if (!usuarioId) return 'un agente';
    const r = await pool.query('SELECT nombre, username FROM usuarios WHERE id = ?', [usuarioId]);
    const row = getFirstRow(r);
    return (row && (row.nombre || row.username)) || ('agente #' + usuarioId);
}

module.exports = {
    // Aliases en español para compatibilidad con las rutas
    crearGestionMaestro: createGestionMaestro,
    listarGestionesMaestro: getGestionesMaestro,
    obtenerGestionMaestro: getGestionMaestroById,
    actualizarGestionMaestro: updateGestionMaestro,
    eliminarGestionMaestro: deleteGestionMaestro,
    obtenerProgresoGestion: obtenerProgresoGestion,
    agregarSolicitudesACampana: agregarSolicitudesACampana,
    quitarSolicitudDeCampana: quitarSolicitudDeCampana,
    asignarAgenteACampana: asignarAgenteACampana,
    quitarAsignacionAgente: quitarAsignacionAgente,
    actualizarSemaforoSolicitud: actualizarSemaforoSolicitud,
    historialSolicitudCampana: getHistorialSolicitudCampana,
    historialGeneralCampana: getHistorialGeneralCampana,
    destacarSolicitudCampana: destacarSolicitudCampana,
    // Recordatorios de llamadas/mensajes
    crearRecordatorio: crearRecordatorio,
    actualizarEstadoRecordatorio: actualizarEstadoRecordatorio,
    posponerRecordatorio: posponerRecordatorio,
    listarRecordatorios: listarRecordatorios,
    // Flag "ya no aplica para crédito"
    marcarNoAplicaCreditoSolicitud: marcarNoAplicaCreditoSolicitud,
    quitarSolicitudDeCampanaDb: quitarSolicitudDeCampanaDb,
    buildGestionAccessWhere: buildGestionAccessWhere,
    buildGestionSQL: buildGestionSQL,
    recalcularGestionadas: recalcularGestionadas,
    // Aliases en inglés para excel.routes.js
    getGestionesMaestro: getGestionesMaestro,
    getGestionMaestroById: getGestionMaestroById,
    createGestionMaestro: createGestionMaestro,
    updateGestionMaestro: updateGestionMaestro,
    deleteGestionMaestro: deleteGestionMaestro,
    crearCampanaSistema: crearCampanaSistema,
    // Envío de solicitudes a agente con líder (FASE 2)
    enviarSolicitudes: enviarSolicitudes,
    reasignarAgente: reasignarAgente,
    // Helper reutilizable (notificaciones)
    crearYNotificar: crearYNotificar
};
