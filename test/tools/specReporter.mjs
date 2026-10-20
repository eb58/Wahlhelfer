/**
 * Der eingebaute spec-Reporter, nur auf ganze Millisekunden gerundet: "(63.4847ms)" wird zu "(63 ms)",
 * "duration_ms 8564.3552" zu "duration_ms 8564". Aufruf: node --test --test-reporter=./test/tools/specReporter.mjs
 */
import { Readable } from 'node:stream';
import { spec } from 'node:test/reporters';

export const rundeZeiten = text => text
  .replace(/\((\d+(?:\.\d+)?)ms\)/g, (_, ms) => `(${Math.round(ms)} ms)`)
  .replace(/duration_ms (\d+\.\d+)/g, (_, ms) => `duration_ms ${Math.round(ms)}`);

export default async function* specMitGanzenMillisekunden(source) {
  for await (const chunk of Readable.from(source).pipe(new spec())) yield rundeZeiten(String(chunk));
}
