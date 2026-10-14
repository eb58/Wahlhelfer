/** Lokale Browser-OCR. Worker, WebAssembly und deutsches Sprachmodell kommen aus dem Build. */
import { createWorker } from 'tesseract.js';
import { toImageUrl, toTextStripUrl } from './browserImage.js';
import { log, round } from './log.js';
import { appUrl } from '../appUrl.js';

const state = {};
const assetPath = path => appUrl(`vendor/${path}`);

const saveDebugImage = (imageUrl, regions) => {
  if (new URLSearchParams(globalThis.location?.search ?? '').get('ocrDebug') !== '1') return;
  const link = globalThis.document?.createElement('a');
  if (!link) return;
  state.debugImage = (state.debugImage ?? 0) + 1;
  link.href = imageUrl;
  link.download = `wahl-ocr-${regions ? 'regions' : 'full'}-${state.debugImage}.png`;
  link.click();
  log(`OCR-Bild gespeichert: ${link.download}`);
};

const loadWorker = () => state.worker ??= createWorker('deu', 1, {
  workerPath: assetPath('tesseract/worker.min.js'),
  corePath: assetPath('tesseract-core'),
  langPath: assetPath('tessdata'),
});

const readWords = blocks => (blocks ?? [])
  .flatMap(block => block.paragraphs)
  .flatMap(paragraph => paragraph.lines)
  .flatMap(line => line.words)
  .map(({ text, confidence, bbox }) => ({ text, confidence, bbox }));

const moveBbox = (word, offsets) => {
  const x = (word.bbox.x0 + word.bbox.x1) / 2;
  const y = (word.bbox.y0 + word.bbox.y1) / 2;
  const offset = offsets.find(region => y >= region.top && y < region.top + region.height);
  if (!offset) return undefined;
  return {
    ...word,
    textmarke: offset.textmarke,
    bbox: {
      x0: word.bbox.x0 + offset.left,
      x1: word.bbox.x1 + offset.left,
      y0: word.bbox.y0 - offset.top + offset.sourceTop,
      y1: word.bbox.y1 - offset.top + offset.sourceTop,
    },
  };
};

/** @returns {Promise<Array<{text:string,confidence:number,bbox:object}>>} */
export const recognizeWords = async (image, regions, frame) => {
  const source = regions
    ? await toTextStripUrl(image, regions, frame)
    : { imageUrl: await toImageUrl(image, frame) };
  saveDebugImage(source.imageUrl, regions);
  try {
    const worker = await loadWorker();
    const { data } = await worker.recognize(
      source.imageUrl,
      { tessedit_pageseg_mode: '11' },
      { text: false, blocks: true },
    );
    const words = readWords(data.blocks).filter(word => word.confidence >= 20);
    const output = words.slice(0, 20)
      .map(word => `${word.text.trim()} (${round(word.confidence)}%)`)
      .filter(word => word.startsWith('(') === false)
      .join(', ');
    log(`OCR erkannte ${words.length} Woerter${output ? `: ${output}${words.length > 20 ? ', ...' : ''}` : ''}`);
    return source.offsets ? words.map(word => moveBbox(word, source.offsets)).filter(Boolean) : words;
  } finally {
    globalThis.URL.revokeObjectURL(source.imageUrl);
  }
};
