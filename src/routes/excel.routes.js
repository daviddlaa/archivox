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

// ================== CONTROL DE VENTAS DEL EQUIPO ==================

// Obtener ventas del equipo
router.get(
    '/ventas-equipo',
    requiresAuth,
    excelController.getVentasEquipo
);

// Agregar/actualizar vendedor
router.post(
    '/ventas-equipo',
    requiresAuth,
    excelController.addVendedor
);

// Eliminar vendedor
router.delete(
    '/ventas-equipo/:id',
    requiresAuth,
    excelController.deleteVendedor
);

// Obtener configuración de bonos
router.get(
    '/config-bonos',
    requiresAuth,
    excelController.getConfigBonos
);

// Guardar configuración de bonos
router.post(
    '/config-bonos',
    requiresAuth,
    excelController.saveConfigBonos
);

// ================== CÓDIGO PLUS ==================

// Obtener una solicitud por ID
router.get(
    '/solicitudes/:id',
    requiresAuth,
    excelController.getSolicitud
);

// Actualizar código plus de una solicitud
router.put(
    '/solicitudes/:id/codigo-plus',
    requiresAuth,
    excelController.actualizarCodigoPlus
);

// ================== GESTIONES ==================

// Crear una nueva gestión
router.post(
    '/gestiones',
    requiresAuth,
    excelController.crearGestion
);

// Obtener gestines de una solicitud
router.get(
    '/gestiones/:solicitud_id',
    requiresAuth,
    excelController.getGestiones
);

// Actualizar una gestión
router.put(
    '/gestiones/:id',
    requiresAuth,
    excelController.actualizarGestion
);

// Eliminar una gestión
router.delete(
    '/gestiones/:id',
    requiresAuth,
    excelController.eliminarGestion
);

module.exports = router;
