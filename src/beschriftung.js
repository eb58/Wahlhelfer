/**
 * Beschriftung der Ankreuzfelder per OCR (tesseract.js).
 *
 * OCR liefert die *Bedeutung* der Zeilen (Nummer, Kandidat, Partei), nicht die Markierung.
 * Ob ein Feld angekreuzt ist, entscheidet die Pixelmessung in ankreuzErkennung.js.
 */
import { toRelative } from './frame.js';

/** Kleiner Text ohne Vergroesserung wird schlecht erkannt; dreifach ist ein guter Kompromiss. */
export const recommendedScale = 3;

/**
 * Liest Woerter mit Kaestchen aus einer Aufnahme.
 *
 * `langPath` sollte auf lokal ausgelieferte Sprachdaten zeigen; sonst laedt tesseract.js
 * sie vom jsdelivr-CDN nach. In Node liefert `localOcrOptions()` aus ocrPaths.js den Pfad,
 * im Browser ist es das Vendor-Verzeichnis der Anwendung.
 *
 * @param {object} source alles, was tesseract.js annimmt (Pfad, Buffer, Canvas)
 * @param {{worker?:object, lang?:string, minConfidence?:number, langPath?:string,
 *          cachePath?:string, cacheMethod?:string, workerPath?:string, corePath?:string}} options
 */
export const readWords = async (source, { worker, lang = 'deu', minConfidence = 40, ...paths } = {}) => {
  const ownWorker = async () => {
    // Der Browser-Bundle liefert die Funktionen unter `default`, der Node-Build direkt.
    const modul = await import('tesseract.js');
    const { createWorker, OEM } = modul.createWorker ? modul : (modul.default ?? modul);
    const allowed = ['langPath', 'cachePath', 'cacheMethod', 'workerPath', 'corePath'];
    return createWorker(lang, OEM?.DEFAULT, Object.fromEntries(allowed.filter(k => paths[k] !== undefined).map(k => [k, paths[k]])));
  };
  const used = worker ?? await ownWorker();

  try {
    const { data } = await used.recognize(source, {}, { blocks: true });
    return (data.blocks ?? [])
      .flatMap(b => b.paragraphs.flatMap(p => p.lines.flatMap(l => l.words)))
      // Reine Satzzeichen sind Rauschen aus Tabellenlinien und verfaelschen die Beschriftung.
      .filter(w => w.confidence >= minConfidence && /[\p{L}\p{N}]/u.test(w.text))
      .map(({ text, bbox, confidence }) => ({ text: text.trim(), bbox, confidence }));
  } finally {
    if (!worker) await used.terminate();
  }
};

const center = ({ bbox }, scale) => ({ x: (bbox.x0 + bbox.x1) / 2 / scale, y: (bbox.y0 + bbox.y1) / 2 / scale });

/** Erststimme wird links vom Kreis beschriftet, Zweitstimme rechts davon. */
const matchesSide = (feld, wordX) => (feld.stimme === 'erststimme' ? wordX < feld.x : wordX > feld.x);

/**
 * Ordnet jedem Ankreuzfeld die Woerter seiner Zeile zu.
 * @returns Felder mit `nummer` (gedruckte Ziffer) und `beschriftung`.
 */
export const beschrifteFelder = (felder, words, frame, { scale = 1, rowBand = 0.045 } = {}) => {
  const mapped = words.map(w => ({ ...w, ...toRelative(frame, center(w, scale)) }));

  return felder.map(feld => {
    const zeile = mapped
      .filter(w => Math.abs(w.y - feld.y) <= rowBand && matchesSide(feld, w.x))
      .sort((a, b) => a.x - b.x);
    const [first] = zeile;
    const nummer = first && /^\d{1,2}$/.test(first.text) ? Number(first.text) : undefined;
    const text = (nummer === undefined ? zeile : zeile.slice(1)).map(w => w.text).join(' ').trim();
    return { ...feld, ...(nummer === undefined ? {} : { nummer }), ...(text ? { beschriftung: text } : {}) };
  });
};

/**
 * Rueckfallweg: Feldlagen allein aus den Textzeilen ableiten, wenn die Ringsuche nichts findet.
 * Weniger zuverlaessig als die Kreiserkennung - Zeilen ohne lesbaren Text fehlen dann.
 * @param {Array} words aus readWords()
 * @param {object} frame aus findFrame()
 */
export const felderAusText = (words, frame, { erststimmeX, zweitstimmeX, scale = 1, rowBand = 0.02 } = {}) => {
  const mapped = words.map(w => ({ ...w, ...toRelative(frame, center(w, scale)) }));

  const spalte = (stimme, kreisX) => {
    const eigene = mapped.filter(w => (stimme === 'erststimme' ? w.x < kreisX : w.x > kreisX));
    const zeilen = [...eigene].sort((a, b) => a.y - b.y).reduce((groups, w) => {
      const last = groups.at(-1);
      if (last && w.y - last.y <= rowBand) last.words.push(w);
      else groups.push({ y: w.y, words: [w] });
      return groups;
    }, []);
    return zeilen.map((z, i) => ({
      id: `${stimme === 'erststimme' ? 'E' : 'Z'}${i + 1}`,
      stimme, position: i + 1, x: kreisX, y: z.y, leerFuellgrad: 0,
      beschriftung: z.words.sort((a, b) => a.x - b.x).map(w => w.text).join(' '),
    }));
  };

  return [...spalte('erststimme', erststimmeX), ...spalte('zweitstimme', zweitstimmeX)];
};
