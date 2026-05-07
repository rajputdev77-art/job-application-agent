@echo off
REM ============================================
REM One-time login to LinkedIn + Naukri.
REM Self-healing: ensures Playwright Chromium is installed before launching.
REM ============================================

setlocal

cd /d "C:\Users\Dev\Desktop\Job Agents\job-agent"

echo.
echo ============================================
echo   One-Time Login Setup
echo ============================================
echo.
echo This will save your LinkedIn + Naukri sessions
echo so the agent can apply for jobs autonomously.
echo.
echo Two browser windows will open one after another.
echo Just log in normally in each, then come back to this window.
echo.

REM Self-heal: ensure Playwright Chromium is installed
echo [pre-check] Verifying Playwright Chromium is installed...
cd playwright
call npx playwright install chromium
cd ..

if errorlevel 1 (
    echo.
    echo ERROR: Could not install Playwright browser.
    echo Try manually: cd playwright ^&^& npx playwright install chromium
    pause
    exit /b 1
)

echo.
pause

echo.
echo === Step 1/2: LinkedIn ===
echo.
echo A browser will open. Log in to LinkedIn, then come back here.
echo.
node playwright\save_linkedin_auth.js
if errorlevel 1 (
    echo.
    echo LinkedIn auth save failed. Continuing to Naukri anyway...
    echo You can re-run this script later.
    echo.
    pause
)

echo.
echo === Step 2/2: Naukri.com ===
echo.
echo A browser will open. Log in to Naukri, then come back here.
echo.
node playwright\save_naukri_auth.js
if errorlevel 1 (
    echo.
    echo Naukri auth save failed.
    echo.
)

echo.
echo ============================================
echo   ALL DONE
echo ============================================
echo.
echo The job agent can now apply on your behalf.
echo Sessions are saved at:
echo   playwright\linkedin_auth.json
echo   playwright\naukri_auth.json
echo.
echo Re-run this script if applications start failing.
pause
endlocal
