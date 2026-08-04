/** Lokale Browser-OCR. Worker, WebAssembly und deutsches Sprachmodell kommen aus dem Build. */
import { createWorker } from 'tesseract.js';
import { toImageUrl, toTextstreifenUrl } from './browserImage.js';
import { log, round } from './log.js';

const state = {};
const assetPath = path => `${import.meta.env.BASE_URL}vendor/${path}`;

const speichereDebugBild = (imageUrl, bereiche) => {
  if (new URLSearchParams(globalThis.location?.search ?? '').get('ocrDebug') !== '1') return;
  const link = globalThis.document?.createElement('a');
  if (!link) return;
  state.debugBild = (state.debugBild ?? 0) + 1;
  link.href = imageUrl;
  link.download = `wahl-ocr-${bereiche ? 'bereiche' : 'gesamt'}-${state.debugBild}.png`;
  link.click();
  log(`OCR-Bild gespeichert: ${link.download}`);
};

const ladeWorker = () => state.worker ??= createWorker('deu', 1, {
  workerPath: assetPath('tesseract/worker.min.js'),
  corePath: assetPath('tesseract-core'),
  langPath: assetPath('tessdata'),
});

const liesWoerter = blocks => (blocks ?? [])
  .flatMap(block => block.paragraphs)
  .flatMap(paragraph => paragraph.lines)
  .flatMap(line => line.words)
  .map(({ text, confidence, bbox }) => ({ text, confidence, bbox }));

const verschiebeBbox = (wort, offsets) => {
  const x = (wort.bbox.x0 + wort.bbox.x1) / 2;
  const y = (wort.bbox.y0 + wort.bbox.y1) / 2;
  const offset = offsets.find(bereich => y >= bereich.top && y < bereich.top + bereich.height);
  if (!offset) return undefined;
  return {
    ...wort,
    textmarke: offset.textmarke,
    bbox: {
      x0: wort.bbox.x0 + offset.left,
      x1: wort.bbox.x1 + offset.left,
      y0: wort.bbox.y0 - offset.top + offset.sourceTop,
      y1: wort.bbox.y1 - offset.top + offset.sourceTop,
    },
  };
};

/** @returns {Promise<Array<{text:string,confidence:number,bbox:object}>>} */
export const erkenneWoerter = async (image, bereiche, rahmen) => {
  const quelle = bereiche
    ? await toTextstreifenUrl(image, bereiche, rahmen)
    : { imageUrl: await toImageUrl(image, rahmen) };
  speichereDebugBild(quelle.imageUrl, bereiche);
  try {
    const worker = await ladeWorker();
    const { data } = await worker.recognize(
      quelle.imageUrl,
      { tessedit_pageseg_mode: '11' },
      { text: false, blocks: true },
    );
    const woerter = liesWoerter(data.blocks).filter(wort => wort.confidence >= 20);
    const ausgabe = woerter.slice(0, 20)
      .map(wort => `${wort.text.trim()} (${round(wort.confidence)}%)`)
      .filter(wort => wort.startsWith('(') === false)
      .join(', ');
    log(`OCR erkannte ${woerter.length} Woerter${ausgabe ? `: ${ausgabe}${woerter.length > 20 ? ', ...' : ''}` : ''}`);
    return quelle.offsets ? woerter.map(wort => verschiebeBbox(wort, quelle.offsets)).filter(Boolean) : woerter;
  } finally {
    globalThis.URL.revokeObjectURL(quelle.imageUrl);
  }
};
