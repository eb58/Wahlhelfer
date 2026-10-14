# Konzeptstudie: Scan-gestützte Auszählung von Papierstimmzetteln

> Ein öffentlich überprüfbares, menschlich kontrolliertes Assistenzsystem für die Auszählung von Wahlen

**Konzeptname: Digitaler Wahlassistent**

Stand: 14. Oktober 2026

Version: 1.6

> **Leitidee:** Das Papier bleibt das Original. Nach dem Öffnen der Urne fotografieren Wahlhelfer die Stimmzettel mit handelsüblichen Smartphones. Der Browser prüft das Bild vor Ort; die Cloud führt eine zweite Prüfung durch und protokolliert den Ablauf. Über unklare Fälle entscheidet weiterhin der Wahlvorstand.

*Rechtliche Vorprüfung und technisches Zielbild - kein abschließendes Rechtsgutachten*

# Kurzfassung

Nach einem langen Wahltag müssen ehrenamtliche Wahlvorstände viele Stimmzettel sortieren, mehrfach zählen, Erst- und Zweitstimmen auseinanderhalten und Zahlen übertragen. Je mehr Parteien, Wahlvorschläge und gleichzeitige Abstimmungen es gibt, desto aufwendiger wird dieser Teil der Arbeit. \[2, 3\]

Vorgesehen sind Papierstimmzettel, handelsübliche Smartphones und eine Webanwendung ohne App-Installation. Der Browser prüft Bildausschnitt, Schärfe, Perspektive und Vollständigkeit und zeigt eine vorläufige Erkennung an. Eine zweite Prüfung läuft in der Cloud. Spezialkameras, Halterungen, Scanmatten und Sonderbeleuchtung sind nicht erforderlich; die Smartphones werden aus der Hand bedient.

Der Einsatz kann schrittweise erfolgen. Zunächst könnten einzelne Briefwahlvorstände teilnehmen, später ausgewählte Urnenwahllokale. Alle anderen Wahlbezirke würden zunächst wie bisher zählen. So lässt sich die Technik unter realen Bedingungen prüfen, ohne das gesamte Verfahren umzustellen.

Bei acht Wahlhelfern könnten vier Zweiergruppen parallel arbeiten. Rechnet man mit drei bis vier Sekunden je eindeutigem Stimmzettel, dauert die reine Aufnahme von 600 bis 700 Zetteln rechnerisch etwa 7 Minuten 30 Sekunden bis 11 Minuten 40 Sekunden. Für den gesamten Ablauf einschließlich Aufbau, Abgleich, Zweifelsfällen und Abschlusskontrolle sollte ein Pilot zunächst 20 bis 35 Minuten einplanen.

Die Ergebnisse sollen sich unabhängig nachrechnen lassen. Die Cloud liefert deshalb nicht nur eine Summe, sondern für jeden teilnehmenden Wahlbezirk ein maschinenlesbares Prüfpaket. Darin stehen unter anderem Datenformat, Zählregeln, Prüfsummen, Sitzungsprotokoll, menschliche Bestätigungen, Zweifelsfallentscheidungen und signierte Summen. Mit dem veröffentlichten Referenzcode oder einer eigenen Software kann dann nachvollzogen werden, wie das Ergebnis entstanden ist.

## Vier zentrale Designentscheidungen

- Jeder Stimmzettel erhält einen individuellen QR-Code mit einer zufällig erzeugten, nicht sprechenden Kennung. Der Code enthält Wahl-ID, Wahlbezirk beziehungsweise Wahllokal, Stimmzetteltyp, Layoutversion, die individuelle Stimmzettelkennung sowie eine Prüfsumme. Die Cloud akzeptiert nur Kennungen, deren Hash im autoritativen Verzeichnis der ausgegebenen Stimmzettel enthalten ist; unbekannte oder bereits verwendete Kennungen werden zurückgewiesen oder als Zweifelsfall vorgelegt. Die Kennung wird nicht mit dem Wählerverzeichnis, der Ausgabe-Reihenfolge oder einer Person verbunden.

- Keine vollautomatische Letztentscheidung. Die Software erkennt klare Markierungen; Mehrfachmarkierungen, schwache Kreuze, Zusätze und sonstige Zweifelsfälle gehen sichtbar an den Wahlvorstand.

- Keine elektronische Stimmabgabe. Smartphone-Webanwendung und Cloud werden ausschließlich nach Öffnung der Urne als Auszählungsassistenz genutzt; Papier und manuelle Notfallauszählung bleiben jederzeit verfügbar.

- Keine unbedachte Veröffentlichung roher Stimmzettelfotos. Offen veröffentlicht werden Software, Datenformat, Prüfdaten, Ergebnisdateien und kryptografische Nachweise. Originalbilder sollen grundsätzlich auf einfachen Antrag zugänglich sein; Ausnahmen müssen konkret mit Wahlgeheimnis, Sicherheit oder einem laufenden Verfahren begründet werden.

## Warum das Thema gerade zu Berlin passt

Der Berliner Landeswahlleiter betont selbst, die digitale Transformation der Wahlorganisation dürfe nicht auf E-Voting reduziert werden; Digitalisierung könne auch Vorbereitung und Wahlniederschriften betreffen. Genau hier setzt der digitale Wahlassistent an: Die Stimmabgabe bleibt unverändert auf Papier, digitalisiert wird erst die Ergebnisermittlung nach Schließung des Wahllokals. Die Berliner Expertenkommission hat zudem Standardisierung und Professionalisierung als zentrale Lehren aus 2021 hervorgehoben. \[1, 2, 6\]

# 1. Ausgangslage: Wo der heutige Prozess belastet

Die Bundeswahlordnung bildet die Belastung geradezu ab: § 69 BWO verlangt zunächst mehrere Stimmzettelstapel, sodann Prüfungen und Zählungen unter gegenseitiger Kontrolle sowie eine weitere Sortierung nach Zweitstimmen bei abweichender Kombination. Dieses Verfahren ist öffentlich, bindet aber viele Hände, viel Tischfläche und hohe Konzentration. \[3\]

| **Belastung**          | **Heutige Ursache**                                                                             | **Beitrag des Assistenzsystems**                                                                               |
|------------------------|-------------------------------------------------------------------------------------------------|----------------------------------------------------------------------------------------------------------------|
| Viele Stapel           | Parteien, Kandidaten, Erst-/Zweitstimmen und ungültige Fälle benötigen getrennte Behandlung. | Jeder Zettel wird einmal erfasst; die Software führt mehrere Auswertungen aus demselben Bild durch.            |
| Doppelte Arbeit        | Erst- und Zweitstimme werden in getrennten Arbeitsschritten ausgewertet.                        | Beide Stimmen werden gleichzeitig erkannt und getrennt aggregiert.                                             |
| Übertragungsfehler     | Zwischensummen werden von Hand in Niederschriften und Meldungen übertragen.                     | Summen entstehen automatisch aus Einzeldatensätzen; Plausibilitätsprüfungen warnen bei Abweichungen.           |
| Stress und Ermüdung    | Die anspruchsvollste Phase beginnt nach einem langen Einsatztag.                                | Routinefälle werden standardisiert; Aufmerksamkeit konzentriert sich auf Zweifelsfälle.                        |
| Schwierige Nachprüfung | Eine spätere Prüfung erfordert das Öffnen versiegelter Pakete und erneutes manuelles Sortieren. | Ein signiertes digitales Abbild und ein Prüfprotokoll ermöglichen gezielte Kontrollen; Papier bleibt Referenz. |

Ein Scanvorgang kann auch Zeit kosten. Bei acht Wahlhelfern stehen aber vier Zweiergruppen mit je einem Smartphone zur Verfügung. Der Pilot muss zeigen, ob die parallele Aufnahme die eingesparte Sortier- und Übertragungsarbeit tatsächlich aufwiegt. Der Nutzen ist zu messen, nicht vorauszusetzen.

# 2. Zielbild und klare Nicht-Ziele

## 2.1 Zielbild

Der digitale Wahlassistent soll Markierungen auf Stimmzetteln erkennen (OMR). Er ist kein System zur Stimmabgabe, sondern eine Hilfe bei der Auszählung nach dem Öffnen der Urne. Eine Person legt den Zettel auf den Tisch, die zweite öffnet die Webanwendung und fotografiert ihn aus der Hand. Der Browser prüft Lage, Schärfe, Stimmzetteltyp und Markierungsfelder. Bei einem eindeutigen Zettel zeigt er zum Beispiel „Erststimme: Partei X“ und „Zweitstimme: Partei Y“ an. Bei einem unklaren Zettel gibt er einen Prüfhinweis aus. Bild und Vorwertung werden erst danach verschlüsselt an die Cloud übertragen. Dort erfolgt eine zweite Erkennung, bevor die Stimme in die Summe eingeht.

## 2.2 Nicht-Ziele

- keine elektronische Stimmabgabe und keine Veränderung des Wahlakts;

- keine biometrische Erfassung und keine Verknüpfung mit dem Wählerverzeichnis;

- keine endgültige Bewertung zweifelhafter Stimmzettel durch ein KI-Modell;

- keine zentrale Online-Abhängigkeit für die Stimmabgabe; die Auszählungsassistenz darf die Cloud nutzen, braucht aber eine dokumentierte manuelle Rückfallebene;

- keine Abschaffung des Wahlvorstands oder der öffentlichen Beobachtung;

- keine Vernichtung oder Ersetzung der Papierstimmzettel.

# 3. Stimmzettelgestaltung

## 3.1 QR-Code: individuelle technische Kennung, keine Personenkennung

Jeder Stimmzettel erhält einen eigenen QR-Code mit einer zufällig erzeugten Kennung. Er enthält Wahl-ID, Gebietskörperschaft, Wahlbezirk beziehungsweise Wahllokal, Stimmzetteltyp, Layoutversion, die Kennung und eine Prüfsumme. Die Metadaten werden zusätzlich lesbar auf den Zettel gedruckt. Die Kennung hilft, Aufnahmen technisch zuzuordnen, Doppelaufnahmen zu erkennen und fehlende Datensätze zu finden. Die Cloud vergleicht den Hash der Kennung mit dem Verzeichnis der ausgegebenen Stimmzettel. Selbst erzeugte oder unbekannte Kennungen werden nicht akzeptiert. Die Kennung enthält keine personenbezogenen Daten und wird nicht mit dem Wählerverzeichnis verbunden.

> **Nicht empfohlen:** Eine sprechende, fortlaufende oder bei der Ausgabe protokollierte Einzelnummer. Wer die Ausgabereihenfolge beobachtet und mit einer Nummer verbindet, könnte daraus einen Rückschluss auf die Stimmabgabe ziehen. Die Kennung sollte deshalb zufällig und ohne Personenbezug sein.

## 3.2 Lageerkennung

Für die Lagekorrektur sollte kein zweiter individueller QR-Code verwendet werden. Dafür reichen voraussichtlich vier einfache Passmarken in den Ecken. Sie helfen bei Perspektivkorrektur, Drehung, Größenprüfung und beim Erkennen abgeschnittener Bereiche. Die rechte obere Ecke muss mit der Regelung für Stimmzettelschablonen vereinbar bleiben; § 45 BWO sieht dort eine Lochung oder einen Eckschnitt vor. \[3\]

## 3.3 Digitaler Beleg erst nach Urnenöffnung

Beim Scan erhält der Datensatz eine zufällige Sitzungs-ID und eine laufende Erfassungsnummer. Die gedruckte Kennung wird nicht mit Ausgabezeit, Wählerverzeichnis oder Personendaten verbunden. Ein kryptografischer Hash verknüpft QR-Kennung, Bild, Erkennung und Prüfentscheidung. So lassen sich Doppelaufnahmen, nachträgliche Änderungen und fehlende Datensätze erkennen, ohne einen „Wahlbeleg“ für die wählende Person zu erzeugen.

# 4. Ablauf im Wahllokal

1.  **Vorbereitung:** Für vier Zweiergruppen werden vier Smartphones bereitgestellt. Eine Installation ist nicht nötig. Jede Gruppe öffnet denselben Web-Link oder den zugehörigen QR-Code und erhält eine eigene Sitzungskennung. Halterungen, Scanmatten und Sonderbeleuchtung sind nicht vorgesehen. Mit Musterzetteln testet jede Gruppe kurz Bildqualität und Markierungserkennung.

2.  **Zählabgleich und Stapelbildung:** Vor der inhaltlichen Auswertung werden Stimmzettel, Stimmabgabevermerke und Wahlscheine wie bisher zahlenmäßig abgeglichen. Abweichungen werden dokumentiert. Anschließend werden die Stimmzettel in gezählte Stapel zu je 20 Zetteln aufgeteilt; der letzte Stapel kann kleiner sein. Vor jedem Stapel trägt das Tandem dessen tatsächliche Größe in die Smartphone-Anwendung ein; voreingestellt sind 20.

3.  **Erfassung im Tandem:** Person A nimmt genau einen Zettel vom Eingangsstapel und breitet ihn plan auf dem Tisch aus. Person B fotografiert ihn aus der Hand und sagt Erst- und Zweitstimme laut an. Person A bestätigt die Ansage oder widerspricht unmittelbar.

4.  **Stapelabschluss und automatische Gegenprüfung:** Das Smartphone führt zunächst eine lokale Vorprüfung durch und zeigt die erkannte Partei oder einen Zweifelsfall sowie den Erfassungsfortschritt an. Erfasste Zettel werden auf einen getrennten Ausgangsstapel gelegt; lokale Zweifelsfälle werden mit ihrer Stapelzuordnung ausgesondert. Erst wenn die erwartete Anzahl erreicht und der Eingangsstapel vollständig abgearbeitet ist, bestätigt das Tandem den Stapelabschluss. Danach überträgt die Webanwendung Bilder, Vorwertungen und Qualitätsdaten des Stapels verschlüsselt an die Cloud. Eine zweite Prüfkomponente liest dort Layout, Markierungsfelder und Qualitätsmerkmale aus und vergleicht das Ergebnis mit der Ansage. Der Ausgangsstapel bleibt bis zur Rückmeldung der Cloud als zusammengehöriger Stapel erhalten. Nur bei Übereinstimmung und ausreichender Bildqualität wird die jeweilige Wertung freigegeben; Abweichungen werden als Zweifelsfälle vorgelegt.

5.  **Zweifelsfall:** Bei menschlichem Widerspruch, technischer Abweichung oder unklarer Markierung wird der Zettel ausgesondert und dem gesamten Wahlvorstand vorgelegt; Entscheidung, Begründung und Abstimmung werden protokolliert.

6.  **Abgleich:** Erfasste Zettelzahl, Papierstapel, Wählerzahl und Ergebnisdatei werden verglichen. Fehlende oder doppelte Datensätze blockieren den Abschluss.

7.  **Abschluss:** Der Wahlvorstand bestätigt die Summen, signiert die Niederschrift und versiegelt Papier sowie Datenträger. Erst anschließend werden signierte Ergebnisdaten über den amtlichen Meldeweg übertragen.

## 4.1 Zweiergruppe und Zeitmodell

Die Zweiergruppe verbindet zügiges Arbeiten mit gegenseitiger Kontrolle. Bei acht Wahlhelfern werden vier Tandems gebildet. Person A legt den Zettel auf. Person B fotografiert ihn und sagt Erst- und Zweitstimme an. Person A bestätigt oder widerspricht. Die Ansage kommt vor der Maschinenwertung, damit die Anzeige die Wahrnehmung nicht beeinflusst. Der Ablauf bei einem klaren Zettel lautet: auflegen - aufnehmen - ansagen - bestätigen - weiterschieben.

Alle vier Teams arbeiten gleichzeitig mit getrennten, gezählten Eingangsstapeln. Die Cloud führt die Datensätze zusammen und verhindert doppelte Zählungen derselben Stimmzettelkennung, auch über Sitzungen und Stapel hinweg. Abweichende oder unklare Zettel kommen auf einen gemeinsamen Zweifelsstapel; ihre Zuordnung zum ursprünglichen Erfassungsstapel bleibt erhalten. Dort entscheidet der gesamte Wahlvorstand. So halten Sonderfälle den normalen Ablauf möglichst wenig auf.

### Erfassung in kleinen, gezählten Stapeln

Die kleinen Stapel sollen verhindern, dass Stimmzettel unbemerkt überblättert oder doppelt fotografiert werden. Als Ausgangswert sind 20 Zettel je Stapel vorgesehen. Die Stapelgröße wird vor der Erfassung am Smartphone eingestellt; beim letzten Stapel wird die tatsächlich enthaltene Anzahl eingetragen. Ob 20 Zettel eine geeignete Größe sind, wird im Pilot überprüft.

Während der Erfassung zeigt die Anwendung den Fortschritt an, beispielsweise „17 von 20 Stimmzetteln erfasst“. Jeder erfasste Zettel wird vom Eingangsstapel auf den getrennten Ausgangsstapel oder in die zugeordneten Zweifelsfälle gelegt. Auch ein erfasster Zweifelsfall zählt für die Vollständigkeit des Stapels, aber noch nicht als freigegebene Stimme. Ein leerer Eingangsstapel bei zu niedrigem Zähler oder verbliebene Zettel bei erreichtem Sollwert erfordern eine Kontrolle. Die Sollzahl darf nicht nachträglich nur an den Erfassungszähler angepasst werden, um eine Abweichung zu verdecken.

Erst wenn Sollzahl und erfasste Zettelzahl übereinstimmen und kein Zettel im Eingangsstapel verblieben ist, kann das Tandem den Stapel zur Übertragung abschließen. Jeder Stapel erhält eine technische Kennung; Sollzahl, Aufnahmen, Zweifelsfälle und Serverbestätigung werden ihm zugeordnet. Bis zur bestätigten Übernahme bleiben seine Daten auf dem Smartphone erhalten. Eine wiederholte Übertragung desselben Stapels darf keine zusätzliche Zählung auslösen. Der lokale Stapelabschluss bestätigt die Vollständigkeit der Erfassung, nicht die Freigabe der Stimmen; diese folgt erst nach der Cloud-Gegenprüfung und gegebenenfalls der Entscheidung des Wahlvorstands.

**Ohne individuelle QR-Kennung** kann der Mengenabgleich Fehler aufdecken, aber keine vollständige Erfassung garantieren: Ein ausgelassener und ein doppelt fotografierter Zettel können sich zahlenmäßig ausgleichen. Kleine Stapel und der konsequente Wechsel vom Eingangs- zum Ausgangsstapel begrenzen dieses Risiko und erleichtern eine erneute Kontrolle.

**Mit individueller QR-Kennung** zählt der Fortschrittszähler unterschiedliche Stimmzettel statt Aufnahmen. Eine erneute Aufnahme derselben Kennung wird sichtbar als Doppelaufnahme oder Neuaufnahme zugeordnet und erhöht den Zähler nicht. Dadurch kann eine Doppelaufnahme einen überblätterten Zettel nicht mehr im Mengenabgleich verdecken. Unlesbare oder unbekannte Kennungen müssen geklärt werden; sie dürfen den Sollwert nicht als vermeintlich neue Zettel erfüllen. Die Cloud prüft zusätzlich, ob eine Kennung bereits in einem anderen Stapel oder einer anderen Sitzung erfasst wurde. Offene Zuordnungskonflikte blockieren die Freigabe des betroffenen Stapels.

## 4.2 Webanwendung und Cloud-Auswertung

Die Bedienung erfolgt vollständig im mobilen Browser. Die Wahlhelfer brauchen weder App-Download noch lokale Installation, sondern nur einen bereitgestellten Link. Nach der Kamerafreigabe zeigt die Webanwendung einen einfachen Aufnahmeausschnitt und prüft Bild und Markierungen zunächst auf dem Smartphone. Die vorläufige Erkennung wird sofort angezeigt. Bilder, Vorwertungen und Prüfdaten werden zunächst für den aktuellen Stapel gesammelt und erst nach dessen bestätigtem Abschluss verschlüsselt an den Cloud-Dienst übertragen. Die Oberfläche unterscheidet sichtbar zwischen lokal erfasst, vom Server übernommen und zur Zählung freigegeben.

Die Cloud sollte Wahl, Wahlbezirk und Sitzung technisch voneinander trennen. Jede Aufnahme erhält eine zufällige Sitzungs-ID, einen Zeitstempel und einen Bild-Hash, aber keine Verbindung zu einem Wählerverzeichnis oder zu einer Person. Im Browser sehen beide Personen die lokale Vorwertung, die Cloud-Wertung, die Bildqualität und bei Bedarf das Originalbild.

Nach Abschluss des Wahlbezirks erzeugt die Cloud ein signiertes Prüfpaket. Es enthält mindestens die anonymisierten Datensätze, lokale Vorwertung, Cloud-Wertung, menschliche Bestätigung oder Zurückweisung, Zweifelsfallentscheidungen, Erst- und Zweitstimmen, Regelversionen und Hashes. Ein unabhängiges Programm muss daraus ohne Cloud-Zugriff dieselben Summen berechnen können.

Für einen amtlichen Pilot wären ein deutscher oder europäischer Betriebsstandort, ein Auftragsverarbeitungsvertrag, Verschlüsselung während der Übertragung und im Speicher, strenge Rollenrechte, unveränderbare Protokolle und eine gesetzlich geprüfte Aufbewahrungsfrist nötig. Rohbilder dürfen nicht automatisch öffentlich oder in privaten Fotogalerien landen. Bei einem Ausfall kann die lokale Prüfung weiter einen Hinweis anzeigen. Amtlich verwertbar wäre eine Entscheidung aber erst nach der Cloud-Gegenprüfung; sonst gilt die manuelle Auszählung.

Als Erfahrungsannahme werden 600 bis 700 abgegebene Stimmzettel je Urnenwahllokal betrachtet. Für `N` Stimmzettel, `s` Sekunden je Stimmzettel und `k` parallel arbeitende Smartphones beziehungsweise Teams gilt für den idealisierten Erfassungsdurchlauf:

> `T = (N × s) / k`

| **Menge**  | **Teams** | **3 Sek./Zettel** | **4 Sek./Zettel**  | **Planwert inkl. Nebenzeiten** |
|------------|----------|-------------------|----------------------|-------------------------------|
| 600 Zettel | 1             | 30 Minuten            | 40 Minuten             | ca. 45-60 Minuten                                   |
| 600 Zettel | 4             | 7 Minuten 30 Sekunden | 10 Minuten             | ca. 20-30 Minuten                                   |
| 700 Zettel | 1             | 35 Minuten            | 46 Minuten 40 Sekunden | ca. 50-70 Minuten                                   |
| 700 Zettel | 4             | 8 Minuten 45 Sekunden | 11 Minuten 40 Sekunden | ca. 20-35 Minuten                                   |

Die Rechnung gilt nur für den idealisierten Durchlauf klarer Stimmzettel. Der Faktor vier gilt für diesen parallelisierbaren Schritt, nicht automatisch für die gesamte Auszählung. Aufbau, Eingangsabgleich, beschädigte oder zweifelhafte Zettel, Störungen, Datenzusammenführung und Abschlussprotokoll bleiben gemeinsame oder teilweise serielle Aufgaben.

> **Pilotannahme:** Drei bis vier Sekunden pro klarem Stimmzettel und eine annähernd lineare Skalierung auf vier Smartphones sind testbare, aber anspruchsvolle Ziele. Maßgeblich ist die Zeit vom Öffnen der Urne bis zur unterschriebenen Niederschrift. Ein schneller Scan reicht nicht, wenn Zweifelsfälle, Nachsortieren oder Störungen den Zeitgewinn wieder aufbrauchen.

# 5. Erkennungs- und Entscheidungslogik

Die Erkennung soll auf dokumentierten Regeln beruhen. Ein neuronales Netz könnte zusätzlich die Bildqualität bewerten; die Stimmwertung selbst muss aus veröffentlichten Schwellenwerten und Wahlregeln folgen. So lässt sich die Entscheidung prüfen und erklären.

| **Prüfstufe** | **Automatische Aufgabe**                                                            | **Menschliche Rolle**                                          |
|---------------|-------------------------------------------------------------------------------------|----------------------------------------------------------------|
| Bild-qualität  | Schärfe, Reflexe, Vollständigkeit, Perspektive und richtige Vorderseite prüfen.     | Zettel neu auflegen, wenn die Aufnahme nicht freigegeben wird. |
| Layout        | QR-Code und Passmarken lesen; Feldkoordinaten und Wahlart zuordnen.                 | Bei nicht passendem oder beschädigtem Zettel eingreifen.       |
| Mark.         | Für jedes Feld "leer", "markiert" oder "unklar" bestimmen.                          | Unsichere Felder sichtbar prüfen.                              |
| Wahlregel     | Mehrfachmarkierung, fehlende Stimme und formale Konflikte als Prüfhinweis erkennen. | Nur der Wahlvorstand entscheidet strittige Gültigkeitsfragen.  |
| Summe         | Freigegebene Erst- und Zweitstimmen getrennt summieren; Prüfsummen bilden.          | Summen und Differenzberichte bestätigen.                       |

> **Grundsatz:** Im Zweifel soll das System einen Zettel als „unklar“ vorlegen. Ein offener Zweifelsfall ist besser als eine unbemerkte Fehlzuordnung. Im Pilot zählt deshalb nicht nur die Trefferquote, sondern vor allem die Zahl stiller Fehler.

# 6. Transparenz und unabhängige Nachzählbarkeit

Dritte sollen die Ergebnisse mit eigener Software prüfen können. Auf Antrag sollten sie auch die zugrunde liegenden Stimmzettelbilder einsehen dürfen. Ein einzelnes Bild zeigt in der Regel nur die Markierung auf dem Papier, nicht die Person, die den Zettel ausgefüllt hat. Trotzdem können Handschrift, ungewöhnliche Markierungen, Reihenfolge oder Zusatzinformationen Rückschlüsse ermöglichen. Der Zugang muss deshalb einfach und zeitnah sein; eine Ablehnung braucht einen konkreten, dokumentierten Grund zum Schutz des Wahlgeheimnisses, der Sicherheit oder eines laufenden Verfahrens. \[3\]

## 6.1 Drei Transparenzebenen

| **Ebene**                 | **Veröffentlichung**                                                                                                                                       | **Prüfmöglichkeit**                                                                              |
|---------------------------|------------------------------------------------------------------------------------------------------------------------------------------------------------|--------------------------------------------------------------------------------------------------|
| 1 - vollständig offen     | Quellcode, Build-Anleitung, Datenformat, Stimmzetteldefinitionen, Testkorpus, Wahlregeln, Sicherheitskonzept, Prüfberichte.                                | Jeder kann eine eigene Software schreiben, die Referenzimplementierung reproduzieren und die Summenlogik nachvollziehen. |
| 2 - offene Ergebnisbelege | Signierte Wahlbezirksdateien, anonymisierte Einzeldatensätze, lokale Vorwertungen, Cloud-Gegenprüfungen, menschliche Entscheidungen und kryptografisches Manifest. | Jeder kann Vollständigkeit, Unverändertheit, Konfliktbehandlung und Aggregation unabhängig prüfen.                      |
| 3 - Originalbilder auf Antrag | Originalbilder und Entscheidungsprotokolle in einem transparenten, gesetzlich geregelten Prüfportal; Zugang grundsätzlich für jeden Antragsteller. | Antragsteller können Markierung und Wertung zettelweise mit dem veröffentlichten Ergebnis vergleichen; begrenzte Ausnahmen müssen konkret begründet werden. |

Ein Massendownload aller Rohbilder ist dafür nicht nötig. Nötig ist ein nutzbarer Zugang mit einfacher Antragstellung, klarer Frist, unveränderter Belegdatei, Zuordnung zum Wahlbezirk und Prüfprotokoll. Belegdatei ist das Bild, aus dem die Wertung entstanden ist, nicht das Kamera-Original: Der Browser verkleinert jede Aufnahme vor der Erkennung auf eine feste Auflösung und wertet genau dieses Bild aus. Entscheidend ist, dass sich das Wahlergebnis aus den Belegen reproduzieren lässt, nicht das Originalfoto. Antragsteller sollten die Bilder mit eigener Software auswerten können. Wird ein Bild ausnahmsweise zurückgehalten oder nur normalisiert herausgegeben, müssen Grund, Umfang und Rechtsbehelf dokumentiert werden.

## 6.2 Was der BSW-Fall zeigt - und was nicht

Bei der Bundestagswahl 2025 lag das endgültige BSW-Ergebnis um 4.277 Zweitstimmen über dem vorläufigen Ergebnis. Nach amtlicher Feststellung fehlten 9.529 Stimmen zur Fünf-Prozent-Hürde. Der Bundestag wies die Einsprüche auf Neuauszählung im Dezember 2025 zurück. Ob bei der ersten Auszählung Fehler auftraten, lässt sich ohne erneute Prüfung der Stimmzettel nicht zuverlässig sagen. Der Fall zeigt, wie hilfreich einzelne, unveränderbare und schnell zugängliche Belege bei einem knappen Ergebnis wären. Der digitale Wahlassistent würde Fehler nicht verhindern, aber ihre Prüfung erleichtern. \[5\]

# 7. Verfassungs- und wahlrechtliche Einordnung

## 7.1 Öffentlichkeit der Wahl

Das Bundesverfassungsgericht verlangt, dass die wesentlichen Schritte von Wahlhandlung und Ergebnisermittlung öffentlich überprüfbar bleiben und grundsätzlich ohne besondere Sachkenntnis verstanden werden können. Ein automatisches Endergebnis ohne Einblick in den Ablauf wäre damit nicht vereinbar. Das System muss seine Erkennung anzeigen, Zettel auf Wunsch vorlegen, öffentliche Tests zulassen und menschliche Entscheidungen dokumentieren. Beobachter müssen den Ablauf auch ohne Programmierkenntnisse verstehen können. \[4\]

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

Die Smartphones dürften im Vergleich zu Entwicklung, Prüfung und Betrieb nur einen kleinen Teil der Kosten ausmachen. Entscheidend sind die Sicherheit von Browser, Webanwendung und Cloud. Die lokale Erkennung läuft nur im Browser-Speicher und speichert die Aufnahme nicht automatisch in der privaten Fotogalerie. Web-Code, Stimmzetteldefinitionen und Ergebnisdateien werden signiert. Die Cloud nimmt Bild, Vorwertung und Prüfdaten nur in freigegebenen Sitzungen an, protokolliert Änderungen und trennt Wahlbezirke technisch voneinander.

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

Im Kern bleibt es bei handelsüblichen Smartphones und einer Weboberfläche. Besondere Erfassungshardware ist nicht vorgesehen. Vor Beginn gibt es einen kurzen Gerätetest. Ungeeignete Geräte werden durch andere Smartphones oder wenige Reservegeräte ersetzt. Bild und Vorwertung werden in der Cloud unabhängig geprüft; Papieroriginal, Vier-Augen-Prinzip und manuelle Rückfallebene bleiben maßgeblich. Eine Installation ist nicht erforderlich.

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

Die Technik kann schrittweise und in ausgewählten Wahlbezirken erprobt werden. Ein gemischter Betrieb ist organisatorisch möglich, sofern Ergebnisdateien eindeutig kennzeichnen, nach welchem Verfahren ein Wahlbezirk ausgezählt wurde, und die amtliche Aggregation beide Wege korrekt zusammenführt.

| **Ausbaustufe** | **Beteiligte Stellen**                     | **Transparenzreichweite**                           | **Zweck**                                                                               |
|-----------------|----------------------------------------------|-----------------------------------------------------|-----------------------------------------------------------------------------------------|
| A               | Einige Briefwahlvorstände                    | Nur die dort ausgezählten Briefwahlstimmen          | Kontrollierte Umgebung, hohe Stückzahlen, standardisierte Tische und erfahrene Leitung. |
| B               | Weitere Briefwahlvorstände                   | Wachsende, klar ausgewiesene Teilmenge              | Skalierung, Schulung und Support unter realen Bedingungen prüfen.                       |
| C               | Ausgewählte Urnenwahllokale                  | Beteiligte Wahlbezirke vollständig                | Alltagstauglichkeit in unterschiedlichen Räumen und Teams testen.                       |
| D               | Breiter Regelbetrieb mit manuellen Ausnahmen | Großer Anteil der Wahl; Rest weiterhin traditionell | Nutzen ausrollen, ohne ungeeignete Standorte oder Sonderfälle zu zwingen.               |

Eine teilweise Einführung prüft nicht die gesamte Wahl digital. Für die teilnehmenden Wahlbezirke entsteht aber eine zusätzliche Belegspur. Außerdem lässt sich das neue Verfahren direkt mit der bisherigen Zählung vergleichen. Dieser Parallelvergleich ist für die Auswertung wichtig.

# 11. Organisation, Aufwand und Beschaffung

Die Hardwarekosten sind nicht die Gesamtkosten. Der größere Aufwand liegt in rechtssicherer Spezifikation, barrierearmer Bedienung, Testdaten, Sicherheitsprüfung, Geräteverwaltung, Schulung, Support und unabhängiger Auswertung. Eine belastbare Kostenschätzung ist erst nach Phase 0 möglich.

| **Arbeitspaket**  | **Federführung**                                 | **Ergebnis**                                                                    |
|-------------------|--------------------------------------------------|---------------------------------------------------------------------------------|
| Wahlfachlichkeit  | Landeswahlamt + Bezirkswahlämter                 | Regelwerk, Prozess, Musterfälle, Abnahme.                                       |
| Recht/Datenschutz | Wahlrechts- und Datenschutzexpertise             | Pilotgrundlage, Folgenabschätzung, Veröffentlichungs- und Aufbewahrungskonzept. |
| Technik           | Öffentliche IT-Stelle + offenes Entwicklungsteam | Cloud-Webanwendung, Browseraufnahme, OMR, Signaturen, Schnittstellen.            |
| Sicherheit        | Unabhängige Prüfstelle                           | Bedrohungsmodell, Codeaudit, Penetrationstest, Lieferkettenprüfung.             |
| Evaluation        | Unabhängige Hochschule/Forschungsstelle          | Vorab registriertes Messdesign, Vergleich und Abschlussbericht.                 |
| Beteiligung       | Parteien, Wahlhelfer, Zivilgesellschaft        | Öffentliche Tests, Beobachtungsanforderungen, Vertrauensprüfung.                |

# 12. Entscheidungsvorlage für die Landeswahlleitung

Beantragt wird nicht die kurzfristige Abschaffung der manuellen Auszählung, sondern eine formale Machbarkeitsprüfung mit der Option eines Schattenpiloten. So bleibt das Risiko begrenzt und Berlin kann belastbare Erfahrungen mit einer möglichen Modernisierung sammeln.

## Vorgeschlagener Beschluss

1.  **Arbeitsgruppe:** Das Landeswahlamt richtet eine kleine interdisziplinäre Arbeitsgruppe "Scan-gestützte Auszählung" ein.

2.  **Vorprüfung:** Die Arbeitsgruppe erstellt binnen drei Monaten eine Rechts-, Datenschutz- und Prozessvorprüfung sowie einen offenen technischen Mindeststandard.

3.  **Prototyp:** Auf dieser Basis wird ein öffentlicher Laborprototyp mit synthetischen Stimmzetteln entwickelt und durch Wahlhelfer getestet.

4.  **Evaluation:** Eine unabhängige Stelle bewertet Genauigkeit, Durchsatz, Verständlichkeit, Sicherheit und Rückfallfähigkeit.

5.  **Entscheidung:** Erst danach entscheidet die Landeswahlleitung, ob ein rein zusätzlicher Schattenpilot bei einer geeigneten späteren Wahl beantragt wird.

## Mögliche strategische Wirkungen

- Entlastung ehrenamtlicher Wahlvorstände bei Routinearbeit;

- weniger Sortier-, Summen- und Übertragungsfehler;

- schnellere, gezieltere Nachprüfung knapper oder auffälliger Ergebnisse;

- bessere Datenbasis für Schulung, Qualitätssicherung und Wahlprüfung;

- offene technische Standards statt Abhängigkeit von einer proprietären Blackbox;

- unabhängige Nachzählung durch Parteien, Wissenschaft, Medien und interessierte Bürger mit eigener Software;

- sichtbare, verantwortungsbewusste Digitalisierung, ohne die Papierwahl aufzugeben.

> **Kernaussage:** Der digitale Wahlassistent soll die manuelle Auszählung bei Routinefällen entlasten. Papier, Öffentlichkeit und die Entscheidung des Wahlvorstands bleiben erhalten. Jede technische Prüfung muss dokumentiert und nachprüfbar sein.

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

Daraus ist die beigefügte Konzeptidee entstanden. Nach Öffnung der Urne werden Papierstimmzettel mit handelsüblichen, kontrollierten Smartphones aus der Hand fotografiert. Eine offene Webanwendung prüft die Aufnahme zunächst auf dem Gerät und überträgt Bild und Vorwertung anschließend an eine geschützte Cloud. Dort folgt eine zweite Prüfung. Erst danach werden Erst- und Zweitstimmen aus dem Bild zusammengezählt und in einem Prüfpaket dokumentiert. Unklare Fälle gehen an den Wahlvorstand. Der Papierstimmzettel bleibt die maßgebliche Grundlage.

Wahlgeheimnis, Öffentlichkeit, IT-Sicherheit und die Entscheidungshoheit des Wahlvorstands sind nicht verhandelbar. Deshalb schlägt die Studie keine kurzfristige Ablösung des heutigen Verfahrens vor. Zunächst sollen synthetische Stimmzettel, offene Software und eine unabhängige Prüfung genügen. Später könnte ein zusätzlicher Schattenbetrieb ohne Einfluss auf das amtliche Ergebnis folgen. Auf Antrag sollten Bürger, Parteien, Medien und Wissenschaft die Originalbilder mit eigener Software prüfen können.

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

# Empfehlung

> Berlin sollte einen ergebnisoffenen, öffentlich begleiteten Pilotversuch für eine scan-gestützte Auszählungsassistenz starten. Im Pilot bleibt die manuelle Auszählung allein verbindlich. Erst nach nachgewiesener Genauigkeit, Zeitersparnis, öffentlicher Verständlichkeit, IT-Sicherheit und einer ausdrücklichen gesetzlichen Grundlage darf über einen amtlichen Einsatz entschieden werden.
