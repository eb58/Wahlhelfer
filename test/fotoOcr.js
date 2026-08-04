import { resolve } from 'node:path';
import { createWorker } from 'tesseract.js';
import { writePng } from '../src/png.js';

const abstand = 20;

const packeBereiche = (image, bereiche) => {
  const width = Math.max(...bereiche.map(bereich => bereich.width));
  const height = bereiche.reduce((summe, bereich) => summe + bereich.height, 0) + abstand * (bereiche.length - 1);
  const data = new Uint8ClampedArray(width * height * 4).fill(255);
  const offsets = [];
  let top = 0;
  for (const bereich of bereiche) {
    for (let y = 0; y < bereich.height; y++) {
      const source = ((bereich.top + y) * image.width + bereich.left) * 4;
      const target = ((top + y) * width) * 4;
      data.set(image.data.subarray(source, source + bereich.width * 4), target);
    }
    offsets.push({ ...bereich, sourceTop: bereich.top, top });
    top += bereich.height + abstand;
  }
  return { image: { width, height, data }, offsets };
};

const liesWoerter = blocks => (blocks ?? [])
  .flatMap(block => block.paragraphs)
  .flatMap(paragraph => paragraph.lines)
  .flatMap(line => line.words)
  .map(({ text, confidence, bbox }) => ({ text, confidence, bbox }));

const verschiebeBbox = (wort, offsets) => {
  const y = (wort.bbox.y0 + wort.bbox.y1) / 2;
  const offset = offsets.find(bereich => y >= bereich.top && y < bereich.top + bereich.height);
  return offset && {
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

export const createFotoOcr = async root => {
  const worker = await createWorker('deu', 1, {
    langPath: resolve(root, 'node_modules/@tesseract.js-data/deu/4.0.0_best_int'),
    cacheMethod: 'none',
  });
  return {
    erkenneWoerter: async (image, bereiche) => {
      const { image: streifen, offsets } = bereiche
        ? packeBereiche(image, bereiche)
        : { image };
      const { data } = await worker.recognize(
        writePng(streifen),
        { tessedit_pageseg_mode: '11' },
        { text: false, blocks: true },
      );
      const woerter = liesWoerter(data.blocks).filter(wort => wort.confidence >= 20);
      return offsets ? woerter.map(wort => verschiebeBbox(wort, offsets)).filter(Boolean) : woerter;
    },
    terminate: () => worker.terminate(),
  };
};
