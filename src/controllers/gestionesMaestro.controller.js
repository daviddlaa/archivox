// Dynamic database - SQLite for local, PostgreSQL for production
const db = require('../config/db');
const pool = db.pool || db;

// Helper para obtener resultado de queries (compatible con SQLite y PostgreSQL)
function getRows(result) {
    return result.rows || result;
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
            'SELECT * FROM g3 WHERE usuario_id = $1 ORDER BY created_at DESC',
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
            'SELECT * FROM gestiones_maestro WHERE id = $1 AND usuario_id = $2',
            [id, usuario_id]
        );
        
        const gestion = getFirstRow(resultGM);
        
        if (!gestion) {
            return res.status(404).json({ error: 'Gestión no encontrada' });
        }
        
        // Obtener solicitudes asociadas a esta gestión
        const resultSol = await pool.query(`
            SELECT s.*, g.id as gestion_id, g.tipo_gestion, g.observacion as gestion_obs, g.fecha_gestion
            FROM solicitudes s
            LEFT JOIN gestiones ON s.id_solicitud = g.solicitud_id AND g.gestion_maestro_id = $1
            WHERE s.id_solicitud IN (
                SELECT solicitud_id FROM gestioes WHERE gestion_maestro_id = $1
            )
            ORDER BY g.fecha_gestion DESC NULLS LAST
        `, [id]);
        
        const solicitudes = getRows(resultSol);
        
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
async function createGestionMaestro(req, res) {
    const client = await pool.connect();
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
        
        // Iniciar transacción
        await client.query('BEGIN');
        
        // Crear gestión maestro con RETURNING id
        const resultGM = await client.query(`
            INSERT INTO gestiones_maestro (nombre, descripcion, usuario_id, total_solicitudes, gestionadas, fecha_limite)
            VALUES ($1, $2, $3, $4, 0, $5)
            RETURNING id
        `, [nombre, descripcion || '', usuario_id, solicitudes_ids.length, fecha_limite || null]);
        
        const gestion_id = resultGM.rows[0].id;
        console.log('[gestiones-maestro] Gestion ID creada:', gestion_id);
        
        // Insertar cada gestión individual vinculada al maestro
        for (const sol_id of solicitudes_ids) {
            await client.query(`
                INSERT INTO gestiones (solicitud_id, usuario_id, tipo_gestion, observacion, gestion_maestro_id)
                VALUES ($1, $2, 'Pendiente', 'Por gestionar', $3)
            `, [sol_id, usuario_id, gestion_id]);
        }
        
        await client.query('COMMIT');
        
        console.log('[gestiones-maestro] Gestion creada exitosamente, ID:', gestion_id);
        
        res.json({ 
            id: gestion_id, 
            mensaje: 'Gestión creada correctamente',
            total_solicitudes: solicitudes_ids.length
        });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('[gestiones-maestro] Error completo:', error);
        console.error('[gestiones-maestro] Stack:', error.stack);
        res.status(500).json({ error: 'Error al crear gestión', detalle: error.message });
    } finally {
        client.release();
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
            SELECT id FROM gestiones_maestro WHERE id = $1 AND usuario_id = $2
        `, [id, usuario_id]);
        
        const existing = getFirstRow(resultCheck);
        
        if (!existing) {
            return res.status(404).json({ error: 'Gestión no encontrada' });
        }
        
        // Actualizar
        await pool.query(`
            UPDATE gestiones_maestro 
            SET nombre = COALESCE($1, nombre),
                descripcion = COALESCE($2, descripcion),
                fecha_limite = COALESCE($3, fecha_limite),
                estado = COALESCE($4, estado),
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $5 AND usuario_id = $6
        `, [nombre, descripcion, fecha_limite, estado, id, usuario_id]);
        
        res.json({ mensaje: 'Gestión actualizada correctamente' });
    } catch (error) {
        console.error('Error en updateGestionMaestro:', error);
        res.status(500).json({ error: 'Error al actualizar gestión' });
    }
}

// DELETE /api/gestiones-maestro/:id - Eliminar gestión maestro
async function deleteGestionMaestro(req, res) {
    const client = await pool.connect();
    try {
        const usuario_id = getUsuarioId(req);
        if (!usuario_id) {
            return res.status(401).json({ error: 'No autenticado' });
        }
        
        const { id } = req.params;
        
        // Verificar que existe y pertenece al usuario
        const resultCheck = await pool.query(`
            SELECT id FROM gestiones_maestro WHERE id = $1 AND usuario_id = $2
        `, [id, usuario_id]);
        
        const existing = getFirstRow(resultCheck);
        
        if (!existing) {
            return res.status(404).json({ error: 'Gestión no encontrada' });
        }
        
        // Iniciar transacción
        await client.query('BEGIN');
        
        // Eliminar primero las gestione individuales
        await client.query(`
            DELETE FROM gestiones WHERE gestion_maestro_id = $1
        `, [id]);
        
        // Eliminar el maestro
        await client.query(`
            DELETE FROM gestiones_maestro WHERE id = $1 AND usuario_id = $2
        `, [id, usuario_id]);
        
        await client.query('COMMIT');
        
        res.json({ mensaje: 'Gestión eliminada correctamente' });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error en deleteGestionMaestro:', error);
        res.status(500).json({ error: 'Error al eliminar gestión' });
    } finally {
        client.release();
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
            VALUES ($1, $2, $3, $4, $5)
            RETURNING id
        `, [solicitud_id, usuario_id, tipo_gestion, observacion || '', gestion_maestro_id || null]);
        
        const gestion_id = result.rows[0].id;
        
        // Si tiene gestion_maestro_id, actualizar contador
        if (gestion_maestro_id) {
            await pool.query(`
                UPDATE gestiones_maestro 
                SET gestionadas = gestionadas + 1,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = $1
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
            WHERE id = $1 AND usuario_id = $2
        `, [id, usuario_id]);
        
        const gestion = getFirstRow(resultGM);
        
        if (!gestion) {
            return res.status(404).json({ error: 'Gestión no encontrada' });
        }
        
        // Contar gestións por estado
        const resultCount = await pool.query(`
            SELECT tipo_gestion, COUNT(*) as count
            FROM gestiones 
            WHERE gestion_maestro_id = $1
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
