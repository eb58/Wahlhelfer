# PHP-Serverkomponente

Die API nimmt einen Musterwahlzettel und die zugehörige exportierte Kalibrierung (`wahlzettelTyp.json`) gemeinsam entgegen. Die Daten werden als Paar im Verzeichnis `server-data` abgelegt.

## Start

```powershell
php -S 127.0.0.1:3000 server/index.php
```

Alternativ kann das Datenverzeichnis über `WAHLASSISTENT_DATEN` gesetzt werden.

## Upload

```powershell
curl.exe -X POST http://127.0.0.1:3000/api/kalibrierungen `
  -F "muster=@Testdaten/Wahlzettel1-hochaufloesend.png" `
  -F "kalibrierung=@Testdaten/wahlzettelTyp.json;type=application/json"
```

Die Antwort enthält eine zufällige ID. Verfügbare Routen:

- `GET /api/kalibrierungen` – alle hochgeladenen Kalibrierungen
- `GET /api/kalibrierungen/{id}` – Metadaten
- `GET /api/kalibrierungen/{id}/muster` – Musterbild
- `GET /api/kalibrierungen/{id}/kalibrierung` – Kalibrierungs-JSON
