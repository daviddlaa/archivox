const db = require('./src/config/db');

async function test() {
    try {
        // Test dashboard
        const d = await db.query(
            'SELECT COUNT(*) as total FROM solicitudes WHERE usuario_id = 1'
        );
        console.log('Dashboard:', d.rows);

        // Test segmentos
        const s = await db.query(
            'SELECT segmento, COUNT(*) as total FROM solicitudes WHERE usuario_id = 1 GROUP BY segmento'
        );
        console.log('Segmentos:', s.rows);

        // Test estados
        const e = await db.query(
            'SELECT estado, COUNT(*) as total FROM solicitudes WHERE usuario_id = 1 GROUP BY estado'
        );
        console.log('Estados:', e.rows);

        console.log('✅ Todo OK');
    } catch (err) {
        console.error('Error:', err.message);
    }
}

test();
