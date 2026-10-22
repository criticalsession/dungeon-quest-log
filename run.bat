@echo off
setlocal
cd /d "%~dp0"
if "%QUESTLOG_PORT%"=="" set QUESTLOG_PORT=8080

docker info >nul 2>&1
if not errorlevel 1 goto docker_ready

echo Docker is not running. Trying to start Docker Desktop...
start "" "%ProgramFiles%\Docker\Docker\Docker Desktop.exe"
set /a tries=0
:wait_docker
timeout /t 3 /nobreak >nul
docker info >nul 2>&1
if not errorlevel 1 goto docker_ready
set /a tries+=1
if %tries% lss 30 goto wait_docker
echo.
echo Docker is not available. Please install or start Docker Desktop, then run this again.
pause
exit /b 1

:docker_ready
docker compose up -d --build
if errorlevel 1 (
  echo.
  echo Could not build or start the quest log. See the error above.
  pause
  exit /b 1
)

powershell -NoProfile -Command "for($i=0;$i -lt 30;$i++){try{Invoke-WebRequest -UseBasicParsing http://localhost:%QUESTLOG_PORT% -TimeoutSec 2 | Out-Null; exit 0}catch{Start-Sleep 1}}; exit 1"
start "" http://localhost:%QUESTLOG_PORT%
endlocal
