@echo off
REM Opens the Job Agent local dashboard in your default browser.
REM Starts a tiny HTTP server so the dashboard can read applied_jobs.json.

cd /d "C:\Users\Dev\Desktop\Job Agents\job-agent"

REM Start Python HTTP server in background (port 8765)
start "" /MIN cmd /c "python -m http.server 8765"

REM Wait 2 seconds for server to start
timeout /t 2 /nobreak >nul

REM Open browser
start "" "http://localhost:8765/dashboard/local.html"

echo.
echo Dashboard opened in your browser at http://localhost:8765/dashboard/local.html
echo Auto-refreshes every 30 seconds.
echo Close this window to stop the dashboard server.
echo.
pause
