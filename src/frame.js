/**
 * Bezugsrahmen des Stimmzettels: die durchgehenden Drucklinien.
 * Er macht Kalibrierung und Ankreuzerkennung unabhaengig von Bildgroesse und Bildausschnitt.
 */

const group = (positions, gap = 3) =>
  positions.reduce((groups, p) => {
    const last = groups.at(-1);
    if (last && p - last.at(-1) <= gap) last.push(p); else groups.push([p]);
    return groups;
  }, []).map(g => g.reduce((a, b) => a + b, 0) / g.length);

const lines = (length, across, count, minRatio) =>
  group([...Array(length).keys()].filter(i => count(i) >= across * minRatio));

/**
 * Sucht die aeusseren Senkrechten und die oberste/unterste waagerechte Tabellenlinie.
 * @returns {{left:number,right:number,top:number,bottom:number}|undefined}
 */
/**
 * `verticalRatio` bewusst deutlich unter 1: bei langen Streifenzetteln (Landtagswahl,
 * Europawahl) unterbrechen Kopf- und Fussbereich die Seitenlinien. Gemessen erreicht die
 * laengste Senkrechte dort nur 85 % der Bildhoehe. Zwischen 0,8 und 0,6 aendert sich am
 * gefundenen Rahmen aller Musterzettel nichts - der Wert ist also unkritisch.
 */
export const findFrame = ({ width, height, values }, { darkThreshold = 0.4, verticalRatio = 0.75, horizontalRatio = 0.6, edgeRatio = 0.02 } = {}) => {
  const dark = (x, y) => (values[y * width + x] > darkThreshold ? 1 : 0);
  const column = x => { let s = 0; for (let y = 0; y < height; y++) { s += dark(x, y); } return s; };
  const row = y => { let s = 0; for (let x = 0; x < width; x++) { s += dark(x, y); } return s; };

  // Ein dunkler Bildrand ist keine Drucklinie. Der Abstand waechst mit der Aufloesung mit,
  // damit dieselbe Aufnahme in jeder Groesse denselben Rahmen ergibt.
  const offEdge = (value, length) => value > length * edgeRatio && value < length * (1 - edgeRatio);

  const vertical = lines(width, height, column, verticalRatio).filter(x => offEdge(x, width));
  const horizontal = lines(height, width, row, horizontalRatio).filter(y => offEdge(y, height));

  return vertical.length >= 2 && horizontal.length >= 2
    ? { left: vertical[0], right: vertical.at(-1), top: horizontal[0], bottom: horizontal.at(-1) }
    : undefined;
};

export const toRelative = (frame, { x, y }) => ({
  x: (x - frame.left) / (frame.right - frame.left),
  y: (y - frame.top) / (frame.bottom - frame.top),
});

export const toAbsolute = (frame, { x, y }) => ({
  x: frame.left + x * (frame.right - frame.left),
  y: frame.top + y * (frame.bottom - frame.top),
});

export const frameWidth = frame => frame.right - frame.left;
