var Database = require('better-sqlite3');
var db = new Database('database.db', {readonly:true});
var t = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE '%gestion%'").get();
console.log('Table name:', t.name);
console.log('Hex:', Buffer.from(t.name).toString('hex'));
db.close();
