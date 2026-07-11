
require('dotenv').config();
const express = require('express');
const path = require('path');
const session = require('express-session');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { requireAuthPage } = require('./src/middleware/auth.middleware');

// Automático: PostgreSQL en producción (Render), SQLite localmente
if (process.env.DATABASE_URL) {
    require('./src/config/initDb.pg');
} else {
    require('./src/config/initDb');
}
const app = express();
const PORT = process.env.PORT || 3000;

// IMPORTANTE: Habilitar trust proxy para que express-rate-limit funcione detrás de proxies (Render, Nginx, etc.)
// Esto permite leer el header X-Forwarded-For correctamente
app.set('trust proxy', 1);

// SEGURIDAD: helmet establece headers seguros
// CSP desactivado temporalmente para permitir scripts inline en producción
app.use(helmet({
    contentSecurityPolicy: false,
}));

// Middlewares globales
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// SEGURIDAD: Rate limiting general
const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 100, // máximo 100 solicitudes por ventana
    message: { error: 'Demasiadas solicitudes, intenta más tarde' }
});
app.use(generalLimiter);

// SEGURIDAD: Rate limiting específico para login
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 5, // máximo 5 intentos de login
    message: { error: 'Demasiados intentos de login, intenta en 15 minutos' },
    standardHeaders: true,
    legacyHeaders: false,
});

// Configuración de sesión SEGURA
app.use(session({
    secret: process.env.SESSION_SECRET || 'default-secret-change-me',
    resave: false,
    saveUninitialized: false,
    cookie: {
        maxAge: 24 * 60 * 60 * 1000, // 24 horas
        httpOnly: true, // Previene XSS robando cookies
        secure: process.env.NODE_ENV === 'production', // Solo HTTPS en producción
        sameSite: 'strict' // Previene CSRF
    }
}));

// Detectar dispositivo móvil
function isMobileDevice(userAgent) {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);
}

// Rutas para servir HTML según dispositivo (protegidas)
app.get('/', requireAuthPage, (req, res) => {
    const isMobile = isMobileDevice(req.headers['user-agent']);
    // Debug: usar ?movil=1 para forzar versión móvil
    if (req.query.movil === '1' || isMobile) {
        res.sendFile(path.join(__dirname, 'public/movil/index.html'));
    } else {
        res.sendFile(path.join(__dirname, 'public/desktop/index.html'));
    }
});

// Rutas para móvil (protegidas)
app.get('/m', requireAuthPage, (req, res) => {
    res.sendFile(path.join(__dirname, 'public/movil/index.html'));
});
app.get('/m/importar', requireAuthPage, (req, res) => {
    res.sendFile(path.join(__dirname, 'public/movil/importar.html'));
});
app.get('/m/solicitudes', requireAuthPage, (req, res) => {
    res.sendFile(path.join(__dirname, 'public/movil/solicitudes.html'));
});
app.get('/m/ventas', requireAuthPage, (req, res) => {
    res.sendFile(path.join(__dirname, 'public/movil/ventas.html'));
});

// Rutas protegidas - requieren autenticación
app.get('/importar', requireAuthPage, (req, res) => {
    const isMobile = isMobileDevice(req.headers['user-agent']);
    if (isMobile) {
        res.sendFile(path.join(__dirname, 'public/movil/importar.html'));
    } else {
        res.sendFile(path.join(__dirname, 'public/desktop/importar.html'));
    }
});

app.get('/solicitudes', requireAuthPage, (req, res) => {
    const isMobile = isMobileDevice(req.headers['user-agent']);
    if (isMobile) {
        res.sendFile(path.join(__dirname, 'public/movil/solicitudes.html'));
    } else {
        res.sendFile(path.join(__dirname, 'public/desktop/solicitudes.html'));
    }
});

app.get('/ventas', requireAuthPage, (req, res) => {
    res.sendFile(path.join(__dirname, 'public/desktop/ventas.html'));
});

// Rutas de Gestiones
app.get('/gestiones', requireAuthPage, (req, res) => {
    const isMobile = isMobileDevice(req.headers['user-agent']);
    if (isMobile || req.query.movil === '1') {
        res.sendFile(path.join(__dirname, 'public/movil/gestiones.html'));
    } else {
        res.sendFile(path.join(__dirname, 'public/desktop/gestiones.html'));
    }
});

app.get('/m/gestiones', requireAuthPage, (req, res) => {
    res.sendFile(path.join(__dirname, 'public/movil/gestiones.html'));
});

// Ruta móvil para Gestión por Lotes
app.get('/m/gestion-lote', requireAuthPage, (req, res) => {
    res.sendFile(path.join(__dirname, 'public/movil/gestion-lote.html'));
});

// Rutas de Relaciones
app.get('/relaciones', requireAuthPage, (req, res) => {
    res.sendFile(path.join(__dirname, 'public/desktop/relaciones.html'));
});

app.get('/m/relaciones', requireAuthPage, (req, res) => {
    res.sendFile(path.join(__dirname, 'public/movil/relaciones.html'));
});

// Rutas de Gestión por Lotes
app.get('/gestion-lote', requireAuthPage, (req, res) => {
    res.sendFile(path.join(__dirname, 'public/desktop/gestion-lote.html'));
});

// Rutas de Control de Ventas del Equipo
app.get('/equipo-ventas', requireAuthPage, (req, res) => {
    res.sendFile(path.join(__dirname, 'public/desktop/ventas.html'));
});

app.get('/m/equipo-ventas', requireAuthPage, (req, res) => {
    res.sendFile(path.join(__dirname, 'public/movil/ventas.html'));
});

// Rutas de Historial de Actualizaciones
app.get('/historial', requireAuthPage, (req, res) => {
    const isMobile = isMobileDevice(req.headers['user-agent']);
    if (isMobile) {
        res.sendFile(path.join(__dirname, 'public/movil/historial.html'));
    } else {
        res.sendFile(path.join(__dirname, 'public/desktop/historial.html'));
    }
});

app.get('/m/historial', requireAuthPage, (req, res) => {
    res.sendFile(path.join(__dirname, 'public/movil/historial.html'));
});

// Ruta de administración (solo admin/superadmin - protegida por rol en el frontend y backend)
app.get('/admin', requireAuthPage, (req, res) => {
    res.sendFile(path.join(__dirname, 'public/admin/index.html'));
});
app.get('/m/admin', requireAuthPage, (req, res) => {
    res.sendFile(path.join(__dirname, 'public/admin/index.html'));
});

// Rutas de login (públicas)
app.get('/login', (req, res) => {
    const isMobile = isMobileDevice(req.headers['user-agent']);
    if (isMobile || req.query.movil === '1') {
        res.sendFile(path.join(__dirname, 'public/movil/login.html'));
    } else {
        res.sendFile(path.join(__dirname, 'public/desktop/login.html'));
    }
});

app.get('/m/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/movil/login.html'));
});

// Rutas de registro (públicas para crear primer usuario)
app.get('/registro', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/desktop/login.html'));
});

// API routes
app.use('/api/excel', require('./src/routes/excel.routes'));
app.use('/api/auth', require('./src/routes/auth.routes'));
app.use('/api/debug', require('./src/routes/debug.routes'));
app.use('/api/gestiones-maestro', require('./src/routes/gestionesMaestro.routes'));
app.use('/api/relaciones', require('./src/routes/relaciones.routes'));
app.use('/api/relaciones/gestiones', require('./src/routes/relacionesGestion.routes'));
app.use('/api/admin', require('./src/routes/admin.routes'));

// Archivos estáticos
app.use(express.static('public'));

app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
