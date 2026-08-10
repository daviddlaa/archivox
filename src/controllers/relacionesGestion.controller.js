const pool = require('../config/db');

function getRows(result) {
    if (result && result.rows) return result.rows;
    if (Array.isArray(result)) return result;
    return [];
}

function getUsuarioId(req) {
    return req.session && req.session.usuario ? req.session.usuario.id : null;
}

/**
 * POST /api/relaciones/gestiones
 * Crear una nueva gestión para una relación
 */
exports.crearGestion = async function(req, res) {
    try {
        const usuarioId = getUsuarioId(req);
        if (!usuarioId) {
            return res.status(401).json({ error: 'No autenticado' });
        }

        const { relacion_id, tipo_gestion, observacion } = req.body;

        if (!relacion_id) {
            return res.status(400).json({ error: 'relacion_id es requerido' });
        }

        if (!tipo_gestion) {
            return res.status(400).json({ error: 'tipo_gestion es requerido' });
        }

        const result = await pool.query(
            `INSERT INTO gestiones_relaciones (relacion_id, usuario_id, tipo_gestion, observacion)
             VALUES (?, ?, ?, ?)`,
            [relacion_id, usuarioId, tipo_gestion, observacion || '']
        );

        const gestionId = result.lastInsertRowid || (result.rows && result.rows[0] && result.rows[0].id);

        res.json({
            id: gestionId,
            mensaje: 'Gestión guardada correctamente'
        });
    } catch (error) {
        console.error('[RelacionesGestion] Error crearGestion:', error);
        res.status(500).json({ error: error.message });
    }
};

/**
 * GET /api/relaciones/gestiones/:relacion_id
 * Obtener todas las gestiones de una relación
 */
exports.getGestiones = async function(req, res) {
    try {
        const usuarioId = getUsuarioId(req);
        if (!usuarioId) {
            return res.status(401).json({ error: 'No autenticado' });
        }

        const { relacion_id } = req.params;

        if (!relacion_id) {
            return res.status(400).json({ error: 'relacion_id es requerido' });
        }

        const result = await pool.query(
            `SELECT * FROM gestiones_relaciones 
             WHERE relacion_id = ? AND usuario_id = ?
             ORDER BY fecha_gestion DESC`,
            [relacion_id, usuarioId]
        );

        res.json(getRows(result));
    } catch (error) {
        console.error('[RelacionesGestion] Error getGestiones:', error);
        res.status(500).json({ error: error.message });
    }
};

/**
 * GET /api/relaciones/gestiones/ultimas?ids=1,2,3
 * Obtener la última gestión de múltiples relaciones (batch)
 */
exports.getGestionesUltimas = async function(req, res) {
    try {
        const usuarioId = getUsuarioId(req);
        if (!usuarioId) {
            return res.status(401).json({ error: 'No autenticado' });
        }

        const { ids } = req.query;

        if (!ids) {
            return res.status(400).json({ error: 'IDs de relaciones requeridos' });
        }

        const relacionIds = ids.split(',').map(id => parseInt(id.trim(), 10)).filter(id => !isNaN(id));
        if (relacionIds.length === 0) {
            return res.json({});
        }

        const placeholders = relacionIds.map(function() { return '?'; }).join(',');
        const params = [usuarioId].concat(relacionIds);

        const result = await pool.query(
            `SELECT g.id, g.relacion_id, g.tipo_gestion, g.observacion, g.fecha_gestion
             FROM gestiones_relaciones g
             WHERE g.usuario_id = ? AND g.relacion_id IN (${placeholders})
             ORDER BY g.relacion_id, g.fecha_gestion DESC`,
            params
        );

        const rows = getRows(result);
        const gestionessObj = {};
        let lastId = null;

        for (const row of rows) {
            if (row.relacion_id !== lastId) {
                gestionessObj[row.relacion_id] = {
                    id: row.id,
                    tipo_gestion: row.tipo_gestion,
                    observacion: row.observacion,
                    fecha_gestion: row.fecha_gestion
                };
                lastId = row.relacion_id;
            }
        }

        res.json(gestionessObj);
    } catch (error) {
        console.error('[RelacionesGestion] Error getGestionesUltimas:', error);
        res.status(500).json({ error: error.message });
    }
};

/**
 * DELETE /api/relaciones/gestiones/:id
 * Eliminar una gestión
 */
exports.eliminarGestion = async function(req, res) {
    try {
        const usuarioId = getUsuarioId(req);
        if (!usuarioId) {
            return res.status(401).json({ error: 'No autenticado' });
        }

        const { id } = req.params;

        const result = await pool.query(
            `DELETE FROM gestiones_relaciones WHERE id = ? AND usuario_id = ?`,
            [id, usuarioId]
        );

        res.json({ mensaje: 'Gestión eliminada correctamente' });
    } catch (error) {
        console.error('[RelacionesGestion] Error eliminarGestion:', error);
        res.status(500).json({ error: error.message });
    }
};
