#!/usr/bin/env node
/**
 * Prueft die fuer den Commit vorgemerkten Textdateien: gueltiges UTF-8 und kein Mojibake
 * (doppelt kodierte Umlaute, etwa "\u00c3\u00bc" statt "\u00fc"). Laeuft im pre-commit-Hook (.githooks/).
 */
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const TEXT_FILE = /\.(js|mjs|json|md|html|css|php|sql|ps1|ya?ml|txt|xml)$/i;
// Als Escapes, damit diese Datei ihre eigene Pruefung besteht.
const MOJIBAKE = /\u00C3[\u0080-\u00BF]|\u00E2\u20AC|\u00C2[\u0080-\u00BF]|\uFFFD/;
const decoder = new TextDecoder('utf-8', { fatal: true });

/** @returns {string|undefined} Beschreibung des Problems, sonst undefined */
export const findEncodingProblem = bytes => {
  const text = (() => {
    try { return decoder.decode(bytes); } catch { return undefined; }
  })();
  if (text === undefined) return 'kein gueltiges UTF-8';
  const match = text.match(MOJIBAKE);
  if (!match) return undefined;
  const line = text.slice(0, match.index).split('\n').length;
  return `Mojibake in Zeile ${line}: "${match[0]}"`;
};

export const isTextFile = path => TEXT_FILE.test(path);

const stagedFiles = () => execFileSync('git', ['diff', '--cached', '--name-only', '--diff-filter=ACMR', '-z'], { encoding: 'utf8' })
  .split('\0')
  .filter(Boolean);

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const problems = stagedFiles()
    .filter(isTextFile)
    .map(path => ({ path, problem: findEncodingProblem(execFileSync('git', ['show', `:${path}`])) }))
    .filter(({ problem }) => problem);
  problems.forEach(({ path, problem }) => console.error(`${path}: ${problem}`));
  process.exitCode = problems.length ? 1 : 0;
}
