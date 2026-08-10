// ============================================================================
// CATALOG SERVICE — Catálogos dinámicos con fallback inteligente
// ============================================================================
// Proporciona métodos para obtener listas de estados y segmentos
// con la siguiente lógica de resolución:
//   1. Buscar valores del usuario autenticado.
//   2. Si está vacío → buscar DISTINCT global (todos los usuarios).
//   3. Si está vacío → devolver valores por defecto.
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
 * @param {number} usuarioId - ID del usuario autenticado
 * @returns {Promise<string[]>} - Array de estados únicos ordenados
 */
async function getEstados(usuarioId) {
    // 1. Intentar con el usuario autenticado
    if (usuarioId) {
        const userResult = await pool.query(`
            SELECT DISTINCT estado
            FROM solicitudes
            WHERE usuario_id = $1
              AND estado IS NOT NULL
              AND estado != ''
            ORDER BY estado
        `, [usuarioId]);

        const userValues = extractValues(userResult.rows, 'estado');
        if (userValues.length > 0) {
            return userValues;
        }
    }

    // 2. Fallback: buscar global (todos los usuarios)
    const globalResult = await pool.query(`
        SELECT DISTINCT estado
        FROM solicitudes
        WHERE estado IS NOT NULL
          AND estado != ''
        ORDER BY estado
    `);

    const globalValues = extractValues(globalResult.rows, 'estado');
    if (globalValues.length > 0) {
        return globalValues;
    }

    // 3. Base de datos vacía → valores por defecto
    return [...DEFAULT_ESTADOS];
}

/**
 * Obtiene la lista de segmentos disponibles siguiendo el fallback inteligente.
 * @param {number} usuarioId - ID del usuario autenticado
 * @returns {Promise<string[]>} - Array de segmentos únicos ordenados
 */
async function getSegmentos(usuarioId) {
    // 1. Intentar con el usuario autenticado
    if (usuarioId) {
        const userResult = await pool.query(`
            SELECT DISTINCT segmento
            FROM solicitudes
            WHERE usuario_id = $1
              AND segmento IS NOT NULL
              AND segmento != ''
            ORDER BY segmento
        `, [usuarioId]);

        const userValues = extractValues(userResult.rows, 'segmento');
        if (userValues.length > 0) {
            return userValues;
        }
    }

    // 2. Fallback: buscar global (todos los usuarios)
    const globalResult = await pool.query(`
        SELECT DISTINCT segmento
        FROM solicitudes
        WHERE segmento IS NOT NULL
          AND segmento != ''
        ORDER BY segmento
    `);

    const globalValues = extractValues(globalResult.rows, 'segmento');
    if (globalValues.length > 0) {
        return globalValues;
    }

    // 3. Base de datos vacía → valores por defecto
    return [...DEFAULT_SEGMENTOS];
}

module.exports = {
    getEstados,
    getSegmentos,
    DEFAULT_ESTADOS,
    DEFAULT_SEGMENTOS
};
