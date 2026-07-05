@echo off
cd /d c:\Users\david\Desktop\Archivox
git add -A
:: Excluir la carpeta de documentación del commit
 git reset documentacion/
git add src/config/db.js
git add src/config/initDb.pg.js
git add src/controllers/gestionesMaestro.controller.js
git commit -m "fix de selecion de tarjetas solicitudes movil"
git push origin master
pause
