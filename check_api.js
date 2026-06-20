var db = require('./src/config/db');
var usuarioId = 1;

(async function() {
    try {
        var sql = 'SELECT COUNT(*) as total FROM gestioness WHERE user_id = $1';
        var result = await db.query(sql, [usuarioId]);
        console.log('Total:', result.rows[0].total);
        
        var sql2 = 'SELECT * FROM gestioness LIMIT 3';
        var result2 = await db.query(sql2, []);
        console.log('Sample:', JSON.stringify(result2.rows, null, 2));
    } catch(e) {
        console.log('Error:', e.message);
    }
    process.exit();
})();
