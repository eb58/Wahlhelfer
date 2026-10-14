# Algorithmus der Ankreuzerkennung

Dieses Dokument beschreibt den derzeit implementierten Erkennungsweg in
`erfassungsplatz/erkennung/ankreuzErkennung.js`. Die Anwendung sucht keine Ankreuzfelder im Bild. Ihre Lage
steht in einer von Hand vermessenen Kalibrierungsdatei; das Bild wird auf diese bekannte
Geometrie ausgerichtet und anschließend nur an den bekannten Feldern ausgewertet.

## 1. Eingaben und Kalibrierung

Eine Kalibrierung unter `Kalibrierungen/` enthält insbesondere:

- `referenz`: Breite und Höhe des vermessenen Musterzettels
- `frame`: die vier durchgehenden Drucklinien des Musterzettels - genau die Linien, die
  `findFrame()` am Musterzettel findet
- `huelle` (optional): der äußere Rand aller Tabellen, nur wenn er von `frame` abweicht.
  Bei MV endet `frame` vor der Nummernspalte, die Tabellen reichen weiter nach rechts.
- `radius`: Radius eines gedruckten Ankreuzrings in Musterzettel-Pixeln
- `textmarken`: erwarteter Text und Mittelpunkt mehrerer verteilter Marken
- `stimmen`: Stimmen, Auswahlzahl und die vermessenen Felder mit Nummer und Beschriftung
- `thresholds`: die Grundschwellen für leer, unklar und angekreuzt

`loadKalibrierung()` prüft die Datei und wandelt die Feldkoordinaten zusätzlich in
rahmenrelative Koordinaten um. Dadurch kann dieselbe Kalibrierung bei einer anderen
Auflösung oder einem anderen Bildausschnitt verwendet werden.

## 2. Bildvorbereitung

Im Browser wird eine Aufnahme in `browserImage.js` höchstens auf 1600 Pixel Breite
verkleinert. Die Höhe wird dabei proportional angepasst; bei langen Europawahlzetteln
wird also nicht die lange Kante begrenzt. Transparente Pixel werden vor der Auswertung
mit Weiß hinterlegt.

`toDarkness()` erzeugt aus den RGBA-Daten eine Dunkelheitskarte:

```text
0 = weiß
1 = schwarz
```

Die Transparenz wird dabei mitgerechnet. So werden transparente PNG-Ränder nicht
fälschlich als schwarze Rahmenlinien erkannt.

## 3. Grobe Lage des Zettels

### Gerade Aufnahmen

`findFrame()` zählt dunkle Pixel in jeder Spalte und Zeile. Linien, die über einen großen
Teil der Aufnahme durchgehend dunkel sind, werden zu Gruppen zusammengefasst. Die jeweils
äußerste linke, rechte, obere und untere Linie bilden den groben rechteckigen Rahmen.

### Smartphone-Fotos: Rahmenkandidaten

Bei Fotos mit Umgebung ermittelt `findPaper()` zuerst grob die helle Papierfläche als
achsenparalleles Rechteck. Gesucht wird dann der gedruckte Rahmen als Viereck
(`erfassungsplatz/erkennung/frameQuad.js`). Das Vorgehen stammt aus dem Sudoku-Scanner (`algorithms-js`):

1. **Arbeitsbild:** Die Dunkelheitskarte wird per Flächenmittel auf höchstens 600 Pixel
   **Breite** verkleinert. Wie bei der Aufnahme wird die Breite begrenzt, nicht die lange
   Kante, sonst blieben vom Europawahlzettel (1:4) nur wenige Pixel Breite übrig.
2. **Adaptiver Schwellwert:** Ein Pixel gilt als Tinte, wenn es mindestens 12 % dunkler ist
   als das Mittel seiner Umgebung (Integralbild, Radius etwa 1 % der kürzeren Bildseite).
   Schatten und Helligkeitsverläufe auf dem Papier stören damit kaum.
3. **Zusammenhangskomponenten:** Zusammenhängende Tintenpixel (8er-Nachbarschaft) bilden
   Komponenten. Je Komponente werden Begrenzung, Pixel und die Extrempunkte entlang der
   Diagonalen gemerkt (kleinstes/größtes `x+y` und `x-y`) - das sind grob die vier Ecken.
4. **Kandidaten:**
   - jede Komponente, die den Bildrand nicht berührt, höchstens zu 40 % gefüllt ist, vier
     Seiten von mindestens 25 % der kürzeren Bildseite hat und im Seitenverhältnis zum
     Kalibrierungsrahmen passt (Faktor 0,6 bis 1,6) - typisch der geschlossene Außenrahmen;
   - zusätzlich die **Hülle** aller größeren, nur dünn gefüllten Teile (unter 12 %, also
     Linienwerk) innerhalb der Papierfläche plus 5 % Rand. Das deckt Zettel ohne
     umlaufenden Rahmen ab, deren Tabellen getrennt stehen (Neuwied, MV, Europawahl).
     Massive Kopfgrafiken wie Pfeile und Balken fallen über den Füllgrad heraus.
5. **Ecken genau bestimmen:** Ein einzelner Extrempunkt ist nur auf einen Pixel genau. Bei
   langen Zetteln verschieben schon wenige Pixel an einer Ecke die Ringe am anderen Ende
   um ein Vielfaches. Deshalb wird je Seite eine Gerade durch die äußersten Pixel gelegt
   (`refineCorners`), nur im mittleren Stück der Seite und nur mit Punkten nahe der
   groben Kante (erst 3, dann 1,5 Pixel Abstand). Die Ecken sind die Schnittpunkte.
6. **Hülle der Kalibrierung:** Hat die Kalibrierung eine `huelle`, wird jedes Viereck
   zusätzlich als deren Rand gedeutet und auf den Kalibrierungsrahmen umgerechnet
   (`reframe`).

Aus den vier Ecken eines Kandidaten berechnet `perspectivePoint()` die perspektivische
Abbildung vom Musterzettel ins Foto.

### Bestätigung am Musterzettel

Welcher Kandidat stimmt, entscheidet `scoreFrame()`: Für jeden Kandidaten werden alle
Ankreuzfelder an die Stelle projiziert, an der er sie erwarten lässt, und dort der Ringwert
(siehe 4.1) gemessen. Die drei bestbewerteten Kandidaten werden der Reihe nach mit der
Ringausrichtung (Abschnitt 4) versucht; der erste, der sie besteht, trägt.

### Rückfall: Linien-Suche

Nur wenn kein Viereck zu einer Ausrichtung führt, sucht `findPerspectiveFrame()` innerhalb
der Papierfläche die vier gedruckten Rahmenlinien einzeln (obere Linie mit Neigung, untere
Linie bevorzugt aus den äußersten Randpunkten, linke und rechte Senkrechte, dann die
Schnittpunkte). Diese Suche ist teuer und dient deshalb nur noch als weiterer Kandidat und
als Lage für den OCR-Rückfall.

Wenn auch sie keinen brauchbaren Rahmen liefert, verwendet der OCR-Rückfall die
Papierlage, einen plausiblen geraden Rahmen oder als letzte grobe Schätzung die Lage aus
Bildgröße und Kalibrierung.

## 4. Primärer Erkennungsweg: gedruckte Ankreuzringe

Die Ringausrichtung ist der normale Weg für Smartphone-Fotos. Sie benötigt keine OCR.

### 4.1 Grobe Verschiebung

Aus allen vermessenen Feldlagen wird zunächst eine gemeinsame Verschiebung gesucht
(`findRoughRingShift`). Für jeden Kandidaten wird die Dunkelheit auf dem erwarteten
Ring mit der Dunkelheit in seinem inneren und äußeren Umfeld verglichen:

```text
Ringwert = Ringdunkelheit - 0,55 * mittlere Umfeld-Dunkelheit
```

Zuerst wird ein Raster durchsucht (`dx` ungefähr -90 bis +90 Pixel, `dy` abhängig vom
Ringradius), anschließend die beste Stelle lokal verfeinert. Oberer und unterer Bereich
werden dabei stärker gewichtet, weil sie für eine globale Verschiebung besonders
informativ sind.

### 4.2 Lokale Ringsuche

Für jedes Feld wird ein kleiner, perspektivisch normalisierter Ausschnitt erzeugt
(`normalizeField`). Innerhalb des Ausschnitts wird der Ring im Umkreis von 1,2 Ringradien
verschoben und mit 72 Messpunkten bewertet. Die Messung berücksichtigt den Ring und sein
Umfeld, nicht nur die Mitte des Feldes.

Gesucht wird grob nach fein: zuerst jede zweite Position im ganzen Fenster, danach
pixelgenau um die beste. Das Fenster bleibt so weit wie vorher, braucht aber nur gut ein
Viertel der Rechenschritte.

### 4.3 Robuste affine Ringtransformation

Die gefundenen Ringmittelpunkte dienen als Ankerpaare aus Kalibrierungs- und Aufnahme-
koordinaten. `determineRingTransformation()`:

1. verwirft Anker mit zu kleinem Ringscore,
2. probiert alle Dreierkombinationen als affine Startlösung,
3. zählt Anker mit höchstens 10 Pixel Lagefehler als Ausreißer-freie Treffer,
4. wählt die Lösung mit den meisten und stärksten Treffern,
5. berechnet die affine Lösung erneut aus allen Inliern.

Eine Lösung wird nur akzeptiert, wenn mindestens sechs Ringe ausreichend kontrastreich
(mittlerer Ringwert mindestens 0,32) und über den Zettel verteilt sind (mindestens 80 Pixel
in x und 300 Pixel in y), die Transformation geometrisch plausibel ist und keine
unrealistische Drehung oder Scherung enthält. Die lineare Ausgleichsrechnung für die
Transformation liegt gemeinsam in `erfassungsplatz/erkennung/leastSquares.js`.

**Eine Ringspalte:** Liegen alle Ringe untereinander (Europawahl, x-Spanne unter 80 Pixel),
ist die Streckung quer zur Spalte aus den Ringen nicht bestimmbar. Sie bleibt dann wie vom
Rahmen vorgegeben; bestimmt werden nur Lage, Neigung und Längsstreckung, und als Startlösung
genügen Zweierkombinationen.

Danach werden alle kalibrierten Feldlagen mit dieser Transformation projiziert und lokal
noch einmal auf ihren gedruckten Ring eingerastet.

## 5. OCR-Rückfall

OCR wird nur gestartet, wenn keine ausreichende Ringausrichtung gefunden wurde und der
OCR-Rückfall aktiviert ist. Die OCR ist damit eine Absicherung für kontrastarme,
unvollständige oder ungewöhnliche Aufnahmen, nicht der normale Weg.

### 5.1 BereichsOCR

Für jede Kalibrierungs-Textmarke wird aus der groben Zettel- oder Rahmenlage ein kleiner
Ausschnitt berechnet (`ocrRegions.js`). Die Ausschnitte bleiben in Originalauflösung und
werden zu einem kompakten Streifenbild zusammengesetzt:

- Breite: mindestens 180 Pixel, sonst etwa 18 % der Rahmenbreite
- Höhe: mindestens 80 Pixel, sonst etwa 30 % der Ausschnittbreite
- die weißen Zwischenräume werden entfernt
- der Außenrahmen wird vor der OCR weiß maskiert

Tesseract läuft lokal mit dem deutschen Sprachmodell. Erkannte Wörter mit einer
Konfidenz unter 20 werden verworfen; die Bounding-Boxen werden aus dem Streifenbild in die
ursprünglichen Aufnahme-Pixel zurückgerechnet.

### 5.2 Zuordnung und affine Textlage

Text und OCR-Wort werden normalisiert (Kleinbuchstaben, Diakritika und Satzzeichen werden
entfernt). Eine Zuordnung wird ab einer Levenshtein-Ähnlichkeit von 0,75 akzeptiert. Die
Zuordnung berücksichtigt außerdem die erwartete räumliche Lage und verwendet ein OCR-Wort
nur einmal.

Aus mindestens drei verteilten Treffern wird eine affine Transformation bestimmt. Bei einer
perspektivischen Papierlage wird zunächst die Perspektivabbildung des Rahmens berücksichtigt
und anschließend eine affine Korrektur berechnet. Die Lösung wird verworfen, wenn:

- weniger als drei Textmarken erkannt wurden,
- die Treffer nicht über den Zettel verteilt sind,
- der maximale Lagefehler mehr als 6 % der Bilddiagonale beträgt oder
- die Korrektur geometrisch unplausibel ist.

### 5.3 Ganzseiten-OCR

Wenn die BereichsOCR keine ausreichend genaue Lage liefert, wird als letzte OCR-Stufe der
gesamte, vom Außenrahmen bereinigte Wahlzettel erkannt. Dieser Weg ist deutlich langsamer,
verarbeitet mehr Fremdtext und bleibt deshalb bewusst ein Notfallback.

## 6. Messung der Ankreuzfelder

Für jedes Feld wird ein Innenkreis mit ungefähr 68 % des Ringradius ausgewertet. Der Ring
selbst wird nicht als Markierung gezählt, weil er auf jedem leeren Musterzettel vorhanden
ist. Die lokale Messung verwendet einen adaptiven Helligkeitsschwellwert aus dem jeweiligen
Ausschnitt und liefert den `Fuellgrad` als Anteil dunkler Pixel.

Die Statusschwellen werden bei ausgerichteten Aufnahmen an den Bildsockel angepasst:

- Ringausrichtung: 65. Perzentil als Baseline, Mindestabstände +0,06 und +0,045
- OCR-/Rahmen-Rückfall: 80. Perzentil als Baseline, Mindestabstände +0,04 und +0,025

Die berechneten Werte werden jeweils mindestens durch die konfigurierten Grundschwellen
begrenzt. Daraus entsteht je Feld einer der drei Zustände:

```text
Fuellgrad >= angekreuzt  -> angekreuzt
Fuellgrad >= zweifel     -> unklar
sonst                    -> leer
```

## 7. Stimmenwertung

Die Felder werden nach Stimme gruppiert. Für jede Stimme gilt die in der Kalibrierung
angegebene `auswahl`:

- mehr angekreuzte Felder als erlaubt: `mehrfach`
- mindestens ein unklar markiertes Feld: `zweifelsfall`
- genau die erlaubte Anzahl klarer Kreuze: `gueltig`
- weniger klare Kreuze ohne unklare Felder: `leer`

Nur der Status `gueltig` wird als eindeutige Wertung angezeigt. Alle anderen Zustände
bleiben eine Entscheidung des Wahlvorstands.

## 8. Fehler- und Diagnoseverhalten

Die Verarbeitung bricht ab, wenn keine ausreichende Zettellage erkannt wird oder weder
Ring- noch OCR-Ausrichtung eine belastbare Geometrie liefern. Ein Foto wird lieber
abgelehnt als geraten gewertet. Die Protokollierung kann über `setLogging(true)`
aktiviert werden und misst unter anderem:

- Dunkelheitskarte
- Papier- und Rahmensuche
- Rahmenkandidaten und gegebenenfalls die Linien-Suche
- Ring- oder OCR-Ausrichtung
- Feldmessung
- gesamte Bildverarbeitung

Auf einem PC zeigt die Oberfläche die Aufnahme mit den Ankreuzfeldern als farbige Ringe
(`drawFelder`: grün angekreuzt, ocker unklar, grau leer). Daran sieht man sofort, ob die
Ausrichtung stimmt. Auf dem Smartphone entfällt die Vorschau, dort liegt der Zettel vor einem.

Ein Foto von 1600 Pixel Breite braucht für die Erkennung am PC etwa 230 ms.

Bei der OCR werden die erwarteten Textmarken einzeln mit einem Haken für erkannte Marken
ausgegeben. So lässt sich unterscheiden, ob die Aufnahme unscharf ist oder ob eine
Kalibrierungsmarke falsch vermessen wurde.

## 9. Tests und Nachvollziehbarkeit

Die Erkennung wird mit drei Arten von Testdaten geprüft. Sie liegen je Zettelart unter
`Testdaten/<kalibrierung>/`:

- `scans/`: aus dem Musterzettel erzeugte PNG-Fälle (Kreuze, Mehrfach, Rauschen, Drehung),
- `fotos-serie<n>/`: echte Smartphone-Fotos, bisher nur vom Bundestagszettel (53 Stück),
- `synthetisch/`: für jede Zettelart drei künstliche Fotos (gerade, leicht schräg,
  4 Grad gedreht), erzeugt mit `node scripts/erzeugeSynthetischeFotos.js`.

Fotos und synthetische Fotos müssen **ohne OCR** richtig gewertet werden. Die Tests laden
JPEGs mit `sharp` und verkleinern sie wie der Browser auf 1600 Pixel Breite.

```powershell
npm test
```

Die Kalibrierung kann zusätzlich sichtbar geprüft werden:

```powershell
python scripts/pruefeKalibrierung.py Kalibrierungen/bundestagswahl-2017.json pruefung-tmp.png
```

Die OCR-Textmarken der Musterzettel lassen sich separat prüfen:

```powershell
npm run pruefe:ocr
```

Alle Verarbeitungsschritte laufen lokal im Browser. Bilder und OCR-Daten werden nicht an
einen Server übertragen.
