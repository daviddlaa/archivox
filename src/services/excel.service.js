const ExcelJS = require('exceljs');
const fs = require('fs');
const pool = require('../config/database.pg.js');

exports.procesarExcel = async (filePath) => {

    const workbook = new ExcelJS.Workbook();

    await workbook.xlsx.readFile(filePath);

    const worksheet = workbook.getWorksheet(1);

    const headers = [];

    worksheet.getRow(1).eachCell((cell) => {
        headers.push(String(cell.value).trim());
    });

    let procesados = 0;
    const client = await pool.connect();

    try {
        // Iniciar transacción
        await client.query('BEGIN');

        const sql = `
            INSERT INTO solicitudes
            (
                id_solicitud,
                estado,
                cedula,
                nombre,
                celular,
                segmento,
                producto,
                fecha_solicitud
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)

            ON CONFLICT(id_solicitud)
            DO UPDATE SET
                estado = EXCLUDED.estado,
                cedula = EXCLUDED.cedula,
                nombre = EXCLUDED.nombre,
                celular = EXCLUDED.celular,
                segmento = EXCLUDED.segmento,
                producto = EXCLUDED.producto,
                fecha_solicitud = EXCLUDED.fecha_solicitud,
                fecha_actualizacion = CURRENT_TIMESTAMP
        `;

        for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber++) {

            const row = worksheet.getRow(rowNumber);

            const registro = {};

            row.eachCell((cell, colNumber) => {
                registro[headers[colNumber - 1]] = cell.value;
            });

            await client.query(sql, [
                registro.IDSOLICITUD,
                registro.ESTADO,
                registro.CEDULA,
                registro.NOMBRE,
                registro.CELULAR,
                registro.SEGMENTO,
                registro.PRODUCTO,
                registro.FECHASOLICITUD
            ]);

            procesados++;
        }

        await client.query('COMMIT');

    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }

    if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
    }

    return {
        total: procesados
    };
};
