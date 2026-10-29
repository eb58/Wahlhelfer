/**
 * 500 fiktive Zettel fuer ein Wahllokal der eingestellten Wahl, ueber die normale PHP-API. Belege sind die
 * synthetischen Aufnahmen der Wahl (Wahlen/<wahl>/testdaten/synthetisch/), tatsaechlich erkannt und mehrfach
 * verwendet. Das Wahllokal (Standard 12518, sonst WAHLASSISTENT_WAHLLOKAL) muss noch leer sein; fehlt es, wird
 * es angelegt.
 */
import { readFileSync } from 'node:fs';
import { createHash, randomUUID } from 'node:crypto';
import { KALIBRIERUNG, WAHL } from '../configuration.js';
import { loadKalibrierung } from '../src/erfassungsplatz/erkennung/kalibrierung.js';
import { readImage } from '../test/fotoWerkstatt.js';

const root = new URL('../', import.meta.url);
// Standard: lokaler Docker-Container (compose.yaml).
const base = process.env.WAHLASSISTENT_URL ?? 'http://localhost:3000/';
const nummer = process.env.WAHLASSISTENT_WAHLLOKAL ?? '12518';
const { WAHLASSISTENT_USER: username, WAHLASSISTENT_PASSWORD: password } = process.env;
if (!username || !password) throw new Error('WAHLASSISTENT_USER und WAHLASSISTENT_PASSWORD eines Admin-Kontos setzen.');
let token = '';
const send = async (path, options = {}) => {
  const response = await fetch(new URL(`php-api/index.php/api/${path}`, base), { ...options, headers: { 'X-Auth-Token': token, ...options.headers } });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error);
  return result;
};
const api = (path, data, method = 'POST') => send(path, data === undefined ? {} : { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
token = (await api('session', { username, password })).token;
const existing = await api('wahllokale');
const vorhanden = existing.wahllokale.find(row => row.nummer === nummer);
if (vorhanden && (vorhanden.zettel || vorhanden.erwartet !== null))
  throw new Error(`Wahllokal ${nummer} hat schon Meldung oder Zettel. Keine Daten verändert.`);

// Aufgerichtet gespeicherte Aufnahmen; quer gespeicherte taugen nicht als Beleg.
const folder = new URL(`${WAHL}testdaten/synthetisch/`, root);
const manifest = JSON.parse(readFileSync(new URL('manifest.json', folder), 'utf8'));
const faelle = manifest.faelle.filter(row => !row.drehung && !row.todo);
const typ = loadKalibrierung(readFileSync(new URL(KALIBRIERUNG, root), 'utf8'));
const vorlagen = [];
for (const fall of faelle) {
  const bytes = readFileSync(new URL(fall.datei, folder));
  const type = fall.datei.endsWith('.png') ? 'image/png' : 'image/jpeg';
  const result = await typ.recognize(await readImage(bytes));
  const hash = createHash('sha256').update(bytes).digest('hex');
  await send(`bilder/${hash}`, { method: 'PUT', headers: { 'Content-Type': type }, body: bytes });
  vorlagen.push({ bild: { hash, type }, stimmen: result.stimmen.map(({ id, status, treffer }) => ({ id, status, wahlvorschlaege: treffer })) });
}
const klare = vorlagen.filter(row => row.stimmen.every(stimme => stimme.status === 'gueltig'));
const prueffaelle = vorlagen.filter(row => row.stimmen.some(stimme => stimme.status !== 'gueltig'));
if (!klare.length || !prueffaelle.length) throw new Error('Synthetische Vorlagen sind unvollständig.');
if (!vorhanden) await api('wahllokale', { nummer, name: `Fiktives Testwahllokal ${nummer} – synthetische Belege` });
await api(`wahllokale/${encodeURIComponent(nummer)}/stimmzettelzahl`, { erwartet: 500 }, 'PUT');
for (let index = 0; index < 25; index++) {
  const zettel = Array.from({ length: 20 }, (_, offset) => {
    const laufend = index * 20 + offset;
    const vorlage = laufend % 25 === 0 ? prueffaelle[(laufend / 25) % prueffaelle.length] : klare[(laufend * 7 + index) % klare.length];
    return { id: randomUUID(), ...vorlage };
  });
  await api('stapel', { id: randomUUID(), wahllokal: nummer, wahlHash: existing.wahlHash, soll: 20, zettel });
  console.log(`Stapel ${index + 1}/25 mit synthetischen Belegen gespeichert.`);
}
const result = (await api('ergebnisse')).wahllokale.find(row => row.nummer === nummer);
if (result.zettel !== 500 || result.stapel.length !== 25) throw new Error('Demo-Zählabgleich fehlgeschlagen.');
console.log(JSON.stringify({ wahllokal: result.nummer, zettel: result.zettel, stapel: result.stapel.length, prueffaelle: result.prueffaelle,
  stimmen: result.stimmen.map(({ name, gueltig, leer, mehrfach, zweifelsfall }) => ({ name, gueltig, leer, mehrfach, zweifelsfall })) }));
