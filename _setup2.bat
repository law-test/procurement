@echo off
setlocal
cd /d "%~dp0"
set LOG=%~dp0setup_log.txt

echo ==== setup2 start ==== > "%LOG%"
echo %DATE% %TIME% >> "%LOG%"

echo. >> "%LOG%"
echo ---- identity (this repo only) ---- >> "%LOG%"
git config user.name "law-test"
git config user.email "law-test@users.noreply.github.com"
git config user.name >> "%LOG%" 2>&1
git config user.email >> "%LOG%" 2>&1

echo. >> "%LOG%"
echo ---- commit ---- >> "%LOG%"
git rm --cached setup_log.txt >> "%LOG%" 2>&1
git add -A >> "%LOG%" 2>&1
git commit -m "P0 site skeleton: home, exam, about" >> "%LOG%" 2>&1
git branch -M main >> "%LOG%" 2>&1
git log --oneline >> "%LOG%" 2>&1

echo.
echo ==========================================
echo   pushing to GitHub
echo   If a login window appears, sign in as law-test.
echo ==========================================
echo.
git push -u origin main

echo. >> "%LOG%"
echo ---- push result ---- >> "%LOG%"
git push -u origin main >> "%LOG%" 2>&1
git log --oneline -3 >> "%LOG%" 2>&1
git status --short --branch >> "%LOG%" 2>&1
echo ==== setup2 end ==== >> "%LOG%"

echo.
echo ==========================================
type "%LOG%"
echo ==========================================
pause
