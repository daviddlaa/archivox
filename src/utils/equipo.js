// ============================================================================
// RESOLVER DE EQUIPO VÁLIDO
// ============================================================================
// La sesión guarda un equipo_id calculado al momento del login. Si ese equipo
// fue borrado o el usuario fue dado de baja (fecha_salida), usar el valor de la
// sesión al INSERTAR rompe la FK gestiones_maestro_equipo_id_fkey en PostgreSQL
// y bloquearía la creación de campañas. Este resolver recalcula el equipo real
// del usuario (misma lógica del login) garantizando que cualquier usuario pueda
// crear, indistintamente de su rol o membresía.
// ============================================================================

const pool = require('../config/db');

function getFirstRow(result) {
    return result && result.rows && result.rows.length > 0 ? result.rows[0] : null;
}

async function obtenerEquipoIdValido(usuarioId, equipoIdSesion) {
    if (!usuarioId) return null;

    // 1) Si la sesión trae un equipo y el usuario mantiene membresía activa en
    //    un equipo existente con ese id, usarlo (rápido y conservador).
    var equipoIdSesionNum = Number(equipoIdSesion);
    if (equipoIdSesionNum) {
        equipoIdSesion = equipoIdSesionNum;
        const r = await pool.query(
            `SELECT e.id
             FROM equipos e
             INNER JOIN equipo_usuarios eu ON eu.equipo_id = e.id
             WHERE eu.usuario_id = ? AND eu.fecha_salida IS NULL AND e.id = ?
             LIMIT 1`,
            [usuarioId, equipoIdSesion]
        );
        const row = getFirstRow(r);
        if (row) return Number(row.id);
    }

    // 2) Recalcular desde la membresía activa (priorizando es_lider), igual que el login.
    const r2 = await pool.query(
        `SELECT e.id, e.nombre, eu.es_lider
         FROM equipo_usuarios eu
         INNER JOIN equipos e ON eu.equipo_id = e.id
         WHERE eu.usuario_id = ? AND eu.fecha_salida IS NULL
         ORDER BY eu.es_lider DESC, e.nombre ASC
         LIMIT 1`,
        [usuarioId]
    );
    const row2 = getFirstRow(r2);
    if (row2) return Number(row2.id);

    // 3) Sin membresía: null (la columna equipo_id es nullable en ambos motores).
    return null;
}

module.exports = { obtenerEquipoIdValido };