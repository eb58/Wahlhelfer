/**
 * Erfassungsplatz: Stimmzettel stapelweise aufnehmen, Wertung anzeigen, Fortschritt des Wahllokals.
 * Die Zettelart steht in `configuration.js` fest; die Auswertung selbst steckt in erkennung/.
 */
import { loadKalibrierung } from './erkennung/kalibrierung.js';
import { toBeleg, toImageData } from './browserImage.js';
import { stimmRows, isUnambiguous, COLORS, drawFelder } from './wertungAnzeige.js';
import { KALIBRIERUNG } from '../../configuration.js';
import { api, describeUser, putBild, setupAnmeldung, sha256 } from '../api/serverApi.js';
import { appUrl } from '../api/appUrl.js';
import { createStapel, addZettel, getStapelKonflikt, isStapelIntakt } from './stapel.js';
import { loadStapel, saveStapel, toUpload } from './stapelStorage.js';
import { getWahlDefinition } from './wahl.js';
import { getWahllokalStatus } from '../api/wahllokalAnzeige.js';
import { findWahllokal, getFortschritt } from './wahllokal.js';

const $ = id => document.querySelector(`#${id}`);
// Das Wahllokal steht im Link (?wahllokal=12518); jedes Wahllokal bekommt seinen eigenen Link.
const wahllokalNummer = new URL(globalThis.location.href).searchParams.get('wahllokal');
// fremderStapel: gespeicherter Stapel, der nicht zu Wahl oder Wahllokal passt - er laesst sich nur verwerfen.
const state = { typ: undefined, stapel: undefined, fremderStapel: undefined, pending: undefined, busy: false, wahlHash: undefined, lokal: undefined };
if (wahllokalNummer) $('kopfTitel').textContent = `Wahllokal ${wahllokalNummer}`;

/** Je Phase nur das Noetige: vor dem Stapel das Formular, waehrend des Stapels Fortschritt und Aufnahme. */
const renderStapel = () => {
  const stapel = state.stapel;
  const complete = stapel && stapel.zettel.length === stapel.soll;
  $('stapelForm').hidden = !!stapel || !state.lokal || state.lokal.erwartet === null;
  $('meldungBereich').hidden = !state.lokal || state.lokal.erwartet !== null;
  $('stapelLeiste').hidden = !stapel && !state.fremderStapel;
  $('ansichtErfassen').hidden = !stapel || (complete && !state.pending);
  if (stapel) {
    $('stapelFortschritt').textContent = `${stapel.zettel.length} / ${stapel.soll}`;
    Object.assign($('stapelBalken'), { max: stapel.soll, value: stapel.zettel.length });
  }
  $('stapelSoll').disabled = !!stapel || state.busy;
  $('stapelStart').disabled = !!stapel || !state.wahlHash || state.busy || state.lokal?.erwartet == null;
  $('erfassenKnopf').disabled = !stapel || complete || state.busy || !!state.pending || !state.typ;
  $('dateiKnopf').disabled = $('erfassenKnopf').disabled;
  // Wartet eine Wertung auf Bestaetigung, steht sie direkt unter dem Fortschritt.
  $('aufnahmeAktionen').hidden = !!state.pending;
  $('stapelKontrolle').hidden = !complete;
  $('stapelSenden').hidden = !complete;
  $('stapelSenden').disabled = state.busy || !$('eingangLeer').checked;
  // Nur ein eindeutig erkannter Zettel kommt auf den Stapel; alle anderen legt der Wahlhelfer beiseite.
  $('zettelBestaetigen').hidden = !state.pending || !isUnambiguous(state.pending.result);
  $('zettelVerwerfen').hidden = !state.pending;
  $('zettelBestaetigen').disabled = state.busy;
  $('zettelVerwerfen').disabled = state.busy;
  $('stapelVerwerfen').hidden = !(state.fremderStapel || stapel?.zettel.length === 0) || state.busy || !!state.pending;
  $('stapelVerwerfen').textContent = state.fremderStapel ? 'Nicht passenden Stapel verwerfen' : 'Leeren Stapel verwerfen';
};

const node = (tag, content) => Object.assign(document.createElement(tag), { textContent: content });

/** Monitor: Fortschritt des Wahllokals, wie ihn der Server ueber alle Stapel und Erfassungsplaetze kennt. */
const renderMonitor = () => {
  const lokal = state.lokal;
  $('monitor').hidden = !lokal;
  if (!lokal) return;
  const progress = Object.assign(node('progress'), { max: lokal.erwartet, value: Math.min(lokal.zettel, lokal.erwartet) });
  progress.setAttribute('aria-label', `${lokal.zettel} von ${lokal.erwartet} Stimmzetteln erfasst`);
  const kopf = node('p');
  kopf.className = 'monitor__kopf';
  kopf.append(node('strong', 'Wahllokal gesamt'), node('span', getWahllokalStatus(lokal)));
  $('monitor').replaceChildren(kopf, progress, node('p', getFortschritt(lokal)));
  progress.hidden = lokal.erwartet === null;
};

const loadWahllokale = async () => {
  const data = await api('wahllokale');
  state.lokal = findWahllokal(data.wahllokale, wahllokalNummer);
  $('wahl').textContent = [state.lokal.name, state.typ?.name].filter(Boolean).join(' · ');
  renderMonitor();
  renderStapel();
  return data;
};

const storeStapel = async stapel => {
  // Erst dauerhaft schreiben: ein Speicherfehler darf den Fortschritt nicht erhoehen.
  await saveStapel(stapel, state.stapel);
  state.stapel = stapel;
};

const showError = (field, error) => {
  field.textContent = error.message;
  field.dataset.art = 'fehler';
  field.hidden = false;
};

const FARBE = { gueltig: COLORS.angekreuzt, leer: COLORS.leer };

const showWertung = result => {
  $('wertungBereich').hidden = false;
  const field = $('wertung');
  const eindeutig = isUnambiguous(result);
  field.dataset.eindeutig = String(eindeutig);
  field.innerHTML = stimmRows(result).map(row => `
    <span class="wertung-zeile" style="--farbe: ${FARBE[row.status] ?? COLORS.unklar}">
      <strong>${row.title}</strong>
      <span>${row.treffer.length ? row.treffer.join(', ') : row.text}</span>
      ${row.treffer.length && row.status !== 'gueltig' ? `<em>${row.text}</em>` : ''}
    </span>`).join('')
    + (eindeutig ? '' : '<span class="wertung-hinweis">Nicht eindeutig – Zettel beiseitelegen, der Wahlvorstand entscheidet.</span>');
  field.hidden = false;
};

/**
 * Zeigt die Aufnahme; nach erfolgreicher Erkennung mit den Ankreuzfeldern als farbigen Ringen.
 * Nur am PC - auf dem Smartphone liegt der Zettel ohnehin vor einem.
 */
const mitVorschau = !globalThis.matchMedia?.('(pointer: coarse)').matches;
const showAufnahme = (imageData, result) => {
  if (!mitVorschau) return;
  const canvas = $('aufnahme');
  canvas.width = imageData.width;
  canvas.height = imageData.height;
  const context = canvas.getContext('2d');
  context.putImageData(imageData, 0, 0);
  if (result) drawFelder(context, result, { lineWidth: Math.max(2, Math.round(imageData.width / 400)) });
  $('aufnahmeBereich').hidden = false;
};

/** Loescht die vorherige Wertung, sobald eine neue Aufnahme angestossen wird - sonst
 *  bliebe bei einem abgebrochenen Kamerabild das alte Ergebnis fehlerhaft stehen. */
const clearWertung = () => {
  state.pending = undefined;
  $('zettelBestaetigen').hidden = true;
  $('zettelVerwerfen').hidden = true;
  $('wertungBereich').hidden = true;
  const field = $('wertung');
  field.hidden = true;
  field.innerHTML = '';
  delete field.dataset.eindeutig;
  $('aufnahmeBereich').hidden = true;
};

const capture = async file => {
  if (!state.stapel || state.busy || state.pending || state.stapel.zettel.length >= state.stapel.soll) return;
  state.busy = true;
  renderStapel();
  const status = $('erfassenStatus');
  $('erfassenKnopf').disabled = true;
  status.hidden = true;
  delete status.dataset.art;
  let imageData;
  try {
    if (!['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(file.type))
      throw new Error('Aufnahme muss ein PNG-, JPEG-, WebP- oder GIF-Bild sein.');
    // Erkannt wird der Beleg, nicht die Kameraaufnahme: so reproduziert der gespeicherte Beleg die Wertung.
    let bild = await toBeleg(file);
    imageData = await toImageData(bild);
    let result = await state.typ.recognize(imageData);
    // Quer gespeichert: den Beleg aus der Aufnahme aufrecht neu erzeugen und genau ihn erneut erkennen.
    if (result.rotation) {
      bild = await toBeleg(file, result.rotation);
      imageData = await toImageData(bild);
      result = await state.typ.recognize(imageData);
    }
    state.pending = { result, bild };
    showWertung(result);
    showAufnahme(imageData, result);
    $('erfassenKnopfText').textContent = 'Nächsten Stimmzettel aufnehmen';
  } catch (error) {
    // Auch ohne Wertung hilft das Bild zu sehen, was an der Aufnahme nicht stimmt.
    if (imageData) showAufnahme(imageData);
    showError(status, error);
  } finally {
    state.busy = false;
    renderStapel();
  }
};

const openInput = input => {
  input.value = '';
  input.click();
};

const handleFileSelection = event => {
  const [file] = event.target.files;
  if (file) capture(file);
};

// `capture="environment"` uebergibt die Bedienung an die rueckseitige Kamera.
$('erfassenKnopf').addEventListener('click', () => { clearWertung(); openInput($('erfassenEingabe')); });
$('dateiKnopf').addEventListener('click', () => { clearWertung(); openInput($('dateiEingabe')); });
$('erfassenEingabe').addEventListener('change', handleFileSelection);
$('dateiEingabe').addEventListener('change', handleFileSelection);

$('meldungForm').addEventListener('submit', async event => {
  event.preventDefault();
  if (!state.lokal || state.busy) return;
  $('meldungSenden').disabled = true;
  try {
    await api(`wahllokale/${encodeURIComponent(state.lokal.nummer)}/stimmzettelzahl`, {
      erwartet: Number($('stimmzettelzahl').value),
    }, 'PUT');
    await loadWahllokale();
  } catch (error) { showError($('meldungStatus'), error); }
  finally { $('meldungSenden').disabled = false; }
});

$('stapelVerwerfen').addEventListener('click', async () => {
  const fremd = state.fremderStapel;
  if (state.busy || state.pending || !(fremd || state.stapel?.zettel.length === 0)) return;
  const anzahl = Array.isArray(fremd?.zettel) ? fremd.zettel.length : 0;
  if (fremd && !globalThis.confirm(`Stapel mit ${anzahl} erfassten Zetteln endgültig verwerfen? Sie sind nicht beim Server und müssen neu erfasst werden.`)) return;
  try {
    await saveStapel(undefined, fremd ?? state.stapel);
    // Danach wie frisch geladen: Wahl und Wahllokal werden erneut geprueft.
    if (fremd) return globalThis.location.reload();
    state.stapel = undefined;
    renderStapel();
  } catch (error) { showError($('stapelStatus'), error); }
});
$('stapelForm').addEventListener('submit', async event => {
  event.preventDefault();
  if (state.stapel || state.busy || state.lokal?.erwartet == null) return;
  state.busy = true;
  renderStapel();
  try {
    await storeStapel(createStapel(state.lokal.nummer, Number($('stapelSoll').value), state.wahlHash));
    $('eingangLeer').checked = false;
    $('stapelStatus').hidden = true;
    renderStapel();
  } catch (error) { showError($('stapelStatus'), error); }
  finally { state.busy = false; renderStapel(); }
});
$('zettelBestaetigen').addEventListener('click', async () => {
  if (!state.pending || state.busy) return;
  state.busy = true;
  renderStapel();
  try {
    await storeStapel(addZettel(state.stapel, state.pending.result, state.pending.bild));
    clearWertung();
    renderStapel();
  } catch (error) { showError($('stapelStatus'), error); }
  finally { state.busy = false; renderStapel(); }
});
$('zettelVerwerfen').addEventListener('click', () => { clearWertung(); renderStapel(); });
$('eingangLeer').addEventListener('change', renderStapel);
$('stapelSenden').addEventListener('click', async () => {
  if (state.busy || !state.stapel || state.stapel.zettel.length !== state.stapel.soll || !$('eingangLeer').checked) return;
  state.busy = true;
  renderStapel();
  try {
    const upload = await toUpload(state.stapel);
    for (const [hash, bild] of upload.bilder) await putBild(hash, bild);
    const response = await api('stapel', upload.stapel);
    await storeStapel(undefined);
    $('stapelStatus').textContent = `Stapel ${response.id.slice(0, 8)} vom Server gespeichert. Noch keine endgültige Zählfreigabe.`;
    delete $('stapelStatus').dataset.art;
    $('stapelStatus').hidden = false;
    $('eingangLeer').checked = false;
    clearWertung();
    await loadWahllokale().catch(() => {});
  } catch (error) { showError($('stapelStatus'), error); }
  finally { state.busy = false; renderStapel(); }
});

/* --- Start -------------------------------------------------------------- */

// Ohne brauchbare Kalibrierung gibt es nichts zu erkennen; der Fehler erscheint nach der Anmeldung.
let kalibrierungsFehler;
try {
  const kalibrierung = await (await fetch(appUrl(KALIBRIERUNG))).json();
  state.typ = loadKalibrierung(kalibrierung);
  const wahl = $('wahl');
  wahl.textContent = state.typ.name;
  wahl.hidden = false;
} catch (error) {
  kalibrierungsFehler = error;
}

// Ohne Anmeldung zeigt die Seite nur das Anmeldeformular und fragt den Server nichts.
const user = await setupAnmeldung();
// Die Kopfzeile zeigt nur den Abmelde-Knopf; wer angemeldet ist, steht in dessen Tooltip.
if (user) $('abmelden').title = `Abmelden (${describeUser(user)})`;
try {
  if (!user) throw new Error('Bitte anmelden.');
  if (kalibrierungsFehler) throw kalibrierungsFehler;
  const stored = await loadStapel();
  const data = await loadWahllokale();
  const definition = getWahlDefinition(JSON.parse(state.typ.toJson()));
  const localHash = await sha256(new TextEncoder().encode(JSON.stringify(definition)));
  if (localHash !== data.wahlHash) throw new Error('Wahlvorschläge im Browser und auf dem Server stimmen nicht überein.');
  // Ein laufender Stapel gehoert zu genau einer Wahl und einem Wahllokal; passt er nicht, bleibt nur Verwerfen.
  const konflikt = stored && getStapelKonflikt(stored, wahllokalNummer, localHash);
  if (isStapelIntakt(stored)) {
    state.stapel = stored;
    $('stapelSoll').value = stored.soll;
  }
  if (konflikt) {
    state.fremderStapel = stored;
    throw new Error(konflikt);
  }
  state.wahlHash = localHash;
  renderMonitor();
  globalThis.setInterval(() => loadWahllokale().catch(() => {}), 15000);
} catch (error) {
  state.typ = undefined;
  state.wahlHash = undefined;
  showError($('stapelStatus'), error);
}
renderStapel();
