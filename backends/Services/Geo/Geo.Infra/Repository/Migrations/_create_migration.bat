@echo off
setlocal

if "%~1"=="" (
    echo Usage: _create_migration.bat MigrationName
    echo Example: _create_migration.bat AddSomeMigrationChange
    exit /b 1
)

cd ..\.. 2>nul
@echo off

dotnet ef migrations add %~1 --output-dir Repository\Migrations 2>&1

if %ERRORLEVEL% EQU 0 (
    echo.
    echo [SUCCESS] Migration "%~1" created successfully!
    exit /b 0
) else (
    echo.
    echo [ERROR] Migration creation failed!
    exit /b %ERRORLEVEL%
)
