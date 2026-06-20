var db = require('./src/config/db');
var pool = db;

(async function() {
    var usuarioId = 1;
    
    // CORRECT table name: gestioness (with accent on ó)
    var sql = `
        SELECT g.id, g.solicitud_id, g.tipo_gestion, g.observacion, g.fecha_gestion,
               COALESCE(s.cedula, '') as cedula, 
               COALESCE(s.nombre, '') as nombre
        FROM gestioness g
        LEFT JOIN solicitudes s ON g.solicitud_id = s.id_solicitud AND g.usuario_id = s.usuario_id
        WHERE g.usuario_id = ?
    `;
    var params = [usuarioId];
    
    console.log('Testing CORRECT table name...');
    
    var result = await pool.query(sql, params);
    console.log('Result:', result.rows.length, 'rows');
    console.log('Data:', JSON.stringify(result.rows, null, 2));
    
    process.exit();
})();
