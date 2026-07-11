// ============================================================================
// CONTROLADOR DE ADMINISTRACIÓN
// ============================================================================
// Gestiona usuarios del sistema, estadísticas y logs de auditoría.
// Todas las rutas están protegidas por requiresRole('admin', 'superadmin')
// ============================================================================

const bcrypt = require('bcryptjs');
const pool = require('../config/db.js');

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Obtiene la IP real del cliente (funciona detrás de proxies/Render).
 */
function getClientIp(req) {
    return req.headers['x-forwarded-for']?.split(',')[0]?.trim()
        || req.ip
        || req.connection?.remoteAddress
        || '0.0.0.0';
}

/**
 * Registra una acción en audit_log.
 */
async function auditar(usuarioId, accion, targetType, targetId, detalle, req) {
    try {
        await pool.query(
            `INSERT INTO audit_log (usuario_id, accion, target_type, target_id, detalle, ip_address, user_agent)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [
                usuarioId,
                accion,
                targetType || null,
                targetId || null,
                detalle ? JSON.stringify(detalle) : null,
                req ? getClientIp(req) : null,
                req ? (req.headers['user-agent'] || null) : null
            ]
        );
    } catch (err) {
        console.error('[Admin] Error en auditoría:', err.message);
    }
}

// ============================================================================
// LISTAR USUARIOS (con filtros y paginación)
// ============================================================================
// GET /api/admin/usuarios?q=&rol=&estado=&pagina=1&limite=20
exports.listarUsuarios = async (req, res) => {
    try {
        const {
            q = '',           // Búsqueda (username, nombre, email)
            rol = '',         // Filtrar por rol
            estado = '',      // 'activo', 'inactivo', 'bloqueado'
            pagina = 1,
            limite = 20
        } = req.query;

        const offset = (parseInt(pagina) - 1) * parseInt(limite);

        let sql = `SELECT id, username, nombre, email, email_verified, rol,
                          is_active, is_superadmin, failed_login_attempts, locked_until,
                          password_changed_at, created_at, updated_at, last_login
                   FROM usuarios WHERE 1=1`;
        const params = [];
        let paramIndex = 1;

        // Búsqueda general (LOWER LIKE para compatibilidad SQLite y PostgreSQL)
        if (q && q.trim()) {
            const termino = '%' + q.trim() + '%';
            sql += ` AND (LOWER(username) LIKE LOWER($${paramIndex})
                        OR LOWER(COALESCE(nombre, '')) LIKE LOWER($${paramIndex})
                        OR LOWER(COALESCE(email, '')) LIKE LOWER($${paramIndex}))`;
            params.push(termino);
            paramIndex++;
        }

        // Filtro por rol
        if (rol) {
            sql += ` AND rol = $${paramIndex}`;
            params.push(rol);
            paramIndex++;
        }

        // Filtro por estado
        if (estado === 'activo') {
            sql += ' AND is_active = TRUE AND (locked_until IS NULL OR locked_until < CURRENT_TIMESTAMP)';
        } else if (estado === 'inactivo') {
            sql += ' AND is_active = FALSE';
        } else if (estado === 'bloqueado') {
            sql += ' AND locked_until > CURRENT_TIMESTAMP';
        }

        // Ejecutar query de datos y conteo en paralelo
        const [dataResult, countResult] = await Promise.all([
            pool.query(sql + ` ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
                [...params, parseInt(limite), offset]),
            pool.query(`SELECT COUNT(*) as total FROM (${sql}) as filtrados`, params)
        ]);

        res.json({
            data: dataResult.rows,
            total: parseInt(countResult.rows[0]?.total) || 0,
            pagina: parseInt(pagina),
            limite: parseInt(limite)
        });
    } catch (err) {
        console.error('[Admin] Error listarUsuarios:', err);
        res.status(500).json({ error: err.message });
    }
};

// ============================================================================
// OBTENER USUARIO POR ID
// ============================================================================
// GET /api/admin/usuarios/:id
exports.obtenerUsuario = async (req, res) => {
    try {
        const { id } = req.params;

        const result = await pool.query(
            `SELECT id, username, nombre, email, email_verified, rol,
                    is_active, is_superadmin, failed_login_attempts, locked_until,
                    password_changed_at, created_at, updated_at, last_login
             FROM usuarios WHERE id = $1`,
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }

        res.json(result.rows[0]);
    } catch (err) {
        console.error('[Admin] Error obtenerUsuario:', err);
        res.status(500).json({ error: err.message });
    }
};

// ============================================================================
// ACTUALIZAR USUARIO
// ============================================================================
// PUT /api/admin/usuarios/:id
// Solo superadmin puede cambiar is_superadmin o promover a admin
exports.actualizarUsuario = async (req, res) => {
    try {
        const { id } = req.params;
        const adminSession = req.session.usuario;
        const { nombre, email, rol, is_active } = req.body;

        // Obtener usuario objetivo
        const userResult = await pool.query('SELECT * FROM usuarios WHERE id = $1', [id]);
        if (userResult.rows.length === 0) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }
        const targetUser = userResult.rows[0];

        // ================================================================
        // REGLAS DE SEGURIDAD (protección contra escalamiento)
        // ================================================================

        // 1. Un admin NO puede modificar a otro admin
        if (targetUser.rol === 'admin' && adminSession.rol !== 'superadmin') {
            return res.status(403).json({ error: 'No puedes modificar a otro administrador' });
        }

        // 2. Un admin NO puede autopromoverse a superadmin
        if (parseInt(id) === adminSession.id && rol === 'superadmin' && adminSession.rol !== 'superadmin') {
            return res.status(403).json({ error: 'No puedes autopromoverte a superadmin' });
        }

        // 3. Solo superadmin puede cambiar is_superadmin
        if (req.body.is_superadmin !== undefined && adminSession.rol !== 'superadmin') {
            return res.status(403).json({ error: 'Solo un superadmin puede cambiar este campo' });
        }

        // 4. Solo superadmin puede asignar rol admin
        if (rol === 'admin' && adminSession.rol !== 'superadmin') {
            return res.status(403).json({ error: 'Solo un superadmin puede asignar el rol admin' });
        }

        // 5. Un admin no puede desactivar a otro admin
        if (is_active === false && targetUser.rol === 'admin' && adminSession.rol !== 'superadmin') {
            return res.status(403).json({ error: 'No puedes desactivar a otro administrador' });
        }

        // Construir UPDATE dinámico
        const updates = [];
        const params = [];
        let paramIndex = 1;

        if (nombre !== undefined) {
            updates.push(`nombre = $${paramIndex++}`);
            params.push(nombre);
        }
        if (email !== undefined) {
            updates.push(`email = $${paramIndex++}`);
            params.push(email);
        }
        if (rol !== undefined) {
            updates.push(`rol = $${paramIndex++}`);
            params.push(rol);
        }
        if (is_active !== undefined) {
            updates.push(`is_active = $${paramIndex++}`);
            params.push(is_active);
        }
        if (req.body.is_superadmin !== undefined) {
            const val = req.body.is_superadmin === true || req.body.is_superadmin === 'true';
            updates.push(`is_superadmin = $${paramIndex++}`);
            params.push(val);
        }

        if (updates.length === 0) {
            return res.status(400).json({ error: 'No hay campos para actualizar' });
        }

        updates.push(`updated_at = CURRENT_TIMESTAMP`);
        params.push(id);

        const result = await pool.query(
            `UPDATE usuarios SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING id, username, nombre, email, rol, is_active, is_superadmin`,
            params
        );

        // Auditoría
        await auditar(adminSession.id, 'user.updated', 'user', parseInt(id),
            { cambios: req.body, anterior: { rol: targetUser.rol, is_active: targetUser.is_active } }, req);

        res.json({ mensaje: 'Usuario actualizado', data: result.rows[0] });
    } catch (err) {
        console.error('[Admin] Error actualizarUsuario:', err);
        res.status(500).json({ error: err.message });
    }
};

// ============================================================================
// CREAR USUARIO (admin)
// ============================================================================
// POST /api/admin/usuarios
exports.crearUsuario = async (req, res) => {
    try {
        const adminSession = req.session.usuario;
        const { username, password, nombre, email, rol = 'user' } = req.body;

        if (!username || !password) {
            return res.status(400).json({ error: 'Usuario y contraseña son requeridos' });
        }

        // Validar contraseña
        if (password.length < 8 || !/[A-Z]/.test(password) || !/[0-9]/.test(password)) {
            return res.status(400).json({
                error: 'Contraseña debe tener mínimo 8 caracteres, una mayúscula y un número'
            });
        }

        // Solo superadmin puede crear admins
        if (rol === 'admin' && adminSession.rol !== 'superadmin') {
            return res.status(403).json({ error: 'Solo un superadmin puede crear administradores' });
        }

        const passwordHash = bcrypt.hashSync(password, 10);

        const result = await pool.query(
            `INSERT INTO usuarios (username, password, nombre, email, rol, updated_at)
             VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
             RETURNING id, username, nombre, email, rol`,
            [username, passwordHash, nombre || username, email || null, rol]
        );

        const newUser = result.rows[0];
        const usuarioId = result.lastInsertRowid || newUser?.id;

        await auditar(adminSession.id, 'user.created', 'user', usuarioId || newUser?.id,
            { username, rol, creado_por: adminSession.username }, req);

        res.json({ mensaje: 'Usuario creado', data: newUser });
    } catch (err) {
        if (err.code === '23505' || err.message?.includes('UNIQUE')) {
            return res.status(400).json({ error: 'El usuario ya existe' });
        }
        console.error('[Admin] Error crearUsuario:', err);
        res.status(500).json({ error: err.message });
    }
};

// ============================================================================
// RESETEAR CONTRASEÑA
// ============================================================================
// PUT /api/admin/usuarios/:id/reset-password
exports.resetPassword = async (req, res) => {
    try {
        const { id } = req.params;
        const adminSession = req.session.usuario;
        const { nueva_password } = req.body;

        if (!nueva_password || nueva_password.length < 8 || !/[A-Z]/.test(nueva_password) || !/[0-9]/.test(nueva_password)) {
            return res.status(400).json({
                error: 'La contraseña debe tener mínimo 8 caracteres, una mayúscula y un número'
            });
        }

        // Verificar que el usuario existe
        const userResult = await pool.query('SELECT id, username, rol FROM usuarios WHERE id = $1', [id]);
        if (userResult.rows.length === 0) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }

        const targetUser = userResult.rows[0];

        // Un admin no puede resetear password de otro admin
        if (targetUser.rol === 'admin' && adminSession.rol !== 'superadmin') {
            return res.status(403).json({ error: 'No puedes resetear la contraseña de otro administrador' });
        }

        const passwordHash = bcrypt.hashSync(nueva_password, 10);

        await pool.query(
            `UPDATE usuarios SET password = $1, password_changed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
            [passwordHash, id]
        );

        await auditar(adminSession.id, 'user.password_reset', 'user', parseInt(id),
            { username: targetUser.username }, req);

        res.json({ mensaje: 'Contraseña actualizada correctamente' });
    } catch (err) {
        console.error('[Admin] Error resetPassword:', err);
        res.status(500).json({ error: err.message });
    }
};

// ============================================================================
// ACTIVAR / DESACTIVAR USUARIO
// ============================================================================
// PUT /api/admin/usuarios/:id/toggle-active
exports.toggleActivo = async (req, res) => {
    try {
        const { id } = req.params;
        const adminSession = req.session.usuario;

        const userResult = await pool.query('SELECT id, username, rol, is_active FROM usuarios WHERE id = $1', [id]);
        if (userResult.rows.length === 0) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }

        const targetUser = userResult.rows[0];

        // Un admin no puede desactivar a otro admin
        if (targetUser.rol === 'admin' && adminSession.rol !== 'superadmin') {
            return res.status(403).json({ error: 'No puedes desactivar a otro administrador' });
        }

        // No se puede desactivar a uno mismo
        if (parseInt(id) === adminSession.id) {
            return res.status(400).json({ error: 'No puedes desactivarte a ti mismo' });
        }

        const nuevoEstado = !targetUser.is_active;

        await pool.query(
            `UPDATE usuarios SET is_active = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
            [nuevoEstado, id]
        );

        await auditar(adminSession.id, nuevoEstado ? 'user.activated' : 'user.deactivated', 'user', parseInt(id),
            { username: targetUser.username }, req);

        res.json({
            mensaje: nuevoEstado ? 'Usuario activado' : 'Usuario desactivado',
            is_active: nuevoEstado
        });
    } catch (err) {
        console.error('[Admin] Error toggleActivo:', err);
        res.status(500).json({ error: err.message });
    }
};

// ============================================================================
// DESBLOQUEAR USUARIO
// ============================================================================
// PUT /api/admin/usuarios/:id/unlock
exports.desbloquearUsuario = async (req, res) => {
    try {
        const { id } = req.params;
        const adminSession = req.session.usuario;

        const result = await pool.query(
            `UPDATE usuarios SET
                failed_login_attempts = 0,
                locked_until = NULL,
                updated_at = CURRENT_TIMESTAMP
             WHERE id = $1
             RETURNING id, username`,
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }

        await auditar(adminSession.id, 'user.unlocked', 'user', parseInt(id),
            { username: result.rows[0].username }, req);

        res.json({ mensaje: 'Usuario desbloqueado', data: result.rows[0] });
    } catch (err) {
        console.error('[Admin] Error desbloquearUsuario:', err);
        res.status(500).json({ error: err.message });
    }
};

// ============================================================================
// ESTADÍSTICAS DEL SISTEMA
// ============================================================================
// GET /api/admin/estadisticas
exports.estadisticas = async (req, res) => {
    try {
        // Usar Promise.all para ejecutar todas las consultas en paralelo
        const [
            totalUsuarios,
            usuariosPorRol,
            usuariosPorEstado,
            usuariosHoy,
            usuariosSemana,
            usuariosSinLogin,
            solicitudesCount,
            relacionesCount,
            gestionesCount,
            intentosFallidos
        ] = await Promise.all([
            pool.query('SELECT COUNT(*) as total FROM usuarios'),
            pool.query('SELECT rol, COUNT(*) as total FROM usuarios GROUP BY rol ORDER BY total DESC'),
            pool.query(`SELECT
                SUM(CASE WHEN is_active = TRUE AND (locked_until IS NULL OR locked_until < CURRENT_TIMESTAMP) THEN 1 ELSE 0 END) as activos,
                SUM(CASE WHEN is_active = FALSE THEN 1 ELSE 0 END) as inactivos,
                SUM(CASE WHEN locked_until > CURRENT_TIMESTAMP THEN 1 ELSE 0 END) as bloqueados
                FROM usuarios`),
            pool.query("SELECT COUNT(*) as total FROM usuarios WHERE created_at >= CURRENT_DATE"),
            pool.query("SELECT COUNT(*) as total FROM usuarios WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'"),
            pool.query("SELECT COUNT(*) as total FROM usuarios WHERE last_login IS NULL OR last_login < CURRENT_DATE - INTERVAL '30 days'"),
            pool.query('SELECT COUNT(*) as total FROM solicitudes'),
            pool.query('SELECT COUNT(*) as total FROM relaciones'),
            pool.query('SELECT COUNT(*) as total FROM gestiones'),
            pool.query("SELECT COUNT(*) as total FROM audit_log WHERE accion LIKE 'login.failed' AND created_at >= CURRENT_DATE - INTERVAL '24 hours'")
        ]);

        res.json({
            usuarios: {
                total: parseInt(totalUsuarios.rows[0]?.total) || 0,
                por_rol: usuariosPorRol.rows,
                estado: usuariosPorEstado.rows[0] || { activos: 0, inactivos: 0, bloqueados: 0 },
                nuevos_hoy: parseInt(usuariosHoy.rows[0]?.total) || 0,
                nuevos_semana: parseInt(usuariosSemana.rows[0]?.total) || 0,
                sin_login_reciente: parseInt(usuariosSinLogin.rows[0]?.total) || 0
            },
            datos: {
                solicitudes: parseInt(solicitudesCount.rows[0]?.total) || 0,
                relaciones: parseInt(relacionesCount.rows[0]?.total) || 0,
                gestiones: parseInt(gestionesCount.rows[0]?.total) || 0
            },
            seguridad: {
                intentos_fallidos_24h: parseInt(intentosFallidos.rows[0]?.total) || 0
            }
        });
    } catch (err) {
        console.error('[Admin] Error estadisticas:', err);
        res.status(500).json({ error: err.message });
    }
};

// ============================================================================
// LOGS DE AUDITORÍA
// ============================================================================
// GET /api/admin/auditoria?pagina=1&limite=50&accion=
exports.auditoria = async (req, res) => {
    try {
        const {
            accion = '',
            usuario_id = '',
            pagina = 1,
            limite = 50
        } = req.query;

        const offset = (parseInt(pagina) - 1) * parseInt(limite);

        let sql = `SELECT al.*, u.username as usuario_username
                   FROM audit_log al
                   LEFT JOIN usuarios u ON al.usuario_id = u.id
                   WHERE 1=1`;
        const params = [];
        let paramIndex = 1;

        if (accion) {
            sql += ` AND LOWER(al.accion) LIKE LOWER($${paramIndex++})`;
            params.push('%' + accion + '%');
        }

        if (usuario_id) {
            sql += ` AND al.usuario_id = $${paramIndex++}`;
            params.push(parseInt(usuario_id));
        }

        // Count y datos en paralelo
        const [countResult, dataResult] = await Promise.all([
            pool.query(`SELECT COUNT(*) as total FROM (${sql}) as filtrados`, params),
            pool.query(
                sql + ` ORDER BY al.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
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
        console.error('[Admin] Error auditoria:', err);
        res.status(500).json({ error: err.message });
    }
};
