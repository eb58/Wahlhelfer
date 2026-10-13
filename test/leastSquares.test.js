import test from 'node:test';
import assert from 'node:assert/strict';
import { regressLine, regressPlane, solveLinear } from '../src/leastSquares.js';

test('solveLinear loest Gleichungssysteme beliebiger Groesse und erkennt Singularitaet', () => {
  assert.deepEqual(solveLinear([[2, 0], [0, 4]], [2, 8]), [1, 2]);
  assert.equal(solveLinear([[1, 2], [2, 4]], [1, 2]), undefined);
});

test('regressLine und regressPlane finden exakte Zusammenhaenge wieder', () => {
  const [a, b] = regressLine([0, 1, 2, 3].map(x => ({ x, y: 3 * x - 2 })), p => p.x, p => p.y);
  assert.ok(Math.abs(a - 3) < 1e-9 && Math.abs(b + 2) < 1e-9);
  const points = [[0, 0], [1, 0], [0, 1], [2, 3]].map(([x, y]) => ({ source: { x, y }, target: { x: 2 * x - y + 5 } }));
  const plane = regressPlane(points, p => p.source, p => p.target, 'x');
  [2, -1, 5].forEach((value, i) => assert.ok(Math.abs(plane[i] - value) < 1e-9));
});
