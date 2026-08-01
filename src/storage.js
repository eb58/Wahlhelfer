/**
 * Ablage des registrierten Wahlzetteltyps im Browser.
 * Nur der gelernte Typ wird gespeichert - niemals Aufnahmen oder Wertungen.
 */
import { fromJson } from './wahlzettelTyp.js';

export const STORAGE_KEY = 'wahlassistent.wahlzettelTyp';

export const storeTyp = (typ, storage = globalThis.localStorage) => storage.setItem(STORAGE_KEY, typ.toJson());

export const forgetTyp = (storage = globalThis.localStorage) => storage.removeItem(STORAGE_KEY);

/** @returns Erkenner oder undefined, wenn nichts (Brauchbares) gespeichert ist. */
export const loadTyp = (storage = globalThis.localStorage) => {
  const json = storage?.getItem(STORAGE_KEY);
  if (!json) return undefined;
  try {
    return fromJson(json);
  } catch {
    // Ein unlesbarer Eintrag darf die Anwendung nicht blockieren; neu registrieren hilft.
    storage.removeItem(STORAGE_KEY);
    return undefined;
  }
};
