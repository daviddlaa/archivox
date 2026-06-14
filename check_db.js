const db = require('./src/config/db.js');

db.query("SELECT name FROM sqlite_master WHERE type='table'")
    .then(r => {
        console.log('=== TABLAS EN LA BASE DE DATOS ===');
        r.rows.forEach(t => console.log('- ' + t.name));
        
        // Verificar si existe la tabla usuarios
        if (r.rows.some(t => t.name === 'usuarios')) {
            return db.query('SELECT * FROM usuarios LIMIT 5');
        } else {
            console.log('ERROR: Tabla usuarios no existe!');
            process.exit(1);
        }
    })
    .then(r => {
        if (r && r.rows) {
            console.log('\n=== USUARIOS EXISTENTES ===');
            if (r.rows.length === 0) {
                console.log('No hay usuarios registrados');
            } else {
                r.rows.forEach(u => console.log(`- ID:${u.id} user:${u.username} rol:${u.rol}`));
            }
        }
    })
    .catch(e => console.error('Error:', e.message));
