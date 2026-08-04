/** Lineare Ausgleichsrechnung, gemeinsam genutzt von Ring- und Text-Feinjustierung. */

/** Loest ein 3x3-Gleichungssystem per Gauss-Jordan mit Spaltenpivotisierung; undefined bei Singularitaet. */
export const solve3x3 = (matrix, values) => {
  const rows = matrix.map((row, i) => [...row, values[i]]);
  for (let col = 0; col < 3; col++) {
    const pivot = [...Array(3 - col).keys()]
      .map(offset => col + offset)
      .sort((a, b) => Math.abs(rows[b][col]) - Math.abs(rows[a][col]))[0];
    if (Math.abs(rows[pivot][col]) < 1e-8) return undefined;
    [rows[col], rows[pivot]] = [rows[pivot], rows[col]];
    const divisor = rows[col][col];
    rows[col] = rows[col].map(value => value / divisor);
    for (let row = 0; row < 3; row++) {
      if (row === col) continue;
      const factor = rows[row][col];
      rows[row] = rows[row].map((value, i) => value - factor * rows[col][i]);
    }
  }
  return rows.map(row => row[3]);
};

/**
 * Findet a,b,c mit dependent(point)[axis] ≈ a*x + b*y + c ueber alle Punkte, wobei {x,y} = independent(point).
 * undefined, wenn die Punkte nicht ausreichend verteilt liegen (singulaeres Gleichungssystem).
 */
export const regressPlane = (points, independent, dependent, axis) => {
  const sums = points.reduce((sum, point) => {
    const { x, y } = independent(point), z = dependent(point)[axis];
    return {
      xx: sum.xx + x * x, xy: sum.xy + x * y, yy: sum.yy + y * y,
      x: sum.x + x, y: sum.y + y,
      zx: sum.zx + z * x, zy: sum.zy + z * y, z: sum.z + z,
    };
  }, { xx: 0, xy: 0, yy: 0, x: 0, y: 0, zx: 0, zy: 0, z: 0 });
  return solve3x3(
    [[sums.xx, sums.xy, sums.x], [sums.xy, sums.yy, sums.y], [sums.x, sums.y, points.length]],
    [sums.zx, sums.zy, sums.z],
  );
};
