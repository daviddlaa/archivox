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

    for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber++) {

        const row = worksheet.getRow(rowNumber);

        const registro = {};

        row.eachCell((cell, colNumber) => {
            registro[headers[colNumber - 1]] = cell.value;
        });

        await new Promise((resolve, reject) => {

            db.run(
                `
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
                `,
                [
                    registro.IDSOLICITUD,
                    registro.ESTADO,
                    registro.CEDULA,
                    registro.NOMBRE,
                    registro.CELULAR,
                    registro.SEGMENTO,
                    registro.PRODUCTO,
                    registro.FECHASOLICITUD
                ],
                function (err) {

                    if (err) {
                        reject(err);
                    } else {
                        procesados++;
                        resolve();
                    }

                }
            );

        });

    }

    if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
    }

    return {
        total: procesados
    };
};