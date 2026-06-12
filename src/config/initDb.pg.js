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
                codigo_plus TEXT,
                fecha_solicitud TEXT,
                usuario_id INTEGER,
                fecha_importacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
            )
        `);
        
        // Tabla de ventas de vendedores (control de equipo)
        await client.query(`
            CREATE TABLE IF NOT EXISTS ventas_vendedores (
                id SERIAL PRIMARY KEY,
                usuario_id INTEGER,
                mes TEXT NOT NULL,
                vendedor TEXT NOT NULL,
                periodo1 REAL DEFAULT 0,
                periodo2 REAL DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (usuario_id) REFERENCES usuarios(id),
                UNIQUE(mes, vendedor, usuario_id)
            )
        `);
        
// Tabla de configuración de bonos por mes
        await client.query(`
            CREATE TABLE IF NOT EXISTS config_bonos (
                id SERIAL PRIMARY KEY,
                usuario_id INTEGER,
                mes TEXT UNIQUE,
                bono1 REAL DEFAULT 3000,
                bono2 REAL DEFAULT 7000,
                bono3 REAL DEFAULT 12000,
                bono4 REAL DEFAULT 20000,
                bono5 REAL DEFAULT 30000,
                bono6 REAL DEFAULT 40000,
                meta_equipo REAL DEFAULT 40000,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
            )
        `);
        
// Tabla de gestes
        await client.query(`
            CREATE TABLE IF NOT EXISTS gestines (
                id SERIAL PRIMARY KEY,
                solicitud_id INTEGER NOT NULL,
                usuario_id INTEGER NOT NULL,
                tipo_gestion TEXT NOT NULL,
                observacion TEXT,
                fecha_gestion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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
