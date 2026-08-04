import { resolve } from 'node:path';
import { createWorker } from 'tesseract.js';
import { writePng } from '../src/png.js';

const gap = 20;

const packRegions = (image, regions) => {
  const width = Math.max(...regions.map(region => region.width));
  const height = regions.reduce((sum, region) => sum + region.height, 0) + gap * (regions.length - 1);
  const data = new Uint8ClampedArray(width * height * 4).fill(255);
  const offsets = [];
  let top = 0;
  for (const region of regions) {
    for (let y = 0; y < region.height; y++) {
      const source = ((region.top + y) * image.width + region.left) * 4;
      const target = ((top + y) * width) * 4;
      data.set(image.data.subarray(source, source + region.width * 4), target);
    }
    offsets.push({ ...region, sourceTop: region.top, top });
    top += region.height + gap;
  }
  return { image: { width, height, data }, offsets };
};

const readWords = blocks => (blocks ?? [])
  .flatMap(block => block.paragraphs)
  .flatMap(paragraph => paragraph.lines)
  .flatMap(line => line.words)
  .map(({ text, confidence, bbox }) => ({ text, confidence, bbox }));

const moveBbox = (word, offsets) => {
  const y = (word.bbox.y0 + word.bbox.y1) / 2;
  const offset = offsets.find(region => y >= region.top && y < region.top + region.height);
  return offset && {
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

export const createFotoOcr = async root => {
  const worker = await createWorker('deu', 1, {
    langPath: resolve(root, 'node_modules/@tesseract.js-data/deu/4.0.0_best_int'),
    cacheMethod: 'none',
  });
  return {
    recognizeWords: async (image, regions) => {
      const { image: strip, offsets } = regions
        ? packRegions(image, regions)
        : { image };
      const { data } = await worker.recognize(
        writePng(strip),
        { tessedit_pageseg_mode: '11' },
        { text: false, blocks: true },
      );
      const words = readWords(data.blocks).filter(word => word.confidence >= 20);
      return offsets ? words.map(word => moveBbox(word, offsets)).filter(Boolean) : words;
    },
    terminate: () => worker.terminate(),
  };
};
