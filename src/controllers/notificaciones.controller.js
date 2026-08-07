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
        const { pagina = 1, limite = 20, tipo, leida, archivada, q } = req.query;
        const usuario = req.session.usuario;
        const limiteInt = Math.min(parseInt(limite) || 20, 200);
        const offset = (parseInt(pagina) - 1) * limiteInt;
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
        if (archivada !== undefined && archivada !== '') {
            // ?archivada=1 → solo archivadas ; ?archivada=0 → solo activas
            const val = archivada === '1' || archivada === 'true' ? 1 : 0;
            if (val === 1) {
                // Solo archivadas: NULL (legacy) se trata como NO archivada
                sql += ` AND n.archivada = $${paramIndex++}`;
            } else {
                sql += ` AND (n.archivada = $${paramIndex++} OR n.archivada IS NULL)`;
            }
            params.push(val);
        } else {
            // Por defecto: ocultar las archivadas (dejan de reaparecer en el menú)
            sql += ` AND (n.archivada = 0 OR n.archivada IS NULL)`;
        }

        if (q) {
            const termino = `%${String(q).trim()}%`;
            sql += ` AND (UPPER(n.titulo) LIKE UPPER($${paramIndex++}) OR UPPER(n.mensaje) LIKE UPPER($${paramIndex++}))`;
            params.push(termino, termino);
        }

        // Contar y obtener datos
        const [countResult, dataResult] = await Promise.all([
            pool.query(`SELECT COUNT(*) as total FROM (${sql}) as filtrados`, params),
            pool.query(
                sql + ` ORDER BY n.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
                [...params, limiteInt, offset]
            )
        ]);

        res.json({
            data: dataResult.rows,
            total: parseInt(countResult.rows[0]?.total) || 0,
            pagina: parseInt(pagina),
            limite: limiteInt
        });
    } catch (err) {
        console.error('[Notificaciones] Error listar:', err);
        console.warn('[Notificaciones] Usando fallback - verificar migración de columnas en PostgreSQL');
        // Fallback seguro: misma semántica de filtros que la consulta principal
        try {
            let fallbackSql = `SELECT n.id, n.titulo, n.mensaje, n.tipo, n.prioridad, n.leida, n.es_novedad,
                                      n.archivada, n.created_at, n.destinatario_id, n.creador_id,
                                      n.accion_url, n.accion_texto, n.accion_modulo, n.fecha_expiracion,
                                      n.recordatorio_id, u.username as creador_username
                               FROM notificaciones n
                               LEFT JOIN usuarios u ON n.creador_id = u.id WHERE 1=1`;
            const fallbackParams = [];
            let fbParamIndex = 1;

            if (!esAdmin) {
                fallbackSql += ` AND (n.destinatario_id IS NULL OR n.destinatario_id = $${fbParamIndex++})`;
                fallbackParams.push(usuario.id);
            }
            if (tipo) {
                fallbackSql += ` AND n.tipo = $${fbParamIndex++}`;
                fallbackParams.push(tipo);
            }
            if (leida !== undefined && leida !== '') {
                fallbackSql += ` AND n.leida = $${fbParamIndex++}`;
                fallbackParams.push(leida === '1' || leida === 'true' ? 1 : 0);
            }
            if (archivada !== undefined && archivada !== '') {
                const val = archivada === '1' || archivada === 'true' ? 1 : 0;
                if (val === 1) {
                    fallbackSql += ` AND n.archivada = $${fbParamIndex++}`;
                } else {
                    fallbackSql += ` AND (n.archivada = $${fbParamIndex++} OR n.archivada IS NULL)`;
                }
                fallbackParams.push(val);
            } else {
                fallbackSql += ` AND (n.archivada = 0 OR n.archivada IS NULL)`;
            }
            if (q) {
                const termino = `%${String(q).trim()}%`;
                fallbackSql += ` AND (UPPER(n.titulo) LIKE UPPER($${fbParamIndex++}) OR UPPER(n.mensaje) LIKE UPPER($${fbParamIndex++}))`;
                fallbackParams.push(termino, termino);
            }

            const totalRes = await pool.query(`SELECT COUNT(*) as total FROM (${fallbackSql}) as filtrados`, fallbackParams);
            fallbackSql += ` ORDER BY n.created_at DESC LIMIT $${fbParamIndex++} OFFSET $${fbParamIndex++}`;
            fallbackParams.push(limiteInt, offset);

            const fallback = await pool.query(fallbackSql, fallbackParams);
            res.json({
                data: fallback.rows,
                total: parseInt(totalRes.rows[0]?.total) || 0,
                pagina: parseInt(pagina),
                limite: limiteInt,
                fallback: true
            });
        } catch (fallbackErr) {
            console.error('[Notificaciones] Error listar (fallback):', fallbackErr);
            res.status(500).json({ error: err.message });
        }
    }
};

// ============================================================================
// CREAR NOTIFICACIÓN (solo admin/superadmin)
// ============================================================================
// POST /api/admin/notificaciones
exports.crear = async (req, res) => {
    try {
        const adminSession = req.session.usuario;
        const { titulo, mensaje, tipo = 'info', prioridad = 'normal', destinatario_id, accion_url, accion_texto, fecha_expiracion, accion_modulo, es_novedad } = req.body;

        if (!titulo || !mensaje) {
            return res.status(400).json({ error: 'Título y mensaje son requeridos' });
        }

        // Validar prioridad
        const prioridadesValidas = ['baja', 'normal', 'alta', 'critica'];
        const prioridadFinal = prioridadesValidas.includes(prioridad) ? prioridad : 'normal';

        const result = await pool.query(
            `INSERT INTO notificaciones (titulo, mensaje, tipo, prioridad, creador_id, destinatario_id, accion_url, accion_texto, fecha_expiracion, accion_modulo, es_novedad, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, CURRENT_TIMESTAMP)
             RETURNING id`,
            [titulo, mensaje, tipo, prioridadFinal, adminSession.id, destinatario_id || null, accion_url || null, accion_texto || null, fecha_expiracion || null, accion_modulo || null, Number(es_novedad) ? 1 : 0]
        );

        const newId = result.rows?.[0]?.id || result.lastInsertRowid;

        // Auditar
        try {
            await pool.query(
                `INSERT INTO audit_log (usuario_id, accion, target_type, target_id, detalle, ip_address, created_at)
                 VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)`,
                [adminSession.id, 'notification.created', 'notification', newId,
                 JSON.stringify({ titulo, tipo, prioridad: prioridadFinal, destinatario: destinatario_id || 'todos', accion_url, es_novedad: Number(es_novedad) ? 1 : 0 }),
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
                accion_modulo: accion_modulo || null,  // 🆕 Deep Link Router
                es_novedad: Number(es_novedad) ? 1 : 0,  // 🆕 Novedades: anuncio de funcionalidad
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
                    `SELECT COUNT(*) as total FROM notificaciones WHERE leida = 0 AND (archivada = 0 OR archivada IS NULL) AND (destinatario_id IS NULL OR destinatario_id = $1)`,
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
        const esAdmin = usuario.rol === 'admin' || usuario.rol === 'superadmin' || usuario.is_superadmin;
        // ?archivar=1 → leer y archivar en una sola operación (consumir)
        const archivarTambien = req.query.archivar === '1' || req.query.archivar === 'true';

        const existe = await pool.query(
            `SELECT id, destinatario_id FROM notificaciones WHERE id = $1`,
            [id]
        );
        const notif = existe.rows?.[0];
        if (!notif) {
            return res.status(404).json({ error: 'Notificación no encontrada' });
        }
        // Scoping: un no-admin solo puede leer notificaciones suyas o globales
        if (!esAdmin && notif.destinatario_id != null && Number(notif.destinatario_id) !== usuario.id) {
            return res.status(403).json({ error: 'No tienes permiso para esta notificación' });
        }

        await pool.query(
            `UPDATE notificaciones SET leida = 1, leida_at = CURRENT_TIMESTAMP,
             archivada = CASE WHEN $2 = 1 THEN 1 WHEN es_novedad = 1 THEN 1 ELSE archivada END
             WHERE id = $1`,
            [id, archivarTambien ? 1 : 0]
        );

        // Emitir solo al destinatario (o a todos si es global)
        const evento = archivarTambien ? 'notification.archived' : 'notification.read';
        const payload = { id, usuarioId: usuario.id, leida: 1, archivada: archivarTambien ? 1 : 0 };
        if (notif.destinatario_id != null) {
            notificationBus.emitirAUsuario(evento, payload, Number(notif.destinatario_id));
        } else {
            notificationBus.emitir(evento, payload);
        }

        res.json({
            mensaje: archivarTambien
                ? 'Notificación marcada como leída y archivada'
                : 'Notificación marcada como leída'
        });
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

        // "Marcar todas" consume: marca leídas Y archiva todo lo activo del usuario
        let sql = `UPDATE notificaciones SET leida = 1, leida_at = CURRENT_TIMESTAMP, archivada = 1
                   WHERE leida = 0 AND (archivada = 0 OR archivada IS NULL)`;
        const params = [];

        // Si no es admin, solo marcar sus notificaciones
        if (!esAdmin) {
            sql += ` AND (destinatario_id IS NULL OR destinatario_id = $1)`;
            params.push(usuario.id);
        }

        await pool.query(sql, params);

        // Emitir actualización de contador (null = el cliente recalcula su propio conteo)
        if (esAdmin) {
            notificationBus.emitir('count.updated', { no_leidas: null });
        } else {
            notificationBus.emitirAUsuario('count.updated', { no_leidas: null }, usuario.id);
        }

        res.json({ mensaje: 'Todas las notificaciones marcadas como leídas y archivadas' });
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
        const esAdmin = usuario.rol === 'admin' || usuario.rol === 'superadmin' || usuario.is_superadmin;

        const existe = await pool.query(
            `SELECT id, destinatario_id FROM notificaciones WHERE id = $1`,
            [id]
        );
        const notif = existe.rows?.[0];
        if (!notif) {
            return res.status(404).json({ error: 'Notificación no encontrada' });
        }
        // Scoping: un no-admin solo puede archivar notificaciones suyas o globales
        if (!esAdmin && notif.destinatario_id != null && Number(notif.destinatario_id) !== usuario.id) {
            return res.status(403).json({ error: 'No tienes permiso para esta notificación' });
        }

        await pool.query(
            `UPDATE notificaciones SET archivada = 1 WHERE id = $1`,
            [id]
        );

        const payload = { id, usuarioId: usuario.id, archivada: 1 };
        if (notif.destinatario_id != null) {
            notificationBus.emitirAUsuario('notification.archived', payload, Number(notif.destinatario_id));
        } else {
            notificationBus.emitir('notification.archived', payload);
        }

        res.json({ mensaje: 'Notificación archivada' });
    } catch (err) {
        console.error('[Notificaciones] Error archivar:', err);
        res.status(500).json({ error: err.message });
    }
};

// ============================================================================
// RESTAURAR NOTIFICACIÓN ARCHIVADA
// ============================================================================
// PUT /api/admin/notificaciones/:id/restaurar
exports.restaurar = async (req, res) => {
    try {
        const { id } = req.params;
        const usuario = req.session.usuario;
        const esAdmin = usuario.rol === 'admin' || usuario.rol === 'superadmin' || usuario.is_superadmin;

        const existe = await pool.query(
            `SELECT id, destinatario_id FROM notificaciones WHERE id = $1`,
            [id]
        );
        const notif = existe.rows?.[0];
        if (!notif) {
            return res.status(404).json({ error: 'Notificación no encontrada' });
        }
        // Scoping: un no-admin solo puede restaurar notificaciones suyas o globales
        if (!esAdmin && notif.destinatario_id != null && Number(notif.destinatario_id) !== usuario.id) {
            return res.status(403).json({ error: 'No tienes permiso para esta notificación' });
        }

        await pool.query(
            `UPDATE notificaciones SET archivada = 0, leida = 0 WHERE id = $1`,
            [id]
        );

        const payload = { id, usuarioId: usuario.id, archivada: 0 };
        if (notif.destinatario_id != null) {
            notificationBus.emitirAUsuario('notification.archived', payload, Number(notif.destinatario_id));
        } else {
            notificationBus.emitir('notification.archived', payload);
        }

        res.json({ mensaje: 'Notificación restaurada' });
    } catch (err) {
        console.error('[Notificaciones] Error restaurar:', err);
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

        let sql = `SELECT COUNT(*) as total FROM notificaciones WHERE leida = 0 AND (archivada = 0 OR archivada IS NULL)`;
        const params = [];

        if (!esAdmin) {
            sql += ` AND (destinatario_id IS NULL OR destinatario_id = $1)`;
            params.push(usuario.id);
        }

        const result = await pool.query(sql, params);
        res.json({ no_leidas: parseInt(result.rows[0]?.total) || 0 });
    } catch (err) {
        console.error('[Notificaciones] Error contar:', err);
        res.status(500).json({ error: err.message, no_leidas: 0 });
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
