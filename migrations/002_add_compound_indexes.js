// ============================================================================
// MIGRACIÓN 002: Índices compuestos para optimización de rendimiento
// ============================================================================
// Ejecutar en producción (Render):
//   node migrations/002_add_compound_indexes.js
// ============================================================================
// Requiere: DATABASE_URL en variables de entorno
// ============================================================================

require('dotenv').config();
const { Pool } = require('pg');

async function migrate() {
    if (!process.env.DATABASE_URL) {
        console.log('❌ DATABASE_URL no configurada. Este script solo funciona con PostgreSQL.');
        console.log('   Para SQLite local, los índices se crean automáticamente en initDb.js');
        process.exit(1);
    }

    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false },
    });

    const client = await pool.connect();
    console.log('✅ Conectado a PostgreSQL');
    console.log('📦 Creando índices compuestos...\n');

    const indexes = [
        {
            name: 'idx_solicitudes_usuario_id_desc',
            sql: 'CREATE INDEX IF NOT EXISTS idx_solicitudes_usuario_id_desc ON solicitudes(usuario_id, id_solicitud DESC)',
            desc: 'Listado de solicitudes (filtro usuario + ORDER BY id DESC)',
        },
        {
            name: 'idx_solicitudes_usuario_estado',
            sql: 'CREATE INDEX IF NOT EXISTS idx_solicitudes_usuario_estado ON solicitudes(usuario_id, estado)',
            desc: 'Dashboard por estado (filtro usuario + GROUP BY estado)',
        },
        {
            name: 'idx_solicitudes_usuario_segmento',
            sql: 'CREATE INDEX IF NOT EXISTS idx_solicitudes_usuario_segmento ON solicitudes(usuario_id, segmento)',
            desc: 'Dashboard por segmento (filtro usuario + GROUP BY segmento)',
        },
        {
            name: 'idx_solicitudes_usuario_fecha',
            sql: 'CREATE INDEX IF NOT EXISTS idx_solicitudes_usuario_fecha ON solicitudes(usuario_id, fecha_solicitud)',
            desc: 'Promedios mensuales/semanales (filtro usuario + rango fecha)',
        },
        {
            name: 'idx_solicitudes_cedula',
            sql: 'CREATE INDEX IF NOT EXISTS idx_solicitudes_cedula ON solicitudes(cedula)',
            desc: 'Búsqueda por cédula exacta',
        },
        {
            name: 'idx_gestiones_solicitud_usuario_fecha',
            sql: 'CREATE INDEX IF NOT EXISTS idx_gestiones_solicitud_usuario_fecha ON gestiones(solicitud_id, usuario_id, fecha_gestion DESC)',
            desc: 'LATERAL JOIN (consulta más frecuente del sistema)',
        },
        {
            name: 'idx_gestiones_usuario_created',
            sql: 'CREATE INDEX IF NOT EXISTS idx_gestiones_usuario_created ON gestiones(usuario_id, created_at)',
            desc: 'Dashboard actividad (últimos 7/30 días)',
        },
        {
            name: 'idx_gestiones_maestro_id_solicitud',
            sql: 'CREATE INDEX IF NOT EXISTS idx_gestiones_maestro_id_solicitud ON gestiones(gestion_maestro_id, solicitud_id)',
            desc: 'Progreso de campañas',
        },
        {
            name: 'idx_notificaciones_destinatario_leida',
            sql: 'CREATE INDEX IF NOT EXISTS idx_notificaciones_destinatario_leida ON notificaciones(destinatario_id, leida, created_at DESC)',
            desc: 'Listado de notificaciones por usuario',
        },
        {
            name: 'idx_historial_usuario_fecha',
            sql: 'CREATE INDEX IF NOT EXISTS idx_historial_usuario_fecha ON historial_actualizaciones(usuario_id, fecha_actualizacion DESC)',
            desc: 'Historial de actualizaciones por usuario',
        },
        {
            name: 'idx_audit_log_accion_fecha',
            sql: 'CREATE INDEX IF NOT EXISTS idx_audit_log_accion_fecha ON audit_log(accion, created_at DESC)',
            desc: 'Consulta de auditoría por acción + fecha',
        },
    ];

    let created = 0;
    let errors = 0;

    for (const idx of indexes) {
        try {
            await client.query(idx.sql);
            console.log(`   ✅ ${idx.name}`);
            console.log(`      → ${idx.desc}`);
            created++;
        } catch (err) {
            console.error(`   ❌ ${idx.name}: ${err.message}`);
            errors++;
        }
    }

    console.log(`\n📊 Resumen:`);
    console.log(`   • Índices creados: ${created}/${indexes.length}`);
    console.log(`   • Errores: ${errors}`);

    // Verificar índices creados
    console.log(`\n🔍 Verificando índices...`);
    const result = await client.query(`
        SELECT indexname, indexdef 
        FROM pg_indexes 
        WHERE tablename IN ('solicitudes', 'gestiones', 'notificaciones', 'historial_actualizaciones', 'audit_log')
        AND indexname LIKE 'idx_%'
        ORDER BY tablename, indexname
    `);
    
    console.log(`\n📋 Índices activos:`);
    for (const row of result.rows) {
        console.log(`   • ${row.indexname}`);
    }

    client.release();
    await pool.end();
    console.log(`\n✅ Migración completada.`);
}

migrate().catch(err => {
    console.error('❌ Error en migración:', err);
    process.exit(1);
});
