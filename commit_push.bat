@echo off
cd /d c:\Users\david\Desktop\Archivox
git add -A
git add src/config/db.js
git add src/config/initDb.pg.js
git add src/controllers/gestionesMaestro.controller.js
git commit -m "reorganizacion de botones de acción en la gestión de lote, agregando botones de copia de cédula y teléfono"
git push origin master
pause
