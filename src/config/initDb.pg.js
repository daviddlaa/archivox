const pool = require('./database.pg.js');

const initTables = async () => {
    const client = await pool.connect();
    
    try {
        // Tabla de usuarios
        await client.query(`
            CREATE TABLE IF NOT EXISTS usuarios (
                id SERIAL PRIMARY KEY,
                username TEXT UNIQUE NOT NULL,
                password TEXT NOT NULL,
                nombre TEXT,
                rol TEXT DEFAULT 'user',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                ultimo_login TIMESTAMP
            )
        `);
        
        // Tabla de solicitudes
        await client.query(`
            CREATE TABLE IF NOT EXISTS solicitudes (
                id SERIAL PRIMARY KEY,
                id_solicitud INTEGER UNIQUE,
                estado TEXT,
                cedula TEXT,
                nombre TEXT,
                celular TEXT,
                segmento TEXT,
                producto TEXT,
                fecha_solicitud TEXT,
                usuario_id INTEGER,
                fecha_importacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
            )
        `);
        
        console.log('Tablas creadas en PostgreSQL');
    } catch (err) {
        console.error('Error creando tablas:', err.message);
    } finally {
        client.release();
    }
};

initTables();

module.exports = pool;
