@echo off
REM ============================================
REM Master n8n startup script (v5 - final)
REM
REM Boot sequence:
REM 1. Kill any orphan n8n on port 5678
REM 2. Run Python activation (DB writes to workflow_entity + workflow_history + webhook_entity)
REM 3. Start n8n with env vars allowing fs/path modules + legacy runner
REM 4. Wait for port 5678 to bind
REM
REM Soul in Motion's workflows live in the same DB and are unaffected.
REM ============================================

setlocal enabledelayedexpansion

set BASE=C:\Users\Dev\Desktop\Job Agents\job-agent
set LOGDIR=%BASE%\setup\logs
if not exist "%LOGDIR%" mkdir "%LOGDIR%"
set LOGFILE=%LOGDIR%\n8n_startup.log

REM n8n v2 environment overrides (Function nodes need fs/path; legacy runner avoids sandbox)
set NODE_FUNCTION_ALLOW_BUILTIN=*
set NODE_FUNCTION_ALLOW_EXTERNAL=*
set N8N_RUNNERS_ENABLED=false

echo. >> "%LOGFILE%"
echo ================================================ >> "%LOGFILE%"
echo Boot at %date% %time% >> "%LOGFILE%"
echo ================================================ >> "%LOGFILE%"

REM Step 1: Kill any existing n8n on port 5678
echo [%date% %time%] Step 1: Checking port 5678... >> "%LOGFILE%"
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":5678" ^| findstr "LISTENING"') do (
    echo [%date% %time%] Killing stale n8n PID %%a >> "%LOGFILE%"
    taskkill /F /PID %%a >> "%LOGFILE%" 2>&1
    powershell -NoProfile -Command "wmic process where ProcessId=%%a delete" >> "%LOGFILE%" 2>&1
)
timeout /t 3 /nobreak >nul

REM Step 2: Activate Job Agent workflows in SQLite
echo [%date% %time%] Step 2: Activating workflows... >> "%LOGFILE%"
python "%BASE%\setup\activate_workflows.py" >> "%LOGFILE%" 2>&1

REM Step 3: Start n8n with env vars (these env vars persist into child process)
echo [%date% %time%] Step 3: Starting n8n with sandbox bypass... >> "%LOGFILE%"
start "" /MIN cmd /c "set NODE_FUNCTION_ALLOW_BUILTIN=*&& set NODE_FUNCTION_ALLOW_EXTERNAL=*&& set N8N_RUNNERS_ENABLED=false&& n8n start >> ""%LOGDIR%\n8n_runtime.log"" 2>&1"

REM Step 4: Wait up to 30s for port 5678 to bind
set /a counter=0
:waitloop
timeout /t 2 /nobreak >nul
netstat -an | findstr ":5678" | findstr "LISTENING" >nul
if !errorlevel!==0 goto :ready
set /a counter+=1
if !counter! geq 15 goto :failed
goto :waitloop

:ready
echo [%date% %time%] SUCCESS - n8n is listening on port 5678 >> "%LOGFILE%"
endlocal
exit /b 0

:failed
echo [%date% %time%] FAILED - n8n did not bind port 5678 within 30s >> "%LOGFILE%"
endlocal
exit /b 1
