@echo off
setlocal
cd /d "%~dp0"
echo ==========================================
echo   procurement : first-time setup
echo ==========================================
echo.
git --version
if errorlevel 1 goto NOGIT
echo.
echo [1/5] init
git init
echo.
echo [2/5] commit
git add -A
git commit -m "P0 site skeleton: home, exam, about"
git branch -M main
echo.
echo [3/5] remote
git remote remove origin 2>nul
git remote add origin https://github.com/law-test/procurement.git
echo.
echo [4/5] push  (if a GitHub login window appears, sign in as law-test)
git push -u origin main
echo.
echo [5/5] done
echo.
echo   OK if you see:  main -^> main    or    up-to-date
echo   Next: GitHub repo  Settings  ^>  Pages  ^>  Source = main / (root)  ^>  Save
echo   Then open: https://law-test.github.io/procurement/
echo.
pause
exit /b 0

:NOGIT
echo.
echo   STOP: git is not installed.
echo   Install from https://git-scm.com/download/win  then run this file again.
echo.
pause
exit /b 1
