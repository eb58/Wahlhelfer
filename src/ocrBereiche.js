/**
 * OCR-Bereiche aus der groben Rahmenlage. Die Ausschnitte bleiben in Originalaufloesung;
 * nur die weissen Zwischenraeume des Zettels werden aus dem OCR-Bild entfernt.
 */
import { toAbsolute, toRelative, frameWidth } from './frame.js';

const begrenze = (wert, minimum, maximum) => Math.max(minimum, Math.min(maximum, wert));

const markerPunkt = (kalibrierung, marke, image, frame) => frame
  ? toAbsolute(frame, toRelative(kalibrierung.frame, marke))
  : {
    x: marke.x / kalibrierung.referenz.breite * image.width,
    y: marke.y / kalibrierung.referenz.hoehe * image.height,
  };

export const berechneOcrBereiche = (kalibrierung, image, frame) => {
  const breite = Math.min(image.width, Math.max(240, Math.round((frame ? frameWidth(frame) : image.width) * 0.42)));
  const hoehe = Math.min(image.height, Math.max(96, Math.round(breite * 0.24)));
  return kalibrierung.textmarken.map(marke => {
    const punkt = markerPunkt(kalibrierung, marke, image, frame);
    return {
      left: begrenze(Math.round(punkt.x - breite / 2), 0, image.width - breite),
      top: begrenze(Math.round(punkt.y - hoehe / 2), 0, image.height - hoehe),
      width: breite,
      height: hoehe,
    };
  });
};
