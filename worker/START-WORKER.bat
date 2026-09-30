@echo off
REM JA MAKER Worker local - double-clic pour demarrer (fenetre visible).
cd /d "%~dp0"
if not "%JAMAKER_URL%"=="" goto havetoken
set JAMAKER_URL=http://localhost:3100
:havetoken
if not "%JAMAKER_WORKER_TOKEN%"=="" goto dostart
echo.
echo Collez votre token worker :
set /p JAMAKER_WORKER_TOKEN="jwk_ : "
:dostart
echo.
echo Worker vers %JAMAKER_URL% - Ctrl+C pour arreter.
echo.
node index.js
pause
