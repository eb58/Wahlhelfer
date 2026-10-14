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
- Aufbau einer Kalibrierungsdatei: `frame` (die Rahmenlinien des Musterzettels), `radius`,
  ueber den Zettel verteilte `textmarken` mit Text und Mittelpunkt (`x`/`y`) sowie
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
  Das ist der normale Erkennungspfad.
- Die Textmarken und die lokale OCR bleiben als Rueckfall fuer kontrastarme oder unvollstaendige
  Rahmenaufnahmen erhalten. Dafuer werden nur unverkleinerte Streifen um die erwarteten Marken
  zusammengesetzt; weniger als drei erkannte, nicht kollineare Marken fuehren zum Abbruch statt
  zu einer geratenen Wertung. Die OCR-Boxen werden danach in Aufnahme-Pixel zurueckgerechnet.
- Jedes Feld wird im ringbasierten Pfad perspektivisch normalisiert (`feldNormalisierung.js`).
  Bewertet wird nur der Bereich innerhalb des gedruckten Rings, nicht der Ring selbst und nicht
  das weitere Umfeld - so stoert ein Kreuz weder die Ringsuche noch die Fuellgradmessung.
  `adjustFeld` bleibt fuer den einfachen OCR-/Rahmen-Rueckfall erhalten.
- Die lineare Ausgleichsrechnung fuer Ring- und Texttransformationen liegt gemeinsam in
  `leastSquares.js`; doppelte Gleichungsloeser sollen nicht wieder in die Fachmodule wandern.
- Ob ein Feld angekreuzt ist, entscheidet allein die Pixelmessung (`ankreuzErkennung.js`).
- Bilddaten immer ueber `toDarkness()` einlesen: es rechnet Transparenz ueber Weiss. Sonst
  liefert `canvas.getImageData()` durchsichtige Bereiche als Schwarz und der Rahmen verrutscht.
- Stimmzettel sind heute oft sehr lang (Europawahl rund 1:4). Deshalb begrenzt `browserImage.js`
  die **Breite** der Aufnahme, nicht die laengste Kante. Am PC zeigt die Oberflaeche die Aufnahme
  mit den erkannten Ankreuzfeldern (`drawFelder`); auf dem Smartphone (`pointer: coarse`) nicht -
  dort liegt der Zettel vor einem, die Oberflaeche konzentriert sich auf die Wertung.

## Werkzeuge

- `python scripts/pruefeKalibrierung.py <datei.json> [ausgabe.png]` zeichnet Feld- und Textmarken in
  den Musterzettel - die Sichtkontrolle nach jeder Aenderung an einer Kalibrierung.
- `node scripts/erzeugeSynthetischeFotos.js` erzeugt fuer jede Kalibrierung drei synthetische Fotos
  (gerade, leicht schraeg, 4 Grad gedreht) unter `Testdaten/<kalibrierung>/synthetisch/`. Nur neu
  erzeugen, wenn sich Musterzettel oder Kalibrierung aendern; der Zufall ist fest geseedet.
- `configuration.js` legt fest, welche Kalibrierung im Einsatz gilt. Pro Wahl einmal setzen;
  die Oberflaeche bietet keine Auswahl an.

## Veroeffentlichung

- GitHub Pages liefert den Root von `main` **ungebuendelt** aus (eb58.github.io/Wahlhelfer/).
  `index.html`, `app.js`, `styles.css` und `configuration.js` muessen deshalb im Projekt-Root
  bleiben, ebenso `Kalibrierungen/`. Der Vite-Build (`dist/`) ist nur fuer lokale Vorschau.
- Die vollstaendige Anwendung mit Server laeuft beim Hoster (Strato, wie Mitgliederverwaltung und
  Gratulationsdienst): nur PHP und MariaDB, kein Node. Die API steht in `server/` (PHP, `lib.php`),
  wird von `server/deploy.ps1` als `php-api/` neben `dist/` und `configuration.js` gelegt und liest
  die Kalibrierung wie der Browser aus `configuration.js`. Das Frontend spricht sie relativ unter
  `php-api/index.php/api/...` an, deshalb baut Vite mit `base: './'`.
- Wie in der Mitgliederverwaltung werfen Handler ihre Antwort (`jsonResponse()` -> `ApiResponse`),
  `db()`, `config()`, `wahl()` und `requestStream()` sind die Test-Naehte. Neue Routen in
  `handleRequest()` diesem Muster folgen lassen.
- `getWahlDefinition()` gibt es zweimal (`src/wahl.js`, `server/lib.php`); der Browser vergleicht den
  SHA-256 des JSON. Beide muessen byteweise dasselbe JSON liefern - `test/wahl.test.js` und
  `test/php/WahlTest.php` pruefen dieselben Hashwerte. Aendert sich eine Kalibrierung, beide anpassen.
- Der Beleg ist nicht das Kamera-Original, sondern die auf `MAX_WIDTH` (1600 px) verkleinerte Aufnahme
  als JPEG (`BELEG_QUALITY` 0.85, `toBeleg()` in `browserImage.js`). Erkannt wird genau dieser Beleg,
  damit er die Wertung reproduziert; `test/fotoWerkstatt.js` geht in den Fototests denselben Weg.
- Belege werden einzeln per `PUT /api/bilder/{sha256}` hochgeladen, der Stapel verweist nur per Hash
  darauf. Nicht wieder Base64 in den Stapel packen: das sprengt das PHP-Speicherlimit.
- Lokal laeuft alles im eigenen Compose-Stack (`compose.yaml`: `wahlassistent`, `db`, `phpmyadmin`),
  nicht im Gratulationsdienst-Container. Das Image ist nur Apache+PHP; das Projekt ist schreibgeschuetzt
  eingebunden, Apache liefert `dist/` als Webroot und `server/` als `/php-api` aus. Entwickelt wird mit
  `npm run watch` (schreibt direkt nach `dist/`), erreichbar unter `http://localhost:3000/`.

## Externe Ressourcen

- Zur Laufzeit wird nichts aus dem Netz geladen. Vite kopiert pdf.js, Tesseract, Sprachmodell
  und Kalibrierungen beim Start bzw. Build aus `node_modules` und `Kalibrierungen/` nach `public/`.
  `dist/` und `public/` sind erzeugte, ignorierte Verzeichnisse und muessen nicht eingecheckt
  werden.

## Pruefen

- Testdaten liegen je Zettelart unter `Testdaten/<kalibrierung>/` (Name wie die Datei in
  `Kalibrierungen/`): `musterzettel.png` (+ PDF), dazu je nach Bestand `scans/`, `fotos-serie<n>/`
  und `synthetisch/`, jeweils mit `manifest.json`. Neue Zettelart = neuer Ordner.

- Vor dem Abschluss die betroffenen Tests ausfuehren.
- Fuer breitere Änderungen mindestens `npm test` laufen lassen.
- Die Fototests enthalten derzeit 20 Aufnahmen aus `bundestagswahl-2017/fotos-serie1` und 33 aus
  `bundestagswahl-2017/fotos-serie2`; alle laufen ueber den Ringpfad, `npm test` dauert insgesamt rund 25 s.
  Faellt ein Foto in den OCR-Rueckfall, wird er deutlich langsamer.
- Fuer die anderen Zettelarten gibt es keine echten Fotos; `synthetischeFotos.test.js` prueft sie
  ohne OCR. Bekannte Luecken stehen dort als `todo` mit Begruendung - sie muessen sicher abgelehnt,
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
