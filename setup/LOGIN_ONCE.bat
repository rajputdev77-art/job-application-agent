@echo off
REM ============================================
REM One-time login to LinkedIn + Naukri.
REM Run this ONCE to enable autonomous applications.
REM
REM What happens:
REM 1. Chromium opens to LinkedIn login - you log in - press Enter
REM 2. Chromium opens to Naukri login - you log in - press Enter
REM 3. Auth cookies are saved. Future applications run without prompts.
REM
REM Re-run this if applications start failing with "session expired".
REM ============================================

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
pause

cd /d "C:\Users\Dev\Desktop\Job Agents\job-agent"

echo.
echo === Step 1/2: LinkedIn ===
echo.
node playwright\save_linkedin_auth.js

echo.
echo === Step 2/2: Naukri.com ===
echo.
node playwright\save_naukri_auth.js

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
