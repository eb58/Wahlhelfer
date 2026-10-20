/**
 * Bildbeschaffung im Browser: Datei oder Kameraaufnahme -> ImageData.
 * Das Gegenstueck zu readImage() in test/fotoWerkstatt.js, das dieselbe Struktur in Node liefert.
 */

/**
 * Sehr grosse Aufnahmen kosten nur Rechenzeit; die Ankreuzerkennung braucht sie nicht.
 * Begrenzt wird bewusst die kuerzere Kante und nicht die laengste: die Groesse eines
 * Ankreuzfelds haengt an der Zettelbreite. Ein sehr langer Zettel (Europawahl) wuerde
 * ueber die laengste Kante so stark verkleinert, dass die Kreise zu klein zum Messen waeren.
 * Bei hochkant gespeicherten Fotos ist das die Breite; ein quer gespeichertes Foto bleibt so gross
 * genug, um seine Lage zu erkennen, und der aufgerichtete Beleg ist wieder MAX_WIDTH breit.
 */
export const MAX_WIDTH = 1600;

/** Groesse des Belegs: kuerzere Kante hoechstens MAX_WIDTH, nie vergroessert. */
export const belegSize = (width, height) => {
  const factor = Math.min(1, MAX_WIDTH / Math.min(width, height));
  return { width: Math.round(width * factor), height: Math.round(height * factor) };
};

/** JPEG-Qualitaet des Belegs; die Fototests erkennen genau dieses Beleg-JPEG. */
export const BELEG_QUALITY = 0.85;

const createCanvas = (width, height) =>
  typeof OffscreenCanvas === 'function'
    ? new OffscreenCanvas(width, height)
    : Object.assign(document.createElement('canvas'), { width, height });

/**
 * Zeichnet Datei, Blob oder ImageData in Belegsgroesse (`belegSize`), auf Wunsch um `rotation`
 * Vierteldrehungen im Uhrzeigersinn gedreht.
 */
const drawScaled = async (source, rotation = 0) => {
  const bitmap = await createImageBitmap(source);
  try {
    const swap = rotation % 2 === 1;
    const [sourceWidth, sourceHeight] = swap ? [bitmap.height, bitmap.width] : [bitmap.width, bitmap.height];
    const { width, height } = belegSize(sourceWidth, sourceHeight);
    const canvas = createCanvas(width, height);
    const context = canvas.getContext('2d', { willReadFrequently: true });
    // Papierweiss als Untergrund: sonst kaemen durchsichtige Bildbereiche als Schwarz an.
    context.fillStyle = '#fff';
    context.fillRect(0, 0, width, height);
    context.translate(width / 2, height / 2);
    context.rotate((rotation * Math.PI) / 2);
    const [drawWidth, drawHeight] = swap ? [height, width] : [width, height];
    context.drawImage(bitmap, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);
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
 * Der Beleg: die Aufnahme auf `belegSize` verkleinert als JPEG. Erkannt und gespeichert wird genau
 * dieses Bild - so laesst sich die Wertung aus dem Beleg reproduzieren, und ein Handyfoto
 * schrumpft von rund 3 MB auf rund 0,5 MB.
 * @param {Blob} source Kameraaufnahme oder Bilddatei
 * @param {number} rotation Vierteldrehungen im Uhrzeigersinn, fuer quer gespeicherte Aufnahmen
 */
export const toBeleg = async (source, rotation = 0) => {
  const { canvas } = await drawScaled(source, rotation);
  return canvas.convertToBlob?.({ type: 'image/jpeg', quality: BELEG_QUALITY })
    ?? new Promise(done => canvas.toBlob(done, 'image/jpeg', BELEG_QUALITY));
};
