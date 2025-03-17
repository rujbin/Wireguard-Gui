@echo off
echo WireGuard Konfiguration direkt importieren
echo =====================================

if "%~1"=="" (
  echo Fehler: Bitte geben Sie den Pfad zur Konfigurationsdatei an.
  echo Beispiel: direct-import.bat C:\Pfad\zu\meiner\konfiguration.conf
  pause
  exit /b 1
)

:: Prüfe ob die Datei existiert und eine .conf-Datei ist
if not exist "%~1" (
  echo Fehler: Die angegebene Datei existiert nicht: %~1
  pause
  exit /b 1
)

:: Prüfe die Dateiendung
set "file_ext=%~x1"
if /i not "%file_ext%"==".conf" (
  echo Fehler: Die angegebene Datei ist keine .conf-Datei: %~1
  echo Nur WireGuard-Konfigurationsdateien (*.conf) werden unterstützt.
  pause
  exit /b 1
)

:: Finde den WireGuard-Pfad
set "WIREGUARD_PATH=wireguard"

:: Prüfe Standard-Installationspfade
if exist "C:\Program Files\WireGuard\wireguard.exe" (
  set "WIREGUARD_PATH=C:\Program Files\WireGuard\wireguard.exe"
  goto :found_wireguard
)

if exist "C:\Program Files (x86)\WireGuard\wireguard.exe" (
  set "WIREGUARD_PATH=C:\Program Files (x86)\WireGuard\wireguard.exe"
  goto :found_wireguard
)

:: Versuche WireGuard im PATH zu finden
where wireguard >nul 2>nul
if %errorlevel% equ 0 (
  for /f "tokens=*" %%a in ('where wireguard') do (
    set "WIREGUARD_PATH=%%a"
    goto :found_wireguard
  )
)

:: Wenn wir hier sind, wurde WireGuard nicht gefunden
echo WireGuard konnte nicht gefunden werden. Bitte stellen Sie sicher, dass WireGuard installiert ist.
echo.
echo Mögliche Installationspfade:
echo - C:\Program Files\WireGuard\wireguard.exe
echo - C:\Program Files (x86)\WireGuard\wireguard.exe
echo.
echo Sie können es von https://www.wireguard.com/install/ herunterladen.
pause
exit /b 1

:found_wireguard
echo WireGuard gefunden: %WIREGUARD_PATH%

:: Extrahiere den Konfigurationsnamen (ohne Pfad und Erweiterung)
for %%i in ("%~1") do set "config_name=%%~ni"

echo.
echo Importiere Konfiguration "%config_name%" aus Datei: %~1
echo.

:: Verwende das WireGuard-Tool, um die Konfiguration zu importieren
"%WIREGUARD_PATH%" /installtunnelservice "%~1"
if %errorlevel% neq 0 (
  echo.
  echo Fehler beim Importieren der Konfiguration. Möglicherweise benötigen Sie Administratorrechte.
  echo Bitte führen Sie dieses Skript als Administrator aus oder verwenden Sie die WireGuard-App direkt.
  pause
  exit /b 1
) else (
  echo.
  echo Konfiguration wurde erfolgreich importiert und aktiviert.
  echo Name des Tunnels: %config_name%
  echo.
  echo Sie können den Tunnel jetzt in der WireGuard-App verwalten.
  pause
)

exit /b 0 