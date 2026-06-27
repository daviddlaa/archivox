@echo off
cd /d c:\Users\david\Desktop\Archivox
git add -A
git add src/config/db.js
git add src/config/initDb.pg.js
git add src/controllers/gestionesMaestro.controller.js
git commit -m "Fix: arreglo de gestines a gestiones y barra de busqueda de gestiones movil y escritorio"
git push origin master
pause
