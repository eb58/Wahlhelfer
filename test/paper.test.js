import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { findPaper } from '../erfassungsplatz/erkennung/paper.js';
import { readFoto } from './fotoWerkstatt.js';

const background = [30, 30, 80];
const paperColor = [245, 245, 245];

const makeImage = (width, height, isPaper) => {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const [r, g, b] = isPaper(x, y) ? paperColor : background;
      const i = (y * width + x) * 4;
      data[i] = r; data[i + 1] = g; data[i + 2] = b; data[i + 3] = 255;
    }
  return { width, height, data };
};

test('findPaper findet ein achsenparalleles, helles Papierrechteck auf dunklem Untergrund', () => {
  const width = 200, height = 300;
  const image = makeImage(width, height, (x, y) => x >= 30 && x <= 170 && y >= 40 && y <= 260);
  const paper = findPaper(image);
  assert.ok(paper);
  assert.deepEqual([paper.left, paper.right, paper.top, paper.bottom], [30, 170, 40, 260]);
  assert.ok(Math.abs(paper.horizontalSlope) < 1e-9, `horizontalSlope ${paper.horizontalSlope}`);
});

test('findPaper erkennt kein Papier auf gleichfoermigem Untergrund', () => {
  const image = makeImage(200, 300, () => false);
  assert.equal(findPaper(image), undefined);
});

test('findPaper verwirft ein Papierstueck, das zu wenig vom Bild ausfuellt', () => {
  const width = 200, height = 300;
  // 40x40 Fleck: erfuellt lokal die 15%-Mindestdichte je Zeile/Spalte, aber nicht die 45%-Gesamtausdehnung.
  const image = makeImage(width, height, (x, y) => x >= 80 && x <= 120 && y >= 130 && y <= 170);
  assert.equal(findPaper(image), undefined);
});

test('findPaper erkennt eine geneigte obere Papierkante', () => {
  const width = 300, height = 400;
  const left = 40, right = 260, bottom = 350, cx = (left + right) / 2, slope = 0.05, base = 100;
  const topAt = x => base + slope * (x - cx);
  const image = makeImage(width, height, (x, y) => x >= left && x <= right && y >= topAt(x) && y <= bottom);

  const paper = findPaper(image);
  assert.ok(paper);
  assert.ok(Math.abs(paper.left - left) <= 2, `left ${paper.left}`);
  assert.ok(Math.abs(paper.right - right) <= 2, `right ${paper.right}`);
  assert.ok(Math.abs(paper.bottom - bottom) <= 2, `bottom ${paper.bottom}`);
  assert.ok(paper.horizontalSlope > 0.02 && paper.horizontalSlope < 0.08, `horizontalSlope ${paper.horizontalSlope}`);
});

test('findPaper ignoriert ein getrenntes helles Blatt neben dem Wahlzettel', () => {
  const width = 400, height = 500;
  const image = makeImage(width, height, (x, y) =>
    (x >= 30 && x <= 300 && y >= 40 && y <= 460) || (x >= 340 && y >= 180 && y <= 350));
  const paper = findPaper(image);
  assert.ok(paper);
  assert.ok(paper.right <= 304, `right ${paper.right}`);
});

test('findPaper trennt das zweite Blatt im problematischen Foto ab', async () => {
  const image = await readFoto(readFileSync(new URL(
    '../Testdaten/bundestagswahl-2017/fotos-serie1/PXL_20260803_201232140.jpg', import.meta.url),
  ));
  const paper = findPaper(image);
  assert.ok(paper);
  assert.ok(paper.right < 1300, `right ${paper.right}`);
});
