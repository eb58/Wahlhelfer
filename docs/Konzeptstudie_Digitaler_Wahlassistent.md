# Konzeptstudie: Scan-gestützte Auszählung von Papierstimmzetteln

> Ein öffentlich überprüfbares, menschlich kontrolliertes Assistenzsystem für Wahlvorstände

**Konzeptname: Digitaler Wahlassistent**

Adressat: Prof. Dr. Stephan Bröchler, Landeswahlleiter für Berlin

Stand: 30. Juli 2026

Version: 1.4 - Normsprachliche Terminologie

> **Leitidee:** Das Papier bleibt die maßgebliche Originalurkunde. Smartphones öffnen per Link eine Webanwendung, prüfen das Bild und die Ankreuzerkennung zunächst unmittelbar auf dem Gerät; die Cloud führt die unabhängige Gegenprüfung, Protokollierung und Aggregation durch. Unklare Fälle entscheidet weiterhin der Wahlvorstand.

*Rechtliche Vorprüfung und technisches Zielbild - kein abschließendes Rechtsgutachten*

# Kurzfassung und Empfehlung

Die Idee ist technisch plausibel und adressiert ein reales Belastungsproblem: Nach einem langen Wahltag müssen ehrenamtliche Wahlvorstände viele Stimmzettel unter Zeitdruck sortieren, mehrfach zählen, Erst- und Zweitstimmen auseinanderhalten und Zahlen fehlerfrei übertragen. Mit zunehmender Zahl von Parteien, Wahlvorschlägen und gleichzeitig stattfindenden Abstimmungen steigt die organisatorische Komplexität. \[2, 3\]

> **Empfehlung:** Berlin sollte einen ergebnisoffenen, öffentlich begleiteten Pilotversuch für eine scan-gestützte Auszählungsassistenz starten. Im Pilot bleibt die manuelle Auszählung allein verbindlich. Erst nach nachgewiesener Genauigkeit, Zeitersparnis, öffentlicher Verständlichkeit, IT-Sicherheit und einer ausdrücklichen gesetzlichen Grundlage darf über einen amtlichen Einsatz entschieden werden.

Der Kern ist nicht "Handys zählen Stimmen", sondern eine kontrollierte Kombination aus Papier, handelsüblichen Smartphones, einer installierungsfreien Webanwendung, lokaler Vorprüfung im Browser, unabhängiger Cloud-Gegenprüfung, offener Software, Vier-Augen-Prinzip und menschlicher Entscheidungshoheit. Für die Aufnahme sind keine Spezialkameras, Halterungen, Scanmatten oder Sonderbeleuchtung erforderlich. Die Smartphones werden aus der Hand bedient; die Webanwendung prüft Bildausschnitt, Schärfe, Perspektive und Vollständigkeit und zeigt unmittelbar eine vorläufige Erkennung an.

Die Einführung kann dauerhaft gemischt erfolgen. Zunächst arbeiten nur einzelne Briefwahlvorstände mit der Assistenz, später gegebenenfalls ausgewählte Urnenwahllokale. Alle übrigen Wahlbezirke zählen weiterhin nach dem bisherigen Verfahren. Damit wird die Transparenz zunächst nur für die teilnehmenden Bezirke erweitert, das operative und rechtliche Risiko aber bewusst begrenzt.

Bei der üblichen Besetzung mit acht Wahlhelfern können vier Zweiergruppen parallel arbeiten. Unter der ambitionierten Annahme von drei bis vier Sekunden je klarem Stimmzettel sinkt der reine Erfassungsdurchlauf für 600 bis 700 Stimmzettel rechnerisch auf etwa 7 Minuten 30 Sekunden bis 11 Minuten 40 Sekunden. Für den gesamten Vorgang einschließlich Aufbau, Eingangsabgleich, Zweifelsfällen und Abschlusskontrolle ist im Pilot zunächst mit etwa 20 bis 35 Minuten zu planen.

Ein zentraler demokratischer Zusatznutzen ist die unabhängige Nachprüfbarkeit. Die Cloud soll nicht bloß eine fertige Zahl liefern, der man vertrauen muss. Für jeden teilnehmenden Wahlbezirk entsteht ein offenes, maschinenlesbares Prüfpaket mit Datenformat, Zählregeln, Prüfsummen, Sitzungsprotokoll, menschlichen Bestätigungen, Zweifelsfallentscheidungen und signierten Aggregaten. Jede interessierte Person kann den veröffentlichten Referenzcode verwenden oder eine eigene Software schreiben und damit die Ergebnisbildung selbst reproduzieren.

## Vier zentrale Designentscheidungen

- Keine individuelle Seriennummer auf dem ausgegebenen Stimmzettel. Der QR-Code enthält nur Wahlart, Wahlgebiet, Stimmzetteltyp, Layoutversion und Prüfsumme. Eine digitale laufende Nummer entsteht erst nach Öffnung und Durchmischung der Urne.

- Keine vollautomatische Letztentscheidung. Die Software erkennt klare Markierungen; Mehrfachmarkierungen, schwache Kreuze, Zusätze und sonstige Zweifelsfälle gehen sichtbar an den Wahlvorstand.

- Keine elektronische Stimmabgabe. Smartphone-Webanwendung und Cloud werden ausschließlich nach Öffnung der Urne als Auszählungsassistenz genutzt; Papier und manuelle Notfallauszählung bleiben jederzeit verfügbar.

- Keine unbedachte Veröffentlichung roher Stimmzettelfotos. Offen veröffentlicht werden Software, Datenformat, Prüfdaten, Ergebnisdateien und kryptografische Nachweise. Originalbilder sollen grundsätzlich auf einfachen Antrag zugänglich sein; Ausnahmen müssen konkret mit Wahlgeheimnis, Sicherheit oder einem laufenden Verfahren begründet werden.

## Warum das Thema gerade zu Berlin passt

Der Berliner Landeswahlleiter betont selbst, die digitale Transformation der Wahlorganisation dürfe nicht auf E-Voting reduziert werden; Digitalisierung könne auch Vorbereitung und Wahlniederschriften betreffen. Genau hier setzt der digitale Wahlassistent an: Die Stimmabgabe bleibt unverändert auf Papier, digitalisiert wird erst die Ergebnisermittlung nach Schließung des Wahllokals. Die Berliner Expertenkommission hat zudem Standardisierung und Professionalisierung als zentrale Lehren aus 2021 hervorgehoben. \[1, 2, 6\]

# 1. Ausgangslage: Wo der heutige Prozess belastet

Die Bundeswahlordnung bildet die Belastung geradezu ab: § 69 BWO verlangt zunächst mehrere Stimmzettelstapel, sodann Prüfungen und Zählungen unter gegenseitiger Kontrolle sowie eine weitere Sortierung nach Zweitstimmen bei abweichender Kombination. Dieses Verfahren ist öffentlich und robust, bindet aber viele Hände, viel Tischfläche und hohe Konzentration. \[3\]

| **Belastung**          | **Heutige Ursache**                                                                             | **Beitrag des Assistenzsystems**                                                                               |
|------------------------|-------------------------------------------------------------------------------------------------|----------------------------------------------------------------------------------------------------------------|
| Viele Stapel           | Parteien, Kandidaten, Erst-/Zweitstimmen und ungültige Fälle benötigen getrennte Behandlung. | Jeder Zettel wird einmal erfasst; die Software führt mehrere Auswertungen aus demselben Bild durch.            |
| Doppelte Arbeit        | Erst- und Zweitstimme werden in getrennten Arbeitsschritten ausgewertet.                        | Beide Stimmen werden gleichzeitig erkannt und getrennt aggregiert.                                             |
| Übertragungsfehler     | Zwischensummen werden von Hand in Niederschriften und Meldungen übertragen.                     | Summen entstehen automatisch aus Einzeldatensätzen; Plausibilitätsprüfungen warnen bei Abweichungen.           |
| Stress und Ermüdung    | Die anspruchsvollste Phase beginnt nach einem langen Einsatztag.                                | Routinefälle werden standardisiert; Aufmerksamkeit konzentriert sich auf Zweifelsfälle.                        |
| Schwierige Nachprüfung | Eine spätere Prüfung erfordert das Öffnen versiegelter Pakete und erneutes manuelles Sortieren. | Ein signiertes digitales Abbild und ein Prüfprotokoll ermöglichen gezielte Kontrollen; Papier bleibt Referenz. |

Wichtig ist eine nüchterne Erwartung: Ein serieller Scanvorgang kann selbst Zeit kosten. Bei acht Wahlhelfern stehen jedoch vier parallele Zweiergruppen mit je einem Smartphone zur Verfügung. Der Pilot muss messen, ob diese vier Erfassungsteams die entfallende Stapel- und Übertragungsarbeit tatsächlich überkompensieren und ob der nahezu vierfache theoretische Durchsatz praktisch erreicht wird. Der Nutzen darf nicht vorausgesetzt, sondern muss unter realistischen Bedingungen bewiesen werden.

# 2. Zielbild und klare Nicht-Ziele

## 2.1 Zielbild

Der digitale Wahlassistent ist ein optisches Markierungserkennungssystem (OMR), kein Internetwahlsystem zur Stimmabgabe, sondern eine hybride Auszählungsassistenz nach Öffnung der Urne. Eine Person legt jeden Stimmzettel gut sichtbar auf den Tisch. Die zweite Person öffnet über einen Link die Webanwendung, erlaubt einmalig den Kamerazugriff und fotografiert den Zettel aus der Hand. Der Browser prüft das Bild zunächst unmittelbar auf dem Smartphone: Lage, Schärfe, Stimmzetteltyp und Markierungsfelder. Bei einem klaren Zettel zeigt er beispielsweise "Erststimme: Partei X" und "Zweitstimme: Partei Y" an; bei einem unklaren Zettel zeigt er den Prüfhinweis. Erst danach werden Bild und Vorwertung verschlüsselt an die Cloud übertragen. Dort erfolgt eine unabhängige zweite Erkennung, bevor das Ergebnis aggregiert wird.

## 2.2 Nicht-Ziele

- keine elektronische Stimmabgabe und keine Veränderung des Wahlakts;

- keine biometrische Erfassung und keine Verknüpfung mit dem Wählerverzeichnis;

- keine endgültige Bewertung zweifelhafter Stimmzettel durch ein KI-Modell;

- keine zentrale Online-Abhängigkeit für die Stimmabgabe; die Auszählungsassistenz darf die Cloud nutzen, braucht aber eine dokumentierte manuelle Rückfallebene;

- keine Abschaffung des Wahlvorstands oder der öffentlichen Beobachtung;

- keine Vernichtung oder Ersetzung der Papierstimmzettel.

# 3. Stimmzettelgestaltung

## 3.1 QR-Code: Metadaten, aber keine Individualisierung

Ein QR-Code ist sinnvoll, sofern er auf allen Stimmzetteln desselben Typs identisch ist. Er sollte ausschließlich folgende Angaben enthalten: Wahl-ID, Gebietskörperschaft, Wahlkreis bzw. Stimmzetteltyp, Layoutversion und Prüfsumme. Dieselben Angaben werden zusätzlich menschenlesbar gedruckt. So lädt die Erfassungssoftware automatisch die richtige Felddefinition, ohne eine einzelne Wählerin oder einen einzelnen Wähler identifizierbar zu machen.

> **Nicht empfohlen:** Eine vorab gedruckte, fortlaufende Einzelnummer kann als vermeintlicher oder tatsächlicher Beleg der Stimmabgabe missbraucht werden. Wird die Ausgabe-Reihenfolge beobachtet oder protokolliert, entsteht zumindest ein Rückverfolgungsverdacht. Das schwächt Vertrauen und kann Anreize für Stimmenkauf oder Zwang schaffen.

## 3.2 Lageerkennung

Für die geometrische Justierung sollte nicht ein zweiter individueller QR-Code verwendet werden. Geeigneter erscheinen vier einfache, nicht codierte Passmarken in den Ecken. Sie erlauben Perspektivkorrektur, Drehung, Größenprüfung und die Erkennung abgeschnittener Bereiche. Die rechte obere Ecke muss zugleich mit der bestehenden Regelung für Stimmzettelschablonen vereinbar bleiben; § 45 BWO sieht dort eine Lochung oder einen Eckschnitt vor. \[3\]

## 3.3 Digitaler Beleg erst nach Urnenöffnung

Beim Scan erhält der Datensatz eine zufällige Sitzung-ID und eine laufende Erfassungsnummer. Diese Kennung wird nicht auf den Stimmzettel gedruckt und nicht mit Ausgabezeit, Wählerverzeichnis oder Personendaten verbunden. Ein kryptografischer Hash bindet Bild, Erkennungsergebnis und Prüfentscheidung zusammen. Dadurch lassen sich Doppelaufnahmen, nachträgliche Änderungen und fehlende Datensätze feststellen, ohne einen "Wahlbeleg" für die wählende Person zu erzeugen.

# 4. Ablauf im Wahllokal

1.  **Vorbereitung:** Für vier Zweiergruppen werden vier Smartphones bereitgestellt. Eine Softwareinstallation ist nicht erforderlich: Jede Gruppe öffnet denselben Web-Link beziehungsweise einen darauf verweisenden QR-Code und erhält eine eigene Sitzungskennung. Zusätzliche Halterungen, Scanmatten oder Sonderbeleuchtung sind nicht erforderlich. Die Webanwendung lädt die signierten Stimmzetteldefinitionen aus der Cloud; jede Gruppe führt mit Musterzetteln einen kurzen öffentlichen Selbsttest für Bildqualität und Markierungserkennung aus.

2.  **Zählabgleich:** Vor der inhaltlichen Auswertung werden Stimmzettel, Stimmabgabevermerke und Wahlscheine wie bisher zahlenmäßig abgeglichen. Abweichungen werden dokumentiert.

3.  **Erfassung im Tandem:** Person A nimmt genau einen Zettel vom Eingangsstapel und breitet ihn plan auf dem Tisch aus. Person B fotografiert ihn aus der Hand und sagt Erst- und Zweitstimme laut an. Person A bestätigt die Ansage oder widerspricht unmittelbar.

4.  **Automatische Gegenprüfung:** Das Smartphone führt zunächst lokal eine Vorprüfung durch und zeigt die erkannte Partei beziehungsweise einen Zweifelsfall an. Anschließend überträgt die Webanwendung Bild, Vorwertung und Qualitätsdaten verschlüsselt an die Cloud. Dort liest eine unabhängige Prüfkomponente erneut Layout, Markierungsfelder und Qualitätsmerkmale und vergleicht das Ergebnis mit der bestätigten menschlichen Ansage. Erst bei Übereinstimmung und grünem Qualitätssignal wandert der Zettel in den Ausgangsstapel.

5.  **Zweifelsfall:** Bei menschlichem Widerspruch, technischer Abweichung oder unklarer Markierung wird der Zettel ausgesondert und dem gesamten Wahlvorstand vorgelegt; Entscheidung, Begründung und Abstimmung werden protokolliert.

6.  **Reconciliation:** Erfasste Zettelzahl, Papierstapel, Wählerzahl und Ergebnisdatei werden abgeglichen. Fehlende oder doppelte Datensätze blockieren den Abschluss.

7.  **Abschluss:** Der Wahlvorstand bestätigt die Summen, signiert die Niederschrift und versiegelt Papier sowie Datenträger. Erst anschließend werden signierte Ergebnisdaten über den amtlichen Meldeweg übertragen.

## 4.1 Zweiergruppe und Zeitmodell

Die Zweiergruppe verbindet Geschwindigkeit mit dem bekannten Prinzip gegenseitiger Kontrolle. Bei acht Wahlhelfern werden vier Tandems gebildet. In jedem Tandem legt Person A den Stimmzettel auf; Person B löst die Aufnahme aus und sagt Erst- und Zweitstimme an. Person A bestätigt oder widerspricht. Die menschliche Ansage erfolgt vor der sichtbaren Maschinenwertung, damit die Software die Wahrnehmung nicht vorprägt. Bei einem klaren Zettel lautet der Rhythmus: auflegen - aufnehmen - Erst- und Zweitstimme ansagen - bestätigen - weiterschieben.

Alle vier Teams arbeiten gleichzeitig auf getrennten Eingangsstapeln. Die Cloud führt die Datensätze fortlaufend zusammen und verhindert doppelte Erfassungsnummern. Abweichungen oder unklare Stimmzettel werden nicht im Tandem abschließend entschieden, sondern in einen gemeinsamen Zweifelsstapel gelegt und anschließend dem gesamten Wahlvorstand vorgelegt. Dadurch unterbrechen Sonderfälle den parallelen Routinefluss nicht unnötig.

## 4.2 Webanwendung und Cloud-Auswertung

Die Bedienung erfolgt vollständig im mobilen Browser. Die Wahlhelfer benötigen keinen App-Download und keine lokale Installation, sondern nur einen bereitgestellten Link. Nach dem Öffnen wird die Kamera-Berechtigung erteilt; die Webanwendung zeigt einen einfachen Aufnahmeausschnitt und führt die erste Bild- und Ankreuzprüfung lokal im Browser aus. Das Smartphone zeigt die vorläufige Erkennung unmittelbar an. Erst danach werden Bild, Vorwertung und Prüfdaten über eine verschlüsselte Verbindung an den Cloud-Dienst übertragen.

Die Cloud-Architektur sollte pro Wahl, Wahlbezirk und Sitzung logisch getrennte Bereiche verwenden. Jede Aufnahme erhält eine zufällige Sitzungs-ID, einen Zeitstempel und einen kryptografischen Bild-Hash, aber keine Verbindung zu einem Wählerverzeichnis oder zu einer Person. Die Ergebnisansicht im Browser zeigt der Zweiergruppe die lokale Vorwertung, die unabhängige Cloud-Wertung, das Qualitätsniveau und gegebenenfalls das Originalbild zur gemeinsamen Prüfung.

Nach Abschluss des Wahlbezirks erzeugt die Cloud zusätzlich ein signiertes Prüfpaket. Es enthält mindestens die anonymisierten Datensätze je Stimmzettel, die lokale Vorwertung, die unabhängige Cloud-Wertung, die menschliche Bestätigung oder Zurückweisung, die Entscheidung bei Zweifelsfällen, die Zuordnung von Erst- und Zweitstimme, die verwendeten Regelversionen und die kryptografischen Hashes. Ein unabhängiges Programm muss aus diesem Paket ohne Zugriff auf die Cloud und ohne Kenntnis der internen Implementierung dieselben Summen berechnen können.

Für einen amtlichen Pilot sind ein deutscher oder europäischer Betriebsstandort, Auftragsverarbeitungsvertrag, Ende-zu-Ende-Transportverschlüsselung, Verschlüsselung ruhender Daten, strenge Rollenrechte, unveränderbare Audit-Protokolle und eine kurze, gesetzlich geprüfte Aufbewahrungsfrist erforderlich. Rohbilder dürfen nicht automatisch öffentlich oder in privaten Smartphone-Fotogalerien landen. Bei einem Verbindungs- oder Cloud-Ausfall kann die lokale Vorprüfung weiterhin einen Hinweis anzeigen; eine amtlich verwertbare Entscheidung wird aber erst nach Cloud-Gegenprüfung freigegeben, andernfalls wird auf die manuelle Auszählung zurückgefallen.

Als Erfahrungsannahme werden 600 bis 700 abgegebene Stimmzettel je Urnenwahllokal betrachtet. Für `N` Stimmzettel, `s` Sekunden je Stimmzettel und `k` parallel arbeitende Smartphones beziehungsweise Teams gilt für den idealisierten Erfassungsdurchlauf:

> `T = (N × s) / k`

| **Menge**  | **Teams/Smartphones** | **3 Sekunden/Zettel** | **4 Sekunden/Zettel**  | **Vorläufiger Planwert einschließlich Nebenzeiten** |
|------------|---------------|-----------------------|------------------------|-----------------------------------------------------|
| 600 Zettel | 1             | 30 Minuten            | 40 Minuten             | ca. 45-60 Minuten                                   |
| 600 Zettel | 4             | 7 Minuten 30 Sekunden | 10 Minuten             | ca. 20-30 Minuten                                   |
| 700 Zettel | 1             | 35 Minuten            | 46 Minuten 40 Sekunden | ca. 50-70 Minuten                                   |
| 700 Zettel | 4             | 8 Minuten 45 Sekunden | 11 Minuten 40 Sekunden | ca. 20-35 Minuten                                   |

Die Rechnung beschreibt ausschließlich den idealisierten Durchlauf klarer Stimmzettel. Der Faktor vier gilt für diesen parallelisierbaren Arbeitsschritt, nicht automatisch für die gesamte Ergebnisermittlung. Aufbau, numerischer Eingangsabgleich, beschädigte oder zweifelhafte Zettel, technische Unterbrechungen, Zusammenführung der vier Datenströme und Abschlussprotokoll bleiben gemeinsame oder teilweise serielle Aufgaben.

> **Pilotannahme:** Drei bis vier Sekunden pro klarem Stimmzettel und eine nahezu lineare Skalierung auf vier handgehaltene Smartphones sind ambitionierte, aber testbare Ziele. Entscheidend ist die Gesamtzeit vom Öffnen der Urne bis zur unterschriebenen Niederschrift. Ein schneller Erfassungsdurchlauf allein wäre kein Erfolg, wenn Zweifelsfälle, Nachsortieren oder technische Unterbrechungen den Zeitgewinn wieder aufzehren.

# 5. Erkennungs- und Entscheidungslogik

Die Erkennung soll regelbasiert und nachvollziehbar sein. Ein neuronales Netz kann höchstens ergänzend zur Qualitätskontrolle dienen; die eigentliche Stimmwertung muss aus öffentlich dokumentierten Schwellenwerten und Wahlregeln folgen. Das erleichtert Reproduzierbarkeit, Zertifizierung und die Erklärung gegenüber Beobachtern.

| **Prüfstufe** | **Automatische Aufgabe**                                                            | **Menschliche Rolle**                                          |
|---------------|-------------------------------------------------------------------------------------|----------------------------------------------------------------|
| Bildqualität  | Schärfe, Reflexe, Vollständigkeit, Perspektive und richtige Vorderseite prüfen.     | Zettel neu auflegen, wenn die Aufnahme nicht freigegeben wird. |
| Layout        | QR-Code und Passmarken lesen; Feldkoordinaten und Wahlart zuordnen.                 | Bei nicht passendem oder beschädigtem Zettel eingreifen.       |
| Markierung    | Für jedes Feld "leer", "markiert" oder "unklar" bestimmen.                          | Unsichere Felder sichtbar prüfen.                              |
| Wahlregel     | Mehrfachmarkierung, fehlende Stimme und formale Konflikte als Prüfhinweis erkennen. | Nur der Wahlvorstand entscheidet strittige Gültigkeitsfragen.  |
| Aggregation   | Freigegebene Erst- und Zweitstimmen getrennt summieren; Prüfsummen bilden.          | Summen und Differenzberichte bestätigen.                       |

> **Grundsatz:** Das System darf lieber zu viele Stimmzettel als "unklar" vorlegen als einen zweifelhaften Zettel unbemerkt falsch zuzuordnen. Der Pilot optimiert daher nicht nur Trefferquote, sondern vor allem die Rate stiller Fehler.

# 6. Transparenz und unabhängige Nachzählbarkeit

Der Transparenzgedanke der Ausgangsidee ist wichtig: Dritte sollen Ergebnisse mit eigener Software nachvollziehen können und auf Antrag auch die zugrunde liegenden Stimmzettelbilder einsehen dürfen. Ein einzelner anonymisierter Stimmzettel ist inhaltlich grundsätzlich kein Geheimnis: Er zeigt nur, welche Markierung auf diesem Papier vorgenommen wurde, nicht wer ihn ausgefüllt hat. Die Bilder enthalten in der Regel keine Namen oder sonstigen direkten personenbezogenen Daten. Der Schutzbedarf entsteht erst durch eine mögliche Verknüpfung mit einer Person oder durch den Missbrauch als beweisbarer Wahlbeleg. Trotzdem muss geprüft werden, ob ungewöhnliche Handschriften, Markierungen, die Reihenfolge oder eine Kombination mit anderen Informationen in Einzelfällen Rückschlüsse ermöglichen. Der Zugang sollte deshalb einfach, zeitnah und grundsätzlich ohne besondere Begründung möglich sein; eine Ablehnung darf nur auf einer konkreten, dokumentierten Gefahr für Wahlgeheimnis, Sicherheit oder ein laufendes Verfahren beruhen. \[3\]

## 6.1 Drei Transparenzebenen

| **Ebene**                 | **Veröffentlichung**                                                                                                                                       | **Prüfmöglichkeit**                                                                              |
|---------------------------|------------------------------------------------------------------------------------------------------------------------------------------------------------|--------------------------------------------------------------------------------------------------|
| 1 - vollständig offen     | Quellcode, Build-Anleitung, Datenformat, Stimmzetteldefinitionen, Testkorpus, Wahlregeln, Sicherheitskonzept, Prüfberichte.                                | Jeder kann eine eigene Software schreiben, die Referenzimplementierung reproduzieren und die Summenlogik nachvollziehen. |
| 2 - offene Ergebnisbelege | Signierte Wahlbezirksdateien, anonymisierte Einzeldatensätze, lokale Vorwertungen, Cloud-Gegenprüfungen, menschliche Entscheidungen und kryptografisches Manifest. | Jeder kann Vollständigkeit, Unverändertheit, Konfliktbehandlung und Aggregation unabhängig prüfen.                      |
| 3 - Originalbilder auf Antrag | Originalbilder und Entscheidungsprotokolle in einem transparenten, gesetzlich geregelten Prüfportal; Zugang grundsätzlich für jeden Antragsteller. | Antragsteller können Markierung und Wertung zettelweise mit dem veröffentlichten Ergebnis vergleichen; begrenzte Ausnahmen müssen konkret begründet werden. |

Ein automatischer Massendownload aller Rohbilder ist nicht zwingend erforderlich. Entscheidend ist ein echter, praktisch nutzbarer Antragszugang: einfache Antragstellung, klare Frist, unveränderte Originaldatei, sichtbare Zuordnung zum Wahlbezirk und ein Prüfprotokoll. Der Antragsteller sollte die Bilder lokal mit eigener Software auswerten können. Wird ein Bild ausnahmsweise zurückgehalten oder nur in normalisierter Form herausgegeben, müssen Grund, Umfang und Rechtsbehelf transparent dokumentiert werden. Der demokratische Prüfgedanke wird damit unterstützt, weil Software, Formate, Regeln, Hashes, anonymisierte Datensätze, Originalbilder und Aggregationslogik offen und unabhängig nachrechenbar sind.

## 6.2 Was der BSW-Fall zeigt - und was nicht

Bei der Bundestagswahl 2025 erhielt das BSW im endgültigen Ergebnis 4.277 Zweitstimmen mehr als im vorläufigen Ergebnis und verfehlte die Fünf-Prozent-Hürde nach amtlicher Feststellung um 9.529 Stimmen. Der Bundestag wies die auf Neuauszählung gerichteten Einsprüche im Dezember 2025 zurück. Ob und in welchem Umfang bei der ersten Auszählung einzelne Fehler aufgetreten sind, lässt sich ohne erneute Prüfung der Stimmzettel nicht zuverlässig beurteilen. Gerade bei einem derart knappen Abstand zeigt sich deshalb der Wert einer granularen, unveränderbaren und schnell prüfbaren Beleglage: Streitfälle könnten unmittelbar anhand der einzelnen Belege geprüft und entweder bestätigt oder im Keim erstickt werden. Der digitale Wahlassistent würde Fehler nicht unmöglich machen, aber ihre Feststellung, Eingrenzung und nachvollziehbare Bewertung erheblich erleichtern. \[5\]

# 7. Verfassungs- und wahlrechtliche Einordnung

## 7.1 Öffentlichkeit der Wahl

Das Bundesverfassungsgericht verlangt, dass die wesentlichen Schritte von Wahlhandlung und Ergebnisermittlung öffentlich überprüfbar bleiben und grundsätzlich ohne besondere Sachkenntnis verstanden werden können. Ein intransparentes automatisches Endergebnis wäre daher ungeeignet. Das vorgeschlagene System muss seine Erkennung sichtbar machen, jeden Zettel auf Wunsch anzeigen, öffentliche Testläufe erlauben und die menschliche Entscheidung dokumentieren. Beobachter müssen den Ablauf auch ohne Kenntnis von Programmcode plausibilisieren können. \[4\]

§ 54 BWO gewährleistet zudem den Zutritt zur Ermittlung und Feststellung des Wahlergebnisses. Der Scanplatz muss deshalb so gestaltet sein, dass Beobachter die Zahl der Zettel, den Qualitätsstatus, die vorgeschlagene Wertung und die Behandlung von Zweifelsfällen sehen können, ohne die Arbeit zu stören. \[3\]

## 7.2 Derzeitige Rechtslage

- § 69 BWO beschreibt für Bundestagswahlen einen manuellen Stapel-, Prüf- und Zählprozess. Ein digitaler Schattenlauf kann diesen Prozess testen, ihn derzeit aber nicht ohne Weiteres als amtliche Ergebnisermittlung ersetzen.

- § 35 BWahlG erlaubt Wahlgeräte zur Erleichterung von Stimmabgabe und Zählung unter Voraussetzungen. Ob und in welcher Form ein reines Erfassungs- und Zählassistenzsystem darunter fällt, muss ausdrücklich geklärt und gegebenenfalls spezialgesetzlich geregelt werden.

- §§ 72 und 73 BWO regeln Niederschrift, Beifügung strittiger Stimmzettel, Versiegelung und Schutz vor unbefugtem Zugriff. Für Bilder, Protokolle, Signaturen, Aufbewahrung und Löschung braucht es spiegelbildliche Regeln.

- Für Berliner Landes- und Bezirkswahlen sind Landeswahlgesetz und Landeswahlordnung entsprechend zu prüfen und anzupassen. Ein Bundestagswahleinsatz erfordert eine bundesrechtliche Lösung.

## 7.3 Rechtlicher Stufenplan

1.  **Stufe A - ohne amtliche Wirkung:** Labortests mit synthetischen Stimmzetteln, öffentliche Demonstrationen und Vergleichsmessungen. Keine echten Wahlunterlagen werden veröffentlicht.

2.  **Stufe B - genehmigter Schattenbetrieb:** Bei einer geeigneten Wahl läuft das System zusätzlich zur vollständig manuellen amtlichen Auszählung. Ergebnis und Zeitmessung werden erst nach Abschluss des amtlichen Prozesses ausgewertet.

3.  **Stufe C - gesetzlich geregelte Assistenz:** Nach positiver Evaluation schafft der Gesetzgeber Zuständigkeiten, Zertifizierung, Audit, Datenzugang, Aufbewahrung, Störfall- und Rückfallregeln.

4.  **Stufe D - möglicher amtlicher Regelbetrieb:** Die digitale Auswertung wird verbindlich, bleibt aber durch Papieroriginal, öffentliche Beobachtung, statistische Papierprüfung und vollständige manuelle Rückfalloption kontrollierbar.

# 8. IT-Sicherheit, Datenschutz und Wahlgeheimnis

Die Smartphone-Hardware dürfte im Vergleich zu Entwicklung, Prüfung und Betrieb nur einen kleinen Teil der Gesamtkosten ausmachen; Vertrauen entsteht durch die Kombination aus lokaler Vorprüfung und Web- sowie Cloud-Sicherheitsarchitektur. Die lokale Erkennung läuft nur im Browser-Speicher und schreibt die Aufnahme nicht automatisch in die private Fotogalerie. Web-Code, Stimmzetteldefinitionen und Ergebnisdateien sind digital signiert. Die Cloud erhält Bild, Vorwertung und Prüfdaten nur innerhalb freigegebener Sitzungen, führt unveränderbare Audit-Protokolle und trennt Wahlbezirke technisch voneinander.

| **Risiko**                      | **Beispiel**                                                               | **Gegenmaßnahme**                                                                                                                        |
|---------------------------------|----------------------------------------------------------------------------|------------------------------------------------------------------------------------------------------------------------------------------|
| Manipuliertes Gerät             | Der Browser zeigt eine systematisch falsche lokale Vorwertung an.          | Signierter Web-Code, unabhängige Cloud-Gegenprüfung, reproduzierbare Builds, Vier-Augen-Prinzip und Papieraudit.                          |
| Doppelte/fehlende Zettel        | Ein Zettel wird zweimal erfasst oder übersprungen.                         | Physischer Ein-/Ausgangsstapel, fortlaufende Sitzung-ID, Bildhash, Zählerabgleich und Abschlussblockade.                                 |
| Schlechte Aufnahme              | Unschärfe, ungünstiger Abstand oder Reflexion verändern die Erkennung.     | App prüft Bildqualität, gibt Aufnahmetipps und fordert bei Bedarf eine neue Aufnahme an.                                                   |
| Netz- oder Cloud-Ausfall        | Mobilfunk, WLAN oder der Cloud-Dienst fällt aus.                           | Zwei unabhängige Verbindungswege, sichtbare Statusanzeige, keine Löschung unbestätigter Datensätze und jederzeitige manuelle Auszählung. |
| Insiderfehler                   | Ein Zweifelsfall wird einseitig entschieden.                               | Öffentliche Anzeige, Vier-Augen-Prinzip, Beschluss des Wahlvorstands und unveränderbares Entscheidungsprotokoll.                         |
| Verletzung des Wahlgeheimnisses | Reihenfolge oder ungewöhnliche Markierungen werden als Stimmbeleg genutzt. | Keine individuelle Drucknummer, keine Wählerverknüpfung, Reihenfolgeschutz, kontrollierter Bildzugang und Datenschutz-Folgenabschätzung. |

# 9. Gerätevarianten

| **Variante**                          | **Stärken**                                                               | **Kritische Punkte**                                                                   | **Bewertung**                  |
|---------------------------------------|---------------------------------------------------------------------------|----------------------------------------------------------------------------------------|--------------------------------|
| BYOD-Smartphones + geschützte Webanwendung | Keine besondere Erfassungshardware, sehr geringe Einstiegskosten, handgehaltene Aufnahme und flexible Skalierung. | Unterschiede bei Kamera, Browser, Betriebssystem, Akkustand und Netzverbindung; freiwillige Nutzung, Vorabtest und Rückfallebene müssen geregelt werden. | Empfohlene Pilotvariante. |
| Von der Wahlbehörde geprüfte Reservegeräte + geschützte Webanwendung | Gleiche Webanwendung, aber verlässlicher Ersatz bei ungeeigneten oder nicht verfügbaren Privatgeräten. | Kleine Reservebeschaffung und Geräteverwaltung erforderlich. | Ergänzung für den Pilot, keine Voraussetzung für jedes Tandem. |
| Dedizierte Dokumentenscanner | Konstante Bildqualität und hoher Durchsatz. | Zusätzliche Beschaffung, Papierstau, geringere Flexibilität. | Nicht erforderlich; allenfalls Vergleichstest. |

Die ursprüngliche Smartphone-Idee bleibt damit im Kern erhalten: Es geht um handelsübliche Smartphones, die aus der Hand fotografieren, und eine webbasierte Bedienoberfläche. Besondere Erfassungshardware ist nicht vorgesehen. Die Webanwendung führt vor Beginn einen kurzen Gerätetest durch; ungeeignete oder nicht verfügbare Geräte werden durch andere vorhandene Smartphones oder wenige Reservegeräte ersetzt. Die Webanwendung darf dem privaten Gerät nicht vertrauen: Bild und Vorwertung werden in der Cloud unabhängig geprüft, und Papieroriginal, Vier-Augen-Prinzip sowie manuelle Rückfallebene bleiben maßgeblich. Eine Softwareinstallation ist nicht erforderlich.

Für einen vollständig besetzten Wahlvorstand genügen daher vier geeignete Smartphones und eine geschützte Cloud-Webanwendung. Die Software muss vier parallele Bildströme verarbeiten können, ohne dass die Teams aufeinander warten.

# 10. Pilot- und Evaluationskonzept

## 10.1 Pilotphasen

| **Phase**             | **Inhalt**                                                                                                                                                | **Abbruch-/Freigabekriterium**                                                                |
|-----------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------|-----------------------------------------------------------------------------------------------|
| 0 - Vorprüfung        | Wahlrecht, Datenschutz-Folgenabschätzung, Bedrohungsmodell, Nutzerinterviews mit Wahlhelfern.                                                           | Freigabe nur bei klarer rechtlicher Pilotgrundlage und beherrschbarem Datenschutz.            |
| 1 - Labor             | Synthetische Stimmzettel mit allen Markierungsarten, verschiedenen Stiften, Faltungen, Licht- und Kamerabedingungen.                                      | Keine stillen systematischen Zuordnungsfehler; Zweifelsfälle werden zuverlässig ausgesondert. |
| 2 - Öffentlicher Test | Open-Source-Veröffentlichung, Fehlerprämie, Hack-/Audit-Workshop, Test durch Parteien und Zivilgesellschaft.                                              | Keine offenen kritischen Sicherheitsbefunde.                                                  |
| 3 - Schattenpilot     | Zunächst einzelne freiwillige Briefwahlvorstände; manuelles Ergebnis bleibt allein amtlich. Zeit, Fehler und Bedienbarkeit werden unabhängig ausgewertet. | Mindestens gleiche Ergebnisqualität; nachgewiesene Entlastung; vollständige Reconciliation.   |
| 4 - Erweiterung       | Größere, zufällig ausgewählte und unterschiedlich strukturierte Wahlbezirke; unabhängiger Papierabgleich.                                                 | Vorab festgelegte Qualitäts-, Zeit- und Vertrauenskriterien werden erreicht.                  |

## 10.2 Messgrößen

- Übereinstimmung pro Stimme und pro Stimmzettel mit einer von Fachleuten adjudizierten Referenz;

- Zahl und Art stiller Fehler, offener Zweifelsfälle und nötiger Neuaufnahmen;

- Gesamtdauer vom Öffnen der Urne bis zur unterschriebenen Niederschrift;

- Durchsatz und Skalierungseffizienz bei einem, zwei und vier parallel arbeitenden Smartphones beziehungsweise Teams;

- aktive Arbeitszeit und subjektive Belastung der Wahlhelfer;

- Vollständigkeit: Papierzahl = erfasste Zettel = Datensätze = freigegebene Entscheidungen;

- Verständlichkeit für öffentliche Beobachter und Vertrauen der Beteiligten;

- Wiederholbarkeit der Auswertung durch eine unabhängige Implementierung;

- Sicherheitsbefunde, Störfälle und Zeit bis zur manuellen Rückfallebene.

> **Zeitpunkt:** Für einen amtlichen Einsatz bei der Berliner Wahl am 20. September 2026 ist das Vorhaben zu kurzfristig. Realistisch ist jetzt ein sauber vorbereiteter Labor- und Demonstrationspilot; ein Schattenbetrieb kommt erst bei einer späteren geeigneten Wahl und nach rechtlicher Freigabe in Betracht.

## 10.3 Stufenweiser und gemischter Rollout

Die Technik muss nicht flächendeckend eingeführt werden, um praktischen Nutzen zu stiften. Ein gemischter Betrieb ist organisatorisch möglich, sofern Ergebnisdateien eindeutig kennzeichnen, nach welchem Verfahren ein Wahlbezirk ausgezählt wurde, und die amtliche Aggregation beide Wege korrekt zusammenführt.

| **Ausbaustufe** | **Beteiligte Stellen**                     | **Transparenzreichweite**                           | **Zweck**                                                                               |
|-----------------|----------------------------------------------|-----------------------------------------------------|-----------------------------------------------------------------------------------------|
| A               | Einige Briefwahlvorstände                    | Nur die dort ausgezählten Briefwahlstimmen          | Kontrollierte Umgebung, hohe Stückzahlen, standardisierte Tische und erfahrene Leitung. |
| B               | Weitere Briefwahlvorstände                   | Wachsende, klar ausgewiesene Teilmenge              | Skalierung, Schulung und Support unter realen Bedingungen prüfen.                       |
| C               | Ausgewählte Urnenwahllokale                  | Beteiligte Wahlbezirke vollständig                | Alltagstauglichkeit in unterschiedlichen Räumen und Teams testen.                       |
| D               | Breiter Regelbetrieb mit manuellen Ausnahmen | Großer Anteil der Wahl; Rest weiterhin traditionell | Nutzen ausrollen, ohne ungeeignete Standorte oder Sonderfälle zu zwingen.               |

Eine teilweise Einführung erlaubt keine digitale Einzelprüfung der gesamten Wahl. Sie schafft aber für jeden teilnehmenden Wahlbezirk eine zusätzliche, transparente Belegspur. Zugleich bleibt ein direkter Vergleich zwischen neuem und altem Verfahren möglich. Dieser Parallelvergleich ist für eine glaubwürdige Evaluation besonders wertvoll.

# 11. Organisation, Aufwand und Beschaffung

Die Hardwarekosten dürfen nicht mit den Gesamtkosten verwechselt werden. Der größte Aufwand liegt in rechtsfester Spezifikation, barrierearmer Bedienung, Testdatenerstellung, Sicherheitsprüfung, Geräteverwaltung, Schulung, Support und unabhängiger Evaluation. Eine belastbare Kostenschätzung ist erst nach Phase 0 möglich.

| **Arbeitspaket**  | **Federführung**                                 | **Ergebnis**                                                                    |
|-------------------|--------------------------------------------------|---------------------------------------------------------------------------------|
| Wahlfachlichkeit  | Landeswahlamt + Bezirkswahlämter                 | Regelwerk, Prozess, Musterfälle, Abnahme.                                       |
| Recht/Datenschutz | Wahlrechts- und Datenschutzexpertise             | Pilotgrundlage, Folgenabschätzung, Veröffentlichungs- und Aufbewahrungskonzept. |
| Technik           | Öffentliche IT-Stelle + offenes Entwicklungsteam | Cloud-Webanwendung, Browseraufnahme, OMR, Signaturen, Schnittstellen.            |
| Sicherheit        | Unabhängige Prüfstelle                           | Bedrohungsmodell, Codeaudit, Penetrationstest, Lieferkettenprüfung.             |
| Evaluation        | Unabhängige Hochschule/Forschungsstelle          | Vorab registriertes Messdesign, Vergleich und Abschlussbericht.                 |
| Beteiligung       | Parteien, Wahlhelfer, Zivilgesellschaft        | Öffentliche Tests, Beobachtungsanforderungen, Vertrauensprüfung.                |

# 12. Entscheidungsvorlage für die Landeswahlleitung

Es wird nicht beantragt, die manuelle Auszählung kurzfristig abzuschaffen. Beantragt wird eine formale Machbarkeitsprüfung mit der Option eines transparenten Schattenpiloten. Damit bleibt das Risiko begrenzt, während Berlin belastbare Erkenntnisse für eine bundesweit relevante Modernisierungsfrage gewinnt.

## Vorgeschlagener Beschluss

1.  **Arbeitsgruppe:** Das Landeswahlamt richtet eine kleine interdisziplinäre Arbeitsgruppe "Scan-gestützte Auszählung" ein.

2.  **Vorprüfung:** Die Arbeitsgruppe erstellt binnen drei Monaten eine Rechts-, Datenschutz- und Prozessvorprüfung sowie einen offenen technischen Mindeststandard.

3.  **Prototyp:** Auf dieser Basis wird ein öffentlicher Laborprototyp mit synthetischen Stimmzetteln entwickelt und durch Wahlhelfer getestet.

4.  **Evaluation:** Eine unabhängige Stelle bewertet Genauigkeit, Durchsatz, Verständlichkeit, Sicherheit und Rückfallfähigkeit.

5.  **Entscheidung:** Erst danach entscheidet die Landeswahlleitung, ob ein rein zusätzlicher Schattenpilot bei einer geeigneten späteren Wahl beantragt wird.

## Erwarteter strategischer Nutzen

- Entlastung ehrenamtlicher Wahlvorstände bei Routinearbeit;

- weniger Sortier-, Summen- und Übertragungsfehler;

- schnellere, gezieltere Nachprüfung knapper oder auffälliger Ergebnisse;

- bessere Datenbasis für Schulung, Qualitätssicherung und Wahlprüfung;

- offene technische Standards statt Abhängigkeit von einer proprietären Blackbox;

- unabhängige Nachzählung durch Parteien, Wissenschaft, Medien und interessierte Bürger mit eigener Software;

- sichtbare, verantwortungsbewusste Digitalisierung, ohne die Papierwahl aufzugeben.

> **Kernaussage an die Landeswahlleitung:** Der digitale Wahlassistent verbindet den demokratischen Vorteil des Papierstimmzettels mit der Rechen- und Dokumentationsstärke digitaler Systeme. Er ersetzt weder Öffentlichkeit noch menschliches Urteil. Er unterstützt beides durch nachvollziehbare Abläufe und dokumentierte Prüfschritte.

# Anlage A: Kurzanschreiben an den Landeswahlleiter

\[Ihr Name\]  
\[Ihre Anschrift\]  
\[Ihre E-Mail-Adresse\]

Prof. Dr. Stephan Bröchler  
Landeswahlleiter für Berlin  
Landeswahlamt Berlin  
Klosterstraße 47  
10179 Berlin

Berlin, den \[Datum\]

**Vorschlag für einen Pilotversuch zur scan-gestützten Auszählung von Papierstimmzetteln**

Sehr geehrter Herr Professor Bröchler,

ich war mehrfach als Wahlhelfer tätig. Aus dieser praktischen Erfahrung kenne ich die besondere Belastung der Auszählung nach einem langen Wahltag: Mit wachsender Zahl von Parteien und unterschiedlichen Stimmen entstehen viele Stapel, wiederholte Sortiergänge und erheblicher Zeitdruck.

Daraus ist die beigefügte Konzeptidee entstanden. Papierstimmzettel sollen nach Öffnung der Urne mit handelsüblichen, amtlich kontrollierten Smartphones aus der Hand fotografiert werden. Eine installierungsfreie, offene Webanwendung prüft die Aufnahme zunächst auf dem Smartphone und überträgt Bild und Vorwertung anschließend an eine geschützte Cloud. Dort erfolgt eine unabhängige Gegenprüfung; anschließend werden Erst- und Zweitstimmen aus demselben Bild aggregiert und als offenes Prüfpaket bereitgestellt. Unklare Fälle legt das System weiterhin dem Wahlvorstand vor. Der Papierstimmzettel bleibt dabei jederzeit die maßgebliche Grundlage.

Mir ist bewusst, dass Wahlgeheimnis, Öffentlichkeit, IT-Sicherheit und die Entscheidungshoheit des Wahlvorstands nicht verhandelbar sind. Deshalb schlägt die Studie ausdrücklich keine kurzfristige Ablösung des heutigen Verfahrens vor, sondern eine stufenweise Machbarkeitsprüfung: zunächst mit synthetischen Stimmzetteln, offener Software und unabhängiger Prüfung, später gegebenenfalls als rein zusätzlicher Schattenbetrieb ohne Einfluss auf das amtliche Ergebnis. Zum demokratischen Kern gehört dabei ein einfacher Zugang zu den Originalbildern auf Antrag, damit Bürger, Parteien, Medien und Wissenschaft die Auszählung auch bildweise mit eigener Software überprüfen können.

Ich würde mich freuen, wenn das Landeswahlamt prüfen könnte, ob diese Idee in die von Ihnen angestoßene Debatte über die Digitalisierung der Wahlorganisation aufgenommen werden kann. Besonders wertvoll wäre eine fachliche Rückmeldung dazu, welche rechtlichen und praktischen Anforderungen ein Berliner Laborpilot erfüllen müsste.

Mit freundlichen Grüßen

\[Unterschrift\]  
\[Ihr Name\]

# Anlage B: Quellenverzeichnis

**1. Der Landeswahlleiter und das Landeswahlamt Berlin**

> Aktuelle Zuständigkeit und Kontakt von Prof. Dr. Stephan Bröchler.
>
> [https://www.berlin.de/wahlen/organisation/landeswahlleitung/artikel.749726.php](https://www.berlin.de/wahlen/organisation/landeswahlleitung/artikel.749726.php)

**2. Landeswahlleiter Berlin: "E-Voting - Eine gute Wahl?" (26. März 2026)**

> Einordnung von Chancen, Grenzen und breiterer Digitalisierung der Wahlorganisation.
>
> [https://www.berlin.de/wahlen/pressemitteilungen/2026/pressemitteilung.1656405.php](https://www.berlin.de/wahlen/pressemitteilungen/2026/pressemitteilung.1656405.php)

**3. Bundeswahlordnung (BWO)**

> Insbesondere §§ 45, 54, 67-73, 76, 89 und 90; manueller Zählprozess, Öffentlichkeit, Niederschrift und Verwahrung.
>
> [https://www.bundeswahlleiterin.de/dam/jcr/04f736b0-66e8-4618-9063-88af47e83ce2/bundeswahlordnung.pdf](https://www.bundeswahlleiterin.de/dam/jcr/04f736b0-66e8-4618-9063-88af47e83ce2/bundeswahlordnung.pdf)

**4. Bundesverfassungsgericht, Urteil vom 3. März 2009 - 2 BvC 3/07, 2 BvC 4/07**

> Grundsatz der Öffentlichkeit und Nachvollziehbarkeit wesentlicher Schritte der Ergebnisermittlung.
>
> [https://www.bundesverfassungsgericht.de/SharedDocs/Entscheidungen/DE/2009/03/cs20090303_2bvc000307.html](https://www.bundesverfassungsgericht.de/SharedDocs/Entscheidungen/DE/2009/03/cs20090303_2bvc000307.html)

**5. Deutscher Bundestag: Ablehnung einer Neuauszählung zur Bundestagswahl 2025 (18. Dezember 2025)**

> Amtliche Darstellung der BSW-Einsprüche, des Abstands zur Fünf-Prozent-Hürde und der Entscheidung.
>
> [https://www.bundestag.de/dokumente/textarchiv/2025/kw51-de-wahlpruefung-1129218](https://www.bundestag.de/dokumente/textarchiv/2025/kw51-de-wahlpruefung-1129218)

**6. Abschlussbericht der Expertenkommission Wahlen in Berlin (6. Juli 2022)**

> Empfehlungen zu Standardisierung, Professionalisierung und Organisation.
>
> [https://www.berlin.de/sen/inneres/presse/weitere-informationen/abschlussbericht.pdf](https://www.berlin.de/sen/inneres/presse/weitere-informationen/abschlussbericht.pdf)

**7. Bundeswahlgesetz (BWahlG), insbesondere §§ 33 und 35**

> Wahlgeheimnis und gesetzliche Anforderungen an Wahlgeräte.
>
> [https://www.gesetze-im-internet.de/bwahlg/](https://www.gesetze-im-internet.de/bwahlg/)

**Hinweis**

Die Studie skizziert eine technische und organisatorische Entwicklungsrichtung. Vor einem Pilot mit echten Wahlunterlagen sind eine förmliche wahlrechtliche Prüfung, eine Datenschutz-Folgenabschätzung und ein unabhängiges IT-Sicherheitskonzept erforderlich.

