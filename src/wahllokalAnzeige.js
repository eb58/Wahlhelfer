export const getWahllokalStatus = ({ zettel, erwartet, prueffaelle }) => {
  if (zettel > erwartet) return 'Über Soll – prüfen';
  if (!zettel) return 'Noch nicht begonnen';
  if (zettel < erwartet) return 'Erfassung läuft';
  return prueffaelle ? 'Erfasst – Prüffälle offen' : 'Erfasst';
};

export const selectWahllokale = (wahllokale, nummer) => {
  if (nummer === null || nummer === undefined) return wahllokale;
  const lokal = wahllokale.find(lokal => lokal.nummer === nummer);
  if (!lokal) throw new Error(`Wahllokal ${nummer} ist nicht registriert.`);
  return [lokal];
};
