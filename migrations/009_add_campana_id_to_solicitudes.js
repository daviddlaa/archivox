const db = require('../src/config/db');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

async function up() {
  try {
    console.log('➕ Agregando columna campana_id a solicitudes...');
    await db.query(`ALTER TABLE solicitudes ADD COLUMN campana_id INTEGER;`);
    console.log('✅ Columna campana_id agregada a solicitudes correctamente.');

    // Crear índice para búsquedas por campaña
    try {
      await db.query(`CREATE INDEX IF NOT EXISTS idx_solicitudes_campana ON solicitudes(campana_id);`);
      console.log('✅ Índice idx_solicitudes_campana creado.');
    } catch (e) {
      console.log('ℹ️ Índice ya existe o error menor:', e.message);
    }
  } catch (error) {
    if (error.message && (error.message.includes('duplicate column') || error.message.includes('already exists'))) {
      console.log('ℹ️ La columna campana_id ya existe en solicitudes. Saltando...');
    } else {
      console.error('❌ Error inesperado:', error);
      throw error;
    }
  }
}

async function down() {
  console.log('⚠️ Rollback no implementado.');
}

if (require.main === module) {
  up().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
}
module.exports = { up, down };
