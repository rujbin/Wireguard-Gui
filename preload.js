const { contextBridge, ipcRenderer } = require('electron');

// Stelle eine sichere API zur Verfügung, die vom Renderer-Prozess genutzt werden kann
contextBridge.exposeInMainWorld('electronAPI', {
  // Konfigurationen
  importConfig: (path) => ipcRenderer.invoke('import-config', path),
  exportConfig: (configName) => ipcRenderer.invoke('export-config', configName),
  getAllConfigs: () => ipcRenderer.invoke('get-all-configs'),
  
  // Tunnel-Verwaltung
  activateTunnel: (configName) => ipcRenderer.invoke('activate-tunnel', configName),
  deactivateTunnel: (configName) => ipcRenderer.invoke('deactivate-tunnel', configName),
  
  // Tunnel-Status-Überwachung
  checkTunnelStatus: (configName) => ipcRenderer.invoke('check-tunnel-status', configName),
  
  // Event-Listener
  onTunnelStatus: (callback) => {
    ipcRenderer.on('tunnel-status', (event, ...args) => callback(...args));
    
    // Aufräumfunktion zurückgeben (wichtig für React useEffect)
    return () => {
      ipcRenderer.removeAllListeners('tunnel-status');
    };
  },
  // Admin-Rechte-Warnung listener
  onAdminRightsWarning: (callback) => {
    ipcRenderer.on('admin-rights-warning', (event, data) => callback(data));
  }
}); 