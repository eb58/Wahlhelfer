# Wahlassistent

Scan-gestützte Auszählung von Papierstimmzetteln: Stimmzettel fotografieren, Markierungen
prüfen lassen, Zweifelsfälle dem Wahlvorstand vorlegen. Das Papier bleibt das Original.

## Kalibrierung

Je Zettelart liegt unter `Kalibrierungen/` eine Datei, die am leeren Musterzettel **von Hand
vermessen** wurde: Rahmenlinien, Textmarken, Radius der Ankreuzfelder und je Stimme die Feldlagen samt
Beschriftung. Die Anwendung sucht keine Ankreuzfelder – sie liest, wo sie stehen. Eine lokale
OCR gleicht die Textmarken ab und korrigiert die Feldlage mit einer affinen Transformation.
Dafür werden nur kleine, unverkleinerte Streifen um die erwarteten Textmarken verarbeitet.

Eine Kalibrierung sichtbar prüfen (zeichnet die Feldlagen in den Musterzettel):

```powershell
python scripts/pruefeKalibrierung.py Kalibrierungen/europawahl-sh-2024.json pruefung-tmp.png
```

Ob die lokale OCR alle Textmarken der Musterzettel findet:

```powershell
npm run pruefe:ocr
```

Welche Kalibrierung im Einsatz gilt, steht in `konfiguration.js` – pro Wahl einmal setzen.
Im Wahllokal selbst gibt es nichts auszuwählen.

## Entwicklung und Build

Die gebündelte Anwendung lokal auf Port 5173 starten:

```powershell
npm run dev
```

Zum Testen mit einem Smartphone im selben WLAN:

```powershell
# Erstes PowerShell-Fenster:
npm run dev:lan
# Zweites PowerShell-Fenster:
ipconfig
```

Dann auf dem Smartphone `http://<IPv4-Adresse-des-PCs>:5173` öffnen. Die IPv4-Adresse steht bei
`ipconfig` unter dem aktiven WLAN- oder Ethernet-Adapter. Falls Windows beim ersten Start nach
der Firewall fragt, den Zugriff im privaten Netzwerk erlauben.

Für die Entwicklung mit einzelnen Modulen und Hot Reload:

```powershell
npm run dev:source
```

Produktions-Build erzeugen:

```powershell
npm run build
```

Der Build liegt anschließend unter `dist/`. `npm run dev` prüft ihn lokal bereits über den
Produktions-Preview. Alternativ lässt er sich separat prüfen:

```powershell
npm run preview
```

Auf einem Smartphone sollte die Seite für den produktiven Einsatz über HTTPS bereitgestellt
werden. Aufnahmen bleiben im Browser: nichts wird hochgeladen oder gespeichert.

## Tests

```powershell
npm test
```
