/**
 * Auswertungen fuer das ControlCenter im Wahlamt, ohne DOM: Kennzahlen, Anteile, Handlungsbedarf,
 * CSV-Export und -Import. Grundlage ist die Antwort von GET /api/ergebnisse.
 * Sortieren und Filtern der Tabellen uebernimmt AG Grid.
 */
import { getWahllokalStatus } from '../shared/wahllokalAnzeige.js';

export const ANSICHTEN = ['dashboard', 'wahllokale', 'ergebnisse', 'prueffaelle', 'eingaenge', 'verwaltung'];

/** Reihenfolge wie im Ablauf; `art` waehlt die Farbe in styles.css. */
export const STATUS = [
  { text: 'Noch nicht begonnen', art: 'offen' },
  { text: 'Erfassung läuft', art: 'laufend' },
  { text: 'Erfasst – Prüffälle offen', art: 'pruefen' },
  { text: 'Erfasst', art: 'fertig' },
  { text: 'Über Soll – prüfen', art: 'fehler' },
];
export const getStatusArt = lokal => STATUS.find(status => status.text === getWahllokalStatus(lokal)).art;

/** Nach so langer Pause ohne neuen Stapel gilt eine laufende Erfassung als ins Stocken geraten. */
export const STOCKT_NACH_MS = 30 * 60 * 1000;

/** '#wahllokal/518' -> { ansicht: 'wahllokal', nummer: '518' }; Unbekanntes fuehrt zum Dashboard. */
export const parseRoute = hash => {
  const [ansicht, ...rest] = hash.replace(/^#\/?/, '').split('/');
  if (ansicht === 'wahllokal' && rest.join('/')) return { ansicht, nummer: decodeURIComponent(rest.join('/')) };
  return { ansicht: ANSICHTEN.includes(ansicht) ? ansicht : 'dashboard' };
};

const sum = (rows, get) => rows.reduce((total, row) => total + get(row), 0);
export const getLetzterEingang = lokal => lokal.stapel[0]?.eingang;

export const getKennzahlen = ({ gesamt, wahllokale }) => {
  const erwartet = sum(wahllokale, lokal => lokal.erwartet);
  const proStatus = Object.fromEntries(STATUS.map(({ art }) => [art, 0]));
  wahllokale.forEach(lokal => proStatus[getStatusArt(lokal)]++);
  const eingaenge = wahllokale.map(getLetzterEingang).filter(Boolean).sort();
  return {
    wahllokale: wahllokale.length, mitEingang: wahllokale.filter(lokal => lokal.zettel > 0).length, proStatus,
    zettel: gesamt.zettel, erwartet, anteil: erwartet ? gesamt.zettel / erwartet : 0, prueffaelle: gesamt.prueffaelle,
    stapel: sum(wahllokale, lokal => lokal.stapel.length), letzterEingang: eingaenge.at(-1),
  };
};

/** Wahlvorschlaege einer Stimme nach Stimmen absteigend, Anteil bezogen auf die eindeutig erkannten Stimmen. */
export const getAnteile = stimme => {
  const total = sum(stimme.wahlvorschlaege, vorschlag => vorschlag.anzahl);
  return stimme.wahlvorschlaege
    .map(vorschlag => ({ ...vorschlag, anteil: total ? vorschlag.anzahl / total : 0 }))
    .sort((a, b) => b.anzahl - a.anzahl || a.nummer - b.nummer);
};

/** Die neuesten Stapel ueber alle Wahllokale. */
export const getEingaenge = (wahllokale, limit = Infinity) => wahllokale
  .flatMap(lokal => lokal.stapel.map(stapel => ({ ...stapel, wahllokal: lokal.nummer, wahllokalName: lokal.name })))
  .sort((a, b) => b.eingang.localeCompare(a.eingang) || a.id.localeCompare(b.id))
  .slice(0, limit);

/** Wahllokale, um die sich das Wahlamt kuemmern sollte: ueber Soll oder ohne neue Stapel trotz laufender Erfassung. */
export const getHandlungsbedarf = (wahllokale, now = Date.now()) => wahllokale.flatMap(lokal => {
  if (lokal.zettel > lokal.erwartet) return [{ lokal, art: 'fehler', grund: `${lokal.zettel - lokal.erwartet} Zettel über Soll` }];
  const letzter = getLetzterEingang(lokal);
  const pause = letzter ? now - Date.parse(letzter) : 0;
  if (lokal.zettel && lokal.zettel < lokal.erwartet && pause > STOCKT_NACH_MS)
    return [{ lokal, art: 'pruefen', grund: `Seit ${formatDauer(pause)} kein Stapel` }];
  return [];
});

/** Wertung einer Stimme auf einem Zettel, lesbar: 'Partei A', 'Leer', 'Mehrfach: A, B', 'Unklar'. */
export const getWertungText = (stimme, definition) => {
  const namen = stimme.wahlvorschlaege.map(id => definition?.wahlvorschlaege.find(vorschlag => vorschlag.id === id)?.beschriftung ?? id).join(', ');
  return { gueltig: namen, leer: 'Leer', mehrfach: `Mehrfach: ${namen}`, zweifelsfall: namen ? `Unklar: ${namen}` : 'Unklar' }[stimme.status] ?? stimme.status;
};

export const formatZeitpunkt = iso => new Date(iso).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'medium' });
export const formatZahl = zahl => zahl.toLocaleString('de-DE');
export const formatProzent = anteil => `${(anteil * 100).toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} %`;
export const formatDauer = ms => {
  const minuten = Math.floor(ms / 60000);
  return minuten < 60 ? `${minuten} Min.` : `${Math.floor(minuten / 60)} Std. ${minuten % 60} Min.`;
};
/** 'gerade eben', 'vor 12 Min.' - beim Monitoring zaehlt das Alter, nicht die Uhrzeit. */
export const formatSeit = (iso, now = Date.now()) => {
  if (!iso) return '–';
  const ms = now - Date.parse(iso);
  return ms < 60000 ? 'gerade eben' : `vor ${formatDauer(ms)}`;
};

/* --- CSV ---------------------------------------------------------------- */

const csvWert = value => (/[;"\n\r]/.test(String(value)) ? `"${String(value).replaceAll('"', '""')}"` : String(value));
const csvZeile = values => values.map(csvWert).join(';');

/** Ergebnis je Wahllokal und insgesamt, Semikolon-getrennt wie in deutschen Tabellenkalkulationen. */
export const toErgebnisCsv = ({ gesamt, wahllokale }) => {
  const spalten = gesamt.stimmen.flatMap(stimme => [
    ...stimme.wahlvorschlaege.map(vorschlag => `${stimme.name}: ${vorschlag.beschriftung}`),
    `${stimme.name}: leer`, `${stimme.name}: mehrfach`, `${stimme.name}: unklar`,
  ]);
  const werte = summe => summe.stimmen.flatMap(stimme => [
    ...stimme.wahlvorschlaege.map(vorschlag => vorschlag.anzahl), stimme.leer, stimme.mehrfach, stimme.zweifelsfall,
  ]);
  return [
    csvZeile(['Wahllokal', 'Name', 'Erwartet', 'Erfasst', 'Prüffälle', ...spalten]),
    ...wahllokale.map(lokal => csvZeile([lokal.nummer, lokal.name, lokal.erwartet, lokal.zettel, lokal.prueffaelle, ...werte(lokal)])),
    csvZeile(['Gesamt', '', sum(wahllokale, lokal => lokal.erwartet), gesamt.zettel, gesamt.prueffaelle, ...werte(gesamt)]),
  ].join('\r\n') + '\r\n';
};

/**
 * Wahllokale fuer die Registrierung aus CSV: Nummer;Name;Erwartet (auch Komma oder Tab).
 * Eine Kopfzeile wird erkannt, wenn ihre dritte Spalte keine Zahl ist.
 */
export const parseWahllokalCsv = text => {
  const wahllokale = [];
  const fehler = [];
  const nummern = new Set();
  text.split(/\r?\n/).forEach((line, index) => {
    if (!line.trim()) return;
    const trenner = [';', '\t', ','].find(zeichen => line.includes(zeichen)) ?? ';';
    const [nummer = '', name = '', erwartet = ''] = line.split(trenner).map(value => value.trim().replace(/^"(.*)"$/, '$1'));
    if (index === 0 && !/^\d+$/.test(erwartet)) return;
    const zeile = index + 1;
    const anzahl = Number(erwartet);
    if (!nummer || !name) fehler.push(`Zeile ${zeile}: Nummer und Name fehlen.`);
    else if (!/^\d+$/.test(erwartet) || anzahl < 1 || anzahl > 100000) fehler.push(`Zeile ${zeile}: Erwartete Stimmzettel müssen zwischen 1 und 100000 liegen.`);
    else if (nummern.has(nummer)) fehler.push(`Zeile ${zeile}: Wahllokal ${nummer} steht doppelt in der Datei.`);
    else {
      nummern.add(nummer);
      wahllokale.push({ nummer, name, erwartet: anzahl });
    }
  });
  return { wahllokale, fehler };
};
