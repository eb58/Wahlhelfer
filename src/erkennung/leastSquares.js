/** Lineare Ausgleichsrechnung, gemeinsam genutzt von Ring- und Text-Feinjustierung. */

/** Loest ein nxn-Gleichungssystem per Gauss-Jordan mit Spaltenpivotisierung; undefined bei Singularitaet. */
export const solveLinear = (matrix, values) => {
  const n = values.length;
  const rows = matrix.map((row, i) => [...row, values[i]]);
  for (let col = 0; col < n; col++) {
    const pivot = [...Array(n - col).keys()]
      .map(offset => col + offset)
      .sort((a, b) => Math.abs(rows[b][col]) - Math.abs(rows[a][col]))[0];
    if (Math.abs(rows[pivot][col]) < 1e-8) return undefined;
    [rows[col], rows[pivot]] = [rows[pivot], rows[col]];
    const divisor = rows[col][col];
    rows[col] = rows[col].map(value => value / divisor);
    for (let row = 0; row < n; row++) {
      if (row === col) continue;
      const factor = rows[row][col];
      rows[row] = rows[row].map((value, i) => value - factor * rows[col][i]);
    }
  }
  return rows.map(row => row[n]);
};

/** Normalgleichungen AᵀA·p = Aᵀb fuer ueberbestimmte Systeme; je Gleichung `[koeffizienten, wert]`. */
const leastSquares = equations => {
  const n = equations[0][0].length;
  const ata = [...Array(n)].map(() => new Array(n).fill(0)), atb = new Array(n).fill(0);
  for (const [row, value] of equations)
    for (let i = 0; i < n; i++) {
      atb[i] += row[i] * value;
      for (let j = 0; j < n; j++) ata[i][j] += row[i] * row[j];
    }
  return solveLinear(ata, atb);
};

/**
 * Findet a,b,c mit dependent(point)[axis] ≈ a*x + b*y + c ueber alle Punkte, wobei {x,y} = independent(point).
 * undefined, wenn die Punkte nicht ausreichend verteilt liegen (singulaeres Gleichungssystem).
 */
export const regressPlane = (points, independent, dependent, axis) => leastSquares(points.map(point => {
  const { x, y } = independent(point);
  return [[x, y, 1], dependent(point)[axis]];
}));

/** Findet a,b mit dependent(point) ≈ a*independent(point) + b. */
export const regressLine = (points, independent, dependent) =>
  leastSquares(points.map(point => [[independent(point), 1], dependent(point)]));
