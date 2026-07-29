# Kamera-Web-App

Eine kleine mobile Web-App, die über den Browser die Smartphone-Kamera öffnet und
das aufgenommene Foto anschließend als Vorschau anzeigt.

## Starten

Die Dateien können mit einem beliebigen lokalen Webserver ausgeliefert werden, zum
Beispiel:

```powershell
python -m http.server 8000
```

Danach `http://localhost:8000` öffnen. Auf einem Smartphone sollte die Seite für
den produktiven Einsatz über HTTPS bereitgestellt werden.

Das Bild wird nur im Browser angezeigt und nicht hochgeladen oder gespeichert.
