@echo off
chcp 65001 > nul
cd /d "%~dp0"
echo ===== procurement 최초 설정 =====
git --version
if errorlevel 1 (
  echo.
  echo [중단] git이 설치되어 있지 않습니다. https://git-scm.com/download/win 에서 설치 후 다시 실행하세요.
  pause
  exit /b 1
)
echo.
echo --- 저장소 초기화 ---
git init -b main
git config user.name "law-test"
git config user.email "law-test@users.noreply.github.com"
git add -A
git commit -m "P0: 사이트 골격 — 홈·시험접수·소개 3화면과 공통 스타일"
echo.
echo --- 원격 연결 ---
git remote remove origin 2>nul
git remote add origin https://github.com/law-test/procurement.git
echo.
echo --- push (자격증명 창이 뜨면 GitHub 로그인 / 이미 저장돼 있으면 그대로 진행) ---
git push -u origin main
echo.
echo ===== "main -> main"이 보이면 성공 =====
echo ===== 다음: GitHub 저장소 Settings ^> Pages 에서 Source를 main / (root)로 지정 =====
pause
