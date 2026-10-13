/**
 * Oberflaeche des Wahlassistenten: Stimmzettel aufnehmen, Wertung anzeigen.
 * Die Zettelart steht in `configuration.js` fest; die Auswertung selbst steckt in src/.
 */
import { loadKalibrierung } from './src/kalibrierung.js';
import { toImageData } from './src/browserImage.js';
import { stimmRows, isUnambiguous, COLORS, drawFelder } from './src/wertungAnzeige.js';
import { setLogging } from './src/log.js';
import { isPdf, pdfPageAsImage } from './src/pdf.js';
import { KALIBRIERUNG } from './configuration.js';

// Der Ablauf ist in der Browser-Konsole mitzulesen (Praefix "[Wahl]").
setLogging(true);

const $ = id => document.querySelector(`#${id}`);
const state = { typ: undefined };

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
  $('wertungBereich').hidden = true;
  const field = $('wertung');
  field.hidden = true;
  field.innerHTML = '';
  delete field.dataset.eindeutig;
  $('aufnahmeBereich').hidden = true;
};

/** Aufnahmen kommen als Bild von der Kamera, koennen aber auch ein PDF-Scan sein. */
const toImage = async file => (isPdf(file) ? (await pdfPageAsImage(file)).imageData : toImageData(file));

const capture = async file => {
  const status = $('erfassenStatus');
  $('erfassenKnopf').disabled = true;
  status.hidden = true;
  delete status.dataset.art;
  let imageData;
  try {
    imageData = await toImage(file);
    const result = await state.typ.recognize(imageData);
    showWertung(result);
    showAufnahme(imageData, result);
    $('erfassenKnopfText').textContent = 'Nächsten Stimmzettel aufnehmen';
  } catch (error) {
    // Auch ohne Wertung hilft das Bild zu sehen, was an der Aufnahme nicht stimmt.
    if (imageData) showAufnahme(imageData);
    showError(status, error);
  } finally {
    $('erfassenKnopf').disabled = false;
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

/* --- Start -------------------------------------------------------------- */

// Ohne brauchbare Kalibrierung gibt es nichts zu erkennen - dann bleibt der Knopf gesperrt.
try {
  state.typ = loadKalibrierung(await (await fetch(KALIBRIERUNG)).text());
  const wahl = $('wahl');
  wahl.textContent = state.typ.name;
  wahl.hidden = false;
} catch (error) {
  $('erfassenKnopf').disabled = true;
  showError($('erfassenStatus'), error);
}
