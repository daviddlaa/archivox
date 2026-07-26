const db = require('../src/config/db');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

async function up() {
  const isPostgres = !!process.env.DATABASE_URL;

  if (isPostgres) {
    try {
      console.log('🗑️ Eliminando columna vendedor de gestiones...');
      await db.query(`ALTER TABLE gestiones DROP COLUMN IF EXISTS vendedor;`);
      console.log('✅ Columna vendedor eliminada de gestiones.');
    } catch (error) {
      console.error('❌ Error eliminando vendedor de gestiones:', error.message);
    }

    try {
      console.log('🗑️ Eliminando columna vendedor de gestiones_relaciones...');
      await db.query(`ALTER TABLE gestiones_relaciones DROP COLUMN IF EXISTS vendedor;`);
      console.log('✅ Columna vendedor eliminada de gestiones_relaciones.');
    } catch (error) {
      console.error('❌ Error eliminando vendedor de gestiones_relaciones:', error.message);
    }
  } else {
    console.log('ℹ️ SQLite no soporta DROP COLUMN. Las columnas vendedor se mantienen obsoletas en gestiones y gestiones_relaciones.');
  }
}

async function down() {
  console.log('⚠️ Rollback no implementado.');
}

if (require.main === module) {
  up().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
}
module.exports = { up, down };
