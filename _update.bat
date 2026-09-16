@echo off
chcp 65001 > nul
cd /d "%~dp0"
echo 현재 폴더의 검토한 파일을 배포합니다. 과거 site_update.zip은 자동으로 풀지 않습니다.
call 배포.bat
