@echo off
echo ========================================
echo   Starting AI Study Companion Services
echo ========================================

echo Starting Backend Server on port 5000...
start "AI Study Companion - Backend" cmd /k "cd /d %~dp0backend && npm run dev"

timeout /t 3 /nobreak >nul

echo Starting Frontend Server on port 3000...
start "AI Study Companion - Frontend" cmd /k "cd /d %~dp0frontend && npm run dev"

timeout /t 2 /nobreak >nul

echo Opening browser at http://localhost:3000...
start http://localhost:3000

echo All services launched! Keep the opened command windows running.
