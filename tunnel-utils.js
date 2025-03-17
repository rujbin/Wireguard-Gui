/**
 * Alternative WireGuard-Tunnel-Verwaltung über native Windows-Befehle
 * 
 * Diese Datei bietet Funktionen, die WireGuard-Tunnel über native Windows-Befehle 
 * aktivieren/deaktivieren können, wenn das WireGuard-Programm nicht gefunden werden kann.
 */

const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const log = require('electron-log');

/**
 * Prüft, ob ein WireGuard-Tunnel aktiv ist
 * 
 * @param {string} tunnelName Name des Tunnels
 * @returns {Promise<boolean>} true wenn aktiv, false wenn inaktiv
 */
function checkTunnelStatus(tunnelName) {
  return new Promise((resolve, reject) => {
    log.info(`Prüfe Tunnelstatus für: ${tunnelName}`);
    
    // Verwende netsh, um alle Netzwerkadapter zu prüfen
    exec('netsh interface show interface', (error, stdout, stderr) => {
      if (error) {
        log.error('Fehler beim Prüfen des Tunnelstatus:', error);
        return resolve(false);
      }
      
      log.info(`Netzwerkadapter-Output: ${stdout.substring(0, 200)}...`);
      
      // Suche nach dem Tunnelnamen in der Ausgabe
      // Typische WireGuard-Adapterbezeichnung: "WireGuard Tunnel: tunnelname"
      if (stdout.includes(`WireGuard Tunnel: ${tunnelName}`) || 
          stdout.includes(tunnelName)) {
        log.info(`Tunnel ${tunnelName} ist aktiv`);
        resolve(true);
      } else {
        log.info(`Tunnel ${tunnelName} ist inaktiv`);
        resolve(false);
      }
    });
  });
}

/**
 * Aktiviert einen WireGuard-Tunnel mit nativem Windows netsh
 * (benötigt Administratorrechte)
 * 
 * @param {string} configPath Vollständiger Pfad zur Konfigurationsdatei
 * @returns {Promise<{success: boolean, error?: string}>} Ergebnis
 */
function activateTunnel(configPath) {
  return new Promise((resolve, reject) => {
    log.info(`Alternative Aktivierung für Konfiguration: ${configPath}`);
    
    // Prüfe, ob die Datei existiert
    if (!fs.existsSync(configPath)) {
      log.error(`Konfigurationsdatei existiert nicht: ${configPath}`);
      
      // Versuche, den Pfad zu diagnostizieren
      try {
        const dir = path.dirname(configPath);
        if (fs.existsSync(dir)) {
          log.info(`Verzeichnis existiert: ${dir}`);
          const files = fs.readdirSync(dir);
          const similarFiles = files.filter(f => f.includes(path.basename(configPath, '.conf')));
          log.info(`Ähnliche Dateien im Verzeichnis: ${similarFiles.length > 0 ? similarFiles.join(', ') : 'keine'}`);
          log.info(`Alle Dateien im Verzeichnis (max. 20): ${files.slice(0, 20).join(', ')}${files.length > 20 ? '...' : ''}`);
        } else {
          log.info(`Verzeichnis existiert nicht: ${dir}`);
        }
      } catch (dirErr) {
        log.error(`Fehler beim Überprüfen des Verzeichnisses: ${dirErr.message}`);
      }
      
      return resolve({ success: false, error: 'Konfigurationsdatei existiert nicht' });
    }
    
    log.info(`Konfigurationsdatei gefunden: ${configPath}`);
    
    // Prüfe die Dateiattribute und -berechtigungen
    try {
      const stats = fs.statSync(configPath);
      log.info(`Dateigröße: ${stats.size} Bytes`);
      log.info(`Datei-Modus: ${stats.mode.toString(8)}`);
      log.info(`Letzte Änderung: ${stats.mtime}`);
    } catch (statErr) {
      log.error(`Fehler beim Prüfen der Dateiattribute: ${statErr.message}`);
    }
    
    // Versuche, die Datei zu lesen, um sicherzustellen, dass der Zugriff funktioniert
    try {
      const content = fs.readFileSync(configPath, 'utf8');
      log.info(`Konfigurationsdatei erfolgreich gelesen (${content.length} Bytes)`);
      
      // Prüfe, ob die Datei eine gültige WireGuard-Konfiguration zu sein scheint
      if (!content.includes('[Interface]')) {
        log.warn('Datei scheint keine gültige WireGuard-Konfiguration zu sein (kein [Interface]-Abschnitt gefunden)');
      } else {
        log.info('Datei scheint eine gültige WireGuard-Konfiguration zu sein ([Interface]-Abschnitt gefunden)');
      }
    } catch (readErr) {
      log.error(`Fehler beim Lesen der Konfigurationsdatei: ${readErr.message}`);
      return resolve({ success: false, error: `Fehler beim Lesen der Konfigurationsdatei: ${readErr.message}` });
    }
    
    // Konvertiere den tunnelName aus dem Dateipfad
    const tunnelName = path.basename(configPath, '.conf').split('-');
    // Extrahiere den richtigen Namen - bei alt.conf nehmen wir die ersten 3 Teile, sonst alles vor dem Timestamp
    const isAltFile = tunnelName[tunnelName.length - 1] === 'alt';
    const fullTunnelName = isAltFile 
      ? tunnelName.slice(0, 3).join('-')
      : tunnelName.slice(0, 3).join('-');

    log.info(`Tunnelname aus Pfad: ${fullTunnelName}`);
    
    // Versuche, den Tunnelstatus zu prüfen
    checkTunnelStatus(fullTunnelName).then(isActive => {
      if (isActive) {
        log.info(`Tunnel ist bereits aktiv: ${fullTunnelName}`);
        return resolve({ success: true, message: 'Tunnel ist bereits aktiv' });
      }
      
      // Versuche, den Windows-Dienst für WireGuard zu nutzen, falls vorhanden
      log.info(`Versuche Windows-Dienst zu starten: WireGuardTunnel$${fullTunnelName}`);
      exec(`sc start WireGuardTunnel$${fullTunnelName}`, (error, stdout, stderr) => {
        if (error) {
          // Wenn der Dienst nicht gefunden wurde, versuche die Konfiguration zu importieren
          log.warn('WireGuard-Dienst konnte nicht gestartet werden:', error);
          
          // Wir könnten hier verschiedene Methoden probieren, z.B.:
          // 1. wg-quick.exe up-Befehl suchen
          // 2. Die interne WireGuard-Funktionalität direkt aufrufen
          
          // Versuche wg.exe zu finden
          const wgPaths = [
            'C:\\Program Files\\WireGuard\\wg.exe',
            'C:\\Program Files (x86)\\WireGuard\\wg.exe',
            path.join(os.homedir(), 'AppData\\Local\\WireGuard\\wg.exe'),
            path.join(os.homedir(), 'AppData\\Local\\Programs\\WireGuard\\wg.exe'),
            'wg.exe' // Versuche über PATH
          ];
          
          let wgFound = false;
          for (const wgPath of wgPaths) {
            if (fs.existsSync(wgPath)) {
              wgFound = true;
              log.info(`wg.exe gefunden: ${wgPath}`);
              // Wir könnten versuchen, wg direkt zu verwenden
              // aber für jetzt nur als Information protokollieren
            }
          }
          
          if (!wgFound) {
            log.warn('wg.exe nicht gefunden in Standard-Pfaden');
            // Versuche im PATH zu finden
            try {
              const { stdout: wgWhich } = exec('where wg.exe', { encoding: 'utf8' });
              if (wgWhich && wgWhich.trim()) {
                log.info(`wg.exe gefunden über PATH: ${wgWhich.trim()}`);
                wgFound = true;
              }
            } catch (whereErr) {
              log.info('wg.exe nicht im PATH gefunden');
            }
          }
          
          // Versuche wg-quick.exe zu finden
          const wgQuickPaths = [
            'C:\\Program Files\\WireGuard\\wg-quick.exe',
            'C:\\Program Files (x86)\\WireGuard\\wg-quick.exe',
            path.join(os.homedir(), 'AppData\\Local\\WireGuard\\wg-quick.exe'),
            path.join(os.homedir(), 'AppData\\Local\\Programs\\WireGuard\\wg-quick.exe'),
            'wg-quick.exe' // Versuche über PATH
          ];
          
          log.info(`Suche nach wg-quick in folgenden Pfaden: ${wgQuickPaths.join(', ')}`);
          
          let wgQuickFound = false;
          let foundWgQuickPath = '';
          
          for (const wgPath of wgQuickPaths) {
            if (wgPath === 'wg-quick.exe') {
              try {
                // Suche im PATH
                const { stdout: wgQuickWhich } = exec('where wg-quick.exe', { encoding: 'utf8' });
                if (wgQuickWhich && wgQuickWhich.trim()) {
                  wgQuickFound = true;
                  foundWgQuickPath = wgQuickWhich.trim().split('\n')[0];
                  log.info(`wg-quick.exe gefunden über PATH: ${foundWgQuickPath}`);
                }
              } catch (whereErr) {
                log.info('wg-quick.exe nicht im PATH gefunden');
                continue;
              }
            } else if (fs.existsSync(wgPath)) {
              wgQuickFound = true;
              foundWgQuickPath = wgPath;
              log.info(`wg-quick.exe gefunden: ${wgPath}`);
            }
          }
          
          if (wgQuickFound && foundWgQuickPath) {
            // Wir haben wg-quick gefunden, versuche den Tunnel zu starten
            log.info(`Starte Tunnel mit: "${foundWgQuickPath}" up "${configPath}"`);
            exec(`"${foundWgQuickPath}" up "${configPath}"`, (wgError, wgStdout, wgStderr) => {
              if (wgError) {
                log.error('Fehler beim Starten mit wg-quick:', wgError);
                log.error(`wg-quick stdout: ${wgStdout}`);
                log.error(`wg-quick stderr: ${wgStderr}`);
                return resolve({ success: false, error: `Fehler beim Starten des Tunnels: ${wgError.message}` });
              }
              
              log.info(`wg-quick erfolgreich: ${wgStdout}`);
              return resolve({ success: true });
            });
            return;
          } else if (!wgQuickFound) {
            log.warn('wg-quick.exe nicht gefunden');
            
            // Letzte Möglichkeit: Versuche, den PowerShell-Befehl zu verwenden
            log.info('Versuche Tunnel mit PowerShell zu starten');
            
            // Extrahiere die Schnittstelle aus der Konfiguration
            try {
              const config = fs.readFileSync(configPath, 'utf8');
              log.info('Starte Tunnel mit PowerShell...');
              
              // Führe PowerShell aus, um den Netzwerkadapter zu aktivieren
              const psCommand = `powershell -Command "try { 
                \\$config = Get-Content '${configPath}' | Out-String;
                \\$adapterName = 'WireGuard Tunnel: ${fullTunnelName}';
                
                # Prüfe, ob der Adapter existiert
                \\$adapter = Get-NetAdapter | Where-Object { \\$_.Name -like '*${fullTunnelName}*' -or \\$_.InterfaceDescription -like '*${fullTunnelName}*' };
                
                if (\\$adapter) {
                  # Adapter gefunden, versuche ihn zu aktivieren
                  Write-Output 'Adapter gefunden, aktiviere...';
                  Enable-NetAdapter -Name \\$adapter.Name -Confirm:\\$false;
                  Write-Output 'Adapter aktiviert';
                  exit 0;
                } else {
                  Write-Output 'Adapter nicht gefunden';
                  exit 1;
                }
              } catch {
                Write-Output ('Fehler: ' + \\$_);
                exit 2;
              }"`;
              
              exec(psCommand, (psError, psStdout, psStderr) => {
                if (psError) {
                  log.error('PowerShell-Versuch fehlgeschlagen:', psError);
                  log.error(`PowerShell stdout: ${psStdout}`);
                  log.error(`PowerShell stderr: ${psStderr}`);
                  
                  return resolve({ 
                    success: false, 
                    error: 'Konnte keine Methode zur Tunnel-Aktivierung finden. Bitte installieren Sie WireGuard.' 
                  });
                }
                
                log.info(`PowerShell erfolgreich: ${psStdout}`);
                
                // Prüfe nach kurzer Verzögerung, ob der Tunnel wirklich aktiv ist
                setTimeout(() => {
                  checkTunnelStatus(fullTunnelName).then(isNowActive => {
                    if (isNowActive) {
                      log.info(`Tunnel ist nach PowerShell-Versuch aktiv: ${fullTunnelName}`);
                      return resolve({ success: true });
                    } else {
                      log.warn(`Tunnel ist nach PowerShell-Versuch immer noch inaktiv: ${fullTunnelName}`);
                      return resolve({ 
                        success: false, 
                        error: 'Konnte den Tunnel nicht aktivieren. WireGuard scheint nicht richtig installiert zu sein.' 
                      });
                    }
                  });
                }, 2000);
              });
              
              return;
            } catch (configReadError) {
              log.error('Fehler beim Lesen der Konfiguration für PowerShell-Versuch:', configReadError);
            }
          }
          
          // Wenn wir hier ankommen, haben wir keine Methode gefunden
          log.error('Keine Methode zur Tunnel-Aktivierung gefunden');
          return resolve({ 
            success: false, 
            error: 'Konnte WireGuard-Dienst nicht starten und keine Alternative gefunden. Bitte installieren Sie WireGuard.' 
          });
        }
        
        // Der Dienst wurde erfolgreich gestartet
        log.info(`Dienst erfolgreich gestartet: ${stdout}`);
        return resolve({ success: true });
      });
    });
  });
}

/**
 * Deaktiviert einen WireGuard-Tunnel mit nativem Windows netsh
 * (benötigt Administratorrechte)
 * 
 * @param {string} tunnelName Name des Tunnels
 * @returns {Promise<{success: boolean, error?: string}>} Ergebnis
 */
function deactivateTunnel(tunnelName) {
  return new Promise((resolve, reject) => {
    log.info(`Alternative Deaktivierung für Tunnel: ${tunnelName}`);
    
    // Versuche den Windows-Dienst zu stoppen
    log.info(`Versuche Windows-Dienst zu stoppen: WireGuardTunnel$${tunnelName}`);
    exec(`sc stop WireGuardTunnel$${tunnelName}`, (error, stdout, stderr) => {
      if (error) {
        log.warn('WireGuard-Dienst konnte nicht gestoppt werden:', error);
        
        // Versuche wg-quick.exe zu finden
        const wgQuickPaths = [
          'C:\\Program Files\\WireGuard\\wg-quick.exe',
          'C:\\Program Files (x86)\\WireGuard\\wg-quick.exe',
          path.join(os.homedir(), 'AppData\\Local\\WireGuard\\wg-quick.exe'),
          path.join(os.homedir(), 'AppData\\Local\\Programs\\WireGuard\\wg-quick.exe')
        ];
        
        log.info(`Suche nach wg-quick in folgenden Pfaden: ${wgQuickPaths.join(', ')}`);
        
        let wgQuickFound = false;
        for (const wgPath of wgQuickPaths) {
          if (fs.existsSync(wgPath)) {
            wgQuickFound = true;
            log.info(`wg-quick.exe gefunden: ${wgPath}`);
            // Wir haben wg-quick gefunden, versuche den Tunnel zu stoppen
            log.info(`Stoppe Tunnel mit: "${wgPath}" down "${tunnelName}"`);
            exec(`"${wgPath}" down "${tunnelName}"`, (wgError, wgStdout, wgStderr) => {
              if (wgError) {
                log.error('Fehler beim Stoppen mit wg-quick:', wgError);
                log.error(`wg-quick stdout: ${wgStdout}`);
                log.error(`wg-quick stderr: ${wgStderr}`);
                return resolve({ success: false, error: `Fehler beim Stoppen des Tunnels: ${wgError.message}` });
              }
              
              log.info(`wg-quick erfolgreich: ${wgStdout}`);
              return resolve({ success: true });
            });
            return;
          }
        }
        
        if (!wgQuickFound) {
          log.warn('wg-quick.exe nicht gefunden');
        }
        
        return resolve({ 
          success: false, 
          error: 'Konnte WireGuard-Dienst nicht stoppen und keine Alternative gefunden' 
        });
      }
      
      // Der Dienst wurde erfolgreich gestoppt
      log.info(`Dienst erfolgreich gestoppt: ${stdout}`);
      return resolve({ success: true });
    });
  });
}

module.exports = {
  checkTunnelStatus,
  activateTunnel,
  deactivateTunnel
}; 