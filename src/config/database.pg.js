const { Pool } = require('pg');
require('dotenv').config();

// Configuración de PostgreSQL desde variables de entorno
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

// Verificar conexión
pool.on('connect', () => {
    console.log('PostgreSQL conectado');
});

module.exports = pool;
