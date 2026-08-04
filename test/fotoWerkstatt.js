import jpeg from 'jpeg-js';

/** JPEG-Puffer -> ImageData-kompatibles Objekt. */
export const readJpeg = buffer => {
  const { width, height, data } = jpeg.decode(buffer, { useTArray: true });
  return { width, height, data: new Uint8ClampedArray(data.buffer, data.byteOffset, data.byteLength) };
};

/** Entspricht der Breitenbegrenzung des Browsers fuer Smartphone-Aufnahmen. */
export const begrenzeBreite = (image, maxWidth = 1600) => {
  if (image.width <= maxWidth) return image;
  const factor = maxWidth / image.width;
  const width = maxWidth, height = Math.round(image.height * factor);
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const sourceX = Math.min(image.width - 1, Math.round(x / factor));
      const sourceY = Math.min(image.height - 1, Math.round(y / factor));
      const source = (sourceY * image.width + sourceX) * 4;
      data.set(image.data.subarray(source, source + 4), (y * width + x) * 4);
    }
  return { width, height, data };
};
