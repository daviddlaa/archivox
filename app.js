
require('dotenv').config();
const express = require('express');
const path = require('path');
const session = require('express-session');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

// Usar PostgreSQL (Render)
require('./src/config/initDb.pg');
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

// Middleware para verificar autenticación en páginas
function requiresAuth(req, res, next) {
    if (req.session && req.session.usuario) {
        return next();
    }
    // Redireccionar a login según el dispositivo
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(req.headers['user-agent']);
    if (isMobile || req.query.movil === '1') {
        return res.redirect('/m/login');
    }
    return res.redirect('/login');
}

// Detectar dispositivo móvil
function isMobileDevice(userAgent) {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);
}

// Rutas para servir HTML según dispositivo (protegidas)
app.get('/', requiresAuth, (req, res) => {
    const isMobile = isMobileDevice(req.headers['user-agent']);
    // Debug: usar ?movil=1 para forzar versión móvil
    if (req.query.movil === '1' || isMobile) {
        res.sendFile(path.join(__dirname, 'public/movil/index.html'));
    } else {
        res.sendFile(path.join(__dirname, 'public/desktop/index.html'));
    }
});

// Rutas para móvil (protegidas)
app.get('/m', requiresAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'public/movil/index.html'));
});
app.get('/m/importar', requiresAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'public/movil/importar.html'));
});
app.get('/m/solicitudes', requiresAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'public/movil/solicitudes.html'));
});

// Rutas protegidas - requieren autenticación
app.get('/importar', requiresAuth, (req, res) => {
    const isMobile = isMobileDevice(req.headers['user-agent']);
    if (isMobile) {
        res.sendFile(path.join(__dirname, 'public/movil/importar.html'));
    } else {
        res.sendFile(path.join(__dirname, 'public/desktop/importar.html'));
    }
});

app.get('/solicitudes', requiresAuth, (req, res) => {
    const isMobile = isMobileDevice(req.headers['user-agent']);
    if (isMobile) {
        res.sendFile(path.join(__dirname, 'public/movil/solicitudes.html'));
    } else {
        res.sendFile(path.join(__dirname, 'public/desktop/solicitudes.html'));
    }
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

// Archivos estáticos - servir desde public general (AL FINAL)
app.use(express.static('public'));

app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
