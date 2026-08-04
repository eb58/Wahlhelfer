/**
 * OCR-Bereiche aus der groben Rahmenlage. Die Ausschnitte bleiben in Originalaufloesung;
 * nur die weissen Zwischenraeume des Zettels werden aus dem OCR-Bild entfernt.
 */
import { toAbsolute, toRelative, frameWidth, perspectivePoint } from './frame.js';

const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));

const markerPoint = (kalibrierung, mark, image, frame, perspectiveFrame) => perspectiveFrame
  ? perspectivePoint(perspectiveFrame, kalibrierung.frame, mark)
  : frame ? toAbsolute(frame, toRelative(kalibrierung.frame, mark))
  : {
    x: mark.x / kalibrierung.referenz.breite * image.width,
    y: mark.y / kalibrierung.referenz.hoehe * image.height,
  };

export const computeOcrRegions = (kalibrierung, image, frame, { perspectiveFrame } = {}) => {
  const boxWidth = Math.min(image.width, Math.max(180, Math.round((frame ? frameWidth(frame) : image.width) * 0.18)));
  const boxHeight = Math.min(image.height, Math.max(160, Math.round(boxWidth * 0.3)));
  return kalibrierung.textmarken.map((mark, textmarke) => {
    const point = markerPoint(kalibrierung, mark, image, frame, perspectiveFrame);
    return {
      left: clamp(Math.round(point.x - boxWidth / 2), 0, image.width - boxWidth),
      top: clamp(Math.round(point.y - boxHeight / 2), 0, image.height - boxHeight),
      width: boxWidth,
      height: boxHeight,
      textmarke,
    };
  });
};
