import test from 'node:test';
import assert from 'node:assert/strict';
import { rotateImage } from '../src/erfassungsplatz/erkennung/image.js';

// 3x2-Bild, jedes Pixel traegt seine Nummer im Rotkanal: 0 1 2 / 3 4 5
const bild = { width: 3, height: 2, data: new Uint8ClampedArray([0, 1, 2, 3, 4, 5].flatMap(n => [n, 0, 0, 255])) };
const pixel = ({ width, height, data }) => ({ width, height, rot: Array.from({ length: width * height }, (_, i) => data[i * 4]) });

test('rotateImage dreht in Vierteldrehungen im Uhrzeigersinn', () => {
  assert.deepEqual(pixel(rotateImage(bild, 0)), { width: 3, height: 2, rot: [0, 1, 2, 3, 4, 5] });
  assert.deepEqual(pixel(rotateImage(bild, 1)), { width: 2, height: 3, rot: [3, 0, 4, 1, 5, 2] });
  assert.deepEqual(pixel(rotateImage(bild, 2)), { width: 3, height: 2, rot: [5, 4, 3, 2, 1, 0] });
  assert.deepEqual(pixel(rotateImage(bild, 3)), { width: 2, height: 3, rot: [2, 5, 1, 4, 0, 3] });
  assert.deepEqual(pixel(rotateImage(rotateImage(bild, 1), 3)), pixel(bild));
});
