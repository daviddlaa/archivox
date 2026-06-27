@echo off
cd /d c:\Users\david\Desktop\Archivox
git add -A
git commit -m "Production: PostgreSQL ready for Render deployment"
git push origin master
pause
