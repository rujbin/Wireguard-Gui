# Wireguard GUI für Windows 11

Eine benutzerfreundliche grafische Oberfläche für Wireguard unter Windows 11, mit der Sie einfach VPN-Konfigurationen importieren, exportieren und verwalten können.

## Funktionen

- Einfaches Importieren von Wireguard-Konfigurationsdateien (*.conf)
- Exportieren von gespeicherten Konfigurationen
- Aktivieren und Deaktivieren von Wireguard-Tunneln
- Echtzeitüberwachung des Tunnel-Status mit visuellen Indikatoren
- Moderne, benutzerfreundliche Oberfläche
- Sichere Speicherung: Alle Konfigurationen werden verschlüsselt gespeichert
- Hohe Sicherheitsstandards durch moderne Electron-Architektur

## Installation und Start

### Voraussetzungen
- [Node.js](https://nodejs.org/) (für die Ausführung der Anwendung erforderlich)
- [Wireguard für Windows](https://www.wireguard.com/install/) (für die Tunnel-Verwaltung erforderlich)

### Starten der Anwendung
Es gibt mehrere Möglichkeiten, die Anwendung zu starten:

1. **Einfacher Start:**
   - Doppelklick auf `start.bat`
   - Oder im Terminal: `start.bat`

2. **Mit direktem Import einer Konfiguration:**
   - Ziehen Sie eine .conf-Datei auf `start.bat`
   - Oder im Terminal: `start.bat C:\Pfad\zu\config.conf`

3. **Nur Import einer Konfiguration:**
   - Ziehen Sie eine .conf-Datei auf `import.bat`
   - Oder im Terminal: `import.bat C:\Pfad\zu\config.conf`

### Fehlerbehebung
Wenn Sie Probleme beim Starten der Anwendung haben:
1. Stellen Sie sicher, dass Node.js installiert ist und im PATH verfügbar ist
2. Überprüfen Sie, ob Sie Administratorrechte haben (für die Wireguard-Tunnelverwaltung erforderlich)
3. Bei Problemen mit dem direkten Import, versuchen Sie, die Konfiguration über die GUI-Schaltfläche "Konfiguration importieren" zu importieren

## Verwendung

1. Starten Sie die Anwendung
2. Klicken Sie auf "Konfiguration importieren" und wählen Sie eine .conf-Datei aus
3. Die importierte Konfiguration erscheint in der Liste
4. Der farbige Indikator zeigt an, ob ein Tunnel aktiv (grün) oder inaktiv (rot) ist
5. Klicken Sie auf "Aktivieren", um den Wireguard-Tunnel zu starten
6. Klicken Sie auf "Deaktivieren", um den Tunnel zu stoppen
7. Verwenden Sie "Exportieren", um eine Konfiguration zu speichern
8. Mit "Status aktualisieren" können Sie jederzeit manuell die Status aller Tunnel prüfen

## Sicherheitsfeatures

- **Verschlüsselte Speicherung**: Alle Wireguard-Konfigurationen werden lokal mit AES-256-CBC verschlüsselt
- **Kontextisolierung**: Verwendung des Electron-Preload-Patterns für sichere IPC-Kommunikation
- **Keine direkte Node.js-Integration**: Verhindert XSS-Angriffe und unbefugten Zugriff auf Node.js-APIs
- **Automatische Bereinigung**: Temporäre Konfigurationsdateien werden nach Verwendung sicher gelöscht

## Tunnel-Status Überwachung

Die Anwendung bietet folgende Tunnel-Überwachungsfunktionen:

- **Automatische Überwachung**: Prüft alle 10 Sekunden den Status aller Tunnel
- **Visuelle Indikatoren**: Grüne/rote Indikatoren zeigen den Tunnel-Status auf einen Blick
- **Manuelle Aktualisierung**: Tunnel-Status können jederzeit manuell aktualisiert werden
- **Statusbeibehaltung**: Die Anwendung merkt sich den Tunnel-Status auch nach Neustarten

## Hinweise

- Die Anwendung benötigt Administratorrechte, um Wireguard-Tunnel zu aktivieren und zu deaktivieren
- Ihre Konfigurationen werden lokal und verschlüsselt gespeichert

## Fehlerbehebung

### Tunnel kann nicht aktiviert werden

- Stellen Sie sicher, dass Wireguard für Windows installiert ist
- Starten Sie die Anwendung mit Administratorrechten
- Überprüfen Sie die Konfigurationsdatei auf Fehler

### Import funktioniert nicht

- Stellen Sie sicher, dass die Datei eine gültige Wireguard-Konfiguration ist (.conf)
- Überprüfen Sie, ob Sie Leserechte für die Datei haben

### Tunnel-Status wird nicht aktualisiert

- Klicken Sie auf "Status aktualisieren" in der oberen Leiste
- Stellen Sie sicher, dass Wireguard für Windows korrekt installiert ist
- Prüfen Sie, ob die Anwendung mit Administratorrechten läuft

## Lizenz

MIT

## Mitwirken

Beiträge sind willkommen! Bitte öffnen Sie ein Issue oder einen Pull Request.

## Alternative Importmethoden

Wenn Sie Probleme mit dem Start der Anwendung haben (z.B. weil Node.js nicht installiert ist), können Sie die folgenden alternativen Methoden verwenden:

### Direkter Import ohne GUI

Mit der `direct-import.bat`-Datei können Sie WireGuard-Konfigurationen direkt importieren, ohne die GUI zu starten:

```
direct-import.bat C:\Pfad\zu\config.conf
```

Diese Methode verwendet direkt das WireGuard-Kommandozeilentool und erfordert nur eine WireGuard-Installation.

### Tunnel-Verwaltung ohne GUI

Mit der `manage-tunnel.bat`-Datei können Sie WireGuard-Tunnel direkt von der Kommandozeile aus verwalten:

```
manage-tunnel.bat list                 # Listet alle verfügbaren Tunnel auf
manage-tunnel.bat status TUNNELNAME    # Zeigt den Status eines Tunnels an
manage-tunnel.bat activate TUNNELNAME  # Aktiviert einen Tunnel
manage-tunnel.bat deactivate TUNNELNAME # Deaktiviert einen Tunnel
```

Auch hier ist nur eine WireGuard-Installation erforderlich, keine Node.js-Installation.

---

Entwickelt mit ❤️ für die Wireguard-Community. 