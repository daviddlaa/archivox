const db = require('./src/config/database');

console.log('=== PROPIEDADES DE db ===');
console.log(Object.keys(db));

console.log('\n=== MÉTODOS DE db ===');
for (let key of Object.keys(db)) {
    console.log(`${key}: ${typeof db[key]}`);
}

// Verificar si tiene prepare
console.log('\n=== PROBAR prepare ===');
console.log('prepare:', typeof db.prepare);
if (db.prepare) {
    const stmt = db.prepare("SELECT 1 as test");
    console.log('stmt type:', typeof stmt);
    console.log('stmt.run:', typeof stmt.run);
    console.log('stmt.get:', typeof stmt.get);
    console.log('stmt.all:', typeof stmt.all);
}
