@echo off
title ESP32 Real Hardware Flood Early Warning System
cls
echo ==============================================================================
echo   ESP32 FLOOD EARLY WARNING & PREDICTION SYSTEM - LIVE HARDWARE LINK
echo ==============================================================================
echo.
echo  Checking port 8000...

:: Kill any existing process on port 8000 to prevent port collisions
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :8000 ^| findstr LISTENING') do (
    taskkill /F /PID %%a >nul 2>&1
)

echo  Starting local server at http://localhost:8000 ...
start /B python -m http.server 8000 >nul 2>&1

:: Wait 1.5 seconds for the server socket to bind cleanly
timeout /t 2 /nobreak >nul

echo  Opening dashboard in your web browser...
start "" http://localhost:8000

echo.
echo ==============================================================================
echo  DASHBOARD IS LIVE AT: http://localhost:8000
echo ==============================================================================
echo.
echo   Steps to connect to your ESP32:
echo    1. Click "Connect ESP32" in the top header.
echo    2. Choose your ESP32 COM port and click Connect.
echo    3. Use the "Run Pump (ON)" button to test rainfall pump demonstration!
echo.
echo  Keep this window open while using the dashboard. Press Ctrl+C to stop.
echo ==============================================================================
pause >nul
