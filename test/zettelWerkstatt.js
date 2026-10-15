/**
 * Testwerkstatt: erzeugt ausgefuellte Stimmzettel aus dem leeren Musterzettel.
 * Die Kreuze werden ins Bild gezeichnet - so sind Sollwerte im Test bekannt.
 */
import { readFileSync } from 'node:fs';
import { readImage } from './fotoWerkstatt.js';
import { toDarkness } from '../erfassungsplatz/erkennung/image.js';
import { findFrame, toAbsolute, frameWidth } from '../erfassungsplatz/erkennung/frame.js';

export const musterZettel = () => readImage(readFileSync(new URL('../Testdaten/bundestagswahl-2017/musterzettel.png', import.meta.url)));

export const copy = ({ width, height, data }) => ({ width, height, data: new Uint8ClampedArray(data) });

const setPixel = ({ width, height, data }, x, y, value) => {
  const px = Math.round(x), py = Math.round(y);
  if (px < 0 || py < 0 || px >= width || py >= height) return;
  const i = (py * width + px) * 4;
  data[i] = data[i + 1] = data[i + 2] = value;
  data[i + 3] = 255;
};

const line = (image, x0, y0, x1, y1, value, thickness) => {
  const steps = Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 2);
  for (let i = 0; i <= steps; i++) {
    const t = i / steps, x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t;
    for (let dy = -thickness; dy <= thickness; dy++)
      for (let dx = -thickness; dx <= thickness; dx++) setPixel(image, x + dx, y + dy, value);
  }
};

/**
 * Zeichnet Kreuze in die angegebenen Ankreuzfelder.
 * @param {object} typ registrierter Wahlzetteltyp
 * @param {string[]} ids Feld-IDs, die angekreuzt werden sollen
 * @param {{strength?:number, size?:number, thickness?:number}} stil
 *   `strength` 0 = tiefschwarz, 255 = unsichtbar; `size` als Anteil des Kreisradius.
 */
export const kreuzeAn = (image, typ, ids, { strength = 0, size = 0.75, thickness = 1 } = {}) => {
  const target = copy(image);
  const frame = findFrame(toDarkness(image));
  const radius = typ.radius * frameWidth(frame);

  for (const id of ids) {
    const feld = typ.felder.find(f => f.id === id);
    if (!feld) throw new Error(`Unbekanntes Ankreuzfeld: ${id}`);
    const { x, y } = toAbsolute(frame, feld), a = radius * size;
    line(target, x - a, y - a, x + a, y + a, strength, thickness);
    line(target, x - a, y + a, x + a, y - a, strength, thickness);
  }
  return target;
};

/** Vergroessert ein Bild ganzzahlig - prueft die Aufloesungsunabhaengigkeit. */
export const scale = ({ width, height, data }, factor) => {
  const w = width * factor, h = height * factor, out = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const from = (Math.trunc(y / factor) * width + Math.trunc(x / factor)) * 4, to = (y * w + x) * 4;
      for (let k = 0; k < 4; k++) out[to + k] = data[from + k];
    }
  return { width: w, height: h, data: out };
};

/**
 * Dreht ein Bild um seinen Mittelpunkt, freie Flaechen bleiben Papierweiss.
 * Damit laesst sich eine schraeg gehaltene Aufnahme nachstellen.
 */
export const rotate = ({ width, height, data }, degrees) => {
  const rad = (degrees * Math.PI) / 180, cos = Math.cos(rad), sin = Math.sin(rad);
  const mx = width / 2, my = height / 2;
  const out = new Uint8ClampedArray(width * height * 4).fill(255);

  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      // Rueckwaerts abtasten: fuer jedes Zielpixel die Quelle suchen, sonst entstehen Loecher.
      const dx = x - mx, dy = y - my;
      const sx = Math.round(mx + dx * cos + dy * sin), sy = Math.round(my - dx * sin + dy * cos);
      if (sx < 0 || sy < 0 || sx >= width || sy >= height) continue;
      const from = (sy * width + sx) * 4, to = (y * width + x) * 4;
      for (let k = 0; k < 4; k++) out[to + k] = data[from + k];
    }
  return { width, height, data: out };
};

/** Schneidet einen Rand ab - prueft die Unabhaengigkeit vom Bildausschnitt. */
export const crop = ({ width, height, data }, left, top, cropWidth, cropHeight) => {
  const out = new Uint8ClampedArray(cropWidth * cropHeight * 4);
  for (let y = 0; y < cropHeight; y++)
    for (let x = 0; x < cropWidth; x++) {
      const from = ((y + top) * width + x + left) * 4, to = (y * cropWidth + x) * 4;
      for (let k = 0; k < 4; k++) out[to + k] = data[from + k];
    }
  return { width: cropWidth, height: cropHeight, data: out };
};
