@echo off
cd /d c:\Users\david\Desktop\Archivox
git add -A
:: Excluir la carpeta de documentación del commit
 git reset documentacion/
git add src/config/db.js
git add src/config/initDb.pg.js
git add src/controllers/gestionesMaestro.controller.js
git commit -m "botones para gestionar las campañas en gestion por lotes "
git push origin master
pause
