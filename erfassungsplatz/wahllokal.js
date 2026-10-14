/** Wahllokal am Erfassungsplatz: Auswahl ueber ?wahllokal= und Text des Monitors. */
export const getFortschritt = ({ zettel, erwartet, stapel, prueffaelle }) =>
  `${zettel} von ${erwartet} Stimmzetteln · ${stapel} Stapel · ${prueffaelle} Zettel mit Prüfbedarf`;

export const selectWahllokale = (wahllokale, nummer) => {
  if (nummer === null || nummer === undefined) return wahllokale;
  const lokal = wahllokale.find(lokal => lokal.nummer === nummer);
  if (!lokal) throw new Error(`Wahllokal ${nummer} ist nicht registriert.`);
  return [lokal];
};
