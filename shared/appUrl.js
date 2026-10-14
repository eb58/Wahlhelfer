/**
 * Pfad relativ zum App-Root (dort liegen php-api/, vendor/, Kalibrierungen/ und configuration.js).
 * Die Seiten liegen in Unterordnern und nennen den Weg zurueck mit `<html data-app-base="../">`.
 */
export const appUrl = path => `${globalThis.document?.documentElement.dataset.appBase ?? ''}${path.replace(/^\.\//, '')}`;
