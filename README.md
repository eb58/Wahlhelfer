# Wahlassistent

Scan-gestützte Auszählung von Papierstimmzetteln: Stimmzettel fotografieren, Markierungen
prüfen lassen, Zweifelsfälle dem Wahlvorstand vorlegen. Das Papier bleibt das Original.

## Kalibrierung

Je Wahl liegt unter `Wahlen/<wahl>/` eine `kalibrierung.json`, die am leeren Musterzettel **von Hand
vermessen** wurde: Rahmenlinien, Radius der Ankreuzfelder und je Stimme die Feldlagen samt
Beschriftung. Die Anwendung sucht keine Ankreuzfelder – sie liest, wo sie stehen. Bei Fotos
richten die gedruckten Ankreuzringe die Feldlage aus; findet sich keine sichere Ringlage, wird
die Aufnahme abgelehnt statt geraten.

Eine Kalibrierung sichtbar prüfen (zeichnet die Feldlagen in den Musterzettel):

```powershell
python scripts/pruefeKalibrierung.py Wahlen/bvv-reinickendorf-2026/kalibrierung.json pruefung-tmp.png
```

Das Skript zeichnet mit der Python-Bildbibliothek Pillow; einmalig `pip install pillow`.

Daneben liegen der Musterzettel, eine Druckvorlage und `gebiet.json` mit Wahlkreisen und
Wahlbezirken (= Wahllokalen). Welche Wahl im Einsatz gilt, steht in `configuration.js` (`WAHL`) –
pro Wahl einmal setzen.
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

Dann auf dem Smartphone `https://<IPv4-Adresse-des-PCs>:5173/erfassungsplatz/?wahllokal=518` öffnen und die
Warnung zum selbst signierten Zertifikat einmal bestätigen (Chrome: *Erweitert* → *Weiter zu …*).
Die IPv4-Adresse steht bei `ipconfig` unter dem aktiven WLAN-Adapter – nicht die `172.…`-Adresse
von WSL/Hyper-V. Falls Windows beim ersten Start nach der Firewall fragt, den Zugriff im privaten
Netzwerk erlauben.

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
wahlassistent/php-api/bilder/            Originalbelege als <sha256>.jpg/.png, legt die API selbst an
```

Das Frontend spricht `php-api/index.php/api/…` relativ an; für das Routing braucht es kein
`mod_rewrite`, wohl aber für die Zugriffssperre in `php-api/.htaccess` (bei Strato vorhanden).
Die GitHub-Pages-Version hat keine API und kann deshalb keine Stapel speichern.
Die API liest wie der Browser aus `configuration.js`, welche Wahl gilt, und übernimmt
daraus nur die fachlichen Wahlvorschläge.

| Methode | Pfad | Zweck |
|---|---|---|
| `POST` | `/api/session` | anmelden (`username`, `password`), liefert Sitzungstoken und Konto |
| `GET` | `/api/session` | angemeldetes Konto |
| `DELETE` | `/api/session` | abmelden |
| `POST` | `/api/session/password` | eigenes Passwort ändern (`currentPassword`, `newPassword`) |
| `GET` | `/api/wahllokale` | registrierte Wahllokale mit Fortschritt (Zähler, keine Stimmen) und Hash der Wahl |
| `POST` | `/api/wahllokale` | Wahllokal registrieren (nur Admin) |
| `PUT` | `/api/bilder/{sha256}` | Beleg hochladen (Rohdaten, `Content-Type` des Bildes) |
| `POST` | `/api/stapel` | vollständigen Stapel übertragen; Zettel verweisen per Hash auf ihre Belege |
| `GET` | `/api/ergebnisse` | Summen je Wahllokal und insgesamt, je Stapel nur Zähler (nur Admin) |
| `GET` | `/api/stapel/{id}` | ein Stapel mit Summen und allen Belegen (nur Admin) |
| `GET` | `/api/prueffaelle` | alle Zettel mit leerer, mehrfacher oder unklarer Stimme (nur Admin) |
| `GET` | `/api/stimmzettel/{id}/bild` | Beleg eines Zettels (nur Admin) |
| `GET` | `/health` | Datenbank erreichbar? `tokenReceived` zeigt, ob das Token ankommt |

Außer der Anmeldung brauchen alle `/api`-Aufrufe das Sitzungstoken (`Authorization: Bearer …`,
zusätzlich als `X-Auth-Token`, weil manche Hoster `Authorization` nicht an PHP durchreichen).
Schreibende Aufrufe von einer fremden Website werden abgelehnt.

### Konten und Rollen

Jede Person hat ein eigenes Konto, wie bei Mitgliederverwaltung und Gratulationsdienst:

| Rolle | darf |
|---|---|
| `admin` | ControlCenter: Wahllokale registrieren, alle Ergebnisse und Belege sehen; Erfassungsplatz für jedes Wahllokal |
| `wahlvorstand` | nur Erfassungsplatz, nur im eigenen Wahllokal; sieht dort den Fortschritt, aber keine Ergebnisse oder Belege |

Jeder Stapel merkt sich, mit welchem Konto er übertragen wurde (`stapel.erfasst_von`). Solange
die Datenbank noch kein einziges Konto hat, bietet das ControlCenter an, das erste Admin-Konto
anzulegen; wer das tut, ist gleich angemeldet. Deshalb das ControlCenter direkt nach dem ersten
Deploy aufrufen. Alle weiteren Konten legt vorerst ein Skript an; eine Kontenverwaltung im
ControlCenter kann später folgen:

```text
php create-user.php <name> <passwort> admin
php create-user.php <name> <passwort> wahlvorstand <wahllokal>
php create-user.php <name> --sperren
```

Das Passwort gilt nur für die erste Anmeldung und muss dann geändert werden (mindestens 12
Zeichen). Derselbe Aufruf setzt ein vergessenes Passwort zurück oder entsperrt ein Konto; dabei
enden alle Sitzungen des Kontos. Eine Sitzung gilt 12 Stunden, also einen Wahlabend lang. Nach
10 Fehlversuchen je Name bzw. 20 je IP innerhalb von 15 Minuten ist die Anmeldung gesperrt. Die
Fehlermeldung verrät nicht, ob es den Namen gibt.

Bei Strato ist `php` in der Shell die CGI-Variante. Sie gibt ohne `-q` HTTP-Kopfzeilen aus und
reicht die Argumente nur mit `-d register_argc_argv=1` weiter, also z. B.
`php -q -d register_argc_argv=1 create-user.php <name> <passwort> wahlvorstand <wahllokal>`.

Belege gehen bewusst einzeln und nicht als Base64 im Stapel an den Server: ein Stapel mit 20
Handyfotos wäre sonst über 100 MB JSON und sprengte das Speicherlimit von PHP. Der Server
prüft Hash und Dateityp jedes Belegs, legt ihn unter seinem SHA-256 ab und nimmt einen Stapel
nur an, wenn alle Belege vorliegen. Ein erneuter Upload derselben Datei ist harmlos.

Die Anwendung besteht aus zwei getrennten Teilen in eigenen Ordnern, ohne Verweise aufeinander:
dem **Erfassungsplatz** (`src/erfassungsplatz/`) für die Wahlhelfer im Wahllokal und dem
**ControlCenter** (`src/controlcenter/`) für das Wahlamt, nur für Admins. Beide sprechen über
`src/api/` mit der PHP-API in `server/`.

Im ControlCenter unter *Verwaltung* zuerst die Wahllokale registrieren – einzeln oder als CSV (`Nummer;Name`). Zunächst sortieren die Wahlhelfer alle Stimmzettel in Stapel und zählen sie. Erst danach trägt der Wahlvorsteher die ermittelte Gesamtzahl als `erwartet` am Erfassungsplatz ein und meldet sie an das ControlCenter. Anschließend beginnt die Erfassung der einzelnen Stapel. `erwartet` ist die tatsächlich vorab gezählte Gesamtzahl, keine Schätzung. Jedes Wahllokal
bekommt einen eigenen Link, z. B. `…/erfassungsplatz/?wahllokal=518` – als Link oder QR-Code für die Wahlhelfer
vor Ort. Am Erfassungsplatz wird kein Wahllokal ausgewählt; ohne Wahllokal im Link wird nicht
erfasst. Nach der Anmeldung nur die Stapelgröße eintragen (Standard: 20), dann jede Aufnahme
prüfen und zum Stapel hinzufügen. Bei vollständigem Stapel den leeren Eingangsstapel bestätigen und übertragen. Bei
Fehlern bleiben die Daten erhalten; derselbe Stapel kann ohne zusätzliche Zählung erneut
gesendet werden. Ein Browserprofil bearbeitet jeweils einen aktiven Stapel.

Am Seitenende zeigt der Erfassungsplatz den Monitor des Wahllokals: Status,
erfasste von gemeldeten Zetteln, Stapel und Prüffälle über alle Erfassungsplätze, Aktualisierung
alle 15 Sekunden. Stimmen und Belege zeigt er nicht.

Das ControlCenter ist für das Monitoring von 100–150 Wahllokalen gebaut: links die Navigation,
rechts die Ansichten, alle 15 Sekunden aktualisiert.

| Ansicht | Inhalt |
|---|---|
| Dashboard | Kennzahlen, Fortschritt und Status aller Wahllokale, Kachelkarte, vorläufiges Ergebnis, Handlungsbedarf (über Soll, seit 30 Minuten kein Stapel), letzte Eingänge |
| Wahllokale | Tabelle mit Suche, Statusfilter und Sortierung; Klick öffnet das Wahllokal mit Ergebnis, Stapeln und Belegen |
| Ergebnisse | vorläufiges Ergebnis je Stimme, Tabelle Wahllokal × Wahlvorschlag mit Summenzeile, CSV-Export |
| Prüffälle | alle Zettel mit leerer, mehrfacher oder unklarer Stimme, mit Beleg |
| Eingänge | alle Stapel, neueste zuerst, mit Konto |
| Verwaltung | Wahllokale registrieren und als CSV importieren |

Die Tabellen sind AG Grid (wie in der Mitgliederverwaltung). Belege eines Stapels und die
Prüffälle lädt das ControlCenter erst, wenn sie angezeigt werden. Beide Seiten zeigen ohne Anmeldung nur das
Anmeldeformular; die Sitzung gilt für den Browser-Tab. Ein Wahlvorstand wird im ControlCenter
abgewiesen, auch die API liefert ihm Ergebnisse und Belege nicht (403). Es gibt noch keine unabhängige Bild-Gegenprüfung, QR-Erkennung oder protokollierte
Endentscheidung des Wahlvorstands. Eine übergebene `kennung` wird bereits gegen Doppelzählung
geprüft; das ersetzt noch nicht das autoritative Verzeichnis ausgegebener QR-Kennungen.

Das [Datenmodell](docs/Datenmodell.md) hat vier Tabellen: `wahllokal`, `stapel`, `wahlvorschlag`
und `stimmzettel`. Das zusammengehörige Ergebnis eines Zettels steht als fachliches JSON
in `stimmzettel.ergebnis`. Gespeichert werden keine Koordinaten, Kalibrierungen oder Feldmessungen.
Das SQL-Schema liegt unter `server/schema.sql`; die API legt die Tabellen beim ersten Zugriff
selbst an und trägt die Wahlvorschläge ein. Enthält die Datenbank schon andere Wahlvorschläge,
verweigert sie den Betrieb: **jede neue Wahl braucht eine eigene, leere Datenbank** (bei Strato
zählt jede gegen das Datenbank-Kontingent des Pakets; alte Wahlen nach der Sicherung löschen).

Aufnehmen lassen sich PNG, JPEG, WebP und GIF. Gespeichert wird immer der verkleinerte Beleg als
JPEG; die API nimmt bis 20 MB je Beleg an, auch ältere PNG- und PDF-Belege bleiben abrufbar.

### Installation beim Hoster

1. Beim Hoster eine leere MariaDB-Datenbank anlegen (je Wahl eine eigene).
2. `npm run deploy` baut und lädt per SSH hoch (`server/deploy.ps1`). Die Standardziele
   (Strato-Zugang, `-Webroot Seniorenclub`, `-AppPath wahlassistent`) stammen aus der
   Mitgliederverwaltung; andere Ziele z. B. mit `npm run deploy -- -Webroot <ordner>`. Mit
   `-SkipUpload` entsteht nur das Paket unter `.deploy/`. `bilder/` beim Hoster bleibt dabei
   unangetastet.
3. Die DB-Zugangsdaten stehen als `STRATO_DB_HOST`, `STRATO_DB_NAME`, `STRATO_DB_USER` und
   `STRATO_DB_PASSWORD` in der `.env` (siehe `.env.example`). Daraus erzeugt das Deploy jedes Mal
   `php-api/config.local.php`. Ohne diese Einträge bleibt die Datei beim Hoster, wie sie ist.
4. Gleich danach `https://<domain>/<app>/controlcenter/` aufrufen und dort das erste
   Admin-Konto anlegen. Die Tabellen entstehen dabei gleich mit.
   Die Wahllokale per SSH im Ordner `php-api/` einspielen:
   `php -q -d register_argc_argv=1 import-wahllokale.php` (liest das Gebiet der eingestellten Wahl).
5. Prüfen:
   `curl -H "Authorization: Bearer test" https://<domain>/<app>/php-api/index.php/health`
   muss `{"status":"ok","tokenReceived":true}` liefern. Steht dort `false`, reicht der Hoster den
   Header nicht durch; der Client schickt das Token deshalb zusätzlich als `X-Auth-Token`.

`php-api/.htaccess` sperrt alles außer `index.php`; der Belegordner erhält zusätzlich eine eigene
`.htaccess` mit `Require all denied`. Wer die Belege lieber außerhalb des Webroots ablegt, setzt
`bilder_path` in `config.local.php`. Für eine vollständige Sicherung werden DB-Export und
Belegordner benötigt.

### Lokale Entwicklung (Docker)

Docker Desktop mit Linux-Containern starten. `compose.yaml` betreibt drei Dienste:

- `wahlassistent`: Apache mit PHP 8.4, erreichbar unter `http://localhost:3000/`
  (Erfassungsplatz: z. B. `/erfassungsplatz/?wahllokal=518`; ControlCenter: `/controlcenter/`).
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
```

In `.env` je ein zufälliges `DB_PASSWORD` und `DB_ROOT_PASSWORD` eintragen, etwa mit
`php -r "echo bin2hex(random_bytes(24));"`, dazu `DB_NAME` für die Wahl. Datenbank und
DB-Benutzer einmalig anlegen (auch für jede weitere Wahl, mit neuem `DB_NAME`):

```powershell
docker compose up -d db
docker compose exec db mariadb -uroot -p<DB_ROOT_PASSWORD> -e "CREATE DATABASE IF NOT EXISTS <db_name> CHARACTER SET utf8mb4 COLLATE utf8mb4_bin; CREATE USER IF NOT EXISTS 'wahlassistent'@'%' IDENTIFIED BY '<DB_PASSWORD>'; GRANT ALL PRIVILEGES ON <db_name>.* TO 'wahlassistent'@'%';"
docker compose up --build -d
docker compose exec wahlassistent php /srv/wahlassistent/server/create-user.php <name> <startpasswort> admin
```

Die Tabellen legt die API beim ersten Aufruf selbst an. `npm run dev` und `npm run dev:source`
leiten `php-api/` an den Container auf Port 3000 weiter. Über `npm run dev:lan` läuft die
Vorschau per HTTPS mit selbst signiertem Zertifikat im WLAN – zum Testen auf dem Smartphone
`https://<WLAN-IP des PCs>:5173/erfassungsplatz/?wahllokal=518` öffnen und die Zertifikatswarnung einmal
bestätigen. HTTPS ist nötig, weil der Browser `crypto.subtle` (Wahlabgleich, Belege) nur auf
sicheren Seiten bereitstellt.

`docker compose down` erhält die Daten; `down -v` löscht die Volumes samt Wahldaten und Belegen.

## Fiktives Wahllokal 518

```powershell
$env:WAHLASSISTENT_USER = '<admin-konto>'
$env:WAHLASSISTENT_PASSWORD = '<passwort>'
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
npm run test:e2e
```

`npm test` prüft Erkennung und Oberfläche. `npm run test:php` lädt einmalig PHPUnit, fährt eine
flüchtige MariaDB (`wa-test-db`, Port 3308) hoch und prüft die API: reine Logik ohne Datenbank,
dazu jede Route gegen die echte Datenbank – Wiederholungsuploads, Zurückrollen fehlerhafter
Stapel, Belegprüfung, Anmeldung, Rollen, Wahllokalregistrierung und UTF-8. Ohne Docker laufen nur die
Logiktests, mit deutlicher Warnung. Stoppen: `npm run test:php:db:down`.
Der Wahl-Hash muss in Browser und PHP byteweise gleich sein; `test/wahl.test.js` und
`test/php/WahlTest.php` prüfen dieselben Werte.

`npm run test:e2e` spielt den ganzen Weg im Browser durch (Playwright mit dem installierten Chrome):
Admin registriert ein Wahllokal, ein Wahlvorstand erfasst am simulierten Smartphone einen Stapel aus
zwei echten Fotos und sendet ihn, das ControlCenter zeigt ihn in allen Ansichten samt Beleg. Keine
Seite darf dabei Fehler in die Konsole schreiben. Der Test baut die Anwendung und fährt einen eigenen
Docker-Stack auf Port 3100 hoch (`test/e2e/compose.yaml`, Daten nur auf tmpfs), der danach wieder
verschwindet – die lokalen Daten bleiben unberührt. Dauer rund 20 Sekunden, deshalb nicht im
pre-commit-Hook; vor einem Deploy und nach größeren Umbauten laufen lassen.
