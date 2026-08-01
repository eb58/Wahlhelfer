#!/usr/bin/env node
/**
 * Spiegelt Worker, Core und Sprachdaten von Tesseract aus node_modules nach vendor/tesseract.
 *
 * Ohne diese Dateien laedt tesseract.js sie still vom jsdelivr-CDN nach. Fuer ein
 * Wahlwerkzeug ist das nicht hinnehmbar: die Anwendung muss ohne Netzzugriff laufen.
 * Vorbild ist `gratulationsdienst/vite.config.js` (dort per Vite-Plugin bei jedem Build).
 *
 *   npm run vendor
 */
import { mkdirSync, copyFileSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const target = join(root, 'vendor', 'tesseract');

// Nur die LSTM-Varianten: ohne abweichendes OEM nutzt tesseract.js ausschliesslich dieses Modell.
// Welche der drei Core-Fassungen passt, entscheidet tesseract.js anhand der SIMD-Unterstuetzung.
const files = [
  'tesseract.js/dist/worker.min.js',
  'tesseract.js-core/tesseract-core-lstm.wasm.js',
  'tesseract.js-core/tesseract-core-simd-lstm.wasm.js',
  'tesseract.js-core/tesseract-core-relaxedsimd-lstm.wasm.js',
  '@tesseract.js-data/deu/4.0.0_best_int/deu.traineddata.gz',
];

mkdirSync(target, { recursive: true });
for (const file of files) {
  copyFileSync(join(root, "node_modules", file), join(target, file.split("/").at(-1)));
}
console.log(`${files.length} Dateien gespiegelt nach vendor/tesseract`);
