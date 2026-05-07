@echo off
REM Helper service launcher (port 9999)
REM Called by master boot script. Auto-restart on crash.

set BASE=C:\Users\Dev\Desktop\Job Agents\job-agent
set LOGDIR=%BASE%\setup\logs
if not exist "%LOGDIR%" mkdir "%LOGDIR%"

REM Kill any old instance on port 9999
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":9999" ^| findstr "LISTENING"') do (
    powershell -NoProfile -Command "wmic process where ProcessId=%%a delete" >nul 2>&1
)
timeout /t 2 /nobreak >nul

REM Start helper service in background
start "" /MIN cmd /c "node ""%BASE%\helper-service\server.js"" >> ""%LOGDIR%\helper.log"" 2>&1"
exit /b 0
