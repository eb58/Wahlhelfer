/** Status eines Wahllokals - auf Erfassungsplatz und ControlCenter gleich benannt. */
export const getWahllokalStatus = ({ zettel, erwartet, prueffaelle }) => {
  if (erwartet === null) return 'Stimmzettelzahl noch nicht gemeldet';
  if (zettel > erwartet) return 'Über Soll – prüfen';
  if (!zettel) return 'Noch nicht begonnen';
  if (zettel < erwartet) return 'Erfassung läuft';
  return prueffaelle ? 'Erfasst – Prüffälle offen' : 'Erfasst';
};
