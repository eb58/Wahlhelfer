# AGENTS.md

## Arbeitsregeln

- In JavaScript moeglichst `const` und Arrow Functions verwenden.
- `let` nur nutzen, wenn eine erneute Zuweisung noetig ist.
- Schreibweise kompakt halten, ohne Lesbarkeit zu opfern.
- Änderungen eng am bestehenden Stil und an der vorhandenen Struktur halten.
- Textdateien in UTF-8 halten; keine ungepruefte Umcodierung und kein mojibake in neuem Text.
- Keep it simple, stupid -> KISS-Prinzip
- use globalThis not window
- bevorzuge ' gegenüber " in Stringliteralen
- nur auf Anforderung committen
- testbaren Code schreiben - und natürlich die Tests dazu anlegen
- Fachliche Begriffe auf deutsch, nicht versuchen englische Namen dafür zu finden. Aber nur fachliche Begriffe auf deutsch. Typische Informatikerbegriffe und einfache englische Wörter (create, get, put, read, edit, load, store, word, image, path, frame etc.) bleiben natürlich auf englisch. Die Trennlinie ist natürlich fließend, aber als Richtlinie: Begriffe der Anwendungsdomain bleiben deutsch und nur die.

## Projektwissen

Siehe `docs/Konzeptstudie_Digitaler_Wahlassistent.md`, der implementierte Erkennungsweg steht in
`docs/Algorithm.md`.

## Aufbau der Erkennung

- **Die Kalibrierung wird nicht berechnet, sondern abgelesen.** Je Zettelart liegt unter
  `Kalibrierungen/` eine von Hand am leeren Musterzettel vermessene Datei. Es gibt bewusst kein
  Verfahren mehr, das Ankreuzfelder selbst sucht (fruehere Kreissuche, Spaltenbildung,
  Radiusabstimmung) - das war aufwendig und unzuverlaessig. Neue Zettelart heisst: neue Datei.
- Aufbau einer Kalibrierungsdatei: `frame` (die Rahmenlinien des Musterzettels), `radius` sowie
  je Stimme (`erststimme`, `zweitstimme`, bei nur einer Stimme schlicht `stimme`) die Felder mit
  `x`/`y` in Musterzettel-Pixeln, `nummer` (Listenplatz wie gedruckt) und `beschriftung`.
  `auswahl` sagt, wie viele Markierungen je Stimme gueltig sind. Optional `huelle`: der aeussere
  Rand aller Tabellen, nur wenn er von `frame` abweicht (MV: `frame` endet vor der Nummernspalte).
  Die Fotoerkennung deutet jedes gefundene Viereck dann auch als Huelle; `frame` bleibt unveraendert,
  weil die Scan-Erkennung genau diese Linien findet.
- `loadKalibrierung(json)` liefert den asynchronen Erkenner `await typ.recognize(aufnahme)`.
  Bei Smartphone-Fotos liefern Rahmenkandidaten die grobe Lage (`frameQuad.js`, Vorgehen aus dem
  Sudoku-Scanner): nach adaptivem Schwellwert der Druckrahmen als geschlossene Komponente oder - bei
  Zetteln ohne umlaufenden Rahmen (Neuwied, MV, Europawahl) - die Huelle aller Tabellenteile auf dem
  Papier. Die Ecken kommen grob aus den Diagonal-Extrempunkten und genau aus Geraden durch die vier
  Seiten; bei langen Zetteln verschieben schon wenige Pixel an einer Ecke die Ringe am anderen Ende.
  Dazu kommt die Linien-Suche aus `frame.js`. Jeder Kandidat wird am Musterzettel bestaetigt
  (`scoreFrame`: liegen die Ringe dort, wo er sie erwarten laesst?); der beste traegt. Danach werden
  mehrere gedruckte Ankreuzringe gemeinsam gesucht und eine robuste affine Ring-Transformation
  bestimmt; liegen alle Ringe in einer Spalte, bleibt die Streckung quer zur Spalte beim Rahmen.
  Das ist der einzige Erkennungspfad fuer Fotos.
- **Ein Foto ohne sichere Ringlage wird abgelehnt, nicht geraten.** Einen OCR-Rueckfall gibt es
  bewusst nicht mehr: auf den 53 echten Fotos wertete er 3 falsch (u. a. eine Stimme fuer den
  falschen Kandidaten), ohne einen Zweifelsfall zu melden, und kostete rund 13 MB Tesseract-Dateien.
  Scans (Papier fuellt das Bild) richten sich nach dem geraden Rahmen aus `findFrame()`.
- Jedes Feld wird im ringbasierten Pfad perspektivisch normalisiert (`feldNormalisierung.js`).
  Bewertet wird nur der Bereich innerhalb des gedruckten Rings, nicht der Ring selbst und nicht
  das weitere Umfeld - so stoert ein Kreuz weder die Ringsuche noch die Fuellgradmessung.
  `adjustFeld` rastet im Scan-Pfad die Felder auf ihren Ring ein.
- Die lineare Ausgleichsrechnung fuer Rahmen- und Ringtransformationen liegt gemeinsam in
  `leastSquares.js`; doppelte Gleichungsloeser sollen nicht wieder in die Fachmodule wandern.
- Ob ein Feld angekreuzt ist, entscheidet allein die Pixelmessung (`ankreuzErkennung.js`).
- Bilddaten immer ueber `toDarkness()` einlesen: es rechnet Transparenz ueber Weiss. Sonst
  liefert `canvas.getImageData()` durchsichtige Bereiche als Schwarz und der Rahmen verrutscht.
- Stimmzettel sind heute oft sehr lang (Europawahl rund 1:4). Deshalb begrenzt `browserImage.js`
  die **Breite** der Aufnahme, nicht die laengste Kante. Am PC zeigt die Oberflaeche die Aufnahme
  mit den erkannten Ankreuzfeldern (`drawFelder`); auf dem Smartphone (`pointer: coarse`) nicht -
  dort liegt der Zettel vor einem, die Oberflaeche konzentriert sich auf die Wertung.

## Werkzeuge

- `python scripts/pruefeKalibrierung.py <datei.json> [ausgabe.png]` zeichnet die Felder in
  den Musterzettel - die Sichtkontrolle nach jeder Aenderung an einer Kalibrierung.
- `node scripts/erzeugeSynthetischeFotos.js` erzeugt fuer jede Kalibrierung drei synthetische Fotos
  (gerade, leicht schraeg, 4 Grad gedreht) unter `Testdaten/<kalibrierung>/synthetisch/`. Nur neu
  erzeugen, wenn sich Musterzettel oder Kalibrierung aendern; der Zufall ist fest geseedet.
- `configuration.js` legt fest, welche Kalibrierung im Einsatz gilt. Pro Wahl einmal setzen;
  die Oberflaeche bietet keine Auswahl an.

## Erfassungsplatz und ControlCenter

- Der Browser-Code liegt unter `src/`: zwei getrennte Anwendungen in eigenen Ordnern, ohne Verweise
  aufeinander - der **Erfassungsplatz** (`src/erfassungsplatz/`) fuer Wahlhelfer und Wahlvorstand im
  Wahllokal, das **ControlCenter** (`src/controlcenter/`) fuer das Wahlamt, nur fuer Admins - und
  dazu `src/api/`. Vite baut mit `src/` als Root, in `dist/` liegen die Seiten deshalb wieder auf
  oberster Ebene (`dist/erfassungsplatz/`, `dist/controlcenter/`). Jeder Seitenordner hat `index.html`, `main.js` und
  `styles.css`; was nur eine Seite braucht, liegt in ihrem Ordner. Beim Erfassungsplatz sind das Stapel,
  IndexedDB-Puffer, Wertungsanzeige, Aufnahme und Beleg (`browserImage.js`),
  Wahllokalauswahl, Wahldefinition und die Erkennung (`src/erfassungsplatz/erkennung/`). Die Erkennung
  haengt an keiner Oberflaeche und laeuft auch in Node (Skripte, Fototests); sie importiert nichts aus
  dem uebrigen Erfassungsplatz. In `erkennung/` liegt nur Code, der den Wahlzettel erkennt - Bilder
  beschaffen, Belege erzeugen oder Dateien lesen gehoert nicht dorthin.
- `src/api/` ist die Browser-Seite der PHP-API in `server/`: alles, was mit dem Server spricht oder
  seine Antworten deutet - `serverApi.js` (Aufrufe, Anmeldung, Belege), `appUrl.js` (Pfade zum App-Root)
  und `wahllokalAnzeige.js` (was die Zaehler eines Wahllokals bedeuten). Was nur eine Seite braucht und
  nicht mit dem Server zu tun hat, gehoert in deren Ordner.
- Die Seiten liegen eine Ebene unter dem App-Root und sagen das mit `<html data-app-base="../">`.
  Alles, was im App-Root liegt (`php-api/`, `Kalibrierungen/`), immer ueber
  `appUrl()` aus `src/api/appUrl.js` ansprechen, nie relativ zur Seite.
- Der Erfassungsplatz ist fuer das Smartphone gebaut: schmale Kopfzeile, je Phase nur das Noetige
  (vor dem Stapel die Stapelgroesse, waehrend des Stapels Fortschritt und Aufnahme, waehrend einer
  Wertung nur diese, am Ende Kontrolle und Senden). Das Wahllokal kommt allein aus dem Link
  (`?wahllokal=518`, `findWahllokal()`); eine Auswahl gibt es bewusst nicht, angemeldet wird trotzdem.
- Der Erfassungsplatz zeigt vom Server nur den Fortschritt (`GET /api/wahllokale`: Zaehler je
  Wahllokal, keine Stimmen, keine Belege) im Monitor. Ergebnisse, Stapel, Prueffaelle und Belege
  (`/api/ergebnisse`, `/api/stapel/{id}`, `/api/prueffaelle`, `/api/stimmzettel/{id}/bild`)
  verlangen `requireAdmin()`.
- ControlCenter: `main.js` (Rahmen, Hash-Navigation, Aktualisierung alle 15 s), `ansichten.js` (je
  Menuepunkt eine Ansicht mit `update(data)`/`destroy()`), `bausteine.js` (DOM-Helfer `h()`, Kacheln,
  Balken), `tabellen.js` (AG Grid: Theme, deutsche Texte), `auswertung.js` (reine Logik, getestet in
  `test/controlcenterAuswertung.test.js`). Tabellen immer mit AG Grid und `getRowId`, damit Sortierung
  und Filter die Aktualisierung ueberstehen. Ausgelegt auf 100-150 Wahllokale: `/api/ergebnisse`
  liefert keine Einzelbelege, die kommen je Stapel bzw. als Prueffall-Liste erst bei Bedarf.

## Veroeffentlichung

- Beide Seiten brauchen den Build und die PHP-API; sie laufen nur gebaut beim Hoster oder lokal im
  Docker-Stack. Eine Startseite im App-Root gibt es nicht, Links fuehren direkt auf
  `erfassungsplatz/?wahllokal=518` bzw. `controlcenter/`.
- Die vollstaendige Anwendung mit Server laeuft beim Hoster (Strato, wie Mitgliederverwaltung und
  Gratulationsdienst): nur PHP und MariaDB, kein Node. Die API steht in `server/` (PHP, `lib.php`),
  wird von `server/deploy.ps1` als `php-api/` neben `dist/` und `configuration.js` gelegt und liest
  die Kalibrierung wie der Browser aus `configuration.js`. Das Frontend spricht sie relativ unter
  `php-api/index.php/api/...` an, deshalb baut Vite mit `base: './'`.
- Wie in der Mitgliederverwaltung werfen Handler ihre Antwort (`jsonResponse()` -> `ApiResponse`),
  `db()`, `config()`, `wahl()` und `requestStream()` sind die Test-Naehte. Neue Routen in
  `handleRequest()` diesem Muster folgen lassen.
- `getWahlDefinition()` gibt es zweimal (`src/erfassungsplatz/wahl.js`, `server/lib.php`); der Browser vergleicht den
  SHA-256 des JSON. Beide muessen byteweise dasselbe JSON liefern - `test/wahl.test.js` und
  `test/php/WahlTest.php` pruefen dieselben Hashwerte. Aendert sich eine Kalibrierung, beide anpassen.
- Der Beleg ist nicht das Kamera-Original, sondern die auf `MAX_WIDTH` (1600 px) verkleinerte Aufnahme
  als JPEG (`BELEG_QUALITY` 0.85, `toBeleg()` in `browserImage.js`). Erkannt wird genau dieser Beleg,
  damit er die Wertung reproduziert; `test/fotoWerkstatt.js` geht in den Fototests denselben Weg.
- Anmeldung wie in Mitgliederverwaltung und Gratulationsdienst: Konten in `app_user` (Rolle `admin`
  oder `wahlvorstand` mit festem Wahllokal), Sitzungen als SHA-256 in `app_session`, Konten per
  `server/create-user.php`. Jede Route bekommt den Benutzer aus `requireUser()`; ControlCenter-Routen verlangen
  `requireAdmin()`, fuer welches Wahllokal ein Wahlvorstand erfassen darf, entscheidet
  `wahllokalErlaubt()`. Neue Routen muessen das ebenfalls tun.
- `server/schema.sql` wird an Semikolons zerlegt: keine Semikolons in Kommentaren oder Texten.
- Belege werden einzeln per `PUT /api/bilder/{sha256}` hochgeladen, der Stapel verweist nur per Hash
  darauf. Nicht wieder Base64 in den Stapel packen: das sprengt das PHP-Speicherlimit.
- Lokal laeuft alles im eigenen Compose-Stack (`compose.yaml`: `wahlassistent`, `db`, `phpmyadmin`),
  nicht im Gratulationsdienst-Container. Das Image ist nur Apache+PHP; das Projekt ist schreibgeschuetzt
  eingebunden, Apache liefert `dist/` als Webroot und `server/` als `/php-api` aus. Entwickelt wird mit
  `npm run watch` (schreibt direkt nach `dist/`), erreichbar unter `http://localhost:3000/`.

## Externe Ressourcen

- Zur Laufzeit wird nichts aus dem Netz geladen. Vite kopiert die Kalibrierungen beim Start bzw.
  Build aus `Kalibrierungen/` in sein `publicDir` (`node_modules/.wahlassistent-public`)
  und von dort nach `dist/`. `dist/` ist erzeugt und ignoriert.

## Pruefen

- Testdaten liegen je Zettelart unter `Testdaten/<kalibrierung>/` (Name wie die Datei in
  `Kalibrierungen/`): `musterzettel.png` (+ PDF), dazu je nach Bestand `scans/`, `fotos-serie<n>/`
  und `synthetisch/`, jeweils mit `manifest.json`. Neue Zettelart = neuer Ordner.

- Vor dem Abschluss die betroffenen Tests ausfuehren.
- Der pre-commit-Hook (`.githooks/pre-commit`, aktiv nach `npm install` ueber `prepare`) prueft die
  vorgemerkten Textdateien auf UTF-8 und Mojibake (`scripts/pruefeTextkodierung.js`), laesst bei
  JS/JSON/HTML/CSS, Kalibrierungen oder Testdaten `npm test` und bei `server/` `npm run test:php` laufen.
- Fuer breitere Änderungen mindestens `npm test` laufen lassen.
- Die Fototests enthalten derzeit 20 Aufnahmen aus `bundestagswahl-2017/fotos-serie1` und 33 aus
  `bundestagswahl-2017/fotos-serie2`; alle laufen ueber den Ringpfad. Damit `node --test` sie parallel
  rechnet, sind sie auf mehrere Dateien verteilt (`test/fotos/`, Ablauf in `test/fotoTests.js`); `npm test`
  dauert so rund 9 s. Eine Datei laeuft in sich nacheinander - lange Testreihen also aufteilen.
- Fuer die anderen Zettelarten gibt es keine echten Fotos; `test/fotos/synthetisch-*.test.js` prueft sie
  mit synthetischen Fotos. Bekannte Luecken stehen dort als `todo` mit Begruendung - sie muessen sicher abgelehnt,
  duerfen aber nie falsch gewertet werden.
- Aenderungen an `server/` mit `npm run test:php` pruefen (PHPUnit, faehrt die Wegwerf-MariaDB
  `wa-test-db` auf Port 3308 selbst hoch; ohne Docker nur die Logiktests, mit Warnung).
- Wenn UI- oder Dokument-Layout betroffen ist, zusaetzlich die dazugehoerigen Spezialtests pruefen.

## Benennung

- Begriffe der Wahldomaene bleiben deutsch: Wahlzettel, Stimme, Erst-/Zweitstimme, Ankreuzfeld
  (`felder`), ankreuzen, Markierung, Fuellgrad, Wertung, Zweifelsfall, Musterzettel, Beschriftung,
  Kalibrierung, Auswahl (zulaessige Markierungen je Stimme).
- Alles Uebrige ist englisch: read/write, image, darkness, frame, path, word, anchor, transform,
  scale, rotate, crop, canvas, store/load, draw, find, threshold, column, circle.
- Gemischte Namen sind gewollt und richtig, z. B. `drawFelder`, `adjustFeld`, `storeTyp`.
