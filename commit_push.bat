@echo off
cd /d c:\Users\david\Desktop\Archivox
git add -A
git commit -m "Fix: logout preserves user data on page refresh - sessionStorage retained"
git push origin master
pause
