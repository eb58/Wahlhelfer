#!/usr/bin/env node
/** Prueft, ob die lokale OCR alle Textmarken in den hinterlegten Musterzetteln findet. */
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createWorker } from 'tesseract.js';
import { determineTextTransformation, transform } from '../src/erkennung/textJustierung.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const calibrationFolder = resolve(root, 'Kalibrierungen');
const files = process.argv.slice(2).length
  ? process.argv.slice(2).map(file => resolve(root, file))
  : readdirSync(calibrationFolder).filter(file => file.endsWith('.json')).map(file => resolve(calibrationFolder, file));
const worker = await createWorker('deu', 1, {
  langPath: resolve(root, 'node_modules/@tesseract.js-data/deu/4.0.0_best_int'),
  cacheMethod: 'none',
});

try {
  for (const file of files) {
    const kalibrierung = JSON.parse(readFileSync(file, 'utf8'));
    const { data } = await worker.recognize(resolve(root, kalibrierung.quelle), {}, { text: false, blocks: true });
    const words = (data.blocks ?? [])
      .flatMap(block => block.paragraphs)
      .flatMap(paragraph => paragraph.lines)
      .flatMap(line => line.words);
    const { transformation, treffer } = determineTextTransformation(kalibrierung.textmarken, words, kalibrierung.frame, kalibrierung.frame);
    if (treffer.length !== kalibrierung.textmarken.length)
      throw new Error(`${kalibrierung.name}: nur ${treffer.length}/${kalibrierung.textmarken.length} Textmarken erkannt`);
    const error = Math.sqrt(treffer.reduce((sum, treffer) => {
      const expected = transform(transformation, treffer.muster);
      return sum + (expected.x - treffer.aufnahme.x) ** 2 + (expected.y - treffer.aufnahme.y) ** 2;
    }, 0) / treffer.length);
    if (error > 5) throw new Error(`${kalibrierung.name}: Textmarken haben ${error.toFixed(2)} px Lagefehler`);
    console.log(`${kalibrierung.name}: ${treffer.length} Textmarken, Lagefehler ${error.toFixed(2)} px`);
  }
} finally {
  await worker.terminate();
}
