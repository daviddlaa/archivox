// ============================================================================
// MIGRACIÓN: Convertir columnas leida y archivada de BOOLEAN a INTEGER
// ============================================================================
// Problema: En producción, las columnas leida y archivada de la tabla
// notificaciones fueron creadas como BOOLEAN, pero el código espera INTEGER.
//
// Las consultas como:
//   SELECT COUNT(*) FROM notificaciones WHERE leida = 0
// Fallan en PostgreSQL porque BOOLEAN no se puede comparar con INTEGER.
//
// Solución: ALTER COLUMN TYPE INTEGER USING col::int
//   true  → 1
//   false → 0
// ============================================================================

const { Pool } = require('pg');

const DATABASE_URL = process.argv[2];
if (!DATABASE_URL) {
    console.error('USO: node scripts/fix-production-notificaciones.js "postgresql://..."');
    process.exit(1);
}

const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function fixColumns() {
    const client = await pool.connect();
    
    try {
        console.log('='.repeat(70));
        console.log('  MIGRACIÓN: notificaciones - BOOLEAN → INTEGER');
        console.log('='.repeat(70));

        // ====================================================================
        // PASO 1: Verificar estado actual
        // ====================================================================
        console.log('\n📌 PASO 1/4: Verificando estado actual...');
        
        const currentState = await client.query(`
            SELECT column_name, data_type, column_default
            FROM information_schema.columns
            WHERE table_schema = 'public' 
              AND table_name = 'notificaciones' 
              AND column_name IN ('leida', 'archivada')
            ORDER BY column_name
        `);

        for (const col of currentState.rows) {
            console.log(`   ${col.column_name}: ${col.data_type} DEFAULT ${col.column_default}`);
        }

        // ====================================================================
        // PASO 2: Iniciar transacción
        // ====================================================================
        console.log('\n📌 PASO 2/4: Iniciando transacción...');
        await client.query('BEGIN');
        console.log('   ✅ Transacción iniciada');

        // ====================================================================
        // PASO 3: Migrar columnas
        // ====================================================================
        console.log('\n📌 PASO 3/4: Migrando columnas BOOLEAN → INTEGER...');

        // Migrar leida
        console.log('\n   --- Migrando leida ---');
        
        // Primero eliminar el default actual (booleano)
        await client.query('ALTER TABLE notificaciones ALTER COLUMN leida DROP DEFAULT');
        console.log('   ✅ Default de leida eliminado');
        
        // Cambiar tipo de BOOLEAN a INTEGER
        await client.query('ALTER TABLE notificaciones ALTER COLUMN leida TYPE INTEGER USING leida::int');
        console.log('   ✅ leida convertida de BOOLEAN a INTEGER');
        
        // Establecer nuevo default
        await client.query("ALTER TABLE notificaciones ALTER COLUMN leida SET DEFAULT 0");
        console.log('   ✅ Default de leida establecido a 0');

        // Migrar archivada
        console.log('\n   --- Migrando archivada ---');
        
        await client.query('ALTER TABLE notificaciones ALTER COLUMN archivada DROP DEFAULT');
        console.log('   ✅ Default de archivada eliminado');
        
        await client.query('ALTER TABLE notificaciones ALTER COLUMN archivada TYPE INTEGER USING archivada::int');
        console.log('   ✅ archivada convertida de BOOLEAN a INTEGER');
        
        await client.query("ALTER TABLE notificaciones ALTER COLUMN archivada SET DEFAULT 0");
        console.log('   ✅ Default de archivada establecido a 0');

        // ====================================================================
        // PASO 4: Verificar la migración
        // ====================================================================
        console.log('\n📌 PASO 4/4: Verificando la migración...');

        const verifyState = await client.query(`
            SELECT column_name, data_type, column_default
            FROM information_schema.columns
            WHERE table_schema = 'public' 
              AND table_name = 'notificaciones' 
              AND column_name IN ('leida', 'archivada')
            ORDER BY column_name
        `);

        let allOk = true;
        for (const col of verifyState.rows) {
            if (col.data_type === 'integer') {
                console.log(`   ✅ ${col.column_name}: ${col.data_type} DEFAULT ${col.column_default} - CORRECTO`);
            } else {
                console.log(`   ❌ ${col.column_name}: ${col.data_type} - ERROR, debería ser integer`);
                allOk = false;
            }
        }

        // Confirmar transacción
        if (allOk) {
            await client.query('COMMIT');
            console.log('\n   ✅ TRANsACCIÓN CONFIRMADA (COMMIT)');
        } else {
            await client.query('ROLLBACK');
            console.log('\n   ❌ ERROR: Transacción revertida (ROLLBACK)');
            process.exit(1);
        }

        // ====================================================================
        // Prueba rápida: las consultas ahora deberían funcionar
        // ====================================================================
        console.log('\n🔍 PRUEBA RÁPIDA: Ejecutando consultas de notificaciones...');
        
        try {
            const testCount = await client.query('SELECT COUNT(*) as total FROM notificaciones WHERE leida = 0');
            console.log(`   ✅ COUNT WHERE leida = 0: ${testCount.rows[0].total} notificaciones no leídas`);
        } catch (e) {
            console.log(`   ❌ Error en consulta COUNT: ${e.message}`);
        }
        
        try {
            const testLeidas = await client.query('SELECT COUNT(*) as total FROM notificaciones WHERE leida = 1');
            console.log(`   ✅ COUNT WHERE leida = 1: ${testLeidas.rows[0].total} notificaciones leídas`);
        } catch (e) {
            console.log(`   ❌ Error en consulta COUNT leídas: ${e.message}`);
        }
        
        try {
            const testArchivadas = await client.query('SELECT COUNT(*) as total FROM notificaciones WHERE archivada = 1');
            console.log(`   ✅ COUNT WHERE archivada = 1: ${testArchivadas.rows[0].total} notificaciones archivadas`);
        } catch (e) {
            console.log(`   ❌ Error en consulta COUNT archivadas: ${e.message}`);
        }

        console.log('\n' + '='.repeat(70));
        console.log('  ✅ MIGRACIÓN COMPLETADA EXITOSAMENTE');
        console.log('='.repeat(70));
        console.log('\nResumen:');
        console.log('  - leida: BOOLEAN DEFAULT false → INTEGER DEFAULT 0');
        console.log('  - archivada: BOOLEAN DEFAULT false → INTEGER DEFAULT 0');
        console.log('  - Datos existentes preservados (true→1, false→0)');
        console.log('  - Consultas WHERE leida = 0 ahora funcionarán correctamente');

    } catch (err) {
        try {
            await client.query('ROLLBACK');
            console.log('\n❌ ERROR: Transacción revertida (ROLLBACK)');
        } catch (e) {
            // Ignorar errores de rollback
        }
        console.error('\n❌ ERROR DURANTE LA MIGRACIÓN:');
        console.error(`   ${err.message}`);
        console.error(err.stack);
        process.exit(1);
    } finally {
        client.release();
        await pool.end();
    }
}

fixColumns();
