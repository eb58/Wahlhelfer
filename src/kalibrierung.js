/**
 * Kalibrierung: aus einem leeren Musterzettel die Lage der Ankreuzfelder lernen.
 * Ergebnis sind rahmenrelative Koordinaten - unabhaengig von Aufloesung und Bildausschnitt.
 */
import { toDarkness, downscale, ringDarkness, areaDarkness, darkRatio } from './image.js';
import { findFrame, toRelative, frameWidth } from './frame.js';
import { log, round } from './log.js';

/** Innenradius, auf dem der Fuellgrad gemessen wird - haelt Abstand zum gedruckten Ring. */
export const innerRadius = radius => Math.max(2, Math.round(radius * 0.68));

/**
 * Feinjustierung: das Ankreuzfeld im kleinen Umkreis auf den gedruckten Ring einrasten lassen.
 * Bewertet wird nur der Ring, nicht das Innere - sonst wuerde ein Kreuz die Suche stoeren.
 * Der Suchradius bleibt klein genug, dass nicht auf das Nachbarfeld gesprungen wird.
 */
export const adjustFeld = (map, x, y, radius, ratio = 0.5) => {
  const span = Math.round(radius * ratio);
  let best = { x, y, score: ringDarkness(map, x, y, radius) };
  for (let dy = -span; dy <= span; dy++)
    for (let dx = -span; dx <= span; dx++) {
      const score = ringDarkness(map, x + dx, y + dy, radius);
      if (score > best.score) best = { x: x + dx, y: y + dy, score };
    }
  return best;
};

/**
 * Ringsuche: bewertet jeden Punkt als "dunkler Ring um helle Flaeche".
 * Bewusst einfach gehalten (KISS) statt vollstaendiger Hough-Transformation.
 */
export const findCircles = (map, { minRadius = 6, maxRadius = 20, minScore = 0.5 } = {}) => {
  const { width, height } = map, candidates = [];
  for (let r = minRadius; r <= maxRadius; r++)
    for (let y = r + 1; y < height - r - 1; y++)
      for (let x = r + 1; x < width - r - 1; x++) {
        const score = ringDarkness(map, x, y, r) - areaDarkness(map, x, y, innerRadius(r));
        if (score > minScore) candidates.push({ x, y, r, score });
      }

  candidates.sort((a, b) => b.score - a.score);
  return candidates.reduce((kept, c) =>
    kept.some(k => (k.x - c.x) ** 2 + (k.y - c.y) ** 2 < (k.r + c.r) ** 2 * 0.5) ? kept : [...kept, c], []);
};

/** Kreise mit der haeufigsten Groesse behalten - Ankreuzfelder sind untereinander gleich gross. */
const mostCommonRadius = circles =>
  Number([...circles.reduce((counter, c) => counter.set(c.r, (counter.get(c.r) ?? 0) + 1), new Map())]
    .sort((a, b) => b[1] - a[1] || b[0] - a[0])[0][0]);

/** Kreise zu senkrechten Spalten buendeln; zu kleine Spalten sind Stoerer (z. B. Kopfzeilen-Symbole). */
const toColumns = (circles, tolerance, minFelder) =>
  [...circles].sort((a, b) => a.x - b.x)
    .reduce((columns, c) => {
      const last = columns.at(-1);
      if (last && c.x - last.at(-1).x <= tolerance) last.push(c); else columns.push([c]);
      return columns;
    }, [])
    .filter(s => s.length >= minFelder)
    .map(s => [...s].sort((a, b) => a.y - b.y));

const stimmNamen = ['erststimme', 'zweitstimme'];
const kuerzel = { erststimme: 'E', zweitstimme: 'Z' };

/**
 * Erzeugt die Kalibrierung aus einem leeren Musterzettel.
 * @param {{width:number,height:number,data:Uint8ClampedArray}} image
 */
export const kalibriere = (image, { minFelder = 3, columnTolerance = 12, workWidth = 640, maxLeerFuellgrad = 0.15, ...options } = {}) => {
  const map = toDarkness(image);

  // Die Ringsuche arbeitet mit festen Pixelradien und kostet O(Pixel x Radien x r^2).
  // Deshalb wird auf eine einheitliche Arbeitsbreite verkleinert gesucht: ein Ankreuzkreis
  // ist damit unabhaengig von der Aufnahmeaufloesung immer gleich gross. Gemessen wird
  // anschliessend wieder im Originalbild.
  const factor = Math.max(1, Math.round(map.width / workWidth));
  const search = downscale(map, factor);
  const toFull = ({ x, y, r, ...rest }) => ({ ...rest, x: x * factor + (factor - 1) / 2, y: y * factor + (factor - 1) / 2, r: r * factor });

  const searchFrame = findFrame(search, options);
  if (!searchFrame) throw new Error('Kein Zettelrahmen erkannt - Aufnahme zeigt den Stimmzettel nicht vollstaendig.');
  const frame = Object.fromEntries(Object.entries(searchFrame).map(([k, v]) => [k, v * factor]));

  const all = findCircles(search, options).map(toFull);
  if (!all.length) throw new Error('Keine Ankreuzfelder erkannt.');

  const radius = mostCommonRadius(all);
  // Ein Musterzettel ist per Definition leer: seine Ankreuzfelder sind unausgefuellt.
  // Ein bereits gefuellter Kreis ist deshalb kein Feld, sondern ein gedrucktes Symbol -
  // etwa der Hinweis-Kreuzkreis in der Kopfzeile. Das trennt zuverlaessiger als die Lage
  // im Blatt, die vom Bildausschnitt abhaengt.
  // Die Radiustoleranz ist in Suchpixeln gedacht und waechst mit dem Verkleinerungsfaktor mit.
  const inTable = all.filter(c =>
    Math.abs(c.r - radius) <= factor && darkRatio(map, c.x, c.y, innerRadius(radius)) < maxLeerFuellgrad);
  log(`Kalibrierung: Rahmen x ${round(frame.left)}..${round(frame.right)}, y ${round(frame.top)}..${round(frame.bottom)}`);
  log(`Kalibrierung: ${all.length} Kreise gefunden, Radius ${radius}, davon ${inTable.length} in der Tabelle`);

  const columns = toColumns(inTable, columnTolerance * factor, minFelder);
  if (columns.length < 2) throw new Error(`Erwartet werden zwei Stimmenspalten, erkannt: ${columns.length}.`);

  const felder = columns.slice(0, 2).flatMap((column, s) =>
    column.map((c, i) => ({
      id: `${kuerzel[stimmNamen[s]]}${i + 1}`,
      stimme: stimmNamen[s],
      position: i + 1,
      ...toRelative(frame, c),
      // Zusaetzlich die Lage im Musterzettel selbst: darauf setzt die Ausrichtung
      // ueber Ankerwoerter auf, die auch schraege Aufnahmen vertraegt.
      refX: c.x,
      refY: c.y,
      leerFuellgrad: darkRatio(map, c.x, c.y, innerRadius(radius)),
    })));

  log(`Kalibrierung: ${columns.length} Spalten, ${felder.length} Ankreuzfelder `
    + `(${columns.slice(0, 2).map(s => s.length).join(' + ')})`);

  return {
    radius: radius / frameWidth(frame),
    radiusRef: radius,
    reference: { width: map.width, height: map.height },
    felder,
    frame,
  };
};
