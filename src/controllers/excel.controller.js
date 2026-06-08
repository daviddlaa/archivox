const excelService = require('../services/excel.service');
const db = require('../config/database');

exports.uploadExcel = async (req, res) => {

    try {

        if (!req.files || req.files.length === 0) {

            return res.status(400).json({
                error: 'No se enviaron archivos'
            });

        }

        let totalRegistros = 0;

        for (const archivo of req.files) {

            const resultado =
                await excelService.procesarExcel(
                    archivo.path
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

exports.listarSolicitudes = (req, res) => {

    const {
        estado,
        segmento,
        cedula,
        producto,
        nombre,
        orden,
        direccion
    } = req.query;

    let sql = 'SELECT * FROM solicitudes WHERE 1=1';
    const params = [];

    if (estado) {
        sql += ' AND estado = ?';
        params.push(estado);
    }

    if (segmento) {
        sql += ' AND segmento = ?';
        params.push(segmento);
    }

    if (cedula) {
        sql += ' AND cedula = ?';
        params.push(cedula);
    }

    if (producto) {
        sql += ' AND producto = ?';
        params.push(producto);
    }

    if (nombre) {
        sql += ' AND nombre LIKE ?';
        params.push('%' + nombre + '%');
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
        const stmt = db.prepare(sql);
        const rows = params.length > 0 ? stmt.all(...params) : stmt.all();

        res.json(rows);
    } catch (err) {
        return res.status(500).json({
            error: err.message
        });
    }

};
exports.dashboard = (req, res) => {

    const sql = `
        SELECT

            COUNT(*) as total,

            SUM(
                CASE
                    WHEN estado = 'ACTIVADA'
                    THEN 1
                    ELSE 0
                END
            ) as activadas,

            SUM(
                CASE
                    WHEN estado = 'RECHAZADA'
                    THEN 1
                    ELSE 0
                END
            ) as rechazadas,

            SUM(
                CASE
                    WHEN estado = 'DEVUELTA'
                    THEN 1
                    ELSE 0
                END
            ) as devueltas,

            SUM(
                CASE
                    WHEN estado = 'APROBADA PARA LIBERACIÓN'
                    THEN 1
                    ELSE 0
                END
            ) as pendientes

        FROM solicitudes
    `;

    try {
        const stmt = db.prepare(sql);
        const row = stmt.get();

        res.json(row);
    } catch (err) {
        return res.status(500).json({
            error: err.message
        });
    }

};
exports.dashboardSegmentos = (req, res) => {

    const sql = `
        SELECT
            segmento,
            COUNT(*) as total
        FROM solicitudes
        GROUP BY segmento
        ORDER BY total DESC
    `;

    try {
        const stmt = db.prepare(sql);
        const rows = stmt.all();

        res.json(rows);
    } catch (err) {
        return res.status(500).json({
            error: err.message
        });
    }

};
exports.dashboardEstados = (req, res) => {

    const sql = `
        SELECT
            estado,
            COUNT(*) as total
        FROM solicitudes
        GROUP BY estado
        ORDER BY total DESC
    `;

    try {
        const stmt = db.prepare(sql);
        const rows = stmt.all();

        res.json(rows);
    } catch (err) {
        return res.status(500).json({
            error: err.message
        });
    }

};

// Segmentos filtrados por estado
exports.dashboardSegmentosFiltrado = (req, res) => {
    const { estado } = req.query;
    
    let sql = `
        SELECT
            segmento,
            COUNT(*) as total
        FROM solicitudes
    `;
    
    if (estado) {
        sql += ' WHERE estado = ?';
    }
    
    sql += ' GROUP BY segmento ORDER BY total DESC';

    try {
        const stmt = db.prepare(sql);
        const rows = estado ? stmt.all(estado) : stmt.all();

        res.json(rows);
    } catch (err) {
        return res.status(500).json({
            error: err.message
        });
    }

};

// Estados filtrados por segmento
exports.dashboardEstadosFiltrado = (req, res) => {
    const { segmento } = req.query;
    
    let sql = `
        SELECT
            estado,
            COUNT(*) as total
        FROM solicitudes
    `;
    
    if (segmento) {
        sql += ' WHERE segmento = ?';
    }
    
    sql += ' GROUP BY estado ORDER BY total DESC';

    try {
        const stmt = db.prepare(sql);
        const rows = segmento ? stmt.all(segmento) : stmt.all();

        res.json(rows);
    } catch (err) {
        return res.status(500).json({
            error: err.message
        });
    }

};
