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

- `registerWahlzettel(musterBild)` lernt einen Zetteltyp aus einem **leeren** Musterzettel und
  liefert einen Erkenner (`typ.recognize(aufnahme)`). Kein Modul kennt einen konkreten Stimmzettel:
  Spaltenzahl, Feldanzahl, Radius und Rahmen stammen aus dem Bild. Registriert wird einmal je
  Zettelart, gespeichert per `toJson()` / `fromJson()`.
- Fuer die Ausrichtung gibt es zwei Wege, in dieser Reihenfolge:
  1. **Rahmen** (`frame.js`): Feldlagen relativ zu den durchgehenden Drucklinien. Schnell und
     ohne OCR, setzt aber eine gerade gehaltene Aufnahme voraus.
  2. **Anker** (`alignment.js`): gelernte Ankerwoerter per OCR, daraus eine
     Aehnlichkeitstransformation (Verschiebung, Drehung, Massstab). Faengt Schraeglage auf.
  `typ.recognize()` nutzt nur Weg 1, `typ.recognizeRobust()` faellt auf Weg 2 zurueck. Das Ergebnis
  nennt in `method` den genutzten Weg. Anker werden beim Registrieren mit `ocr` gelernt; mehrfach
  vorkommende Woerter (auf einem Stimmzettel z. B. "PARTEI") taugen nicht und werden verworfen.
- Jedes Feld wird zum Schluss auf seinen gedruckten Ring eingerastet (`adjustFeld`). Bewertet
  wird dabei nur der Ring, nicht das Innere - sonst wuerde ein Kreuz die Suche stoeren.
- Ob ein Feld angekreuzt ist, entscheidet die Pixelmessung (`ankreuzErkennung.js`), nie OCR.
  OCR (`beschriftung.js`) liefert nur Beschriftung und Anker und darf ausfallen.
- OCR-Wortkoordinaten stehen im Massstab des vergroesserten Bildes, die Feldlagen im Original.
  Ueberall, wo beides zusammentrifft, muss `scale` mitgereicht werden.
- Bilddaten immer ueber `toDarkness()` einlesen: es rechnet Transparenz ueber Weiss. Sonst
  liefert `canvas.getImageData()` durchsichtige Bereiche als Schwarz und der Rahmen verrutscht.

## Externe Ressourcen

- Zur Laufzeit wird nichts aus dem Netz geladen. Die Tesseract-Sprachdaten kommen aus dem Paket
  `@tesseract.js-data/deu`; `ocrPaths.js` setzt `langPath` und `cacheMethod: 'none'`. Ohne beides
  laedt tesseract.js vom jsdelivr-CDN und legt `deu.traineddata` im Arbeitsverzeichnis ab.
- Vorbild ist das Projekt `gratulationsdienst` (`public/vendor/tesseract`, dort per Vite gespiegelt); hier erledigt das `npm run vendor`.

## Pruefen

- Vor dem Abschluss die betroffenen Tests ausfuehren.
- Fuer breitere Änderungen mindestens `npm test` laufen lassen.
- Wenn UI- oder Dokument-Layout betroffen ist, zusaetzlich die dazugehoerigen Spezialtests pruefen.

## Benennung

- Begriffe der Wahldomaene bleiben deutsch: Wahlzettel, Stimme, Erst-/Zweitstimme, Ankreuzfeld
  (`felder`), ankreuzen, Markierung, Fuellgrad, Wertung, Zweifelsfall, Musterzettel, Beschriftung,
  Kalibrierung.
- Alles Uebrige ist englisch: read/write, image, darkness, frame, path, word, anchor, transform,
  scale, rotate, crop, canvas, store/load, draw, find, threshold, column, circle.
- Gemischte Namen sind gewollt und richtig, z. B. `drawFelder`, `adjustFeld`, `storeTyp`.
