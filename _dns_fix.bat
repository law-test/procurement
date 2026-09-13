@echo off
setlocal
echo ==========================================
echo   DNS cache flush + jodal.pro check
echo ==========================================
echo.
echo [1/3] flushing Windows DNS cache
ipconfig /flushdns
echo.
echo [2/3] looking up jodal.pro
nslookup jodal.pro
echo.
echo [3/3] looking up via Cloudflare resolver 1.1.1.1
nslookup jodal.pro 1.1.1.1
echo.
echo ==========================================
echo   Expected: 185.199.108.153 / 109.153 / 110.153 / 111.153
echo.
echo   If step 1 says elevation is required:
echo   close this, right-click the file, Run as administrator.
echo.
echo   Then in Chrome open:  chrome://net-internals/#dns
echo   and click  Clear host cache
echo ==========================================
echo.
pause
