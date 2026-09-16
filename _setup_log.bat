@echo off
setlocal
cd /d "%~dp0"
set LOG=%~dp0setup_log.txt

echo ==== setup start ==== > "%LOG%"
echo %DATE% %TIME% >> "%LOG%"
echo [cwd] %CD% >> "%LOG%"
echo. >> "%LOG%"

echo ---- where git ---- >> "%LOG%"
where git >> "%LOG%" 2>&1
git --version >> "%LOG%" 2>&1

echo. >> "%LOG%"
echo ---- init / commit ---- >> "%LOG%"
git init >> "%LOG%" 2>&1
git add -A >> "%LOG%" 2>&1
git commit -m "P0 site skeleton: home, exam, about" >> "%LOG%" 2>&1
git branch -M main >> "%LOG%" 2>&1

echo. >> "%LOG%"
echo ---- remote ---- >> "%LOG%"
git remote remove origin >> "%LOG%" 2>&1
git remote add origin https://github.com/law-test/procurement.git >> "%LOG%" 2>&1
git remote -v >> "%LOG%" 2>&1

echo. >> "%LOG%"
echo ---- state before push ---- >> "%LOG%"
git log --oneline >> "%LOG%" 2>&1
git status --short --branch >> "%LOG%" 2>&1

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
git log --oneline -5 >> "%LOG%" 2>&1
git status --short --branch >> "%LOG%" 2>&1
git ls-files >> "%LOG%" 2>&1
echo ==== setup end ==== >> "%LOG%"

echo.
echo ==========================================
type "%LOG%"
echo ==========================================
echo   A log file was saved: setup_log.txt
echo ==========================================
echo.
pause
