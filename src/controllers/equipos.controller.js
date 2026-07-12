// ============================================================================
// CONTROLADOR DE EQUIPOS — Arquitectura Multi-Equipo v3.0
// ============================================================================
// Gestiona equipos, agentes y asignaciones. Backend de la capa organizacional.
// Todos los métodos se definen como funciones nombradas y se exportan al final.
// ============================================================================

const bcrypt = require('bcryptjs');
const pool = require('../config/db.js');

// ============================================================================
// HELPERS
// ============================================================================

function getUsuarioId(req) {
    return req.session?.usuario?.id || null;
}

async function auditar(usuarioId, accion, targetType, targetId, detalle, req) {
    try {
        await pool.query(
            `INSERT INTO audit_log (usuario_id, accion, target_type, target_id, detalle, ip_address, user_agent)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [usuarioId, accion, targetType || null, targetId || null,
             detalle ? JSON.stringify(detalle) : null,
             req?.headers['x-forwarded-for']?.split(',')[0]?.trim() || req?.ip || null,
             req?.headers['user-agent'] || null]
        );
    } catch (err) {
        console.error('[Equipos] Error auditando:', err.message);
    }
}

// ============================================================================
// Verificar que un agente pertenece al equipo del líder
// SuperAdmin siempre puede administrar cualquier agente
// ============================================================================
async function verificarAgenteEnEquipo(equipoId, agenteId, req) {
    // Superadmin bypass
    if (req?.session?.usuario?.is_superadmin || req?.session?.usuario?.rol === 'superadmin') {
        return true;
    }
    const result = await pool.query(
        `SELECT id FROM equipo_usuarios
         WHERE equipo_id = $1 AND usuario_id = $2 AND fecha_salida IS NULL`,
        [equipoId, agenteId]
    );
    return result.rows.length > 0;
}

// ============================================================================
// LISTAR EQUIPOS
// ============================================================================
// GET /api/equipos
// GET /api/equipos?activo=1
async function listar(req, res) {
    try {
        const { activo } = req.query;
        const user = req.session.usuario;

        let sql = 'SELECT e.*, (SELECT COUNT(*) FROM equipo_usuarios eu WHERE eu.equipo_id = e.id AND eu.fecha_salida IS NULL) as miembros_activos FROM equipos e WHERE 1=1';
        const params = [];
        let paramIdx = 1;

        // Líderes y agentes solo ven su propio equipo
        if (user.rol === 'lider' || user.rol === 'agente' || user.rol === 'user') {
            sql += ' AND e.id = $' + paramIdx++;
            params.push(user.equipo_id);
        }

        if (activo !== undefined) {
            sql += ' AND e.activo = $' + paramIdx++;
            params.push(activo === '1' || activo === 'true' ? 1 : 0);
        }

        sql += ' ORDER BY e.nombre ASC';

        const result = await pool.query(sql, params);

        // Obtener miembros, campañas y líder para cada equipo
        const equiposConDetalle = await Promise.all(result.rows.map(async (eq) => {
            const [miembrosRes, campanasRes] = await Promise.all([
                pool.query(
                    `SELECT u.id as usuario_id, u.username as usuario_username, u.nombre as usuario_nombre, u.rol as usuario_rol,
                            eu.es_lider, eu.fecha_ingreso, eu.fecha_salida
                     FROM equipo_usuarios eu
                     INNER JOIN usuarios u ON eu.usuario_id = u.id
                     WHERE eu.equipo_id = $1 AND eu.fecha_salida IS NULL
                     ORDER BY eu.es_lider DESC, u.nombre ASC`,
                    [eq.id]
                ),
                pool.query(
                    `SELECT COUNT(*) as total FROM gestiones_maestro WHERE equipo_id = $1`,
                    [eq.id]
                )
            ]);
            return {
                ...eq,
                miembros: miembrosRes.rows,
                total_miembros: miembrosRes.rows.length,
                campanas_count: parseInt(campanasRes.rows[0]?.total) || 0
            };
        }));

        res.json({ data: equiposConDetalle });
    } catch (err) {
        console.error('[Equipos] Error listar:', err);
        res.status(500).json({ error: err.message });
    }
}

// ============================================================================
// OBTENER EQUIPO POR ID
// ============================================================================
// GET /api/equipos/:id
async function obtener(req, res) {
    try {
        const { id } = req.params;
        const result = await pool.query(
            `SELECT e.*
             FROM equipos e WHERE e.id = $1`,
            [id]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Equipo no encontrado' });
        }

        const eq = result.rows[0];

        // Obtener miembros, campañas y asignaciones
        const [miembrosRes, campanasRes, asignacionesRes] = await Promise.all([
            pool.query(
                `SELECT u.id as usuario_id, u.username as usuario_username, u.nombre as usuario_nombre,
                        u.rol as usuario_rol, u.is_active as usuario_activo,
                        eu.es_lider, eu.fecha_ingreso, eu.fecha_salida
                 FROM equipo_usuarios eu
                 INNER JOIN usuarios u ON eu.usuario_id = u.id
                 WHERE eu.equipo_id = $1
                 ORDER BY eu.fecha_salida DESC NULLS FIRST, eu.es_lider DESC, u.nombre ASC`,
                [id]
            ),
            pool.query(
                `SELECT COUNT(*) as total FROM gestiones_maestro WHERE equipo_id = $1`,
                [id]
            ),
            pool.query(
                `SELECT COUNT(*) as total FROM asignaciones_solicitudes
                 WHERE equipo_id = $1 AND fecha_desasignacion IS NULL`,
                [id]
            )
        ]);

        res.json({
            ...eq,
            miembros: miembrosRes.rows,
            total_miembros: miembrosRes.rows.filter(m => !m.fecha_salida).length,
            total_campanas: parseInt(campanasRes.rows[0]?.total) || 0,
            total_asignaciones: parseInt(asignacionesRes.rows[0]?.total) || 0
        });
    } catch (err) {
        console.error('[Equipos] Error obtener:', err);
        res.status(500).json({ error: err.message });
    }
}

// ============================================================================
// CREAR EQUIPO
// ============================================================================
// POST /api/equipos (solo superadmin)
async function crear(req, res) {
    try {
        const { nombre, descripcion } = req.body;
        const usuarioId = getUsuarioId(req);

        if (!nombre || !nombre.trim()) {
            return res.status(400).json({ error: 'El nombre del equipo es requerido' });
        }

        const result = await pool.query(
            `INSERT INTO equipos (nombre, descripcion) VALUES ($1, $2)
             RETURNING id, nombre, descripcion, created_at`,
            [nombre.trim(), descripcion || null]
        );

        await auditar(usuarioId, 'equipo.created', 'equipo', result.rows[0].id,
            { nombre, descripcion }, req);

        res.status(201).json({
            mensaje: 'Equipo creado correctamente',
            data: result.rows[0]
        });
    } catch (err) {
        if (err.code === '23505' || err.message?.includes('UNIQUE')) {
            return res.status(400).json({ error: 'Ya existe un equipo con ese nombre' });
        }
        console.error('[Equipos] Error crear:', err);
        res.status(500).json({ error: err.message });
    }
}

// ============================================================================
// ACTUALIZAR EQUIPO
// ============================================================================
// PUT /api/equipos/:id (solo superadmin)
async function actualizar(req, res) {
    try {
        const { id } = req.params;
        const { nombre, descripcion, activo } = req.body;
        const usuarioId = getUsuarioId(req);

        const updates = [];
        const params = [];
        let paramIdx = 1;

        if (nombre !== undefined) {
            updates.push('nombre = $' + paramIdx++);
            params.push(nombre.trim());
        }
        if (descripcion !== undefined) {
            updates.push('descripcion = $' + paramIdx++);
            params.push(descripcion);
        }
        if (activo !== undefined) {
            updates.push('activo = $' + paramIdx++);
            params.push(activo === true || activo === 'true' || activo === 1 ? 1 : 0);
        }

        if (updates.length === 0) {
            return res.status(400).json({ error: 'No hay campos para actualizar' });
        }

        updates.push('updated_at = CURRENT_TIMESTAMP');
        params.push(id);

        const result = await pool.query(
            `UPDATE equipos SET ${updates.join(', ')} WHERE id = $${paramIdx}
             RETURNING id, nombre, descripcion, activo, updated_at`,
            params
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Equipo no encontrado' });
        }

        await auditar(usuarioId, 'equipo.updated', 'equipo', parseInt(id),
            { cambios: req.body }, req);

        res.json({ mensaje: 'Equipo actualizado', data: result.rows[0] });
    } catch (err) {
        if (err.code === '23505' || err.message?.includes('UNIQUE')) {
            return res.status(400).json({ error: 'Ya existe un equipo con ese nombre' });
        }
        console.error('[Equipos] Error actualizar:', err);
        res.status(500).json({ error: err.message });
    }
}

// ============================================================================
// LISTAR MIEMBROS DE UN EQUIPO
// ============================================================================
// GET /api/equipos/:id/miembros
async function listarMiembros(req, res) {
    try {
        const { id } = req.params;
        const result = await pool.query(
            `SELECT u.id as usuario_id, u.username as usuario_username, u.nombre as usuario_nombre, u.email, u.rol as usuario_rol, u.is_active as usuario_activo,
                    eu.es_lider, eu.fecha_ingreso, eu.fecha_salida,
                    (SELECT COUNT(*) FROM asignaciones_solicitudes a
                     WHERE a.usuario_id = u.id AND a.fecha_desasignacion IS NULL) as solicitudes_activas
             FROM equipo_usuarios eu
             INNER JOIN usuarios u ON eu.usuario_id = u.id
             WHERE eu.equipo_id = $1
             ORDER BY eu.fecha_salida DESC NULLS FIRST, eu.es_lider DESC, u.nombre ASC`,
            [id]
        );
        res.json({ data: result.rows });
    } catch (err) {
        console.error('[Equipos] Error listarMiembros:', err);
        res.status(500).json({ error: err.message });
    }
}

// ============================================================================
// CREAR AGENTE (Líder crea agentes en su equipo)
// ============================================================================
// POST /api/equipos/:id/agentes
async function crearAgente(req, res) {
    try {
        const { id } = req.params;
        const { username, password, nombre, email } = req.body;
        const usuarioId = getUsuarioId(req);

        if (!username || !password) {
            return res.status(400).json({ error: 'Usuario y contraseña son requeridos' });
        }
        if (password.length < 8 || !/[A-Z]/.test(password) || !/[0-9]/.test(password)) {
            return res.status(400).json({
                error: 'Contraseña debe tener mínimo 8 caracteres, una mayúscula y un número'
            });
        }

        const passwordHash = bcrypt.hashSync(password, 10);
        const client = await pool.connect();

        try {
            await client.query('BEGIN');

            const userResult = await client.query(
                `INSERT INTO usuarios (username, password, nombre, email, rol, updated_at)
                 VALUES ($1, $2, $3, $4, 'agente', CURRENT_TIMESTAMP)
                 RETURNING id, username, nombre, rol`,
                [username, passwordHash, nombre || username, email || null]
            );

            const nuevoAgente = userResult.rows[0];

            await client.query(
                `INSERT INTO equipo_usuarios (equipo_id, usuario_id, es_lider)
                 VALUES ($1, $2, 0)`,
                [id, nuevoAgente.id]
            );

            await client.query('COMMIT');

            await auditar(usuarioId, 'agente.created', 'agente', nuevoAgente.id,
                { username, equipo_id: parseInt(id) }, req);

            res.status(201).json({
                mensaje: 'Agente creado y asignado al equipo',
                data: nuevoAgente
            });
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    } catch (err) {
        if (err.code === '23505' || err.message?.includes('UNIQUE')) {
            return res.status(400).json({ error: 'El nombre de usuario ya existe' });
        }
        console.error('[Equipos] Error crearAgente:', err);
        res.status(500).json({ error: err.message });
    }
}

// ============================================================================
// MOVER USUARIO A OTRO EQUIPO (superadmin)
// ============================================================================
// POST /api/equipos/:id/mover-usuario
async function moverUsuario(req, res) {
    try {
        const { id } = req.params;
        const { usuario_id, es_lider } = req.body;
        const adminId = getUsuarioId(req);

        if (!usuario_id) {
            return res.status(400).json({ error: 'usuario_id es requerido' });
        }

        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            await client.query(
                `UPDATE equipo_usuarios
                 SET fecha_salida = CURRENT_TIMESTAMP, motivo_salida = 'transferido'
                 WHERE usuario_id = $1 AND fecha_salida IS NULL`,
                [usuario_id]
            );

            await client.query(
                `INSERT INTO equipo_usuarios (equipo_id, usuario_id, es_lider)
                 VALUES ($1, $2, $3)`,
                [id, usuario_id, es_lider ? 1 : 0]
            );

            await client.query('COMMIT');

            await auditar(adminId, 'usuario.transferido', 'equipo', parseInt(id),
                { usuario_id, nuevo_equipo: parseInt(id), es_lider: !!es_lider }, req);

            res.json({ mensaje: 'Usuario transferido de equipo correctamente' });
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    } catch (err) {
        console.error('[Equipos] Error moverUsuario:', err);
        res.status(500).json({ error: err.message });
    }
}

// ============================================================================
// ASIGNAR LÍDER
// ============================================================================
// PUT /api/equipos/:id/asignar-lider
async function asignarLider(req, res) {
    try {
        const { id } = req.params;
        const { usuario_id } = req.body;
        const adminId = getUsuarioId(req);

        if (!usuario_id) {
            return res.status(400).json({ error: 'usuario_id es requerido' });
        }

        // Verificar que el usuario pertenece al equipo
        const check = await pool.query(
            `SELECT id FROM equipo_usuarios
             WHERE equipo_id = $1 AND usuario_id = $2 AND fecha_salida IS NULL`,
            [id, usuario_id]
        );

        if (check.rows.length === 0) {
            return res.status(400).json({ error: 'El usuario no pertenece a este equipo o está inactivo' });
        }

        // Transacción atómica: quitar líder anterior y asignar nuevo
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            await client.query(
                `UPDATE equipo_usuarios SET es_lider = 0
                 WHERE equipo_id = $1 AND es_lider = 1 AND fecha_salida IS NULL`,
                [id]
            );

            await client.query(
                `UPDATE equipo_usuarios SET es_lider = 1
                 WHERE equipo_id = $1 AND usuario_id = $2`,
                [id, usuario_id]
            );

            await client.query('COMMIT');
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }

        await auditar(adminId, 'lider.asignado', 'equipo', parseInt(id),
            { nuevo_lider: usuario_id }, req);

        res.json({ mensaje: 'Líder asignado correctamente' });
    } catch (err) {
        console.error('[Equipos] Error asignarLider:', err);
        res.status(500).json({ error: err.message });
    }
}

// ============================================================================
// REMOVER MIEMBRO DEL EQUIPO
// ============================================================================
// PUT /api/equipos/:id/remover-miembro
async function removerMiembro(req, res) {
    try {
        const { id } = req.params;
        const { usuario_id } = req.body;
        const adminId = getUsuarioId(req);

        if (!usuario_id) {
            return res.status(400).json({ error: 'usuario_id es requerido' });
        }

        // Verificar que el usuario pertenece al equipo y está activo
        const check = await pool.query(
            `SELECT es_lider FROM equipo_usuarios
             WHERE equipo_id = $1 AND usuario_id = $2 AND fecha_salida IS NULL`,
            [id, usuario_id]
        );

        if (check.rows.length === 0) {
            return res.status(400).json({ error: 'El usuario no pertenece a este equipo o ya está inactivo' });
        }

        if (check.rows[0].es_lider) {
            return res.status(400).json({ error: 'No puedes remover al líder del equipo. Primero asigna otro líder.' });
        }

        // Marcar como salida
        await pool.query(
            `UPDATE equipo_usuarios
             SET fecha_salida = CURRENT_TIMESTAMP, motivo_salida = 'removido'
             WHERE equipo_id = $1 AND usuario_id = $2 AND fecha_salida IS NULL`,
            [id, usuario_id]
        );

        await auditar(adminId, 'miembro.removido', 'equipo', parseInt(id),
            { usuario_id }, req);

        res.json({ mensaje: 'Miembro removido del equipo correctamente' });
    } catch (err) {
        console.error('[Equipos] Error removerMiembro:', err);
        res.status(500).json({ error: err.message });
    }
}

// ============================================================================
// MI EQUIPO (usuario autenticado)
// ============================================================================
// GET /api/equipos/mi-equipo
async function miEquipo(req, res) {
    try {
        const usuarioId = getUsuarioId(req);
        if (!usuarioId) {
            return res.status(401).json({ error: 'No autenticado' });
        }

        const result = await pool.query(
            `SELECT e.id, e.nombre, e.descripcion, eu.es_lider, eu.fecha_ingreso,
                    (SELECT COUNT(*) FROM equipo_usuarios eu2
                     WHERE eu2.equipo_id = e.id AND eu2.fecha_salida IS NULL AND eu2.es_lider = 0) as total_agentes,
                    (SELECT COUNT(*) FROM asignaciones_solicitudes a
                     WHERE a.equipo_id = e.id AND a.fecha_desasignacion IS NULL) as asignaciones_activas
             FROM equipo_usuarios eu
             INNER JOIN equipos e ON eu.equipo_id = e.id
             WHERE eu.usuario_id = $1 AND eu.fecha_salida IS NULL
             LIMIT 1`,
            [usuarioId]
        );

        if (result.rows.length === 0) {
            return res.json({ equipo: null, mensaje: 'No perteneces a ningún equipo' });
        }

        res.json(result.rows[0]);
    } catch (err) {
        console.error('[Equipos] Error miEquipo:', err);
        res.status(500).json({ error: err.message });
    }
}

// ============================================================================
// DASHBOARD DEL EQUIPO (Líder)
// ============================================================================
// GET /api/equipos/:id/dashboard
async function dashboardEquipo(req, res) {
    try {
        const { id } = req.params;

        const agentes = await pool.query(
            `SELECT u.id, u.username, u.nombre, u.is_active,
                    (SELECT COUNT(*) FROM asignaciones_solicitudes a
                     WHERE a.usuario_id = u.id AND a.fecha_desasignacion IS NULL) as asignadas,
                    (SELECT COUNT(*) FROM gestiones g WHERE g.usuario_id = u.id
                     AND g.created_at >= CURRENT_TIMESTAMP - INTERVAL '7 days') as gestiones_7d
             FROM equipo_usuarios eu
             INNER JOIN usuarios u ON eu.usuario_id = u.id
             WHERE eu.equipo_id = $1 AND eu.fecha_salida IS NULL AND eu.es_lider = 0
             ORDER BY u.nombre ASC`,
            [id]
        );

        const totales = await pool.query(
            `SELECT
                COUNT(DISTINCT a.solicitud_id) as total_asignadas,
                COUNT(DISTINCT a.usuario_id) as agentes_con_asignaciones
             FROM asignaciones_solicitudes a
             WHERE a.equipo_id = $1 AND a.fecha_desasignacion IS NULL`,
            [id]
        );

        const campañas = await pool.query(
            `SELECT gm.id, gm.nombre, gm.total_solicitudes, gm.gestionadas, gm.estado, gm.created_at
             FROM gestiones_maestro gm
             WHERE gm.equipo_id = $1 AND gm.estado = 'activa'
             ORDER BY gm.created_at DESC
             LIMIT 10`,
            [id]
        );

        res.json({
            agentes: agentes.rows,
            totales: {
                asignadas: parseInt(totales.rows[0]?.total_asignadas) || 0,
                agentes_con_asignaciones: parseInt(totales.rows[0]?.agentes_con_asignaciones) || 0
            },
            campañas: campañas.rows
        });
    } catch (err) {
        console.error('[Equipos] Error dashboardEquipo:', err);
        res.status(500).json({ error: err.message });
    }
}

// ============================================================================
// GESTIONES DEL EQUIPO (Líder ve gestiones de sus agentes)
// ============================================================================
// GET /api/equipos/:id/gestiones?limite=50&offset=0
async function gestionesEquipo(req, res) {
    try {
        const { id } = req.params;
        const { limite = 50, offset = 0 } = req.query;

        const result = await pool.query(
            `SELECT g.id, g.solicitud_id, g.tipo_gestion, g.observacion, g.fecha_gestion,
                    u.username as agente_username, u.nombre as agente_nombre,
                    s.cedula, s.nombre as cliente_nombre, s.estado as estado_solicitud
             FROM gestiones g
             INNER JOIN usuarios u ON g.usuario_id = u.id
             INNER JOIN equipo_usuarios eu ON u.id = eu.usuario_id
             LEFT JOIN solicitudes s ON g.solicitud_id = s.id_solicitud
             WHERE eu.equipo_id = $1 AND eu.fecha_salida IS NULL
             ORDER BY g.fecha_gestion DESC
             LIMIT $2 OFFSET $3`,
            [id, parseInt(limite), parseInt(offset)]
        );

        res.json({
            data: result.rows,
            total: result.rows.length,
            limite: parseInt(limite),
            offset: parseInt(offset)
        });
    } catch (err) {
        console.error('[Equipos] Error gestionesEquipo:', err);
        res.status(500).json({ error: err.message });
    }
}

// ============================================================================
// TOGGLE ACTIVO AGENTE (Líder activa/desactiva sus agentes)
// ============================================================================
// PUT /api/equipos/:id/agentes/:agenteId/toggle-active
async function toggleActivoAgente(req, res) {
    try {
        const { id, agenteId } = req.params;
        const usuarioId = getUsuarioId(req);

        // Verificar que el agente pertenece al equipo
        const pertenece = await verificarAgenteEnEquipo(id, agenteId, req);
        if (!pertenece) {
            return res.status(400).json({ error: 'El agente no pertenece a este equipo' });
        }

        const userResult = await pool.query(
            'SELECT id, username, is_active FROM usuarios WHERE id = $1',
            [agenteId]
        );
        if (userResult.rows.length === 0) {
            return res.status(404).json({ error: 'Agente no encontrado' });
        }

        const nuevoEstado = !userResult.rows[0].is_active;

        await pool.query(
            `UPDATE usuarios SET is_active = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
            [nuevoEstado, agenteId]
        );

        await auditar(usuarioId, 'agente.toggle_active', 'agente', parseInt(agenteId),
            { username: userResult.rows[0].username, nuevo_estado: nuevoEstado }, req);

        res.json({
            mensaje: nuevoEstado ? 'Agente activado' : 'Agente desactivado',
            is_active: nuevoEstado
        });
    } catch (err) {
        console.error('[Equipos] Error toggleActivoAgente:', err);
        res.status(500).json({ error: err.message });
    }
}

// ============================================================================
// RESET PASSWORD AGENTE (Líder resetea contraseña de sus agentes)
// ============================================================================
// PUT /api/equipos/:id/agentes/:agenteId/reset-password
async function resetPasswordAgente(req, res) {
    try {
        const { id, agenteId } = req.params;
        const { nueva_password } = req.body;
        const usuarioId = getUsuarioId(req);

        if (!nueva_password || nueva_password.length < 8 || !/[A-Z]/.test(nueva_password) || !/[0-9]/.test(nueva_password)) {
            return res.status(400).json({
                error: 'La contraseña debe tener mínimo 8 caracteres, una mayúscula y un número'
            });
        }

        // Verificar que el agente pertenece al equipo
        const pertenece = await verificarAgenteEnEquipo(id, agenteId, req);
        if (!pertenece) {
            return res.status(400).json({ error: 'El agente no pertenece a este equipo' });
        }

        const userResult = await pool.query(
            'SELECT id, username FROM usuarios WHERE id = $1',
            [agenteId]
        );
        if (userResult.rows.length === 0) {
            return res.status(404).json({ error: 'Agente no encontrado' });
        }

        const passwordHash = bcrypt.hashSync(nueva_password, 10);

        await pool.query(
            `UPDATE usuarios SET password = $1, password_changed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
            [passwordHash, agenteId]
        );

        await auditar(usuarioId, 'agente.password_reset', 'agente', parseInt(agenteId),
            { username: userResult.rows[0].username }, req);

        res.json({ mensaje: 'Contraseña actualizada correctamente' });
    } catch (err) {
        console.error('[Equipos] Error resetPasswordAgente:', err);
        res.status(500).json({ error: err.message });
    }
}

// ============================================================================
// EDITAR AGENTE (Líder edita datos de sus agentes)
// ============================================================================
// PUT /api/equipos/:id/agentes/:agenteId
async function editarAgente(req, res) {
    try {
        const { id, agenteId } = req.params;
        const { nombre, email } = req.body;
        const usuarioId = getUsuarioId(req);

        // Verificar que el agente pertenece al equipo
        const pertenece = await verificarAgenteEnEquipo(id, agenteId, req);
        if (!pertenece) {
            return res.status(400).json({ error: 'El agente no pertenece a este equipo' });
        }

        const updates = [];
        const params = [];
        let paramIdx = 1;

        if (nombre !== undefined) {
            updates.push('nombre = $' + paramIdx++);
            params.push(nombre);
        }
        if (email !== undefined) {
            if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                return res.status(400).json({ error: 'Formato de email inválido' });
            }
            updates.push('email = $' + paramIdx++);
            params.push(email);
        }

        if (updates.length === 0) {
            return res.status(400).json({ error: 'No hay campos para actualizar' });
        }

        updates.push('updated_at = CURRENT_TIMESTAMP');
        params.push(agenteId);

        const result = await pool.query(
            `UPDATE usuarios SET ${updates.join(', ')} WHERE id = $${paramIdx}
             RETURNING id, username, nombre, email, rol`,
            params
        );

        await auditar(usuarioId, 'agente.updated', 'agente', parseInt(agenteId),
            { cambios: req.body }, req);

        res.json({ mensaje: 'Agente actualizado', data: result.rows[0] });
    } catch (err) {
        console.error('[Equipos] Error editarAgente:', err);
        res.status(500).json({ error: err.message });
    }
}

// ============================================================================
// CAMPANAS DEL EQUIPO
// ============================================================================
// GET /api/equipos/:id/campanas
async function campanasEquipo(req, res) {
    try {
        const { id } = req.params;
        const result = await pool.query(
            `SELECT gm.id, gm.nombre as nombre_campana, gm.total_solicitudes, gm.gestionadas,
                    gm.estado, gm.created_at, u.username as agente_username
             FROM gestiones_maestro gm
             LEFT JOIN usuarios u ON gm.usuario_id = u.id
             WHERE gm.equipo_id = $1
             ORDER BY gm.created_at DESC
             LIMIT 50`,
            [id]
        );
        res.json({ data: result.rows });
    } catch (err) {
        console.error('[Equipos] Error campanasEquipo:', err);
        res.status(500).json({ error: err.message });
    }
}

// ============================================================================
// EXPORTAR TODAS LAS FUNCIONES
// ============================================================================
module.exports = {
    listar,
    obtener,
    crear,
    actualizar,
    listarMiembros,
    crearAgente,
    moverUsuario,
    asignarLider,
    removerMiembro,
    miEquipo,
    dashboardEquipo,
    gestionesEquipo,
    campanasEquipo,
    toggleActivoAgente,
    resetPasswordAgente,
    editarAgente
};
