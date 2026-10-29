import { isUnambiguous } from './wertungAnzeige.js';

export const createStapel = (wahllokal, soll, wahlHash) => {
  if (!wahllokal || !Number.isSafeInteger(soll) || soll < 1 || soll > 100) throw new Error('Wahllokal und Stapelgröße (1–100) angeben.');
  return { id: globalThis.crypto.randomUUID(), wahllokal, soll, wahlHash, zettel: [] };
};

export const isStapelIntakt = stapel =>
  !!stapel?.wahlHash && Array.isArray(stapel.zettel) && Number.isInteger(stapel.soll) && stapel.zettel.length <= stapel.soll;

/** Warum ein gespeicherter Stapel hier nicht weitergefuehrt werden kann - undefined, wenn er passt. */
export const getStapelKonflikt = (stapel, wahllokal, wahlHash) => {
  if (!isStapelIntakt(stapel)) return 'Der gespeicherte Stapel ist unvollständig oder beschädigt.';
  if (stapel.wahlHash !== wahlHash) return `Der begonnene Stapel (${stapel.zettel.length} Zettel) gehört zu einer anderen Wahl.`;
  if (stapel.wahllokal !== wahllokal)
    return `Der begonnene Stapel gehört zu Wahllokal ${stapel.wahllokal}. Bitte dessen Link öffnen und dort abschließen.`;
};

export const addZettel =(stapel, result, bild) => {
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
