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

// GET /api/gestiones-maestro - Listar todas las gestione maestro
async function getGestionesMaestro(req, res) {
    try {
        const usuario_id = getUsuarioId(req);
        if (!usuario_id) {
            return res.status(401).json({ error: 'No autenticado' });
        }
        
        const access = buildGestionAccessWhere(req, null);
        const sql = 'SELECT DISTINCT gm.* FROM gestiones_maestro gm WHERE ' + buildGestionSQL(access) + ' ORDER BY gm.created_at DESC';
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
                solicitudes: []
            });
        }
        
        // Construir placeholders para la cláusula IN
        const placeholders = solicitudesIds.map(function() { return '?'; }).join(',');
        
        // Obtener solicitudes con su última gestión real (si existe)
        const resultSol = await pool.query(`
            SELECT s.*, 
                   COALESCE(g.tipo_gestion, 'Pendiente') as tipo_gestion,
                   COALESCE(g.observacion, 'Por gestionar') as gestion_obs,
                   g.id as gestion_id,
                   g.fecha_gestion
            FROM solicitudes s
            LEFT JOIN gestiones g ON g.id = (
                SELECT MAX(g2.id) FROM gestiones g2 
                WHERE g2.solicitud_id = s.id_solicitud
                AND (g2.gestion_maestro_id = ? OR g2.gestion_maestro_id IS NULL)
            )
            WHERE s.id_solicitud IN (${placeholders})
            ORDER BY CASE WHEN g.fecha_gestion IS NULL THEN 0 ELSE 1 END DESC, g.fecha_gestion DESC
        `, [id].concat(solicitudesIds));
        
        const Solicitudes = getRows(resultSol);
        
        // Debug: mostrar los primeros gestion_obs para verificar
        console.log('[getGestionMaestroById] Total solicitudes devueltas:', Solicitudes.length);
        if (Solicitudes.length > 0) {
            console.log('[getGestionMaestroById] Primeras 3 gestion_obs:', 
                Solicitudes.slice(0, 3).map(s => ({id: s.id_solicitud, obs: s.gestion_obs, tipo: s.tipo_gestion})));
        }
        
        res.json({
            ...gestion,
            solicitudes: Solicitudes
        });
    } catch (error) {
        console.error('Error en getGestionMaestroById:', error);
        res.status(500).json({ error: 'Error al buscar gestión' });
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
        
        // Eliminar primero las gestione individuales
        await pool.query(`
            DELETE FROM gestiones WHERE gestion_maestro_id = ?
        `, [id]);
        
        // Eliminar el maestro
        await pool.query(`
            DELETE FROM gestiones_maestro WHERE id = ?
        `, [id]);
        
        res.json({ mensaje: 'Gestión eliminada correctamente' });
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

        // Agregar nuevos IDs evitando duplicados
        var idsActualizados = [...idsExistentes];
        var agregados = 0;
        for (var i = 0; i < nuevosIds.length; i++) {
            var nuevoId = nuevosIds[i];
            if (idsActualizados.indexOf(nuevoId) === -1) {
                idsActualizados.push(nuevoId);
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

        // Parsear IDs existentes (normalizar a números por si están como strings en BD)
        var idsExistentes = [];
        try {
            if (gestion.solicitudes_ids) {
                idsExistentes = JSON.parse(gestion.solicitudes_ids).map(function(id) { return Number(id); });
            }
        } catch (e) {
            console.error('[quitarSolicitudDeCampana] Error parseando solicitudes_ids:', e);
        }

        // Normalizar solicitud_id a número
        var solicitudIdNum = Number(solicitud_id);

        // Verificar que la solicitud existe en la campaña
        var index = idsExistentes.indexOf(solicitudIdNum);
        if (index === -1) {
            return res.status(400).json({ error: 'La solicitud no pertenece a esta campaña' });
        }

        // Quitar el ID
        idsExistentes.splice(index, 1);

        // Calcular nuevas gestionadas: si la solicitud tenía gestión, restar 1
        var nuevasGestionadas = gestion.gestionadas || 0;
        // Verificar si había gestiones asociadas a esta solicitud en esta campaña
        const resultCheckGestion = await pool.query(
            'SELECT COUNT(*) as count FROM gestiones WHERE solicitud_id = ? AND gestion_maestro_id = ?',
            [solicitud_id, id]
        );
        var checkRow = getFirstRow(resultCheckGestion);
        var count = checkRow ? (checkRow.count || 0) : 0;
        if (count > 0) {
            nuevasGestionadas = Math.max(0, nuevasGestionadas - 1);
        }

        // Guardar los IDs actualizados
        const solicitudesIdsJson = JSON.stringify(idsExistentes);
        await pool.query(`
            UPDATE gestiones_maestro 
            SET solicitudes_ids = ?, total_solicitudes = ?, gestionadas = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `, [solicitudesIdsJson, idsExistentes.length, nuevasGestionadas, id]);

        console.log('[quitarSolicitudDeCampana] Quitada solicitud', solicitud_id, 'de campaña', id, 'Total:', idsExistentes.length);

        res.json({
            mensaje: 'Solicitud quitada correctamente',
            total: idsExistentes.length
        });
    } catch (error) {
        console.error('Error en quitarSolicitudDeCampana:', error);
        res.status(500).json({ error: 'Error al quitar solicitud de la campaña' });
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
    // Aliases en inglés para excel.routes.js
    getGestionesMaestro: getGestionesMaestro,
    getGestionMaestroById: getGestionMaestroById,
    createGestionMaestro: createGestionMaestro,
    updateGestionMaestro: updateGestionMaestro,
    deleteGestionMaestro: deleteGestionMaestro
};
