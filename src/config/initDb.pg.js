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
        // TABLA: notificaciones (centro de notificaciones del sistema)
        // ================================================================
        await client.query(`
            CREATE TABLE IF NOT EXISTS notificaciones (
                id              SERIAL PRIMARY KEY,
                titulo          TEXT NOT NULL,
                mensaje         TEXT NOT NULL,
                tipo            TEXT DEFAULT 'info' CHECK(tipo IN ('info', 'warning', 'success', 'danger')),
                prioridad       TEXT DEFAULT 'normal' CHECK(prioridad IN ('baja', 'normal', 'alta', 'critica')),
                creador_id      INTEGER REFERENCES usuarios(id),
                destinatario_id INTEGER REFERENCES usuarios(id),
                leida           INTEGER DEFAULT 0,
                leida_at        TIMESTAMP,
                archivada       INTEGER DEFAULT 0,
                accion_url      TEXT,
                accion_texto    TEXT,
                fecha_expiracion TIMESTAMP,
                created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('   ✅ notificaciones');

        // Migración: agregar columnas nuevas si no existen
        for (const [col, tipo] of Object.entries({
            'prioridad': "TEXT DEFAULT 'normal' CHECK(prioridad IN ('baja','normal','alta','critica'))",
            'archivada': 'INTEGER DEFAULT 0',
            'accion_url': 'TEXT',
            'accion_texto': 'TEXT',
            'fecha_expiracion': 'TIMESTAMP',
            'accion_modulo': 'TEXT'       // 🆕 Deep Link Router
        })) {
            try {
                await client.query(`ALTER TABLE notificaciones ADD COLUMN IF NOT EXISTS ${col} ${tipo}`);
            } catch (e) {
                // Fallback para PostgreSQL < 9.6
                try {
                    await client.query(`ALTER TABLE notificaciones ADD COLUMN ${col} ${tipo}`);
                } catch (e2) {
                    // Columna ya existe, ignorar
                }
            }
        }
        // Migración: convertir columnas BOOLEAN a INTEGER para compatibilidad
        // (PostgreSQL no permite comparar BOOLEAN con INTEGER como hace el controlador)
        try {
            await client.query(`
                ALTER TABLE notificaciones ALTER COLUMN leida TYPE INTEGER USING leida::int
            `);
            console.log('   ✅ notificaciones.leida migrada BOOLEAN→INTEGER');
        } catch (e) {
            console.log('   ⏩ notificaciones.leida ya INTEGER (o no aplica):', e.message.substring(0,60));
        }
        try {
            await client.query(`
                ALTER TABLE notificaciones ALTER COLUMN archivada TYPE INTEGER USING archivada::int
            `);
            console.log('   ✅ notificaciones.archivada migrada BOOLEAN→INTEGER');
        } catch (e) {
            console.log('   ⏩ notificaciones.archivada ya INTEGER (o no aplica):', e.message.substring(0,60));
        }

        console.log('   ✅ notificaciones migradas')

        // Migración: inferir accion_modulo desde accion_url legacy (PostgreSQL)
        try {
            const legacyResult = await client.query(`
                UPDATE notificaciones
                SET accion_modulo = CASE accion_url
                    WHEN '/' THEN 'dashboard'
                    WHEN '/m' THEN 'dashboard'
                    WHEN '/admin' THEN 'dashboard-admin'
                    WHEN '/m/admin' THEN 'dashboard-admin'
                    WHEN '/solicitudes' THEN 'solicitudes'
                    WHEN '/m/solicitudes' THEN 'solicitudes'
                    WHEN '/importar' THEN 'importar'
                    WHEN '/m/importar' THEN 'importar'
                    WHEN '/historial' THEN 'historial'
                    WHEN '/m/historial' THEN 'historial'
                    WHEN '/gestiones' THEN 'gestiones'
                    WHEN '/m/gestiones' THEN 'gestiones'
                    WHEN '/gestion-lote' THEN 'gestion-lote'
                    WHEN '/m/gestion-lote' THEN 'gestion-lote'
                    WHEN '/relaciones' THEN 'relaciones'
                    WHEN '/m/relaciones' THEN 'relaciones'
                    WHEN '/equipo-ventas' THEN 'ventas'
                    WHEN '/m/ventas' THEN 'ventas'
                    WHEN '/perfil' THEN 'perfil'
                    WHEN '/perfil?tab=config' THEN 'perfil-config'
                    WHEN '/perfil?tab=ayuda' THEN 'perfil-ayuda'
                    ELSE accion_modulo
                END
                WHERE accion_url IS NOT NULL
                  AND accion_url != ''
                  AND (accion_modulo IS NULL OR accion_modulo = '')
            `);
            if (legacyResult.rowCount > 0) {
                console.log('   ✅ Migración legacy accion_url → accion_modulo:', legacyResult.rowCount, 'notificaciones');
            }
        } catch (e) {
            console.log('   ⏩ Migración accion_modulo legacy:', e.message.substring(0, 60));
        }

        // ================================================================
        // SEMILLA: Notificación de actualización de email
        // ================================================================
        try {
            const notifCount = await client.query('SELECT COUNT(*) as count FROM notificaciones');
            if (parseInt(notifCount.rows[0]?.count || 0) === 0) {
                const adminUser = await client.query(
                    "SELECT id FROM usuarios WHERE is_superadmin = TRUE OR rol IN ('admin', 'superadmin') ORDER BY id ASC LIMIT 1"
                );
                if (adminUser.rows.length > 0) {
                    await client.query(`
                        INSERT INTO notificaciones (titulo, mensaje, tipo, creador_id, created_at)
                        VALUES (
                            '📧 Actualiza tu correo electrónico',
                            'El sistema ahora cuenta con mayores medidas de seguridad. Es importante mantener tu correo electrónico actualizado para:\n\n🔐 Recuperar tu contraseña en caso de olvido\n🛡️ Recibir alertas de seguridad\n📬 Mantenerte informado sobre cambios importantes\n\nActualiza tu correo desde la sección de Perfil.',
                            'warning',
                            $1,
                            CURRENT_TIMESTAMP
                        )
                    `, [adminUser.rows[0].id]);
                    console.log('   ✅ Notificación de email creada');
                }
            }
        } catch (e) {
            console.log('   ⏩ Notificación semilla:', e.message);
        }

        // ================================================================
        // ÍNDICES EXISTENTES (mantenidos por compatibilidad)
        // ================================================================
        await client.query(`CREATE INDEX IF NOT EXISTS idx_usuarios_rol ON usuarios(rol)`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_usuarios_is_active ON usuarios(is_active)`);
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_usuarios_locked ON usuarios(locked_until)
            WHERE locked_until IS NOT NULL
        `);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_audit_log_usuario ON audit_log(usuario_id)`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_audit_log_accion ON audit_log(accion)`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log(created_at)`);

        // ================================================================
        // ÍNDICES COMPUESTOS — Optimización de consultas frecuentes
        // Basado en auditoría de rendimiento (Julio 2026)
        // ================================================================

        // Solicitudes: listado principal (filtro por usuario + ORDER BY id DESC)
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_solicitudes_usuario_id_desc
            ON solicitudes(usuario_id, id_solicitud DESC)
        `);

        // Solicitudes: dashboard (filtro por usuario + GROUP BY estado)
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_solicitudes_usuario_estado
            ON solicitudes(usuario_id, estado)
        `);

        // Solicitudes: dashboard (filtro por usuario + GROUP BY segmento)
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_solicitudes_usuario_segmento
            ON solicitudes(usuario_id, segmento)
        `);

        // Solicitudes: promedios (filtro por usuario + rango de fechas)
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_solicitudes_usuario_fecha
            ON solicitudes(usuario_id, fecha_solicitud)
        `);

        // Solicitudes: búsqueda por cédula exacta
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_solicitudes_cedula
            ON solicitudes(cedula)
        `);

        // Gestiones: LATERAL JOIN (la consulta más frecuente del sistema)
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_gestiones_solicitud_usuario_fecha
            ON gestiones(solicitud_id, usuario_id, fecha_gestion DESC)
        `);

        // Gestiones: dashboard actividad (7 y 30 días)
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_gestiones_usuario_created
            ON gestiones(usuario_id, created_at)
        `);

        // Gestiones: consulta de campañas
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_gestiones_maestro_id_solicitud
            ON gestiones(gestion_maestro_id, solicitud_id)
        `);

        // Notificaciones: listado por usuario
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_notificaciones_destinatario_leida
            ON notificaciones(destinatario_id, leida, created_at DESC)
        `);

        // Historial: consulta por usuario
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_historial_usuario_fecha
            ON historial_actualizaciones(usuario_id, fecha_actualizacion DESC)
        `);

        // ================================================================
        // 🆕 TABLAS DEL SISTEMA MULTI-EQUIPO (Arquitectura v3.0)
        // ================================================================

        // equipos
        await client.query(`
            CREATE TABLE IF NOT EXISTS equipos (
                id              SERIAL PRIMARY KEY,
                nombre          VARCHAR(100) UNIQUE NOT NULL,
                descripcion     TEXT,
                activo          INTEGER DEFAULT 1 NOT NULL CHECK (activo IN (0, 1)),
                created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // equipo_usuarios
        await client.query(`
            CREATE TABLE IF NOT EXISTS equipo_usuarios (
                id              SERIAL PRIMARY KEY,
                equipo_id       INTEGER NOT NULL REFERENCES equipos(id) ON DELETE CASCADE,
                usuario_id      INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
                es_lider        INTEGER DEFAULT 0 NOT NULL CHECK (es_lider IN (0, 1)),
                fecha_ingreso   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                fecha_salida    TIMESTAMP,
                motivo_salida   TEXT,
                UNIQUE(usuario_id, fecha_salida)
            )
        `);

        // permisos_roles
        await client.query(`
            CREATE TABLE IF NOT EXISTS permisos_roles (
                id              SERIAL PRIMARY KEY,
                rol             VARCHAR(20) NOT NULL,
                permiso         VARCHAR(100) NOT NULL,
                created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(rol, permiso)
            )
        `);

        // permisos_equipo
        await client.query(`
            CREATE TABLE IF NOT EXISTS permisos_equipo (
                id              SERIAL PRIMARY KEY,
                equipo_id       INTEGER NOT NULL REFERENCES equipos(id) ON DELETE CASCADE,
                permiso         VARCHAR(100) NOT NULL,
                concedido_por   INTEGER REFERENCES usuarios(id),
                created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(equipo_id, permiso)
            )
        `);

        // asignaciones_solicitudes
        await client.query(`
            CREATE TABLE IF NOT EXISTS asignaciones_solicitudes (
                id                  SERIAL PRIMARY KEY,
                solicitud_id        INTEGER NOT NULL,
                equipo_id           INTEGER NOT NULL REFERENCES equipos(id),
                usuario_id          INTEGER REFERENCES usuarios(id),
                asignado_por        INTEGER NOT NULL REFERENCES usuarios(id),
                desde_campaña_id    INTEGER,
                tipo_asignacion     VARCHAR(20) DEFAULT 'manual'
                                    CHECK (tipo_asignacion IN ('manual', 'automatica', 'campaña', 'importacion')),
                fecha_asignacion    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                fecha_desasignacion TIMESTAMP,
                motivo_desasignacion TEXT,
                UNIQUE(solicitud_id, fecha_desasignacion)
            )
        `);

        // campañas_equipo
        await client.query(`
            CREATE TABLE IF NOT EXISTS campañas_equipo (
                id              SERIAL PRIMARY KEY,
                campaña_id      INTEGER NOT NULL,
                equipo_id       INTEGER NOT NULL REFERENCES equipos(id) ON DELETE CASCADE,
                created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(campaña_id)
            )
        `);

        // Columna equipo_id en gestiones_maestro
        try {
            await client.query(`ALTER TABLE gestiones_maestro ADD COLUMN IF NOT EXISTS equipo_id INTEGER REFERENCES equipos(id)`);
        } catch (e) {
            // fallback para PG < 9.6
            try { await client.query(`ALTER TABLE gestiones_maestro ADD COLUMN equipo_id INTEGER`); } catch (e2) { /* ya existe */ }
        }

        // Índices multi-equipo
        await client.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_equipo_usuario_unico_activo ON equipo_usuarios(usuario_id) WHERE fecha_salida IS NULL`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_equipos_activo ON equipos(activo)`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_equipo_usuarios_equipo ON equipo_usuarios(equipo_id, es_lider, fecha_salida)`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_permisos_roles_rol ON permisos_roles(rol)`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_asignaciones_solicitud_activa ON asignaciones_solicitudes(solicitud_id, fecha_desasignacion)`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_asignaciones_usuario_activas ON asignaciones_solicitudes(usuario_id, fecha_desasignacion) WHERE usuario_id IS NOT NULL`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_asignaciones_equipo_activas ON asignaciones_solicitudes(equipo_id, fecha_desasignacion)`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_asignaciones_fecha ON asignaciones_solicitudes(fecha_asignacion DESC)`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_gestiones_maestro_equipo ON gestiones_maestro(equipo_id)`);
        console.log('   ✅ Tablas multi-equipo creadas/verificadas');

        console.log('✅ Todas las tablas e índices creados en PostgreSQL');
    } catch (err) {
        console.error('Error creando tablas:', err.message);
    } finally {
        client.release();
    }
};

initTables();

module.exports = pool;
