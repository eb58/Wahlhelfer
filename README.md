# Wahlassistent

Scan-gestützte Auszählung von Papierstimmzetteln: Stimmzettel fotografieren, Markierungen
prüfen lassen, Zweifelsfälle dem Wahlvorstand vorlegen. Das Papier bleibt das Original.

## Kalibrierung

Je Zettelart liegt unter `Kalibrierungen/` eine Datei, die am leeren Musterzettel **von Hand
vermessen** wurde: Rahmenlinien, Radius der Ankreuzfelder und je Stimme die Feldlagen samt
Beschriftung. Die Anwendung sucht keine Ankreuzfelder – sie liest, wo sie stehen.

Eine Kalibrierung sichtbar prüfen (zeichnet die Feldlagen in den Musterzettel):

```powershell
python scripts/pruefeKalibrierung.py Kalibrierungen/europawahl-sh-2024.json pruefung-tmp.png
```

Welche Kalibrierung im Einsatz gilt, steht in `konfiguration.js` – pro Wahl einmal setzen.
Im Wahllokal selbst gibt es nichts auszuwählen.

## Starten

Die Dateien mit einem beliebigen lokalen Webserver ausliefern:

```powershell
python -m http.server 8000
```

Danach `http://localhost:8000` öffnen. Auf einem Smartphone sollte die Seite für den
produktiven Einsatz über HTTPS bereitgestellt werden. Aufnahmen bleiben im Browser: nichts
wird hochgeladen oder gespeichert.

## Tests

```powershell
npm test
```
