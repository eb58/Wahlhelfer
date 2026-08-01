/**
 * Bildbeschaffung im Browser: Datei oder Kameraaufnahme -> ImageData.
 * Das Gegenstueck zu png.js, das dieselbe Struktur in Node liefert.
 */

/** Sehr grosse Aufnahmen kosten nur Rechenzeit; die Ankreuzerkennung braucht sie nicht. */
export const MAX_EDGE = 2000;

const createCanvas = (width, height) =>
  typeof OffscreenCanvas === 'function'
    ? new OffscreenCanvas(width, height)
    : Object.assign(document.createElement('canvas'), { width, height });

/**
 * @param {Blob|File} file Aufnahme aus Kamera oder Dateiauswahl
 * @returns {Promise<{width:number,height:number,data:Uint8ClampedArray}>}
 */
export const toImageData = async file => {
  const bitmap = await createImageBitmap(file);
  try {
    const factor = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    const width = Math.round(bitmap.width * factor), height = Math.round(bitmap.height * factor);
    const canvas = createCanvas(width, height);
    const context = canvas.getContext('2d', { willReadFrequently: true });
    // Papierweiss als Untergrund: sonst kaemen durchsichtige Bildbereiche als Schwarz an.
    context.fillStyle = '#fff';
    context.fillRect(0, 0, width, height);
    context.drawImage(bitmap, 0, 0, width, height);
    return context.getImageData(0, 0, width, height);
  } finally {
    bitmap.close?.();
  }
};

/**
 * Vergroesserte Fassung fuer die Texterkennung: tesseract liest kleine Schrift sonst schlecht.
 * Rueckgabe ist bewusst ein Canvas-Element - rohe ImageData nimmt tesseract.js nicht an.
 * Die Ankreuzerkennung selbst arbeitet weiter im Originalmassstab.
 */
export const scaleToCanvas = (imageData, factor) => {
  const source = createCanvas(imageData.width, imageData.height);
  source.getContext('2d').putImageData(imageData, 0, 0);

  const target = document.createElement('canvas');
  target.width = imageData.width * factor;
  target.height = imageData.height * factor;
  target.getContext('2d').drawImage(source, 0, 0, target.width, target.height);
  return target;
};

/** Bilddaten als anzeigbare Bildquelle - fuer die Vorschau samt Markierungen. */
export const toImageUrl = async imageData => {
  const canvas = createCanvas(imageData.width, imageData.height);
  canvas.getContext('2d').putImageData(imageData, 0, 0);
  const blob = await (canvas.convertToBlob?.({ type: 'image/png' })
    ?? new Promise(done => canvas.toBlob(done, 'image/png')));
  return URL.createObjectURL(blob);
};
