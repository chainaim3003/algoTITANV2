@echo off
echo ========================================
echo   AlgoTITANS V2 - Apply Role Fix
echo ========================================
echo.

echo [1/2] Stopping development server...
taskkill /f /im node.exe 2>nul

echo [2/2] Restarting development server...
timeout /t 2 /nobreak >nul
call npm run dev

echo.
echo ✅ Server restarted with role switching fixes!
pause
