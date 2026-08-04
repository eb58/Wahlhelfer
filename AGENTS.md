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

Siehe "Konzeptstudie Digitaler Wahlassistent.md"

## Aufbau der Erkennung

- **Die Kalibrierung wird nicht berechnet, sondern abgelesen.** Je Zettelart liegt unter
  `Kalibrierungen/` eine von Hand am leeren Musterzettel vermessene Datei. Es gibt bewusst kein
  Verfahren mehr, das Ankreuzfelder selbst sucht (fruehere Kreissuche, Spaltenbildung,
  Radiusabstimmung) - das war aufwendig und unzuverlaessig. Neue Zettelart heisst: neue Datei.
- Aufbau einer Kalibrierungsdatei: `frame` (die Rahmenlinien des Musterzettels), `radius`,
  ueber den Zettel verteilte `textmarken` mit Text und Mittelpunkt (`x`/`y`) sowie
  je Stimme (`erststimme`, `zweitstimme`, bei nur einer Stimme schlicht `stimme`) die Felder mit
  `x`/`y` in Musterzettel-Pixeln, `nummer` (Listenplatz wie gedruckt) und `beschriftung`.
  `auswahl` sagt, wie viele Markierungen je Stimme gueltig sind.
- `loadKalibrierung(json)` liefert den asynchronen Erkenner `await typ.recognize(aufnahme)`.
  Bei Smartphone-Fotos liefern Papierkante und perspektivische Druckrahmen (`frame.js`) die
  grobe Lage. Danach werden mehrere gedruckte Ankreuzringe gemeinsam gesucht und eine robuste
  affine Ring-Transformation bestimmt. Das ist der normale Erkennungspfad.
- Die Textmarken und die lokale OCR bleiben als Rueckfall fuer kontrastarme oder unvollstaendige
  Rahmenaufnahmen erhalten. Dafuer werden nur unverkleinerte Streifen um die erwarteten Marken
  zusammengesetzt; weniger als drei erkannte, nicht kollineare Marken fuehren zum Abbruch statt
  zu einer geratenen Wertung. Die OCR-Boxen werden danach in Aufnahme-Pixel zurueckgerechnet.
- Jedes Feld wird im ringbasierten Pfad perspektivisch normalisiert (`feldNormalisierung.js`).
  Bewertet wird nur der Bereich innerhalb des gedruckten Rings, nicht der Ring selbst und nicht
  das weitere Umfeld - so stoert ein Kreuz weder die Ringsuche noch die Fuellgradmessung.
  `adjustFeld` bleibt fuer den einfachen OCR-/Rahmen-Rueckfall erhalten.
- Die lineare Ausgleichsrechnung fuer Ring- und Texttransformationen liegt gemeinsam in
  `leastSquares.js`; doppelte 3x3-Loeser sollen nicht wieder in die Fachmodule wandern.
- Ob ein Feld angekreuzt ist, entscheidet allein die Pixelmessung (`ankreuzErkennung.js`).
- Bilddaten immer ueber `toDarkness()` einlesen: es rechnet Transparenz ueber Weiss. Sonst
  liefert `canvas.getImageData()` durchsichtige Bereiche als Schwarz und der Rahmen verrutscht.
- Stimmzettel sind heute oft sehr lang (Europawahl rund 1:4). Deshalb begrenzt `browserImage.js`
  die **Breite** der Aufnahme, nicht die laengste Kante. Die Aufnahme wird nur intern erkannt;
  die Oberflaeche zeigt keine Bildvorschau, sondern konzentriert sich auf die Wertung.

## Werkzeuge

- `python scripts/pruefeKalibrierung.py <datei.json> [ausgabe.png]` zeichnet Feld- und Textmarken in
  den Musterzettel - die Sichtkontrolle nach jeder Aenderung an einer Kalibrierung.
- `configuration.js` legt fest, welche Kalibrierung im Einsatz gilt. Pro Wahl einmal setzen;
  die Oberflaeche bietet keine Auswahl an.

## Externe Ressourcen

- Zur Laufzeit wird nichts aus dem Netz geladen. Vite kopiert pdf.js, Tesseract, Sprachmodell
  und Kalibrierungen beim Start bzw. Build aus `node_modules` und `Kalibrierungen/` nach `public/`.
  `dist/` und `public/` sind erzeugte, ignorierte Verzeichnisse und muessen nicht eingecheckt
  werden.

## Pruefen

- Vor dem Abschluss die betroffenen Tests ausfuehren.
- Fuer breitere Änderungen mindestens `npm test` laufen lassen.
- Die Fototests enthalten derzeit 20 Aufnahmen aus `wahlzettel1_fotos` und 33 Aufnahmen aus
  `wahlzettel2_fotos`; ein vollständiger Lauf dauert wegen des OCR-Rueckfalls mehrere Minuten.
- Wenn UI- oder Dokument-Layout betroffen ist, zusaetzlich die dazugehoerigen Spezialtests pruefen.

## Benennung

- Begriffe der Wahldomaene bleiben deutsch: Wahlzettel, Stimme, Erst-/Zweitstimme, Ankreuzfeld
  (`felder`), ankreuzen, Markierung, Fuellgrad, Wertung, Zweifelsfall, Musterzettel, Beschriftung,
  Kalibrierung, Auswahl (zulaessige Markierungen je Stimme).
- Alles Uebrige ist englisch: read/write, image, darkness, frame, path, word, anchor, transform,
  scale, rotate, crop, canvas, store/load, draw, find, threshold, column, circle.
- Gemischte Namen sind gewollt und richtig, z. B. `drawFelder`, `adjustFeld`, `storeTyp`.
