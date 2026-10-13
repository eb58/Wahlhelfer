import sharp from 'sharp';

/**
 * Foto (JPEG) -> ImageData-kompatibles Objekt, auf hoechstens `maxWidth` Pixel Breite verkleinert -
 * wie im Browser (browserImage.js: Breite begrenzen, geglaettet zeichnen). sharp dekodiert nativ;
 * ein 12-Megapixel-Foto in reinem JavaScript zu entpacken kostete die Fototests den Grossteil ihrer Zeit.
 */
export const readFoto = async (buffer, maxWidth = 1600) => {
  const { data, info } = await sharp(buffer)
    .resize({ width: maxWidth, withoutEnlargement: true, kernel: 'linear' })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { width: info.width, height: info.height, data: new Uint8ClampedArray(data.buffer, data.byteOffset, data.byteLength) };
};
