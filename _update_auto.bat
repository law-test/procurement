@echo off
setlocal
cd /d "%~dp0"
set DEST=%CD%
set LOG=%CD%\deploy_log.txt
echo ==== update v3 ==== > "%LOG%"
echo %DATE% %TIME% >> "%LOG%"
echo DEST=%DEST% >> "%LOG%"

rem built-in tar on Windows 10+ handles zip and overwrites
tar -xf "%DEST%\site_update.zip" -C "%DEST%" >> "%LOG%" 2>&1
echo ---- tar exit %ERRORLEVEL% >> "%LOG%"
if not exist "%DEST%\plan\index.html" (
  echo ---- fallback to Expand-Archive >> "%LOG%"
  powershell -NoProfile -ExecutionPolicy Bypass -Command "Expand-Archive -LiteralPath '%DEST%\site_update.zip' -DestinationPath '%DEST%' -Force" >> "%LOG%" 2>&1
  echo ---- ps exit %ERRORLEVEL% >> "%LOG%"
)
if not exist "%DEST%\plan\index.html"  echo ---- WARN plan missing  >> "%LOG%"
if not exist "%DEST%\drill\index.html" echo ---- WARN drill missing >> "%LOG%"
if not exist "%DEST%\cbt\index.html"   echo ---- WARN cbt missing   >> "%LOG%"

git add -A >> "%LOG%" 2>&1
git commit -m "study room, 7-day 3-round plan, drill, CBT, news, supabase schema" >> "%LOG%" 2>&1
git log --oneline -1 >> "%LOG%" 2>&1

git push origin main >> "%LOG%" 2>&1
echo ---- push exit %ERRORLEVEL% >> "%LOG%"
git log --oneline -3 >> "%LOG%" 2>&1
git status --short --branch >> "%LOG%" 2>&1
echo ==== end ==== >> "%LOG%"

exit /b 0
