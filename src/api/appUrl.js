/** Pfad zum App-Root (php-api/, Wahlen/): beide Seiten liegen genau eine Ebene darunter. */
export const appUrl = path => `../${path.replace(/^\.\//, '')}`;
