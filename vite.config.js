import { copyFileSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import basicSsl from '@vitejs/plugin-basic-ssl';

export const projectRoot = fileURLToPath(new URL('.', import.meta.url));
// Erzeugtes Zwischenlager fuer Kalibrierungen und Gebiete - wie Vites eigener Cache unter node_modules,
// damit es im Projekt nicht als Ordner auftaucht. Vite liefert es aus und kopiert es nach dist/.
const publicDir = resolve(projectRoot, 'node_modules/.wahlassistent-public');
const wahlenSource = resolve(projectRoot, 'Wahlen');

const copyFiles = (source, destination, files = readdirSync(source)) => {
  mkdirSync(destination, { recursive: true });
  files.forEach(file => copyFileSync(resolve(source, file), resolve(destination, file)));
};

// Je Wahl nur Kalibrierung und Gebiet; Musterzettel und Druckvorlage brauchen nur die Werkzeuge.
const syncAssets = () => {
  // Vorher leeren: sonst bleiben umbenannte oder geloeschte Wahlen als veraltete Kopie liegen.
  rmSync(resolve(publicDir, 'Wahlen'), { recursive: true, force: true });
  readdirSync(wahlenSource).forEach(wahl =>
    copyFiles(resolve(wahlenSource, wahl), resolve(publicDir, 'Wahlen', wahl),
      readdirSync(resolve(wahlenSource, wahl)).filter(file => file.endsWith('.json'))));
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
  // Die Seiten liegen unter src/; mit src/ als Root landen sie in dist/ wieder auf oberster Ebene
  // (dist/erfassungsplatz/, dist/controlcenter/), die Links bleiben also gleich.
  root: resolve(projectRoot, 'src'),
  publicDir,
  plugins: mode === 'lan' ? [basicSsl()] : [],
  server: { proxy },
  preview: { proxy },
  build: {
    outDir: resolve(projectRoot, 'dist'),
    emptyOutDir: true,
    rollupOptions: { input: { erfassungsplatz: resolve(projectRoot, 'src/erfassungsplatz/index.html'), controlcenter: resolve(projectRoot, 'src/controlcenter/index.html') } },
    // Das ControlCenter bringt AG Grid komplett mit (rund 1,1 MB). Die Groesse spielt hier kaum eine Rolle:
    // Admins im Wahlamt am PC, Wahlhelfer laden nur den kleinen Erfassungsplatz.
    chunkSizeWarningLimit: 2000,
  },
}));
