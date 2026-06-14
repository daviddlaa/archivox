const bcrypt = require('bcryptjs');
const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, './database.db');
const db = new Database(dbPath);

// Test 1: Verificar que tipos aceptamos
console.log('=== TEST 1: Verificar tipos aceptados ===');
const testHash = bcrypt.hashSync('test123', 10);
console.log('Hash type:', typeof testHash);
console.log('Hash length:', testHash.length);
console.log('Hash:', testHash.substring(0, 20) + '...');

// Test 2: Insertar usuario con preparar
console.log('\n=== TEST 2: Insertar con stmt.run(array) ===');
const stmt1 = db.prepare('INSERT INTO usuarios (username, password, nombre) VALUES (?, ?, ?)');
try {
    stmt1.run(['testuser2', testHash, 'Test 2'], function(err) {
        if (err) {
            console.log('Error con array:', err.message);
        } else {
            console.log('Éxito con array, lastID:', this.lastID);
        }
    });
} catch(e) {
    console.log('Error con array (try-catch):', e.message);
}

// Test 3: Insertar usuario con ejecutar directo (sin preparar)
console.log('\n=== TEST 3: Insertar sin preparar ===');
try {
    const result = db.exec(`INSERT INTO usuarios (username, password, nombre) VALUES ('testuser3', '${testHash}', 'Test 3')`);
    console.log('Éxito sin preparar:', result);
} catch(e) {
    console.log('Error sin preparar:', e.message);
}

console.log('\nTests completados');
