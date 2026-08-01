/**
 * Oberflaeche des Wahlassistenten: Zettel registrieren (Admin) und Zettel erfassen (Wahlhelfer).
 * Die Auswertung selbst steckt in src/ - hier stehen nur Bedienung und Anzeige.
 */
import { registerWahlzettel, beschreibe } from './src/wahlzettelTyp.js';
import { toImageData, scaleToCanvas } from './src/browserImage.js';
import { recommendedScale } from './src/beschriftung.js';
import { loadTyp, storeTyp, forgetTyp } from './src/storage.js';
import { stimmZeilen, summary, istEindeutig, drawFelder, COLORS } from './src/wertungAnzeige.js';
import { setLogging } from './src/log.js';

// Der Ablauf ist in der Browser-Konsole mitzulesen (Praefix "[Wahl]").
setLogging(true);

const $ = id => document.querySelector(`#${id}`);
const state = { typ: undefined };

/**
 * Worker, Core und Sprachdaten kommen aus vendor/tesseract (`npm run vendor`), nicht aus dem Netz.
 * corePath zeigt bewusst auf das Verzeichnis: tesseract.js waehlt darin die zur
 * SIMD-Unterstuetzung des Browsers passende Fassung selbst aus.
 */
const TESSERACT = {
  workerPath: './vendor/tesseract/worker.min.js',
  corePath: './vendor/tesseract/',
  langPath: './vendor/tesseract/',
};

/** OCR liest die vergroesserte Fassung; gemessen wird weiterhin im Originalbild. */
const ocrSource = imageData => ({
  source: scaleToCanvas(imageData, recommendedScale),
  scale: recommendedScale,
  ...TESSERACT,
});

/* --- Reiter ------------------------------------------------------------- */

const views = [
  { button: $('reiterErfassen'), view: $('ansichtErfassen') },
  { button: $('reiterAdmin'), view: $('ansichtAdmin') },
];

const showView = chosen => views.forEach(({ button, view }) => {
  const active = button === chosen;
  button.setAttribute('aria-selected', String(active));
  view.hidden = !active;
});

views.forEach(({ button }) => button.addEventListener('click', () => showView(button)));

/* --- Gemeinsames ------------------------------------------------------- */

/** Zeichnet die Aufnahme in ein Canvas und legt optional die erkannten Felder darueber. */
const showImage = (canvas, imageData, ergebnis) => {
  canvas.width = imageData.width;
  canvas.height = imageData.height;
  const context = canvas.getContext('2d');
  context.putImageData(imageData, 0, 0);
  if (ergebnis) drawFelder(context, ergebnis, { lineWidth: Math.max(2, imageData.width / 400) });
  canvas.hidden = false;
};

const showError = (field, error) => {
  field.textContent = error.message;
  field.dataset.art = 'fehler';
};

const showStatus = (field, text) => {
  field.textContent = text;
  delete field.dataset.art;
};

/** Waehrend der Auswertung darf nicht doppelt ausgeloest werden. */
const whileBusy = async (button, field, text, task) => {
  button.disabled = true;
  showStatus(field, text);
  try {
    await task();
  } catch (error) {
    showError(field, error);
  } finally {
    button.disabled = false;
  }
};

/* --- Admin: Zettel registrieren ---------------------------------------- */

const showTypInfo = typ => {
  const info = $('typInfo');
  if (!typ) {
    info.hidden = true;
    $('exportKnopf').disabled = $('loeschKnopf').disabled = true;
    return;
  }
  const kurz = beschreibe(typ);
  info.innerHTML = `<strong>${kurz.name}</strong><span>${kurz.felder} Ankreuzfelder</span>`
    + kurz.stimmen.map(s => `<span>${s.stimme}: ${s.felder.length} Felder</span>`).join('');
  info.hidden = false;
  $('exportKnopf').disabled = $('loeschKnopf').disabled = false;
};

/**
 * Zeigt am Musterzettel, wo Felder erkannt wurden - so ist die Kalibrierung mit blossem Auge pruefbar.
 * Alle Ringe werden gleich eingefaerbt: hier geht es um die Lage, nicht um Markierungen.
 */
const showKalibrierung = (imageData, typ) => {
  const ergebnis = typ.recognize(imageData);
  showImage($('adminBild'), imageData, { ...ergebnis, felder: ergebnis.felder.map(f => ({ ...f, status: 'unklar' })) });
};

const register = async file => {
  const status = $('adminStatus');
  await whileBusy($('adminKnopf'), status, 'Musterzettel wird eingemessen…', async () => {
    const imageData = await toImageData(file);
    const typ = await registerWahlzettel(imageData, {
      name: $('typName').value.trim() || file.name.replace(/\.[^.]+$/, ''),
      ...($('mitOcr').checked ? { ocr: ocrSource(imageData) } : {}),
    });

    state.typ = typ;
    storeTyp(typ);
    showTypInfo(typ);
    $('adminPlatzhalter').hidden = true;
    showKalibrierung(imageData, typ);
    $('adminKnopfText').textContent = 'Anderen Musterzettel wählen';
    showStatus(status, `${typ.felder.length} Ankreuzfelder erkannt. Der Typ ist gespeichert.`);
    prepareErfassen();
  });
};

$('adminKnopf').addEventListener('click', () => {
  $('adminEingabe').value = '';
  $('adminEingabe').click();
});

$('adminEingabe').addEventListener('change', event => {
  const [file] = event.target.files;
  if (file) register(file);
});

$('exportKnopf').addEventListener('click', () => {
  const blob = new Blob([state.typ.toJson()], { type: 'application/json' });
  const link = Object.assign(document.createElement('a'), {
    href: URL.createObjectURL(blob),
    download: `${state.typ.name.replace(/[^\w-]+/g, '_')}.json`,
  });
  link.click();
  URL.revokeObjectURL(link.href);
});

$('loeschKnopf').addEventListener('click', () => {
  forgetTyp();
  state.typ = undefined;
  showTypInfo(undefined);
  $('adminBild').hidden = true;
  $('adminPlatzhalter').hidden = false;
  showStatus($('adminStatus'), 'Typ verworfen. Für neue Aufnahmen zuerst wieder registrieren.');
  prepareErfassen();
});

/* --- Erfassen: Zettel auswerten ---------------------------------------- */

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

/** Schraeglage ist fuer Wahlhelfer eine Aufnahmehilfe, kein Fehler - deshalb sichtbar machen. */
const alignmentHint = ergebnis =>
  ergebnis.method === 'anker' ? ` (schräg um ${Math.abs(ergebnis.drehung).toFixed(1)}°, über Ankerwörter ausgerichtet)` : '';

const erfasse = async file => {
  const status = $('erfassenStatus');
  await whileBusy($('erfassenKnopf'), status, 'Stimmzettel wird geprüft…', async () => {
    const imageData = await toImageData(file);
    // Mit gelernten Ankern wird eine schraege Aufnahme aufgefangen; OCR laeuft nur dann,
    // wenn die Rahmenlinien versagen - der gerade Zettel bleibt also schnell.
    const ergebnis = state.typ.anchors?.length
      ? await state.typ.recognizeRobust(imageData, { ocr: ocrSource(imageData) })
      : state.typ.recognize(imageData);

    $('erfassenPlatzhalter').hidden = true;
    showImage($('erfassenBild'), imageData, ergebnis);
    showWertung(ergebnis);
    $('erfassenKnopfText').textContent = 'Nächsten Stimmzettel aufnehmen';
    showStatus(status, summary(ergebnis) + alignmentHint(ergebnis));
  });
};

/** Ohne registrierten Zetteltyp gibt es nichts zu erkennen - das muss die Oberflaeche sagen. */
const prepareErfassen = () => {
  const ready = Boolean(state.typ);
  $('erfassenKnopf').disabled = !ready;
  $('erfassenPlatzhalterText').textContent = ready
    ? 'Noch kein Stimmzettel erfasst'
    : 'Zuerst einen Zetteltyp registrieren';
  showStatus($('erfassenStatus'), ready
    ? `Zetteltyp „${state.typ.name}“ – Aufnahmen bleiben auf diesem Gerät.`
    : 'Bitte zuerst unter „Zettel registrieren“ einen Musterzettel einlesen.');
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

state.typ = loadTyp();
showTypInfo(state.typ);
prepareErfassen();
