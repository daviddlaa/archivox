// ============================================================================
// CATALOG SERVICE — Catálogos globales con fallback inteligente
// ============================================================================
// Proporciona métodos para obtener listas de estados y segmentos
// con la siguiente lógica de resolución:
//   1. Buscar DISTINCT global (toda la aplicación, todos los usuarios).
//   2. Si está vacío → devolver valores por defecto.
// NOTA: El formulario Nueva Solicitud muestra TODOS los estados/segmentos
//       que existen en la aplicación (no solo los del usuario autenticado).
// ============================================================================

const pool = require('../config/db.js');
const cache = require('../config/cache.js');

// ============================================================================
// VALORES POR DEFECTO
// ============================================================================
const DEFAULT_ESTADOS = ['ACTIVADA', 'PENDIENTE', 'RECHAZADA', 'DEVUELTA', 'SIN ESTADO'];
const DEFAULT_SEGMENTOS = ['GENERAL'];

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Extrae valores únicos no nulos de un array de objetos.
 * @param {Array} rows - Resultado de la consulta SQL
 * @param {string} field - Nombre del campo a extraer
 * @returns {string[]} - Array de valores únicos ordenados
 */
function extractValues(rows, field) {
    const values = new Set();
    for (const row of rows) {
        const val = row[field];
        if (val !== null && val !== undefined && val !== '') {
            values.add(String(val).trim());
        }
    }
    return [...values].sort((a, b) => a.localeCompare(b));
}

// ============================================================================
// MÉTODOS PRINCIPALES
// ============================================================================

/**
 * Obtiene la lista de estados disponibles siguiendo el fallback inteligente.
 * Resultado cacheado 60s por usuario (la staleness es aceptable para dropdowns).
 * @param {number} usuarioId - ID del usuario autenticado
 * @returns {Promise<string[]>} - Array de estados únicos ordenados
 */
async function getEstados(usuarioId) {
    // Caché por usuario (60s): evita el SELECT DISTINCT en cada carga de Solicitudes
    if (usuarioId) {
        const cached = cache.getEstadosUsuario(usuarioId);
        if (cached) return cached;
    }

    let valores;
    // 1. Buscar global (toda la aplicación, todos los usuarios)
    const globalResult = await pool.query(`
        SELECT DISTINCT estado
        FROM solicitudes
        WHERE estado IS NOT NULL
          AND estado != ''
        ORDER BY estado
    `);

    const globalValues = extractValues(globalResult.rows, 'estado');
    if (globalValues.length > 0) {
        valores = globalValues;
    }

    // 2. Base de datos vacía → valores por defecto
    if (!valores) {
        valores = [...DEFAULT_ESTADOS];
    }

    if (usuarioId) {
        cache.setEstadosUsuario(usuarioId, valores);
    }
    return valores;
}

/**
 * Obtiene la lista de segmentos disponibles siguiendo el fallback inteligente.
 * Resultado cacheado 60s por usuario (la staleness es aceptable para dropdowns).
 * @param {number} usuarioId - ID del usuario autenticado
 * @returns {Promise<string[]>} - Array de segmentos únicos ordenados
 */
async function getSegmentos(usuarioId) {
    // Caché por usuario (60s): evita el SELECT DISTINCT en cada carga de Solicitudes
    if (usuarioId) {
        const cached = cache.getSegmentosUsuario(usuarioId);
        if (cached) return cached;
    }

    let valores;
    // 1. Buscar global (toda la aplicación, todos los usuarios)
    const globalResult = await pool.query(`
        SELECT DISTINCT segmento
        FROM solicitudes
        WHERE segmento IS NOT NULL
          AND segmento != ''
        ORDER BY segmento
    `);

    const globalValues = extractValues(globalResult.rows, 'segmento');
    if (globalValues.length > 0) {
        valores = globalValues;
    }

    // 2. Base de datos vacía → valores por defecto
    if (!valores) {
        valores = [...DEFAULT_SEGMENTOS];
    }

    if (usuarioId) {
        cache.setSegmentosUsuario(usuarioId, valores);
    }
    return valores;
}

module.exports = {
    getEstados,
    getSegmentos,
    DEFAULT_ESTADOS,
    DEFAULT_SEGMENTOS
};
