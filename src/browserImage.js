/**
 * Bildbeschaffung im Browser: Datei oder Kameraaufnahme -> ImageData.
 * Das Gegenstueck zu png.js, das dieselbe Struktur in Node liefert.
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

const toBlobUrl = async canvas => {
  const blob = await (canvas.convertToBlob?.({ type: 'image/png' })
    ?? new Promise(done => canvas.toBlob(done, 'image/png')));
  return globalThis.URL.createObjectURL(blob);
};

/** Entfernt den gedruckten Aussenrahmen aus dem Bild, bevor Tesseract es sieht. */
const removeFrame = (context, { width, height }, frame) => {
  if (!frame) return;
  const band = Math.max(3, Math.round(Math.min(width, height) * 0.004));
  if (frame.corners) {
    const { topLeft, topRight, bottomRight, bottomLeft } = frame.corners;
    context.strokeStyle = '#fff';
    context.lineWidth = band * 2;
    context.beginPath();
    context.moveTo(topLeft.x, topLeft.y);
    context.lineTo(topRight.x, topRight.y);
    context.lineTo(bottomRight.x, bottomRight.y);
    context.lineTo(bottomLeft.x, bottomLeft.y);
    context.closePath();
    context.stroke();
    return;
  }
  context.fillStyle = '#fff';
  context.fillRect(Math.max(0, frame.left - band), 0, band * 2, height);
  context.fillRect(Math.max(0, frame.right - band), 0, band * 2, height);
  context.fillRect(0, Math.max(0, frame.top - band), width, band * 2);
  context.fillRect(0, Math.max(0, frame.bottom - band), width, band * 2);
};

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

/** Bilddaten als anzeigbare Bildquelle - fuer die Vorschau samt Markierungen. */
export const toImageUrl = async (imageData, frame) => {
  const canvas = createCanvas(imageData.width, imageData.height);
  const context = canvas.getContext('2d');
  context.putImageData(imageData, 0, 0);
  removeFrame(context, imageData, frame);
  return toBlobUrl(canvas);
};

/**
 * Setzt kleine, unverkleinerte Ausschnitte zu einem kompakten OCR-Bild zusammen.
 * `offsets` beschreibt, wo jeder Streifen im Ausgangsbild lag.
 */
export const toTextStripUrl = async (imageData, regions, frame) => {
  const source = createCanvas(imageData.width, imageData.height);
  const sourceContext = source.getContext('2d');
  sourceContext.putImageData(imageData, 0, 0);
  removeFrame(sourceContext, imageData, frame);
  const gap = 20;
  const canvasWidth = Math.max(...regions.map(region => region.width));
  const canvasHeight = regions.reduce((sum, region) => sum + region.height, 0) + gap * Math.max(0, regions.length - 1);
  const canvas = createCanvas(canvasWidth, canvasHeight);
  const context = canvas.getContext('2d');
  context.fillStyle = '#fff';
  context.fillRect(0, 0, canvasWidth, canvasHeight);
  const offsets = [];
  let top = 0;
  for (const region of regions) {
    context.drawImage(source, region.left, region.top, region.width, region.height, 0, top, region.width, region.height);
    offsets.push({ ...region, sourceTop: region.top, top });
    top += region.height + gap;
  }
  return { imageUrl: await toBlobUrl(canvas), offsets };
};
