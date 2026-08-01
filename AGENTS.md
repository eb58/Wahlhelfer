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
- Fachliche Begriffe auf deutsch, nicht versuchen englische Namen dafür zu finden. Aber nur fachliche Begriffe auf deutsch. Typische Informatikerbegriffe und einfache englische Wörter  (create, get, put, read, edit, load, store, word, image, path, frame etc.) bleiben natürlich auf englisch. Die Trennlinie ist natürlich fließend, aber als Richlinie: Begriffe der Anwendungsdomain bleiben deutsch und nur die. 

## Projektwissen

Siehe "Konzeptstudie Digitaler Wahlassistent.md"

## Aufbau der Erkennung

- **Die Kalibrierung wird nicht berechnet, sondern abgelesen.** Je Zettelart liegt unter
  `Kalibrierungen/` eine von Hand am leeren Musterzettel vermessene Datei. Es gibt bewusst kein
  Verfahren mehr, das Ankreuzfelder selbst sucht (fruehere Kreissuche, Spaltenbildung,
  Radiusabstimmung) - das war aufwendig und unzuverlaessig. Neue Zettelart heisst: neue Datei.
- Aufbau einer Kalibrierungsdatei: `frame` (die Rahmenlinien des Musterzettels), `radius` und
  je Stimme (`erststimme`, `zweitstimme`, bei nur einer Stimme schlicht `stimme`) die Felder mit
  `x`/`y` in Musterzettel-Pixeln, `nummer` (Listenplatz wie gedruckt) und `beschriftung`.
  `auswahl` sagt, wie viele Markierungen je Stimme gueltig sind.
- `ladeKalibrierung(json)` rechnet die Pixel gegen `frame` in rahmenrelative Lagen um und
  liefert den Erkenner `typ.recognize(aufnahme)`. Ausgerichtet wird ausschliesslich ueber die
  durchgehenden Drucklinien (`frame.js`); das setzt eine gerade gehaltene Aufnahme voraus.
- Jedes Feld wird zum Schluss auf seinen gedruckten Ring eingerastet (`adjustFeld`). Bewertet
  wird dabei nur der Ring, nicht das Innere - sonst wuerde ein Kreuz die Suche stoeren.
- Ob ein Feld angekreuzt ist, entscheidet allein die Pixelmessung (`ankreuzErkennung.js`).
- Bilddaten immer ueber `toDarkness()` einlesen: es rechnet Transparenz ueber Weiss. Sonst
  liefert `canvas.getImageData()` durchsichtige Bereiche als Schwarz und der Rahmen verrutscht.
- Stimmzettel sind heute oft sehr lang (Europawahl rund 1:4). Deshalb begrenzt `browserImage.js`
  die **Breite** der Aufnahme, nicht die laengste Kante. Die Aufnahme wird nur intern erkannt;
  die Oberflaeche zeigt keine Bildvorschau, sondern konzentriert sich auf die Wertung.

## Werkzeuge

- `python scripts/pruefeKalibrierung.py <datei.json> [ausgabe.png]` zeichnet die Feldlagen in
  den Musterzettel - die Sichtkontrolle nach jeder Aenderung an einer Kalibrierung.
- `konfiguration.js` legt fest, welche Kalibrierung im Einsatz gilt. Pro Wahl einmal setzen;
  die Oberflaeche bietet keine Auswahl an.

## Externe Ressourcen

- Zur Laufzeit wird nichts aus dem Netz geladen. pdf.js kommt lokal aus `node_modules`
  (Importmap in `index.html`); ohne diese Zuordnung wuerde es still auf ein CDN ausweichen.

## Pruefen

- Vor dem Abschluss die betroffenen Tests ausfuehren.
- Fuer breitere Änderungen mindestens `npm test` laufen lassen.
- Wenn UI- oder Dokument-Layout betroffen ist, zusaetzlich die dazugehoerigen Spezialtests pruefen.

## Benennung

- Begriffe der Wahldomaene bleiben deutsch: Wahlzettel, Stimme, Erst-/Zweitstimme, Ankreuzfeld
  (`felder`), ankreuzen, Markierung, Fuellgrad, Wertung, Zweifelsfall, Musterzettel, Beschriftung,
  Kalibrierung, Auswahl (zulaessige Markierungen je Stimme).
- Alles Uebrige ist englisch: read/write, image, darkness, frame, path, word, anchor, transform,
  scale, rotate, crop, canvas, store/load, draw, find, threshold, column, circle.
- Gemischte Namen sind gewollt und richtig, z. B. `drawFelder`, `adjustFeld`, `storeTyp`.
