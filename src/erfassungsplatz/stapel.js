import { isUnambiguous } from './wertungAnzeige.js';

export const createStapel = (wahllokal, soll, wahlHash) => {
  if (!wahllokal || !Number.isSafeInteger(soll) || soll < 1 || soll > 100) throw new Error('Wahllokal und Stapelgröße (1–100) angeben.');
  return { id: globalThis.crypto.randomUUID(), wahllokal, soll, wahlHash, zettel: [] };
};

export const addZettel = (stapel, result, bild) => {
  if (stapel.zettel.length >= stapel.soll) throw new Error('Stapel ist bereits vollständig.');
  if (!isUnambiguous(result)) throw new Error('Nur eindeutig erkannte Stimmzettel kommen auf den Stapel.');
  const zettel = {
    id: globalThis.crypto.randomUUID(),
    stimmen: result.stimmen.map(({ id, status, treffer }) => ({ id, status, wahlvorschlaege: [...treffer] })),
    ...(bild ? { bild } : {}),
  };
  return { ...stapel, zettel: [...stapel.zettel, zettel] };
};

export const saveStapel = (storage, stapel) => {
  if (stapel) storage.setItem('wahlassistent-stapel', JSON.stringify(stapel));
  else storage.removeItem('wahlassistent-stapel');
};
