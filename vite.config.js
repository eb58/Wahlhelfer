import { copyFileSync, mkdirSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { defineConfig } from 'vite';

export const projectRoot = fileURLToPath(new URL('.', import.meta.url));
const publicDir = resolve(projectRoot, 'public');
const kalibrierungSource = resolve(projectRoot, 'Kalibrierungen');
const pdfjsSource = resolve(projectRoot, 'node_modules/pdfjs-dist');

const copyFiles = (source, destination, files = readdirSync(source)) => {
  mkdirSync(destination, { recursive: true });
  files.forEach(file => copyFileSync(resolve(source, file), resolve(destination, file)));
};

const syncAssets = () => {
  copyFiles(kalibrierungSource, resolve(publicDir, 'Kalibrierungen'),
    readdirSync(kalibrierungSource).filter(file => file.endsWith('.json')));
  copyFiles(resolve(pdfjsSource, 'build'), resolve(publicDir, 'vendor/pdfjs'), ['pdf.worker.min.mjs']);
  copyFiles(resolve(pdfjsSource, 'wasm'), resolve(publicDir, 'vendor/pdfjs/wasm'));
};

syncAssets();

export default defineConfig({
  base: '/',
});
