@echo off
chcp 65001 > nul
setlocal
cd /d "%~dp0"
for /f "delims=" %%b in ('git branch --show-current') do set "DEPLOY_BRANCH=%%b"
if not "%DEPLOY_BRANCH%"=="main" (
  echo 현재 브랜치는 %DEPLOY_BRANCH%입니다. 검토 후 main에 반영한 상태에서 배포해 주세요.
  pause
  exit /b 1
)
git diff --check
if errorlevel 1 goto failed
git add -A
if errorlevel 1 goto failed
git diff --cached --quiet
if errorlevel 1 (
  git commit -m "update reviewed Jodal Pro site"
  if errorlevel 1 goto failed
)
git push origin main
if errorlevel 1 goto failed
echo GitHub에 반영했습니다. Pages 배포 후 https://jodal.pro/ 에서 확인하세요.
pause
exit /b 0
:failed
echo 배포에 실패했습니다. 위 오류를 확인해 주세요. 파일을 자동으로 덮어쓰지 않았습니다.
pause
exit /b 1
