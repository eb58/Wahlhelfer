#!/usr/bin/env node
/** Prueft, ob die lokale OCR alle Textmarken in den hinterlegten Musterzetteln findet. */
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createWorker } from 'tesseract.js';
import { bestimmeTextTransformation, transformiere } from '../src/textJustierung.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const kalibrierungsOrdner = resolve(root, 'Kalibrierungen');
const dateien = process.argv.slice(2).length
  ? process.argv.slice(2).map(datei => resolve(root, datei))
  : readdirSync(kalibrierungsOrdner).filter(datei => datei.endsWith('.json')).map(datei => resolve(kalibrierungsOrdner, datei));
const worker = await createWorker('deu', 1, {
  langPath: resolve(root, 'node_modules/@tesseract.js-data/deu/4.0.0_best_int'),
  cacheMethod: 'none',
});

try {
  for (const datei of dateien) {
    const kalibrierung = JSON.parse(readFileSync(datei, 'utf8'));
    const { data } = await worker.recognize(resolve(root, kalibrierung.quelle), {}, { text: false, blocks: true });
    const woerter = (data.blocks ?? [])
      .flatMap(block => block.paragraphs)
      .flatMap(paragraph => paragraph.lines)
      .flatMap(line => line.words);
    const { transformation, treffer } = bestimmeTextTransformation(kalibrierung.textmarken, woerter, kalibrierung.frame, kalibrierung.frame);
    if (treffer.length !== kalibrierung.textmarken.length)
      throw new Error(`${kalibrierung.name}: nur ${treffer.length}/${kalibrierung.textmarken.length} Textmarken erkannt`);
    const fehler = Math.sqrt(treffer.reduce((summe, treffer) => {
      const erwartet = transformiere(transformation, treffer.muster);
      return summe + (erwartet.x - treffer.aufnahme.x) ** 2 + (erwartet.y - treffer.aufnahme.y) ** 2;
    }, 0) / treffer.length);
    if (fehler > 5) throw new Error(`${kalibrierung.name}: Textmarken haben ${fehler.toFixed(2)} px Lagefehler`);
    console.log(`${kalibrierung.name}: ${treffer.length} Textmarken, Lagefehler ${fehler.toFixed(2)} px`);
  }
} finally {
  await worker.terminate();
}
