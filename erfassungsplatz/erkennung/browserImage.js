/**
 * Bildbeschaffung im Browser: Datei oder Kameraaufnahme -> ImageData.
 * Das Gegenstueck zu readImage() in test/fotoWerkstatt.js, das dieselbe Struktur in Node liefert.
 */

/**
 * Sehr grosse Aufnahmen kosten nur Rechenzeit; die Ankreuzerkennung braucht sie nicht.
 * Begrenzt wird bewusst die Breite und nicht die laengste Kante: die Groesse eines
 * Ankreuzfelds haengt an der Zettelbreite. Ein sehr langer Zettel (Europawahl) wuerde
 * ueber die laengste Kante so stark verkleinert, dass die Kreise zu klein zum Messen waeren.
 */
export const MAX_WIDTH = 1600;

/** JPEG-Qualitaet des Belegs; die Fototests erkennen genau dieses Beleg-JPEG. */
export const BELEG_QUALITY = 0.85;

const createCanvas = (width, height) =>
  typeof OffscreenCanvas === 'function'
    ? new OffscreenCanvas(width, height)
    : Object.assign(document.createElement('canvas'), { width, height });

/** Zeichnet Datei, Blob oder ImageData auf hoechstens MAX_WIDTH Pixel Breite. */
const drawScaled = async source => {
  const bitmap = await createImageBitmap(source);
  try {
    const factor = Math.min(1, MAX_WIDTH / bitmap.width);
    const width = Math.round(bitmap.width * factor), height = Math.round(bitmap.height * factor);
    const canvas = createCanvas(width, height);
    const context = canvas.getContext('2d', { willReadFrequently: true });
    // Papierweiss als Untergrund: sonst kaemen durchsichtige Bildbereiche als Schwarz an.
    context.fillStyle = '#fff';
    context.fillRect(0, 0, width, height);
    context.drawImage(bitmap, 0, 0, width, height);
    return { canvas, context, width, height };
  } finally {
    bitmap.close?.();
  }
};

/**
 * @param {Blob|File} file Aufnahme aus Kamera oder Dateiauswahl
 * @returns {Promise<{width:number,height:number,data:Uint8ClampedArray}>}
 */
export const toImageData = async file => {
  const { context, width, height } = await drawScaled(file);
  return context.getImageData(0, 0, width, height);
};

/**
 * Der Beleg: die Aufnahme auf MAX_WIDTH verkleinert als JPEG. Erkannt und gespeichert wird genau
 * dieses Bild - so laesst sich die Wertung aus dem Beleg reproduzieren, und ein Handyfoto
 * schrumpft von rund 3 MB auf rund 0,5 MB.
 * @param {Blob|ImageData} source Kameraaufnahme, Bilddatei oder gerenderte PDF-Seite
 */
export const toBeleg = async source => {
  const { canvas } = await drawScaled(source);
  return canvas.convertToBlob?.({ type: 'image/jpeg', quality: BELEG_QUALITY })
    ?? new Promise(done => canvas.toBlob(done, 'image/jpeg', BELEG_QUALITY));
};
