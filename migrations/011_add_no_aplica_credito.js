// MIGRACIÓN 011: Agregar columna no_aplica_credito a solicitudes
// 1 = aplica para crédito (default, incluye todas las existentes)
// 0 = ya no aplica para crédito
const db = require('../src/config/db');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

async function up() {
  try {
    console.log('➕ Agregando columna no_aplica_credito a solicitudes...');
    await db.query(`ALTER TABLE solicitudes ADD COLUMN no_aplica_credito INTEGER NOT NULL DEFAULT 1;`);
    console.log('✅ Columna no_aplica_credito agregada correctamente (todas las solicitudes existentes quedan en 1 = aplica).');

    // Índice para filtros por el flag
    try {
      await db.query(`CREATE INDEX IF NOT EXISTS idx_solicitudes_no_aplica_credito ON solicitudes(no_aplica_credito);`);
      console.log('✅ Índice idx_solicitudes_no_aplica_credito creado.');
    } catch (e) {
      console.log('ℹ️ Índice ya existe o error menor:', e.message);
    }
  } catch (error) {
    if (error.message && (error.message.includes('duplicate column') || error.message.includes('already exists'))) {
      console.log('ℹ️ La columna no_aplica_credito ya existe. Saltando...');
    } else {
      console.error('❌ Error inesperado:', error);
      throw error;
    }
  }
}

async function down() {
  console.log('⚠️ Rollback 011: no implementado (no_aplica_credito).');
}

if (require.main === module) {
  up().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
}
module.exports = { up, down };
