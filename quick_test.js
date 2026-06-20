var Database = require('better-sqlite3');
var db = new Database('database.db', {readonly:true});

// The issue is I need to copy the exact table name from what check_schema.js found
var stmt = db.prepare('SELECT * FROM gestioness WHERE usuario_id = ?');
var r = stmt.all(1);
console.log('Rows:', r.length);
console.log(JSON.stringify(r, null, 2));
db.close();
