@echo off
setlocal
cd /d "%~dp0"
set LOG=%~dp0deploy_log.txt

echo ==== deploy ==== > "%LOG%"
echo %DATE% %TIME% >> "%LOG%"

git rm --cached setup_log.txt >> "%LOG%" 2>&1
git rm --cached deploy_log.txt >> "%LOG%" 2>&1
git add -A >> "%LOG%" 2>&1
git commit -m "update site" >> "%LOG%" 2>&1

echo.
echo ==========================================
echo   pushing to GitHub
echo ==========================================
echo.
git push origin main

echo. >> "%LOG%"
echo ---- push result ---- >> "%LOG%"
git push origin main >> "%LOG%" 2>&1
git log --oneline -3 >> "%LOG%" 2>&1
git status --short --branch >> "%LOG%" 2>&1
echo ==== end ==== >> "%LOG%"

echo.
type "%LOG%"
echo.
echo   Site: https://jodal.pro   (also https://law-test.github.io/procurement/)
echo.
pause
