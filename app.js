/**
 * Oberflaeche des Wahlassistenten: Stimmzettel aufnehmen, Wertung anzeigen.
 * Die Zettelart steht in `konfiguration.js` fest; die Auswertung selbst steckt in src/.
 */
import { ladeKalibrierung } from './src/kalibrierung.js';
import { toImageData } from './src/browserImage.js';
import { stimmZeilen, istEindeutig, COLORS } from './src/wertungAnzeige.js';
import { setLogging } from './src/log.js';
import { istPdf, pdfSeiteAlsBild } from './src/pdf.js';
import { KALIBRIERUNG } from './konfiguration.js';

// Der Ablauf ist in der Browser-Konsole mitzulesen (Praefix "[Wahl]").
setLogging(true);

const $ = id => document.querySelector(`#${id}`);
const state = { typ: undefined };

const showError = (field, error) => {
  field.textContent = error.message;
  field.dataset.art = 'fehler';
  field.hidden = false;
};

const showWertung = ergebnis => {
  $('wertungBereich').hidden = false;
  const field = $('wertung');
  field.dataset.eindeutig = String(istEindeutig(ergebnis));
  field.innerHTML = stimmZeilen(ergebnis).map(zeile => `
    <span class="wertung-zeile" style="--farbe: ${COLORS[zeile.status === 'gueltig' ? 'angekreuzt' : 'unklar']}">
      <strong>${zeile.titel}</strong>
      <span>${zeile.treffer.length ? zeile.treffer.join(', ') : zeile.text}</span>
      ${zeile.treffer.length && zeile.status !== 'gueltig' ? `<em>${zeile.text}</em>` : ''}
    </span>`).join('');
  field.hidden = false;
};

/** Aufnahmen kommen als Bild von der Kamera, koennen aber auch ein PDF-Scan sein. */
const alsBild = async file => (istPdf(file) ? (await pdfSeiteAlsBild(file)).imageData : toImageData(file));

const erfasse = async file => {
  const status = $('erfassenStatus');
  $('erfassenKnopf').disabled = true;
  status.hidden = true;
  delete status.dataset.art;
  try {
    const imageData = await alsBild(file);
    const ergebnis = state.typ.recognize(imageData);
    showWertung(ergebnis);
    $('erfassenKnopfText').textContent = 'Nächsten Stimmzettel aufnehmen';
  } catch (error) {
    showError(status, error);
  } finally {
    $('erfassenKnopf').disabled = false;
  }
};

const oeffneEingabe = eingabe => {
  eingabe.value = '';
  eingabe.click();
};

const uebernehmeDatei = event => {
  const [file] = event.target.files;
  if (file) erfasse(file);
};

// `capture="environment"` uebergibt die Bedienung an die rueckseitige Kamera.
$('erfassenKnopf').addEventListener('click', () => oeffneEingabe($('erfassenEingabe')));
$('dateiKnopf').addEventListener('click', () => oeffneEingabe($('dateiEingabe')));
$('erfassenEingabe').addEventListener('change', uebernehmeDatei);
$('dateiEingabe').addEventListener('change', uebernehmeDatei);

/* --- Start -------------------------------------------------------------- */

// Ohne brauchbare Kalibrierung gibt es nichts zu erkennen - dann bleibt der Knopf gesperrt.
try {
  state.typ = ladeKalibrierung(await (await fetch(KALIBRIERUNG)).text());
  const wahl = $('wahl');
  wahl.textContent = state.typ.name;
  wahl.hidden = false;
} catch (error) {
  $('erfassenKnopf').disabled = true;
  showError($('erfassenStatus'), error);
}
