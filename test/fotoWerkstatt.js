import sharp from 'sharp';
import { BELEG_QUALITY, MAX_WIDTH } from '../erfassungsplatz/erkennung/browserImage.js';

/**
 * Foto (JPEG) -> ImageData-kompatibles Objekt auf dem Weg, den der Browser geht (browserImage.js):
 * auf hoechstens `maxWidth` Pixel Breite verkleinern, als Beleg-JPEG kodieren und dieses Beleg-JPEG
 * erkennen. So pruefen die Fototests, dass der gespeicherte Beleg die Wertung reproduziert.
 * sharp dekodiert nativ; ein 12-Megapixel-Foto in reinem JavaScript zu entpacken kostete die
 * Fototests den Grossteil ihrer Zeit.
 */
export const readFoto = async (buffer, { maxWidth = MAX_WIDTH, quality = BELEG_QUALITY } = {}) => {
  const beleg = await sharp(buffer)
    .resize({ width: maxWidth, withoutEnlargement: true, kernel: 'linear' })
    .jpeg({ quality: Math.round(quality * 100) })
    .toBuffer();
  const { data, info } = await sharp(beleg).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { width: info.width, height: info.height, data: new Uint8ClampedArray(data.buffer, data.byteOffset, data.byteLength) };
};
