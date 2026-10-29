/** Wahllokal am Erfassungsplatz: kommt aus dem Link (?wahllokal=12518), ausgewaehlt wird nichts. */
export const getFortschritt = ({ zettel, erwartet, stapel, prueffaelle }) =>
  `${zettel}${erwartet === null ? ' Stimmzettel' : ` von ${erwartet} Stimmzetteln`} · ${stapel} Stapel · ${prueffaelle} Zettel mit Prüfbedarf`;

export const findWahllokal = (wahllokale, nummer) => {
  if (!nummer) throw new Error('Im Link fehlt das Wahllokal. Bitte den Link des Wahllokals öffnen (…/?wahllokal=12518).');
  const lokal = wahllokale.find(row => row.nummer === nummer);
  if (!lokal) throw new Error(`Wahllokal ${nummer} ist nicht registriert oder für dieses Konto nicht freigegeben.`);
  return lokal;
};
