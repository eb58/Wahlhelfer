import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formatProzent, formatSeit, getAnteile, getEingaenge, getHandlungsbedarf, getKennzahlen,
  filterWahlkreis, getStatusArt, getWahlkreise, getWahlName, getWahlTitel, getWertungText, parseRoute, parseWahlbezirk, parseWahllokalCsv, toErgebnisCsv,
} from '../src/controlcenter/auswertung.js';

const stimme = (name, anzahlen) => ({
  id: name.toLowerCase(), name, gueltig: anzahlen.reduce((a, b) => a + b, 0), leer: 1, mehrfach: 0, zweifelsfall: 2,
  wahlvorschlaege: anzahlen.map((anzahl, index) => ({ id: `${name[0]}${index + 1}`, nummer: index + 1, beschriftung: `Partei ${index + 1}`, anzahl })),
});
const lokal = (nummer, name, erwartet, zettel, stapel = [], prueffaelle = 0) =>
  ({ nummer, name, erwartet, zettel, prueffaelle, stapel, stimmen: [stimme('Zweitstimme', [zettel, 0])] });
const stapel = (id, eingang) => ({ id, eingang, soll: 20, zettel: 20, prueffaelle: 0, erfasstVon: 'vorstand' });

const daten = {
  gesamt: { zettel: 520, prueffaelle: 3, stimmen: [stimme('Zweitstimme', [300, 100])] },
  wahllokale: [
    lokal('10', 'Rathaus', 500, 500, [stapel('c', '2026-10-14T18:40:00.000Z')], 3),
    lokal('2', 'Schule am Teich', 400, 0),
    lokal('3', 'Turnhalle', 100, 20, [stapel('b', '2026-10-14T18:00:00.000Z')]),
  ],
};

test('Route aus dem Hash: Ansicht, Wahllokal-Detail, sonst Dashboard', () => {
  assert.deepEqual(parseRoute('#wahllokale'), { ansicht: 'wahllokale' });
  assert.deepEqual(parseRoute('#wahllokal/518%2Fa'), { ansicht: 'wahllokal', nummer: '518/a' });
  assert.deepEqual(parseRoute('#wahllokal/'), { ansicht: 'dashboard' });
  assert.deepEqual(parseRoute(''), { ansicht: 'dashboard' });
  assert.deepEqual(parseRoute('#unsinn'), { ansicht: 'dashboard' });
});

test('Kennzahlen fassen Wahllokale, Fortschritt und letzten Eingang zusammen', () => {
  const kennzahlen = getKennzahlen(daten);
  assert.equal(kennzahlen.wahllokale, 3);
  assert.equal(kennzahlen.mitEingang, 2);
  assert.equal(kennzahlen.erwartet, 1000);
  assert.equal(kennzahlen.anteil, 0.52);
  assert.equal(kennzahlen.stapel, 2);
  assert.equal(kennzahlen.letzterEingang, '2026-10-14T18:40:00.000Z');
  assert.deepEqual(kennzahlen.proStatus, { ungemeldet: 0, offen: 1, laufend: 1, pruefen: 1, fertig: 0, fehler: 0 });
});

test('Anteile beziehen sich auf eindeutig erkannte Stimmen, stärkster Vorschlag zuerst', () => {
  const anteile = getAnteile(stimme('Zweitstimme', [100, 300, 0]));
  assert.deepEqual(anteile.map(row => [row.nummer, row.anteil]), [[2, 0.75], [1, 0.25], [3, 0]]);
  assert.equal(getAnteile(stimme('Erststimme', [0, 0]))[0].anteil, 0);
  assert.equal(formatProzent(0.256), '25,6 %');
});

test('Fehlende Meldungen bleiben offen und verfälschen den gemeldeten Fortschritt nicht', () => {
  const offen = lokal('4', 'Noch ohne Meldung', null, 0);
  const kennzahlen = getKennzahlen({ ...daten, wahllokale: [...daten.wahllokale, offen] });
  assert.equal(kennzahlen.ungemeldet, 1);
  assert.equal(kennzahlen.erwartet, 1000);
  assert.equal(kennzahlen.proStatus.ungemeldet, 1);
  assert.equal(getStatusArt(offen), 'ungemeldet');
  assert.deepEqual(getHandlungsbedarf([offen]), []);
});

test('Status eines Wahllokals als Art für Farbe und Filter', () => {
  assert.deepEqual(daten.wahllokale.map(getStatusArt), ['pruefen', 'offen', 'laufend']);
});

test('Wertung eines Zettels mit Beschriftungen statt Kennungen', () => {
  const definition = stimme('Zweitstimme', [0, 0]);
  const text = (status, wahlvorschlaege) => getWertungText({ status, wahlvorschlaege }, definition);
  assert.equal(text('gueltig', ['Z1']), 'Partei 1');
  assert.equal(text('mehrfach', ['Z1', 'Z2']), 'Mehrfach: Partei 1, Partei 2');
  assert.equal(text('leer', []), 'Leer');
  assert.equal(text('zweifelsfall', []), 'Unklar');
  assert.equal(text('zweifelsfall', ['Z9']), 'Unklar: Z9');
});

test('Eingänge: neueste Stapel zuerst, mit Wahllokal', () => {
  const eingaenge = getEingaenge(daten.wahllokale, 1);
  assert.deepEqual(eingaenge.map(row => [row.id, row.wahllokal, row.wahllokalName]), [['c', '10', 'Rathaus']]);
});

test('Handlungsbedarf: über Soll sowie stockende Erfassung, nicht aber fertige oder unbegonnene Wahllokale', () => {
  const now = Date.parse('2026-10-14T18:45:00.000Z');
  const ueber = lokal('4', 'Kita', 10, 12, [stapel('d', '2026-10-14T18:44:00.000Z')]);
  const bedarf = getHandlungsbedarf([...daten.wahllokale, ueber], now);
  assert.deepEqual(bedarf.map(row => [row.lokal.nummer, row.art, row.grund]), [
    ['3', 'pruefen', 'Seit 45 Min. kein Stapel'],
    ['4', 'fehler', '2 Zettel über Soll'],
  ]);
  assert.equal(formatSeit('2026-10-14T18:44:30.000Z', now), 'gerade eben');
  assert.equal(formatSeit('2026-10-14T16:30:00.000Z', now), 'vor 2 Std. 15 Min.');
  assert.equal(formatSeit(undefined, now), '–');
});

test('Wahllokale gruppiert nach Wahlkreis, getrennt nach Urnen- und Briefwahlbezirken', () => {
  assert.deepEqual(parseWahlbezirk('12101'), { wahlkreis: '121', bezirk: '01', brief: false });
  assert.deepEqual(parseWahlbezirk('123ZA'), { wahlkreis: '123', bezirk: 'ZA', brief: true });
  assert.deepEqual(parseWahlbezirk('518'), { wahlkreis: '', bezirk: '518', brief: false });
  const gruppen = getWahlkreise([lokal('122A', 'Brief', 30, 5), lokal('12210', 'Halle', 50, 10), lokal('12102', 'Kita', null, 3), lokal('12202', 'Schule', 20, 0), lokal('121Z', 'Brief', 10, 1), lokal('121ZA', 'Brief', 10, 0)]);
  assert.deepEqual(gruppen.map(({ wahlkreis, urne, brief, zettel, erwartet }) => [wahlkreis, urne.map(row => row.bezirk), brief.map(row => row.bezirk), zettel, erwartet]), [
    ['121', ['02'], ['Z', 'ZA'], 4, 20],
    ['122', ['02', '10'], ['A'], 15, 100],
  ]);
});

test('Auf einen Wahlkreis beschränkt: nur dessen Wahllokale, Gesamtsumme aus ihnen', () => {
  const data = { wahl: 'Bundestagswahl 2017, Wahlkreis 16', gesamt: daten.gesamt, wahllokale: [lokal('12101', 'Kita', 50, 20, [], 1), lokal('121A', 'Brief', 30, 5), lokal('12201', 'Halle', 40, 7)] };
  const wahlkreis = filterWahlkreis(data, '121');
  assert.deepEqual(wahlkreis.wahllokale.map(row => row.nummer), ['12101', '121A']);
  assert.equal(wahlkreis.gesamt.zettel, 25);
  assert.equal(wahlkreis.gesamt.prueffaelle, 1);
  assert.deepEqual(wahlkreis.gesamt.stimmen[0].wahlvorschlaege.map(row => row.anzahl), [25, 0]);
  assert.equal(wahlkreis.gesamt.stimmen[0].gueltig, 25);
  assert.equal(getWahlTitel(data.wahl, '1205 – Reinickendorf 5'), 'Bundestagswahl 2017, Wahlkreis 1205 – Reinickendorf 5');
  assert.equal(getWahlTitel('Landtagswahl', '1201 – Reinickendorf 1'), 'Landtagswahl, Wahlkreis 1201 – Reinickendorf 1');
  assert.equal(getWahlTitel(data.wahl, undefined), 'Bundestagswahl 2017');
  assert.equal(getWahlName('Landtagswahl'), 'Landtagswahl');
});

test('CSV-Export enthält je Wahllokal eine Zeile und die Gesamtsumme', () => {
  const csv = toErgebnisCsv({ ...daten, wahllokale: [lokal('1', 'Haus "Am See"; Nord', 50, 2)] }).split('\r\n');
  assert.equal(csv[0], 'Wahllokal;Name;Erwartet;Erfasst;Prüffälle;Zweitstimme: Partei 1;Zweitstimme: Partei 2;Zweitstimme: leer;Zweitstimme: mehrfach;Zweitstimme: unklar');
  assert.equal(csv[1], '1;"Haus ""Am See""; Nord";50;2;0;2;0;1;0;2');
  assert.equal(csv[2], 'Gesamt;;50;520;3;300;100;1;0;2');
});

test('CSV-Import erkennt Kopfzeile und Trenner und meldet fehlerhafte Zeilen', () => {
  const { wahllokale, fehler } = parseWahllokalCsv('Nummer;Name\n001;Rathaus\n\n002,\n003\tKita\n001;Doppelt\n;Ohne Nummer\n');
  assert.deepEqual(wahllokale, [{ nummer: '001', name: 'Rathaus' }, { nummer: '003', name: 'Kita' }]);
  assert.deepEqual(fehler, [
    'Zeile 4: Nummer und Name fehlen.',
    'Zeile 6: Wahllokal 001 steht doppelt in der Datei.',
    'Zeile 7: Nummer und Name fehlen.',
  ]);
});
