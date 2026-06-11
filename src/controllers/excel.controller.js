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

// Promedio de solicitudes por mes (últimos 6 meses)
exports.dashboardPromedioMes = async (req, res) => {
    const usuarioId = req.session.usuario?.id;
    if (!usuarioId) {
        return res.status(401).json({
            error: 'No autenticado'
        });
    }
    
    try {
        // Primero obtener el total general
        const resultTotal = await pool.query(
            'SELECT COUNT(*) as total_general FROM solicitudes WHERE usuario_id = $1',
            [usuarioId]
        );
        const totalGeneral = parseInt(resultTotal.rows[0]?.total_general) || 0;
        
        // Obtener promedio mensual
        const resultPromedio = await pool.query(`
            SELECT 
                TO_CHAR(fecha_solicitud, 'YYYY-MM') as mes,
                COUNT(*) as total
            FROM solicitudes
            WHERE usuario_id = $1 
                AND fecha_solicitud IS NOT NULL
                AND fecha_solicitud >= DATE_TRUNC('month', NOW()) - INTERVAL '6 months'
            GROUP BY TO_CHAR(fecha_solicitud, 'YYYY-MM')
            ORDER BY mes ASC
        `, [usuarioId]);
        
        // Calcular promedio de los meses con datos
        const rows = resultPromedio.rows || [];
        const totalMeses = rows.length;
        
        let promedio = 0;
        if (totalMeses > 0) {
            const sum = rows.reduce((acc, row) => acc + parseInt(row.total || 0), 0);
            promedio = Math.round(sum / totalMeses);
        } else {
            promedio = totalGeneral;
        }
        
        res.json({
            promedio: promedio,
            datos: rows
        });
    } catch (err) {
        console.error('Error dashboardPromedioMes:', err);
        return res.status(500).json({
            error: err.message
        });
    }
};

// Promedio de solicitudes por semana (últimas 4 semanas)
exports.dashboardPromedioSemana = async (req, res) => {
    const usuarioId = req.session.usuario?.id;
    if (!usuarioId) {
        return res.status(401).json({
            error: 'No autenticado'
        });
    }
    
    try {
        // Obtener total general
        const resultTotal = await pool.query(
            'SELECT COUNT(*) as total_general FROM solicitudes WHERE usuario_id = $1',
            [usuarioId]
        );
        const totalGeneral = parseInt(resultTotal.rows[0]?.total_general) || 0;
        
        // Obtener promedio semanal
        const resultPromedio = await pool.query(`
            SELECT 
                DATE_TRUNC('week', fecha_solicitud)::date as semana,
                COUNT(*) as total
            FROM solicitudes
            WHERE usuario_id = $1 
                AND fecha_solicitud IS NOT NULL
                AND fecha_solicitud >= NOW() - INTERVAL '4 weeks'
            GROUP BY DATE_TRUNC('week', fecha_solicitud)
            ORDER BY semana ASC
        `, [usuarioId]);
        
        // Calcular promedio
        const rows = resultPromedio.rows || [];
        const totalSemanas = rows.length;
        
        let promedio = 0;
        if (totalSemanas > 0) {
            const sum = rows.reduce((acc, row) => acc + parseInt(row.total || 0), 0);
            promedio = Math.round(sum / totalSemanas);
        } else {
            promedio = totalGeneral;
        }
        
        res.json({
            promedio: promedio,
            datos: rows
        });
    } catch (err) {
        console.error('Error dashboardPromedioSemana:', err);
        return res.status(500).json({
            error: err.message
        });
    }
};
