#!/usr/bin/env node
/**
 * Admin-Werkzeug: neuen Wahlzetteltyp aus einem leeren Musterzettel registrieren.
 *
 *   node scripts/registerWahlzettel.js <muster.png> [ziel.json] [--name "..."] [--ocr]
 *
 * Ergebnis ist eine JSON-Datei, die per `fromJson()` wieder zum fertigen Erkenner wird.
 * Die Registrierung erfolgt einmal je Zettelart, nicht je Aufnahme.
 */
import { readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, basename } from 'node:path';
import { readPng, writePng } from '../src/png.js';
import { registerWahlzettel, beschreibe } from '../src/wahlzettelTyp.js';
import { recommendedScale } from '../src/beschriftung.js';
import { localOcrOptions } from '../src/ocrPaths.js';
import { setLogging } from '../src/log.js';

setLogging(true);

const args = process.argv.slice(2);
const valueOf = flag => args[args.indexOf(flag) + 1];
const [musterPath, targetPath = 'wahlzettelTyp.json'] = args.filter(a => !a.startsWith('--') && a !== valueOf('--name'));

if (!musterPath) {
  console.error('Aufruf: node scripts/registerWahlzettel.js <muster.png> [ziel.json] [--name "..."] [--ocr]');
  process.exit(1);
}

const image = readPng(readFileSync(musterPath));
const name = valueOf('--name') ?? basename(musterPath).replace(/\.png$/i, '');

/** tesseract liest kleine Schrift schlecht; deshalb ein vergroessertes Zwischenbild. */
const withOcr = args.includes('--ocr');
const scale = factor => {
  const { width, height, data } = image, w = width * factor, h = height * factor;
  const out = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const from = (Math.trunc(y / factor) * width + Math.trunc(x / factor)) * 4, to = (y * w + x) * 4;
      for (let k = 0; k < 4; k++) out[to + k] = data[from + k];
    }
  return { width: w, height: h, data: out };
};

const ocrPath = join(tmpdir(), `wahlzettel-ocr-${process.pid}.png`);
if (withOcr) writeFileSync(ocrPath, writePng(scale(recommendedScale)));

try {
  const typ = await registerWahlzettel(image, {
    name,
    ...(withOcr ? { ocr: { source: ocrPath, scale: recommendedScale, ...localOcrOptions() } } : {}),
  });
  writeFileSync(targetPath, typ.toJson());
  console.log(`Registriert: ${targetPath}`);
  console.log(JSON.stringify(beschreibe(typ), null, 2));
} finally {
  if (withOcr) unlinkSync(ocrPath);
}
