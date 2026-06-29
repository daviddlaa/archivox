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

// GET /api/gestiones-maestro - Listar todas las gestione maestro
async function getGestionesMaestro(req, res) {
    try {
        const usuario_id = getUsuarioId(req);
        if (!usuario_id) {
            return res.status(401).json({ error: 'No autenticado' });
        }
        
        const result = await pool.query(
            'SELECT * FROM gestiones_maestro WHERE usuario_id = ? ORDER BY created_at DESC',
            [usuario_id]
        );
        
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
        
        // Obtener gestión maestro
        const resultGM = await pool.query(
            'SELECT * FROM gestiones_maestro WHERE id = ? AND usuario_id = ?',
            [id, usuario_id]
        );
        
        const gestion = getFirstRow(resultGM);
        
        if (!gestion) {
            return res.status(404).json({ error: 'Gestión no encontrada' });
        }
        
        // Obtener solicitudes (SOLO la última gestión NO-Pendiente por solicitud)
        // Excluimos 'Pendiente' para evitar que el Pendiente creado al generar la campaña
        // (que tiene el ID más alto) opaque gestiones reales anteriores
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
                AND g2.tipo_gestion != 'Pendiente'
                AND (g2.gestion_maestro_id = ? OR g2.gestion_maestro_id IS NULL)
            )
            WHERE s.id_solicitud IN (
                SELECT solicitud_id FROM gestiones WHERE gestion_maestro_id = ?
            )
            ORDER BY CASE WHEN g.fecha_gestion IS NULL THEN 0 ELSE 1 END DESC, g.fecha_gestion DESC
        `, [id, id]);
        
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
        
        const { nombre, descripcion, fecha_limite, solicitudes_ids } = req.body;
        console.log('[gestiones-maestro] Datos recibidos:', { nombre, descripcion, fecha_limite, solicitudes_ids: solicitudes_ids?.length });
        
        if (!nombre) {
            return res.status(400).json({ error: 'El nombre es requerido' });
        }
        
        if (!solicitudes_ids || !Array.isArray(solicitudes_ids) || solicitudes_ids.length === 0) {
            return res.status(400).json({ error: 'Se requiere al menos una solicitud' });
        }
        
        // SQLite: Insertar y obtener el último ID
        const resultGM = await pool.query(`
            INSERT INTO gestiones_maestro (nombre, descripcion, usuario_id, total_solicitudes, gestionadas, fecha_limite)
            VALUES (?, ?, ?, ?, 0, ?)
        `, [nombre, descripcion || '', usuario_id, solicitudes_ids.length, fecha_limite || null]);
        
        // SQLite usa lastInsertRowid
        const gestion_id = resultGM.lastInsertRowid;
        console.log('[gestiones-maestro] Gestion ID creada:', gestion_id);
        
        // Insertar cada gestión individual vinculada al maestro
        for (const sol_id of solicitudes_ids) {
            await pool.query(`
                INSERT INTO gestiones (solicitud_id, usuario_id, tipo_gestion, observacion, gestion_maestro_id)
                VALUES (?, ?, 'Pendiente', 'Por gestionar', ?)
            `, [sol_id, usuario_id, gestion_id]);
        }
        
        console.log('[gestiones-maestro] Gestion creada exitosamente, ID:', gestion_id);
        
        res.json({ 
            id: gestion_id, 
            mensaje: 'Gestión creada correctamente',
            total_solicitudes: solicitudes_ids.length
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
        
        // Verificar que existe y pertenece al usuario
        const resultCheck = await pool.query(`
            SELECT id FROM gestiones_maestro WHERE id = ? AND usuario_id = ?
        `, [id, usuario_id]);
        
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
            params.push(id, usuario_id);
            
            await pool.query(`
                UPDATE gestiones_maestro 
                SET ${updates.join(', ')}
                WHERE id = ? AND usuario_id = ?
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
        
        // Verificar que existe y pertenece al usuario
        const resultCheck = await pool.query(`
            SELECT id FROM gestiones_maestro WHERE id = ? AND usuario_id = ?
        `, [id, usuario_id]);
        
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
            DELETE FROM gestiones_maestro WHERE id = ? AND usuario_id = ?
        `, [id, usuario_id]);
        
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
        
        // Obtener gestión maestro
        const resultGM = await pool.query(`
            SELECT * FROM gestiones_maestro 
            WHERE id = ? AND usuario_id = ?
        `, [id, usuario_id]);
        
        const gestion = getFirstRow(resultGM);
        
        if (!gestion) {
            return res.status(404).json({ error: 'Gestión no encontrada' });
        }
        
        // Contar gestións por estado
        const resultCount = await pool.query(`
            SELECT tipo_gestion, COUNT(*) as count
            FROM gestiones 
            WHERE gestion_maestro_id = ?
            GROUP BY tipo_gestion
        `, [id]);
        
        const conteo = getRows(resultCount);
        
        // Calcular progreso
        const porEstado = {};
        let gestionadas = 0;
        
        for (const c of conteo) {
            porEstado[c.tipo_gestion] = c.count;
            if (c.tipo_gestion !== 'Pendiente') {
                gestionadas += parseInt(c.count);
            }
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

module.exports = {
    // Aliases en español para compatibilidad con las rutas
    crearGestionMaestro: createGestionMaestro,
    listarGestionesMaestro: getGestionesMaestro,
    obtenerGestionMaestro: getGestionMaestroById,
    actualizarGestionMaestro: updateGestionMaestro,
    eliminarGestionMaestro: deleteGestionMaestro,
    obtenerProgresoGestion: obtenerProgresoGestion,
    createGestion: createGestion,
    // Aliases en inglés para excel.routes.js
    getGestionesMaestro: getGestionesMaestro,
    getGestionMaestroById: getGestionMaestroById,
    createGestionMaestro: createGestionMaestro,
    updateGestionMaestro: updateGestionMaestro,
    deleteGestionMaestro: deleteGestionMaestro
};
