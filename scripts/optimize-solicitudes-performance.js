// ============================================================================
// OPTIMIZACIÓN DE RENDIMIENTO - SOLICITUDES Y GESTIONES
// ============================================================================
// Este script crea los índices necesarios para optimizar las consultas
// del módulo de Solicitudes cuando el sistema escala a miles de registros.
//
// Ejecutar: node scripts/optimize-solicitudes-performance.js
// ============================================================================

require('dotenv').config();
const pool = require('../src/config/db.js');

async function ejecutarOptimizaciones() {
    console.log('🔧 Iniciando optimización de rendimiento...\n');

    try {
        // ====================================================================
        // 1. ÍNDICES PARA SOLICITUDES
        // ====================================================================
        console.log('📦 Creando índices para solicitudes...');

        // Índice compuesto para la consulta principal (usuario_id + orden descendente)
        // La consulta listarSolicitudes filtra por usuario_id y ordena por id DESC
        await pool.query(`
            CREATE INDEX IF NOT EXISTS idx_solicitudes_usuario_id_id
            ON solicitudes (usuario_id, id DESC)
        `);
        console.log('  ✅ idx_solicitudes_usuario_id_id');

        // Índice para filtro por estado (muy usado en la UI)
        await pool.query(`
            CREATE INDEX IF NOT EXISTS idx_solicitudes_usuario_estado
            ON solicitudes (usuario_id, estado)
        `);
        console.log('  ✅ idx_solicitudes_usuario_estado');

        // Índice para filtro por segmento
        await pool.query(`
            CREATE INDEX IF NOT EXISTS idx_solicitudes_usuario_segmento
            ON solicitudes (usuario_id, segmento)
        `);
        console.log('  ✅ idx_solicitudes_usuario_segmento');

        // Índice para búsqueda por texto (cedula, nombre, celular)
        // PostgreSQL puede usar índices BTREE para consultas LIKE con prefijo fijo
        // Pero para búsquedas con %termino% se necesita un índice GIN/tgrm
        try {
            await pool.query(`CREATE EXTENSION IF NOT EXISTS pg_trgm`);
            await pool.query(`
                CREATE INDEX IF NOT EXISTS idx_solicitudes_cedula_trgm
                ON solicitudes USING gin (cedula gin_trgm_ops)
            `);
            await pool.query(`
                CREATE INDEX IF NOT EXISTS idx_solicitudes_nombre_trgm
                ON solicitudes USING gin (nombre gin_trgm_ops)
            `);
            await pool.query(`
                CREATE INDEX IF NOT EXISTS idx_solicitudes_celular_trgm
                ON solicitudes USING gin (celular gin_trgm_ops)
            `);
            console.log('  ✅ Índices GIN trigram para búsqueda textual');
        } catch (e) {
            console.log('  ⚠️ No se pudo crear índices trigram (puede no ser PostgreSQL):', e.message);
            // Fallback a índices B-tree para LIKE con prefijo
            await pool.query(`
                CREATE INDEX IF NOT EXISTS idx_solicitudes_cedula
                ON solicitudes (usuario_id, cedula)
            `);
            await pool.query(`
                CREATE INDEX IF NOT EXISTS idx_solicitudes_celular
                ON solicitudes (usuario_id, celular)
            `);
            console.log('  ✅ Índices B-tree alternativos creados');
        }

        // ====================================================================
        // 2. ÍNDICES PARA GESTIONES
        // ====================================================================
        console.log('\n📦 Creando índices para gestiones...');

        // Índice para la subconsulta de última gestión (muy importante para rendimiento)
        // La subconsulta busca: WHERE solicitud_id = X AND usuario_id = Y ORDER BY fecha_gestion DESC LIMIT 1
        await pool.query(`
            CREATE INDEX IF NOT EXISTS idx_gestiones_solicitud_usuario_fecha
            ON gestiones (solicitud_id, usuario_id, fecha_gestion DESC)
        `);
        console.log('  ✅ idx_gestiones_solicitud_usuario_fecha');

        // Índice para listar gestiones de una solicitud
        await pool.query(`
            CREATE INDEX IF NOT EXISTS idx_gestiones_solicitud_fecha
            ON gestiones (solicitud_id, fecha_gestion DESC)
        `);
        console.log('  ✅ idx_gestiones_solicitud_fecha');

        // ====================================================================
        // 3. ANALYZE PARA ESTADÍSTICAS ACTUALIZADAS
        // ====================================================================
        console.log('\n📊 Actualizando estadísticas del planificador...');
        try {
            await pool.query('ANALYZE solicitudes');
            await pool.query('ANALYZE gestiones');
            console.log('  ✅ Estadísticas actualizadas');
        } catch (e) {
            console.log('  ⚠️ Error actualizando estadísticas:', e.message);
        }

        // ====================================================================
        // 4. RECOMENDACIONES DE CONFIGURACIÓN
        // ====================================================================
        console.log('\n📋 Recomendaciones de configuración:');
        console.log('  • Para PostgreSQL, considera aumentar work_mem si hay muchas consultas simultáneas');
        console.log('  • shared_buffers = 25% de la RAM disponible');
        console.log('  • effective_cache_size = 50-75% de la RAM disponible');
        console.log('  • random_page_cost = 1.1 si usas SSD');
        console.log('  • max_connections = número de usuarios concurrentes * 1.5');
        console.log('  • Considera usar PgBouncer para manejar muchas conexiones simultáneas');

        console.log('\n✅ Optimización completada exitosamente\n');
        process.exit(0);
    } catch (err) {
        console.error('\n❌ Error durante la optimización:', err.message);
        process.exit(1);
    }
}

ejecutarOptimizaciones();
