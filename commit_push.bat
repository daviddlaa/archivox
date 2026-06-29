@echo off
cd /d c:\Users\david\Desktop\Archivox
git add -A
git add src/config/db.js
git add src/config/initDb.pg.js
git add src/controllers/gestionesMaestro.controller.js
git commit -m "se egraga boton de historial de gestiones y se cambia el nombre de gestion por lote a campañas"
git push origin master
pause
