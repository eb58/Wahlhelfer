/**
 * Die Ansichten des ControlCenters. Jede wird beim Aufruf einmal aufgebaut (Werkzeuge, Tabellen)
 * und bekommt mit update(data) jede neue Antwort von GET /api/ergebnisse; destroy() raeumt auf.
 */
import { api } from '../api/serverApi.js';
import { getWahllokalStatus } from '../api/wahllokalAnzeige.js';
import {
  STATUS, filterWahlkreis, formatProzent, formatSeit, formatZahl, formatZeitpunkt, getEingaenge, getHandlungsbedarf, getKennzahlen,
  getLetzterEingang, getStatusArt, getWahlkreise, getWahlName, getWahlTitel, getWertungText, parseWahllokalCsv, toErgebnisCsv,
} from './auswertung.js';
import { anteilListe, download, fortschritt, h, metrik, panel, statusBadge, stimmZaehler, zellenKnopf } from './bausteine.js';
import { createTabelle } from './tabellen.js';

const zuWahllokal = nummer => { globalThis.location.hash = `#wahllokal/${encodeURIComponent(nummer)}`; };
const wahllokalLink = lokal => h('a', { href: `#wahllokal/${encodeURIComponent(lokal.nummer)}` }, `${lokal.nummer} · ${lokal.name}`);
const nummerVergleich = (a, b) => String(a).localeCompare(String(b), 'de-DE', { numeric: true });
const nummerSpalte = { field: 'nummer', headerName: 'Nr.', width: 100, comparator: nummerVergleich, pinned: 'left' };
const zahlSpalte = (field, headerName) => ({ field, headerName, filter: 'agNumberColumnFilter', width: 120, valueFormatter: ({ value }) => formatZahl(value ?? 0) });
const kurzeKennung = ({ value }) => value.slice(0, 8);
const suchfeld = (tabelle, text) => h('input', {
  class: 'suche', type: 'search', placeholder: text, 'aria-label': text,
  oninput: event => tabelle.setGridOption('quickFilterText', event.target.value),
});

/** Je Stimme eine Spalte mit der lesbaren Wertung; Prueffaelle farbig hervorgehoben. */
const wertungSpalten = stimmen => stimmen.map(definition => {
  const stimme = data => data.stimmen.find(row => row.id === definition.id);
  return {
    colId: definition.id, headerName: definition.name, minWidth: 200, flex: 1,
    valueGetter: ({ data }) => (stimme(data) ? getWertungText(stimme(data), definition) : '–'),
    cellClass: ({ data }) => (data && stimme(data)?.status !== 'gueltig' ? 'zelle--pruefen' : ''),
  };
});

/* --- Dashboard ---------------------------------------------------------- */

const statusVerteilung = (kennzahlen, state) => h('div', { class: 'verteilung' },
  h('div', { class: 'verteilung__balken', role: 'img', 'aria-label': 'Wahllokale nach Status' },
    STATUS.map(({ art, text }) => kennzahlen.proStatus[art] > 0 && h('span', {
      class: `verteilung__teil status--${art}`, title: `${text}: ${kennzahlen.proStatus[art]}`,
      style: `flex-grow: ${kennzahlen.proStatus[art]}`,
    }))),
  h('ul', { class: 'legende' }, STATUS.map(({ art, text }) => h('li', {},
    h('a', { href: '#wahllokale', onclick: () => { state.statusFilter = art; } },
      h('span', { class: `punkt status--${art}` }), text, h('strong', {}, kennzahlen.proStatus[art]))))));

const kachel = ({ lokal, bezirk }) => h('a', {
  class: `kachel status--${getStatusArt(lokal)}`, href: `#wahllokal/${encodeURIComponent(lokal.nummer)}`,
  title: `${lokal.nummer} · ${lokal.name}\n${getWahllokalStatus(lokal)} · ${lokal.zettel} / ${lokal.erwartet ?? 'noch nicht gemeldet'}`,
}, h('span', { class: 'kachel__fuellung', style: `height: ${Math.min(1, lokal.erwartet ? lokal.zettel / lokal.erwartet : 0) * 100}%` }),
h('span', { class: 'kachel__nummer' }, bezirk));

const wahlkreisName = ({ wahlkreis }) => wahlkreis?.name ?? 'Sonstige';
const wahlkreisTitel = ({ wahlkreis }) => wahlkreis && `${wahlkreis.nummer} – ${wahlkreis.name}`;

/** Jedes Wahllokal des Wahlkreises als Kachel, gefuellt nach Fortschritt, geteilt in Urnen- und Briefwahlbezirke. */
const kachelKarte = gruppe => h('section', { class: 'wahlkreis' },
  gruppe.wahlkreis && h('h3', {}, wahlkreisName(gruppe),
    h('small', { title: gruppe.wahlkreis.beschreibung }, gruppe.wahlkreis.beschreibung),
    h('span', {}, `${formatZahl(gruppe.zettel)} / ${formatZahl(gruppe.erwartet)} Zettel`)),
  [['Urne', gruppe.urne], ['Brief', gruppe.brief]].map(([art, lokale]) => lokale.length > 0 && h('div', { class: 'wahlkreis__zeile' },
    gruppe.wahlkreis && h('span', { class: 'wahlkreis__art' }, art),
    h('div', { class: 'kacheln' }, lokale.map(kachel)))));

const WAHLKREIS_KEY = 'wahlassistent-controlcenter-wahlkreis';
const loadWahlkreis = () => {
  try { return globalThis.localStorage.getItem(WAHLKREIS_KEY) ?? undefined; } catch { return undefined; }
};

/** Das Dashboard zeigt immer genau einen Wahlkreis; umgeschaltet wird ueber Badges oben in den Werkzeugen. */
const dashboard = ({ inhalt, werkzeuge, state, setWahl }) => {
  const auswahl = h('div', { class: 'chips wahlkreis-auswahl', role: 'radiogroup', 'aria-label': 'Wahlkreis' });
  werkzeuge.append(auswahl);
  state.wahlkreis ??= loadWahlkreis();
  let letzte;
  const select = wahlkreis => {
    state.wahlkreis = wahlkreis;
    try { globalThis.localStorage.setItem(WAHLKREIS_KEY, wahlkreis); } catch { /* nur Komfort */ }
    update(letzte);
  };
  const update = alle => {
    letzte = alle;
    const gruppen = getWahlkreise(alle.wahllokale, state.gebiet);
    const gruppe = gruppen.find(row => row.id === state.wahlkreis) ?? gruppen[0];
    auswahl.hidden = gruppen.length < 2;
    auswahl.replaceChildren(...gruppen.map(row => h('button', {
      class: 'chip', type: 'button', role: 'radio', 'aria-checked': String(row === gruppe), onclick: () => select(row.id),
    }, wahlkreisName(row), h('span', { class: 'chip__zahl' }, row.urne.length + row.brief.length))));
    setWahl(getWahlTitel(alle.wahl, gruppe && wahlkreisTitel(gruppe)));
    const data = gruppe ? filterWahlkreis(alle, gruppe) : alle;
    const kennzahlen = getKennzahlen(data);
    const bedarf = getHandlungsbedarf(data.wahllokale);
    const eingaenge = getEingaenge(data.wahllokale, 8);
    inhalt.replaceChildren(
      h('div', { class: 'metriken' },
        metrik('Wahllokale mit Eingang', `${kennzahlen.mitEingang} / ${kennzahlen.wahllokale}`,
          `${kennzahlen.proStatus.fertig + kennzahlen.proStatus.pruefen} vollständig erfasst`),
        metrik('Stimmzettel erfasst', formatZahl(kennzahlen.zettel),
          `${formatZahl(kennzahlen.erwartet)} gemeldet · ${kennzahlen.ungemeldet} Wahllokale ohne Meldung`),
        metrik('Prüffälle', formatZahl(kennzahlen.prueffaelle),
          kennzahlen.zettel ? `${formatProzent(kennzahlen.prueffaelle / kennzahlen.zettel)} der Zettel` : 'noch keine Zettel', kennzahlen.prueffaelle ? 'pruefen' : ''),
        metrik('Stapel', formatZahl(kennzahlen.stapel), `letzter ${formatSeit(kennzahlen.letzterEingang)}`),
        metrik('Handlungsbedarf', bedarf.length, bedarf.length ? 'Wahllokale prüfen' : 'keine Auffälligkeiten', bedarf.length ? 'fehler' : 'fertig')),
      h('div', { class: 'raster' },
        panel(`Wahllokale auf einen Blick (${data.wahllokale.length})`, data.wahllokale.length
          ? kachelKarte(gruppe) : h('p', { class: 'leer' }, 'Noch keine Wahllokale registriert – unter Verwaltung anlegen oder importieren.')),
        panel('Fortschritt der Erfassung',
          h('div', { class: 'gross-fortschritt' }, fortschritt(kennzahlen.zettel, kennzahlen.erwartet),
            h('span', {}, kennzahlen.erwartet ? `${formatProzent(kennzahlen.anteil)} der gemeldeten Stimmzettel` : 'Noch keine Stimmzettelzahl gemeldet')),
          statusVerteilung(kennzahlen, state)),
        panel('Handlungsbedarf', bedarf.length
          ? h('ul', { class: 'liste' }, bedarf.map(({ lokal, art, grund }) => h('li', {}, h('span', { class: `punkt status--${art}` }), wahllokalLink(lokal), h('span', { class: 'liste__rechts' }, grund))))
          : h('p', { class: 'leer' }, 'Keine Wahllokale über Soll, keine stockende Erfassung.')),
        ...data.gesamt.stimmen.map(stimme => panel(`${stimme.name} – vorläufig`, stimmZaehler(stimme), anteilListe(stimme, 6))),
        panel('Letzte Eingänge', eingaenge.length
          ? h('ul', { class: 'liste' }, eingaenge.map(stapel => h('li', {},
            wahllokalLink({ nummer: stapel.wahllokal, name: stapel.wahllokalName }),
            h('span', { class: 'liste__rechts' }, `${stapel.zettel} Zettel · ${formatSeit(stapel.eingang)}`))))
          : h('p', { class: 'leer' }, 'Noch keine Stapel eingegangen.'))));
  };
  return { titel: 'Dashboard', update, destroy: () => setWahl(getWahlName(state.data?.wahl ?? '')) };
};

/* --- Wahllokale --------------------------------------------------------- */

const wahllokale = ({ inhalt, werkzeuge, state }) => {
  const element = h('div', { class: 'tabelle' });
  const tabelle = createTabelle(element, {
    getRowId: ({ data }) => data.nummer,
    rowClass: 'klickbar',
    onRowClicked: ({ data }) => zuWahllokal(data.nummer),
    isExternalFilterPresent: () => !!state.statusFilter,
    doesExternalFilterPass: node => getStatusArt(node.data) === state.statusFilter,
    columnDefs: [
      nummerSpalte,
      { field: 'name', headerName: 'Wahllokal', flex: 2, minWidth: 200 },
      { colId: 'status', headerName: 'Status', minWidth: 200, valueGetter: ({ data }) => getWahllokalStatus(data), cellRenderer: ({ data }) => statusBadge(data) },
      {
        colId: 'fortschritt', headerName: 'Fortschritt', flex: 1, minWidth: 220, filter: false,
        valueGetter: ({ data }) => data.erwartet ? data.zettel / data.erwartet : 0,
        cellRenderer: ({ data }) => h('span', { class: 'zelle-fortschritt' }, fortschritt(data.zettel, data.erwartet), `${formatZahl(data.zettel)} / ${data.erwartet === null ? 'noch nicht gemeldet' : formatZahl(data.erwartet)}`),
      },
      { ...zahlSpalte('stapel', 'Stapel'), field: undefined, colId: 'stapel', valueGetter: ({ data }) => data.stapel.length },
      zahlSpalte('prueffaelle', 'Prüffälle'),
      { colId: 'eingang', headerName: 'Letzter Stapel', minWidth: 160, filter: false, valueGetter: ({ data }) => getLetzterEingang(data) ?? '', valueFormatter: ({ value }) => formatSeit(value || undefined) },
    ],
  });
  const chips = [{ art: '', text: 'Alle' }, ...STATUS].map(({ art, text }) => h('button', {
    class: `chip${art ? ` status--${art}` : ''}`, type: 'button', 'data-art': art,
    onclick: () => { state.statusFilter = art; markChips(); tabelle.onFilterChanged(); },
  }, h('span', { class: 'punkt' }), text, h('span', { class: 'chip__zahl' })));
  const markChips = () => chips.forEach(chip => chip.setAttribute('aria-pressed', String(chip.dataset.art === state.statusFilter)));
  markChips();
  werkzeuge.append(suchfeld(tabelle, 'Nummer oder Name suchen'), h('div', { class: 'chips' }, chips));
  inhalt.append(element);
  return {
    titel: 'Wahllokale',
    update: data => {
      const { proStatus, wahllokale: anzahl } = getKennzahlen(data);
      chips.forEach(chip => { chip.lastChild.textContent = chip.dataset.art ? proStatus[chip.dataset.art] : anzahl; });
      tabelle.setGridOption('rowData', data.wahllokale);
      tabelle.refreshCells({ columns: ['eingang'], force: true });
    },
    destroy: () => tabelle.destroy(),
  };
};

/* --- Wahllokal-Detail --------------------------------------------------- */

const wahllokal = ({ inhalt, state, showFehler, setTitel, zeigeBeleg }, { nummer }) => {
  const kopf = h('div');
  const ergebnis = h('div', { class: 'raster' });
  const stapelElement = h('div');
  const stapelDetail = h('div');
  let gewaehlt;
  let belegTabelle;
  const zeigeStapel = async id => {
    gewaehlt = id;
    try {
      if (!state.stapelCache.has(id)) state.stapelCache.set(id, await api(`stapel/${encodeURIComponent(id)}`));
    } catch (error) { return showFehler(error); }
    // Stapel aendern sich nach dem Eingang nicht mehr: einmal geladen, bleibt der Cache gueltig.
    if (gewaehlt !== id) return;
    const stapel = state.stapelCache.get(id);
    const element = h('div');
    belegTabelle?.destroy();
    stapelDetail.replaceChildren(panel(`Stapel ${id.slice(0, 8)} · ${formatZeitpunkt(stapel.eingang)}`,
      h('p', { class: 'zaehler' }, `${stapel.zettel} von ${stapel.soll} Zetteln · ${stapel.prueffaelle} Prüffälle · Konto ${stapel.erfasstVon ?? '–'}`),
      element));
    belegTabelle = createTabelle(element, {
      domLayout: 'autoHeight', rowClass: 'klickbar', getRowId: ({ data }) => data.id,
      rowData: stapel.belege.map((beleg, index) => ({ ...beleg, nr: index + 1 })),
      onRowClicked: ({ data }) => zeigeBeleg(data),
      columnDefs: [
        { field: 'nr', headerName: 'Nr.', width: 80 },
        ...wertungSpalten(state.data.gesamt.stimmen),
        { colId: 'beleg', headerName: '', width: 110, sortable: false, filter: false, cellRenderer: zellenKnopf('Beleg', zeigeBeleg) },
      ],
    });
    stapelDetail.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  const stapelTabelle = createTabelle(stapelElement, {
    domLayout: 'autoHeight', rowClass: 'klickbar', getRowId: ({ data }) => data.id,
    onRowClicked: ({ data }) => zeigeStapel(data.id),
    columnDefs: [
      { field: 'eingang', headerName: 'Eingang', minWidth: 180, sort: 'desc', valueFormatter: ({ value }) => formatZeitpunkt(value) },
      { field: 'id', headerName: 'Stapel', minWidth: 120, valueFormatter: kurzeKennung },
      { field: 'zettel', headerName: 'Zettel / Soll', valueFormatter: ({ data }) => `${data.zettel} / ${data.soll}` },
      zahlSpalte('prueffaelle', 'Prüffälle'),
      { field: 'erfasstVon', headerName: 'Konto', flex: 1, valueFormatter: ({ value }) => value ?? '–' },
    ],
  });
  inhalt.append(kopf, ergebnis, panel('Eingegangene Stapel', h('p', { class: 'hinweis' }, 'Stapel anklicken, um seine Belege zu sehen.'), stapelElement), stapelDetail);
  return {
    titel: `Wahllokal ${nummer}`,
    update: data => {
      const lokal = data.wahllokale.find(row => row.nummer === nummer);
      if (!lokal) return kopf.replaceChildren(panel(null, h('p', {}, `Wahllokal ${nummer} ist nicht registriert.`), h('a', { href: '#wahllokale' }, 'Zur Liste der Wahllokale')));
      setTitel(`Wahllokal ${lokal.nummer}`);
      kopf.replaceChildren(
        h('div', { class: 'detail-kopf' }, h('a', { class: 'zurueck', href: '#wahllokale' }, '← Alle Wahllokale'),
          h('h2', {}, lokal.name), statusBadge(lokal)),
        h('div', { class: 'metriken' },
          metrik('Erfasst', `${formatZahl(lokal.zettel)} / ${lokal.erwartet === null ? 'noch nicht gemeldet' : formatZahl(lokal.erwartet)}`, lokal.erwartet === null ? undefined : formatProzent(lokal.zettel / lokal.erwartet)),
          metrik('Stapel', lokal.stapel.length, `letzter ${formatSeit(getLetzterEingang(lokal))}`),
          metrik('Prüffälle', formatZahl(lokal.prueffaelle), undefined, lokal.prueffaelle ? 'pruefen' : ''),
          metrik('Fehlend', lokal.erwartet === null ? '–' : formatZahl(Math.max(0, (lokal.erwartet ?? 0) - lokal.zettel)), lokal.erwartet !== null && lokal.zettel > lokal.erwartet ? `${lokal.zettel - lokal.erwartet} über Soll` : undefined, lokal.zettel > lokal.erwartet ? 'fehler' : '')),
        h('div', { class: 'gross-fortschritt' }, fortschritt(lokal.zettel, lokal.erwartet)));
      ergebnis.replaceChildren(...lokal.stimmen.map(stimme => panel(`${stimme.name} – vorläufig`, stimmZaehler(stimme), anteilListe(stimme))));
      stapelTabelle.setGridOption('rowData', lokal.stapel);
    },
    destroy: () => { stapelTabelle.destroy(); belegTabelle?.destroy(); },
  };
};

/* --- Ergebnisse --------------------------------------------------------- */

const ergebnisse = ({ inhalt, werkzeuge, state }) => {
  const balken = h('div', { class: 'raster ergebnis-stimmen' });
  const auswahl = h('div', { class: 'segmente', role: 'group', 'aria-label': 'Stimme' });
  const element = h('div', { class: 'tabelle' });
  let spaltenFuer;
  const tabelle = createTabelle(element, {
    getRowId: ({ data }) => (data.gesamtZeile ? '__gesamt' : data.nummer),
    rowClass: 'klickbar',
    getRowClass: ({ data }) => (data?.gesamtZeile ? 'zeile--gesamt' : ''),
    onRowClicked: ({ data }) => { if (!data.gesamtZeile) zuWahllokal(data.nummer); },
  });
  const spalten = definition => {
    const stimme = data => data.stimmen.find(row => row.id === definition.id);
    const zaehler = (colId, headerName, get) => ({ ...zahlSpalte(undefined, headerName), colId, valueGetter: ({ data }) => get(stimme(data)) });
    return [
      nummerSpalte,
      { field: 'name', headerName: 'Wahllokal', minWidth: 200, pinned: 'left' },
      zahlSpalte('zettel', 'Erfasst'),
      ...definition.wahlvorschlaege.map((vorschlag, index) => ({
        ...zaehler(vorschlag.id, vorschlag.beschriftung, row => row.wahlvorschlaege[index].anzahl),
        headerTooltip: vorschlag.beschriftung, wrapHeaderText: true, autoHeaderHeight: true, width: 130,
      })),
      zaehler('leer', 'Leer', row => row.leer),
      zaehler('mehrfach', 'Mehrfach', row => row.mehrfach),
      zaehler('unklar', 'Unklar', row => row.zweifelsfall),
    ];
  };
  const exportCsv = () => download(`ergebnisse-${new Date().toISOString().slice(0, 10)}.csv`, `﻿${toErgebnisCsv(state.data)}`, 'text/csv;charset=utf-8');
  werkzeuge.append(auswahl, suchfeld(tabelle, 'Wahllokal suchen'), h('button', { class: 'knopf knopf--klein', type: 'button', onclick: exportCsv }, 'CSV-Export'));
  inhalt.append(balken, panel('Ergebnis je Wahllokal', h('p', { class: 'hinweis' }, 'Zeile anklicken für das Wahllokal; die letzte Zeile ist die Summe aller Wahllokale.'), element));
  const view = {
    titel: 'Ergebnisse',
    update: data => {
      const definition = data.gesamt.stimmen.find(stimme => stimme.id === state.stimmeId) ?? data.gesamt.stimmen[0];
      if (!definition) return;
      state.stimmeId = definition.id;
      auswahl.replaceChildren(...data.gesamt.stimmen.map(stimme => h('button', {
        class: 'segment', type: 'button', 'aria-pressed': String(stimme.id === definition.id),
        onclick: () => { state.stimmeId = stimme.id; view.update(state.data); },
      }, stimme.name)));
      auswahl.hidden = data.gesamt.stimmen.length < 2;
      balken.replaceChildren(...data.gesamt.stimmen.map(stimme =>
        panel(`${stimme.name} – vorläufiges Ergebnis aller Wahllokale`, stimmZaehler(stimme), anteilListe(stimme))));
      if (spaltenFuer !== definition.id) {
        tabelle.setGridOption('columnDefs', spalten(definition));
        spaltenFuer = definition.id;
      }
      tabelle.setGridOption('rowData', data.wahllokale);
      tabelle.setGridOption('pinnedBottomRowData', [{ gesamtZeile: true, nummer: 'Σ', name: 'Alle Wahllokale', zettel: data.gesamt.zettel, stimmen: data.gesamt.stimmen }]);
    },
    destroy: () => tabelle.destroy(),
  };
  return view;
};

/* --- Prueffaelle -------------------------------------------------------- */

const prueffaelle = ({ inhalt, werkzeuge, showFehler, zeigeBeleg }) => {
  const element = h('div', { class: 'tabelle' });
  const info = h('p', { class: 'zaehler' }, 'Prüffälle werden geladen …');
  let aktiv = true;
  let namen = new Map();
  const tabelle = createTabelle(element, { getRowId: ({ data }) => data.id, rowClass: 'klickbar', onRowClicked: ({ data }) => zeigeBeleg(data), loading: true });
  werkzeuge.append(suchfeld(tabelle, 'Wahllokal, Wertung … suchen'));
  inhalt.append(panel(null,
    h('p', { class: 'hinweis' }, 'Zettel mit leerer, mehrfacher oder unklarer Stimme. Darüber entscheidet der Wahlvorstand am Papierzettel; eine Entscheidung lässt sich hier noch nicht erfassen.'),
    info, element));
  return {
    titel: 'Prüffälle',
    update: async data => {
      namen = new Map(data.wahllokale.map(lokal => [lokal.nummer, lokal.name]));
      if (!tabelle.getColumnDefs()?.length) tabelle.setGridOption('columnDefs', [
        { field: 'eingang', headerName: 'Eingang', minWidth: 170, sort: 'desc', valueFormatter: ({ value }) => formatZeitpunkt(value) },
        { field: 'wahllokal', headerName: 'Nr.', width: 100, comparator: nummerVergleich },
        { colId: 'name', headerName: 'Wahllokal', minWidth: 180, valueGetter: ({ data }) => namen.get(data.wahllokal) ?? '' },
        { field: 'stapel', headerName: 'Stapel', width: 120, valueFormatter: kurzeKennung },
        ...wertungSpalten(data.gesamt.stimmen),
        { colId: 'beleg', headerName: '', width: 110, sortable: false, filter: false, cellRenderer: zellenKnopf('Beleg', zeigeBeleg) },
      ]);
      try {
        const { prueffaelle: rows } = await api('prueffaelle');
        if (!aktiv) return;
        tabelle.setGridOption('rowData', rows);
        tabelle.setGridOption('loading', false);
        info.textContent = `${formatZahl(rows.length)} Prüffälle in ${new Set(rows.map(row => row.wahllokal)).size} Wahllokalen`;
      } catch (error) { showFehler(error); }
    },
    destroy: () => { aktiv = false; tabelle.destroy(); },
  };
};

/* --- Eingaenge ---------------------------------------------------------- */

const eingaenge = ({ inhalt, werkzeuge }) => {
  const element = h('div', { class: 'tabelle' });
  const info = h('p', { class: 'zaehler' });
  const tabelle = createTabelle(element, {
    getRowId: ({ data }) => data.id, rowClass: 'klickbar', onRowClicked: ({ data }) => zuWahllokal(data.wahllokal),
    columnDefs: [
      { field: 'eingang', headerName: 'Eingang', minWidth: 180, sort: 'desc', valueFormatter: ({ value }) => formatZeitpunkt(value) },
      { colId: 'seit', headerName: 'Alter', minWidth: 140, filter: false, valueGetter: ({ data }) => data.eingang, valueFormatter: ({ value }) => formatSeit(value) },
      { field: 'wahllokal', headerName: 'Nr.', width: 100, comparator: nummerVergleich },
      { field: 'wahllokalName', headerName: 'Wahllokal', flex: 1, minWidth: 180 },
      { field: 'id', headerName: 'Stapel', width: 120, valueFormatter: kurzeKennung },
      { field: 'zettel', headerName: 'Zettel / Soll', width: 130, valueFormatter: ({ data }) => `${data.zettel} / ${data.soll}` },
      zahlSpalte('prueffaelle', 'Prüffälle'),
      { field: 'erfasstVon', headerName: 'Konto', minWidth: 140, valueFormatter: ({ value }) => value ?? '–' },
    ],
  });
  werkzeuge.append(suchfeld(tabelle, 'Wahllokal, Konto … suchen'));
  inhalt.append(panel(null, info, element));
  return {
    titel: 'Eingänge',
    update: data => {
      const rows = getEingaenge(data.wahllokale);
      info.textContent = `${formatZahl(rows.length)} Stapel aus ${new Set(rows.map(row => row.wahllokal)).size} Wahllokalen, neueste zuerst.`;
      tabelle.setGridOption('rowData', rows);
      tabelle.refreshCells({ columns: ['seit'], force: true });
    },
    destroy: () => tabelle.destroy(),
  };
};

/* --- Verwaltung --------------------------------------------------------- */

const meldung = () => h('p', { class: 'status', role: 'status', hidden: true });
const zeige = (element, text, fehler = false) => {
  element.textContent = text;
  element.classList.toggle('fehler', fehler);
  element.hidden = false;
};

const verwaltung = ({ inhalt, state, refresh }) => {
  const registrierMeldung = meldung();
  const form = h('form', {
    class: 'formular',
    onsubmit: async event => {
      event.preventDefault();
      const values = new FormData(form);
      form.querySelector('button').disabled = true;
      try {
        await api('wahllokale', { nummer: values.get('nummer'), name: values.get('name') });
        zeige(registrierMeldung, `Wahllokal ${values.get('nummer')} registriert.`);
        form.reset();
        await refresh();
      } catch (error) { zeige(registrierMeldung, error.message, true); }
      finally { form.querySelector('button').disabled = false; }
    },
  },
  h('label', {}, 'Wahllokalnummer', h('input', { name: 'nummer', maxLength: 160, required: true })),
  h('label', {}, 'Name', h('input', { name: 'name', maxLength: 160, required: true })),
  h('button', { class: 'knopf', type: 'submit' }, 'Wahllokal registrieren'));

  // Import: erst pruefen und zeigen, was neu ist, dann einzeln registrieren.
  let neu = [];
  const vorschau = h('div', { class: 'vorschau' });
  const importMeldung = meldung();
  const textfeld = h('textarea', { rows: 8, spellcheck: false, placeholder: 'Nummer;Name\n001;Rathaus\n002;Grundschule am Park', oninput: () => pruefen() });
  const datei = h('input', { type: 'file', accept: '.csv,.txt,text/csv', onchange: async () => { textfeld.value = (await datei.files[0]?.text()) ?? ''; pruefen(); } });
  const importKnopf = h('button', { class: 'knopf', type: 'button', disabled: true, onclick: () => importieren() }, 'Importieren');
  const pruefen = () => {
    const { wahllokale: gelesen, fehler } = parseWahllokalCsv(textfeld.value);
    const vorhanden = new Set(state.data?.wahllokale.map(lokal => lokal.nummer));
    neu = gelesen.filter(lokal => !vorhanden.has(lokal.nummer));
    vorschau.replaceChildren(h('div', {},
      textfeld.value.trim() && h('p', {}, `${neu.length} neue Wahllokale, ${gelesen.length - neu.length} bereits registriert, ${fehler.length} fehlerhafte Zeilen.`),
      fehler.length > 0 && h('ul', { class: 'fehlerliste' }, fehler.map(text => h('li', {}, text)))));
    importKnopf.disabled = !neu.length;
  };
  const importieren = async () => {
    importKnopf.disabled = true;
    const probleme = [];
    for (const [index, lokal] of neu.entries()) {
      zeige(importMeldung, `Registriere ${index + 1} von ${neu.length} …`);
      try { await api('wahllokale', lokal); }
      catch (error) { probleme.push(`${lokal.nummer}: ${error.message}`); }
    }
    zeige(importMeldung, `${neu.length - probleme.length} Wahllokale registriert.${probleme.length ? ` Fehler: ${probleme.join(' · ')}` : ''}`, probleme.length > 0);
    await refresh();
    pruefen();
  };

  inhalt.append(h('div', { class: 'raster' },
    panel('Wahllokal registrieren', form, registrierMeldung),
    panel('Wahllokale importieren',
      h('p', { class: 'hinweis' }, 'CSV mit den Spalten Nummer und Name – getrennt durch Semikolon, Komma oder Tab. Eine Kopfzeile wird erkannt, bereits registrierte Wahllokale werden übersprungen.'),
      h('label', {}, 'Datei', datei), h('label', {}, 'oder Inhalt einfügen', textfeld), vorschau, importKnopf, importMeldung),
    panel('Konten',
      h('p', {}, 'Konten für Admins und Wahlvorstände legt vorerst das Skript server/create-user.php an. Ein Wahlvorstand ist an genau ein Wahllokal gebunden und arbeitet nur am Erfassungsplatz.'))));
  return { titel: 'Verwaltung', update: () => pruefen() };
};

export const ansichten = { dashboard, wahllokale, wahllokal, ergebnisse, prueffaelle, eingaenge, verwaltung };
