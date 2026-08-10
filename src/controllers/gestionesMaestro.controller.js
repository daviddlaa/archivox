// Dynamic database - SQLite for local, PostgreSQL for production
const pool = require('../config/db');

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
    var insertados = 0;
    for (var i = 0; i < ids.length; i++) {
        var sid = ids[i];
        try {
            var exists = await pool.query(
                'SELECT id FROM gestiones_maestro_solicitudes WHERE gestion_maestro_id = ? AND id_solicitud = ?',
                [gestionMaestroId, sid]
            );
            if (getFirstRow(exists)) continue;
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
        var result = await pool.query(
            `SELECT gms.semaforo, COUNT(*) as count
             FROM gestiones_maestro_solicitudes gms
             LEFT JOIN gestiones g ON g.id = (
                 SELECT MAX(g2.id) FROM gestiones g2
                 WHERE g2.solicitud_id = gms.id_solicitud
                   AND (g2.gestion_maestro_id = ? OR g2.gestion_maestro_id IS NULL)
             )
             WHERE gms.gestion_maestro_id = ?
               AND COALESCE(g.tipo_gestion, 'Pendiente') <> 'Completada'
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

// GET /api/gestiones-maestro - Listar todas las gestione maestro
async function getGestionesMaestro(req, res) {
    try {
        const usuario_id = getUsuarioId(req);
        if (!usuario_id) {
            return res.status(401).json({ error: 'No autenticado' });
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
        
        res.json(getRows(result));
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
        
        // Obtener solicitudes con su última gestión real + semáforo del puente
        const resultSol = await pool.query(`
            SELECT s.*, 
                   COALESCE(g.tipo_gestion, 'Pendiente') as tipo_gestion,
                   COALESCE(g.observacion, 'Por gestionar') as gestion_obs,
                   g.id as gestion_id,
                   g.fecha_gestion,
                   COALESCE(gms.semaforo, 'sin_clasificar') as semaforo,
                   rec.id as recordatorio_id,
                   rec.canal as recordatorio_canal,
                   rec.fecha_recordatorio as recordatorio_fecha,
                   rec.nota as recordatorio_nota,
                   rec.estado as recordatorio_estado
            FROM solicitudes s
            LEFT JOIN gestiones g ON g.id = (
                SELECT MAX(g2.id) FROM gestiones g2 
                WHERE g2.solicitud_id = s.id_solicitud
                AND (g2.gestion_maestro_id = ? OR g2.gestion_maestro_id IS NULL)
            )
            LEFT JOIN gestiones_maestro_solicitudes gms
                ON gms.gestion_maestro_id = ? AND gms.id_solicitud = s.id_solicitud
            LEFT JOIN recordatorios rec ON rec.id = (
                SELECT MAX(r2.id) FROM recordatorios r2
                WHERE r2.solicitud_id = s.id_solicitud
                AND r2.gestion_maestro_id = ?
                AND r2.estado = 'pendiente'
            )
            WHERE s.id_solicitud IN (${placeholders})
            ORDER BY CASE WHEN g.fecha_gestion IS NULL THEN 0 ELSE 1 END DESC, g.fecha_gestion DESC
        `, [id, id, id].concat(solicitudesIds));
        
        const Solicitudes = getRows(resultSol);
        
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
        
        res.json({
            ...gestion,
            solicitudes: Solicitudes,
            completadas: Solicitudes.filter(function(s) { return s.tipo_gestion === 'Completada'; }).length,
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
            `SELECT id, solicitud_id, tipo_gestion, observacion, fecha_gestion, usuario_id, gestion_maestro_id
             FROM gestiones
             WHERE solicitud_id = ?
               AND (gestion_maestro_id = ? OR gestion_maestro_id IS NULL)
             ORDER BY fecha_gestion DESC`,
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
            ORDER BY g.fecha_gestion DESC
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
        
        const { nombre, descripcion, fecha_limite, solicitudes_ids, agente_id } = req.body;
        console.log('[gestiones-maestro] Datos recibidos:', { nombre, descripcion, fecha_limite, solicitudes_ids: solicitudes_ids?.length, agente_id });
        
        if (!nombre) {
            return res.status(400).json({ error: 'El nombre es requerido' });
        }
        
        if (!solicitudes_ids || !Array.isArray(solicitudes_ids) || solicitudes_ids.length === 0) {
            return res.status(400).json({ error: 'Se requiere al menos una solicitud' });
        }
        
        // Obtener equipo_id de la sesión del usuario
        const user = req.session.usuario;
        const equipo_id = user?.equipo_id || null;
        
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
        
        console.log('[gestiones-maestro] Gestion creada exitosamente, ID:', gestion_id);
        
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
        
        res.json({ mensaje: 'Campaña eliminada correctamente. El historial de gestiones de las solicitudes se conserva.' });
    } catch (error) {
        console.error('Error en deleteGestionMaestro:', error);
        res.status(500).json({ error: 'Error al eliminar gestión' });
    }
}

// POST /api/gestiones - Guardar gestión individual (modificado para aceptar gestion_maestro_id)
async function createGestion(req, res) {
    try {
        const usuario_id = getUsuarioId(req);
        if (!usuario_id) {
            return res.status(401).json({ error: 'No autenticado' });
        }
        
        const { solicitud_id, tipo_gestion, observacion, gestion_maestro_id } = req.body;
        
        if (!solicitud_id) {
            return res.status(400).json({ error: 'solicitud_id es requerido' });
        }
        
        if (!tipo_gestion) {
            return res.status(400).json({ error: 'tipo_gestion es requerido' });
        }
        
        const result = await pool.query(`
            INSERT INTO gestiones (solicitud_id, usuario_id, tipo_gestion, observacion, gestion_maestro_id)
            VALUES (?, ?, ?, ?, ?)
        `, [solicitud_id, usuario_id, tipo_gestion, observacion || '', gestion_maestro_id || null]);
        
        const gestion_id = result.lastInsertRowid;
        
        // Si tiene gestion_maestro_id, actualizar contador
        if (gestion_maestro_id) {
            await pool.query(`
                UPDATE gestiones_maestro 
                SET gestionadas = gestionadas + 1,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `, [gestion_maestro_id]);
        }
        
        res.json({ 
            id: gestion_id, 
            mensaje: 'Gestión guardada correctamente' 
        });
    } catch (error) {
        console.error('Error en createGestion:', error);
        res.status(500).json({ error: 'Error al guardar gestión' });
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

        await pool.query(`
            UPDATE gestiones_maestro
            SET gestionadas = gestionadas + 1,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `, [id]);

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
        let gestionadas = 0;
        
        for (const c of conteo) {
            porEstado[c.tipo_gestion] = c.count;
            gestionadas += parseInt(c.count);
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
        const { solicitudes_ids } = req.body;

        if (!solicitudes_ids || !Array.isArray(solicitudes_ids) || solicitudes_ids.length === 0) {
            return res.status(400).json({ error: 'Se requiere al menos un ID de solicitud' });
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

        // Recalcular gestionadas: contar todas las gestiones reales en la campaña
        var nuevasGestionadas = 0;
        try {
            const resultCount = await pool.query(
                'SELECT COUNT(*) as count FROM gestiones WHERE gestion_maestro_id = ?',
                [id]
            );
            var countRow = Array.isArray(resultCount) ? resultCount[0] : (resultCount.rows ? resultCount.rows[0] : null);
            if (countRow) {
                nuevasGestionadas = parseInt(countRow.count || 0);
            }
        } catch (e) {
            console.error('[agregarSolicitudesACampana] Error contando gestiones:', e);
            nuevasGestionadas = gestion.gestionadas || 0;
        }

        // Guardar los IDs actualizados con las nuevas gestionadas recalculadas
        const solicitudesIdsJson = JSON.stringify(idsActualizados);
        await pool.query(`
            UPDATE gestiones_maestro 
            SET solicitudes_ids = ?, total_solicitudes = ?, gestionadas = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `, [solicitudesIdsJson, idsActualizados.length, nuevasGestionadas, id]);

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

    // Recalcular gestionadas: si la solicitud tenía gestión, restar 1
    var nuevasGestionadas = gestion.gestionadas || 0;
    try {
        const resultCheckGestion = await pool.query(
            'SELECT COUNT(*) as count FROM gestiones WHERE solicitud_id = ? AND gestion_maestro_id = ?',
            [solicitudIdNum, gestionId]
        );
        var checkRow = getFirstRow(resultCheckGestion);
        var count = checkRow ? (checkRow.count || 0) : 0;
        if (count > 0) {
            nuevasGestionadas = Math.max(0, nuevasGestionadas - 1);
        }
    } catch (e) {
        console.error('[quitarSolicitudDeCampanaDb] Error contando gestiones:', e.message);
    }

    // Guardar los IDs actualizados
    const solicitudesIdsJson = JSON.stringify(idsExistentes);
    await pool.query(`
        UPDATE gestiones_maestro 
        SET solicitudes_ids = ?, total_solicitudes = ?, gestionadas = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
    `, [solicitudesIdsJson, idsExistentes.length, nuevasGestionadas, gestionId]);

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
    createGestion: createGestion,
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
    // Flag "ya no aplica para crédito"
    marcarNoAplicaCreditoSolicitud: marcarNoAplicaCreditoSolicitud,
    quitarSolicitudDeCampanaDb: quitarSolicitudDeCampanaDb,
    // Aliases en inglés para excel.routes.js
    getGestionesMaestro: getGestionesMaestro,
    getGestionMaestroById: getGestionMaestroById,
    createGestionMaestro: createGestionMaestro,
    updateGestionMaestro: updateGestionMaestro,
    deleteGestionMaestro: deleteGestionMaestro
};
