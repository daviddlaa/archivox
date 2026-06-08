const db = require('./database');

db.serialize(() => {

    // Tabla de usuarios
    db.run(`
        CREATE TABLE IF NOT EXISTS usuarios (

            id INTEGER PRIMARY KEY AUTOINCREMENT,

            username TEXT UNIQUE NOT NULL,

            password TEXT NOT NULL,

            nombre TEXT,

            rol TEXT DEFAULT 'user',

            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

            ultimo_login DATETIME

        );
    `);

    // Tabla de solicitudes con usuario_id
    db.run(`
        CREATE TABLE IF NOT EXISTS solicitudes (

            id INTEGER PRIMARY KEY AUTOINCREMENT,

            id_solicitud INTEGER UNIQUE,

            estado TEXT,
            cedula TEXT,
            nombre TEXT,
            celular TEXT,
            segmento TEXT,
            producto TEXT,
            fecha_solicitud TEXT,

            usuario_id INTEGER,

            fecha_importacion DATETIME DEFAULT CURRENT_TIMESTAMP,
            fecha_actualizacion DATETIME DEFAULT CURRENT_TIMESTAMP,

            FOREIGN KEY (usuario_id) REFERENCES usuarios(id)

        );
    `);

});

module.exports = db;
