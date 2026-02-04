@echo off
setlocal

set /p DB_HOST="Enter PostgreSQL host (default: localhost): "
if "%DB_HOST%"=="" set DB_HOST=localhost

set /p DB_PORT="Enter PostgreSQL port (default: 5432): "
if "%DB_PORT%"=="" set DB_PORT=5432

set /p DB_NAME="Enter database name: "
if "%DB_NAME%"=="" (
    echo Error: Database name is required
    exit /b 1
)

set /p DB_USER="Enter PostgreSQL username: "
if "%DB_USER%"=="" (
    echo Error: Username is required
    exit /b 1
)

set /p DB_PASS="Enter PostgreSQL password: "
if "%DB_PASS%"=="" (
    echo Error: Password is required
    exit /b 1
)

echo.
echo Applying migrations to database: %DB_NAME%
echo Host: %DB_HOST%:%DB_PORT%
echo User: %DB_USER%
echo.

set CONNECTION_STRING=Host=%DB_HOST%;Port=%DB_PORT%;Database=%DB_NAME%;Username=%DB_USER%;Password=%DB_PASS%

cd ..\.. 2>nul
@echo off

dotnet ef database update --connection "%CONNECTION_STRING%" 2>&1

if %ERRORLEVEL% EQU 0 (
    echo.
    echo [SUCCESS] Migrations applied successfully to %DB_NAME%!
    exit /b 0
) else (
    echo.
    echo [ERROR] Migration application failed!
    exit /b %ERRORLEVEL%
)
