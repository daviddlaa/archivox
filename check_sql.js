var Database = require('better-sqlite3');
var path = require('path');

var dbPath = path.join(__dirname, 'database.db');
var db = new Database(dbPath, { readonly: true });

// Test using direct better-sqlite3 (bypass db.js wrapper)
var stmt = db.prepare('SELECT * FROM gestioness WHERE usuario_id = ?');
var result = stmt.all(1);
console.log('Direct result:', result);

db.close();
