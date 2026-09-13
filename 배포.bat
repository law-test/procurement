@echo off
chcp 65001 > nul
cd /d "%~dp0"
echo ===== procurement deploy =====
git add -A
git commit -m "update site"
echo --- pushing to GitHub ---
git push origin main
echo.
echo ===== "main -> main" 또는 "up-to-date"가 보이면 성공 =====
echo ===== Site: https://law-test.github.io/procurement/ =====
pause
