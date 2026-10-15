import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { computeOcrRegions, determineTextTransformation, transform } from '../erfassungsplatz/erkennung/ocr.js';
import { loadKalibrierung } from '../erfassungsplatz/erkennung/kalibrierung.js';
import { musterZettel, kreuzeAn, rotate } from './zettelWerkstatt.js';

const wordAt = (text, { x, y }) => ({ text, confidence: 95, bbox: { x0: x - 5, y0: y - 4, x1: x + 5, y1: y + 4 } });

test('OCR-Bereiche decken die Textmarken ab und bleiben klein', () => {
  const typ = loadKalibrierung(readFileSync(new URL('../Kalibrierungen/europawahl-sh-2024.json', import.meta.url), 'utf8'));
  const image = { width: 1241, height: 4819 };
  const regions = computeOcrRegions(typ, image, typ.frame);
  assert.equal(regions.length, typ.textmarken.length);
  assert.ok(regions.every(region => region.left >= 0 && region.top >= 0
    && region.left + region.width <= image.width && region.top + region.height <= image.height));
  assert.ok(regions.reduce((sum, region) => sum + region.width * region.height, 0) < image.width * image.height / 8);
});

test('bestimmt eine affine Transformation aus OCR-Wortlagen', () => {
  const expected = { a: 1.2, b: 0.1, c: 0.2, d: 0.9, e: 20, f: -5 };
  const textmarken = [
    { text: 'Stimmzettel', x: 0, y: 0 },
    { text: 'GRÜNE', x: 100, y: 0 },
    { text: 'MERA25', x: 0, y: 100 },
    { text: 'Ehrhardt', x: 100, y: 100 },
  ];
  const words = textmarken.map(mark => wordAt(
    mark.text === 'GRÜNE' ? 'GRUNE,' : mark.text,
    transform(expected, mark),
  )).reverse();

  const { transformation, treffer } = determineTextTransformation(textmarken, words, {}, undefined);
  assert.equal(treffer.length, 4);
  for (const [name, value] of Object.entries(expected)) assert.ok(Math.abs(transformation[name] - value) < 1e-9, name);
});

test('bricht bei weniger als drei erkannten Textmarken ab', () => {
  const marks = [{ text: 'eins', x: 0, y: 0 }, { text: 'zwei', x: 1, y: 0 }, { text: 'drei', x: 0, y: 1 }];
  assert.throws(() => determineTextTransformation(marks, [wordAt('eins', { x: 2, y: 3 })], {}, undefined), /Textmarken/);
});

test('erkennt einen leicht gedrehten Zettel ueber gemockte OCR-Lagen', async () => {
  const image = await musterZettel();
  const typ = loadKalibrierung(readFileSync(new URL('../Kalibrierungen/bundestagswahl-2017.json', import.meta.url), 'utf8'));
  const angle = 2 * Math.PI / 180, cos = Math.cos(angle), sin = Math.sin(angle);
  const mx = image.width / 2, my = image.height / 2;
  const transformation = {
    a: cos, b: sin, c: -sin, d: cos,
    e: mx - mx * cos + my * sin,
    f: my - mx * sin - my * cos,
  };
  const words = typ.textmarken.map(mark => wordAt(`${mark.text},`, transform(transformation, mark)));
  const aufnahme = rotate(kreuzeAn(image, typ, ['E3', 'Z5']), 2);

  const result = await typ.recognize(aufnahme, { ocr: async () => words });
  assert.deepEqual(result.stimmen.map(stimme => stimme.treffer), [['E3'], ['Z5']]);
  assert.equal(result.textmarken.length, typ.textmarken.length);
});
