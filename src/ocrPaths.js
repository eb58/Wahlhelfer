/**
 * Speicherorte der Tesseract-Sprachdaten (nur Node: Tests und Admin-Skripte).
 *
 * Ohne `langPath` laedt tesseract.js die Sprachdatei beim ersten Lauf vom jsdelivr-CDN
 * und legt sie im aktuellen Arbeitsverzeichnis ab. Fuer ein Wahlwerkzeug ist beides
 * unerwuenscht: keine Downloads zur Laufzeit, keine Streudateien im Projekt.
 * Die Daten kommen deshalb aus dem Paket `@tesseract.js-data/deu`.
 *
 * Im Browser gilt dasselbe Prinzip mit einem lokal ausgelieferten Vendor-Verzeichnis
 * (siehe `scripts/mirrorTesseract.js`).
 */
import { createRequire } from 'node:module';
import { dirname } from 'node:path';

const require = createRequire(import.meta.url);

/** Verzeichnis mit `deu.traineddata.gz` - genau das erwartet tesseract.js als `langPath`. */
export const langDataPath = (lang = 'deu') =>
  dirname(require.resolve(`@tesseract.js-data/${lang}/4.0.0_best_int/${lang}.traineddata.gz`));

/**
 * OCR-Optionen fuer Node, die ohne Netzzugriff auskommen und nichts ins Projekt schreiben.
 * `cacheMethod: 'none'` ist noetig, weil tesseract.js die entpackte Sprachdatei sonst
 * zusaetzlich im Arbeitsverzeichnis ablegt - `langPath` allein verhindert das nicht.
 */
export const localOcrOptions = (lang = 'deu') => ({ lang, langPath: langDataPath(lang), cacheMethod: 'none' });
