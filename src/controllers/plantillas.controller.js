const pool = require('../config/db');

// Límite máximo de plantillas por usuario
const MAX_PLANTILLAS = 5;

// Helper para obtener resultados compatibles SQLite/PostgreSQL
function getRows(result) {
    if (result && result.rows) return result.rows;
    if (Array.isArray(result)) return result;
    return [];
}

function getUsuarioId(req) {
    return req.session && req.session.usuario ? req.session.usuario.id : null;
}

// Validar datos de la plantilla
function validarPlantilla(nombre, contenido) {
    const errores = [];

    const nombreLimpio = String(nombre || '').trim();
    if (!nombreLimpio) {
        errores.push('El nombre de la plantilla es obligatorio');
    } else if (nombreLimpio.length > 100) {
        errores.push('El nombre no puede superar los 100 caracteres');
    }

    const contenidoLimpio = String(contenido || '').trim();
    if (!contenidoLimpio) {
        errores.push('El contenido del mensaje es obligatorio');
    } else if (contenidoLimpio.length > 2000) {
        errores.push('El contenido no puede superar los 2000 caracteres');
    }

    return { nombre: nombreLimpio, contenido: contenidoLimpio, errores };
}

/**
 * GET /api/plantillas
 * Lista las plantillas del usuario autenticado
 */
exports.listarPlantillas = async function(req, res) {
    try {
        const usuarioId = getUsuarioId(req);
        if (!usuarioId) {
            return res.status(401).json({ error: 'No autenticado' });
        }

        const result = await pool.query(
            `SELECT id, usuario_id, nombre, contenido, creada_en, actualizada_en
             FROM plantillas
             WHERE usuario_id = ?
             ORDER BY creada_en ASC, id ASC`,
            [usuarioId]
        );

        const plantillas = getRows(result);

        res.json({
            data: plantillas,
            total: plantillas.length,
            max: MAX_PLANTILLAS
        });
    } catch (error) {
        console.error('[Plantillas] Error listarPlantillas:', error);
        res.status(500).json({ error: error.message });
    }
};

/**
 * POST /api/plantillas
 * Crea una nueva plantilla (máximo 5 por usuario)
 */
exports.crearPlantilla = async function(req, res) {
    try {
        const usuarioId = getUsuarioId(req);
        if (!usuarioId) {
            return res.status(401).json({ error: 'No autenticado' });
        }

        const { nombre, contenido } = req.body || {};
        const validacion = validarPlantilla(nombre, contenido);
        if (validacion.errores.length > 0) {
            return res.status(400).json({ error: validacion.errores.join('. ') });
        }

        // Verificar límite máximo de plantillas por usuario con INSERT condicional ATOMICO:
        // una sola sentencia evita la condición de carrera entre COUNT(*) e INSERT
        // (funciona en SQLite y PostgreSQL vía db.js)
        const result = await pool.query(
            `INSERT INTO plantillas (usuario_id, nombre, contenido)
             SELECT ?, ?, ?
             WHERE (SELECT COUNT(*) FROM plantillas WHERE usuario_id = ?) < ?`,
            [usuarioId, validacion.nombre, validacion.contenido, usuarioId, MAX_PLANTILLAS]
        );

        if (!result.rowCount) {
            return res.status(400).json({
                error: `Límite de ${MAX_PLANTILLAS} plantillas alcanzado. Elimina una plantilla para crear otra.`
            });
        }

        const plantillaId = result.lastInsertRowid || (getRows(result)[0] && getRows(result)[0].id);
        if (!plantillaId) {
            return res.status(500).json({ error: 'No se pudo obtener el ID de la plantilla creada' });
        }

        // Devolver la plantilla creada completa
        const nuevoResult = await pool.query(
            `SELECT id, usuario_id, nombre, contenido, creada_en, actualizada_en
             FROM plantillas WHERE id = ?`,
            [plantillaId]
        );
        const plantilla = getRows(nuevoResult)[0];

        res.status(201).json({
            mensaje: 'Plantilla creada correctamente',
            plantilla: plantilla
        });
    } catch (error) {
        console.error('[Plantillas] Error crearPlantilla:', error);
        res.status(500).json({ error: error.message });
    }
};

/**
 * PUT /api/plantillas/:id
 * Actualiza una plantilla del usuario
 */
exports.actualizarPlantilla = async function(req, res) {
    try {
        const usuarioId = getUsuarioId(req);
        if (!usuarioId) {
            return res.status(401).json({ error: 'No autenticado' });
        }

        const plantillaId = parseInt(req.params.id, 10);
        if (!plantillaId) {
            return res.status(400).json({ error: 'ID de plantilla inválido' });
        }

        const { nombre, contenido } = req.body || {};
        const validacion = validarPlantilla(nombre, contenido);
        if (validacion.errores.length > 0) {
            return res.status(400).json({ error: validacion.errores.join('. ') });
        }

        // Verificar que la plantilla exista y sea del usuario
        const existente = await pool.query(
            'SELECT id FROM plantillas WHERE id = ? AND usuario_id = ?',
            [plantillaId, usuarioId]
        );
        if (getRows(existente).length === 0) {
            return res.status(404).json({ error: 'Plantilla no encontrada' });
        }

        await pool.query(
            `UPDATE plantillas
             SET nombre = ?, contenido = ?, actualizada_en = CURRENT_TIMESTAMP
             WHERE id = ? AND usuario_id = ?`,
            [validacion.nombre, validacion.contenido, plantillaId, usuarioId]
        );

        const nuevoResult = await pool.query(
            `SELECT id, usuario_id, nombre, contenido, creada_en, actualizada_en
             FROM plantillas WHERE id = ?`,
            [plantillaId]
        );
        const plantilla = getRows(nuevoResult)[0];

        res.json({
            mensaje: 'Plantilla actualizada correctamente',
            plantilla: plantilla
        });
    } catch (error) {
        console.error('[Plantillas] Error actualizarPlantilla:', error);
        res.status(500).json({ error: error.message });
    }
};

/**
 * DELETE /api/plantillas/:id
 * Elimina una plantilla del usuario
 */
exports.eliminarPlantilla = async function(req, res) {
    try {
        const usuarioId = getUsuarioId(req);
        if (!usuarioId) {
            return res.status(401).json({ error: 'No autenticado' });
        }

        const plantillaId = parseInt(req.params.id, 10);
        if (!plantillaId) {
            return res.status(400).json({ error: 'ID de plantilla inválido' });
        }

        const result = await pool.query(
            'DELETE FROM plantillas WHERE id = ? AND usuario_id = ?',
            [plantillaId, usuarioId]
        );

        if (!result.rowCount) {
            return res.status(404).json({ error: 'Plantilla no encontrada' });
        }

        res.json({ mensaje: 'Plantilla eliminada correctamente' });
    } catch (error) {
        console.error('[Plantillas] Error eliminarPlantilla:', error);
        res.status(500).json({ error: error.message });
    }
};
