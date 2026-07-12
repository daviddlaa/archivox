const express = require('express');
const router = express.Router();

const { imagenes, excel } = require('../config/multer.config');
const excelController = require('../controllers/excel.controller');
const gmController = require('../controllers/gestionesMaestro.controller');
const { requiresAuth } = require('../middleware/auth.middleware');

// Rutas protegidas
router.post(
    '/upload',
    requiresAuth,
    excel.array('excelFiles', 50),
    excelController.uploadExcel
);

// Subir imagen para gestión por WhatsApp
router.post(
    '/upload-imagen',
    requiresAuth,
    imagenes.single('imagen'),
    excelController.subirImagenGestion
);

// Eliminar imagen temporal
router.delete(
    '/upload-imagen/:nombre',
    requiresAuth,
    excelController.eliminarImagenGestion
);

// Crear solicitud manualmente
router.post(
    '/solicitudes',
    requiresAuth,
    excelController.crearSolicitudManual
);

router.get('/solicitudes', excelController.listarSolicitudes);

// Búsqueda directa en servidor (evita infinite scroll)
router.get(
    '/solicitudes/buscar',
    requiresAuth,
    excelController.buscarSolicitudes
);

router.get(
    '/dashboard',
    excelController.dashboard
);

// ================== GESTIONES GLOBAL ==================
// Obtener todas las gestionesglobalmente con filtros
router.get(
    '/gestiones/todas',
    requiresAuth,
    excelController.getTodasGestiones
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

// ================== DESTACAR SOLICITUD ==================

// Actualizar destacado de una solicitud
router.put(
    '/solicitudes/:id/destacar',
    requiresAuth,
    excelController.destacarSolicitud
);

// ================== COMPLETAR INFO ==================

// Obtener solicitud con información completa (incluyendo referencias)
router.get(
    '/solicitudes/:id/completa',
    requiresAuth,
    excelController.getSolicitudCompleta
);

// Actualizar información completa de una solicitud (código plus, dirección, referencias, etc.)
router.put(
    '/solicitudes/:id/completar-info',
    requiresAuth,
    excelController.actualizarCompletarInfo
);

// ================== ELIMINAR SOLICITUD ==================

// Eliminar una solicitud específica
router.delete(
    '/solicitudes/:id',
    requiresAuth,
    excelController.eliminarSolicitud
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

// Obtener gestiones de una solicitud
router.get(
    '/gestiones/:solicitud_id',
    requiresAuth,
    excelController.getGestiones
);

// Obtener últimas gestiones de múltiples solicitudes (_batch - una sola petición)
router.get(
    '/gestiones/ultimas',
    requiresAuth,
    excelController.getGestionesUltimas
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

// ================== LIMPIAR SOLICITUDES ==================

// Borrar todas las solicitudes del usuario actual
router.delete(
    '/limpiar',
    requiresAuth,
    excelController.limpiarSolicitudes
);

// ================== HISTORIAL DE ACTUALIZACIONES ==================

// Obtener historial de actualizaciones
router.get(
    '/historial',
    requiresAuth,
    excelController.getHistorialActualizaciones
);

// ================== GESTIONES MAESTRO (GESTIÓN POR LOTES) ==================

// Listar todas las gestione maestro
router.get(
    '/gestiones-maestro',
    requiresAuth,
    gmController.getGestionesMaestro
);

// Obtener una gestión maestro específica
router.get(
    '/gestiones-maestro/:id',
    requiresAuth,
    gmController.getGestionMaestroById
);

// Crear nueva gestión por lotes
router.post(
    '/gestiones-maestro',
    requiresAuth,
    gmController.createGestionMaestro
);

// Actualizar gestión maestro
router.put(
    '/gestiones-maestro/:id',
    requiresAuth,
    gmController.updateGestionMaestro
);

// Eliminar gestión maestro
router.delete(
    '/gestiones-maestro/:id',
    requiresAuth,
    gmController.deleteGestionMaestro
);

module.exports = router;
