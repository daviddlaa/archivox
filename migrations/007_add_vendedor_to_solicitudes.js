const db = require('../src/config/db');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

async function up() {
  try {
    console.log('➕ Agregando columna vendedor a solicitudes...');
    await db.query(`ALTER TABLE solicitudes ADD COLUMN vendedor TEXT;`);
    console.log('✅ Columna vendedor agregada a solicitudes correctamente.');
  } catch (error) {
    if (error.message && (error.message.includes('duplicate column') || error.message.includes('already exists'))) {
      console.log('ℹ️ La columna vendedor ya existe en solicitudes. Saltando...');
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
