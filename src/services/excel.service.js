const ExcelJS = require('exceljs');
const fs = require('fs');
const db = require('../config/db.js');

const pool = db;

exports.procesarExcel = async (filePath, usuarioId) => {

    const workbook = new ExcelJS.Workbook();

    await workbook.xlsx.readFile(filePath);

    const worksheet = workbook.getWorksheet(1);

    const headers = [];

    worksheet.getRow(1).eachCell((cell) => {
        headers.push(String(cell.value).trim());
    });

    let procesados = 0;

    // Usar db directo para mejor rendimiento
    const dbDirect = require('../config/database');

    for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber++) {

        const row = worksheet.getRow(rowNumber);

        const registro = {};

        row.eachCell((cell, colNumber) => {
            registro[headers[colNumber - 1]] = cell.value;
        });

        // Upsert para SQLite
        const existing = dbDirect.prepare(
            'SELECT id FROM solicitudes WHERE id_solicitud = ?'
        ).get(registro.IDSOLICITUD);

        if (existing) {
            // Update
            dbDirect.prepare(`
                UPDATE solicitudes SET
                    estado = ?,
                    cedula = ?,
                    nombre = ?,
                    celular = ?,
                    segmento = ?,
                    producto = ?,
                    fecha_solicitud = ?,
                    usuario_id = ?,
                    fecha_actualizacion = datetime('now')
                WHERE id_solicitud = ?
            `).run(
                registro.ESTADO,
                registro.CEDULA,
                registro.NOMBRE,
                registro.CELULAR,
                registro.SEGMENTO,
                registro.PRODUCTO,
                registro.FECHASOLICITUD,
                usuarioId,
                registro.IDSOLICITUD
            );
} else {
            // Insert
            dbDirect.prepare(`
                INSERT INTO solicitudes (
                    id_solicitud, estado, cedula, nombre, celular,
                    segmento, producto, fecha_solicitud, usuario_id
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(
                registro.IDSOLICITUD,
                registro.ESTADO,
                registro.CEDULA,
                registro.NOMBRE,
                registro.CELULAR,
                registro.SEGMENTO,
                registro.PRODUCTO,
                registro.FECHASOLICITUD,
                usuarioId
            );
        }

        procesados++;
    }

    if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
    }

    return {
        total: procesados
    };
};
