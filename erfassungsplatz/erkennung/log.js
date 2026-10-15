/**
 * Ablaufprotokoll mit festem Praefix, damit sich die Zeilen in der Konsole filtern lassen.
 *
 * Standardmaessig aus: die Tests sollen still bleiben. Eingeschaltet wird dort, wo jemand
 * zusieht - in erfassungsplatz/main.js fuer den Browser und in den Admin-Skripten. Nie in Pixelschleifen
 * verwenden, sondern nur an Entscheidungspunkten des Ablaufs.
 */
let enabled = false;

export const setLogging = on => { enabled = on; };

export const log = (...args) => { if (enabled) console.log('[Wahl]', ...args); };

/** Zahlen im Protokoll kurz halten - drei Nachkommastellen sagen hier nichts mehr. */
export const round = value => Math.round(value * 100) / 100;

export const now = () => globalThis.performance?.now?.() ?? Date.now();

/** Protokolliert die Dauer eines Schritts seit `start` (aus `now()`). */
export const logDuration = (text, start) => log(`${text}: ${round(now() - start)} ms`);
