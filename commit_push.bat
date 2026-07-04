@echo off
cd /d c:\Users\david\Desktop\Archivox
git add -A
git add src/config/db.js
git add src/config/initDb.pg.js
git add src/controllers/gestionesMaestro.controller.js
git commit -m "Copiar nombre + cédula y WhatsApp sin texto en tarjetas de Solicitudes"
git push origin master
pause
