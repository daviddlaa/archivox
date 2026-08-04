const express = require('express');
const router = express.Router();
const controller = require('../controllers/gestionesMaestro.controller');

// Rutas para gestión maestro (gestión por lotes)

// POST /api/gestiones-maestro - Crear nueva gestión
router.post('/', controller.crearGestionMaestro);

// GET /api/gestiones-maestro - Listar todas las gestione
router.get('/', controller.listarGestionesMaestro);

// Rutas específicas ANTES de /:id para no capturar subpaths
router.get('/:id/progreso', controller.obtenerProgresoGestion);
router.get('/:id/solicitudes/:solicitudId/historial', controller.historialSolicitudCampana);
router.put('/:id/solicitudes/:solicitudId/destacar', controller.destacarSolicitudCampana);
router.put('/:id/agregar-solicitudes', controller.agregarSolicitudesACampana);
router.put('/:id/quitar-solicitud', controller.quitarSolicitudDeCampana);
router.put('/:id/asignar-agente', controller.asignarAgenteACampana);
router.put('/:id/quitar-asignacion', controller.quitarAsignacionAgente);
router.put('/:id/solicitudes/:solicitudId/semaforo', controller.actualizarSemaforoSolicitud);

// GET /api/gestiones-maestro/:id - Obtener una gestión con sus solicitudes
router.get('/:id', controller.obtenerGestionMaestro);

// PUT /api/gestiones-maestro/:id - Actualizar gestión
router.put('/:id', controller.actualizarGestionMaestro);

// DELETE /api/gestiones-maestro/:id - Eliminar gestión
router.delete('/:id', controller.eliminarGestionMaestro);

module.exports = router;
