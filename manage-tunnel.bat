@echo off
echo WireGuard Tunnel-Verwaltung
echo ==========================

if "%~1"=="" (
  goto :show_help
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
echo.

:: Befehle verarbeiten
if /i "%~1"=="list" goto :list_tunnels
if /i "%~1"=="status" goto :tunnel_status
if /i "%~1"=="activate" goto :activate_tunnel
if /i "%~1"=="deactivate" goto :deactivate_tunnel
if /i "%~1"=="help" goto :show_help

echo Unbekannter Befehl: %~1
goto :show_help

:list_tunnels
  echo Liste aller konfigurierten Tunnel:
  echo ---------------------------------
  "%WIREGUARD_PATH%" /tunnelservice | findstr /i "Configuration:" | findstr /v "Creating"
  echo.
  echo Verwenden Sie "manage-tunnel.bat status TUNNELNAME", um den Status eines Tunnels zu prüfen.
  goto :end

:tunnel_status
  if "%~2"=="" (
    echo Fehler: Bitte geben Sie einen Tunnelnamen an.
    echo Beispiel: manage-tunnel.bat status MeinTunnel
    goto :end
  )
  
  echo Status des Tunnels "%~2":
  echo -----------------------
  "%WIREGUARD_PATH%" /tunnelstatus "%~2"
  goto :end

:activate_tunnel
  if "%~2"=="" (
    echo Fehler: Bitte geben Sie einen Tunnelnamen an.
    echo Beispiel: manage-tunnel.bat activate MeinTunnel
    goto :end
  )
  
  echo Aktiviere Tunnel "%~2"...
  "%WIREGUARD_PATH%" /installtunnelservice "%~2"
  if %errorlevel% neq 0 (
    echo Fehler beim Aktivieren des Tunnels. Stellen Sie sicher, dass der Tunnel existiert.
    echo Prüfen Sie die verfügbaren Tunnel mit: manage-tunnel.bat list
  ) else (
    echo Tunnel "%~2" wurde aktiviert.
  )
  goto :end

:deactivate_tunnel
  if "%~2"=="" (
    echo Fehler: Bitte geben Sie einen Tunnelnamen an.
    echo Beispiel: manage-tunnel.bat deactivate MeinTunnel
    goto :end
  )
  
  echo Deaktiviere Tunnel "%~2"...
  "%WIREGUARD_PATH%" /uninstalltunnelservice "%~2"
  if %errorlevel% neq 0 (
    echo Fehler beim Deaktivieren des Tunnels. Stellen Sie sicher, dass der Tunnel existiert und aktiv ist.
    echo Prüfen Sie den Status mit: manage-tunnel.bat status "%~2"
  ) else (
    echo Tunnel "%~2" wurde deaktiviert.
  )
  goto :end

:show_help
  echo Verwendung: manage-tunnel.bat BEFEHL [PARAMETER]
  echo.
  echo Verfügbare Befehle:
  echo   list                     - Zeigt alle verfügbaren Tunnel an
  echo   status TUNNELNAME        - Zeigt den Status eines bestimmten Tunnels an
  echo   activate TUNNELNAME      - Aktiviert einen Tunnel
  echo   deactivate TUNNELNAME    - Deaktiviert einen Tunnel
  echo   help                     - Zeigt diese Hilfe an
  echo.
  echo Beispiele:
  echo   manage-tunnel.bat list
  echo   manage-tunnel.bat status MeinTunnel
  echo   manage-tunnel.bat activate MeinTunnel
  echo   manage-tunnel.bat deactivate MeinTunnel
  goto :end

:end
  pause
  exit /b 0 