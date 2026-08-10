// ============================================================================
// CACHÉ EN SERVIDOR — Reduce consultas repetidas a PostgreSQL
// ============================================================================
// Usa node-cache (en memoria) con TTL configurables.
// Estrategia: cache-aside con invalidación explícita.
//
// ¿Qué se cachea?
// - Dashboard totals (usuario): TTL 30s → se invalida al importar/crear solicitudes
// - Dashboard segmentos/estados (usuario): TTL 30s
// - Estados disponibles (global): TTL 300s (cambian muy rara vez)
// - Segmentos disponibles (global): TTL 300s
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

// Cache para datos que cambian poco (estados, segmentos)
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
// DATOS GLOBALES (estados, segmentos disponibles)
// ============================================================================

function getEstadosDisponibles() {
    return cacheGlobal.get('estados_disponibles');
}

function setEstadosDisponibles(data) {
    cacheGlobal.set('estados_disponibles', data);
}

function getSegmentosDisponibles() {
    return cacheGlobal.get('segmentos_disponibles');
}

function setSegmentosDisponibles(data) {
    cacheGlobal.set('segmentos_disponibles', data);
}

function invalidateGlobales() {
    cacheGlobal.del('estados_disponibles');
    cacheGlobal.del('segmentos_disponibles');
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
    // Globales
    getEstadosDisponibles,
    setEstadosDisponibles,
    getSegmentosDisponibles,
    setSegmentosDisponibles,
    invalidateGlobales,
    // Admin
    getAdminEstadisticas,
    setAdminEstadisticas,
    invalidateAdminEstadisticas,
    // Stats
    getCacheStats,
};
