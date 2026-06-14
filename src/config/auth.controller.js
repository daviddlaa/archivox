const bcrypt = require('bcryptjs');
// IMPORTANTE: Usar database.js directamente para SQLite (better-sqlite3)
const db = require('./database');

// Registro de usuario
exports.registrar = (req, res) => {
    const { username, password, nombre } = req.body;

    if (!username || !password) {
        return res.status(400).json({
            error: 'Usuario y contraseña son requeridos'
        });
    }

// Hashear contraseña
    const passwordHash = bcrypt.hashSync(password, 10);

    // IMPORTANTE: Usar método run síncrono (sin callback) para evitar problemas de binding
    const stmt = db.prepare(
        'INSERT INTO usuarios (username, password, nombre) VALUES (?, ?, ?)'
    );
    try {
        const result = stmt.run(username, passwordHash, nombre || username);
        
        res.json({
            mensaje: 'Usuario registrado correctamente',
            usuarioId: result.lastInsertRowid
        });
    } catch (err) {
        if (err.message.includes('UNIQUE constraint failed')) {
            return res.status(400).json({
                error: 'El usuario ya existe'
            });
        }
        return res.status(500).json({
            error: err.message
        });
    }
};

// Login de usuario
exports.login = (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({
            error: 'Usuario y contraseña son requeridos'
        });
    }

    // IMPORTANTE: Usar método get síncrono
    const stmt = db.prepare('SELECT * FROM usuarios WHERE username = ?');
    try {
        const usuario = stmt.get(username);
        
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
        const updateStmt = db.prepare(
            'UPDATE usuarios SET ultimo_login = CURRENT_TIMESTAMP WHERE id = ?'
        );
        updateStmt.run(usuario.id);

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
        return res.status(500).json({
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
exports.listarUsuarios = (req, res) => {
    if (req.session.usuario.rol !== 'admin') {
        return res.status(403).json({
            error: 'Acceso denegado'
        });
    }

    const stmt = db.prepare(
        'SELECT id, username, nombre, rol, created_at, ultimo_login FROM usuarios ORDER BY created_at DESC'
    );
    stmt.all(
        function(err, usuarios) {
            if (err) {
                return res.status(500).json({
                    error: err.message
                });
            }

            res.json(usuarios);
        }
    );
};
