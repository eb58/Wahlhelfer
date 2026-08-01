#!/usr/bin/env node
/**
 * Spiegelt die Laufzeitdateien von Tesseract und pdf.js aus node_modules nach vendor/.
 *
 * Beide Bibliotheken laden Worker, Core und Sprach- bzw. Decoderdateien sonst still vom
 * CDN nach. Fuer ein Wahlwerkzeug ist das nicht hinnehmbar: die Anwendung muss ohne
 * Netzzugriff laufen. Vorbild ist `gratulationsdienst/vite.config.js` (dort per Vite-Plugin).
 *
 *   npm run vendor
 */
import { mkdirSync, copyFileSync, readdirSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const modules = join(root, 'node_modules');

// Nur die LSTM-Varianten: ohne abweichendes OEM nutzt tesseract.js ausschliesslich dieses Modell.
// Welche der drei Core-Fassungen passt, entscheidet tesseract.js anhand der SIMD-Unterstuetzung.
const tesseract = [
  'tesseract.js/dist/worker.min.js',
  'tesseract.js-core/tesseract-core-lstm.wasm.js',
  'tesseract.js-core/tesseract-core-simd-lstm.wasm.js',
  'tesseract.js-core/tesseract-core-relaxedsimd-lstm.wasm.js',
  '@tesseract.js-data/deu/4.0.0_best_int/deu.traineddata.gz',
];

// pdf.js braucht seinen Worker; die WASM-Bilddecoder greifen erst bei eingebetteten Scans.
const wasmDir = join(modules, 'pdfjs-dist', 'wasm');
const pdfjs = [
  'pdfjs-dist/build/pdf.worker.min.mjs',
  ...readdirSync(wasmDir)
    .filter(name => name.endsWith('.wasm') || name.endsWith('.js'))
    .map(name => `pdfjs-dist/wasm/${name}`),
];

const mirror = (files, targetDir) => {
  const target = join(root, 'vendor', targetDir);
  mkdirSync(target, { recursive: true });
  for (const file of files) copyFileSync(join(modules, file), join(target, file.split('/').at(-1)));
  console.log(`  vendor/${targetDir}: ${files.length} Dateien`);
};

mirror(tesseract, 'tesseract');
mirror(pdfjs, 'pdfjs');
