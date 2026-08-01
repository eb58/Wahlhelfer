/**
 * PNG-Ein- und Ausgabe fuer Node (Tests, Admin-Skripte).
 * Im Browser liefert stattdessen `canvas.getContext('2d').getImageData(...)` dieselbe Struktur.
 */
import { inflateSync, deflateSync } from 'node:zlib';

const channels = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 };

const paeth = (a, b, c) => {
  const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
};

const unfilter = (raw, width, height, bpp) => {
  const stride = width * bpp, out = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y++) {
    const type = raw[y * (stride + 1)], from = y * (stride + 1) + 1, to = y * stride;
    for (let i = 0; i < stride; i++) {
      const x = raw[from + i];
      const a = i >= bpp ? out[to + i - bpp] : 0;
      const b = y > 0 ? out[to - stride + i] : 0;
      const c = y > 0 && i >= bpp ? out[to - stride + i - bpp] : 0;
      out[to + i] = type === 0 ? x : type === 1 ? x + a : type === 2 ? x + b : type === 3 ? x + ((a + b) >> 1) : x + paeth(a, b, c);
    }
  }
  return out;
};

/** Minimaler PNG-Leser (8 Bit, nicht interlaced) -> ImageData-kompatibles Objekt. */
export const readPng = buffer => {
  if (buffer.readUInt32BE(0) !== 0x89504e47) throw new Error('Keine PNG-Datei');

  const chunks = [];
  let width = 0, height = 0, depth = 0, colorType = 0, palette, alpha;

  for (let pos = 8; pos + 8 <= buffer.length;) {
    const length = buffer.readUInt32BE(pos), type = buffer.toString('ascii', pos + 4, pos + 8);
    const data = buffer.subarray(pos + 8, pos + 8 + length);
    if (type === 'IHDR') [width, height, depth, colorType] = [data.readUInt32BE(0), data.readUInt32BE(4), data[8], data[9]];
    else if (type === 'PLTE') palette = data;
    else if (type === 'tRNS') alpha = data;
    else if (type === 'IDAT') chunks.push(data);
    else if (type === 'IEND') break;
    pos += length + 12;
  }

  if (depth !== 8) throw new Error(`Nur 8 Bit Farbtiefe unterstuetzt, gefunden: ${depth}`);

  const bpp = channels[colorType];
  const pixels = unfilter(inflateSync(Buffer.concat(chunks)), width, height, bpp);
  const data = new Uint8ClampedArray(width * height * 4);

  for (let i = 0, n = width * height; i < n; i++) {
    const from = i * bpp, to = i * 4;
    const [r, g, b, a] =
      colorType === 6 ? [pixels[from], pixels[from + 1], pixels[from + 2], pixels[from + 3]]
      : colorType === 2 ? [pixels[from], pixels[from + 1], pixels[from + 2], 255]
      : colorType === 0 ? [pixels[from], pixels[from], pixels[from], 255]
      : colorType === 4 ? [pixels[from], pixels[from], pixels[from], pixels[from + 1]]
      : [palette[pixels[from] * 3], palette[pixels[from] * 3 + 1], palette[pixels[from] * 3 + 2], alpha?.[pixels[from]] ?? 255];
    [data[to], data[to + 1], data[to + 2], data[to + 3]] = [r, g, b, a];
  }

  return { width, height, data };
};

const crcTable = [...Array(256).keys()].map(n => {
  for (let k = 0; k < 8; k++) n = n & 1 ? 0xedb88320 ^ (n >>> 1) : n >>> 1;
  return n >>> 0;
});

const crc32 = buffer => {
  let c = 0xffffffff;
  for (const b of buffer) c = crcTable[(c ^ b) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};

const chunk = (type, data) => {
  const length = Buffer.alloc(4), check = Buffer.alloc(4);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  length.writeUInt32BE(data.length);
  check.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, check]);
};

/** Schreibt ein Bild als RGBA-PNG (Filtertyp 0) - fuer Testdaten und OCR-Zwischenbilder. */
export const writePng = ({ width, height, data }) => {
  const stride = width * 4, raw = Buffer.alloc(height * (stride + 1));
  const source = Buffer.from(data.buffer, data.byteOffset, data.length);
  for (let y = 0; y < height; y++) source.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  [ihdr[8], ihdr[9]] = [8, 6];

  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0)),
  ]);
};
