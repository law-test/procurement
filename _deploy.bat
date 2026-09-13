@echo off
setlocal
cd /d "%~dp0"
echo ==========================================
echo   procurement : deploy
echo ==========================================
echo.
git add -A
git commit -m "update site"
echo.
echo --- push ---
git push origin main
echo.
echo   OK if you see:  main -^> main    or    up-to-date
echo   Site: https://law-test.github.io/procurement/
echo.
pause
