@echo off
cd /d c:\Users\david\Desktop\Archivox
git add -A
git commit -m "Fix: transaction aborted error - delete child records first without transaction"
git push origin master
