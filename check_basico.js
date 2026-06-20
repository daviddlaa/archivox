var db = require('./src/config/db');
var pool = db;

(async function() {
    var usuarioId = 1;
    
    // Simpler query without JOIN first
    var sql = 'SELECT * FROM gestioness WHERE usuario_id = ?';
    var params = [usuarioId];
    
    console.log('Testing simple SELECT...');
    
    var result = await pool.query(sql, params);
    console.log('Result:', result.rows.length, 'rows');
    console.log('Data:', JSON.stringify(result.rows, null, 2));
    
    // Also try without params
    console.log('\nWithout params:');
    var result2 = await pool.query('SELECT * FROM gestioness', []);
    console.log('Result2:', result2.rows.length, 'rows');
    console.log('Data2:', JSON.stringify(result2.rows, null, 2));
    
    process.exit();
})();
