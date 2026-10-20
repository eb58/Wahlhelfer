# Algorithmus der Ankreuzerkennung

Dieses Dokument beschreibt den derzeit implementierten Erkennungsweg in
`src/erfassungsplatz/erkennung/ankreuzErkennung.js`. Die Anwendung sucht keine Ankreuzfelder im Bild. Ihre Lage
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
- `stimmen`: Stimmen, Auswahlzahl und die vermessenen Felder mit Nummer und Beschriftung
- `thresholds`: die Grundschwellen für leer, unklar und angekreuzt

`loadKalibrierung()` prüft die Datei und wandelt die Feldkoordinaten zusätzlich in
rahmenrelative Koordinaten um. Dadurch kann dieselbe Kalibrierung bei einer anderen
Auflösung oder einem anderen Bildausschnitt verwendet werden.

## 2. Bildvorbereitung

Im Browser wird eine Aufnahme in `browserImage.js` so verkleinert, dass die kürzere Kante
höchstens 1600 Pixel misst (`belegSize()`). Bei hochkant gespeicherten Fotos ist das die Breite;
bei langen Europawahlzetteln wird also nicht die lange Kante begrenzt. Ein quer gespeichertes
Foto bleibt dadurch groß genug, um seine Lage zu erkennen; der aufgerichtete Beleg ist wieder
1600 Pixel breit. Transparente Pixel werden vor der Auswertung
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
(`src/erfassungsplatz/erkennung/frameQuad.js`). Das Vorgehen stammt aus dem Sudoku-Scanner (`algorithms-js`):

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
Schnittpunkte). Diese Suche ist teuer und dient deshalb nur noch als weiterer Kandidat.

Führt auch sie zu keiner Ringausrichtung, wird das Foto abgelehnt („Aufnahme bitte gerade,
scharf und vollständig wiederholen“). Einen OCR-Rückfall gibt es nicht mehr: Auf den 53 echten
Fotos wertete er bei abgeschalteter Ringsuche 3 Aufnahmen falsch, ohne einen Zweifelsfall zu
melden - eine davon als Stimme für den falschen Kandidaten.

Nach der gemeinsamen Ausrichtung muss jedes einzelne Feld auf einem gedruckten Ring liegen
(`ringScore` mindestens 0,3). Die Ausrichtung selbst braucht nur 6 passende Ringe; kopfüber liegen
beim Bundestagszettel 8 bis 10 von 14 Ringen fast symmetrisch auf anderen, und ohne diese Prüfung
wurde ein kopfüber liegendes Foto ohne Meldung falsch gewertet. Aufrecht liegt der schwächste Ring
auf allen echten Fotos bei mindestens 0,4, kopfüber bei höchstens 0,2.

Liegt der Zettel flach, speichert das Smartphone das Foto oft quer (EXIF-Orientierung 1, also
wirklich quer). Trägt die Aufnahme nicht, versucht `recognizeInAnyRotation()` beide
Vierteldrehungen und nimmt eine nur, wenn genau eine trägt. Das Ergebnis nennt die Drehung
(`rotation`); der Erfassungsplatz erzeugt den Beleg dann aus der Aufnahme aufrecht neu und
erkennt genau diesen erneut, damit der gespeicherte Beleg die Wertung reproduziert.

## 4. Primärer Erkennungsweg: gedruckte Ankreuzringe

Die Ringausrichtung ist der einzige Weg für Smartphone-Fotos.

### 4.1 Grobe Verschiebung

Aus allen vermessenen Feldlagen wird zunächst eine gemeinsame Verschiebung gesucht
(`findRoughRingShift`). Für jeden Kandidaten wird die Dunkelheit auf dem erwarteten
Ring mit der Dunkelheit in seinem inneren und äußeren Umfeld verglichen:

```text
Ringwert = Ringdunkelheit - 0,55 * mittlere Umfeld-Dunkelheit
```

Zuerst wird ein Raster durchsucht (`dx` ungefähr -90 bis +90 Pixel, `dy` abhängig vom
Ringradius) mit 32 Punkten je Kreis, anschließend die beste Stelle mit 48 Punkten lokal
verfeinert. Oberer und unterer Bereich
werden dabei stärker gewichtet, weil sie für eine globale Verschiebung besonders
informativ sind.

### 4.2 Lokale Ringsuche

Für jedes Feld wird ein kleiner, perspektivisch normalisierter Ausschnitt erzeugt
(`normalizeField`). Innerhalb des Ausschnitts wird der Ring im Umkreis von 1,2 Ringradien
verschoben und mit 72 Messpunkten bewertet. Die Messung berücksichtigt den Ring und sein
Umfeld, nicht nur die Mitte des Feldes.

Gesucht wird grob nach fein: zuerst jede zweite Position im ganzen Fenster mit 48 Punkten
je Kreis, danach pixelgenau und mit allen 72 Punkten um die beste.

Bei der Messung, nach der gemeinsamen Ausrichtung, liegt der Ring meist schon fast genau an
der erwarteten Stelle (99 % innerhalb von 0,14 Ringradien). Gesucht wird deshalb erst nur im
Umkreis von 0,3 Ringradien; liegt der beste Ring dort am Fensterrand oder ist er schwach
(`ringScore` unter 0,45), wie bei den Ankern im Umkreis von 1,2 Ringradien. Papierwölbung kann
den Ring lokal um mehr als einen Radius verschieben (`fotos/eaa5ff69-...`). An künstlich um
0,2 bis 1,1 Radien verschobenen Feldern liefert das genau dieselben Wertungen wie die stets
weite Suche. Die Grob-Punktzahlen haben etwa doppelten Abstand zur Bruchstelle an den
Testfotos; brechen sie, wird das Foto abgelehnt, nicht falsch gewertet.

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
Transformation liegt gemeinsam in `src/erfassungsplatz/erkennung/leastSquares.js`.

**Eine Ringspalte:** Liegen alle Ringe untereinander (Europawahl, x-Spanne unter 80 Pixel),
ist die Streckung quer zur Spalte aus den Ringen nicht bestimmbar. Sie bleibt dann wie vom
Rahmen vorgegeben; bestimmt werden nur Lage, Neigung und Längsstreckung, und als Startlösung
genügen Zweierkombinationen.

Danach werden alle kalibrierten Feldlagen mit dieser Transformation projiziert und lokal
noch einmal auf ihren gedruckten Ring eingerastet.

## 5. Scans

Füllt das Papier das Bild (Scan), gibt es keine Rahmenkandidaten und keine Ringausrichtung.
Die Felder werden dann aus dem geraden Rahmen von `findFrame()` rahmenrelativ projiziert und mit
`adjustFeld` im kleinen Umkreis auf ihren gedruckten Ring eingerastet.

## 6. Messung der Ankreuzfelder

Für jedes Feld wird ein Innenkreis mit ungefähr 68 % des Ringradius ausgewertet. Der Ring
selbst wird nicht als Markierung gezählt, weil er auf jedem leeren Musterzettel vorhanden
ist. Der `Fuellgrad` ist der Anteil der Pixel, die mindestens 0,07 dunkler sind als das Papier
an ihrer Stelle (absolut mindestens 0,12 - dünner Bleistift erreicht auf dem Foto nur rund 0,15).

Das Papier wird bei Fotos als schräge Ebene geschätzt: auf einem Kranz zwischen 115 % und 140 %
des Ringradius, also außerhalb des gedruckten Rings, je Achtelsektor das 30. Perzentil. Tabellenlinien
und über den Ring hinausgehende Striche liegen darüber und zählen nicht. Ein Schattenverlauf quer
über das Feld wird dadurch nicht zum Strich, ein ganz ausgemaltes Feld hebt seinen eigenen
Hintergrund nicht an. Erst so reicht der kleine Abstand von 0,07, mit dem auch dünne, blasse
Kugelschreiberkreuze auf getöntem Papier zählen (`fotos/blau-e4-z4.jpg`). Leere Felder
liegen auf allen echten Fotos erst ab 0,03 überhaupt über dem Papier. Scans messen weiter mit
festem Schwellwert (`darkRatio`).

Die Statusschwellen werden bei ausgerichteten Aufnahmen an den Bildsockel angepasst:

- Ringausrichtung: 65. Perzentil als Baseline, Mindestabstände +0,06 und +0,045
- Scans: die konfigurierten Grundschwellen unverändert

Die berechneten Werte werden jeweils mindestens durch die konfigurierten Grundschwellen
begrenzt (in allen Kalibrierungen `angekreuzt` 0,10 und `zweifel` 0,03). Leere Felder messen
auf den echten Fotos höchstens 0,001, das blasseste Bleistiftkreuz 0,124
(`fotos/PXL_20261020_094857790.MP.jpg`). Daraus entsteht je Feld einer der drei Zustände:

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

Ein Zettel ist eindeutig erkannt, wenn mindestens eine Stimme `gueltig` und jede weitere
`gueltig` oder sicher `leer` ist. Nur solche Zettel kommen im Erfassungsplatz auf den Stapel
(`isUnambiguous()`, `addZettel()`). Ein ganz leerer Zettel und jeder mit `mehrfach` oder
`zweifelsfall` wird beiseitegelegt; darüber entscheidet der
Wahlvorstand am Papierzettel.

## 8. Fehler- und Diagnoseverhalten

Die Verarbeitung bricht ab, wenn keine ausreichende Zettellage erkannt wird oder bei einem
Foto die Ringausrichtung keine belastbare Geometrie liefert. Ein Foto wird lieber
abgelehnt als geraten gewertet. Ein Ablaufprotokoll gibt es nicht: Erkannt wird genau der
gespeicherte Beleg, jede Wertung lässt sich deshalb in Node an diesem Beleg nachrechnen.

Auf einem PC zeigt die Oberfläche die Aufnahme mit den Ankreuzfeldern als farbige Ringe
(`drawFelder`: grün angekreuzt, ocker unklar, grau leer). Daran sieht man sofort, ob die
Ausrichtung stimmt. Auf dem Smartphone entfällt die Vorschau, dort liegt der Zettel vor einem.

Ein Foto von 1600 Pixel Breite braucht für die Erkennung am PC etwa 230 ms.

## 9. Tests und Nachvollziehbarkeit

Die Erkennung wird mit drei Arten von Testdaten geprüft. Sie liegen je Zettelart unter
`Testdaten/<kalibrierung>/`:

- `fotos/`: echte Smartphone-Fotos, bisher nur vom Bundestagszettel (69 Stück aus fünf
  Aufnahmeserien und ein gespeicherter Beleg, im Manifest als `serie`; einige davon quer aufgenommen),
- `synthetisch/`: alle künstlich erzeugten Fälle mit einem gemeinsamen Manifest, je Fall `art`:
  `scan` sind aus dem Musterzettel erzeugte PNG-Fälle, bei denen das Papier das Bild füllt (Kreuze,
  Mehrfach, Rauschen, Drehung; bisher nur Bundestagszettel, geprüft in `test/fixtures.test.js`),
  `foto` für jede Zettelart drei künstliche Fotos (gerade, leicht schräg, 4 Grad gedreht), erzeugt
  mit `node scripts/erzeugeSynthetischeFotos.js`, das die Scan-Fälle im Manifest stehen lässt.

Fotos und synthetische Fotos werden über die Ankreuzringe gewertet. Die Tests laden
JPEGs mit `sharp` und verkleinern sie wie der Browser (kürzere Kante 1600 Pixel).

```powershell
npm test
```

Die Kalibrierung kann zusätzlich sichtbar geprüft werden:

```powershell
python scripts/pruefeKalibrierung.py Kalibrierungen/bundestagswahl-2017.json pruefung-tmp.png
```

Die Erkennung läuft vollständig lokal im Browser; zum Server gehen nur Wertung und Beleg.
