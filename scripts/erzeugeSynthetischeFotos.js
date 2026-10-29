/**
 * Erzeugt synthetische Smartphone-Fotos fuer alle Wahlen unter `Wahlen/`.
 *
 * Der Musterzettel bekommt je Stimme ein Kreuz und wird perspektivisch auf einen Holztisch mit
 * Helligkeitsverlauf und Rauschen gelegt. Die Ergebnisse liegen je Zettelart als JPEG mit Manifest
 * unter `Wahlen/<wahl>/testdaten/synthetisch/` (`art: 'foto'`, vorhandene Scan-Faelle dort bleiben stehen)
 * und werden von `test/fotos/synthetisch-*.test.js` gelesen.
 * Neu erzeugen nur, wenn sich Musterzettel oder Kalibrierung aendern:
 *   node scripts/erzeugeSynthetischeFotos.js
 * Der Zufall ist fest geseedet - dieselben Eingaben ergeben dieselben Bilder.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { readImage } from '../test/fotoWerkstatt.js';
import { loadKalibrierung } from '../src/erfassungsplatz/erkennung/kalibrierung.js';
import { rotateImage } from '../src/erfassungsplatz/erkennung/image.js';

const root = new URL('../', import.meta.url);

/** Bildpunkt -> Lage im Musterzettel (0..1), Umkehrung der Abbildung Einheitsquadrat -> Viereck. */
const inverseHomography = ([topLeft, topRight, bottomRight, bottomLeft]) => {
  const dx1 = topRight.x - bottomRight.x, dx2 = bottomLeft.x - bottomRight.x;
  const dx3 = topLeft.x - topRight.x + bottomRight.x - bottomLeft.x;
  const dy1 = topRight.y - bottomRight.y, dy2 = bottomLeft.y - bottomRight.y;
  const dy3 = topLeft.y - topRight.y + bottomRight.y - bottomLeft.y;
  const denominator = dx1 * dy2 - dx2 * dy1;
  const g = (dx3 * dy2 - dx2 * dy3) / denominator, h = (dx1 * dy3 - dx3 * dy1) / denominator;
  const [a, b, c] = [topRight.x - topLeft.x + g * topRight.x, bottomLeft.x - topLeft.x + h * bottomLeft.x, topLeft.x];
  const [d, e, f] = [topRight.y - topLeft.y + g * topRight.y, bottomLeft.y - topLeft.y + h * bottomLeft.y, topLeft.y];
  const inverse = [e - f * h, c * h - b, b * f - c * e, f * g - d, a - c * g, c * d - a * f, d * h - e * g, b * g - a * h, a * e - b * d];
  return (x, y) => {
    const w = inverse[6] * x + inverse[7] * y + inverse[8];
    return { u: (inverse[0] * x + inverse[1] * y + inverse[2]) / w, v: (inverse[3] * x + inverse[4] * y + inverse[5]) / w };
  };
};

/** Transparenz ueber Weiss rechnen und Kreuze in die Ankreuzfelder zeichnen. */
const kreuzeAn = (muster, typ, ids) => {
  const data = new Uint8ClampedArray(muster.data);
  for (let i = 0; i < data.length; i += 4) {
    const alpha = data[i + 3] / 255;
    for (let k = 0; k < 3; k++) data[i + k] = data[i + k] * alpha + 255 * (1 - alpha);
    data[i + 3] = 255;
  }
  const radius = typ.referenzRadius;
  for (const id of ids) {
    const { referenz } = typ.felder.find(feld => feld.id === id);
    for (let t = -0.7; t <= 0.7; t += 0.005)
      for (const sign of [1, -1])
        for (let dy = -2; dy <= 2; dy++)
          for (let dx = -2; dx <= 2; dx++) {
            const x = Math.round(referenz.x + t * radius + dx), y = Math.round(referenz.y + sign * t * radius + dy);
            data.set([20, 30, 90], (y * muster.width + x) * 4);
          }
  }
  return { ...muster, data };
};

/** Legt den Zettel auf den Tisch; je Bildpixel werden vier Unterabtastpunkte gemittelt wie bei einer Kamera. */
const fotografiere = (zettel, { width, height, quad, seed = 1 }) => {
  let state = seed;
  const random = () => (state = (state * 16807) % 2147483647) / 2147483647;
  const toZettel = inverseHomography(quad);
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const light = 0.75 + 0.25 * (x / width) - 0.1 * (y / height);
      const samples = [[0.25, 0.25], [0.75, 0.25], [0.25, 0.75], [0.75, 0.75]].map(([sx, sy]) => toZettel(x + sx, y + sy));
      const onPaper = samples.every(({ u, v }) => u >= 0 && u < 1 && v >= 0 && v < 1);
      const rgb = onPaper
        ? samples.reduce((sum, { u, v }) => {
          const i = (Math.floor(v * zettel.height) * zettel.width + Math.floor(u * zettel.width)) * 4;
          return sum.map((value, k) => value + zettel.data[i + k] / 4);
        }, [0, 0, 0])
        : (grain => [150 * grain, 100 * grain, 60 * grain])(0.75 + 0.25 * Math.sin((x * 0.3 + y * 0.9) / 7 + Math.sin(y / 40) * 3));
      rgb.forEach((value, k) => { data[(y * width + x) * 4 + k] = value * light + (random() - 0.5) * 16; });
      data[(y * width + x) * 4 + 3] = 255;
    }
  return { width, height, data };
};


// Ecken des Musterzettels (oben links, oben rechts, unten rechts, unten links) in Bildpixeln - in dem
// Mass, wie es auch echte Aufnahmen zeigen: gerade, leicht von schraeg oben, um wenige Grad gedreht.
const rechteck = (width, height) => [[0.1, 0.08], [0.9, 0.08], [0.9, 0.92], [0.1, 0.92]].map(([x, y]) => ({ x: x * width, y: y * height }));
const lagen = {
  gerade: rechteck,
  // Oben schmaler als unten: oben je 6 % der Breite nach innen, unten je 2 % nach aussen.
  schraeg: (width, height) => {
    const [topLeft, topRight, bottomRight, bottomLeft] = rechteck(width, height);
    const oben = width * 0.06, unten = width * 0.02;
    return [
      { x: topLeft.x + oben, y: topLeft.y }, { x: topRight.x - oben, y: topRight.y },
      { x: bottomRight.x + unten, y: bottomRight.y }, { x: bottomLeft.x - unten, y: bottomLeft.y },
    ];
  },
  // Um 4 Grad gedreht und so weit verkleinert, dass auch lange Zettel ganz im Bild bleiben.
  gedreht: (width, height, winkel = 4 * Math.PI / 180) => {
    const gedreht = rechteck(width, height).map(({ x, y }) => ({
      dx: (x - width / 2) * Math.cos(winkel) - (y - height / 2) * Math.sin(winkel),
      dy: (x - width / 2) * Math.sin(winkel) + (y - height / 2) * Math.cos(winkel),
    }));
    const scale = Math.min(1, ...gedreht.map(({ dx, dy }) => Math.min(width * 0.45 / Math.abs(dx), height * 0.46 / Math.abs(dy))));
    return gedreht.map(({ dx, dy }) => ({ x: width / 2 + dx * scale, y: height / 2 + dy * scale }));
  },
};

/**
 * Je Lage ein anderes Feld, damit nicht immer dieselbe Zeile angekreuzt ist; dazu ein quer gespeichertes
 * Foto (aufzurichten), eines mit zwei Kreuzen je Stimme und ein leeres (beide nicht eindeutig).
 */
const getFaelle = typ => {
  const feld = (stimme, index) => typ.felder.filter(row => row.stimme === stimme.id)[index].id;
  return [
    ...Object.keys(lagen).map((lage, index) => ({ datei: `${lage}.jpg`, lage, markierungen: typ.stimmen.map(stimme => feld(stimme, index + 1)) })),
    { datei: 'quer.jpg', lage: 'gerade', drehung: 1, markierungen: typ.stimmen.map(stimme => feld(stimme, 4)) },
    { datei: 'mehrfach.jpg', lage: 'gerade', markierungen: typ.stimmen.flatMap(stimme => [feld(stimme, 0), feld(stimme, 2)]) },
    { datei: 'leer.jpg', lage: 'gerade', markierungen: [] },
  ];
};

const writeJpeg = ({ width, height, data }, url) =>
  sharp(Buffer.from(data.buffer), { raw: { width, height, channels: 4 } }).jpeg({ quality: 85 }).toFile(fileURLToPath(url));

for (const wahl of readdirSync(new URL('Wahlen/', root))) {
  const json = readFileSync(new URL(`Wahlen/${wahl}/kalibrierung.json`, root), 'utf8');
  const typ = loadKalibrierung(json);
  const muster = await readImage(readFileSync(new URL(JSON.parse(json).quelle, root)));
  const folder = new URL(`Wahlen/${wahl}/testdaten/synthetisch/`, root);
  mkdirSync(folder, { recursive: true });
  const width = 1200, height = Math.round(width * muster.height / muster.width * 1.25);
  // Scan-Faelle und bekannte Luecken (`todo`) im vorhandenen Manifest stammen nicht von hier und bleiben erhalten.
  const manifestUrl = new URL('manifest.json', folder);
  const bisher = existsSync(manifestUrl) ? JSON.parse(readFileSync(manifestUrl, 'utf8')).faelle : [];
  const todo = datei => bisher.find(fall => fall.datei === datei)?.todo;
  const faelle = await Promise.all(getFaelle(typ).map(async ({ datei, lage, drehung = 0, markierungen }, index) => {
    const foto = fotografiere(kreuzeAn(muster, typ, markierungen), { width, height, quad: lagen[lage](width, height), seed: index + 1 });
    await writeJpeg(rotateImage(foto, drehung), new URL(datei, folder));
    console.log(wahl, datei, markierungen.join(' '));
    return { datei, art: 'foto', lage, ...(drehung ? { drehung } : {}), markierungen, ...(todo(datei) ? { todo: todo(datei) } : {}) };
  }));
  const alle = [...bisher.filter(fall => fall.art === 'scan'), ...faelle];
  const manifest = { fotosErzeugtMit: 'scripts/erzeugeSynthetischeFotos.js', wahl, anzahl: alle.length, faelle: alle };
  writeFileSync(new URL('manifest.json', folder), `${JSON.stringify(manifest, null, 2)}
`);
}
