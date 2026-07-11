// ============================================================================
// CONTROLADOR DE NOTIFICACIONES
// ============================================================================
// Centro de Notificaciones del sistema.
// Permite al admin enviar notificaciones a usuarios y a los usuarios verlas.
// Arquitectura escalable para futuros tipos de notificaciones.
// ============================================================================

const pool = require('../config/db.js');
const notificationBus = require('../services/notificationBus.js');

// ============================================================================
// LISTAR NOTIFICACIONES (admin: todas | usuario: solo las suyas)
// ============================================================================
// GET /api/admin/notificaciones
exports.listar = async (req, res) => {
    try {
        const { pagina = 1, limite = 20, tipo, leida, archivada = '0' } = req.query;
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

        // Filtro archivadas (por defecto no mostrar archivadas al usuario)
        if (archivada === '0') {
            sql += ` AND (n.archivada IS NULL OR n.archivada = 0 OR n.archivada = FALSE)`;
        } else if (archivada === '1') {
            sql += ` AND (n.archivada = 1 OR n.archivada = TRUE)`;
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
                sql + ` ORDER BY n.leida ASC, n.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
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
        const { titulo, mensaje, tipo = 'info', prioridad = 'normal', destinatario_id, accion_url, accion_texto, fecha_expiracion } = req.body;

        if (!titulo || !mensaje) {
            return res.status(400).json({ error: 'Título y mensaje son requeridos' });
        }

        // Validar prioridad
        const prioridadesValidas = ['baja', 'normal', 'alta', 'critica'];
        const prioridadFinal = prioridadesValidas.includes(prioridad) ? prioridad : 'normal';

        const result = await pool.query(
            `INSERT INTO notificaciones (titulo, mensaje, tipo, prioridad, creador_id, destinatario_id, accion_url, accion_texto, fecha_expiracion, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP)
             RETURNING id`,
            [titulo, mensaje, tipo, prioridadFinal, adminSession.id, destinatario_id || null, accion_url || null, accion_texto || null, fecha_expiracion || null]
        );

        const newId = result.rows?.[0]?.id || result.lastInsertRowid;

        // Auditar
        try {
            await pool.query(
                `INSERT INTO audit_log (usuario_id, accion, target_type, target_id, detalle, ip_address, created_at)
                 VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)`,
                [adminSession.id, 'notification.created', 'notification', newId,
                 JSON.stringify({ titulo, tipo, prioridad: prioridadFinal, destinatario: destinatario_id || 'todos', accion_url }),
                 req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip]
            );
        } catch (e) { /* ignora error de auditoría */ }

        // ====================================================================
        // SSE: Emitir evento en tiempo real a los clientes conectados
        // ====================================================================
        try {
            const notificacion = {
                id: newId,
                titulo,
                mensaje,
                tipo,
                prioridad: prioridadFinal,
                destinatario_id: destinatario_id || null,
                accion_url: accion_url || null,
                accion_texto: accion_texto || null,
                fecha_expiracion: fecha_expiracion || null,
                leida: 0,
                creador_username: adminSession.username,
                created_at: new Date().toISOString()
            };

            // Emitir a todos o a usuario específico
            notificationBus.emitir('notification.created', notificacion, destinatario_id || null);

            // También emitir actualización de contador
            if (destinatario_id) {
                // Emitir count update solo a ese usuario
                const countRes = await pool.query(
                    `SELECT COUNT(*) as total FROM notificaciones WHERE leida = 0 AND (destinatario_id IS NULL OR destinatario_id = $1)`,
                    [destinatario_id]
                );
                notificationBus.emitirAUsuario('count.updated', { no_leidas: parseInt(countRes.rows[0]?.total) || 0 }, destinatario_id);
            } else {
                // Emitir count update global
                notificationBus.emitir('count.updated', { no_leidas: null }); // null = el cliente debe recalcular
            }
        } catch (e) {
            console.error('[Notificaciones] Error SSE:', e.message);
        }

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

        // Emitir a todos que una notificación fue leída
        notificationBus.emitir('notification.read', { id, usuarioId: usuario.id });

        res.json({ mensaje: 'Notificación marcada como leída' });
    } catch (err) {
        console.error('[Notificaciones] Error marcar leída:', err);
        res.status(500).json({ error: err.message });
    }
};

// ============================================================================
// MARCAR TODAS COMO LEÍDAS
// ============================================================================
// PUT /api/admin/notificaciones/marcar-todas-leidas
exports.marcarTodasLeidas = async (req, res) => {
    try {
        const usuario = req.session.usuario;
        const esAdmin = usuario.rol === 'admin' || usuario.rol === 'superadmin' || usuario.is_superadmin;

        let sql = `UPDATE notificaciones SET leida = 1, leida_at = CURRENT_TIMESTAMP WHERE (leida = 0 OR leida = FALSE)`;
        const params = [];

        // Si no es admin, solo marcar sus notificaciones
        if (!esAdmin) {
            sql += ` AND (destinatario_id IS NULL OR destinatario_id = $1)`;
            params.push(usuario.id);
        }

        await pool.query(sql, params);

        // Emitir actualización de contador
        notificationBus.emitir('count.updated', { no_leidas: 0 });

        res.json({ mensaje: 'Todas las notificaciones marcadas como leídas' });
    } catch (err) {
        console.error('[Notificaciones] Error marcar todas:', err);
        res.status(500).json({ error: err.message });
    }
};

// ============================================================================
// ARCHIVAR NOTIFICACIÓN
// ============================================================================
// PUT /api/admin/notificaciones/:id/archivar
exports.archivar = async (req, res) => {
    try {
        const { id } = req.params;
        const usuario = req.session.usuario;

        await pool.query(
            `UPDATE notificaciones SET archivada = 1 WHERE id = $1`,
            [id]
        );

        notificationBus.emitir('notification.archived', { id, usuarioId: usuario.id });

        res.json({ mensaje: 'Notificación archivada' });
    } catch (err) {
        console.error('[Notificaciones] Error archivar:', err);
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

        let sql = `SELECT COUNT(*) as total FROM notificaciones WHERE (leida = 0 OR leida = FALSE)`;
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
// SSE STREAM - Conexión Server-Sent Events
// ============================================================================
// GET /api/admin/notificaciones/stream
exports.streamSSE = async (req, res) => {
    try {
        const usuario = req.session.usuario;
        if (!usuario) {
            res.status(401).json({ error: 'No autenticado' });
            return;
        }

        notificationBus.addClient(res, usuario.id);
        console.log(`[SSE] Cliente conectado: usuario #${usuario.id} (${usuario.username}) - Total: ${notificationBus.clients.size}`);

        // La conexión se mantiene abierta
    } catch (err) {
        console.error('[SSE] Error:', err);
        if (!res.headersSent) {
            res.status(500).json({ error: err.message });
        }
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
