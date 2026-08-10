const pool = require('../config/db');
const relacionesService = require('../services/relaciones.service');

// Helper para obtener resultados compatibles SQLite/PostgreSQL
function getRows(result) {
    if (result && result.rows) return result.rows;
    if (Array.isArray(result)) return result;
    return [];
}

function getUsuarioId(req) {
    return req.session && req.session.usuario ? req.session.usuario.id : null;
}

/**
 * POST /api/relaciones/upload
 * Sube un Excel de relaciones y lo procesa
 */
exports.uploadRelaciones = async function(req, res) {
    try {
        const usuarioId = getUsuarioId(req);
        console.log('[Relaciones] uploadRelaciones - usuarioId:', usuarioId);
        
        if (!usuarioId) {
            console.log('[Relaciones] uploadRelaciones - ERROR: No autenticado');
            return res.status(401).json({ error: 'No autenticado' });
        }

        if (!req.file) {
            console.log('[Relaciones] uploadRelaciones - ERROR: No se envió ningún archivo');
            console.log('[Relaciones] req.body:', req.body);
            console.log('[Relaciones] req.files:', req.files);
            return res.status(400).json({ error: 'No se envió ningún archivo' });
        }

console.log('[Relaciones] uploadRelaciones - Archivo recibido:', req.file.originalname, '- path:', req.file.path);

        const resultado = await relacionesService.procesarExcel(req.file.path, usuarioId);

        console.log('[Relaciones] uploadRelaciones - Resultado:', resultado);

        // Incluir debug info en la respuesta para ver en consola del navegador
        res.json({
            mensaje: 'Relaciones importadas correctamente',
            total: resultado.total,
            altas: resultado.altas,
            bajas: resultado.bajas,
            debug: {
                archivo: req.file.originalname,
                filasProcesadas: resultado.total,
                mensajeDebug: resultado.debug || 'Sin info de debug'
            }
        });
    } catch (error) {
        console.error('[Relaciones] Error uploadRelaciones:', error);
        res.status(500).json({ error: error.message });
    }
};

/**
 * GET /api/relaciones
 * Lista las relaciones con filtros
 */
exports.listarRelaciones = async function(req, res) {
    try {
        const usuarioId = getUsuarioId(req);
        if (!usuarioId) {
            return res.status(401).json({ error: 'No autenticado' });
        }

        const {
            estado = '',
            q = '',
            fecha_desde = '',
            fecha_hasta = '',
            ops_min = '',
            ops_max = '',
            orden = 'cliente',
            direccion = 'ASC',
            limite = 100,
            offset = 0
        } = req.query;

        let sql = 'SELECT * FROM relaciones WHERE usuario_id = ?';
        const params = [usuarioId];
        let paramIndex = 2;

        // Filtro por estado (ALTA o BAJA)
        if (estado) {
            sql += ' AND estado_relacion = ?';
            params.push(estado);
        }

        // Búsqueda general
        if (q && q.trim()) {
            const termino = '%' + q.trim() + '%';
            sql += ' AND (identificacion LIKE ? OR LOWER(cliente) LIKE LOWER(?) OR celular LIKE ?)';
            params.push(termino, termino, termino);
        }

        // Filtro por fechas
        if (fecha_desde) {
            sql += ' AND fecha_inicio_relacion >= ?';
            params.push(fecha_desde);
        }
        if (fecha_hasta) {
            sql += ' AND fecha_inicio_relacion <= ?';
            params.push(fecha_hasta);
        }

        // Filtro por # operaciones
        if (ops_min) {
            sql += ' AND numero_operaciones >= ?';
            params.push(parseInt(ops_min));
        }
        if (ops_max) {
            sql += ' AND numero_operaciones <= ?';
            params.push(parseInt(ops_max));
        }

        // Ordenamiento (seguro contra inyección SQL)
        const columnasValidas = ['cliente', 'identificacion', 'celular', 'estado_relacion', 
                                 'fecha_inicio_relacion', 'numero_operaciones'];
        const columnaOrden = columnasValidas.includes(orden) ? orden : 'cliente';
        const direccionOrden = direccion.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';

        // Contar total
        const countSql = sql.replace('SELECT *', 'SELECT COUNT(*) as total');
        const countResult = await pool.query(countSql, params);
        const total = parseInt(getRows(countResult)[0]?.total) || 0;

        // Paginación
        sql += ' ORDER BY ' + columnaOrden + ' ' + direccionOrden;
        sql += ' LIMIT ' + parseInt(limite) + ' OFFSET ' + parseInt(offset);

        const result = await pool.query(sql, params);

        res.json({
            data: getRows(result),
            total: total,
            limite: parseInt(limite),
            offset: parseInt(offset)
        });
    } catch (error) {
        console.error('[Relaciones] Error listarRelaciones:', error);
        res.status(500).json({ error: error.message });
    }
};

/**
 * GET /api/relaciones/stats
 * Devuelve contadores de relaciones
 */
exports.statsRelaciones = async function(req, res) {
    try {
        const usuarioId = getUsuarioId(req);
        if (!usuarioId) {
            return res.status(401).json({ error: 'No autenticado' });
        }

        const result = await pool.query(
            `SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN estado_relacion = 'ALTA' THEN 1 ELSE 0 END) as altas,
                SUM(CASE WHEN estado_relacion = 'BAJA' THEN 1 ELSE 0 END) as bajas,
                SUM(CASE WHEN estado_relacion = 'ALTA' THEN numero_operaciones ELSE 0 END) as ops_altas,
                SUM(CASE WHEN estado_relacion = 'BAJA' THEN numero_operaciones ELSE 0 END) as ops_bajas
             FROM relaciones WHERE usuario_id = ?`,
            [usuarioId]
        );

        const data = getRows(result)[0] || {};
        res.json({
            total: Number(data.total) || 0,
            altas: Number(data.altas) || 0,
            bajas: Number(data.bajas) || 0,
            ops_altas: Number(data.ops_altas) || 0,
            ops_bajas: Number(data.ops_bajas) || 0
        });
    } catch (error) {
        console.error('[Relaciones] Error statsRelaciones:', error);
        res.status(500).json({ error: error.message });
    }
};

/**
 * DELETE /api/relaciones
 * Limpia todas las relaciones del usuario
 */
exports.limpiarRelaciones = async function(req, res) {
    try {
        const usuarioId = getUsuarioId(req);
        if (!usuarioId) {
            return res.status(401).json({ error: 'No autenticado' });
        }

        const result = await pool.query(
            'DELETE FROM relaciones WHERE usuario_id = ?',
            [usuarioId]
        );

        res.json({
            mensaje: 'Relaciones eliminadas correctamente',
            eliminadas: result.rowCount || 0
        });
    } catch (error) {
        console.error('[Relaciones] Error limpiarRelaciones:', error);
        res.status(500).json({ error: error.message });
    }
};
