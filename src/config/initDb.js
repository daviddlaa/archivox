const db = require('./database');

// ================================================================
// TABLA: usuarios (versión mejorada con Panel de Administración)
// ================================================================
db.exec(`
    CREATE TABLE IF NOT EXISTS usuarios (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        nombre TEXT,
        email TEXT UNIQUE,
        email_verified INTEGER DEFAULT 0,
        rol TEXT DEFAULT 'user',
        is_active INTEGER DEFAULT 1,
        is_superadmin INTEGER DEFAULT 0,
        failed_login_attempts INTEGER DEFAULT 0,
        locked_until TEXT,
        password_changed_at TEXT DEFAULT (datetime('now')),
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now')),
        last_login TEXT
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
        correo_electronico TEXT,
        direccion TEXT,
        direccion_trabajo TEXT,
        ocupacion TEXT,
        ingreso_mensual REAL,
        fecha_solicitud TEXT,
        usuario_id INTEGER,
        destacado INTEGER DEFAULT 0,
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
        gestion_maestro_id INTEGER,
        fecha_gestion DATETIME DEFAULT CURRENT_TIMESTAMP,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (gestion_maestro_id) REFERENCES gestiones_maestro(id)
    )
`);

// Nueva tabla: Gestion maestro (gestión por lotes de solicitudes)
db.exec(`
    CREATE TABLE IF NOT EXISTS gestiones_maestro (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nombre TEXT NOT NULL,
        descripcion TEXT,
        usuario_id INTEGER NOT NULL,
        estado TEXT DEFAULT 'activa',
        total_solicitudes INTEGER DEFAULT 0,
        gestionadas INTEGER DEFAULT 0,
        fecha_limite DATE,
        solicitudes_ids TEXT,
        fecha_inicio DATETIME DEFAULT CURRENT_TIMESTAMP,
        fecha_fin DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
    )
`);

// Tabla de referencias de solicitudes (Completar Info)
db.exec(`
    CREATE TABLE IF NOT EXISTS solicitudes_referencias (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        id_solicitud INTEGER NOT NULL,
        nombre TEXT NOT NULL,
        telefono TEXT,
        relacion TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
`);

// Tabla de auditoría de actualizaciones de solicitudes
db.exec(`
    CREATE TABLE IF NOT EXISTS historial_actualizaciones (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        solicitud_id INTEGER NOT NULL,
        usuario_id INTEGER NOT NULL,
        campo TEXT NOT NULL,
        valor_anterior TEXT,
        valor_nuevo TEXT,
        fecha_actualizacion DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
    )
`);

// Tabla de relaciones (ALTA/BAJA)
db.exec(`
    CREATE TABLE IF NOT EXISTS relaciones (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        usuario_id INTEGER NOT NULL,
        identificacion TEXT,
        cliente TEXT,
        celular TEXT,
        estado_relacion TEXT CHECK(estado_relacion IN ('ALTA','BAJA')),
        fecha_inicio_relacion DATE,
        fecha_fin_relacion DATE,
        fecha_fin_credito DATE,
        fecha_fin_fidelizacion DATE,
        proxima_baja DATE,
        motivo_ruptura TEXT,
        numero_operaciones INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
    )
`);

// Tabla de gestiones para relaciones
// Separada de gestiones (que son para solicitudes)
db.exec(`
    CREATE TABLE IF NOT EXISTS gestiones_relaciones (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        relacion_id INTEGER NOT NULL,
        usuario_id INTEGER NOT NULL,
        tipo_gestion TEXT NOT NULL,
        observacion TEXT,
        fecha_gestion DATETIME DEFAULT CURRENT_TIMESTAMP,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (relacion_id) REFERENCES relaciones(id),
        FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
    )
`);

db.exec(`
    CREATE INDEX IF NOT EXISTS idx_gestiones_relaciones_relacion_id 
    ON gestiones_relaciones(relacion_id)
`);

// ================================================================
// TABLA: audit_log (auditoría de acciones del sistema)
// ================================================================
db.exec(`
    CREATE TABLE IF NOT EXISTS audit_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        usuario_id INTEGER NOT NULL,
        accion TEXT NOT NULL,
        target_type TEXT,
        target_id INTEGER,
        detalle TEXT,
        ip_address TEXT,
        user_agent TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
    )
`);

// ================================================================
// ÍNDICES
// ================================================================
db.exec(`
    CREATE INDEX IF NOT EXISTS idx_usuarios_rol ON usuarios(rol)
`);
db.exec(`
    CREATE INDEX IF NOT EXISTS idx_usuarios_is_active ON usuarios(is_active)
`);
db.exec(`
    CREATE INDEX IF NOT EXISTS idx_audit_log_usuario ON audit_log(usuario_id)
`);
db.exec(`
    CREATE INDEX IF NOT EXISTS idx_audit_log_accion ON audit_log(accion)
`);
db.exec(`
    CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log(created_at)
`);

module.exports = db;
