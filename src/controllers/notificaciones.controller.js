// ============================================================================
// CONTROLADOR DE NOTIFICACIONES
// ============================================================================
// Centro de Notificaciones del sistema.
// Permite al admin enviar notificaciones a usuarios y a los usuarios verlas.
// Arquitectura escalable para futuros tipos de notificaciones.
// ============================================================================

const pool = require('../config/db.js');

// ============================================================================
// LISTAR NOTIFICACIONES (admin: todas | usuario: solo las suyas)
// ============================================================================
// GET /api/admin/notificaciones
exports.listar = async (req, res) => {
    try {
        const { pagina = 1, limite = 20, tipo, leida } = req.query;
        const usuario = req.session.usuario;
        const offset = (parseInt(pagina) - 1) * parseInt(limite);
        const esAdmin = usuario.rol === 'admin' || usuario.rol === 'superadmin' || usuario.is_superadmin;

        let sql = `SELECT n.*, u.username as creador_username
                   FROM notificaciones n
                   LEFT JOIN usuarios u ON n.creador_id = u.id
                   WHERE 1=1`;
        const params = [];
        let paramIndex = 1;

        // Filtro: admin ve todas, usuario ve solo las suyas o globales
        if (!esAdmin) {
            sql += ` AND (n.destinatario_id IS NULL OR n.destinatario_id = $${paramIndex++})`;
            params.push(usuario.id);
        }

        if (tipo) {
            sql += ` AND n.tipo = $${paramIndex++}`;
            params.push(tipo);
        }
        if (leida !== undefined && leida !== '') {
            sql += ` AND n.leida = $${paramIndex++}`;
            params.push(leida === '1' || leida === 'true' ? 1 : 0);
        }

        // Contar y obtener datos
        const [countResult, dataResult] = await Promise.all([
            pool.query(`SELECT COUNT(*) as total FROM (${sql}) as filtrados`, params),
            pool.query(
                sql + ` ORDER BY n.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
                [...params, parseInt(limite), offset]
            )
        ]);

        res.json({
            data: dataResult.rows,
            total: parseInt(countResult.rows[0]?.total) || 0,
            pagina: parseInt(pagina),
            limite: parseInt(limite)
        });
    } catch (err) {
        console.error('[Notificaciones] Error listar:', err);
        res.status(500).json({ error: err.message });
    }
};

// ============================================================================
// CREAR NOTIFICACIÓN (solo admin/superadmin)
// ============================================================================
// POST /api/admin/notificaciones
exports.crear = async (req, res) => {
    try {
        const adminSession = req.session.usuario;
        const { titulo, mensaje, tipo = 'info', destinatario_id } = req.body;

        if (!titulo || !mensaje) {
            return res.status(400).json({ error: 'Título y mensaje son requeridos' });
        }

        const result = await pool.query(
            `INSERT INTO notificaciones (titulo, mensaje, tipo, creador_id, destinatario_id, created_at)
             VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
             RETURNING id`,
            [titulo, mensaje, tipo, adminSession.id, destinatario_id || null]
        );

        // Auditar
        try {
            await pool.query(
                `INSERT INTO audit_log (usuario_id, accion, target_type, target_id, detalle, ip_address, created_at)
                 VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)`,
                [adminSession.id, 'notification.created', 'notification', 
                 result.rows?.[0]?.id || result.lastInsertRowid,
                 JSON.stringify({ titulo, tipo, destinatario: destinatario_id || 'todos' }),
                 req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip]
            );
        } catch (e) { /* ignora error de auditoría */ }

        const newId = result.rows?.[0]?.id || result.lastInsertRowid;
        res.json({ mensaje: 'Notificación creada', id: newId });
    } catch (err) {
        console.error('[Notificaciones] Error crear:', err);
        res.status(500).json({ error: err.message });
    }
};

// ============================================================================
// MARCAR COMO LEÍDA
// ============================================================================
// PUT /api/admin/notificaciones/:id/leer
exports.marcarLeida = async (req, res) => {
    try {
        const { id } = req.params;
        const usuario = req.session.usuario;

        await pool.query(
            `UPDATE notificaciones SET leida = 1, leida_at = CURRENT_TIMESTAMP WHERE id = $1`,
            [id]
        );

        res.json({ mensaje: 'Notificación marcada como leída' });
    } catch (err) {
        console.error('[Notificaciones] Error marcar leída:', err);
        res.status(500).json({ error: err.message });
    }
};

// ============================================================================
// CONTAR NO LEÍDAS
// ============================================================================
// GET /api/admin/notificaciones/no-leidas
exports.contarNoLeidas = async (req, res) => {
    try {
        const usuario = req.session.usuario;
        const esAdmin = usuario.rol === 'admin' || usuario.rol === 'superadmin' || usuario.is_superadmin;

        let sql = `SELECT COUNT(*) as total FROM notificaciones WHERE leida = 0`;
        const params = [];

        if (!esAdmin) {
            sql += ` AND (destinatario_id IS NULL OR destinatario_id = $1)`;
            params.push(usuario.id);
        }

        const result = await pool.query(sql, params);
        res.json({ no_leidas: parseInt(result.rows[0]?.total) || 0 });
    } catch (err) {
        console.error('[Notificaciones] Error contar:', err);
        res.json({ no_leidas: 0 });
    }
};

// ============================================================================
// ELIMINAR NOTIFICACIÓN
// ============================================================================
// DELETE /api/admin/notificaciones/:id
exports.eliminar = async (req, res) => {
    try {
        const { id } = req.params;
        await pool.query('DELETE FROM notificaciones WHERE id = $1', [id]);
        res.json({ mensaje: 'Notificación eliminada' });
    } catch (err) {
        console.error('[Notificaciones] Error eliminar:', err);
        res.status(500).json({ error: err.message });
    }
};
