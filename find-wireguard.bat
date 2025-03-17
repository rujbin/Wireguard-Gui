@echo off
echo WireGuard Pfad-Finder
echo ====================
echo.
echo Dieser Tool sucht nach WireGuard-Installationen auf Ihrem System.
echo.

:: Finde den WireGuard-Pfad
set "FOUND_WIREGUARD=0"

:: Prüfe Standard-Installationspfade
echo Prüfe Standard-Installationspfade...
if exist "C:\Program Files\WireGuard\wireguard.exe" (
  echo [GEFUNDEN] C:\Program Files\WireGuard\wireguard.exe
  set "WIREGUARD_PATH=C:\Program Files\WireGuard\wireguard.exe"
  set "FOUND_WIREGUARD=1"
)

if exist "C:\Program Files (x86)\WireGuard\wireguard.exe" (
  echo [GEFUNDEN] C:\Program Files (x86)\WireGuard\wireguard.exe
  set "WIREGUARD_PATH=C:\Program Files (x86)\WireGuard\wireguard.exe"
  set "FOUND_WIREGUARD=1"
)

:: Versuche wg.exe zu finden
echo.
echo Prüfe nach wg.exe (WireGuard CLI-Tool)...
if exist "C:\Program Files\WireGuard\wg.exe" (
  echo [GEFUNDEN] C:\Program Files\WireGuard\wg.exe
  set "WG_PATH=C:\Program Files\WireGuard\wg.exe"
  set "FOUND_WIREGUARD=1"
)

if exist "C:\Program Files (x86)\WireGuard\wg.exe" (
  echo [GEFUNDEN] C:\Program Files (x86)\WireGuard\wg.exe
  set "WG_PATH=C:\Program Files (x86)\WireGuard\wg.exe"
  set "FOUND_WIREGUARD=1"
)

:: Versuche WireGuard im PATH zu finden
echo.
echo Prüfe, ob WireGuard im System-PATH verfügbar ist...
where wireguard >nul 2>nul
if %errorlevel% equ 0 (
  for /f "tokens=*" %%a in ('where wireguard') do (
    echo [GEFUNDEN] %%a
    set "WIREGUARD_PATH=%%a"
    set "FOUND_WIREGUARD=1"
  )
) else (
  echo [NICHT GEFUNDEN] WireGuard ist nicht im System-PATH
)

:: Versuche wg.exe im PATH zu finden
where wg >nul 2>nul
if %errorlevel% equ 0 (
  for /f "tokens=*" %%a in ('where wg') do (
    echo [GEFUNDEN] %%a
    set "WG_PATH=%%a"
    set "FOUND_WIREGUARD=1"
  )
) else (
  echo [NICHT GEFUNDEN] wg.exe ist nicht im System-PATH
)

echo.
if "%FOUND_WIREGUARD%"=="1" (
  echo WireGuard wurde auf Ihrem System gefunden.
  if defined WIREGUARD_PATH (
    echo Hauptprogramm: %WIREGUARD_PATH%
  )
  if defined WG_PATH (
    echo CLI-Tool: %WG_PATH%
  )
) else (
  echo WireGuard wurde auf Ihrem System nicht gefunden.
  echo.
  echo Bitte stellen Sie sicher, dass WireGuard installiert ist. Sie können es von
  echo https://www.wireguard.com/install/ herunterladen.
  echo.
  echo Nach der Installation müssen Sie möglicherweise Ihren Computer neu starten,
  echo damit die Änderungen am System-PATH wirksam werden.
)

echo.
echo Drücken Sie eine beliebige Taste, um zu beenden...
pause >nul 