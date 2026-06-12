const excelService = require('../services/excel.service');
const pool = require('../config/database.pg.js');

exports.uploadExcel = async (req, res) => {

    try {

        if (!req.files || req.files.length === 0) {

            return res.status(400).json({
                error: 'No se enviaron archivos'
            });

        }

        // Obtener ID del usuario de la sesión
        const usuarioId = req.session.usuario?.id;
        if (!usuarioId) {
            return res.status(401).json({
                error: 'No autenticado'
            });
        }

        let totalRegistros = 0;

        for (const archivo of req.files) {

            const resultado =
                await excelService.procesarExcel(
                    archivo.path,
                    usuarioId
                );

            totalRegistros += resultado.total;

        }

        res.json({
            mensaje: 'Importación exitosa',
            archivos: req.files.length,
            registros: totalRegistros
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
        direccion
    } = req.query;

    // Obtener ID del usuario de la sesión
    const usuarioId = req.session.usuario?.id;
    if (!usuarioId) {
        return res.status(401).json({
            error: 'No autenticado'
        });
    }

    let sql = 'SELECT * FROM solicitudes WHERE usuario_id = $1';
    const params = [usuarioId];

    if (estado) {
        sql += ' AND estado = $' + (params.length + 1);
        params.push(estado);
    }

    if (segmento) {
        sql += ' AND segmento = $' + (params.length + 1);
        params.push(segmento);
    }

    if (cedula) {
        sql += ' AND cedula = $' + (params.length + 1);
        params.push(cedula);
    }

    if (producto) {
        sql += ' AND producto = $' + (params.length + 1);
        params.push(producto);
    }

if (nombre) {
        sql += ' AND nombre ILIKE $' + (params.length + 1);
        params.push('%' + nombre + '%');
    }

    if (telefono) {
        sql += ' AND celular ILIKE $' + (params.length + 1);
        params.push('%' + telefono + '%');
    }

    // Ordenamiento
    let columnaOrden = 'id';
    if (orden === 'id_solicitud') columnaOrden = 'id';
    else if (orden === 'estado') columnaOrden = 'estado';
    else if (orden === 'cedula') columnaOrden = 'cedula';
    else if (orden === 'nombre') columnaOrden = 'nombre';
    else if (orden === 'segmento') columnaOrden = 'segmento';
    else if (orden === 'producto') columnaOrden = 'producto';
    else if (orden === 'fecha_solicitud') columnaOrden = 'fecha_solicitud';
    
    let direccionOrden = direccion === 'ASC' ? 'ASC' : 'DESC';
    sql = sql + ' ORDER BY ' + columnaOrden + ' ' + direccionOrden;

    try {
        const result = await pool.query(sql, params);
        res.json(result.rows);
    } catch (err) {
        return res.status(500).json({
            error: err.message
        });
    }

};

exports.dashboard = async (req, res) => {

    // Obtener ID del usuario de la sesión
    const usuarioId = req.session.usuario?.id;
    if (!usuarioId) {
        return res.status(401).json({
            error: 'No autenticado'
        });
    }

    const sql = `
        SELECT
            COUNT(*) as total,
            SUM(CASE WHEN estado = 'ACTIVADA' THEN 1 ELSE 0 END) as activadas,
            SUM(CASE WHEN estado = 'RECHAZADA' THEN 1 ELSE 0 END) as rechazadas,
            SUM(CASE WHEN estado = 'DEVUELTA' THEN 1 ELSE 0 END) as devueltas,
            SUM(CASE WHEN estado = 'APROBADA PARA LIBERACIÓN' THEN 1 ELSE 0 END) as pendientes
        FROM solicitudes
        WHERE usuario_id = $1
    `;

    try {
        const result = await pool.query(sql, [usuarioId]);
        res.json(result.rows[0]);
    } catch (err) {
        return res.status(500).json({
            error: err.message
        });
    }

};

exports.dashboardSegmentos = async (req, res) => {

    // Obtener ID del usuario de la sesión
    const usuarioId = req.session.usuario?.id;
    if (!usuarioId) {
        return res.status(401).json({
            error: 'No autenticado'
        });
    }

    const sql = `
        SELECT
            segmento,
            COUNT(*) as total
        FROM solicitudes
        WHERE usuario_id = $1
        GROUP BY segmento
        ORDER BY total DESC
    `;

    try {
        const result = await pool.query(sql, [usuarioId]);
        res.json(result.rows);
    } catch (err) {
        return res.status(500).json({
            error: err.message
        });
    }

};

exports.dashboardEstados = async (req, res) => {

    // Obtener ID del usuario de la sesión
    const usuarioId = req.session.usuario?.id;
    if (!usuarioId) {
        return res.status(401).json({
            error: 'No autenticado'
        });
    }

    const sql = `
        SELECT
            estado,
            COUNT(*) as total
        FROM solicitudes
        WHERE usuario_id = $1
        GROUP BY estado
        ORDER BY total DESC
    `;

    try {
        const result = await pool.query(sql, [usuarioId]);
        res.json(result.rows);
    } catch (err) {
        return res.status(500).json({
            error: err.message
        });
    }

};

// Segmentos filtrados por estado
exports.dashboardSegmentosFiltrado = async (req, res) => {
    const { estado } = req.query;
    
    // Obtener ID del usuario de la sesión
    const usuarioId = req.session.usuario?.id;
    if (!usuarioId) {
        return res.status(401).json({
            error: 'No autenticado'
        });
    }
    
    let sql = `
        SELECT
            segmento,
            COUNT(*) as total
        FROM solicitudes
        WHERE usuario_id = $1
    `;
    const params = [usuarioId];
    
    if (estado) {
        sql += ' AND estado = $' + (params.length + 1);
        params.push(estado);
    }
    
    sql += ' GROUP BY segmento ORDER BY total DESC';

    try {
        const result = await pool.query(sql, params);
        res.json(result.rows);
    } catch (err) {
        return res.status(500).json({
            error: err.message
        });
    }

};

// Estados filtrados por segmento
exports.dashboardEstadosFiltrado = async (req, res) => {
    const { segmento } = req.query;
    
    // Obtener ID del usuario de la sesión
    const usuarioId = req.session.usuario?.id;
    if (!usuarioId) {
        return res.status(401).json({
            error: 'No autenticado'
        });
    }
    
    let sql = `
        SELECT
            estado,
            COUNT(*) as total
        FROM solicitudes
        WHERE usuario_id = $1
    `;
    const params = [usuarioId];
    
    if (segmento) {
        sql += ' AND segmento = $' + (params.length + 1);
        params.push(segmento);
    }
    
    sql += ' GROUP BY estado ORDER BY total DESC';

    try {
        const result = await pool.query(sql, params);
        res.json(result.rows);
    } catch (err) {
        return res.status(500).json({
            error: err.message
        });
    }

};

// Promedio de solicitudes por mes (últimos 3 meses)
// Cálculo: contar solicitudes últimos 90 días y dividir por 3
exports.dashboardPromedioMes = async (req, res) => {
    const usuarioId = req.session.usuario?.id;
    if (!usuarioId) {
        return res.status(401).json({
            error: 'No autenticado'
        });
    }
    
    try {
        // DEBUG: ver total sin fecha
        const totalSinFecha = await pool.query(
            'SELECT COUNT(*) as total FROM solicitudes WHERE usuario_id = $1',
            [usuarioId]
        );
        console.log('DEBUG promedioMes - usuarioId:', usuarioId, 'total sin fecha:', totalSinFecha.rows[0]);
        
        // Contar solicitudes últimos 90 días
        const result = await pool.query(
            `SELECT COUNT(*) as total 
             FROM solicitudes 
             WHERE usuario_id = $1 
               AND fecha_solicitud >= CURRENT_DATE - INTERVAL '90 days'`,
            [usuarioId]
        );
        
        const total = parseInt(result.rows[0]?.total) || 0;
        console.log('DEBUG promedioMes - total con fecha:', total);
        
        // Dividir por 3 meses
        const promedio = Math.round(total / 3);
        
        res.json({
            promedio: promedio,
            datos: []
        });
    } catch (err) {
        console.error('Error dashboardPromedioMes:', err);
        res.json({ promedio: 0, datos: [] });
    }
};

// Promedio de solicitudes por semana (últimas 9 semanas)
// Cálculo: contar solicitudes últimos 63 días y dividir por 9
exports.dashboardPromedioSemana = async (req, res) => {
    const usuarioId = req.session.usuario?.id;
    if (!usuarioId) {
        return res.status(401).json({
            error: 'No autenticado'
        });
    }
    
    try {
        // DEBUG: ver total sin fecha
        const totalSinFecha = await pool.query(
            'SELECT COUNT(*) as total FROM solicitudes WHERE usuario_id = $1',
            [usuarioId]
        );
        console.log('DEBUG promedioSemana - usuarioId:', usuarioId, 'total sin fecha:', totalSinFecha.rows[0]);
        
        // Contar solicitudes últimos 63 días
        const result = await pool.query(
            `SELECT COUNT(*) as total 
             FROM solicitudes 
             WHERE usuario_id = $1 
               AND fecha_solicitud >= CURRENT_DATE - INTERVAL '63 days'`,
            [usuarioId]
        );
        
        const total = parseInt(result.rows[0]?.total) || 0;
        console.log('DEBUG promedioSemana - total con fecha:', total);
        
        // Dividir por 9 semanas
        const promedio = Math.round(total / 9);
        
        res.json({
            promedio: promedio,
            datos: []
        });
    } catch (err) {
        console.error('Error dashboardPromedioSemana:', err);
        res.json({ promedio: 0, datos: [] });
    }
};

// Ventas mensuales - últimas 12 meses de solicitudes ACTIVADAS
exports.dashboardVentasMensuales = async (req, res) => {
    const usuarioId = req.session.usuario?.id;
    if (!usuarioId) {
        return res.status(401).json({
            error: 'No autenticado'
        });
    }
    
    try {
        // Obtener ventas de los últimos 12 meses (solo estado ACTIVADA)
        const result = await pool.query(
            `SELECT 
                TO_CHAR(fecha_solicitud, 'YYYY-MM') as mes,
                TO_CHAR(fecha_solicitud, 'Mon YYYY') as mes_formato,
                COUNT(*) as total
             FROM solicitudes
             WHERE usuario_id = $1 
               AND estado = 'ACTIVADA'
               AND fecha_solicitud >= CURRENT_DATE - INTERVAL '12 months'
             GROUP BY TO_CHAR(fecha_solicitud, 'YYYY-MM')
             ORDER BY mes ASC`,
            [usuarioId]
        );
        
        res.json(result.rows);
    } catch (err) {
        console.error('Error dashboardVentasMensuales:', err);
        res.json([]);
    }
};

// ================== CONTROL DE VENTAS DEL EQUIPO ==================

// Obtener ventas del equipo por mes
exports.getVentasEquipo = async (req, res) => {
    const usuarioId = req.session.usuario?.id;
    if (!usuarioId) {
        return res.status(401).json({ error: 'No autenticado' });
    }
    
    const { mes } = req.query;
    
    try {
        let sql = `SELECT * FROM ventas_vendedores WHERE usuario_id = $1`;
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

// Obtener configuración de bonos
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

// Guardar configuración de bonos
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
        
        res.json({ mensaje: 'Configuración guardada', data: result.rows[0] });
    } catch (err) {
        console.error('Error saveConfigBonos:', err);
        res.status(500).json({ error: err.message });
    }
};

// ================== GESTIONES ==================

// Crear una nueva gestión
exports.crearGestion = async (req, res) => {
    const usuarioId = req.session.usuario?.id;
    if (!usuarioId) {
        return res.status(401).json({ error: 'No autenticado' });
    }
    
    const { solicitud_id, tipo_gestion, observacion } = req.body;
    
    if (!solicitud_id || !tipo_gestion) {
        return res.status(400).json({ error: 'solicitud_id y tipo_gestion son requeridos' });
    }
    
    try {
        const result = await pool.query(
            `INSERT INTO gestiones (solicitud_id, usuario_id, tipo_gestion, observacion)
             VALUES ($1, $2, $3, $4)
             RETURNING *`,
            [solicitud_id, usuarioId, tipo_gestion, observacion || '']
        );
        
        res.json({ mensaje: 'Gestión guardada', data: result.rows[0] });
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
    
    try {
        const result = await pool.query(
            `SELECT * FROM gestion_es 
             WHERE solicitud_id = $1 AND usuario_id = $2
             ORDER BY fecha_gestion DESC`,
            [solicitud_id, usuarioId]
        );
        
        res.json(result.rows);
    } catch (err) {
        console.error('Error getGestiones:', err);
        res.status(500).json({ error: err.message });
    }
};

// Actualizar una gestión existente
exports.actualizarGestion = async (req, res) => {
    const usuarioId = req.session.usuario?.id;
    if (!usuarioId) {
        return res.status(401).json({ error: 'No autenticado' });
    }
    
    const { id } = req.params;
    const { tipo_gestion, observacion } = req.body;
    
    if (!id) {
        return res.status(400).json({ error: 'ID de gestión requerido' });
    }
    
    if (!tipo_gestion) {
        return res.status(400).json({ error: 'Tipo de gestión requerido' });
    }
    
    try {
        const result = await pool.query(
            `UPDATE gestion_es 
             SET tipo_gestion = $1, observacion = $2, updated_at = CURRENT_TIMESTAMP
             WHERE id = $3 AND usuario_id = $4
             RETURNING *`,
            [tipo_gestion, observacion || '', id, usuarioId]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Gestión no encontrada' });
        }
        
        res.json({ mensaje: 'Gestión actualizada', data: result.rows[0] });
    } catch (err) {
        console.error('Error actualizarGestion:', err);
        res.status(500).json({ error: err.message });
    }
};

// Eliminar una gestión
exports.eliminarGestion = async (req, res) => {
    const usuarioId = req.session.usuario?.id;
    if (!usuarioId) {
        return res.status(401).json({ error: 'No autenticado' });
    }
    
    const { id } = req.params;
    
    if (!id) {
        return res.status(400).json({ error: 'ID de gestión requerido' });
    }
    
    try {
        const result = await pool.query(
            `DELETE FROM gestion_es WHERE id = $1 AND usuario_id = $2 RETURNING id`,
            [id, usuarioId]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Gestión no encontrada' });
        }
        
        res.json({ mensaje: 'Gestión eliminada' });
    } catch (err) {
        console.error('Error eliminarGestion:', err);
        res.status(500).json({ error: err.message });
    }
};

// ================== CÓDIGO PLUS ==================

// Actualizar código plus de una solicitud
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
        
        res.json({ mensaje: 'Código Plus actualizado', data: result.rows[0] });
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
};
