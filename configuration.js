/**
 * Einstellung fuer den Einsatz: welche Wahl ausgezaehlt wird.
 *
 * Pro Wahl einmal setzen - im Wahllokal gibt es nichts auszuwaehlen. Je Wahl liegt unter `Wahlen/`
 * ein Ordner mit der Kalibrierung (von Hand am Musterzettel vermessen, mit
 * `python scripts/pruefeKalibrierung.py` sichtbar pruefbar) und dem Gebiet (Wahlkreise und
 * Wahlbezirke = Wahllokale).
 */
export const WAHL = './Wahlen/bundestagswahl-2017/';
export const KALIBRIERUNG = `${WAHL}kalibrierung.json`;
export const GEBIET = `${WAHL}gebiet.json`;
