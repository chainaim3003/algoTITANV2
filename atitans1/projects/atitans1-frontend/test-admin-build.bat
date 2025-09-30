@echo off
echo ========================================
echo   TESTING CLEAN ADMIN DASHBOARD BUILD
echo ========================================
echo.

cd /d "C:\SATHYA\CHAINAIM3003\mcp-servers\altry\atry2\atitans1\projects\atitans1-frontend"

echo [1/2] Testing TypeScript compilation...
call npm run build

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ✅ BUILD SUCCESSFUL!
    echo.
    echo Admin Dashboard features implemented:
    echo    ⚙️ Complete role management interface
    echo    📊 Address assignments table with status
    echo    🔄 Role switching and assignment tools  
    echo    🔍 Raw storage data viewer for debugging
    echo    ⚠️ Clear all roles with confirmation
    echo    📦 Enhanced Exporter address display
    echo.
    echo [2/2] Starting development server...
    call npm run dev
) else (
    echo.
    echo ❌ Build failed. Checking specific errors:
    echo.
    npx tsc --noEmit
    pause
)
