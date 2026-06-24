@echo off
cd /d c:\Users\david\Desktop\Archivox
git add -A
git commit -m "Fix: logout race condition prevents auto re-login - sessionStorage guard added"
git push origin master
pause
