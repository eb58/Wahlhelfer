# Algorithmus der Ankreuzerkennung

Dieses Dokument beschreibt den derzeit implementierten Erkennungsweg in
`src/ankreuzErkennung.js`. Die Anwendung sucht keine Ankreuzfelder im Bild. Ihre Lage
steht in einer von Hand vermessenen Kalibrierungsdatei; das Bild wird auf diese bekannte
Geometrie ausgerichtet und anschließend nur an den bekannten Feldern ausgewertet.

## 1. Eingaben und Kalibrierung

Eine Kalibrierung unter `Kalibrierungen/` enthält insbesondere:

- `referenz`: Breite und Höhe des vermessenen Musterzettels
- `frame`: die vier durchgehenden Drucklinien des Musterzettels
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

### Smartphone-Fotos

Bei Fotos mit Umgebung ermittelt `findPaper()` zuerst die helle Papierfläche. Innerhalb
dieser Fläche sucht `findPerspectiveFrame()` die vier gedruckten Rahmenlinien:

1. obere waagerechte Linie und ihre Neigung,
2. untere Linie, bevorzugt aus den äußersten dunklen Randpunkten,
3. linke und rechte senkrechte Linie,
4. die vier Schnittpunkte der Linien.

Aus den vier Ecken wird mit `perspectivePoint()` eine perspektivische Abbildung vom
Musterzettel in das Foto berechnet. Jeder Kalibrierungspunkt kann damit auch bei einer
schrägen Aufnahme in Bildkoordinaten projiziert werden.

Wenn kein brauchbarer perspektivischer Rahmen gefunden wird, verwendet der Algorithmus
die Papierlage, einen plausiblen geraden Rahmen oder als letzte grobe Schätzung die Lage
aus Bildgröße und Kalibrierung.

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
(`normalizeField`). Innerhalb des Ausschnitts wird der Ring in einer kleinen Umgebung
verschoben und mit 72 Messpunkten bewertet. Die Messung berücksichtigt den Ring und sein
Umfeld, nicht nur die Mitte des Feldes.

### 4.3 Robuste affine Ringtransformation

Die gefundenen Ringmittelpunkte dienen als Ankerpaare aus Kalibrierungs- und Aufnahme-
koordinaten. `determineRingTransformation()`:

1. verwirft Anker mit zu kleinem Ringscore,
2. probiert alle Dreierkombinationen als affine Startlösung,
3. zählt Anker mit höchstens 10 Pixel Lagefehler als Ausreißer-freie Treffer,
4. wählt die Lösung mit den meisten und stärksten Treffern,
5. berechnet die affine Lösung erneut aus allen Inliern.

Eine Lösung wird nur akzeptiert, wenn mindestens sechs Ringe ausreichend kontrastreich und
über den Zettel verteilt sind, die Transformation geometrisch plausibel ist und keine
unrealistische Drehung oder Scherung enthält. Die lineare Ausgleichsrechnung für die
Transformation liegt gemeinsam in `src/leastSquares.js`.

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
Ring- noch OCR-Ausrichtung eine belastbare Geometrie liefern. Die Protokollierung kann über
`setLogging(true)` aktiviert werden und misst unter anderem:

- Dunkelheitskarte
- Papier- und Rahmensuche
- perspektivischen Druckrahmen
- Ring- oder OCR-Ausrichtung
- Feldmessung
- gesamte Bildverarbeitung

Bei der OCR werden die erwarteten Textmarken einzeln mit einem Haken für erkannte Marken
ausgegeben. So lässt sich unterscheiden, ob die Aufnahme unscharf ist oder ob eine
Kalibrierungsmarke falsch vermessen wurde.

## 9. Tests und Nachvollziehbarkeit

Die Erkennung wird mit synthetischen PNG-Fällen und echten Smartphone-Fotos geprüft:

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
