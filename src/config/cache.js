// ============================================================================
// CACHÉ EN SERVIDOR — Reduce consultas repetidas a PostgreSQL
// ============================================================================
// Usa node-cache (en memoria) con TTL configurables.
// Estrategia: cache-aside con invalidación explícita.
//
// ¿Qué se cachea?
// - Dashboard totals (usuario): TTL 30s → se invalida al importar/crear solicitudes
// - Dashboard segmentos/estados (usuario): TTL 30s
// - Catálogos Nueva Solicitud (estados/segmentos globales): TTL 60s por usuario
//   (los valores son de TODA la aplicación; la clave es por usuario para poder
//   invalidarla al importar/crear/editar/eliminar solicitudes)
// - Estadísticas admin: TTL 60s
//
// Invalidación: llamar a invalidateDashboard(usuarioId) después de:
//   - Importación Excel
//   - Creación manual de solicitud
//   - Edición de solicitud (cambio estado/segmento)
//   - Eliminación de solicitud
// ============================================================================

const NodeCache = require('node-cache');

// Cache principal
const cache = new NodeCache({
    stdTTL: 30,           // TTL por defecto: 30 segundos
    checkperiod: 60,      // Verificar expiración cada 60 segundos
    useClones: false,     // No clonar objetos (mejor rendimiento)
});

// Cache para estadísticas admin (datos que cambian poco)
const cacheGlobal = new NodeCache({
    stdTTL: 300,          // 5 minutos
    checkperiod: 120,
    useClones: false,
});

// ============================================================================
// DASHBOARD (por usuario)
// ============================================================================

function getDashboardKey(usuarioId) {
    return `dashboard_${usuarioId}`;
}

function getDashboardSegmentosKey(usuarioId) {
    return `dashboard_segmentos_${usuarioId}`;
}

function getDashboardEstadosKey(usuarioId) {
    return `dashboard_estados_${usuarioId}`;
}

/**
 * Obtiene dashboard del caché o null si no existe/expiro.
 */
function getDashboard(usuarioId) {
    return cache.get(getDashboardKey(usuarioId));
}

/**
 * Guarda dashboard en caché.
 */
function setDashboard(usuarioId, data) {
    cache.set(getDashboardKey(usuarioId), data);
}

function getDashboardSegmentos(usuarioId) {
    return cache.get(getDashboardSegmentosKey(usuarioId));
}

function setDashboardSegmentos(usuarioId, data) {
    cache.set(getDashboardSegmentosKey(usuarioId), data);
}

function getDashboardEstados(usuarioId) {
    return cache.get(getDashboardEstadosKey(usuarioId));
}

function setDashboardEstados(usuarioId, data) {
    cache.set(getDashboardEstadosKey(usuarioId), data);
}

/**
 * Invalida todo el dashboard de un usuario (después de INSERT/UPDATE/DELETE).
 */
function invalidateDashboard(usuarioId) {
    cache.del(getDashboardKey(usuarioId));
    cache.del(getDashboardSegmentosKey(usuarioId));
    cache.del(getDashboardEstadosKey(usuarioId));
}

/**
 * Invalida dashboards de TODOS los usuarios (después de importación admin global).
 */
function invalidateAllDashboards() {
    cache.flushAll();
}

// ============================================================================
// ESTADÍSTICAS ADMIN
// ============================================================================

function getAdminEstadisticas() {
    return cacheGlobal.get('admin_estadisticas');
}

function setAdminEstadisticas(data) {
    cacheGlobal.set('admin_estadisticas', data);
}

function invalidateAdminEstadisticas() {
    cacheGlobal.del('admin_estadisticas');
}

// ============================================================================
// CATÁLOGOS (estados, segmentos) — por usuario con TTL corto (60s)
// ============================================================================
// Los filtros de Solicitudes consultan SELECT DISTINCT sobre solicitudes en
// cada carga. Se cachean 60s por usuario (la staleness es aceptable para
// dropdowns) y se invalidan al importar/crear/editar solicitudes.
// ============================================================================

function getCatalogosKey(usuarioId, tipo) {
    return `catalogos_${tipo}_${usuarioId}`;
}

function getEstadosUsuario(usuarioId) {
    return cache.get(getCatalogosKey(usuarioId, 'estados'));
}

function setEstadosUsuario(usuarioId, data) {
    cache.set(getCatalogosKey(usuarioId, 'estados'), data, 60);
}

function getSegmentosUsuario(usuarioId) {
    return cache.get(getCatalogosKey(usuarioId, 'segmentos'));
}

function setSegmentosUsuario(usuarioId, data) {
    cache.set(getCatalogosKey(usuarioId, 'segmentos'), data, 60);
}

function invalidateCatalogosUsuario(usuarioId) {
    cache.del(getCatalogosKey(usuarioId, 'estados'));
    cache.del(getCatalogosKey(usuarioId, 'segmentos'));
}

function invalidateAllCatalogos() {
    const keys = cache.keys().filter(k => k.startsWith('catalogos_'));
    keys.forEach(k => cache.del(k));
}

// ============================================================================
// CAMPAÑAS / GESTIONES MAESTRO — por usuario con TTL corto (15s)
// ============================================================================
// GET /api/gestiones-maestro es la llamada más repetida (landing desktop,
// landing móvil, gestion-lote, solicitudes) y corre subconsultas correlacionadas
// por campaña. Se cachea 15s por usuario y se invalida en cada mutación de campaña.
// ============================================================================

function getCampanasKey(usuarioId) {
    return `campanas_${usuarioId}`;
}

function getCampanas(usuarioId) {
    return cache.get(getCampanasKey(usuarioId));
}

function setCampanas(usuarioId, data) {
    cache.set(getCampanasKey(usuarioId), data, 15);
}

function invalidateCampanas(usuarioId) {
    cache.del(getCampanasKey(usuarioId));
}

function invalidateAllCampanas() {
    const keys = cache.keys().filter(k => k.startsWith('campanas_'));
    keys.forEach(k => cache.del(k));
}

// ============================================================================
// ESTADÍSTICAS DE CACHÉ
// ============================================================================

function getCacheStats() {
    return {
        dashboard: {
            keys: cache.keys().filter(k => k.startsWith('dashboard_')).length,
            hits: cache.getStats().hits,
            misses: cache.getStats().misses,
        },
        global: {
            keys: cacheGlobal.keys().length,
            hits: cacheGlobal.getStats().hits,
            misses: cacheGlobal.getStats().misses,
        },
    };
}

module.exports = {
    // Dashboard
    getDashboard,
    setDashboard,
    getDashboardSegmentos,
    setDashboardSegmentos,
    getDashboardEstados,
    setDashboardEstados,
    invalidateDashboard,
    invalidateAllDashboards,
    // Admin
    getAdminEstadisticas,
    setAdminEstadisticas,
    invalidateAdminEstadisticas,
    // Catálogos por usuario
    getEstadosUsuario,
    setEstadosUsuario,
    getSegmentosUsuario,
    setSegmentosUsuario,
    invalidateCatalogosUsuario,
    invalidateAllCatalogos,
    // Campañas por usuario
    getCampanas,
    setCampanas,
    invalidateCampanas,
    invalidateAllCampanas,
    // Stats
    getCacheStats,
};
