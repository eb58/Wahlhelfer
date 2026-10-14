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

Welche Kalibrierung im Einsatz gilt, steht in `configuration.js` – pro Wahl einmal setzen.
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
werden. Bestätigte lokale Stimmenwertungen bleiben bis zur Serverbestätigung im Browser
gespeichert. Jede Aufnahme wird im Browser auf 1600 Pixel Breite als JPEG verkleinert (rund 0,5 MB
statt 3 MB); genau dieses Bild wird erkannt, vor dem Stapel einzeln hochgeladen und als Beleg
dauerhaft gespeichert. Der Browser puffert Ergebnisse und Dateien in IndexedDB.

## Server und Datenbank

Die Server-API ist in PHP geschrieben (PHP 8.1 oder neuer, PDO MySQL, mbstring) und läuft
auf normalem Webhosting mit Apache und MariaDB – dieselbe Zielumgebung wie Mitgliederverwaltung
und Gratulationsdienst (Strato, MariaDB 11.8). MySQL 8 funktioniert ebenso. Die API liegt unter
`server/` und wird beim Hoster als `php-api/` neben das gebaute Frontend gelegt:

```text
wahlassistent/                           Inhalt von dist/ plus configuration.js
wahlassistent/php-api/                   index.php, lib.php, config.php, schema.sql, .htaccess
wahlassistent/php-api/config.local.php   Zugangsdaten, nur beim Hoster
wahlassistent/php-api/bilder/            Originalbelege, legt die API selbst an
```

Das Frontend spricht `php-api/index.php/api/…` relativ an; für das Routing braucht es kein
`mod_rewrite`, wohl aber für die Zugriffssperre in `php-api/.htaccess` (bei Strato vorhanden).
Die GitHub-Pages-Version hat keine API und kann deshalb keine Stapel speichern.
Die API liest wie der Browser aus `configuration.js`, welche Kalibrierung gilt, und übernimmt
daraus nur die fachlichen Wahlvorschläge.

| Methode | Pfad | Zweck |
|---|---|---|
| `GET` | `/api/wahllokale` | registrierte Wahllokale und Hash der Wahl |
| `POST` | `/api/wahllokale` | Wahllokal registrieren |
| `PUT` | `/api/bilder/{sha256}` | Beleg hochladen (Rohdaten, `Content-Type` des Bildes) |
| `POST` | `/api/stapel` | vollständigen Stapel übertragen; Zettel verweisen per Hash auf ihre Belege |
| `GET` | `/api/ergebnisse` | Summen je Stapel, Wahllokal und insgesamt |
| `GET` | `/api/stimmzettel/{id}/bild` | Beleg eines Zettels |
| `GET` | `/health` | Datenbank erreichbar? `tokenReceived` zeigt, ob der Zugang ankommt |

Alle `/api`-Aufrufe brauchen den Zugangsschlüssel (`Authorization: Bearer …`, zusätzlich als
`X-Auth-Token`, weil manche Hoster `Authorization` nicht an PHP durchreichen). Schreibende
Aufrufe von einer fremden Website werden abgelehnt.

Belege gehen bewusst einzeln und nicht als Base64 im Stapel an den Server: ein Stapel mit 20
Handyfotos wäre sonst über 100 MB JSON und sprengte das Speicherlimit von PHP. Der Server
prüft Hash und Dateityp jedes Belegs, legt ihn unter seinem SHA-256 ab und nimmt einen Stapel
nur an, wenn alle Belege vorliegen. Ein erneuter Upload derselben Datei ist harmlos.

Unter `ergebnisse.html` zuerst Wahllokale mit erwarteter Stimmzettelzahl registrieren. Auf der
Startseite Wahllokal und Stapelgröße wählen (Standard: 20). Jede Aufnahme prüfen und zum Stapel
hinzufügen. Bei vollständigem Stapel den leeren Eingangsstapel bestätigen und übertragen. Bei
Fehlern bleiben die Daten erhalten; derselbe Stapel kann ohne zusätzliche Zählung erneut
gesendet werden. Ein Browserprofil bearbeitet jeweils einen aktiven Stapel.

Die Übersicht zeigt vorläufige Erkennungssummen je Stapel, Wahllokal und insgesamt sowie
fehlende Zettel und Prüffälle. Die Wahllokalansicht für den Wahlvorsteher ist direkt verlinkt,
z. B. `ergebnisse.html?wahllokal=518`, und aktualisiert sich alle 15 Sekunden. Den Schlüssel
auf beiden Seiten unter „Serverzugang“ eingeben; er bleibt für die Browsersitzung gespeichert und
berechtigt im Prototyp zur Erfassung, Registrierung und Ergebniseinsicht. Getrennte Rollen folgen
später. Es gibt noch keine unabhängige Bild-Gegenprüfung, QR-Erkennung oder protokollierte
Endentscheidung des Wahlvorstands. Eine übergebene `kennung` wird bereits gegen Doppelzählung
geprüft; das ersetzt noch nicht das autoritative Verzeichnis ausgegebener QR-Kennungen.

Das [Datenmodell](docs/Datenmodell.md) hat vier Tabellen: `wahllokal`, `stapel`, `wahlvorschlag`
und `stimmzettel`. Das zusammengehörige Ergebnis eines Zettels steht als fachliches JSON
in `stimmzettel.ergebnis`. Gespeichert werden keine Koordinaten, Kalibrierungen oder Feldmessungen.
Das SQL-Schema liegt unter `server/schema.sql`; die API legt die Tabellen beim ersten Zugriff
selbst an und trägt die Wahlvorschläge ein. Enthält die Datenbank schon andere Wahlvorschläge,
verweigert sie den Betrieb: **jede neue Wahl braucht eine eigene, leere Datenbank** (bei Strato
zählt jede gegen das Datenbank-Kontingent des Pakets; alte Wahlen nach der Sicherung löschen).

Aufnehmen lassen sich PNG, JPEG, WebP, GIF und PDF (erkannt wird die erste Seite). Gespeichert
wird immer der verkleinerte Beleg als JPEG; die API nimmt bis 20 MB je Beleg an, auch ältere
PNG- und PDF-Belege bleiben abrufbar.

### Installation beim Hoster

1. Beim Hoster eine leere MariaDB-Datenbank anlegen (je Wahl eine eigene).
2. `npm run deploy` baut und lädt per SSH hoch (`server/deploy.ps1`). Die Standardziele
   (Strato-Zugang, `-Webroot Seniorenclub`, `-AppPath wahlassistent`) stammen aus der
   Mitgliederverwaltung; andere Ziele z. B. mit `npm run deploy -- -Webroot <ordner>`. Mit
   `-SkipUpload` entsteht nur das Paket unter `.deploy/`. `config.local.php` und `bilder/` beim
   Hoster bleiben dabei unangetastet.
3. Beim ersten Mal `server/config.local.example.php` als `php-api/config.local.php` ablegen und
   DB-Zugangsdaten sowie den Zugangsschlüssel eintragen (mindestens 24 Zeichen), etwa erzeugt mit
   `php -r "echo bin2hex(random_bytes(32));"`.
4. Prüfen:
   `curl -H "Authorization: Bearer <schluessel>" https://<domain>/<app>/php-api/index.php/health`
   muss `{"status":"ok","tokenReceived":true}` liefern.

`php-api/.htaccess` sperrt alles außer `index.php`; der Belegordner erhält zusätzlich eine eigene
`.htaccess` mit `Require all denied`. Wer die Belege lieber außerhalb des Webroots ablegt, setzt
`bilder_path` in `config.local.php`. Für eine vollständige Sicherung werden DB-Export und
Belegordner benötigt.

### Lokale Entwicklung (Docker)

Docker Desktop mit Linux-Containern starten. `compose.yaml` betreibt drei Dienste:

- `wahlassistent`: Apache mit PHP 8.4, erreichbar unter `http://localhost:3000/`
  (Übersicht: `/ergebnisse.html`, Wahllokalansicht z. B. `/ergebnisse.html?wahllokal=518`).
- `db`: MariaDB 11.4, Daten im Volume `mariadb_daten`, nur im internen Docker-Netz erreichbar.
- `phpmyadmin`: `http://localhost:8082/`, nur an `127.0.0.1` gebunden.

Das Image enthält nur Apache und PHP. Das Projekt wird schreibgeschützt eingebunden: Apache
liefert `dist/` als Webroot und `server/` unter `/php-api` aus, also derselbe Aufbau wie beim
Hoster. Wie bei Gratulationsdienst und Mitgliederverwaltung schreibt der Build direkt in das
ausgelieferte Verzeichnis:

```powershell
npm run watch
```

Änderungen an `server/` wirken ohne Neustart. Die Belege liegen im Volume `belegbilder`
unter `/data/bilder`. Für eine vollständige Sicherung werden DB-Export und dieses Volume benötigt.

Ersteinrichtung:

```powershell
Copy-Item .env.example .env
php -r "echo bin2hex(random_bytes(32));"
```

Den Schlüssel als `WAHLASSISTENT_TOKEN` in `.env` eintragen, ebenso je ein zufälliges
`DB_PASSWORD` und `DB_ROOT_PASSWORD` sowie `DB_NAME` für die Wahl. Datenbank und Benutzer
einmalig anlegen (auch für jede weitere Wahl, mit neuem `DB_NAME`):

```powershell
docker compose up -d db
docker compose exec db mariadb -uroot -p<DB_ROOT_PASSWORD> -e "CREATE DATABASE IF NOT EXISTS <db_name> CHARACTER SET utf8mb4 COLLATE utf8mb4_bin; CREATE USER IF NOT EXISTS 'wahlassistent'@'%' IDENTIFIED BY '<DB_PASSWORD>'; GRANT ALL PRIVILEGES ON <db_name>.* TO 'wahlassistent'@'%';"
docker compose up --build -d
```

Die Tabellen legt die API beim ersten Aufruf selbst an. `npm run dev` und `npm run dev:source`
leiten `php-api/` an den Container auf Port 3000 weiter. Über `npm run dev:lan` per
`http://<IP>:5173` lässt sich auf dem Smartphone nur die Erkennung testen: ohne HTTPS fehlt dem
Browser `crypto.subtle`, Wahlabgleich und Stapelübertragung brauchen einen sicheren Ursprung
(HTTPS oder `localhost`).

`docker compose down` erhält die Daten; `down -v` löscht die Volumes samt Wahldaten und Belegen.

## Fiktives Wahllokal 518

```powershell
$env:WAHLASSISTENT_TOKEN = '<WAHLASSISTENT_TOKEN aus .env>'
node scripts/fuelleDemoWahllokal.js
```

Die API (Standard: lokaler Container auf Port 3000, sonst `WAHLASSISTENT_URL`) erhält über ihre normalen
Endpunkte 500 fiktive Stimmzettel in 25 Stapeln zu je 20 Zetteln. Vorhandene synthetische
Scan-Vorlagen werden tatsächlich erkannt und als Belege zu den passenden Ergebnissen gespeichert;
dieselben Vorlagen werden mehrfach verwendet. Es sind keine echten Stimmzettelfotos. Das
Wahllokal heißt ausdrücklich „Fiktives Testwahllokal 518 – synthetische Belege“. Existiert die
Nummer 518 bereits, bricht das Skript vor Änderungen ab.

## Tests

```powershell
npm test
npm run test:php
```

`npm test` prüft Erkennung und Oberfläche. `npm run test:php` lädt einmalig PHPUnit, fährt eine
flüchtige MariaDB (`wa-test-db`, Port 3308) hoch und prüft die API: reine Logik ohne Datenbank,
dazu jede Route gegen die echte Datenbank – Wiederholungsuploads, Zurückrollen fehlerhafter
Stapel, Belegprüfung, Zugang, Wahllokalregistrierung und UTF-8. Ohne Docker laufen nur die
Logiktests, mit deutlicher Warnung. Stoppen: `npm run test:php:db:down`.
Der Wahl-Hash muss in Browser und PHP byteweise gleich sein; `test/wahl.test.js` und
`test/php/WahlTest.php` prüfen dieselben Werte.
