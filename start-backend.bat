@echo off
REM KibeProxy Hub - Backend Startup Script for Windows
REM This helps you manage the backend server

setlocal enabledelayedexpansion

cls
echo.
echo ╔════════════════════════════════════════════════════════╗
echo ║       KibeProxy Hub - M-Pesa Backend Manager            ║
echo ╚════════════════════════════════════════════════════════╝
echo.

if "%1"=="start" (
    echo 🚀 Starting M-Pesa Backend Server...
    cd /d "c:\Users\Administrator\myproxy.html\js"
    npm start
    exit /b 0
)

if "%1"=="dev" (
    echo 🔧 Starting in Development Mode (auto-reload)...
    cd /d "c:\Users\Administrator\myproxy.html\js"
    npm run dev
    exit /b 0
)

if "%1"=="install" (
    echo 📦 Installing Dependencies...
    cd /d "c:\Users\Administrator\myproxy.html\js"
    npm install
    echo ✅ Dependencies installed!
    exit /b 0
)

if "%1"=="test" (
    echo 🧪 Testing Backend...
    echo.
    echo Testing health endpoint...
    powershell -Command "(Invoke-WebRequest -Uri 'http://localhost:3000/api/health' -Method Get).Content"
    exit /b 0
)

if "%1"=="stop" (
    echo 🛑 Stopping Backend...
    taskkill /F /IM node.exe
    echo ✅ Backend stopped!
    exit /b 0
)

if "%1"=="logs" (
    echo 📋 Backend is currently running in the terminal
    echo.
    echo To view logs after deployment, use:
    echo   vercel logs
    exit /b 0
)

REM Show help if no argument or invalid argument
echo Usage: start-backend.bat {command}
echo.
echo Commands:
echo   start   - Start the production backend
echo   dev     - Start in development mode (with auto-reload)
echo   install - Install dependencies
echo   test    - Test if backend is running
echo   stop    - Stop the backend
echo   logs    - View backend logs info
echo.
echo Example:
echo   start-backend.bat start
echo.
