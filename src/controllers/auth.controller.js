const bcrypt = require('bcryptjs');
const db = require('../config/db.js');

// Reemplazar pool por db
const pool = db;

// Registro de usuario
exports.registrar = async (req, res) => {
    const { username, password, nombre } = req.body;

    if (!username || !password) {
        return res.status(400).json({
            error: 'Usuario y contraseña son requeridos'
        });
    }

    try {
        // Hashear contraseña
        const passwordHash = bcrypt.hashSync(password, 10);

        const result = await pool.query(
            'INSERT INTO usuarios (username, password, nombre) VALUES ($1, $2, $3)',
            [username, passwordHash, nombre || username]
        );

        res.json({
            mensaje: 'Usuario registrado correctamente',
            usuarioId: 1
        });
    } catch (err) {
        if (err.code === '23505' || err.code === 'SQLITE_CONSTRAINT') { // UNIQUE constraint
            return res.status(400).json({
                error: 'El usuario ya existe'
            });
        }
        res.status(500).json({
            error: err.message
        });
    }
};

// Login de usuario
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
            return res.status(401).json({
                error: 'Usuario o contraseña incorrectos'
            });
        }

        // Verificar contraseña
        const passwordValido = bcrypt.compareSync(password, usuario.password);
        if (!passwordValido) {
            return res.status(401).json({
                error: 'Usuario o contraseña incorrectos'
            });
        }

        // Actualizar último login
        await pool.query(
            'UPDATE usuarios SET ultimo_login = CURRENT_TIMESTAMP WHERE id = $1',
            [usuario.id]
        );

        // Guardar usuario en sesión
        req.session.usuario = {
            id: usuario.id,
            username: usuario.username,
            nombre: usuario.nombre,
            rol: usuario.rol
        };

        res.json({
            mensaje: 'Login exitoso',
            usuario: {
                id: usuario.id,
                username: usuario.username,
                nombre: usuario.nombre,
                rol: usuario.rol
            }
        });
    } catch (err) {
        res.status(500).json({
            error: err.message
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

// Verificar sesión actual
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

// Listar usuarios (solo admin)
exports.listarUsuarios = async (req, res) => {
    if (req.session.usuario.rol !== 'admin') {
        return res.status(403).json({
            error: 'Acceso denegado'
        });
    }

try {
        const result = await pool.query(
            'SELECT id, username, nombre, rol, created_at, ultimo_login FROM usuarios ORDER BY created_at DESC'
        );

        res.json(result.rows);
    } catch (err) {
        res.status(500).json({
            error: err.message
        });
    }
};
