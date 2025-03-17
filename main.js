const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');
const Store = require('electron-store');
const crypto = require('crypto');
const log = require('electron-log');

// Aktiviere Debug-Modus, wenn --debug Parameter übergeben wird
const isDebug = process.argv.includes('--debug');
console.log('Debug-Modus:', isDebug ? 'aktiviert' : 'deaktiviert');

// Finde den WireGuard-Installationspfad
function getWireGuardPath() {
  // Standard-Installationspfade für WireGuard
  const possiblePaths = [
    'C:\\Program Files\\WireGuard\\wireguard.exe',
    'C:\\Program Files (x86)\\WireGuard\\wireguard.exe',
    'C:\\Program Files\\WireGuard\\bin\\wireguard.exe',
    'C:\\Program Files (x86)\\WireGuard\\bin\\wireguard.exe',
    // Prüfe auch das WireGuard-UI
    'C:\\Program Files\\WireGuard UI\\wireguard.exe',
    'C:\\Program Files (x86)\\WireGuard UI\\wireguard.exe',
    // Manche Nutzer installieren es in ihrem Nutzerverzeichnis
    path.join(app.getPath('home'), 'AppData\\Local\\WireGuard\\wireguard.exe'),
    path.join(app.getPath('home'), 'AppData\\Local\\Programs\\WireGuard\\wireguard.exe')
  ];

  // Prüfe die möglichen Pfade im Detail
  for (const possiblePath of possiblePaths) {
    try {
      if (fs.existsSync(possiblePath)) {
        console.log(`WireGuard gefunden unter: ${possiblePath}`);
        return possiblePath;
      }
    } catch (err) {
      // Ignoriere Fehler beim Prüfen der Pfade
    }
  }

  // Versuche, WireGuard im PATH zu finden
  try {
    console.log('Versuche WireGuard über where/which zu finden...');
    const { stdout } = require('child_process').execSync(
      process.platform === 'win32' ? 'where wireguard' : 'which wireguard', 
      { encoding: 'utf8' }
    );
    const pathLines = stdout.split('\n').map(line => line.trim()).filter(Boolean);
    if (pathLines.length > 0) {
      console.log(`WireGuard gefunden über PATH: ${pathLines[0]}`);
      return pathLines[0];
    }
  } catch (error) {
    console.log('WireGuard konnte nicht im PATH gefunden werden');
  }

  // Versuche, andere WireGuard-Tools zu finden, die mit dem Hauptprogramm im selben Verzeichnis sein könnten
  try {
    console.log('Versuche verwandte WireGuard-Tools zu finden...');
    const relatedTools = ['wg.exe', 'wg-quick.bat', 'wg-quick.exe'];
    
    for (const tool of relatedTools) {
      const result = require('child_process').execSync(`where ${tool}`, { encoding: 'utf8' }).trim();
      if (result) {
        const toolPath = result.split('\n')[0];
        const dir = path.dirname(toolPath);
        const possibleWireguardPath = path.join(dir, 'wireguard.exe');
        
        console.log(`Verwandtes Tool gefunden: ${toolPath}`);
        console.log(`Prüfe Hauptprogramm in: ${possibleWireguardPath}`);
        
        if (fs.existsSync(possibleWireguardPath)) {
          console.log(`WireGuard gefunden über verwandtes Tool: ${possibleWireguardPath}`);
          return possibleWireguardPath;
        }
      }
    }
  } catch (error) {
    console.log('Keine verwandten WireGuard-Tools gefunden');
  }

  // Standard-Befehlsname als Fallback (ohne Anführungszeichen, diese werden später hinzugefügt wenn nötig)
  console.log('Kein WireGuard-Pfad gefunden, verwende Standardbefehl "wireguard"');
  return 'wireguard';
}

// Wireguard-Ausführungspfad
let wireguardPath = getWireGuardPath();
console.log('Verwende WireGuard-Pfad:', wireguardPath);

// Verschlüsselungs-Setup
const ENCRYPTION_KEY = app.getPath('userData'); // Verwende den Pfad als Basis für einen deterministischen Schlüssel
const IV_LENGTH = 16; // Für AES wird ein 16-Byte IV benötigt

// Erzeuge Verschlüsselungsschlüssel und speichere ihn separat
// AES-256 benötigt einen 32-Byte-Schlüssel, also 64 Hex-Zeichen
const encryptionKeyHex = crypto
  .createHash('sha256')
  .update(ENCRYPTION_KEY)
  .digest('hex'); // SHA-256 erzeugt bereits 32 Bytes (64 Hex-Zeichen)

// Konfiguriere electron-store mit Verschlüsselung
const store = new Store({
  encryptionKey: encryptionKeyHex
});

let mainWindow;
let statusCheckInterval = null;
let tunnelStatus = {}; // Cache für Tunnel-Status

// Alternativer Tunnel-Manager für den Fall, dass wireguard.exe nicht gefunden wird
const tunnelUtils = require('./tunnel-utils');

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 700,
    webPreferences: {
      nodeIntegration: false, // Sicherheit: Deaktiviere nodeIntegration
      contextIsolation: true, // Sicherheit: Aktiviere Kontextisolierung
      enableRemoteModule: false, // Sicherheit: Deaktiviere Remote-Modul
      preload: path.join(__dirname, 'preload.js') // Verwende preload-Script
    },
    icon: path.join(__dirname, 'assets/icon.png')
  });

  // Lade entweder die Test-Seite oder die normale Anwendung
  if (isDebug) {
    console.log('Lade Testseite...');
    mainWindow.loadFile('test.html');
  } else {
    console.log('Lade Hauptanwendung...');
    
    // Prüfe, ob ein Dateipfad als Argument übergeben wurde
    let configPath = null;
    const args = process.argv.slice(isDebug ? 2 : 1); // Überspringe --debug wenn vorhanden
    
    for (const arg of args) {
      if (arg.endsWith('.conf') && fs.existsSync(arg)) {
        configPath = arg;
        break;
      }
    }
    
    if (configPath) {
      // Wenn eine Konfiguration als Argument übergeben wurde, direkt zum Import weiterleiten
      mainWindow.loadFile('index.html', { 
        query: { 'import': configPath } 
      });
    } else {
      mainWindow.loadFile('index.html');
    }
  }
  
  // Öffne DevTools zum Debuggen
  if (isDebug) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', function () {
    mainWindow = null;
    // Stoppe den Status-Check, wenn die App geschlossen wird
    if (statusCheckInterval) {
      clearInterval(statusCheckInterval);
      statusCheckInterval = null;
    }
  });
  
  // Starte die regelmäßige Tunnel-Status-Überwachung, außer im Debug-Modus
  if (!isDebug) {
    startTunnelStatusMonitoring();
  }
}

// Helferfunktionen für Verschlüsselung/Entschlüsselung
function encryptData(text) {
  // Sicherheitsprüfung: Falls text undefined oder null ist, einen leeren String verwenden
  if (text === undefined || text === null) {
    console.error('encryptData erhielt undefined oder null als Parameter');
    text = '';
  }
  
  // Erstelle einen zufälligen Initialisierungsvektor
  const iv = crypto.randomBytes(IV_LENGTH);
  // Erstelle Cipher mit AES-256-CBC
  const cipher = crypto.createCipheriv(
    'aes-256-cbc',
    Buffer.from(encryptionKeyHex, 'hex'),
    iv
  );
  
  // Verschlüssele den Text
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  // Gib IV + verschlüsselten Text zurück
  return iv.toString('hex') + ':' + encrypted;
}

function decryptData(text) {
  try {
    // Trenne IV und verschlüsselten Text
    const parts = text.split(':');
    if (parts.length !== 2) return text; // Falls nicht verschlüsselt
    
    const iv = Buffer.from(parts[0], 'hex');
    const encryptedText = parts[1];
    
    // Erstelle Decipher
    const decipher = crypto.createDecipheriv(
      'aes-256-cbc',
      Buffer.from(encryptionKeyHex, 'hex'),
      iv
    );
    
    // Entschlüssele
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    console.error('Entschlüsselungsfehler:', error);
    return text; // Fallback im Fehlerfall
  }
}

// Tunnel-Status-Überwachung
function startTunnelStatusMonitoring() {
  // Initialer Check beim Starten der App
  checkAllTunnelStatus();
  
  // Starte den Intervall für regelmäßige Checks (alle 10 Sekunden)
  statusCheckInterval = setInterval(checkAllTunnelStatus, 10000);
}

// Prüft den Status aller gespeicherten Tunnel
async function checkAllTunnelStatus() {
  if (!mainWindow) return;
  
  try {
    const configs = store.get('wireguard-configs', {});
    const configNames = Object.keys(configs);
    
    if (configNames.length === 0) return;
    
    // Überprüfe WireGuard-Dienststatus für alle bekannten Konfigurationen
    for (const configName of configNames) {
      checkTunnelStatus(configName);
    }
  } catch (error) {
    log.error('Fehler beim Prüfen der Tunnel-Status:', error);
  }
}

// Prüft den Status eines einzelnen Tunnels
function checkTunnelStatus(configName) {
  // Verwende Anführungszeichen nur wenn der Pfad Leerzeichen enthält
  const cmdPath = wireguardPath.includes(' ') ? `"${wireguardPath}"` : wireguardPath;
  
  exec(`${cmdPath} /tunnelstatus ${configName}`, (error, stdout, stderr) => {
    let isActive = false;
    
    if (!error && stdout.includes('Running')) {
      isActive = true;
    }
    
    // Nur senden, wenn sich der Status geändert hat oder es der erste Check ist
    if (tunnelStatus[configName] !== isActive) {
      tunnelStatus[configName] = isActive;
      
      if (mainWindow) {
        mainWindow.webContents.send('tunnel-status', { 
          success: true, 
          name: configName,
          active: isActive
        });
      }
    }
  });
}

app.whenReady().then(() => {
  // Debug-Modus-Status ausgeben
  console.log(`Debug-Modus: ${isDebug ? 'aktiviert' : 'deaktiviert'}`);
  
  // Prüfe, ob Administratorrechte vorhanden sind
  checkAdminRights();
  
  // WireGuard-Pfad abrufen (gibt direkt einen Wert zurück, kein Promise)
  wireguardPath = getWireGuardPath();
  console.log(`Verwende WireGuard-Pfad: ${wireguardPath}`);
  
  // Hauptfenster erstellen
  createWindow();
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', function () {
  if (mainWindow === null) createWindow();
});

// Wireguard Konfigurationen importieren
ipcMain.handle('import-config', async (event, directPath) => {
  let configPath;
  
  // Wenn ein direkter Pfad übergeben wurde
  if (directPath) {
    configPath = directPath;
  } else {
    // Öffne den Datei-Dialog, wenn kein Pfad angegeben wurde
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile'],
      filters: [
        { name: 'Wireguard Konfiguration', extensions: ['conf'] }
      ]
    });
    
    if (!result.canceled && result.filePaths.length > 0) {
      configPath = result.filePaths[0];
    } else {
      return { success: false, error: 'Keine Datei ausgewählt' };
    }
  }
  
  try {
    // Prüfen, ob die Datei existiert
    if (!fs.existsSync(configPath)) {
      return { success: false, error: `Datei existiert nicht: ${configPath}` };
    }
    
    // Datei als UTF-8 einlesen und auf Inhalt prüfen
    const configContent = fs.readFileSync(configPath, 'utf8');
    
    if (!configContent || configContent.trim() === '') {
      return { success: false, error: 'Die Konfigurationsdatei ist leer.' };
    }
    
    // Prüfe, ob es eine gültige WireGuard-Konfiguration ist (sollte [Interface] enthalten)
    if (!configContent.includes('[Interface]')) {
      return { success: false, error: 'Die Datei scheint keine gültige WireGuard-Konfiguration zu sein.' };
    }
    
    // Konfiguration verschlüsselt speichern
    const configName = path.basename(configPath, '.conf');
    const configs = store.get('wireguard-configs', {});
    
    // Speichern der verschlüsselten Konfiguration
    const encryptedConfig = encryptData(configContent);
    if (!encryptedConfig) {
      return { success: false, error: 'Fehler beim Verschlüsseln der Konfiguration.' };
    }
    
    configs[configName] = encryptedConfig;
    store.set('wireguard-configs', configs);
    
    // Direkt nach dem Import den Status dieses Tunnels prüfen
    checkTunnelStatus(configName);
    
    return { success: true, config: { name: configName } };
  } catch (error) {
    log.error('Fehler beim Importieren der Konfiguration:', error);
    return { success: false, error: `Fehler beim Lesen der Datei: ${error.message}` };
  }
});

// Wireguard Konfigurationen exportieren
ipcMain.handle('export-config', async (event, configName) => {
  const configs = store.get('wireguard-configs', {});
  const encryptedConfig = configs[configName];
  
  if (!encryptedConfig) {
    return { success: false, error: 'Konfiguration nicht gefunden' };
  }
  
  // Konfiguration entschlüsseln
  const configContent = decryptData(encryptedConfig);
  
  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'Wireguard Konfiguration exportieren',
    defaultPath: `${configName}.conf`,
    filters: [
      { name: 'Wireguard Konfiguration', extensions: ['conf'] }
    ]
  });
  
  if (!result.canceled && result.filePath) {
    fs.writeFileSync(result.filePath, configContent);
    return { success: true };
  }
  
  return { success: false };
});

// Alle gespeicherten Konfigurationen abrufen
ipcMain.handle('get-all-configs', () => {
  const configs = store.get('wireguard-configs', {});
  return Object.keys(configs).map(name => ({ 
    name,
    active: tunnelStatus[name] || false // Aktuellen Status zurückgeben
  }));
});

// Manuellen Check der Tunnel-Status auslösen
ipcMain.handle('check-tunnel-status', async (event, configName) => {
  // Falls ein spezifischer Tunnel überprüft werden soll
  if (configName) {
    checkTunnelStatus(configName);
    return { checking: true };
  } else {
    // Alle Tunnel überprüfen
    checkAllTunnelStatus();
    return { checking: true };
  }
});

// Wireguard Tunnel aktivieren
ipcMain.handle('activate-tunnel', async (event, configName) => {
  const configs = store.get('wireguard-configs', {});
  const encryptedConfig = configs[configName];
  
  if (!encryptedConfig) {
    return { success: false, error: 'Konfiguration nicht gefunden' };
  }
  
  // Konfiguration entschlüsseln
  let configContent = decryptData(encryptedConfig);
  
  // Prüfe, ob die Konfiguration den Tunnelnamen enthält
  if (!configContent.includes('[Interface]')) {
    return { success: false, error: 'Ungültige Konfiguration: Kein [Interface]-Abschnitt gefunden' };
  }
  
  // Stellen wir sicher, dass der Name korrekt ist, indem wir einen expliziten Namen setzen
  // Entferne alle nicht-alphanumerischen Zeichen außer - und _
  const sanitizedName = configName.replace(/[^a-zA-Z0-9\-_]/g, '');
  
  // Prüfe, ob die Konfiguration bereits einen Namen hat
  if (!configContent.includes('Name =')) {
    // Füge den Namen nach [Interface] hinzu
    configContent = configContent.replace('[Interface]', `[Interface]\nName = ${sanitizedName}`);
    console.log(`Konfiguration angepasst: Name = ${sanitizedName} hinzugefügt`);
  }
  
  // Temporäre Konfigurationsdatei erstellen mit eindeutigem Namen (Timestamp und zufälliger Wert)
  const timestamp = Date.now();
  const randomVal = Math.floor(Math.random() * 10000);
  const tempConfigPath = path.join(app.getPath('temp'), `${configName}-${timestamp}-${randomVal}.conf`);
  
  try {
    // Schreibe die Konfigurationsdatei
    fs.writeFileSync(tempConfigPath, configContent);
    console.log(`Temporäre Konfigurationsdatei erstellt: ${tempConfigPath}`);
    
    // Prüfe, ob die Datei wirklich existiert und lesbar ist
    try {
      const stat = fs.statSync(tempConfigPath);
      console.log(`Datei existiert und ist ${stat.size} Bytes groß`);
      
      // Versuche, den Inhalt zu lesen, um die Lesbarkeit zu testen
      const testContent = fs.readFileSync(tempConfigPath, 'utf8').substring(0, 20);
      console.log(`Datei lesbar, Beginn: ${testContent}...`);
    } catch (statErr) {
      console.error(`Fehler beim Prüfen der Datei: ${statErr.message}`);
      return { success: false, error: `Temporäre Datei existiert, ist aber nicht zugänglich: ${statErr.message}` };
    }

    // Prüfe, ob WireGuard existiert und im Pfad ist
    if (wireguardPath === 'wireguard' && !fs.existsSync(wireguardPath)) {
      // WireGuard scheint nicht im PATH zu sein, versuche alternative Methode
      console.log('wireguard.exe nicht gefunden, verwende alternative Aktivierungsmethode');
      
      try {
        const result = await tunnelUtils.activateTunnel(tempConfigPath);
        
        // Lösche die temporäre Datei erst nach dem Aktivierungsversuch
        try {
          fs.unlinkSync(tempConfigPath);
          console.log(`Temporäre Konfigurationsdatei gelöscht nach alternativer Aktivierung: ${tempConfigPath}`);
        } catch (delErr) {
          console.warn(`Konnte temporäre Datei nicht löschen: ${delErr.message}`);
        }
        
        if (!result.success) {
          mainWindow.webContents.send('tunnel-status', { 
            success: false, 
            name: configName, 
            error: result.error 
          });
          return { success: false, error: result.error };
        }
        
        // Tunnel wurde erfolgreich aktiviert
        tunnelStatus[configName] = true;
        mainWindow.webContents.send('tunnel-status', { 
          success: true, 
          name: configName,
          active: true
        });
        
        // Nach kurzer Verzögerung noch einmal den realen Status prüfen
        setTimeout(() => {
          tunnelUtils.checkTunnelStatus(configName).then(isActive => {
            tunnelStatus[configName] = isActive;
            mainWindow.webContents.send('tunnel-status', { 
              success: true, 
              name: configName,
              active: isActive
            });
          });
        }, 2000);
        
        return { success: true, pending: true };
      } catch (altError) {
        // Fehler bei der alternativen Methode
        console.error(`Fehler bei alternativer Aktivierungsmethode: ${altError.message}`);
        
        // Lösche die temporäre Datei im Fehlerfall
        try {
          fs.unlinkSync(tempConfigPath);
          console.log(`Temporäre Konfigurationsdatei gelöscht nach Fehler: ${tempConfigPath}`);
        } catch (delErr) {
          console.warn(`Konnte temporäre Datei nicht löschen: ${delErr.message}`);
        }
        
        return { success: false, error: `Alternative Aktivierungsmethode fehlgeschlagen: ${altError.message}` };
      }
    }
    
    // Die Standard-Methode mit wireguard.exe verwenden, wenn verfügbar
    // Verwende Anführungszeichen nur wenn der Pfad Leerzeichen enthält
    const cmdPath = wireguardPath.includes(' ') ? `"${wireguardPath}"` : wireguardPath;
    
    // Wireguard-Tunnel aktivieren (erfordert Administratorrechte)
    return new Promise((resolve) => {
      exec(`${cmdPath} /installtunnelservice "${tempConfigPath}"`, (error) => {
        // Lösche die temporäre Datei erst nach dem Aktivierungsversuch
        try {
          fs.unlinkSync(tempConfigPath);
          console.log(`Temporäre Konfigurationsdatei gelöscht nach Aktivierungsversuch: ${tempConfigPath}`);
        } catch (delErr) {
          console.warn(`Konnte temporäre Datei nicht löschen: ${delErr.message}`);
        }
        
        if (error) {
          console.error('Fehler bei Tunnel-Aktivierung:', error);
          // Wenn Standardmethode fehlschlägt, versuche alternative Methode
          // Datei wurde bereits gelöscht, also erstellen wir eine neue
          try {
            const newTempPath = path.join(app.getPath('temp'), `${configName}-${Date.now()}-alt.conf`);
            fs.writeFileSync(newTempPath, configContent);
            console.log(`Neue temporäre Konfigurationsdatei erstellt für alternative Methode: ${newTempPath}`);
            
            tunnelUtils.activateTunnel(newTempPath).then(result => {
              // Lösche die neue temporäre Datei nach dem alternativen Versuch
              try {
                fs.unlinkSync(newTempPath);
                console.log(`Neue temporäre Konfigurationsdatei gelöscht: ${newTempPath}`);
              } catch (delErr) {
                console.warn(`Konnte neue temporäre Datei nicht löschen: ${delErr.message}`);
              }
              
              if (!result.success) {
                mainWindow.webContents.send('tunnel-status', { 
                  success: false, 
                  name: configName, 
                  error: result.error || error.message
                });
                resolve({ success: false, error: result.error || error.message });
              } else {
                // Tunnel wurde erfolgreich aktiviert
                tunnelStatus[configName] = true;
                mainWindow.webContents.send('tunnel-status', { 
                  success: true, 
                  name: configName,
                  active: true
                });
                
                // Nach kurzer Verzögerung noch einmal den realen Status prüfen
                setTimeout(() => {
                  tunnelUtils.checkTunnelStatus(configName).then(isActive => {
                    tunnelStatus[configName] = isActive;
                    mainWindow.webContents.send('tunnel-status', { 
                      success: true, 
                      name: configName,
                      active: isActive
                    });
                  });
                }, 2000);
                
                resolve({ success: true, pending: true });
              }
            }).catch(altErr => {
              console.error('Fehler bei alternativer Methode:', altErr);
              resolve({ success: false, error: `Beide Aktivierungsmethoden fehlgeschlagen: ${error.message}, ${altErr.message}` });
            });
          } catch (fileErr) {
            console.error('Fehler beim Erstellen der neuen temporären Datei:', fileErr);
            resolve({ success: false, error: `Tunnel-Aktivierung fehlgeschlagen und alternative Methode konnte nicht vorbereitet werden: ${fileErr.message}` });
          }
        } else {
          // Status explizit auf "aktiv" setzen
          tunnelStatus[configName] = true;
          mainWindow.webContents.send('tunnel-status', { 
            success: true, 
            name: configName,
            active: true
          });
          
          // Nach kurzer Verzögerung noch einmal den realen Status prüfen
          setTimeout(() => {
            checkTunnelStatus(configName);
          }, 2000);
          
          resolve({ success: true, pending: true });
        }
      });
    });
  } catch (error) {
    // Versuche, die temporäre Datei im Fehlerfall zu löschen
    try {
      if (fs.existsSync(tempConfigPath)) {
        fs.unlinkSync(tempConfigPath);
        console.log(`Temporäre Konfigurationsdatei gelöscht im Fehlerfall: ${tempConfigPath}`);
      }
    } catch (delErr) {
      // Ignoriere Fehler beim Löschen
      console.warn(`Fehler beim Löschen der temporären Datei: ${delErr.message}`);
    }
    
    console.error(`Fehler beim Aktivieren des Tunnels: ${error.message}`);
    return { success: false, error: `Fehler beim Erstellen oder Aktivieren: ${error.message}` };
  }
});

// Wireguard Tunnel deaktivieren
ipcMain.handle('deactivate-tunnel', async (event, configName) => {
  try {
    // Prüfe, ob WireGuard existiert und im Pfad ist
    if (wireguardPath === 'wireguard' && !fs.existsSync(wireguardPath)) {
      // WireGuard scheint nicht im PATH zu sein, versuche alternative Methode
      console.log('wireguard.exe nicht gefunden, verwende alternative Deaktivierungsmethode');
      const result = await tunnelUtils.deactivateTunnel(configName);
      
      if (!result.success) {
        mainWindow.webContents.send('tunnel-status', { 
          success: false, 
          name: configName, 
          error: result.error 
        });
        return { success: false, error: result.error };
      }
      
      // Tunnel wurde erfolgreich deaktiviert
      tunnelStatus[configName] = false;
      mainWindow.webContents.send('tunnel-status', { 
        success: true, 
        name: configName,
        active: false
      });
      
      // Nach kurzer Verzögerung noch einmal den realen Status prüfen
      setTimeout(() => {
        tunnelUtils.checkTunnelStatus(configName).then(isActive => {
          tunnelStatus[configName] = isActive;
          mainWindow.webContents.send('tunnel-status', { 
            success: true, 
            name: configName,
            active: isActive
          });
        });
      }, 2000);
      
      return { success: true, pending: true };
    }
    
    // Die Standard-Methode mit wireguard.exe verwenden
    // Verwende Anführungszeichen nur wenn der Pfad Leerzeichen enthält
    const cmdPath = wireguardPath.includes(' ') ? `"${wireguardPath}"` : wireguardPath;
    
    // Wireguard-Tunnel deaktivieren (erfordert Administratorrechte)
    exec(`${cmdPath} /uninstalltunnelservice ${configName}`, (error) => {
      if (error) {
        // Wenn Standardmethode fehlschlägt, versuche alternative Methode
        tunnelUtils.deactivateTunnel(configName).then(result => {
          if (!result.success) {
            mainWindow.webContents.send('tunnel-status', { 
              success: false, 
              name: configName, 
              error: result.error || error.message 
            });
          } else {
            // Tunnel wurde erfolgreich deaktiviert
            tunnelStatus[configName] = false;
            mainWindow.webContents.send('tunnel-status', { 
              success: true, 
              name: configName,
              active: false
            });
            
            // Nach kurzer Verzögerung noch einmal den realen Status prüfen
            setTimeout(() => {
              tunnelUtils.checkTunnelStatus(configName).then(isActive => {
                tunnelStatus[configName] = isActive;
                mainWindow.webContents.send('tunnel-status', { 
                  success: true, 
                  name: configName,
                  active: isActive
                });
              });
            }, 2000);
          }
        });
      } else {
        // Status explizit auf "inaktiv" setzen
        tunnelStatus[configName] = false;
        mainWindow.webContents.send('tunnel-status', { 
          success: true, 
          name: configName,
          active: false
        });
        
        // Nach kurzer Verzögerung noch einmal den realen Status prüfen
        setTimeout(() => {
          checkTunnelStatus(configName);
        }, 2000);
      }
    });
    
    return { success: true, pending: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

/**
 * Prüft, ob die Anwendung mit Administratorrechten läuft.
 * Wenn nicht, wird eine Warnung ausgegeben.
 */
function checkAdminRights() {
  try {
    // Einfacher Test: Versuch, auf einen geschützten Verzeichnispfad zuzugreifen
    const testFile = path.join(process.env.windir, 'AdminRightsTest.tmp');
    try {
      fs.writeFileSync(testFile, 'Test');
      fs.unlinkSync(testFile);
      console.log('Anwendung läuft mit Administratorrechten');
      return true;
    } catch (e) {
      console.warn('Anwendung läuft NICHT mit Administratorrechten - WireGuard-Dienste können nicht installiert werden');
      console.warn('Bitte starten Sie die Anwendung als Administrator, um alle Funktionen nutzen zu können');
      
      // Zeige eine Warnung im Hauptfenster an, sobald es geladen ist
      app.on('browser-window-created', (event, window) => {
        window.webContents.on('did-finish-load', () => {
          window.webContents.send('admin-rights-warning', { 
            message: 'Die Anwendung läuft nicht mit Administratorrechten. Einige Funktionen könnten eingeschränkt sein.'
          });
        });
      });
      
      return false;
    }
  } catch (error) {
    console.error('Fehler beim Prüfen der Administratorrechte:', error);
    return false;
  }
} 