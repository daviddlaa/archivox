const pool = require('./database.pg.js');

const initTables = async () => {
    const client = await pool.connect();
    
    try {
        // ================================================================
        // TABLA: usuarios (versión mejorada con Panel de Administración)
        // ================================================================
        await client.query(`
            CREATE TABLE IF NOT EXISTS usuarios (
                id                     SERIAL PRIMARY KEY,
                username               TEXT UNIQUE NOT NULL,
                password               TEXT NOT NULL,
                nombre                 TEXT,
                email                  TEXT UNIQUE,
                email_verified         BOOLEAN DEFAULT FALSE,
                rol                    TEXT DEFAULT 'user',
                is_active              BOOLEAN DEFAULT TRUE,
                is_superadmin          BOOLEAN DEFAULT FALSE,
                failed_login_attempts  INTEGER DEFAULT 0,
                locked_until           TIMESTAMP,
                password_changed_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                created_at             TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at             TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                last_login             TIMESTAMP
            )
        `);
        
        // Tabla de solicitudes
        await client.query(`
            CREATE TABLE IF NOT EXISTS solicitudes (
                id SERIAL PRIMARY KEY,
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
                ingreso_mensual DECIMAL(12,2),
                fecha_solicitud TEXT,
                usuario_id INTEGER,
                destacado INTEGER DEFAULT 0,
                fecha_importacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
            )
        `);
        
        // Tabla de ventas de vendedores (control de equipo)
        await client.query(`
            CREATE TABLE IF NOT EXISTS ventas_vendedores (
                id SERIAL PRIMARY KEY,
                usuario_id INTEGER,
                mes TEXT NOT NULL,
                vendedor TEXT NOT NULL,
                periodo1 REAL DEFAULT 0,
                periodo2 REAL DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (usuario_id) REFERENCES usuarios(id),
                UNIQUE(mes, vendedor, usuario_id)
            )
        `);
        
        // Tabla de configuración de bonos por mes
        await client.query(`
            CREATE TABLE IF NOT EXISTS config_bonos (
                id SERIAL PRIMARY KEY,
                usuario_id INTEGER,
                mes TEXT UNIQUE,
                bono1 REAL DEFAULT 3000,
                bono2 REAL DEFAULT 7000,
                bono3 REAL DEFAULT 12000,
                bono4 REAL DEFAULT 20000,
                bono5 REAL DEFAULT 30000,
                bono6 REAL DEFAULT 40000,
                meta_equipo REAL DEFAULT 40000,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
            )
        `);
        
// Tabla de gestiones
        await client.query(`
            CREATE TABLE IF NOT EXISTS gestiones (
                id SERIAL PRIMARY KEY,
                solicitud_id INTEGER NOT NULL,
                usuario_id INTEGER NOT NULL,
                tipo_gestion TEXT NOT NULL,
                observacion TEXT,
                gestion_maestro_id INTEGER,
                fecha_gestion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (gestion_maestro_id) REFERENCES gestiones_maestro(id)
            )
        `);

        // Nueva tabla: Gestion maestro (gestión por lotes de solicitudes)
        await client.query(`
            CREATE TABLE IF NOT EXISTS gestiones_maestro (
                id SERIAL PRIMARY KEY,
                nombre TEXT NOT NULL,
                descripcion TEXT,
                usuario_id INTEGER NOT NULL,
                estado TEXT DEFAULT 'activa',
                total_solicitudes INTEGER DEFAULT 0,
                gestionadas INTEGER DEFAULT 0,
                fecha_limite DATE,
                solicitudes_ids TEXT,
                fecha_inicio TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                fecha_fin TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
            )
        `);
        
        // Tabla de referencias de solicitudes (Completar Info)
        await client.query(`
            CREATE TABLE IF NOT EXISTS solicitudes_referencias (
                id SERIAL PRIMARY KEY,
                id_solicitud INTEGER NOT NULL,
                nombre TEXT NOT NULL,
                telefono TEXT,
                relacion TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_solicitudes_referencias_solicitud
            ON solicitudes_referencias(id_solicitud)
        `);
        
        // Tabla de auditoría de actualizaciones de solicitudes
        await client.query(`
            CREATE TABLE IF NOT EXISTS historial_actualizaciones (
                id SERIAL PRIMARY KEY,
                solicitud_id INTEGER NOT NULL,
                usuario_id INTEGER NOT NULL,
                campo TEXT NOT NULL,
                valor_anterior TEXT,
                valor_nuevo TEXT,
                fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
            )
        `);
        
                // Tabla de relaciones (ALTA/BAJA)
        await client.query(`
            CREATE TABLE IF NOT EXISTS relaciones (
                id SERIAL PRIMARY KEY,
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
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
            )
        `);

        // Tabla de gestiones para relaciones (separada de gestiones para solicitudes)
        await client.query(`
            CREATE TABLE IF NOT EXISTS gestiones_relaciones (
                id SERIAL PRIMARY KEY,
                relacion_id INTEGER NOT NULL,
                usuario_id INTEGER NOT NULL,
                tipo_gestion TEXT NOT NULL,
                observacion TEXT,
                fecha_gestion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (relacion_id) REFERENCES relaciones(id),
                FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
            )
        `);

        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_gestiones_relaciones_relacion_id 
            ON gestiones_relaciones(relacion_id)
        `);

        // ================================================================
        // TABLA: audit_log (auditoría de acciones del sistema)
        // ================================================================
        await client.query(`
            CREATE TABLE IF NOT EXISTS audit_log (
                id              SERIAL PRIMARY KEY,
                usuario_id      INTEGER NOT NULL REFERENCES usuarios(id),
                accion          TEXT NOT NULL,
                target_type     TEXT,
                target_id       INTEGER,
                detalle         JSONB,
                ip_address      TEXT,
                user_agent      TEXT,
                created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // ================================================================
        // ÍNDICES
        // ================================================================
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_usuarios_rol ON usuarios(rol)
        `);
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_usuarios_is_active ON usuarios(is_active)
        `);
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_usuarios_locked ON usuarios(locked_until)
            WHERE locked_until IS NOT NULL
        `);
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_audit_log_usuario ON audit_log(usuario_id)
        `);
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_audit_log_accion ON audit_log(accion)
        `);
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log(created_at)
        `);

        console.log('Tablas creadas en PostgreSQL');
    } catch (err) {
        console.error('Error creando tablas:', err.message);
    } finally {
        client.release();
    }
};

initTables();

module.exports = pool;
