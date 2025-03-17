const { app, BrowserWindow } = require('electron');
const path = require('path');

// Erstelle ein einfaches Anwendungsfenster
function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 900,
    height: 700,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  // Lade eine einfache HTML-Datei
  mainWindow.loadFile('simple.html');
  
  // Öffne DevTools
  mainWindow.webContents.openDevTools();
}

// Erstelle das Fenster, wenn die App bereit ist
app.whenReady().then(() => {
  createWindow();
  
  // MacOS-spezifisch: Öffne ein neues Fenster, wenn kein Fenster geöffnet ist und auf das Dock-Icon geklickt wird
  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// Beende die App, wenn alle Fenster geschlossen sind (außer auf macOS)
app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
}); 