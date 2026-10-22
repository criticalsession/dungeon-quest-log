@echo off
setlocal
cd /d "%~dp0"

rem Port comes from .env (QUESTLOG_PORT=...), which docker compose reads too.
set QUESTLOG_PORT=47218
for /f "usebackq eol=# tokens=1,* delims==" %%a in (".env") do if "%%a"=="QUESTLOG_PORT" set QUESTLOG_PORT=%%b

docker info >nul 2>&1
if errorlevel 1 (
  echo Docker is not running. Please start Docker Desktop, then run this again.
  pause
  exit /b 1
)

docker compose up -d --build
if errorlevel 1 (
  echo.
  echo Could not build or start the quest log. See the error above.
  echo If the port is in use, change QUESTLOG_PORT in the .env file.
  pause
  exit /b 1
)

powershell -NoProfile -Command "for($i=0;$i -lt 30;$i++){try{Invoke-WebRequest -UseBasicParsing http://localhost:%QUESTLOG_PORT% -TimeoutSec 2 | Out-Null; exit 0}catch{Start-Sleep 1}}; exit 1"
start "" http://localhost:%QUESTLOG_PORT%
endlocal
