const express = require('express');
const router = express.Router();

const upload = require('../config/multer.config');
const excelController = require('../controllers/excel.controller');

// Middleware para verificar autenticación en API
function requiresAuth(req, res, next) {
    if (req.session && req.session.usuario) {
        return next();
    }
    return res.status(401).json({
        error: 'No autenticado'
    });
}

// Rutas protegidas
router.post(
    '/upload',
    requiresAuth,
    upload.array('excelFiles', 50),
    excelController.uploadExcel
);

router.get('/solicitudes', excelController.listarSolicitudes);
router.get(
    '/dashboard',
    excelController.dashboard
);

router.get(
    '/dashboard/segmentos',
    excelController.dashboardSegmentos
);
router.get(
    '/dashboard/estados',
    excelController.dashboardEstados
);

// Rutas filtradas para filtros en cascada
router.get(
    '/dashboard/segmentos/filtrado',
    excelController.dashboardSegmentosFiltrado
);

router.get(
    '/dashboard/estados/filtrado',
    excelController.dashboardEstadosFiltrado
);

// Rutas de promedio
router.get(
    '/dashboard/promedio/mes',
    excelController.dashboardPromedioMes
);

router.get(
    '/dashboard/promedio/semana',
    excelController.dashboardPromedioSemana
);

// Rutas de ventas mensuales
router.get(
    '/dashboard/ventas-mensuales',
    excelController.dashboardVentasMensuales
);

module.exports = router;
