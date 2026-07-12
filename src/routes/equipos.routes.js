// ============================================================================
// RUTAS DE EQUIPOS — Arquitectura Multi-Equipo v3.0
// ============================================================================

const express = require('express');
const router = express.Router();
const { requiresAuth, requiresRole, requiresPermissionAsync, requiresEquipo } = require('../middleware/auth.middleware');
const equiposController = require('../controllers/equipos.controller');

// ============================================================================
// Todas las rutas requieren autenticación
// ============================================================================
router.use(requiresAuth);

// ============================================================================
// MI EQUIPO (accesible por cualquier usuario autenticado)
// Importante: debe ir ANTES de /:id para que express no interprete 'mi-equipo' como :id
// ============================================================================
router.get('/mi-equipo', equiposController.miEquipo);

// ============================================================================
// RUTAS PÚBLICAS (para usuarios autenticados con permiso)
// ============================================================================

// Listar equipos
router.get('/', equiposController.listar);

// Obtener equipo por ID
router.get('/:id', requiresEquipo('ver'), equiposController.obtener);

// ============================================================================
// RUTAS DE ADMINISTRACIÓN (solo superadmin)
// ============================================================================

// Crear equipo
router.post('/', requiresRole('superadmin'), equiposController.crear);

// Actualizar equipo
router.put('/:id', requiresRole('superadmin'), equiposController.actualizar);

// Mover usuario a otro equipo
router.post('/:id/mover-usuario', requiresRole('superadmin'), equiposController.moverUsuario);

// Asignar líder del equipo
router.put('/:id/asignar-lider', requiresRole('superadmin'), equiposController.asignarLider);

// Remover miembro del equipo
router.put('/:id/remover-miembro', requiresRole('superadmin'), equiposController.removerMiembro);

// Eliminar equipo
router.delete('/:id', requiresRole('superadmin'), equiposController.eliminar);

// ============================================================================
// RUTAS DE GESTIÓN DE AGENTES (líder de su equipo o superadmin)
// ============================================================================

// Listar miembros del equipo
router.get('/:id/miembros', equiposController.listarMiembros);

// Crear agente en el equipo (líder puede crear en su equipo, superadmin en cualquier)
router.post('/:id/agentes', requiresPermissionAsync('agentes:crear'), equiposController.crearAgente);

// Editar agente (líder edita datos de sus agentes)
router.put('/:id/agentes/:agenteId', requiresPermissionAsync('agentes:editar'), equiposController.editarAgente);

// Activar/Desactivar agente (líder gestiona estado de sus agentes)
router.put('/:id/agentes/:agenteId/toggle-active', requiresPermissionAsync('agentes:desactivar'), equiposController.toggleActivoAgente);

// Resetear contraseña de agente (líder resetea password de sus agentes)
router.put('/:id/agentes/:agenteId/reset-password', requiresPermissionAsync('agentes:reset-password'), equiposController.resetPasswordAgente);

// ============================================================================
// RUTAS DE DASHBOARD Y OPERACIONES
// ============================================================================

// Dashboard del equipo (protegido: solo el equipo del usuario)
router.get('/:id/dashboard', requiresEquipo('ver'), equiposController.dashboardEquipo);

// Gestiones del equipo (protegido: solo el equipo del usuario)
router.get('/:id/gestiones', requiresEquipo('ver'), equiposController.gestionesEquipo);

// Campañas del equipo
router.get('/:id/campanas', equiposController.campanasEquipo);

module.exports = router;
