/**
 * OCR-Bereiche aus der groben Rahmenlage. Die Ausschnitte bleiben in Originalaufloesung;
 * nur die weissen Zwischenraeume des Zettels werden aus dem OCR-Bild entfernt.
 */
import { toAbsolute, toRelative, frameWidth, perspectivePoint } from './frame.js';

const clamp = (wert, minimum, maximum) => Math.max(minimum, Math.min(maximum, wert));

const markerPoint = (kalibrierung, marke, image, frame, perspectiveFrame) => perspectiveFrame
  ? perspectivePoint(perspectiveFrame, kalibrierung.frame, marke)
  : frame ? toAbsolute(frame, toRelative(kalibrierung.frame, marke))
  : {
    x: marke.x / kalibrierung.referenz.breite * image.width,
    y: marke.y / kalibrierung.referenz.hoehe * image.height,
  };

export const computeOcrRegions = (kalibrierung, image, frame, { perspectiveFrame } = {}) => {
  const breite = Math.min(image.width, Math.max(180, Math.round((frame ? frameWidth(frame) : image.width) * 0.18)));
  const hoehe = Math.min(image.height, Math.max(80, Math.round(breite * 0.3)));
  return kalibrierung.textmarken.map((marke, textmarke) => {
    const punkt = markerPoint(kalibrierung, marke, image, frame, perspectiveFrame);
    return {
      left: clamp(Math.round(punkt.x - breite / 2), 0, image.width - breite),
      top: clamp(Math.round(punkt.y - hoehe / 2), 0, image.height - hoehe),
      width: breite,
      height: hoehe,
      textmarke,
    };
  });
};
