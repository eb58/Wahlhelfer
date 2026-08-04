import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { determineTextTransformation, transform } from '../src/textJustierung.js';
import { ladeKalibrierung } from '../src/kalibrierung.js';
import { computeOcrRegions } from '../src/ocrRegions.js';
import { musterZettel, kreuzeAn, rotate } from './zettelWerkstatt.js';

const wortBei = (text, { x, y }) => ({ text, confidence: 95, bbox: { x0: x - 5, y0: y - 4, x1: x + 5, y1: y + 4 } });

test('OCR-Bereiche decken die Textmarken ab und bleiben klein', () => {
  const typ = ladeKalibrierung(readFileSync(new URL('../Kalibrierungen/europawahl-sh-2024.json', import.meta.url), 'utf8'));
  const image = { width: 1241, height: 4819 };
  const bereiche = computeOcrRegions(typ, image, typ.frame);
  assert.equal(bereiche.length, typ.textmarken.length);
  assert.ok(bereiche.every(bereich => bereich.left >= 0 && bereich.top >= 0
    && bereich.left + bereich.width <= image.width && bereich.top + bereich.height <= image.height));
  assert.ok(bereiche.reduce((summe, bereich) => summe + bereich.width * bereich.height, 0) < image.width * image.height / 8);
});

test('bestimmt eine affine Transformation aus OCR-Wortlagen', () => {
  const erwartet = { a: 1.2, b: 0.1, c: 0.2, d: 0.9, e: 20, f: -5 };
  const textmarken = [
    { text: 'Stimmzettel', x: 0, y: 0 },
    { text: 'GRÜNE', x: 100, y: 0 },
    { text: 'MERA25', x: 0, y: 100 },
    { text: 'Ehrhardt', x: 100, y: 100 },
  ];
  const woerter = textmarken.map(marke => wortBei(
    marke.text === 'GRÜNE' ? 'GRUNE,' : marke.text,
    transform(erwartet, marke),
  )).reverse();

  const { transformation, treffer } = determineTextTransformation(textmarken, woerter, {}, undefined);
  assert.equal(treffer.length, 4);
  for (const [name, wert] of Object.entries(erwartet)) assert.ok(Math.abs(transformation[name] - wert) < 1e-9, name);
});

test('bricht bei weniger als drei erkannten Textmarken ab', () => {
  const marken = [{ text: 'eins', x: 0, y: 0 }, { text: 'zwei', x: 1, y: 0 }, { text: 'drei', x: 0, y: 1 }];
  assert.throws(() => determineTextTransformation(marken, [wortBei('eins', { x: 2, y: 3 })], {}, undefined), /Textmarken/);
});

test('erkennt einen leicht gedrehten Zettel ueber gemockte OCR-Lagen', async () => {
  const image = musterZettel();
  const typ = ladeKalibrierung(readFileSync(new URL('../Kalibrierungen/bundestagswahl-2017-muster.json', import.meta.url), 'utf8'));
  const winkel = 2 * Math.PI / 180, cos = Math.cos(winkel), sin = Math.sin(winkel);
  const mx = image.width / 2, my = image.height / 2;
  const transformation = {
    a: cos, b: sin, c: -sin, d: cos,
    e: mx - mx * cos + my * sin,
    f: my - mx * sin - my * cos,
  };
  const woerter = typ.textmarken.map(marke => wortBei(`${marke.text},`, transform(transformation, marke)));
  const aufnahme = rotate(kreuzeAn(image, typ, ['E3', 'Z5']), 2);

  const ergebnis = await typ.recognize(aufnahme, { ocr: async () => woerter });
  assert.deepEqual(ergebnis.stimmen.map(stimme => stimme.treffer), [['E3'], ['Z5']]);
  assert.equal(ergebnis.textmarken.length, typ.textmarken.length);
});
