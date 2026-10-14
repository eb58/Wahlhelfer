import { api, setupAnmeldung } from './src/serverApi.js';
import { showBeleg } from './src/belegAnzeige.js';
import { getWahllokalStatus, selectWahllokale } from './src/wahllokalAnzeige.js';

const $ = id => document.querySelector(`#${id}`);
const wahllokalNummer = new URL(globalThis.location.href).searchParams.get('wahllokal');
const monitor = wahllokalNummer !== null;
const node = (tag, content) => {
  const element = document.createElement(tag);
  if (content !== undefined) element.textContent = content;
  return element;
};
const showError = error => {
  $('status').textContent = error.message;
  $('status').dataset.art = 'fehler';
  $('status').hidden = false;
};
const drawWertung = (container, result) => {
  const metrics = node('div');
  metrics.className = 'kennzahlen';
  metrics.append(node('span', `${result.zettel} Stimmzettel`), node('span', `${result.prueffaelle} Zettel mit Prüfbedarf`));
  container.append(metrics);
  for (const stimme of result.stimmen) {
    container.append(node('h3', stimme.name), node('p', `${stimme.gueltig} eindeutig erkannt · ${stimme.leer} leer · ${stimme.mehrfach} mehrfach · ${stimme.zweifelsfall} unklar`));
    const scroll = node('div');
    scroll.className = 'table-scroll';
    const table = node('table');
    const head = node('thead');
    const header = node('tr');
    header.append(node('th', 'Wahlvorschlag'), node('th', 'Erkannte Stimmen'));
    head.append(header);
    const body = node('tbody');
    for (const vorschlag of stimme.wahlvorschlaege) {
      const row = node('tr');
      row.append(node('td', vorschlag.beschriftung), node('td', vorschlag.anzahl));
      body.append(row);
    }
    table.append(head, body);
    scroll.append(table);
    container.append(scroll);
  }
};
let loading = false;
const refresh = async () => {
  if (loading) return;
  loading = true;
  $('aktualisieren').disabled = true;
  try {
    const data = await api('ergebnisse');
    const wahllokale = selectWahllokale(data.wahllokale, wahllokalNummer);
    const firstRender = !$('wahllokale').childElementCount;
    const opened = new Set(Array.from(document.querySelectorAll('#wahllokale details[open][data-key]'), element => element.dataset.key));
    $('bezirkListe').hidden = monitor;
    $('bezirkGesamt').hidden = monitor;
    $('registrierung').hidden = monitor || user.role !== 'admin';
    $('bezirkLink').hidden = !monitor;
    $('monitor').hidden = !monitor;
    if (monitor) {
      const lokal = wahllokale[0];
      $('titel').textContent = `Wahllokal ${lokal.nummer}`;
      document.title = `Wahllokal ${lokal.nummer} – Wahl-Control-Center`;
      $('monitor').replaceChildren(node('h2', lokal.name), node('p', getWahllokalStatus(lokal)));
      const progress = node('progress');
      progress.max = lokal.erwartet;
      progress.value = Math.min(lokal.zettel, lokal.erwartet);
      progress.setAttribute('aria-label', `${lokal.zettel} von ${lokal.erwartet} Stimmzetteln erfasst`);
      $('monitor').append(node('p', `${lokal.zettel} von ${lokal.erwartet} Stimmzetteln · ${lokal.stapel.length} Stapel · ${lokal.prueffaelle} Zettel mit Prüfbedarf`), progress);
      if (lokal.stapel.length) $('monitor').append(node('p', `Letzter Stapel: ${new Date(lokal.stapel[0].eingang).toLocaleString('de-DE')}`));
      $('monitor').append(node('p', 'Aktualisierung alle 15 Sekunden.'));
    }
    $('wahl').textContent = data.wahl;
    $('gesamt').replaceChildren(node('h2', 'Gesamtergebnis'));
    drawWertung($('gesamt'), data.gesamt);
    $('wahllokale').replaceChildren();
    $('wahllokalStand').textContent = `${data.wahllokale.length} ${data.wahllokale.length === 1 ? 'registriertes Wahllokal' : 'registrierte Wahllokale'} · ${data.wahllokale.filter(lokal => lokal.zettel > 0).length} mit eingegangenen Stimmzetteln`;
    $('wahllokalListe').replaceChildren();
    const table = node('table');
    const head = node('thead');
    const header = node('tr');
    for (const title of ['Wahllokal', 'Erfasst / erwartet', 'Stapel', 'Prüffälle', 'Stand', 'Ergebnisse']) header.append(node('th', title));
    head.append(header);
    const body = node('tbody');
    table.append(head, body);
    $('wahllokalListe').append(table);
    if (!data.wahllokale.length) $('wahllokale').append(node('p', 'Noch keine Wahllokale registriert.'));
    for (const lokal of wahllokale) {
      const card = node('details');
      card.className = 'karte panel';
      card.dataset.key = `lokal-${lokal.nummer}`;
      card.open = (monitor && firstRender) || opened.has(card.dataset.key);
      card.append(node('summary', `${lokal.nummer} · ${lokal.name}`));
      const row = node('tr');
      const button = node('button', 'Ansehen');
      button.className = 'table-knopf';
      button.type = 'button';
      button.setAttribute('aria-label', `Ergebnisse Wahllokal ${lokal.nummer} ansehen`);
      button.addEventListener('click', () => { card.open = true; card.scrollIntoView({ block: 'start' }); });
      const action = node('td');
      action.append(button);
      row.append(node('td', `${lokal.nummer} · ${lokal.name}`), node('td', `${lokal.zettel} / ${lokal.erwartet}`),
        node('td', lokal.stapel.length), node('td', lokal.prueffaelle), node('td', getWahllokalStatus(lokal)), action);
      const link = node('a', 'Wahllokalansicht');
      link.href = `ergebnisse.html?wahllokal=${encodeURIComponent(lokal.nummer)}`;
      action.append(node('br'), link);
      body.append(row);
      const differenz = lokal.erwartet - lokal.zettel;
      card.append(node('p', `${lokal.stapel.length} Stapel · ${lokal.zettel} von ${lokal.erwartet} Zetteln · ${differenz < 0 ? `${-differenz} über Soll – prüfen` : differenz ? `${differenz} fehlen` : 'Sollzahl erreicht'}`));
      const details = node('details');
      details.dataset.key = `stimmen-${lokal.nummer}`;
      details.open = (monitor && firstRender) || opened.has(details.dataset.key);
      details.append(node('summary', 'Stimmen im Wahllokal'));
      drawWertung(details, lokal);
      card.append(details);
      for (const stapel of lokal.stapel) {
        const item = node('details');
        item.dataset.key = `stapel-${stapel.id}`;
        item.open = opened.has(item.dataset.key);
        item.append(node('summary', `Stapel ${stapel.id.slice(0, 8)} · ${stapel.zettel}/${stapel.soll} Zettel · ${stapel.prueffaelle} Prüffälle · ${new Date(stapel.eingang).toLocaleString('de-DE')}`));
        drawWertung(item, stapel);
        const belege = node('details');
        belege.dataset.key = `belege-${stapel.id}`;
        belege.open = opened.has(belege.dataset.key);
        belege.append(node('summary', `${stapel.belege.length} Stimmzettelbelege`));
        belege.addEventListener('toggle', () => {
          if (!belege.open || belege.childElementCount > 1) return;
          for (const zettel of stapel.belege) {
            const button = node('button', `Beleg ${zettel.id} ansehen`);
            button.className = 'datei-knopf';
            button.type = 'button';
            button.addEventListener('click', async () => {
              button.disabled = true;
              try { await showBeleg(zettel, data.gesamt.stimmen); }
              catch (error) { showError(error); }
              finally { button.disabled = false; }
            });
            belege.append(button);
          }
        });
        item.append(belege);
        card.append(item);
      }
      $('wahllokale').append(card);
    }
    $('status').textContent = `Stand: ${new Date().toLocaleTimeString('de-DE')}`;
    delete $('status').dataset.art;
    $('status').hidden = false;
  } catch (error) { showError(error); }
  finally { loading = false; $('aktualisieren').disabled = false; }
};
const user = await setupAnmeldung();
$('aktualisieren').addEventListener('click', refresh);
$('wahllokalForm').addEventListener('submit', async event => {
  event.preventDefault();
  const button = event.target.querySelector('button');
  button.disabled = true;
  try {
    const form = new FormData(event.target);
    await api('wahllokale', { nummer: form.get('nummer'), name: form.get('name'), erwartet: Number(form.get('erwartet')) });
    event.target.reset();
    await refresh();
  } catch (error) { showError(error); }
  finally { button.disabled = false; }
});
if (user) {
  await refresh();
  globalThis.setInterval(() => { if (!document.querySelector('dialog[open]')) refresh(); }, 15000);
}
