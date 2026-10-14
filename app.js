/**
 * Oberflaeche des Wahlassistenten: Stimmzettel aufnehmen, Wertung anzeigen.
 * Die Zettelart steht in `configuration.js` fest; die Auswertung selbst steckt in src/.
 */
import { loadKalibrierung } from './src/kalibrierung.js';
import { toBeleg, toImageData } from './src/browserImage.js';
import { stimmRows, isUnambiguous, COLORS, drawFelder } from './src/wertungAnzeige.js';
import { setLogging } from './src/log.js';
import { isPdf, pdfPageAsImage } from './src/pdf.js';
import { KALIBRIERUNG } from './configuration.js';
import { api, putBild, setupAnmeldung, sha256 } from './src/serverApi.js';
import { createStapel, addZettel } from './src/stapel.js';
import { loadStapel, saveStapel, toUpload } from './src/stapelStorage.js';
import { getWahlDefinition } from './src/wahl.js';
import { selectWahllokale } from './src/wahllokalAnzeige.js';

// Der Ablauf ist in der Browser-Konsole mitzulesen (Praefix "[Wahl]").
setLogging(true);

const $ = id => document.querySelector(`#${id}`);
// Wie in ergebnisse.html: ?wahllokal=518 beschraenkt die Erfassung auf dieses Wahllokal.
const wahllokalNummer = new URL(globalThis.location.href).searchParams.get('wahllokal');
const state = { typ: undefined, stapel: undefined, pending: undefined, busy: false, wahlHash: undefined };

const renderStapel = () => {
  const stapel = state.stapel;
  const complete = stapel && stapel.zettel.length === stapel.soll;
  $('stapelFortschritt').textContent = stapel ? `${stapel.zettel.length} von ${stapel.soll} Stimmzetteln erfasst` : 'Noch kein Stapel begonnen.';
  $('wahllokal').disabled = !!stapel || state.busy;
  $('stapelSoll').disabled = !!stapel || state.busy;
  $('stapelStart').disabled = !!stapel || !state.wahlHash || state.busy;
  $('erfassenKnopf').disabled = !stapel || complete || state.busy || !!state.pending || !state.typ;
  $('dateiKnopf').disabled = $('erfassenKnopf').disabled;
  $('stapelKontrolle').hidden = !complete;
  $('stapelSenden').hidden = !complete;
  $('stapelSenden').disabled = state.busy || !$('eingangLeer').checked;
  $('zettelBestaetigen').hidden = !state.pending;
  $('zettelVerwerfen').hidden = !state.pending;
  $('zettelBestaetigen').disabled = state.busy;
  $('zettelVerwerfen').disabled = state.busy;
  $('stapelVerwerfen').hidden = !stapel || stapel.zettel.length > 0 || state.busy || !!state.pending;
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

const showWertung = result => {
  $('wertungBereich').hidden = false;
  const field = $('wertung');
  field.dataset.eindeutig = String(isUnambiguous(result));
  field.innerHTML = stimmRows(result).map(row => `
    <span class="wertung-zeile" style="--farbe: ${COLORS[row.status === 'gueltig' ? 'angekreuzt' : 'unklar']}">
      <strong>${row.title}</strong>
      <span>${row.treffer.length ? row.treffer.join(', ') : row.text}</span>
      ${row.treffer.length && row.status !== 'gueltig' ? `<em>${row.text}</em>` : ''}
    </span>`).join('');
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

/** Aufnahmen kommen als Bild von der Kamera, koennen aber auch ein PDF-Scan sein (erste Seite). */
const toBelegBild = async file => toBeleg(isPdf(file) ? (await pdfPageAsImage(file)).imageData : file);

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
    if (!['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'application/pdf'].includes(file.type))
      throw new Error('Aufnahme muss ein PNG-, JPEG-, WebP-, GIF-Bild oder PDF sein.');
    // Erkannt wird der Beleg, nicht die Kameraaufnahme: so reproduziert der gespeicherte Beleg die Wertung.
    const bild = await toBelegBild(file);
    imageData = await toImageData(bild);
    const result = await state.typ.recognize(imageData);
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

$('stapelVerwerfen').addEventListener('click', async () => {
  if (!state.stapel || state.stapel.zettel.length || state.busy || state.pending) return;
  try { await storeStapel(undefined); renderStapel(); }
  catch (error) { showError($('stapelStatus'), error); }
});
$('stapelForm').addEventListener('submit', async event => {
  event.preventDefault();
  if (state.stapel || state.busy) return;
  state.busy = true;
  renderStapel();
  try {
    await storeStapel(createStapel($('wahllokal').value, Number($('stapelSoll').value), state.wahlHash));
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
  } catch (error) { showError($('stapelStatus'), error); }
  finally { state.busy = false; renderStapel(); }
});

/* --- Start -------------------------------------------------------------- */

// Ohne brauchbare Kalibrierung gibt es nichts zu erkennen - dann bleibt der Knopf gesperrt.
try {
  const kalibrierung = await (await fetch(KALIBRIERUNG)).json();
  state.typ = loadKalibrierung(kalibrierung);
  const wahl = $('wahl');
  wahl.textContent = state.typ.name;
  wahl.hidden = false;
} catch (error) {
  $('erfassenKnopf').disabled = true;
  showError($('erfassenStatus'), error);
}

// Ohne Anmeldung zeigt die Seite nur das Anmeldeformular und fragt den Server nichts.
const user = await setupAnmeldung();
try {
  if (!user) throw new Error('Bitte anmelden.');
  const stored = await loadStapel();
  if (stored) {
    const stapel = stored;
    if (!stapel.wahlHash || !Array.isArray(stapel.zettel) || !Number.isInteger(stapel.soll) || stapel.zettel.length > stapel.soll)
      throw new Error('Gespeicherter Stapel passt nicht zur aktuellen Wahl. Daten vor einem Wechsel sichern.');
    state.stapel = stapel;
    $('stapelSoll').value = stapel.soll;
  }
  const data = await api('wahllokale');
  const definition = getWahlDefinition(JSON.parse(state.typ.toJson()));
  const localHash = await sha256(new TextEncoder().encode(JSON.stringify(definition)));
  if (localHash !== data.wahlHash || (state.stapel && state.stapel.wahlHash !== localHash))
    throw new Error('Wahlvorschläge im Browser, gespeicherten Stapel und Server müssen übereinstimmen.');
  state.wahlHash = localHash;
  if (!data.wahllokale.length) throw new Error('Zuerst ein Wahllokal in der Ergebnisübersicht registrieren.');
  const wahllokale = selectWahllokale(data.wahllokale, wahllokalNummer);
  if (state.stapel && !wahllokale.some(row => row.nummer === state.stapel.wahllokal))
    throw new Error(`Der begonnene Stapel gehört zu Wahllokal ${state.stapel.wahllokal}. Dort abschließen oder die Seite ohne ?wahllokal= öffnen.`);
  // Ein Wahlvorstand sieht nur sein eigenes Wahllokal: dann gibt es nichts auszuwaehlen.
  $('wahllokal').replaceChildren(...(wahllokale.length > 1 ? [new Option('Wahllokal auswählen', '')] : []),
    ...wahllokale.map(row => new Option(`${row.nummer} · ${row.name}`, row.nummer)));
  if (state.stapel) $('wahllokal').value = state.stapel.wahllokal;
} catch (error) {
  state.typ = undefined;
  state.wahlHash = undefined;
  showError($('stapelStatus'), error);
}
renderStapel();
