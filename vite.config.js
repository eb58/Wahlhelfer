import { copyFileSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import basicSsl from '@vitejs/plugin-basic-ssl';

export const projectRoot = fileURLToPath(new URL('.', import.meta.url));
const publicDir = resolve(projectRoot, 'public');
const kalibrierungSource = resolve(projectRoot, 'Kalibrierungen');
const pdfjsSource = resolve(projectRoot, 'node_modules/pdfjs-dist');
const tesseractSource = resolve(projectRoot, 'node_modules/tesseract.js');
const tesseractCoreSource = resolve(projectRoot, 'node_modules/tesseract.js-core');
const tessdataSource = resolve(projectRoot, 'node_modules/@tesseract.js-data/deu/4.0.0_best_int');

const copyFiles = (source, destination, files = readdirSync(source)) => {
  mkdirSync(destination, { recursive: true });
  files.forEach(file => copyFileSync(resolve(source, file), resolve(destination, file)));
};

const syncAssets = () => {
  // Vorher leeren: sonst bleiben umbenannte oder geloeschte Kalibrierungen als veraltete Kopie liegen.
  rmSync(resolve(publicDir, 'Kalibrierungen'), { recursive: true, force: true });
  copyFiles(kalibrierungSource, resolve(publicDir, 'Kalibrierungen'),
    readdirSync(kalibrierungSource).filter(file => file.endsWith('.json')));
  copyFiles(resolve(pdfjsSource, 'build'), resolve(publicDir, 'vendor/pdfjs'), ['pdf.worker.min.mjs']);
  copyFiles(resolve(pdfjsSource, 'wasm'), resolve(publicDir, 'vendor/pdfjs/wasm'));
  copyFiles(resolve(tesseractSource, 'dist'), resolve(publicDir, 'vendor/tesseract'), ['worker.min.js']);
  copyFiles(tesseractCoreSource, resolve(publicDir, 'vendor/tesseract-core'),
    readdirSync(tesseractCoreSource).filter(file => /-lstm\.wasm\.js$/.test(file)));
  copyFiles(tessdataSource, resolve(publicDir, 'vendor/tessdata'), ['deu.traineddata.gz']);
};

syncAssets();

// PHP-API im eigenen Docker-Container (compose.yaml). Host-Header unveraendert lassen:
// die API vergleicht ihn bei schreibenden Anfragen mit dem Origin.
const proxy = { '/php-api': { target: 'http://localhost:3000', changeOrigin: false } };

// --mode lan (npm run dev:lan): HTTPS mit selbst signiertem Zertifikat. Ohne sichere Seite fehlt dem
// Smartphone-Browser crypto.subtle, dann laesst sich kein Stapel beginnen oder senden.
export default defineConfig(({ mode }) => ({
  // Relativ, damit der Build auch in einem Unterordner beim Hoster laeuft.
  base: './',
  plugins: mode === 'lan' ? [basicSsl()] : [],
  server: { proxy },
  preview: { proxy },
  build: { rollupOptions: { input: { erfassungsplatz: resolve(projectRoot, 'erfassungsplatz/index.html'), controlcenter: resolve(projectRoot, 'controlcenter/index.html') } } },
}));
