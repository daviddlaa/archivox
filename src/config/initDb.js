const db = require('./database');

// better-sqlite3 es sincrono, no necesita serialize()
// Las tablas se crean directamente
db.exec(`
    CREATE TABLE IF NOT EXISTS usuarios (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        nombre TEXT,
        rol TEXT DEFAULT 'user',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        ultimo_login DATETIME
    )
`);

db.exec(`
    CREATE TABLE IF NOT EXISTS solicitudes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        id_solicitud INTEGER UNIQUE,
        estado TEXT,
        cedula TEXT,
        nombre TEXT,
        celular TEXT,
        segmento TEXT,
        producto TEXT,
        codigo_plus TEXT,
        fecha_solicitud TEXT,
        usuario_id INTEGER,
        fecha_importacion DATETIME DEFAULT CURRENT_TIMESTAMP,
        fecha_actualizacion DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
    )
`);

db.exec(`
    CREATE TABLE IF NOT EXISTS ventas_vendedores (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        usuario_id INTEGER,
        mes TEXT NOT NULL,
        vendedor TEXT NOT NULL,
        periodo1 REAL DEFAULT 0,
        periodo2 REAL DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (usuario_id) REFERENCES usuarios(id),
        UNIQUE(mes, vendedor, usuario_id)
    )
`);

db.exec(`
    CREATE TABLE IF NOT EXISTS config_bonos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        usuario_id INTEGER,
        mes TEXT UNIQUE,
        bono1 REAL DEFAULT 3000,
        bono2 REAL DEFAULT 7000,
        bono3 REAL DEFAULT 12000,
        bono4 REAL DEFAULT 20000,
        bono5 REAL DEFAULT 30000,
        bono6 REAL DEFAULT 40000,
        meta_equipo REAL DEFAULT 40000,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
    )
`);

db.exec(`
    CREATE TABLE IF NOT EXISTS gestiones (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        solicitud_id INTEGER NOT NULL,
        usuario_id INTEGER NOT NULL,
        tipo_gestion TEXT NOT NULL,
        observacion TEXT,
        fecha_gestion DATETIME DEFAULT CURRENT_TIMESTAMP,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
`);

module.exports = db;
