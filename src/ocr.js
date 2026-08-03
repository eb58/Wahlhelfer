/** Lokale Browser-OCR. Worker, WebAssembly und deutsches Sprachmodell kommen aus dem Build. */
import { createWorker } from 'tesseract.js';
import { toImageUrl, toTextstreifenUrl } from './browserImage.js';

const state = {};
const assetPath = path => `${import.meta.env.BASE_URL}vendor/${path}`;

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
    bbox: {
      x0: wort.bbox.x0 + offset.left,
      x1: wort.bbox.x1 + offset.left,
      y0: wort.bbox.y0 - offset.top + offset.sourceTop,
      y1: wort.bbox.y1 - offset.top + offset.sourceTop,
    },
  };
};

/** @returns {Promise<Array<{text:string,confidence:number,bbox:object}>>} */
export const erkenneWoerter = async (image, bereiche) => {
  const quelle = bereiche ? await toTextstreifenUrl(image, bereiche) : { imageUrl: await toImageUrl(image) };
  try {
    const worker = await ladeWorker();
    const { data } = await worker.recognize(quelle.imageUrl, {}, { text: false, blocks: true });
    const woerter = liesWoerter(data.blocks).filter(wort => wort.confidence >= 35);
    return quelle.offsets ? woerter.map(wort => verschiebeBbox(wort, quelle.offsets)).filter(Boolean) : woerter;
  } finally {
    globalThis.URL.revokeObjectURL(quelle.imageUrl);
  }
};
