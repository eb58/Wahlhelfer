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

/**
 * Was je Wahl ausgeliefert wird: nur die JSON-Dateien direkt im Ordner (Kalibrierung, Gebiet).
 * Musterzettel, Druckvorlage und testdaten/ brauchen nur Werkzeuge und Tests.
 */
export const getWahlAssets = () => readdirSync(wahlenSource).flatMap(wahl =>
  readdirSync(resolve(wahlenSource, wahl), { withFileTypes: true })
    .filter(entry => entry.isFile() && entry.name.endsWith('.json')).map(entry => `${wahl}/${entry.name}`));

const syncAssets = () => {
  // Vorher leeren: sonst bleiben umbenannte oder geloeschte Wahlen als veraltete Kopie liegen.
  rmSync(resolve(publicDir, 'Wahlen'), { recursive: true, force: true });
  getWahlAssets().forEach(file => {
    mkdirSync(resolve(publicDir, 'Wahlen', file, '..'), { recursive: true });
    copyFileSync(resolve(wahlenSource, file), resolve(publicDir, 'Wahlen', file));
  });
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
