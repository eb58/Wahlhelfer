/** Wiederkehrende Elemente der Ansichten. Texte gehen immer als Textknoten ins DOM, nie als HTML. */
import { getWahllokalStatus } from '../api/wahllokalAnzeige.js';
import { formatProzent, formatZahl, getAnteile, getStatusArt } from './auswertung.js';

/** h('a', { href, class, onclick }, ...kinder) - Attribute, Ereignisse und Kinder in einem Aufruf. */
export const h = (tag, props = {}, ...children) => {
  const element = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (value === undefined || value === false || value === null) continue;
    if (key.startsWith('on')) element.addEventListener(key.slice(2), value);
    else if (key === 'class') element.className = value;
    else if (key === 'style') element.style.cssText = value;
    else if (key in element && !key.includes('-')) element[key] = value;
    else element.setAttribute(key, value);
  }
  element.append(...children.flat(Infinity).filter(child => child !== undefined && child !== null && child !== false));
  return element;
};

export const panel = (titel, ...inhalt) => h('section', { class: 'panel' }, titel && h('h2', {}, titel), ...inhalt);

export const metrik = (label, wert, unter, art) =>
  h('article', { class: `metrik${art ? ` metrik--${art}` : ''}` }, h('span', { class: 'metrik__label' }, label),
    h('strong', { class: 'metrik__wert' }, wert), unter && h('span', { class: 'metrik__unter' }, unter));

export const fortschritt = (zettel, erwartet) => h('span', { class: 'fortschritt', role: 'img', 'aria-label': `${zettel} von ${erwartet} Stimmzetteln` },
  h('span', { class: `fortschritt__wert${zettel > erwartet ? ' fortschritt__wert--ueber' : ''}`, style: `width: ${Math.min(1, erwartet ? zettel / erwartet : 0) * 100}%` }));

export const statusBadge = lokal => h('span', { class: `badge badge--${getStatusArt(lokal)}` }, getWahllokalStatus(lokal));

export const stimmZaehler = stimme =>
  h('p', { class: 'zaehler' }, `${formatZahl(stimme.gueltig)} eindeutig · ${formatZahl(stimme.leer)} leer · ${formatZahl(stimme.mehrfach)} mehrfach · ${formatZahl(stimme.zweifelsfall)} unklar`);

/** Waagrechte Balken je Wahlvorschlag; Breite = Anteil an den eindeutig erkannten Stimmen. */
export const anteilListe = (stimme, limit = Infinity) => {
  const rows = getAnteile(stimme);
  return h('div', { class: 'anteile' },
    rows.slice(0, limit).map(row => h('div', { class: 'anteil' },
      h('span', { class: 'anteil__name', title: row.beschriftung }, row.beschriftung),
      h('span', { class: 'anteil__balken' }, h('span', { style: `width: ${row.anteil * 100}%` })),
      h('span', { class: 'anteil__wert' }, formatProzent(row.anteil)),
      h('span', { class: 'anteil__zahl' }, formatZahl(row.anzahl)))),
    rows.length > limit && h('a', { class: 'mehr', href: '#ergebnisse' }, `Alle ${rows.length} Wahlvorschläge`));
};

/** Knopf in einer Tabellenzelle; die Zeile selbst reagiert nicht zusaetzlich auf denselben Klick. */
export const zellenKnopf = (text, action) => ({ data }) => data && h('button', {
  class: 'zellen-knopf', type: 'button', onclick: event => { event.stopPropagation(); action(data); },
}, text);

export const download = (name, text, type) => {
  const url = URL.createObjectURL(new Blob([text], { type }));
  h('a', { href: url, download: name }).click();
  URL.revokeObjectURL(url);
};
