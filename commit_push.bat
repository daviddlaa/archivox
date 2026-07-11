@echo off
cd /d c:\Users\david\Desktop\Archivox

:: Verificar que .env no se va a subir (ya está en .gitignore)
echo ========================================
echo  Subiendo cambios a GitHub...
echo  (el archivo .env esta protegido)
echo ========================================
echo.

:: Pedir mensaje de commit
set /p commit_msg="Mensaje del commit: nuevo sistema de roles  "

:: Si no escribió nada, usar mensaje por defecto
if "%commit_msg%"=="" set commit_msg=Actualizacion general

git add -A
git commit -m "%commit_msg%"
git push origin master

echo.
echo ========================================
echo  Hecho! Cambios subidos a GitHub.
echo ========================================
pause
