@echo off
REM ============================================
REM Single boot entrypoint - run via Task Scheduler at every login
REM Fixes path-with-spaces bug + starts helper + n8n + activates workflows
REM ============================================

setlocal EnableDelayedExpansion

set "BASE=C:\Users\Dev\Desktop\Job Agents\job-agent"
set "LOGDIR=%BASE%\setup\logs"
if not exist "%LOGDIR%" mkdir "%LOGDIR%"
set "LOGFILE=%LOGDIR%\boot.log"

echo. >> "%LOGFILE%"
echo ================================================ >> "%LOGFILE%"
echo Boot started at %date% %time% >> "%LOGFILE%"
echo ================================================ >> "%LOGFILE%"

REM === Step 1: Kill orphan processes on our ports ===
echo [%date% %time%] [1/5] Cleaning ports 5678 + 9999... >> "%LOGFILE%"
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":5678" ^| findstr "LISTENING" 2^>nul') do (
    taskkill /F /PID %%a >> "%LOGFILE%" 2>&1
    powershell -NoProfile -Command "Stop-Process -Id %%a -Force -ErrorAction SilentlyContinue" >> "%LOGFILE%" 2>&1
)
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":9999" ^| findstr "LISTENING" 2^>nul') do (
    taskkill /F /PID %%a >> "%LOGFILE%" 2>&1
    powershell -NoProfile -Command "Stop-Process -Id %%a -Force -ErrorAction SilentlyContinue" >> "%LOGFILE%" 2>&1
)
timeout /t 3 /nobreak >nul

REM === Step 2: Activate workflows in SQLite ===
echo [%date% %time%] [2/5] Activating workflows via Python... >> "%LOGFILE%"
python "%BASE%\setup\activate_workflows.py" >> "%LOGFILE%" 2>&1

REM === Step 3: Start helper service (port 9999) ===
echo [%date% %time%] [3/5] Starting helper service... >> "%LOGFILE%"
powershell -NoProfile -Command "Start-Process -FilePath 'node.exe' -ArgumentList '\"%BASE%\helper-service\server.js\"' -WindowStyle Hidden -RedirectStandardOutput '%LOGDIR%\helper-out.log' -RedirectStandardError '%LOGDIR%\helper-err.log'" >> "%LOGFILE%" 2>&1

REM === Step 4: Start n8n with env vars (port 5678) ===
echo [%date% %time%] [4/5] Starting n8n with env vars... >> "%LOGFILE%"
powershell -NoProfile -Command "$env:NODE_FUNCTION_ALLOW_BUILTIN='*'; $env:NODE_FUNCTION_ALLOW_EXTERNAL='*'; $env:N8N_RUNNERS_ENABLED='false'; Start-Process -FilePath 'cmd.exe' -ArgumentList '/c','n8n start' -WindowStyle Hidden -RedirectStandardOutput '%LOGDIR%\n8n-out.log' -RedirectStandardError '%LOGDIR%\n8n-err.log'" >> "%LOGFILE%" 2>&1

REM === Step 5: Wait for both ports to bind ===
echo [%date% %time%] [5/5] Waiting for services... >> "%LOGFILE%"
set /a counter=0
:waitloop
timeout /t 2 /nobreak >nul
set "n8n_up=0"
set "helper_up=0"
netstat -an | findstr ":5678" | findstr "LISTENING" >nul && set "n8n_up=1"
netstat -an | findstr ":9999" | findstr "LISTENING" >nul && set "helper_up=1"
if !n8n_up!==1 if !helper_up!==1 goto :ready
set /a counter+=1
if !counter! geq 20 goto :failed
goto :waitloop

:ready
echo [%date% %time%] SUCCESS - n8n on 5678 + helper on 9999 >> "%LOGFILE%"
endlocal
exit /b 0

:failed
echo [%date% %time%] PARTIAL FAILURE - n8n_up=!n8n_up! helper_up=!helper_up! >> "%LOGFILE%"
endlocal
exit /b 1
