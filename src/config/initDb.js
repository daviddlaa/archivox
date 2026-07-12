const db = require('./database');

// ============================================================================
// MIGRACIÓN AUTOMÁTICA: Detectar esquema antiguo y migrar
// ============================================================================
console.log('[DB] Verificando esquema de base de datos...');

// Verificar si la tabla usuarios existe
const tablas = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='usuarios'").all();

if (tablas.length > 0) {
    // La tabla existe, obtener columnas actuales
    const columnasActuales = db.prepare('PRAGMA table_info(usuarios)').all().map(c => c.name);
    console.log('[DB] Columnas existentes en usuarios:', columnasActuales.join(', '));

    // ============================================================================
    // MIGRACIÓN: Agregar columnas faltantes a la tabla usuarios
    // ============================================================================
    const columnasFaltantes = {
        'email': 'TEXT UNIQUE',
        'email_verified': 'INTEGER DEFAULT 0',
        'is_active': 'INTEGER DEFAULT 1',
        'is_superadmin': 'INTEGER DEFAULT 0',
        'failed_login_attempts': 'INTEGER DEFAULT 0',
        'locked_until': 'TEXT',
        'password_changed_at': `TEXT DEFAULT (datetime('now'))`,
        'updated_at': `TEXT DEFAULT (datetime('now'))`,
        'last_login': 'TEXT'
    };

    let columnasMigradas = 0;
    for (const [col, tipo] of Object.entries(columnasFaltantes)) {
        if (!columnasActuales.includes(col)) {
            try {
                // Si la columna ultimo_login existe y estamos creando last_login, migrar datos
                if (col === 'last_login' && columnasActuales.includes('ultimo_login')) {
                    db.exec(`ALTER TABLE usuarios ADD COLUMN last_login TEXT`);
                    db.exec(`UPDATE usuarios SET last_login = ultimo_login WHERE ultimo_login IS NOT NULL`);
                    console.log('[DB] Migrado: ultimo_login → last_login');
                } else {
                    db.exec(`ALTER TABLE usuarios ADD COLUMN ${col} ${tipo}`);
                }
                console.log('[DB] Columna agregada:', col);
                columnasMigradas++;
            } catch (err) {
                console.log('[DB] Columna ya existe (ignorado):', col);
            }
        }
    }

    if (columnasMigradas > 0) {
        console.log('[DB] Migración completada:', columnasMigradas, 'columnas agregadas');
    } else {
        console.log('[DB] Esquema actualizado, no se requieren migraciones');
    }
} else {
    console.log('[DB] Tabla usuarios no existe (instalación nueva), se creará más adelante');
}

// ============================================================================
// CREAR TABLA si no existe (para instalaciones nuevas)
// ============================================================================
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
// TABLA: notificaciones (centro de notificaciones del sistema)
// ================================================================
db.exec(`
    CREATE TABLE IF NOT EXISTS notificaciones (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        titulo TEXT NOT NULL,
        mensaje TEXT NOT NULL,
        tipo TEXT DEFAULT 'info' CHECK(tipo IN ('info', 'warning', 'success', 'danger')),
        prioridad TEXT DEFAULT 'normal' CHECK(prioridad IN ('baja', 'normal', 'alta', 'critica')),
        creador_id INTEGER,
        destinatario_id INTEGER,
        leida INTEGER DEFAULT 0,
        leida_at TEXT,
        archivada INTEGER DEFAULT 0,
        accion_url TEXT,
        accion_texto TEXT,
        fecha_expiracion TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (creador_id) REFERENCES usuarios(id),
        FOREIGN KEY (destinatario_id) REFERENCES usuarios(id)
    )
`);

// Migración: agregar columnas nuevas si no existen
const notifCols = db.prepare('PRAGMA table_info(notificaciones)').all().map(c => c.name);
const notifNewCols = {
    'prioridad': "TEXT DEFAULT 'normal'",
    'archivada': 'INTEGER DEFAULT 0',
    'accion_url': 'TEXT',
    'accion_texto': 'TEXT',
    'fecha_expiracion': 'TEXT',
    'accion_modulo': 'TEXT'         // 🆕 Deep Link Router: identificador lógico del módulo
};
let notifMigradas = 0;
for (const [col, tipo] of Object.entries(notifNewCols)) {
    if (!notifCols.includes(col)) {
        try {
            db.exec(`ALTER TABLE notificaciones ADD COLUMN ${col} ${tipo}`);
            console.log('[DB] Columna notificaciones.' + col + ' agregada');
            notifMigradas++;
        } catch (err) {
            console.log('[DB] Columna notificaciones.' + col + ' ya existe (ignorado)');
        }
    }
}
if (notifMigradas > 0) {
    console.log('[DB] Migración notificaciones completada:', notifMigradas, 'columnas');
}

// Migración: inferir accion_modulo desde accion_url legacy
// Esto permite que notificaciones antiguas con accion_url pero sin accion_modulo
// sigan funcionando con el nuevo sistema de resolución de rutas.
try {
    const legacyNotifs = db.prepare(
        'SELECT id, accion_url FROM notificaciones WHERE accion_url IS NOT NULL AND accion_url != \'\' AND (accion_modulo IS NULL OR accion_modulo = \'\')'
    ).all();

    if (legacyNotifs.length > 0) {
        // Mapeo de URLs conocidas a módulos
        const urlToModule = {
            '/': 'dashboard',
            '/m': 'dashboard',
            '/admin': 'dashboard-admin',
            '/m/admin': 'dashboard-admin',
            '/solicitudes': 'solicitudes',
            '/m/solicitudes': 'solicitudes',
            '/importar': 'importar',
            '/m/importar': 'importar',
            '/historial': 'historial',
            '/m/historial': 'historial',
            '/gestiones': 'gestiones',
            '/m/gestiones': 'gestiones',
            '/gestion-lote': 'gestion-lote',
            '/m/gestion-lote': 'gestion-lote',
            '/relaciones': 'relaciones',
            '/m/relaciones': 'relaciones',
            '/equipo-ventas': 'ventas',
            '/m/ventas': 'ventas',
            '/perfil': 'perfil',
            '/perfil?tab=config': 'perfil-config',
            '/perfil?tab=ayuda': 'perfil-ayuda'
        };

        const updateStmt = db.prepare('UPDATE notificaciones SET accion_modulo = ? WHERE id = ?');

        for (const n of legacyNotifs) {
            const moduleId = urlToModule[n.accion_url];
            if (moduleId) {
                updateStmt.run(moduleId, n.id);
            }
        }

        console.log('[DB] Migración legacy accion_url → accion_modulo completada:', legacyNotifs.length, 'notificaciones');
    }
} catch (e) {
    console.log('[DB] Migración accion_modulo legacy:', e.message);
}

// ================================================================
// ASIGNAR SUPERADMIN: Si existe el usuario daviddlaa, asignarlo como superadmin
// ================================================================
try {
    const result = db.prepare("SELECT id, rol, is_superadmin FROM usuarios WHERE username = 'daviddlaa'").get();
    if (result && (!result.is_superadmin || result.rol !== 'admin')) {
        // Verificar qué columnas existen para construir UPDATE dinámico
        const cols = db.prepare('PRAGMA table_info(usuarios)').all().map(c => c.name);
        let setClauses = ["rol = 'admin'", "is_superadmin = 1"];
        if (cols.includes('updated_at')) {
            setClauses.push("updated_at = datetime('now')");
        }
        db.prepare(
            `UPDATE usuarios SET ${setClauses.join(', ')} WHERE username = 'daviddlaa'`
        ).run();
        console.log('[DB] Usuario daviddlaa asignado como SUPERADMIN');
    }
} catch (e) {
    console.log('[DB] Asignación superadmin:', e.message);
}

// ================================================================
// SEMILLA: Notificación de actualización de email
// Crea la notificación de bienvenida/recordatorio de email si no existe
// ================================================================
try {
    const notifCount = db.prepare('SELECT COUNT(*) as count FROM notificaciones').get();
    if (notifCount.count === 0) {
        // Obtener el primer superadmin o admin como creador
        const adminUser = db.prepare(
            "SELECT id FROM usuarios WHERE is_superadmin = 1 OR rol IN ('admin', 'superadmin') ORDER BY id ASC LIMIT 1"
        ).get();
        
        if (adminUser) {
            db.prepare(`
                INSERT INTO notificaciones (titulo, mensaje, tipo, creador_id, destinatario_id, created_at)
                VALUES (
                    '📧 Actualiza tu correo electrónico',
                    'El sistema ahora cuenta con mayores medidas de seguridad. Es importante mantener tu correo electrónico actualizado para:\n\n🔐 Recuperar tu contraseña en caso de olvido\n🛡️ Recibir alertas de seguridad\n📬 Mantenerte informado sobre cambios importantes\n\nActualiza tu correo desde la sección de Perfil.',
                    'warning',
                    ?, NULL, datetime('now')
                )
            `).run(adminUser.id);
            console.log('[DB] Notificación de actualización de email creada');
        }
    }
} catch (e) {
    // La tabla podría no existir aún en instalación nueva, ignorar
    console.log('[DB] Notificación semilla:', e.message);
}

// ================================================================
// 🆕 TABLAS DEL SISTEMA MULTI-EQUIPO (Arquitectura v3.0)
// ================================================================
try {
    // equipos
    db.exec(`
        CREATE TABLE IF NOT EXISTS equipos (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            nombre          TEXT UNIQUE NOT NULL,
            descripcion     TEXT,
            activo          INTEGER DEFAULT 1 NOT NULL,
            created_at      TEXT DEFAULT (datetime('now')),
            updated_at      TEXT DEFAULT (datetime('now'))
        )
    `);

    // equipo_usuarios
    db.exec(`
        CREATE TABLE IF NOT EXISTS equipo_usuarios (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            equipo_id       INTEGER NOT NULL,
            usuario_id      INTEGER NOT NULL,
            es_lider        INTEGER DEFAULT 0 NOT NULL,
            fecha_ingreso   TEXT DEFAULT (datetime('now')),
            fecha_salida    TEXT,
            motivo_salida   TEXT,
            FOREIGN KEY (equipo_id) REFERENCES equipos(id) ON DELETE CASCADE,
            FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
            UNIQUE(usuario_id, fecha_salida)
        )
    `);

    // permisos_roles
    db.exec(`
        CREATE TABLE IF NOT EXISTS permisos_roles (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            rol             TEXT NOT NULL,
            permiso         TEXT NOT NULL,
            created_at      TEXT DEFAULT (datetime('now')),
            UNIQUE(rol, permiso)
        )
    `);

    // permisos_equipo
    db.exec(`
        CREATE TABLE IF NOT EXISTS permisos_equipo (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            equipo_id       INTEGER NOT NULL,
            permiso         TEXT NOT NULL,
            concedido_por   INTEGER,
            created_at      TEXT DEFAULT (datetime('now')),
            FOREIGN KEY (equipo_id) REFERENCES equipos(id) ON DELETE CASCADE,
            FOREIGN KEY (concedido_por) REFERENCES usuarios(id),
            UNIQUE(equipo_id, permiso)
        )
    `);

    // asignaciones_solicitudes
    db.exec(`
        CREATE TABLE IF NOT EXISTS asignaciones_solicitudes (
            id                  INTEGER PRIMARY KEY AUTOINCREMENT,
            solicitud_id        INTEGER NOT NULL,
            equipo_id           INTEGER NOT NULL,
            usuario_id          INTEGER,
            asignado_por        INTEGER NOT NULL,
            desde_campaña_id    INTEGER,
            tipo_asignacion     TEXT DEFAULT 'manual',
            fecha_asignacion    TEXT DEFAULT (datetime('now')),
            fecha_desasignacion TEXT,
            motivo_desasignacion TEXT,
            FOREIGN KEY (equipo_id) REFERENCES equipos(id),
            FOREIGN KEY (usuario_id) REFERENCES usuarios(id),
            FOREIGN KEY (asignado_por) REFERENCES usuarios(id),
            UNIQUE(solicitud_id, fecha_desasignacion)
        )
    `);

    // campañas_equipo
    db.exec(`
        CREATE TABLE IF NOT EXISTS campañas_equipo (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            campaña_id      INTEGER NOT NULL,
            equipo_id       INTEGER NOT NULL,
            created_at      TEXT DEFAULT (datetime('now')),
            FOREIGN KEY (equipo_id) REFERENCES equipos(id) ON DELETE CASCADE,
            UNIQUE(campaña_id)
        )
    `);

    // Columna equipo_id en gestiones_maestro
    const gmCols = db.prepare('PRAGMA table_info(gestiones_maestro)').all().map(c => c.name);
    if (!gmCols.includes('equipo_id')) {
        db.exec(`ALTER TABLE gestiones_maestro ADD COLUMN equipo_id INTEGER`);
        console.log('[DB] Columna gestiones_maestro.equipo_id agregada');
    }

    console.log('[DB] Tablas multi-equipo verificadas');
} catch (e) {
    console.log('[DB] Error con tablas multi-equipo:', e.message);
}

// ================================================================
// 🆕 ÍNDICES DE MULTI-EQUIPO — SQLite
// ================================================================
try {
    db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_equipo_usuario_unico_activo ON equipo_usuarios(usuario_id) WHERE fecha_salida IS NULL`);
} catch (e) { /* ignorar */ }
try {
    db.exec(`CREATE INDEX IF NOT EXISTS idx_equipos_activo ON equipos(activo)`);
} catch (e) { /* ignorar */ }
try {
    db.exec(`CREATE INDEX IF NOT EXISTS idx_equipo_usuarios_equipo ON equipo_usuarios(equipo_id, es_lider, fecha_salida)`);
} catch (e) { /* ignorar */ }
try {
    db.exec(`CREATE INDEX IF NOT EXISTS idx_permisos_roles_rol ON permisos_roles(rol)`);
} catch (e) { /* ignorar */ }
try {
    db.exec(`CREATE INDEX IF NOT EXISTS idx_asignaciones_solicitud_activa ON asignaciones_solicitudes(solicitud_id, fecha_desasignacion)`);
} catch (e) { /* ignorar */ }
try {
    db.exec(`CREATE INDEX IF NOT EXISTS idx_asignaciones_usuario_activas ON asignaciones_solicitudes(usuario_id, fecha_desasignacion)`);
} catch (e) { /* ignorar */ }
try {
    db.exec(`CREATE INDEX IF NOT EXISTS idx_asignaciones_equipo_activas ON asignaciones_solicitudes(equipo_id, fecha_desasignacion)`);
} catch (e) { /* ignorar */ }
try {
    db.exec(`CREATE INDEX IF NOT EXISTS idx_asignaciones_fecha ON asignaciones_solicitudes(fecha_asignacion DESC)`);
} catch (e) { /* ignorar */ }
try {
    db.exec(`CREATE INDEX IF NOT EXISTS idx_gestiones_maestro_equipo ON gestiones_maestro(equipo_id)`);
} catch (e) { /* ignorar */ }

// ================================================================
// ÍNDICES (con protección para columnas que puedan no existir)
// ================================================================
try {
    db.exec(`CREATE INDEX IF NOT EXISTS idx_usuarios_rol ON usuarios(rol)`);
} catch (e) { console.log('[DB] Índice idx_usuarios_rol no creado (columna no existe):', e.message); }

try {
    db.exec(`CREATE INDEX IF NOT EXISTS idx_usuarios_is_active ON usuarios(is_active)`);
} catch (e) { console.log('[DB] Índice idx_usuarios_is_active no creado:', e.message); }

try {
    db.exec(`CREATE INDEX IF NOT EXISTS idx_audit_log_usuario ON audit_log(usuario_id)`);
} catch (e) { console.log('[DB] Índice idx_audit_log_usuario no creado:', e.message); }

try {
    db.exec(`CREATE INDEX IF NOT EXISTS idx_audit_log_accion ON audit_log(accion)`);
} catch (e) { console.log('[DB] Índice idx_audit_log_accion no creado:', e.message); }

try {
    db.exec(`CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log(created_at)`);
} catch (e) { console.log('[DB] Índice idx_audit_log_created_at no creado:', e.message); }

// ================================================================
// ÍNDICES COMPUESTOS — SQLite
// ================================================================
try {
    db.exec(`CREATE INDEX IF NOT EXISTS idx_solicitudes_usuario_id_desc ON solicitudes(usuario_id, id_solicitud DESC)`);
} catch (e) { /* ignorar */ }
try {
    db.exec(`CREATE INDEX IF NOT EXISTS idx_solicitudes_usuario_estado ON solicitudes(usuario_id, estado)`);
} catch (e) { /* ignorar */ }
try {
    db.exec(`CREATE INDEX IF NOT EXISTS idx_solicitudes_usuario_segmento ON solicitudes(usuario_id, segmento)`);
} catch (e) { /* ignorar */ }
try {
    db.exec(`CREATE INDEX IF NOT EXISTS idx_solicitudes_usuario_fecha ON solicitudes(usuario_id, fecha_solicitud)`);
} catch (e) { /* ignorar */ }
try {
    db.exec(`CREATE INDEX IF NOT EXISTS idx_solicitudes_cedula ON solicitudes(cedula)`);
} catch (e) { /* ignorar */ }
try {
    db.exec(`CREATE INDEX IF NOT EXISTS idx_gestiones_solicitud_usuario_fecha ON gestiones(solicitud_id, usuario_id, fecha_gestion DESC)`);
} catch (e) { /* ignorar */ }
try {
    db.exec(`CREATE INDEX IF NOT EXISTS idx_gestiones_usuario_created ON gestiones(usuario_id, created_at)`);
} catch (e) { /* ignorar */ }
try {
    db.exec(`CREATE INDEX IF NOT EXISTS idx_gestiones_maestro_id_solicitud ON gestiones(gestion_maestro_id, solicitud_id)`);
} catch (e) { /* ignorar */ }
try {
    db.exec(`CREATE INDEX IF NOT EXISTS idx_notificaciones_destinatario_leida ON notificaciones(destinatario_id, leida, created_at DESC)`);
} catch (e) { /* ignorar */ }
try {
    db.exec(`CREATE INDEX IF NOT EXISTS idx_historial_usuario_fecha ON historial_actualizaciones(usuario_id, fecha_actualizacion DESC)`);
} catch (e) { /* ignorar */ }

module.exports = db;
