var Database = require('better-sqlite3');
var db = new Database('database.db', {readonly:true});

// Use exact table name from database: "gestiones"
var stmt = db.prepare('SELECT * FROM gestiones WHERE usuario_id = ?');
var r = stmt.all(1);
console.log('Gestiones for user 1:', r.length, 'rows');
console.log(JSON.stringify(r, null, 2));
db.close();
