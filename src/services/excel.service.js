const ExcelJS = require('exceljs');
const fs = require('fs');
const db = require('../config/database');

exports.procesarExcel = async (filePath) => {

    const workbook = new ExcelJS.Workbook();

    await workbook.xlsx.readFile(filePath);

    const worksheet = workbook.getWorksheet(1);

    const headers = [];

    worksheet.getRow(1).eachCell((cell) => {
        headers.push(String(cell.value).trim());
    });

    let procesados = 0;

    // Usar prepared statement para mejor-sqlite3
    const stmt = db.prepare(`
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
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)

        ON CONFLICT(id_solicitud)
        DO UPDATE SET
            estado = excluded.estado,
            cedula = excluded.cedula,
            nombre = excluded.nombre,
            celular = excluded.celular,
            segmento = excluded.segmento,
            producto = excluded.producto,
            fecha_solicitud = excluded.fecha_solicitud,
            fecha_actualizacion = CURRENT_TIMESTAMP
    `);

    const insertMany = db.transaction((rows) => {
        for (const row of rows) {
            stmt.run(
                row.IDSOLICITUD,
                row.ESTADO,
                row.CEDULA,
                row.NOMBRE,
                row.CELULAR,
                row.SEGMENTO,
                row.PRODUCTO,
                row.FECHASOLICITUD
            );
            procesados++;
        }
    });

    const rows = [];

    for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber++) {

        const row = worksheet.getRow(rowNumber);

        const registro = {};

        row.eachCell((cell, colNumber) => {
            registro[headers[colNumber - 1]] = cell.value;
        });

        rows.push(registro);
    }

    insertMany(rows);

    if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
    }

    return {
        total: procesados
    };
};
