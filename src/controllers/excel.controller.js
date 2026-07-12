const excelService = require('../services/excel.service');
const pool = require('../config/db.js');
const cache = require('../config/cache.js');
const fs = require('fs');
const path = require('path');

exports.uploadExcel = async (req, res) => {

    try {

        if (!req.files || req.files.length === 0) {

            return res.status(400).json({
                error: 'No se enviaron archivos'
            });

        }

        // Obtener ID del usuario de la sesi�n
        const usuarioId = req.session.usuario?.id;
        if (!usuarioId) {
            return res.status(401).json({
                error: 'No autenticado'
            });
        }

        let totalRegistros = 0;
        let totalInserts = 0;
        let totalUpdates = 0;
        const todosDetalles = [];

        for (const archivo of req.files) {

            const resultado =
                await excelService.procesarExcel(
                    archivo.path,
                    usuarioId
                );

            totalRegistros += resultado.total;
            totalInserts += resultado.inserts;
            totalUpdates += resultado.updates;
            
            // Agregar detalles de actualizaciones
            if (resultado.detalles && resultado.detalles.length > 0) {
                todosDetalles.push(...resultado.detalles);
            }

        }

        // Invalidar caché del dashboard del usuario
        try { cache.invalidateDashboard(usuarioId); } catch(e) { /* silencioso */ }

        // Preparar mensaje según tipo de carga
        let mensaje = 'Importación exitosa';
        if (totalUpdates > 0) {
            mensaje = `Se actualizaron ${totalUpdates} registros`;
        }

        res.json({
            mensaje: mensaje,
            archivos: req.files.length,
            registros: totalRegistros,
            inserts: totalInserts,
            updates: totalUpdates,
            detalles: todosDetalles
        });

    } catch (error) {

        console.error(error);

        res.status(500).json({
            error: error.message
        });

    }

};

exports.listarSolicitudes = async (req, res) => {

    const {
        estado,
        segmento,
        cedula,
        producto,
        nombre,
        telefono,
        orden,
        direccion,
        limite = 50,
        offset = 0,
        cargarMas = 'false'
    } = req.query;

    // Obtener ID del usuario de la sesi�n
    const usuarioId = req.session.usuario?.id;
    if (!usuarioId) {
        return res.status(401).json({
            error: 'No autenticado'
        });
    }

    // ============================================================================
// LISTAR SOLICITUDES CON PAGINACIÓN OPTIMIZADA
// ============================================================================
// VERSIÓN OPTIMIZADA:
// 1. Usa LATERAL JOIN en lugar de subquery correlacionada (mucho más rápido con miles de registros)
// 2. LIMIT/OFFSET con parámetros (seguridad, sin SQL injection)
// 3. COUNT con los mismos filtros para paginación precisa
// 4. Ordenamiento por columnas mapeado a nombres reales de columna (evita SQL injection)
// ============================================================================

    // Mapa de columnas seguras para ordenamiento (evita SQL injection)
    const columnasPermitidas = {
        'id_solicitud': 's.id',
        'estado': 's.estado',
        'cedula': 's.cedula',
        'nombre': 's.nombre',
        'segmento': 's.segmento',
        'producto': 's.producto',
        'fecha_solicitud': 's.fecha_solicitud'
    };
    
    let sql = `SELECT s.*,
                   g.tipo_gestion as ultima_gestion_tipo,
                   g.observacion as ultima_gestion_obs,
                   g.fecha_gestion as ultima_gestion_fecha
            FROM solicitudes s
            LEFT JOIN LATERAL (
                SELECT g2.tipo_gestion, g2.observacion, g2.fecha_gestion
                FROM gestiones g2
                WHERE g2.solicitud_id = s.id_solicitud 
                  AND g2.usuario_id = s.usuario_id
                ORDER BY g2.fecha_gestion DESC
                LIMIT 1
            ) g ON TRUE
            WHERE s.usuario_id = $1`;
    const params = [usuarioId];
    let paramIndex = 2;

    if (estado) {
        sql += ' AND s.estado = $' + paramIndex++;
        params.push(estado);
    }

    if (segmento) {
        sql += ' AND s.segmento = $' + paramIndex++;
        params.push(segmento);
    }

    if (cedula) {
        sql += ' AND s.cedula = $' + paramIndex++;
        params.push(cedula);
    }

    if (producto) {
        sql += ' AND s.producto = $' + paramIndex++;
        params.push(producto);
    }

    if (nombre) {
        sql += ' AND LOWER(s.nombre) LIKE LOWER($' + paramIndex++ + ')';
        params.push('%' + nombre + '%');
    }

    if (telefono) {
        sql += ' AND s.celular::text LIKE $' + paramIndex++;
        params.push('%' + telefono + '%');
    }

    // Ordenamiento seguro (solo columnas permitidas)
    const columnaOrden = columnasPermitidas[orden] || 's.id';
    const direccionOrden = direccion === 'ASC' ? 'ASC' : 'DESC';
    sql += ' ORDER BY ' + columnaOrden + ' ' + direccionOrden;

    // Paginación con parámetros (seguridad)
    const limit = parseInt(limite) || 50;
    const offsetVal = parseInt(offset) || 0;
    sql += ' LIMIT $' + paramIndex++ + ' OFFSET $' + paramIndex++;
    params.push(limit, offsetVal);

    try {
        const [result, countResult] = await Promise.all([
            pool.query(sql, params),
            (() => {
                let countSql = 'SELECT COUNT(*) as total FROM solicitudes s WHERE s.usuario_id = $1';
                const countParams = [usuarioId];
                let countIdx = 2;
                if (estado) { countSql += ' AND s.estado = $' + countIdx++; countParams.push(estado); }
                if (segmento) { countSql += ' AND s.segmento = $' + countIdx++; countParams.push(segmento); }
                return pool.query(countSql, countParams);
            })()
        ]);

        const total = parseInt(countResult.rows[0]?.total) || 0;
        
        res.json({
            data: result.rows,
            total: total,
            limite: limit,
            offset: offsetVal
        });
    } catch (err) {
        return res.status(500).json({
            error: err.message
        });
    }

};
// ================== CONTROL DE VENTAS DEL EQUIPO ==================

// Obtener ventas del equipo por mes
exports.getVentasEquipo = async (req, res) => {
    const usuarioId = req.session.usuario?.id;
    if (!usuarioId) {
        console.error('ERROR getVentasEquipo: No hay usuarioId en sesión');
        return res.status(401).json({ error: 'No autenticado' });
    }
    
    console.log('DEBUG getVentasEquipo: usuarioId=', usuarioId);
    
    const { mes } = req.query;
    
    try {
        // SEGURIDAD: Asegurar que siempre filtramos por usuario_id válido
        let sql = `SELECT * FROM ventas_vendedores WHERE usuario_id = $1 AND usuario_id IS NOT NULL`;
        const params = [usuarioId];
        
        if (mes) {
            sql += ` AND mes = $2`;
            params.push(mes);
        }
        
        sql += ` ORDER BY vendedor ASC`;
        
        const result = await pool.query(sql, params);
        res.json(result.rows);
    } catch (err) {
        console.error('Error getVentasEquipo:', err);
        res.json([]);
    }
};

// Agregar vendedor al equipo
exports.addVendedor = async (req, res) => {
    const usuarioId = req.session.usuario?.id;
    if (!usuarioId) {
        return res.status(401).json({ error: 'No autenticado' });
    }
    
    const { mes, vendedor, periodo1 = 0, periodo2 = 0 } = req.body;
    
    if (!mes || !vendedor) {
        return res.status(400).json({ error: 'Mes y vendedor requeridos' });
    }
    
    try {
        // Upsert - insertar o actualizar
        const result = await pool.query(
            `INSERT INTO ventas_vendedores (usuario_id, mes, vendedor, periodo1, periodo2)
             VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT (mes, vendedor, usuario_id)
             DO UPDATE SET periodo1 = $4, periodo2 = $5, updated_at = CURRENT_TIMESTAMP
             RETURNING *`,
            [usuarioId, mes, vendedor, periodo1, periodo2]
        );
        
        res.json({ mensaje: 'Vendedor guardado', data: result.rows[0] });
    } catch (err) {
        console.error('Error addVendedor:', err);
        res.status(500).json({ error: err.message });
    }
};

// Eliminar vendedor
exports.deleteVendedor = async (req, res) => {
    const usuarioId = req.session.usuario?.id;
    if (!usuarioId) {
        return res.status(401).json({ error: 'No autenticado' });
    }
    
    const { id } = req.params;
    
    try {
        await pool.query(
            `DELETE FROM ventas_vendedores WHERE id = $1 AND usuario_id = $2`,
            [id, usuarioId]
        );
        
        res.json({ mensaje: 'Vendedor eliminado' });
    } catch (err) {
        console.error('Error deleteVendedor:', err);
        res.status(500).json({ error: err.message });
    }
};

// Obtener configuraci�n de bonos
exports.getConfigBonos = async (req, res) => {
    const usuarioId = req.session.usuario?.id;
    if (!usuarioId) {
        return res.status(401).json({ error: 'No autenticado' });
    }
    
    const { mes } = req.query;
    
    try {
        let sql = `SELECT * FROM config_bonos WHERE usuario_id = $1`;
        const params = [usuarioId];
        
        if (mes) {
            sql += ` AND mes = $2`;
            params.push(mes);
        }
        
        sql += ` ORDER BY mes DESC LIMIT 1`;
        
        const result = await pool.query(sql, params);
        
        if (result.rows.length > 0) {
            res.json(result.rows[0]);
        } else {
            // Devolver config por defecto
            res.json({
                bono1: 3000, bono2: 7000, bono3: 12000,
                bono4: 20000, bono5: 30000, bono6: 40000,
                meta_equipo: 40000
            });
        }
    } catch (err) {
        console.error('Error getConfigBonos:', err);
        res.json({});
    }
};

// Guardar configuraci�n de bonos
exports.saveConfigBonos = async (req, res) => {
    const usuarioId = req.session.usuario?.id;
    if (!usuarioId) {
        return res.status(401).json({ error: 'No autenticado' });
    }
    
    const {
        mes,
        bono1 = 3000, bono2 = 7000, bono3 = 12000,
        bono4 = 20000, bono5 = 30000, bono6 = 40000,
        meta_equipo = 40000
    } = req.body;
    
    if (!mes) {
        return res.status(400).json({ error: 'Mes requerido' });
    }
    
    try {
        const result = await pool.query(
            `INSERT INTO config_bonos (usuario_id, mes, bono1, bono2, bono3, bono4, bono5, bono6, meta_equipo)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
             ON CONFLICT (mes, usuario_id)
             DO UPDATE SET bono1 = $3, bono2 = $4, bono3 = $5, bono4 = $6, bono5 = $7, bono6 = $8, meta_equipo = $9
             RETURNING *`,
            [usuarioId, mes, bono1, bono2, bono3, bono4, bono5, bono6, meta_equipo]
        );
        
        res.json({ mensaje: 'Configuraci�n guardada', data: result.rows[0] });
} catch (err) {
        console.error('Error saveConfigBonos:', err);
        res.status(500).json({ error: err.message });
    }
};

// ================== GESTIONES ==================

// Crear una nueva gesti�n
exports.crearGestion = async (req, res) => {
    const usuarioId = req.session.usuario?.id;
    if (!usuarioId) {
        return res.status(401).json({ error: 'No autenticado' });
    }
    
    const { solicitud_id, tipo_gestion, observacion, gestion_maestro_id } = req.body;
    
    if (!solicitud_id || !tipo_gestion) {
        return res.status(400).json({ error: 'solicitud_id y tipo_gestion son requeridos' });
    }
    
    try {
const result = await pool.query(
            `INSERT INTO gestiones (solicitud_id, usuario_id, tipo_gestion, observacion, gestion_maestro_id)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING *`,
            [solicitud_id, usuarioId, tipo_gestion, observacion || '', gestion_maestro_id || null]
        );

        // Si tiene gestion_maestro_id, actualizar contador de progreso
        if (gestion_maestro_id) {
            try {
                await pool.query(
                    `UPDATE gestiones_maestro 
                     SET gestionadas = gestionadas + 1, updated_at = CURRENT_TIMESTAMP
                     WHERE id = $1`,
                    [gestion_maestro_id]
                );
                console.log('DEBUG: Contador actualizado para campaña:', gestion_maestro_id);
            } catch (e) {
                console.error('Error actualizando contador:', e);
            }
        }
        
        res.json({ mensaje: 'Gesti�n guardada', data: result.rows[0] });
    } catch (err) {
        console.error('Error crearGestion:', err);
        res.status(500).json({ error: err.message });
    }
};

// Obtener gestiones de una solicitud
exports.getGestiones = async (req, res) => {
    const usuarioId = req.session.usuario?.id;
    
    if (!usuarioId) {
        return res.status(401).json({ error: 'No autenticado' });
    }
    
    const { solicitud_id } = req.params;
    
    console.log('DEBUG getGestiones - solicitud_id:', solicitud_id, 'usuarioId:', usuarioId);
    
try {
        const result = await pool.query(
            `SELECT * FROM gestiones 
             WHERE solicitud_id = $1 AND usuario_id = $2
             ORDER BY fecha_gestion DESC`,
            [solicitud_id, usuarioId]
        );
        
        console.log('DEBUG getGestiones - rows:', result.rows.length);
        res.json(result.rows);
    } catch (err) {
        console.error('Error getGestiones:', err);
        res.status(500).json({ error: err.message });
    }
};

// ================== GESTIONES ÚLTIMAS (BATCH - UNA SOLA PETICIÓN) ==================

// Obtener última gestión de múltiples solicitudes en UNA sola query
// VERSIÓN SIMPLE Y ROBUSTA - Similar a getGestiones individual
exports.getGestionesUltimas = async (req, res) => {
    const usuarioId = req.session.usuario?.id;
    
    if (!usuarioId) {
        return res.status(401).json({ error: 'No autenticado' });
    }
    
    const { ids } = req.query;
    
    if (!ids) {
        return res.status(400).json({ error: 'IDs de solicitudes requeridos' });
    }
    
    // Convertir string "1,2,3" a array de enteros para evitar problemas de tipo
    const solicitudIds = ids.split(',').map(id => parseInt(id.trim(), 10)).filter(id => !isNaN(id));
    if (solicitudIds.length === 0) {
        return res.json({});
    }
    
    console.log('DEBUG getGestionesUltimas - ids count:', solicitudIds.length);

    // MÉTODO SIMPLE: Una sola query con IN clause
    // Usar la misma estructura que getGestiones pero para múltiples IDs
    try {
        const gestionessObj = {};
        const placeholders = solicitudIds.map((_, i) => '$' + (i + 1)).join(',');
        
        // Query simple: obtener todas las gestionessolo para los IDs dados, luego filtrar en memoria
        const sql = `
            SELECT g.id, g.solicitud_id, g.tipo_gestion, g.observacion, g.fecha_gestion
            FROM gestiones g
            WHERE g.solicitud_id IN (${placeholders}) 
              AND g.usuario_id = $${solicitudIds.length + 1}
            ORDER BY g.solicitud_id, g.fecha_gestion DESC
        `;
        
        const params = [...solicitudIds, usuarioId];
        console.log('DEBUG getGestionesUltimas - SQL params:', params.length);
        
        const result = await pool.query(sql, params);
        
        // Tomar solo el primero (más reciente) por cada solicitud_id
        let lastId = null;
        for (const row of result.rows) {
            if (row.solicitud_id !== lastId) {
                gestionessObj[row.solicitud_id] = {
                    id: row.id,
                    tipo_gestion: row.tipo_gestion,
                    observacion: row.observacion,
                    fecha_gestion: row.fecha_gestion
                };
                lastId = row.solicitud_id;
            }
        }
        
        console.log('DEBUG getGestionesUltimas - retornando:', Object.keys(gestionessObj).length, 'gestiones');
        res.json(gestionessObj);
    } catch (err2) {
        console.error('Error getGestionesUltimas:', err2);
        res.status(500).json({ error: err2.message });
    }
};

// Actualizar una gesti�n existente
exports.actualizarGestion = async (req, res) => {
    const usuarioId = req.session.usuario?.id;
    if (!usuarioId) {
        return res.status(401).json({ error: 'No autenticado' });
    }
    
    const { id } = req.params;
    const { tipo_gestion, observacion } = req.body;
    
    if (!id) {
        return res.status(400).json({ error: 'ID de gesti�n requerido' });
    }
    
    if (!tipo_gestion) {
        return res.status(400).json({ error: 'Tipo de gesti�n requerido' });
    }
    
try {
        const result = await pool.query(
            `UPDATE gestiones 
             SET tipo_gestion = $1, observacion = $2, updated_at = CURRENT_TIMESTAMP
             WHERE id = $3 AND usuario_id = $4
             RETURNING *`,
            [tipo_gestion, observacion || '', id, usuarioId]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Gesti�n no encontrada' });
        }
        
        res.json({ mensaje: 'Gesti�n actualizada', data: result.rows[0] });
    } catch (err) {
        console.error('Error actualizarGestion:', err);
        res.status(500).json({ error: err.message });
    }
};

// Eliminar una gesti�n
exports.eliminarGestion = async (req, res) => {
    const usuarioId = req.session.usuario?.id;
    if (!usuarioId) {
        return res.status(401).json({ error: 'No autenticado' });
    }
    
    const { id } = req.params;
    
    if (!id) {
        return res.status(400).json({ error: 'ID de gesti�n requerido' });
    }
    
try {
        const result = await pool.query(
            `DELETE FROM gestiones WHERE id = $1 AND usuario_id = $2 RETURNING id`,
            [id, usuarioId]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Gesti�n no encontrada' });
        }
        
        res.json({ mensaje: 'Gesti�n eliminada' });
    } catch (err) {
        console.error('Error eliminarGestion:', err);
        res.status(500).json({ error: err.message });
    }
};

// ================== EDITAR SOLICITUD (ESTADO + SEGMENTO) ==================

// Actualizar estado y segmento de una solicitud con auditoria
exports.actualizarSolicitudEditar = async (req, res) => {
    const usuarioId = req.session.usuario?.id;
    if (!usuarioId) {
        return res.status(401).json({ error: 'No autenticado' });
    }

    const { id } = req.params;
    const { estado, segmento } = req.body;

    if (!id) {
        return res.status(400).json({ error: 'ID de solicitud requerido' });
    }

    try {
        // 1. Obtener datos actuales de la solicitud
        const solicitudResult = await pool.query(
            'SELECT id_solicitud, estado, segmento FROM solicitudes WHERE id_solicitud = $1 AND usuario_id = $2',
            [id, usuarioId]
        );

        if (solicitudResult.rows.length === 0) {
            return res.status(404).json({ error: 'Solicitud no encontrada' });
        }

        const solicitudActual = solicitudResult.rows[0];
        const oldEstado = solicitudActual.estado || '';
        const oldSegmento = solicitudActual.segmento || '';

        // 2. Construir SET dinamico con los campos a actualizar
        const setClauses = [];
        const updateParams = [];
        let paramIdx = 1;
        let huboCambios = false;

        // Actualizar estado si se proporciono y es diferente
        const nuevoEstado = (estado !== undefined && estado !== null) ? String(estado).trim() : oldEstado;
        if (nuevoEstado !== oldEstado) {
            setClauses.push('estado = $' + paramIdx++);
            updateParams.push(nuevoEstado);
            huboCambios = true;
        }

        // Actualizar segmento si se proporciono y es diferente
        const nuevoSegmento = (segmento !== undefined && segmento !== null) ? String(segmento).trim() : oldSegmento;
        if (nuevoSegmento !== oldSegmento) {
            setClauses.push('segmento = $' + paramIdx++);
            updateParams.push(nuevoSegmento);
            huboCambios = true;
        }

        // Siempre actualizar fecha_actualizacion
        setClauses.push('fecha_actualizacion = CURRENT_TIMESTAMP');

        if (huboCambios) {
            // 3. Ejecutar UPDATE
            updateParams.push(id, usuarioId);
            const updateSql = 'UPDATE solicitudes SET ' + setClauses.join(', ') + ' WHERE id_solicitud = $' + paramIdx++ + ' AND usuario_id = $' + paramIdx++ + ' RETURNING *';

            const updateResult = await pool.query(updateSql, updateParams);

            // 4. Guardar auditoria para cada cambio
            if (nuevoEstado !== oldEstado) {
                try {
                    await pool.query(
                        'INSERT INTO historial_actualizaciones (solicitud_id, usuario_id, campo, valor_anterior, valor_nuevo) VALUES ($1, $2, $3, $4, $5)',
                        [id, usuarioId, 'estado', oldEstado, nuevoEstado]
                    );
                } catch (auditErr) {
                    console.error('Error guardando auditoria de estado:', auditErr.message);
                }
            }

            if (nuevoSegmento !== oldSegmento) {
                try {
                    await pool.query(
                        'INSERT INTO historial_actualizaciones (solicitud_id, usuario_id, campo, valor_anterior, valor_nuevo) VALUES ($1, $2, $3, $4, $5)',
                        [id, usuarioId, 'segmento', oldSegmento, nuevoSegmento]
                    );
                } catch (auditErr) {
                    console.error('Error guardando auditoria de segmento:', auditErr.message);
                }
            }            // Invalidar caché del dashboard
            try { cache.invalidateDashboard(usuarioId); } catch(e) { /* silencioso */ }

            res.json({ mensaje: 'Solicitud actualizada correctamente',
                data: updateResult.rows[0]
            });
        } else {
            // No hay cambios
            const solicitudFull = await pool.query(
                'SELECT * FROM solicitudes WHERE id_solicitud = $1 AND usuario_id = $2',
                [id, usuarioId]
            );
            res.json({
                mensaje: 'No se realizaron cambios (los valores son los mismos)',
                data: solicitudFull.rows[0]
            });
        }

    } catch (err) {
        console.error('Error actualizarSolicitudEditar:', err);
        res.status(500).json({ error: err.message });
    }
};

// ================== CODIGO PLUS ==================

// Actualizar codigo plus de una solicitud
// ================== DESTACAR SOLICITUD ==================

// Actualizar destacado de una solicitud
exports.destacarSolicitud = async (req, res) => {
    const usuarioId = req.session.usuario?.id;
    if (!usuarioId) {
        return res.status(401).json({ error: 'No autenticado' });
    }
    
    const { id } = req.params;
    const { destacado } = req.body;
    
    if (!id) {
        return res.status(400).json({ error: 'ID de solicitud requerido' });
    }
    
    if (destacado === undefined || (destacado !== 0 && destacado !== 1)) {
        return res.status(400).json({ error: 'El campo destacado debe ser 0 o 1' });
    }
    
    try {
        const result = await pool.query(
            `UPDATE solicitudes 
             SET destacado = $1, fecha_actualizacion = CURRENT_TIMESTAMP
             WHERE id_solicitud = $2 AND usuario_id = $3
             RETURNING id_solicitud, destacado`,
            [destacado, id, usuarioId]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Solicitud no encontrada' });
        }
        
        res.json({ 
            mensaje: destacado === 1 ? 'Solicitud destacada' : 'Solicitud no destacada', 
            data: result.rows[0] 
        });
    } catch (err) {
        console.error('Error destacarSolicitud:', err);
        res.status(500).json({ error: err.message });
    }
};

// ================== COMPLETAR INFO ==================

// Obtener solicitud con información completa (incluyendo referencias)
exports.getSolicitudCompleta = async (req, res) => {
    const usuarioId = req.session.usuario?.id;
    if (!usuarioId) {
        return res.status(401).json({ error: 'No autenticado' });
    }
    
    const { id } = req.params;
    
    try {
        // Obtener datos de la solicitud
        const solicitudResult = await pool.query(
            `SELECT id_solicitud, codigo_plus, correo_electronico, direccion, direccion_trabajo, ocupacion, ingreso_mensual
             FROM solicitudes WHERE id_solicitud = $1 AND usuario_id = $2`,
            [id, usuarioId]
        );
        
        if (solicitudResult.rows.length === 0) {
            return res.status(404).json({ error: 'Solicitud no encontrada' });
        }
        
        // Obtener referencias
        const referenciasResult = await pool.query(
            `SELECT id, nombre, telefono, relacion
             FROM solicitudes_referencias
             WHERE id_solicitud = $1
             ORDER BY id ASC`,
            [id]
        );
        
        res.json({
            ...solicitudResult.rows[0],
            referencias: referenciasResult.rows
        });
    } catch (err) {
        console.error('Error getSolicitudCompleta:', err);
        res.status(500).json({ error: err.message });
    }
};

// Actualizar información completa de una solicitud
exports.actualizarCompletarInfo = async (req, res) => {
    const usuarioId = req.session.usuario?.id;
    if (!usuarioId) {
        return res.status(401).json({ error: 'No autenticado' });
    }
    
    const { id } = req.params;
    const { codigo_plus, correo_electronico, direccion, direccion_trabajo, ocupacion, ingreso_mensual, referencias } = req.body;
    
    if (!id) {
        return res.status(400).json({ error: 'ID de solicitud requerido' });
    }
    
    const client = await pool.connect();
    
    try {
        await client.query('BEGIN');
        
        // 1. Actualizar solicitud
        const updateResult = await client.query(
            `UPDATE solicitudes 
             SET codigo_plus = $1, 
                 correo_electronico = $2,
                 direccion = $3, 
                 direccion_trabajo = $4, 
                 ocupacion = $5, 
                 ingreso_mensual = $6,
                 fecha_actualizacion = CURRENT_TIMESTAMP
             WHERE id_solicitud = $7 AND usuario_id = $8
             RETURNING *`,
            [codigo_plus || null, correo_electronico || null, direccion || null, direccion_trabajo || null, ocupacion || null, ingreso_mensual || null, id, usuarioId]
        );
        
        if (updateResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Solicitud no encontrada' });
        }
        
        // 2. Eliminar referencias existentes
        await client.query(
            `DELETE FROM solicitudes_referencias WHERE id_solicitud = $1`,
            [id]
        );
        
        // 3. Insertar nuevas referencias
        if (referencias && Array.isArray(referencias) && referencias.length > 0) {
            for (const ref of referencias) {
                if (ref.nombre && ref.nombre.trim()) {
                    await client.query(
                        `INSERT INTO solicitudes_referencias (id_solicitud, nombre, telefono, relacion)
                         VALUES ($1, $2, $3, $4)`,
                        [id, ref.nombre.trim(), ref.telefono || null, ref.relacion || null]
                    );
                }
            }
        }
        
        await client.query('COMMIT');
        
        res.json({ mensaje: 'Información guardada correctamente' });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error actualizarCompletarInfo:', err);
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
};

exports.actualizarCodigoPlus = async (req, res) => {
    const usuarioId = req.session.usuario?.id;
    if (!usuarioId) {
        return res.status(401).json({ error: 'No autenticado' });
    }
    
    const { id } = req.params;
    const { codigo_plus } = req.body;
    
    if (!id) {
        return res.status(400).json({ error: 'ID de solicitud requerido' });
    }
    
    try {
        const result = await pool.query(
            `UPDATE solicitudes 
             SET codigo_plus = $1, fecha_actualizacion = CURRENT_TIMESTAMP
             WHERE id_solicitud = $2 AND usuario_id = $3
             RETURNING *`,
            [codigo_plus || null, id, usuarioId]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Solicitud no encontrada' });
        }
        
        res.json({ mensaje: 'C�digo Plus actualizado', data: result.rows[0] });
    } catch (err) {
        console.error('Error actualizarCodigoPlus:', err);
        res.status(500).json({ error: err.message });
    }
};

// Obtener una solicitud por ID
exports.getSolicitud = async (req, res) => {
    const usuarioId = req.session.usuario?.id;
    if (!usuarioId) {
        return res.status(401).json({ error: 'No autenticado' });
    }
    
    const { id } = req.params;
    
    try {
        const result = await pool.query(
            'SELECT * FROM solicitudes WHERE id_solicitud = $1 AND usuario_id = $2',
            [id, usuarioId]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Solicitud no encontrada' });
        }
        
        res.json(result.rows[0]);
    } catch (err) {
        console.error('Error getSolicitud:', err);
        res.status(500).json({ error: err.message });
    }
};// ================== ELIMINAR SOLICITUD INDIVIDUAL ==================

// Eliminar una solicitud específica (con sus gestiones y referencias)
exports.eliminarSolicitud = async (req, res) => {
    const usuarioId = req.session.usuario?.id;
    if (!usuarioId) {
        return res.status(401).json({ error: 'No autenticado' });
    }
    
    const { id } = req.params;
    
    if (!id) {
        return res.status(400).json({ error: 'ID de solicitud requerido' });
    }
    
    try {
        // Eliminar gestiones asociadas primero (foreign key)
        await pool.query(
            'DELETE FROM gestiones WHERE solicitud_id = $1 AND usuario_id = $2',
            [id, usuarioId]
        );
        
        // Eliminar referencias
        await pool.query(
            'DELETE FROM solicitudes_referencias WHERE id_solicitud = $1',
            [id]
        );
        
        // Eliminar la solicitud
        const result = await pool.query(
            'DELETE FROM solicitudes WHERE id_solicitud = $1 AND usuario_id = $2 RETURNING id_solicitud',
            [id, usuarioId]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Solicitud no encontrada' });
        }
        
        // Invalidar caché del dashboard
        try { cache.invalidateDashboard(usuarioId); } catch(e) { /* silencioso */ }

        res.json({ mensaje: 'Solicitud eliminada correctamente', id_solicitud: id });
    } catch (err) {
        console.error('Error eliminarSolicitud:', err);
        res.status(500).json({ error: err.message });
    }
};

// ================== CREAR SOLICITUD MANUAL ==================

// Crear una solicitud manualmente (no por importación Excel)
exports.crearSolicitudManual = async (req, res) => {
    const usuarioId = req.session.usuario?.id;
    if (!usuarioId) {
        return res.status(401).json({ error: 'No autenticado' });
    }

    const {
        nombre,
        cedula,
        celular,
        estado,
        correo_electronico,
        segmento,
        producto,
        codigo_plus,
        direccion,
        direccion_trabajo,
        ocupacion,
        ingreso_mensual
    } = req.body;

    // Validar campos obligatorios
    if (!nombre || !nombre.trim()) {
        return res.status(400).json({ error: 'El campo nombre es obligatorio' });
    }
    if (!cedula || !cedula.trim()) {
        return res.status(400).json({ error: 'El campo cédula es obligatorio' });
    }
    if (!celular || !celular.trim()) {
        return res.status(400).json({ error: 'El campo celular es obligatorio' });
    }

    const isPostgres = !!process.env.DATABASE_URL;

    try {
        // 1. Auto-generar id_solicitud
        let nextId;
        if (isPostgres) {
            const result = await pool.query('SELECT COALESCE(MAX(id_solicitud), 0) + 1 AS next_id FROM solicitudes');
            nextId = parseInt(result.rows[0].next_id);
        } else {
            const dbDirect = require('../config/database');
            const row = dbDirect.prepare('SELECT COALESCE(MAX(id_solicitud), 0) + 1 AS next_id FROM solicitudes').get();
            nextId = row.next_id;
        }

        // 2. Verificar duplicados por cédula para el mismo usuario
        let duplicado = null;
        if (isPostgres) {
            const dupResult = await pool.query(
                'SELECT id_solicitud, nombre FROM solicitudes WHERE cedula = $1 AND usuario_id = $2 LIMIT 1',
                [cedula.trim(), usuarioId]
            );
            if (dupResult.rows.length > 0) duplicado = dupResult.rows[0];
        } else {
            const dbDirect = require('../config/database');
            duplicado = dbDirect.prepare(
                'SELECT id_solicitud, nombre FROM solicitudes WHERE cedula = ? AND usuario_id = ? LIMIT 1'
            ).get(cedula.trim(), usuarioId);
        }

        // 3. Insertar nueva solicitud
        const estadoFinal = (estado && estado.trim()) ? estado.trim() : 'SIN ESTADO';
        const fechaActual = new Date().toISOString().split('T')[0];

        if (isPostgres) {
            const result = await pool.query(
                `INSERT INTO solicitudes (
                    id_solicitud, estado, cedula, nombre, celular,
                    segmento, producto, codigo_plus, correo_electronico,
                    direccion, direccion_trabajo, ocupacion, ingreso_mensual,
                    fecha_solicitud, usuario_id
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
                RETURNING id_solicitud`,
                [
                    nextId, estadoFinal, cedula.trim(), nombre.trim(), celular.trim(),
                    segmento || null, producto || null, codigo_plus || null,
                    correo_electronico || null, direccion || null, direccion_trabajo || null,
                    ocupacion || null, ingreso_mensual || null, fechaActual, usuarioId
                ]
            );
            
        // Invalidar caché del dashboard
        try { cache.invalidateDashboard(usuarioId); } catch(e) { /* silencioso */ }

        res.status(201).json({
            id_solicitud: result.rows[0].id_solicitud,
            mensaje: 'Solicitud creada correctamente',
            duplicado_advertencia: duplicado ? {
                id_solicitud: duplicado.id_solicitud,
                nombre: duplicado.nombre
            } : null
        });
    } else {
        const dbDirect = require('../config/database');
        dbDirect.prepare(`
            INSERT INTO solicitudes (
                id_solicitud, estado, cedula, nombre, celular,
                segmento, producto, codigo_plus, correo_electronico,
                direccion, direccion_trabajo, ocupacion, ingreso_mensual,
                fecha_solicitud, usuario_id
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
            nextId, estadoFinal, cedula.trim(), nombre.trim(), celular.trim(),
            segmento || null, producto || null, codigo_plus || null,
            correo_electronico || null, direccion || null, direccion_trabajo || null,
            ocupacion || null, ingreso_mensual || null, fechaActual, usuarioId
        );

        // Invalidar caché del dashboard
        try { cache.invalidateDashboard(usuarioId); } catch(e) { /* silencioso */ }

        res.status(201).json({
            id_solicitud: nextId,
            mensaje: 'Solicitud creada correctamente',
            duplicado_advertencia: duplicado ? {
                id_solicitud: duplicado.id_solicitud,
                nombre: duplicado.nombre
            } : null
        });
    }

} catch (err) {
    console.error('Error crearSolicitudManual:', err);
    res.status(500).json({ error: err.message });
}
};

// ================== LIMPIAR SOLICITUDES ==================

// Limpiar todas las solicitudes del usuario actual
// Compatible con SQLite y PostgreSQL
exports.limpiarSolicitudes = async (req, res) => {
    const usuarioId = req.session.usuario?.id;
    if (!usuarioId) {
        return res.status(401).json({ error: 'No autenticado' });
    }

    try {
        // Contar solicitudes antes de eliminar
        const countResult = await pool.query(
            'SELECT COUNT(*) as total FROM solicitudes WHERE usuario_id = $1',
            [usuarioId]
        );

        const total = parseInt(countResult.rows[0]?.total) || 0;

        if (total === 0) {
            return res.json({
                mensaje: 'No hay solicitudes para eliminar',
                eliminadas: 0
            });
        }

        // Eliminar gestionas primero (foreign key constraint)
        // Metodo compatible con ambos motores
        await pool.query(
            'DELETE FROM gestiones WHERE solicitud_id IN (SELECT id_solicitud FROM solicitudes WHERE usuario_id = $1)',
            [usuarioId]
        );

        // Eliminar las solicitudes
        const result = await pool.query(
            'DELETE FROM solicitudes WHERE usuario_id = $1',
            [usuarioId]
        );

        console.log('DEBUG limpiarSolicitudes - eliminadas:', result.rowCount, 'por usuario:', usuarioId);

        // Invalidar caché del dashboard
        try { cache.invalidateDashboard(usuarioId); } catch(e) { /* silencioso */ }

        res.json({
            mensaje: 'Solicitudes eliminadas correctamente',
            eliminadas: result.rowCount
        });

    } catch (err) {
        console.error('Error limpiarSolicitudes:', err);
        res.status(500).json({
            error: err.message
        });
    }
};

// ================== BÚSQUEDA DIRECTA EN SERVIDOR ==================

// Buscar solicitudes directamente en el servidor
// Esta función evita el infinite scroll cuando el usuario busca
// ============================================================================
// BUSCAR SOLICITUDES - OPTIMIZADA
// ============================================================================
// Características:
// - LATERAL JOIN (más rápido que subquery)
// - Parámetros seguros (LIMIT/OFFSET con bind params)
// - COUNT con mismos filtros para paginación precisa
// - Búsqueda por cédula, nombre, celular o ID
// ============================================================================
exports.buscarSolicitudes = async (req, res) => {
    const usuarioId = req.session.usuario?.id;
    if (!usuarioId) {
        return res.status(401).json({ error: 'No autenticado' });
    }
    
    const {
        q = '',
        estado = '',
        segmento = '',
        limite = 50,
        offset = 0
    } = req.query;

    try {
        // Query principal con LATERAL JOIN optimizado
        let sql = `SELECT s.*,
                   g.tipo_gestion as ultima_gestion_tipo,
                   g.observacion as ultima_gestion_obs,
                   g.fecha_gestion as ultima_gestion_fecha
            FROM solicitudes s
            LEFT JOIN LATERAL (
                SELECT g2.tipo_gestion, g2.observacion, g2.fecha_gestion
                FROM gestiones g2
                WHERE g2.solicitud_id = s.id_solicitud 
                  AND g2.usuario_id = s.usuario_id
                ORDER BY g2.fecha_gestion DESC
                LIMIT 1
            ) g ON TRUE
            WHERE s.usuario_id = $1`;
        const params = [usuarioId];
        let paramIdx = 2;

        // Filtro de búsqueda unificada
        if (q && q.trim()) {
            const termino = '%' + q.trim() + '%';
            sql += ` AND (
                s.cedula LIKE $${paramIdx} 
                OR LOWER(s.nombre) LIKE LOWER($${paramIdx}) 
                OR s.celular LIKE $${paramIdx}
                OR CAST(s.id_solicitud AS TEXT) LIKE $${paramIdx}
            )`;
            params.push(termino);
            paramIdx++;
        }

        if (estado) {
            sql += ` AND s.estado = $${paramIdx++}`;
            params.push(estado);
        }

        if (segmento) {
            sql += ` AND s.segmento = $${paramIdx++}`;
            params.push(segmento);
        }

        // Paginación con parámetros seguros
        const limitVal = parseInt(limite) || 50;
        const offsetVal = parseInt(offset) || 0;
        sql += ' ORDER BY s.id DESC LIMIT $' + paramIdx++ + ' OFFSET $' + paramIdx++;
        params.push(limitVal, offsetVal);

        // Ejecutar ambas consultas en paralelo
        const [result, countResult] = await Promise.all([
            pool.query(sql, params),
            (() => {
                let countSql = 'SELECT COUNT(*) as total FROM solicitudes s WHERE s.usuario_id = $1';
                const countParams = [usuarioId];
                let cIdx = 2;
                
                if (q && q.trim()) {
                    const termino = '%' + q.trim() + '%';
                    countSql += ` AND (
                        s.cedula LIKE $${cIdx} 
                        OR LOWER(s.nombre) LIKE LOWER($${cIdx}) 
                        OR s.celular LIKE $${cIdx}
                        OR CAST(s.id_solicitud AS TEXT) LIKE $${cIdx}
                    )`;
                    countParams.push(termino);
                    cIdx++;
                }
                if (estado) { countSql += ` AND s.estado = $${cIdx++}`; countParams.push(estado); }
                if (segmento) { countSql += ` AND s.segmento = $${cIdx++}`; countParams.push(segmento); }
                
                return pool.query(countSql, countParams);
            })()
        ]);

        const total = parseInt(countResult.rows[0]?.total) || 0;

        res.json({
            data: result.rows,
            total: total,
            limite: limitVal,
            offset: offsetVal
        });
    } catch (err) {
        console.error('Error buscarSolicitudes:', err);
        res.status(500).json({ error: err.message });
    }
};

// ================== GESTIONES TOTALES (PÁGINA COMPLETA) ==================

// Obtener todas las gestionesglobalmente con filtros (fecha desde, fecha hasta, cédula, tipo, nombre, teléfono, observación)
// VERSIÓN COMPLETA para la página de gestiones
exports.getTodasGestiones = async (req, res) => {
    const usuarioId = req.session.usuario?.id;
    if (!usuarioId) {
        return res.status(401).json({ error: 'No autenticado' });
    }

const {
        q = '',              // Búsqueda unificada
        cedula = '',
        nombre = '',
        telefono = '',
        observacion = '',
        fecha_desde = '',
        fecha_hasta = '',
        tipo_gestion = '',
        gestion_maestro_id = '',
        limite = 50,
        offset = 0
    } = req.query;

    // Si hay búsqueda unificada (q), distribuirla a los filtros correspondientes
    // para mantener compatibilidad
    const busqueda = q.trim();

    try {
        // LEFT JOIN para obtener campos de solicitudes (cedula, nombre, celular)
        let sql = `
            SELECT g.id, g.solicitud_id, g.tipo_gestion, g.observacion, g.fecha_gestion,
                   COALESCE(s.cedula, '') as cedula, 
                   COALESCE(s.nombre, '') as nombre, 
                   COALESCE(s.celular, '') as celular, 
                   COALESCE(s.estado, '') as estado_solicitud
            FROM gestiones g
            LEFT JOIN solicitudes s ON g.solicitud_id = s.id_solicitud AND g.usuario_id = s.usuario_id
            WHERE g.usuario_id = $1
        `;

        const params = [usuarioId];
        let paramIndex = 2;

        // Si hay búsqueda unificada, aplicarla a todos los campos
        if (busqueda) {
            sql += ` AND (
                s.cedula LIKE $${paramIndex}
                OR LOWER(s.nombre) LIKE LOWER($${paramIndex})
                OR LOWER(s.celular) LIKE LOWER($${paramIndex})
                OR LOWER(g.observacion) LIKE LOWER($${paramIndex})
            )`;
            params.push('%' + busqueda + '%');
            paramIndex++;
        } else {
            // Búsqueda individual (para compatibilidad hacia atrás)
            if (cedula) {
                sql += ` AND s.cedula LIKE $${paramIndex}`;
                params.push('%' + cedula + '%');
                paramIndex++;
            }

            if (nombre) {
                sql += ` AND LOWER(s.nombre) LIKE LOWER($${paramIndex})`;
                params.push('%' + nombre + '%');
                paramIndex++;
            }

            if (telefono) {
                sql += ` AND LOWER(s.celular) LIKE LOWER($${paramIndex})`;
                params.push('%' + telefono + '%');
                paramIndex++;
            }

            if (observacion) {
                sql += ` AND LOWER(g.observacion) LIKE LOWER($${paramIndex})`;
                params.push('%' + observacion + '%');
                paramIndex++;
            }
        }

        if (fecha_desde) {
            sql += ` AND g.fecha_gestion >= $${paramIndex}`;
            params.push(fecha_desde);
            paramIndex++;
        }

        if (fecha_hasta) {
            sql += ` AND g.fecha_gestion <= $${paramIndex}`;
            params.push(fecha_hasta);
            paramIndex++;
        }

        if (tipo_gestion) {
            sql += ` AND g.tipo_gestion = $${paramIndex}`;
            params.push(tipo_gestion);
            paramIndex++;
        }

        if (gestion_maestro_id) {
            sql += ` AND g.gestion_maestro_id = $${paramIndex}`;
            params.push(gestion_maestro_id);
            paramIndex++;
        }

// Preparar query de conteo con el mismo JOIN y filtros
        let countSql = `
            SELECT COUNT(*) as total
            FROM gestiones g
            LEFT JOIN solicitudes s ON g.solicitud_id = s.id_solicitud AND g.usuario_id = s.usuario_id
            WHERE g.usuario_id = $1
        `;
        const countParams = [usuarioId];
        let countIndex = 2;

        // Aplicar los mismos filtros de búsqueda al conteo
        if (busqueda) {
            countSql += ` AND (
                s.cedula LIKE $${countIndex}
                OR LOWER(s.nombre) LIKE LOWER($${countIndex})
                OR LOWER(s.celular) LIKE LOWER($${countIndex})
                OR LOWER(g.observacion) LIKE LOWER($${countIndex})
            )`;
            countParams.push('%' + busqueda + '%');
            countIndex++;
        } else {
            // Búsqueda individual para compatibilidad
            if (cedula) { countSql += ` AND s.cedula LIKE $${countIndex}`; countParams.push('%' + cedula + '%'); countIndex++; }
            if (nombre) { countSql += ` AND LOWER(s.nombre) LIKE LOWER($${countIndex})`; countParams.push('%' + nombre + '%'); countIndex++; }
            if (telefono) { countSql += ` AND LOWER(s.celular) LIKE LOWER($${countIndex})`; countParams.push('%' + telefono + '%'); countIndex++; }
            if (observacion) { countSql += ` AND LOWER(g.observacion) LIKE LOWER($${countIndex})`; countParams.push('%' + observacion + '%'); countIndex++; }
        }
        if (fecha_desde) { countSql += ` AND g.fecha_gestion >= $${countIndex}`; countParams.push(fecha_desde); countIndex++; }
        if (fecha_hasta) { countSql += ` AND g.fecha_gestion <= $${countIndex}`; countParams.push(fecha_hasta); countIndex++; }
        if (tipo_gestion) { countSql += ` AND g.tipo_gestion = $${countIndex}`; countParams.push(tipo_gestion); countIndex++; }
        if (gestion_maestro_id) { countSql += ` AND g.gestion_maestro_id = $${countIndex}`; countParams.push(gestion_maestro_id); countIndex++; }

        // Ordenar y paginar
        sql += ` ORDER BY g.fecha_gestion DESC`;
        sql += ` LIMIT ${parseInt(limite)} OFFSET ${parseInt(offset)}`;

        // Ejecutar consultas
        const result = await pool.query(sql, params);
        const countResult = await pool.query(countSql, countParams);
        const total = parseInt(countResult.rows[0]?.total) || 0;

        res.json({
            data: result.rows,
            total: total,
            limite: parseInt(limite),
            offset: parseInt(offset)
        });

    } catch (err) {
        console.error('Error getTodasGestiones:', err);
        res.status(500).json({ error: err.message });
    }
};

// ================== HISTORIAL DE ACTUALIZACIONES ==================

// Obtener historial de actualizaciones
// INCLUYE: cedula, nombre, telefono desde la tabla solicitudes (JOIN)
exports.getHistorialActualizaciones = async (req, res) => {
    const usuarioId = req.session.usuario?.id;
    if (!usuarioId) {
        return res.status(401).json({ error: 'No autenticado' });
    }

    const { limite = 50, offset = 0, campo, fechaInicio, fechaFin } = req.query;

    try {
        // JOIN con solicitudes para obtener cedula, nombre, celular
        let sql = `
            SELECT h.id, h.solicitud_id, h.campo, h.valor_anterior, h.valor_nuevo, h.fecha_actualizacion,
                   COALESCE(s.cedula, '') as cedula, 
                   COALESCE(s.nombre, '') as nombre, 
                   COALESCE(s.celular, '') as telefono
            FROM historial_actualizaciones h
            LEFT JOIN solicitudes s ON h.solicitud_id = s.id_solicitud AND h.usuario_id = s.usuario_id
            WHERE h.usuario_id = $1
        `;
        const params = [usuarioId];

        // Filtros adicionales
        if (campo) {
            sql += ` AND h.campo = $${params.length + 1}`;
            params.push(campo);
        }

        if (fechaInicio) {
            sql += ` AND h.fecha_actualizacion >= $${params.length + 1}`;
            params.push(fechaInicio);
        }

        if (fechaFin) {
            sql += ` AND h.fecha_actualizacion <= $${params.length + 1}`;
            params.push(fechaFin);
        }

        // Orden y paginación
        sql += ` ORDER BY h.fecha_actualizacion DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
        params.push(parseInt(limite), parseInt(offset));

        const result = await pool.query(sql, params);

        // Contar total para paginación
        let countSql = `
            SELECT COUNT(*) as total
            FROM historial_actualizaciones h
            WHERE h.usuario_id = $1
        `;
        const countParams = [usuarioId];

        if (campo) {
            countSql += ` AND h.campo = $2`;
            countParams.push(campo);
        }
        if (fechaInicio) {
            countSql += ` AND h.fecha_actualizacion >= $${countParams.length + 1}`;
            countParams.push(fechaInicio);
        }
        if (fechaFin) {
            countSql += ` AND h.fecha_actualizacion <= $${countParams.length + 1}`;
            countParams.push(fechaFin);
        }

        const countResult = await pool.query(countSql, countParams);
        const total = parseInt(countResult.rows[0]?.total) || 0;

        res.json({
            data: result.rows,
            total: total,
            limite: parseInt(limite),
            offset: parseInt(offset)
        });

} catch (err) {
        console.error('Error getHistorialActualizaciones:', err);
        res.status(500).json({ error: err.message });
    }
};

// ================== IMÁGENES PARA GESTIÓN WHATSAPP ==================

// Subir imagen para gestión por WhatsApp
exports.subirImagenGestion = async (req, res) => {
    try {
        const usuarioId = req.session.usuario?.id;
        console.log('DEBUG subirImagenGestion: usuarioId=', usuarioId, 'req.session=', !!req.session);

        if (!usuarioId) {
            console.log('ERROR subirImagenGestion: No hay usuarioId en sesión');
            return res.status(401).json({ error: 'No autenticado' });
        }

        if (!req.file) {
            console.log('ERROR subirImagenGestion: No se envió ningún archivo');
            return res.status(400).json({ error: 'No se envió ninguna imagen' });
        }

        // Retornar URL de la imagen
        const imagenUrl = '/uploads/' + req.file.filename;
        const nombreOriginal = req.file.originalname;

        console.log('DEBUG: Imagen subida:', imagenUrl, 'por usuario:', usuarioId);

        res.json({
            success: true,
            url: imagenUrl,
            nombre: nombreOriginal,
            filename: req.file.filename
        });
    } catch (error) {
        console.error('ERROR subirImagenGestion:', error);
        res.status(500).json({ error: 'Error al subir imagen: ' + error.message });
    }
};

// Eliminar imagen temporal
exports.eliminarImagenGestion = async (req, res) => {
    const usuarioId = req.session.usuario?.id;
    if (!usuarioId) {
        return res.status(401).json({ error: 'No autenticado' });
    }

    const { nombre } = req.params;

    if (!nombre) {
        return res.status(400).json({ error: 'Nombre de archivo requerido' });
    }

    try {
        const filePath = path.join(__dirname, '../../uploads/', nombre);
        
        // Verificar que el archivo existe
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            console.log('DEBUG: Imagen eliminada:', nombre);
            res.json({ success: true, mensaje: 'Imagen eliminada' });
        } else {
            res.status(404).json({ error: 'Archivo no encontrado' });
        }
    } catch (err) {
        console.error('Error eliminando imagen:', err);
        res.status(500).json({ error: err.message });
    }
};
