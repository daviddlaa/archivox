const express = require('express');
const router = express.Router();
const controller = require('../controllers/gestionesMaestro.controller');
const { requiresAuth } = require('../middleware/auth.middleware');

// SEGURIDAD: todas las rutas requieren sesión activa
// (los controladores también verifican internamente; esto es defensa en profundidad)
router.use(requiresAuth);

// Rutas para gestión maestro (gestión por lotes)

// POST /api/gestiones-maestro - Crear nueva gestión
router.post('/', controller.crearGestionMaestro);

// GET /api/gestiones-maestro - Listar todas las gestione
router.get('/', controller.listarGestionesMaestro);

// Rutas específicas ANTES de /:id para no capturar subpaths
router.get('/:id/progreso', controller.obtenerProgresoGestion);
router.get('/:id/historial', controller.historialGeneralCampana);
router.get('/:id/solicitudes/:solicitudId/historial', controller.historialSolicitudCampana);
router.put('/:id/solicitudes/:solicitudId/destacar', controller.destacarSolicitudCampana);
router.put('/:id/solicitudes/:solicitudId/no-aplica-credito', controller.marcarNoAplicaCreditoSolicitud);
router.put('/:id/agregar-solicitudes', controller.agregarSolicitudesACampana);
router.put('/:id/quitar-solicitud', controller.quitarSolicitudDeCampana);
router.put('/:id/asignar-agente', controller.asignarAgenteACampana);
router.put('/:id/quitar-asignacion', controller.quitarAsignacionAgente);
router.put('/:id/solicitudes/:solicitudId/semaforo', controller.actualizarSemaforoSolicitud);
router.post('/:id/recordatorios', controller.crearRecordatorio);
router.put('/:id/recordatorios/:rid/estado', controller.actualizarEstadoRecordatorio);
router.put('/:id/recordatorios/:rid/posponer', controller.posponerRecordatorio);

// GET /api/gestiones-maestro/:id - Obtener una gestión con sus solicitudes
router.get('/:id', controller.obtenerGestionMaestro);

// PUT /api/gestiones-maestro/:id - Actualizar gestión
router.put('/:id', controller.actualizarGestionMaestro);

// DELETE /api/gestiones-maestro/:id - Eliminar gestión
router.delete('/:id', controller.eliminarGestionMaestro);

module.exports = router;
