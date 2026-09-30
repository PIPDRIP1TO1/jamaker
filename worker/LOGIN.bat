@echo off
REM JA MAKER - Login compte navigateur (double-clic, bla terminal)
cd /d "%~dp0"
echo ============================================
echo  JA MAKER - Connexion compte navigateur
echo ============================================
echo.
echo  1. ChatGPT
echo  2. Gemini
echo  3. DeepSeek
echo  4. Qwen
echo  5. Meta AI
echo.
set /p CHOICE="Numéro (1-5) : "
set PROVIDER=deepseek
if "%CHOICE%"=="1" set PROVIDER=chatgpt
if "%CHOICE%"=="2" set PROVIDER=gemini
if "%CHOICE%"=="3" set PROVIDER=deepseek
if "%CHOICE%"=="4" set PROVIDER=qwen
if "%CHOICE%"=="5" set PROVIDER=metaai
set /p PROFILE="Nom du profil [Profil principal] : "
if "%PROFILE%"=="" set PROFILE=Profil principal
echo.
echo Ouverture de Chrome pour : %PROVIDER% / %PROFILE%
echo Connectez-vous, puis Entrée ici quand c'est fait.
echo.
node login.js %PROVIDER% "%PROFILE%"
pause
