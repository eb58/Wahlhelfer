/**
 * Oberflaeche des Wahlassistenten: Stimmzettel aufnehmen, Wertung anzeigen.
 * Die Zettelart steht in `konfiguration.js` fest; die Auswertung selbst steckt in src/.
 */
import { ladeKalibrierung } from './src/kalibrierung.js';
import { toImageData } from './src/browserImage.js';
import { stimmZeilen, summary, istEindeutig, drawFelder, COLORS } from './src/wertungAnzeige.js';
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
};

const showStatus = (field, text) => {
  field.textContent = text;
  delete field.dataset.art;
};

/**
 * Zeichnet die Aufnahme in ein Canvas und legt die erkannten Felder darueber.
 * Lange Zettel laufen in voller Breite und werden gescrollt - deshalb anschliessend
 * zur ersten Markierung springen, sonst sucht der Wahlhelfer sie im Bild.
 */
const showImage = (imageData, ergebnis) => {
  const canvas = $('erfassenBild');
  canvas.width = imageData.width;
  canvas.height = imageData.height;
  const context = canvas.getContext('2d');
  context.putImageData(imageData, 0, 0);
  drawFelder(context, ergebnis, { lineWidth: Math.max(2, imageData.width / 400) });
  canvas.hidden = false;

  const auffaellig = ergebnis.felder.find(feld => feld.status !== 'leer');
  const sicht = canvas.parentElement;
  sicht.scrollTop = auffaellig ? (auffaellig.y / canvas.height) * canvas.offsetHeight - sicht.clientHeight / 2 : 0;
};

const showWertung = ergebnis => {
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
  showStatus(status, 'Stimmzettel wird geprüft…');
  try {
    const imageData = await alsBild(file);
    const ergebnis = state.typ.recognize(imageData);
    $('erfassenPlatzhalter').hidden = true;
    showImage(imageData, ergebnis);
    showWertung(ergebnis);
    $('erfassenKnopfText').textContent = 'Nächsten Stimmzettel aufnehmen';
    showStatus(status, summary(ergebnis));
  } catch (error) {
    showError(status, error);
  } finally {
    $('erfassenKnopf').disabled = false;
  }
};

$('erfassenKnopf').addEventListener('click', () => {
  $('erfassenEingabe').value = '';
  $('erfassenEingabe').click();
});

$('erfassenEingabe').addEventListener('change', event => {
  const [file] = event.target.files;
  if (file) erfasse(file);
});

/* --- Start -------------------------------------------------------------- */

// Ohne brauchbare Kalibrierung gibt es nichts zu erkennen - dann bleibt der Knopf gesperrt.
try {
  state.typ = ladeKalibrierung(await (await fetch(KALIBRIERUNG)).text());
  showStatus($('erfassenStatus'), `${state.typ.name} – Aufnahmen bleiben auf diesem Gerät.`);
} catch (error) {
  $('erfassenKnopf').disabled = true;
  $('erfassenPlatzhalterText').textContent = 'Keine Kalibrierung geladen';
  showError($('erfassenStatus'), error);
}
