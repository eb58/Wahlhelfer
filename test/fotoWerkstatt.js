import sharp from 'sharp';
import { BELEG_QUALITY, MAX_WIDTH } from '../src/erfassungsplatz/browserImage.js';

/**
 * Bilddatei (PNG, JPEG, ...) -> ImageData-kompatibles Objekt, wie es im Browser `getImageData()`
 * liefert: 8 Bit RGBA. Der Node-Weg fuer Tests und Skripte; die Erkennung selbst liest keine Dateien.
 */
export const readImage = async buffer => {
  const { data, info } = await sharp(buffer).toColourspace('srgb').ensureAlpha().raw({ depth: 'uchar' })
    .toBuffer({ resolveWithObject: true });
  return { width: info.width, height: info.height, data: new Uint8ClampedArray(data.buffer, data.byteOffset, data.byteLength) };
};

/** ImageData-kompatibles Objekt -> PNG-Datei. */
export const writePng = ({ width, height, data }) =>
  sharp(Buffer.from(data.buffer, data.byteOffset, data.byteLength), { raw: { width, height, channels: 4 } }).png().toBuffer();

/**
 * Foto (JPEG) -> ImageData-kompatibles Objekt auf dem Weg, den der Browser geht (browserImage.js):
 * auf hoechstens `maxWidth` Pixel Breite verkleinern, als Beleg-JPEG kodieren und dieses Beleg-JPEG
 * erkennen. So pruefen die Fototests, dass der gespeicherte Beleg die Wertung reproduziert.
 * `rotation` dreht vorher um Vierteldrehungen im Uhrzeigersinn, wie toBeleg() fuer quer gespeicherte Fotos.
 * sharp dekodiert nativ; ein 12-Megapixel-Foto in reinem JavaScript zu entpacken kostete die
 * Fototests den Grossteil ihrer Zeit.
 */
export const readFoto = async (buffer, { maxWidth = MAX_WIDTH, quality = BELEG_QUALITY, rotation = 0 } = {}) => {
  const beleg = await sharp(buffer)
    .rotate(rotation * 90)
    .resize({ width: maxWidth, withoutEnlargement: true, kernel: 'linear' })
    .jpeg({ quality: Math.round(quality * 100) })
    .toBuffer();
  return readImage(beleg);
};
