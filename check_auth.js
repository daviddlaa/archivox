var db = require('./src/config/db');

var usuarioId = 1;

(async function() {
    // Test auth check: is user 1 valid?
    var userResult = await db.query('SELECT id, nombre FROM usuarios WHERE id = ?', [usuarioId]);
    console.log('User:', JSON.stringify(userResult.rows));

    // Test query from controller
    var sql = 'SELECT g.*, s.cedula, s.nombre FROM gestioness g LEFT JOIN solicitudes s ON g.solicitud_id = s.id_solicitud AND g.usuario_id = s.usuario_id WHERE g.usuario_id = ? ORDER BY g.fecha_gestion DESC LIMIT 50';
    var result = await db.query(sql, [usuarioId]);
    console.log('Gestioness:', result.rows.length);

    // Get count by user
    var countSql = 'SELECT COUNT(*) as total FROM gestioness WHERE usuario_id = ?';
    var countResult = await db.query(countSql, [usuarioId]);
    console.log('Count for user', usuarioId + ':', countResult.rows[0]?.total);

    // Check if there's data for any user
    var allCount = await db.query('SELECT COUNT(*) as total FROM gestioness', []);
    console.log('Total gestioness:', allCount.rows[0]?.total);

    process.exit();
})();
