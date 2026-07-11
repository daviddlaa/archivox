const express = require('express');
const router = express.Router();
const db = require('../config/db.js');
const { requiresAuth } = require('../middleware/auth.middleware');

// Verificar estado de la base de datos (público para diagnóstico)
router.get('/health', async (req, res) => {
    try {
        // Probar conexión
        const testResult = await db.query("SELECT 1 as test");
        
        // Verificar tablas
        const tablesResult = await db.query(`
            SELECT name as table_name 
            FROM sqlite_master 
            WHERE type = 'table' 
            ORDER BY name
        `);
        
        // Contar usuarios
        const usersResult = await db.query('SELECT COUNT(*) as count FROM usuarios');
        
        res.json({
            status: 'ok',
            database: 'connected',
            tables: tablesResult.rows.map(t => t.table_name),
            usersCount: usersResult.rows[0].count
        });
    } catch (err) {
        console.error('Debug health error:', err);
        res.status(500).json({ 
            status: 'error', 
            error: err.message,
            code: err.code
        });
    }
});

// Listar todas las tablas en la base de datos
router.get('/tablas', requiresAuth, async (req, res) => {
    try {
        const result = await db.query(`
            SELECT name as table_name 
            FROM sqlite_master 
            WHERE type = 'table' 
            ORDER BY name
        `);
        res.json(result.rows);
    } catch (err) {
        console.error('Error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Listar usuarios (protegido)
router.get('/usuarios', requiresAuth, async (req, res) => {
    try {
        const result = await db.query('SELECT id, username, nombre, rol, created_at FROM usuarios');
        res.json(result.rows);
    } catch (err) {
        console.error('Error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Listar foreign keys de una tabla
router.get('/foreign-keys/:tabla', requiresAuth, async (req, res) => {
    const { tabla } = req.params;
    try {
        const result = await db.query(`
            SELECT name as table_name 
            FROM sqlite_master 
            WHERE type = 'table' 
            AND name = $1
        `, [tabla]);
        res.json(result.rows);
    } catch (err) {
        console.error('Error:', err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
