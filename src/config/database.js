const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(
    path.join(__dirname, '../../database.db'),
    (err) => {
        if (err) {
            console.error(err.message);
        } else {
            console.log('SQLite conectado');
        }
    }
);

// Configurar para mejor compatibilidad
db.pragma('journal_mode = WAL');

module.exports = db;
