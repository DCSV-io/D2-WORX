@echo off
setlocal

cd ..\.. 2>nul
@echo off

dotnet ef migrations remove --force 2>&1

if %ERRORLEVEL% EQU 0 (
    echo.
    echo [SUCCESS] Last migration removed successfully!
    exit /b 0
) else (
    echo.
    echo [ERROR] Migration removal failed!
    echo Note: Make sure the migration hasn't been committed to source control.
    exit /b %ERRORLEVEL%
)
