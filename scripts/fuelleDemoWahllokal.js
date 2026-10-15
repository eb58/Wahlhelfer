/** 500 fiktive Zettel mit passenden synthetischen Belegbildern, ueber die normale PHP-API. */
import { readFileSync } from 'node:fs';
import { createHash, randomUUID } from 'node:crypto';
import { KALIBRIERUNG } from '../configuration.js';
import { loadKalibrierung } from '../erfassungsplatz/erkennung/kalibrierung.js';
import { readImage } from '../test/fotoWerkstatt.js';

const root = new URL('../', import.meta.url);
if (!KALIBRIERUNG.endsWith('/bundestagswahl-2017.json')) throw new Error('Demo benötigt den vorhandenen Bundestags-Musterzettel.');
// Standard: lokaler Docker-Container (compose.yaml).
const base = process.env.WAHLASSISTENT_URL ?? 'http://localhost:3000/';
const { WAHLASSISTENT_USER: username, WAHLASSISTENT_PASSWORD: password } = process.env;
if (!username || !password) throw new Error('WAHLASSISTENT_USER und WAHLASSISTENT_PASSWORD eines Admin-Kontos setzen.');
let token = '';
const send = async (path, options = {}) => {
  const response = await fetch(new URL(`php-api/index.php/api/${path}`, base), { ...options, headers: { 'X-Auth-Token': token, ...options.headers } });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error);
  return result;
};
const api = (path, data) => send(path, data === undefined ? {} : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
token = (await api('session', { username, password })).token;
const existing = await api('wahllokale');
if (existing.wahllokale.some(row => row.nummer === '518')) throw new Error('Wahllokal 518 existiert bereits. Keine Daten verändert.');
const folder = new URL('Testdaten/bundestagswahl-2017/scans/', root);
const manifest = JSON.parse(readFileSync(new URL('manifest.json', folder), 'utf8'));
const faelle = manifest.faelle.filter(row => row.kategorie.startsWith('gueltig-') || ['leer', 'mehrfach', 'qualitaet'].includes(row.kategorie.split('-')[0]));
const typ = loadKalibrierung(readFileSync(new URL(KALIBRIERUNG, root), 'utf8'));
const vorlagen = [];
for (const fall of faelle) {
  const bytes = readFileSync(new URL(fall.datei, folder));
  const result = await typ.recognize(await readImage(bytes));
  const hash = createHash('sha256').update(bytes).digest('hex');
  await send(`bilder/${hash}`, { method: 'PUT', headers: { 'Content-Type': 'image/png' }, body: bytes });
  vorlagen.push({ bild: { hash, type: 'image/png' },
    stimmen: result.stimmen.map(({ id, status, treffer }) => ({ id, status, wahlvorschlaege: treffer })) });
}
const klare = vorlagen.filter(row => row.stimmen.every(stimme => stimme.status === 'gueltig'));
const prueffaelle = vorlagen.filter(row => row.stimmen.some(stimme => stimme.status !== 'gueltig'));
if (!klare.length || !prueffaelle.length) throw new Error('Synthetische Vorlagen sind unvollständig.');
const lokal = await api('wahllokale', { nummer: '518', name: 'Fiktives Testwahllokal 518 – synthetische Belege', erwartet: 500 });
for (let index = 0; index < 25; index++) {
  const zettel = Array.from({ length: 20 }, (_, offset) => {
    const nummer = index * 20 + offset;
    const vorlage = nummer % 25 === 0 ? prueffaelle[(nummer / 25) % prueffaelle.length] : klare[(nummer * 7 + index) % klare.length];
    return { id: randomUUID(), ...vorlage };
  });
  await api('stapel', { id: randomUUID(), wahllokal: lokal.nummer, wahlHash: existing.wahlHash, soll: 20, zettel });
  console.log(`Stapel ${index + 1}/25 mit Originaldateien der synthetischen Vorlagen gespeichert.`);
}
const result = (await api('ergebnisse')).wahllokale.find(row => row.nummer === lokal.nummer);
if (result.zettel !== 500 || result.stapel.length !== 25) throw new Error('Demo-Zählabgleich fehlgeschlagen.');
console.log(JSON.stringify({ wahllokal: result.nummer, zettel: result.zettel, stapel: result.stapel.length, prueffaelle: result.prueffaelle,
  stimmen: result.stimmen.map(({ name, gueltig, leer, mehrfach, zweifelsfall }) => ({ name, gueltig, leer, mehrfach, zweifelsfall })) }));
