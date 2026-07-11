const bcrypt = require('bcryptjs');
const pool = require('../config/db.js');

// ============================================================================
// HELPERS DE SEGURIDAD
// ============================================================================

const MAX_LOGIN_ATTEMPTS = 5;
const LOCK_DURATION_MINUTES = 15;

/**
 * Valida que la contraseña cumpla con los requisitos mínimos de seguridad.
 * - Mínimo 8 caracteres
 * - Al menos 1 número
 * - Al menos 1 letra mayúscula
 */
function validarPassword(password) {
    const errores = [];
    if (!password || password.length < 8) {
        errores.push('La contraseña debe tener al menos 8 caracteres');
    }
    if (!/[A-Z]/.test(password)) {
        errores.push('La contraseña debe contener al menos una letra mayúscula');
    }
    if (!/[0-9]/.test(password)) {
        errores.push('La contraseña debe contener al menos un número');
    }
    return errores;
}

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
 * Registra una acción en el log de auditoría.
 */
async function registrarAuditoria(usuarioId, accion, targetType, targetId, detalle, req) {
    try {
        // Intentar insertar en audit_log
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
        // No debe afectar al flujo principal si la auditoría falla
        console.error('[Auditoría] Error al registrar:', err.message);
    }
}

// ============================================================================
// REGISTRO DE USUARIO
// ============================================================================
exports.registrar = async (req, res) => {
    const { username, password, nombre, email } = req.body;

    if (!username || !password) {
        return res.status(400).json({
            error: 'Usuario y contraseña son requeridos'
        });
    }

    // Validar fortaleza de contraseña
    const erroresPassword = validarPassword(password);
    if (erroresPassword.length > 0) {
        return res.status(400).json({
            error: 'Contraseña débil',
            detalles: erroresPassword
        });
    }

    try {
        // Hashear contraseña
        const passwordHash = bcrypt.hashSync(password, 10);

        const result = await pool.query(
            `INSERT INTO usuarios (username, password, nombre, email, password_changed_at, updated_at)
             VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
            [username, passwordHash, nombre || username, email || null]
        );

        // Obtener el ID insertado
        const usuarioId = result.lastInsertRowid || (result.rows && result.rows[0] && result.rows[0].id);

        // Registrar en auditoría
        await registrarAuditoria(usuarioId, 'user.created', 'user', usuarioId,
            { username, metodo: 'registro' }, req);

        res.json({
            mensaje: 'Usuario registrado correctamente',
            usuarioId: usuarioId || 1
        });
    } catch (err) {
        if (err.code === '23505' || err.message?.includes('UNIQUE')) {
            return res.status(400).json({
                error: 'El usuario ya existe'
            });
        }
        res.status(500).json({
            error: err.message
        });
    }
};

// ============================================================================
// LOGIN DE USUARIO (CON SEGURIDAD MEJORADA)
// ============================================================================
exports.login = async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({
            error: 'Usuario y contraseña son requeridos'
        });
    }

    try {
        const result = await pool.query(
            'SELECT * FROM usuarios WHERE username = $1',
            [username]
        );

        const usuario = result.rows[0];

        if (!usuario) {
            // No revelar si el usuario existe o no (seguridad por oscuridad parcial)
            return res.status(401).json({
                error: 'Usuario o contraseña incorrectos'
            });
        }

        // ================================================================
        // VERIFICACIONES DE SEGURIDAD
        // ================================================================

        // 1. Verificar si la cuenta está bloqueada temporalmente
        if (usuario.locked_until) {
            const lockedUntil = new Date(usuario.locked_until);
            if (lockedUntil > new Date()) {
                const minutosRestantes = Math.ceil((lockedUntil - new Date()) / 60000);
                return res.status(423).json({
                    error: `Cuenta bloqueada temporalmente. Intenta en ${minutosRestantes} minuto(s).`,
                    locked_until: usuario.locked_until
                });
            }
            // El bloqueo expiró, resetear contador y desbloquear
            await pool.query(
                `UPDATE usuarios SET failed_login_attempts = 0, locked_until = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
                [usuario.id]
            );
        }

        // 2. Verificar si la cuenta está activa
        if (usuario.is_active === false || usuario.is_active === 0) {
            await registrarAuditoria(usuario.id, 'login.blocked', 'user', usuario.id,
                { motivo: 'Cuenta desactivada', ip: getClientIp(req) }, req);
            return res.status(403).json({
                error: 'Cuenta desactivada. Contacta al administrador.'
            });
        }

        // 3. Verificar contraseña
        const passwordValido = bcrypt.compareSync(password, usuario.password);

        if (!passwordValido) {
            // Incrementar contador de intentos fallidos
            const newAttempts = (usuario.failed_login_attempts || 0) + 1;

            if (newAttempts >= MAX_LOGIN_ATTEMPTS) {
                // Bloquear cuenta temporalmente
                await pool.query(
                    `UPDATE usuarios SET
                        failed_login_attempts = $1,
                        locked_until = CURRENT_TIMESTAMP + INTERVAL '${LOCK_DURATION_MINUTES} minutes',
                        updated_at = CURRENT_TIMESTAMP
                     WHERE id = $2`,
                    [newAttempts, usuario.id]
                );
                await registrarAuditoria(usuario.id, 'login.locked', 'user', usuario.id,
                    { motivo: 'Demasiados intentos fallidos', intentos: newAttempts }, req);
                return res.status(423).json({
                    error: `Demasiados intentos fallidos. Cuenta bloqueada por ${LOCK_DURATION_MINUTES} minutos.`
                });
            }

            await pool.query(
                `UPDATE usuarios SET failed_login_attempts = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
                [newAttempts, usuario.id]
            );

            return res.status(401).json({
                error: 'Usuario o contraseña incorrectos',
                intentos_restantes: MAX_LOGIN_ATTEMPTS - newAttempts
            });
        }

        // ================================================================
        // LOGIN EXITOSO - Resetear contadores y actualizar datos
        // ================================================================

        // Resetear intentos fallidos
        await pool.query(
            `UPDATE usuarios SET
                failed_login_attempts = 0,
                locked_until = NULL,
                last_login = CURRENT_TIMESTAMP,
                password_changed_at = COALESCE(password_changed_at, CURRENT_TIMESTAMP),
                updated_at = CURRENT_TIMESTAMP
             WHERE id = $1`,
            [usuario.id]
        );

        // Guardar usuario en sesión (incluyendo nuevas propiedades de seguridad)
        req.session.usuario = {
            id: usuario.id,
            username: usuario.username,
            nombre: usuario.nombre,
            email: usuario.email || null,
            rol: usuario.rol || 'user',
            is_active: usuario.is_active,
            is_superadmin: usuario.is_superadmin || false
        };

        // Registrar login exitoso en auditoría
        await registrarAuditoria(usuario.id, 'login.success', 'user', usuario.id,
            { ip: getClientIp(req) }, req);

        res.json({
            mensaje: 'Login exitoso',
            usuario: {
                id: usuario.id,
                username: usuario.username,
                nombre: usuario.nombre,
                email: usuario.email || null,
                rol: usuario.rol || 'user',
                is_active: usuario.is_active,
                is_superadmin: usuario.is_superadmin || false
            }
        });
    } catch (err) {
        console.error('[Auth] Error en login:', err);
        res.status(500).json({
            error: 'Error interno del servidor'
        });
    }
};

// Logout de usuario
exports.logout = (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return res.status(500).json({
                error: 'Error al cerrar sesión'
            });
        }

        res.json({
            mensaje: 'Sesión cerrada correctamente'
        });
    });
};

// ============================================================================
// CAMBIAR CONTRASEÑA (usuario autenticado)
// ============================================================================
// PUT /api/auth/cambiar-password
exports.cambiarPassword = async (req, res) => {
    if (!req.session?.usuario) {
        return res.status(401).json({ error: 'No autenticado' });
    }

    const { password_actual, nueva_password } = req.body;

    if (!password_actual || !nueva_password) {
        return res.status(400).json({ error: 'Contraseña actual y nueva son requeridas' });
    }

    // Validar fortaleza
    const errores = [];
    if (nueva_password.length < 8) errores.push('Mínimo 8 caracteres');
    if (!/[A-Z]/.test(nueva_password)) errores.push('Debe contener una mayúscula');
    if (!/[0-9]/.test(nueva_password)) errores.push('Debe contener un número');
    if (errores.length > 0) {
        return res.status(400).json({ error: 'Contraseña débil', detalles: errores });
    }

    try {
        const result = await pool.query('SELECT password FROM usuarios WHERE id = $1', [req.session.usuario.id]);
        if (result.rows.length === 0) return res.status(404).json({ error: 'Usuario no encontrado' });

        if (!bcrypt.compareSync(password_actual, result.rows[0].password)) {
            return res.status(400).json({ error: 'La contraseña actual no es correcta' });
        }

        const passwordHash = bcrypt.hashSync(nueva_password, 10);
        await pool.query(
            `UPDATE usuarios SET password = $1, password_changed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
            [passwordHash, req.session.usuario.id]
        );

        await registrarAuditoria(req.session.usuario.id, 'user.password_changed', 'user',
            req.session.usuario.id, {}, req);

        res.json({ mensaje: 'Contraseña actualizada correctamente' });
    } catch (err) {
        console.error('[Auth] Error cambiarPassword:', err);
        res.status(500).json({ error: err.message });
    }
};

// ============================================================================
// VERIFICAR SESIÓN ACTUAL
// ============================================================================
exports.verificarSesion = (req, res) => {
    if (req.session && req.session.usuario) {
        res.json({
            autenticado: true,
            usuario: req.session.usuario
        });
    } else {
        res.json({
            autenticado: false
        });
    }
};

// ============================================================================
// LISTAR USUARIOS (solo admin)
// ============================================================================
exports.listarUsuarios = async (req, res) => {
    if (req.session.usuario.rol !== 'admin' && !req.session.usuario.is_superadmin) {
        return res.status(403).json({
            error: 'Acceso denegado'
        });
    }

    try {
        const result = await pool.query(`
            SELECT id, username, nombre, email, email_verified, rol,
                   is_active, is_superadmin, failed_login_attempts, locked_until,
                   created_at, updated_at, last_login
            FROM usuarios
            ORDER BY created_at DESC
        `);

        res.json(result.rows);
    } catch (err) {
        res.status(500).json({
            error: err.message
        });
    }
};
