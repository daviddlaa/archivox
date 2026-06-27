const db = require('../config/database');

// Obtener usuario actual (del middleware de auth)
function getUsuarioId(req) {
    return req.session && req.session.usuario ? req.session.usuario.id : null;
}

// GET /api/gestiones-maestro - Listar todas las gestione maestro
function getGestionesMaestro(req, res) {
    try {
        const usuario_id = getUsuarioId(req);
        if (!usuario_id) {
            return res.status(401).json({ error: 'No autenticado' });
        }
        
        const stmt = db.prepare(`
            SELECT * FROM gestiones_maestro 
            WHERE usuario_id = ?
            ORDER BY created_at DESC
        `);
        
        const gestiones = stmt.all(usuario_id);
        res.json(gestiones);
    } catch (error) {
        console.error('Error en getGestionesMaestro:', error);
        res.status(500).json({ error: 'Error al buscar gestiones' });
    }
}

// GET /api/gestiones-maestro/:id - Ver una gestión específica con sus solicitudes
function getGestionMaestroById(req, res) {
    try {
        const usuario_id = getUsuarioId(req);
        if (!usuario_id) {
            return res.status(401).json({ error: 'No autenticado' });
        }
        
        const { id } = req.params;
        
        // Obtener gestión maestro
        const stmtGM = db.prepare(`
            SELECT * FROM gestiones_maestro 
            WHERE id = ? AND usuario_id = ?
        `);
        
        const gestion = stmtGM.get(id, usuario_id);
        
        if (!gestion) {
            return res.status(404).json({ error: 'Gestión no encontrada' });
        }
        
        // Obtener solicitudes asociadas a esta gestión
        const stmtSol = db.prepare(`
            SELECT s.*, g.id as gestion_id, g.tipo_gestion, g.observacion as gestion_obs, g.fecha_gestion
            FROM solicitudes s
            LEFT JOIN gestiones g ON s.id_solicitud = g.solicitud_id AND g.gestion_maestro_id = ?
            WHERE s.id_solicitud IN (
                SELECT solicitud_id FROM gestiones WHERE gestion_maestro_id = ?
            )
            ORDER BY g.fecha_gestion DESC NULLS LAST
        `);
        
        const solicitudes = stmtSol.all(id, id);
        
        res.json({
            ...gestion,
            solicitudes: solicitudes
        });
    } catch (error) {
        console.error('Error en getGestionMaestroById:', error);
        res.status(500).json({ error: 'Error al buscar gestión' });
    }
}

// POST /api/gestiones-maestro - Crear nueva gestión por lotes
function createGestionMaestro(req, res) {
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
        
        // Verificar que las solicitudes existen y pertenecen al usuario
        const stmtCheck = db.prepare(`
            SELECT id_solicitud FROM solicitudes 
            WHERE id_solicitud = ? AND usuario_id = ?
        `);
        
        // Crear gestión maestro
        const stmtInsert = db.prepare(`
            INSERT INTO gestiones_maestro (nombre, descripcion, usuario_id, total_solicitudes, gestionadas, fecha_limite)
            VALUES (?, ?, ?, ?, 0, ?)
        `);
        
        console.log('[gestiones-maestro] Insertando en gestiones_maestro:', { nombre, descripcion, usuario_id, total: solicitudes_ids.length });
        
        const result = stmtInsert.run(nombre, descripcion || '', usuario_id, solicitudes_ids.length, fecha_limite || null);
        const gestion_id = result.lastInsertRowid;
        console.log('[gestiones-maestro] Gestion ID creada:', gestion_id);
        
        // Insertar cada gestión individual vinculada al maestro
        const stmtGestion = db.prepare(`
            INSERT INTO gestiones (solicitud_id, usuario_id, tipo_gestion, observacion, gestion_maestro_id)
            VALUES (?, ?, 'Pendiente', 'Por gestionar', ?)
        `);
        
        for (const sol_id of solicitudes_ids) {
            stmtGestion.run(sol_id, usuario_id, gestion_id);
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
function updateGestionMaestro(req, res) {
    try {
        const usuario_id = getUsuarioId(req);
        if (!usuario_id) {
            return res.status(401).json({ error: 'No autenticado' });
        }
        
        const { id } = req.params;
        const { nombre, descripcion, fecha_limite, estado } = req.body;
        
        // Verificar que existe y pertenece al usuario
        const stmtCheck = db.prepare(`
            SELECT id FROM gestiones_maestro WHERE id = ? AND usuario_id = ?
        `);
        
        const existing = stmtCheck.get(id, usuario_id);
        
        if (!existing) {
            return res.status(404).json({ error: 'Gestión no encontrada' });
        }
        
        // Actualizar
        const stmtUpdate = db.prepare(`
            UPDATE gestiones_maestro 
            SET nombre = COALESCE(?, nombre),
                descripcion = COALESCE(?, descripcion),
                fecha_limite = COALESCE(?, fecha_limite),
                estado = COALESCE(?, estado),
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ? AND usuario_id = ?
        `);
        
        stmtUpdate.run(nombre, descripcion, fecha_limite, estado, id, usuario_id);
        
        res.json({ mensaje: 'Gestión actualizada correctamente' });
    } catch (error) {
        console.error('Error en updateGestionMaestro:', error);
        res.status(500).json({ error: 'Error al actualizar gestión' });
    }
}

// DELETE /api/gestiones-maestro/:id - Eliminar gestión maestro
function deleteGestionMaestro(req, res) {
    try {
        const usuario_id = getUsuarioId(req);
        if (!usuario_id) {
            return res.status(401).json({ error: 'No autenticado' });
        }
        
        const { id } = req.params;
        
        // Verificar que existe y pertenece al usuario
        const stmtCheck = db.prepare(`
            SELECT id FROM gestiones_maestro WHERE id = ? AND usuario_id = ?
        `);
        
        const existing = stmtCheck.get(id, usuario_id);
        
        if (!existing) {
            return res.status(404).json({ error: 'Gestión no encontrada' });
        }
        
        // Eliminar primero las gestione individuales
        const stmtDelGestion = db.prepare(`
            DELETE FROM gestiones WHERE gestion_maestro_id = ?
        `);
        stmtDelGestion.run(id);
        
        // Eliminar el maestro
        const stmtDelMaestro = db.prepare(`
            DELETE FROM gestiones_maestro WHERE id = ? AND usuario_id = ?
        `);
        stmtDelMaestro.run(id, usuario_id);
        
        res.json({ mensaje: 'Gestión eliminada correctamente' });
    } catch (error) {
        console.error('Error en deleteGestionMaestro:', error);
        res.status(500).json({ error: 'Error al eliminar gestión' });
    }
}

// POST /api/gestiones - Guardar gestión individual (modificado para aceptar gestion_maestro_id)
function createGestion(req, res) {
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
        
        const stmt = db.prepare(`
            INSERT INTO gestiones (solicitud_id, usuario_id, tipo_gestion, observacion, gestion_maestro_id)
            VALUES (?, ?, ?, ?, ?)
        `);
        
        const result = stmt.run(solicitud_id, usuario_id, tipo_gestion, observacion || '', gestion_maestro_id || null);
        
        // Si tiene gestion_maestro_id, actualizar contador
        if (gestion_maestro_id) {
            const stmtUpdateCount = db.prepare(`
                UPDATE gestiones_maestro 
                SET gestionadas = gestionadas + 1,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `);
            stmtUpdateCount.run(gestion_maestro_id);
        }
        
        res.json({ 
            id: result.lastInsertRowid, 
            mensaje: 'Gestión guardada correctamente' 
        });
    } catch (error) {
        console.error('Error en createGestion:', error);
        res.status(500).json({ error: 'Error al guardar gestión' });
    }
}

// GET /api/gestiones-maestro/:id/progreso - Obtener progreso de gestión
function obtenerProgresoGestion(req, res) {
    try {
        const usuario_id = getUsuarioId(req);
        if (!usuario_id) {
            return res.status(401).json({ error: 'No autenticado' });
        }
        
        const { id } = req.params;
        
        // Obtener gestión maestro
        const stmtGM = db.prepare(`
            SELECT * FROM gestiones_maestro 
            WHERE id = ? AND usuario_id = ?
        `);
        
        const gestion = stmtGM.get(id, usuario_id);
        
        if (!gestion) {
            return res.status(404).json({ error: 'Gestión no encontrada' });
        }
        
        // Contar gestións por estado
        const stmtCount = db.prepare(`
            SELECT tipo_gestion, COUNT(*) as count
            FROM gestiones 
            WHERE gestion_maestro_id = ?
            GROUP BY tipo_gestion
        `);
        
        const conteo = stmtCount.all(id);
        
        // Calcular progreso
        const porEstado = {};
        let gestionadas = 0;
        
        for (const c of conteo) {
            porEstado[c.tipo_gestion] = c.count;
            if (c.tipo_gestion !== 'Pendiente') {
                gestionadas += c.count;
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
