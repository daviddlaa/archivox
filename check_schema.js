var Database = require('better-sqlite3');
var path = require('path');

var dbPath = path.join(__dirname, 'database.db');
var db = new Database(dbPath, { readonly: true });

// Get exact table name (with accent)
var tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
var tableName = tables.find(t => t.name.includes('gestion')).name;
console.log('Table name:', tableName);

// Build query dynamically
var sql = 'SELECT g.id, g.solicitud_id, g.tipo_gestion, g.observacion, g.fecha_gestion, s.cedula, s.nombre FROM ' + tableName + ' g LEFT JOIN solicitudes s ON g.solicitud_id = s.id_solicitud AND g.usuario_id = s.usuario_id WHERE g.usuario_id = ? ORDER BY g.fecha_gestion DESC LIMIT 50';

var result = db.prepare(sql).all(1);
console.log('Result:', result.length, 'rows');
console.log('Data:', JSON.stringify(result, null, 2));

db.close();
