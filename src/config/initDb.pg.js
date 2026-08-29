const pool = require('./db.js');

// ============================================================================
// VERSIÓN DEL ESQUEMA
// ============================================================================
// Guard para arranques rápidos: si _schema.versione == SCHEMA_VERSION, se
// saltan todas las sentencias DDL/seed (idempotentes) y el arranque pasa de
// ~100 queries a 2. Subir SCHEMA_VERSION solo cuando se agregue/mofici un DDL
// o seed nuevo en este archivo.
// ============================================================================
const SCHEMA_VERSION = 8;

const initTables = async () => {
    const client = await pool.connect();
    
    try {
        // Tabla ligera de control de versión (crear siempre, es 1 query barata)
        await client.query(`
            CREATE TABLE IF NOT EXISTS _schema (
                id INTEGER PRIMARY KEY,
                version INTEGER NOT NULL,
                aplicada_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        const verRes = await client.query('SELECT version FROM _schema WHERE id = 1');
        const versionActual = verRes.rows[0] ? Number(verRes.rows[0].version) : 0;
        if (versionActual >= SCHEMA_VERSION) {
            console.log(`   ✅ Esquema actualizado (v${versionActual} >= v${SCHEMA_VERSION}) — arranque rápido, DDL omitido`);
            return;
        }
        console.log(`   ⏳ Aplicando esquema v${versionActual} → v${SCHEMA_VERSION}...`);

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
                observaciones TEXT,
                fecha_solicitud TEXT,
                usuario_id INTEGER,
                vendedor TEXT,
                campana_id INTEGER,
                destacado INTEGER DEFAULT 0,
                no_aplica_credito INTEGER DEFAULT 1,
                fecha_importacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
            )
        `);
        
        // Migración: agregar columna observaciones a solicitudes si no existe
        try {
            await client.query(`ALTER TABLE solicitudes ADD COLUMN IF NOT EXISTS observaciones TEXT`);
        } catch (e) {
            // Fallback para PostgreSQL < 9.6
            try {
                await client.query(`ALTER TABLE solicitudes ADD COLUMN observaciones TEXT`);
            } catch (e2) {
                // Columna ya existe, ignorar
            }
        }

        // Migración: agregar columna no_aplica_credito a solicitudes si no existe
        // 1 = aplica para crédito (default) | 0 = ya no aplica para crédito
        try {
            await client.query(`ALTER TABLE solicitudes ADD COLUMN IF NOT EXISTS no_aplica_credito INTEGER NOT NULL DEFAULT 1`);
        } catch (e) {
            try {
                await client.query(`ALTER TABLE solicitudes ADD COLUMN no_aplica_credito INTEGER NOT NULL DEFAULT 1`);
            } catch (e2) {
                // Columna ya existe, ignorar
            }
        }

        // Migración: agregar columna created_at a solicitudes si no existe
        try {
            await client.query(`ALTER TABLE solicitudes ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`);
        } catch (e) {
            try {
                await client.query(`ALTER TABLE solicitudes ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`);
            } catch (e2) {
                // Columna ya existe, ignorar
            }
        }
        
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

        // ================================================================
        // FASE 1 MÉTRICAS: duración de llamada y resultado estructurado
        // (docs/plan-metricas-llamadas-semaforo.md)
        // ================================================================
        for (const [col, tipo] of Object.entries({
            'duracion_seg': 'INTEGER',
            'llamada_inicio': 'TIMESTAMP',
            'llamada_fin': 'TIMESTAMP',
            'resultado': 'TEXT',
            'metodo_duracion': 'TEXT'
        })) {
            await client.query(`ALTER TABLE gestiones ADD COLUMN IF NOT EXISTS ${col} ${tipo}`);
        }
        console.log('   ✅ gestiones: columnas de métricas de llamada verificadas');

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

        // Puente campaña ↔ solicitud (semáforo operativo)
        await client.query(`
            CREATE TABLE IF NOT EXISTS gestiones_maestro_solicitudes (
                id SERIAL PRIMARY KEY,
                gestion_maestro_id INTEGER NOT NULL REFERENCES gestiones_maestro(id) ON DELETE CASCADE,
                id_solicitud INTEGER NOT NULL,
                semaforo TEXT NOT NULL DEFAULT 'sin_clasificar',
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_by INTEGER,
                UNIQUE (gestion_maestro_id, id_solicitud)
            )
        `);
        
        // Recordatorios de llamadas/mensajes programados desde el modal de gestión
        await client.query(`
            CREATE TABLE IF NOT EXISTS recordatorios (
                id SERIAL PRIMARY KEY,
                solicitud_id INTEGER NOT NULL,
                gestion_maestro_id INTEGER REFERENCES gestiones_maestro(id) ON DELETE CASCADE,
                usuario_id INTEGER NOT NULL,
                canal TEXT NOT NULL DEFAULT 'Llamada',
                fecha_recordatorio TIMESTAMP NOT NULL,
                nota TEXT,
                estado TEXT NOT NULL DEFAULT 'pendiente',
                notificado INTEGER NOT NULL DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                completed_at TIMESTAMP
            )
        `);

        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_recordatorios_gestion_estado
            ON recordatorios(gestion_maestro_id, estado)
        `);

        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_recordatorios_fecha_estado
            ON recordatorios(fecha_recordatorio, estado, notificado)
        `);
        
        // Suscripciones a notificaciones push (Web Push API / VAPID)
        await client.query(`
            CREATE TABLE IF NOT EXISTS push_subscriptions (
                id SERIAL PRIMARY KEY,
                usuario_id INTEGER NOT NULL,
                endpoint TEXT NOT NULL,
                keys_p256dh TEXT NOT NULL,
                keys_auth TEXT NOT NULL,
                plataforma TEXT NOT NULL DEFAULT 'desktop',
                user_agent TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        await client.query(`
            CREATE UNIQUE INDEX IF NOT EXISTS idx_push_subscriptions_usuario_endpoint
            ON push_subscriptions(usuario_id, endpoint)
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
            'accion_modulo': 'TEXT',       // 🆕 Deep Link Router
            'es_novedad': 'INTEGER DEFAULT 0',  // 🆕 Novedades: 1 = anuncio de nueva funcionalidad
            'recordatorio_id': 'INTEGER'    // 🆕 Vinculo con la tabla recordatorios (scheduler)
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

        // Migración de limpieza: las notificaciones ya leídas pasan a Archivadas
        // (modelo coherente: Activas = no leídas; Archivadas = consumidas). Idempotente.
        try {
            const limpio = await client.query(`
                UPDATE notificaciones SET archivada = 1
                WHERE leida = 1 AND (archivada = 0 OR archivada IS NULL)
            `);
            console.log(`   ✅ Limpieza: ${limpio.rowCount || 0} notificaciones leídas movidas a Archivadas`);
        } catch (e) {
            console.log('   ⏩ Limpieza de notificaciones no aplicable:', e.message.substring(0,60));
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

        // Solicitudes: búsqueda por campaña
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_solicitudes_campana
            ON solicitudes(campana_id)
        `);

        // Solicitudes: filtros por flag "ya no aplica para crédito"
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_solicitudes_no_aplica_credito
            ON solicitudes(no_aplica_credito)
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

        // Gestiones: "última gestión por solicitud" (ventanas ROW_NUMBER en campañas)
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_gestiones_campana_solicitud_id
            ON gestiones(gestion_maestro_id, solicitud_id, id)
        `);

        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_gms_maestro_semaforo
            ON gestiones_maestro_solicitudes(gestion_maestro_id, semaforo)
        `);

        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_gms_solicitud
            ON gestiones_maestro_solicitudes(id_solicitud)
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

        // Columna es_sistema en gestiones_maestro (campaña "asignada por el sistema",
        // creada por superadmin para un usuario; el líder NO la ve porque equipo_id es NULL)
        try {
            await client.query(`ALTER TABLE gestiones_maestro ADD COLUMN IF NOT EXISTS es_sistema INTEGER DEFAULT 0`);
        } catch (e) {
            try { await client.query(`ALTER TABLE gestiones_maestro ADD COLUMN es_sistema INTEGER DEFAULT 0`); } catch (e2) { /* ya existe */ }
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
        // ================================================================
        // 🆕 TABLA: plantillas (plantillas de mensajes por usuario)
        // Máximo 5 plantillas por usuario (validado en el controlador)
        // ================================================================
        await client.query(`
            CREATE TABLE IF NOT EXISTS plantillas (
                id              SERIAL PRIMARY KEY,
                usuario_id      INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
                nombre          TEXT NOT NULL,
                contenido       TEXT NOT NULL,
                creada_en       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                actualizada_en  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_plantillas_usuario
            ON plantillas(usuario_id)
        `);
        console.log('   ✅ plantillas');

        // ================================================================
        // 🆕 TABLA: envios_solicitudes (trazabilidad de envíos entre agentes)
        // Un agente sin líder envía solicitudes a un agente con líder. Cada
        // fila es UN envío de UNA solicitud. La reasignación del líder
        // conserva el destino original (destino_id) y registra nuevo_destino_id.
        // ================================================================
        await client.query(`
            CREATE TABLE IF NOT EXISTS envios_solicitudes (
                id                 SERIAL PRIMARY KEY,
                solicitud_id       INTEGER NOT NULL,
                remitente_id       INTEGER NOT NULL REFERENCES usuarios(id),
                destino_id         INTEGER NOT NULL REFERENCES usuarios(id),
                comentario         TEXT,
                equipo_id          INTEGER NOT NULL REFERENCES equipos(id),
                campana_id         INTEGER NOT NULL REFERENCES gestiones_maestro(id),
                fecha_envio        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                gestionada         INTEGER DEFAULT 0,
                fecha_gestion      TIMESTAMP,
                gestionada_por     INTEGER REFERENCES usuarios(id),
                reasignada         INTEGER DEFAULT 0,
                nuevo_destino_id   INTEGER REFERENCES usuarios(id),
                reasignada_por     INTEGER REFERENCES usuarios(id),
                fecha_reasignacion TIMESTAMP
            )
        `);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_envios_destino ON envios_solicitudes(destino_id)`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_envios_equipo ON envios_solicitudes(equipo_id)`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_envios_fecha ON envios_solicitudes(fecha_envio)`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_envios_solicitud ON envios_solicitudes(solicitud_id)`);
        console.log('   ✅ envios_solicitudes (tabla + índices)');

        console.log('   ✅ Tablas multi-equipo creadas/verificadas');

        // ================================================================
        // 🆕 AUTO-SEED: Datos iniciales del sistema multi-equipo
        // Solo se ejecuta si la tabla equipos está vacía
        // ================================================================
        try {
            const eqCount = await client.query('SELECT COUNT(*) as total FROM equipos');
            if (parseInt(eqCount.rows[0]?.total || 0) === 0) {
                console.log('   ⏳ Ejecutando seed de datos multi-equipo...');

                // 1. Crear equipo Sistema
                await client.query(
                    `INSERT INTO equipos (nombre, descripcion)
                     SELECT 'Sistema', 'Equipo por defecto creado durante la migración. Todos los usuarios actuales pertenecen aquí inicialmente.'
                     WHERE NOT EXISTS (SELECT 1 FROM equipos WHERE nombre = 'Sistema')`
                );
                console.log('      ✅ Equipo "Sistema" creado');

                // 2. Asignar SUPERADMIN como líder
                const liderResult = await client.query(`
                    INSERT INTO equipo_usuarios (equipo_id, usuario_id, es_lider)
                    SELECT e.id, u.id, 1
                    FROM equipos e, usuarios u
                    WHERE e.nombre = 'Sistema'
                      AND u.is_superadmin = TRUE
                      AND NOT EXISTS (
                        SELECT 1 FROM equipo_usuarios eu
                        WHERE eu.usuario_id = u.id AND eu.fecha_salida IS NULL
                      )
                `);
                console.log(`      ✅ ${liderResult.rowCount} superadmin(s) asignado(s) como líder(es)`);

                // 3. Asignar ADMIN como miembros
                const adminResult = await client.query(`
                    INSERT INTO equipo_usuarios (equipo_id, usuario_id, es_lider)
                    SELECT e.id, u.id, 0
                    FROM equipos e, usuarios u
                    WHERE e.nombre = 'Sistema'
                      AND u.rol = 'admin'
                      AND (u.is_superadmin IS NULL OR u.is_superadmin = FALSE)
                      AND NOT EXISTS (
                        SELECT 1 FROM equipo_usuarios eu
                        WHERE eu.usuario_id = u.id AND eu.fecha_salida IS NULL
                      )
                `);
                console.log(`      ✅ ${adminResult.rowCount} admin(s) asignado(s) como miembro(s)`);

                // 4. Asignar demás usuarios como miembros
                const usersResult = await client.query(`
                    INSERT INTO equipo_usuarios (equipo_id, usuario_id, es_lider)
                    SELECT e.id, u.id, 0
                    FROM equipos e, usuarios u
                    WHERE e.nombre = 'Sistema'
                      AND (u.rol IS NULL OR u.rol NOT IN ('admin', 'superadmin'))
                      AND u.id NOT IN (
                        SELECT eu.usuario_id FROM equipo_usuarios eu WHERE eu.fecha_salida IS NULL
                      )
                `);
                console.log(`      ✅ ${usersResult.rowCount} usuario(s) asignado(s) como miembro(s)`);

                // 5. Insertar permisos de líder
                const liderPermisos = [
                    'equipo:ver', 'equipo:gestionar',
                    'agentes:ver', 'agentes:crear', 'agentes:editar', 'agentes:desactivar',
                    'campañas:ver', 'campañas:crear', 'campañas:gestionar', 'campañas:asignar',
                    'solicitudes:importar', 'solicitudes:ver-equipo',
                    'solicitudes:asignar', 'solicitudes:reasignar', 'solicitudes:ver-asignaciones',
                    'gestiones:ver-equipo',
                    'dashboard:ver-equipo', 'dashboard:ver-agentes',
                    'relaciones:ver-equipo',
                    'historial:ver-equipo'
                ];
                for (const p of liderPermisos) {
                    await client.query(
                        `INSERT INTO permisos_roles (rol, permiso) VALUES ('lider', $1) ON CONFLICT DO NOTHING`,
                        [p]
                    );
                }
                console.log(`      ✅ ${liderPermisos.length} permisos de líder insertados`);

                // 6. Insertar permisos de agente
                const agentePermisos = [
                    'campañas:ver-propias',
                    'solicitudes:ver-asignadas', 'solicitudes:gestionar',
                    'solicitudes:editar-estado', 'solicitudes:completar-info',
                    'gestiones:crear', 'gestiones:ver-propias', 'gestiones:editar',
                    'relaciones:gestionar',
                    'historial:ver-propio',
                    'perfil:ver', 'perfil:editar'
                ];
                for (const p of agentePermisos) {
                    await client.query(
                        `INSERT INTO permisos_roles (rol, permiso) VALUES ('agente', $1) ON CONFLICT DO NOTHING`,
                        [p]
                    );
                }
                console.log(`      ✅ ${agentePermisos.length} permisos de agente insertados`);

                // 7. Insertar permisos de user
                const userPermisos = [
                    'solicitudes:importar', 'solicitudes:ver-propias', 'solicitudes:gestionar',
                    'solicitudes:editar-estado', 'solicitudes:completar-info',
                    'campañas:crear', 'campañas:gestionar',
                    'gestiones:crear', 'gestiones:ver-propias', 'gestiones:editar',
                    'relaciones:gestionar', 'ventas:gestionar',
                    'historial:ver-propio',
                    'perfil:ver', 'perfil:editar'
                ];
                for (const p of userPermisos) {
                    await client.query(
                        `INSERT INTO permisos_roles (rol, permiso) VALUES ('user', $1) ON CONFLICT DO NOTHING`,
                        [p]
                    );
                }
                console.log(`      ✅ ${userPermisos.length} permisos de user insertados`);
                console.log('   ✅ Seed de datos multi-equipo completado');
            }
        } catch (e) {
            console.log('   ⏩ Error en auto-seed multi-equipo (posiblemente ya hay datos):', e.message.substring(0, 80));
        }

        // ================================================================
        // BACKFILL: sincronizar campana_id en solicitudes existentes
        // ================================================================
        // Campañas creadas antes de 26/08/2026 no seteaban solicitudes.campana_id.
        // Este UPDATE una sola vez sincroniza el FK basándose en el JSON solicitudes_ids.
        try {
            const bfResult = await client.query(`
                UPDATE solicitudes s
                SET campana_id = (
                    SELECT gm.id FROM gestiones_maestro gm
                    WHERE s.usuario_id = gm.usuario_id
                      AND (',' || gm.solicitudes_ids || ',') LIKE ('%,' || s.id_solicitud || ',%')
                )
                WHERE s.campana_id IS NULL
                  AND EXISTS (
                    SELECT 1 FROM gestiones_maestro gm
                    WHERE s.usuario_id = gm.usuario_id
                      AND (',' || gm.solicitudes_ids || ',') LIKE ('%,' || s.id_solicitud || ',%')
                  )
            `);
            if (bfResult.rowCount > 0) {
                console.log('[initDb] Backfill campana_id: ' + bfResult.rowCount + ' solicitudes sincronizadas');
            }
        } catch (e) { /* ignorar — tabla aún no existe o sin datos */ }

        console.log('✅ Todas las tablas e índices creados en PostgreSQL');

        // Registrar versión del esquema (solo si todo el bloque terminó OK)
        await client.query(`
            INSERT INTO _schema (id, version, aplicada_en)
            VALUES (1, $1, CURRENT_TIMESTAMP)
            ON CONFLICT (id) DO UPDATE SET version = EXCLUDED.version, aplicada_en = CURRENT_TIMESTAMP
        `, [SCHEMA_VERSION]);
    } catch (err) {
        console.error('Error creando tablas:', err.message);
    } finally {
        client.release();
    }
};

initTables();

module.exports = pool;
