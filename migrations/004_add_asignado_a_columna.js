// ============================================================================
// MIGRACIÓN 004: Agregar columna asignado_a a gestiones_maestro
// ============================================================================
// Permite que un líder asigne una campaña a un agente específico.
// El agente podrá ver las campañas asignadas a él.
//
// USO:
//   node migrations/004_add_asignado_a_columna.js "postgresql://..."
//   O: definir DATABASE_URL en .env y ejecutar sin argumentos
// ============================================================================

require('dotenv').config();
const { Pool } = require('pg');

async function migrate() {
    console.log('='.repeat(60));
    console.log('  MIGRACIÓN 004: Columna asignado_a en gestiones_maestro');
    console.log('='.repeat(60));

    const DATABASE_URL = process.argv[2] || process.env.DATABASE_URL;
    if (!DATABASE_URL) {
        console.error('\n  ERROR: No se encontró DATABASE_URL\n');
        process.exit(1);
    }

    const pool = new Pool({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
    const client = await pool.connect();

    try {
        console.log('\n📦 Conectado a PostgreSQL');
        await client.query('BEGIN');

        console.log('\n📌 Agregando columna asignado_a a gestiones_maestro...');
        try {
            await client.query(`
                ALTER TABLE gestiones_maestro 
                ADD COLUMN IF NOT EXISTS asignado_a INTEGER REFERENCES usuarios(id)
            `);
            console.log('   ✅ Columna asignado_a agregada');
        } catch (e) {
            console.log('   ⏩ Columna ya existe (o error no crítico):', e.message);
        }

        // Índice para búsquedas por asignado_a
        try {
            await client.query(`
                CREATE INDEX IF NOT EXISTS idx_gestiones_maestro_asignado_a 
                ON gestiones_maestro(asignado_a)
            `);
            console.log('   ✅ Índice idx_gestiones_maestro_asignado_a creado');
        } catch (e) {
            console.log('   ⏩ Índice ya existe');
        }

        await client.query('COMMIT');
        console.log('\n✅ MIGRACIÓN COMPLETADA EXITOSAMENTE');
        console.log('\nResumen:');
        console.log('  - Columna asignado_a agregada a gestiones_maestro');
        console.log('  - Índice idx_gestiones_maestro_asignado_a creado');

    } catch (err) {
        await client.query('ROLLBACK');
        console.error('\n❌ ERROR DURANTE LA MIGRACIÓN:', err.message);
        process.exit(1);
    } finally {
        client.release();
        await pool.end();
    }
}

migrate().catch(err => {
    console.error('❌ Error en migración:', err);
    process.exit(1);
});
