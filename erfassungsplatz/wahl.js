/** Nur fachliche Angaben: Partei/Kandidat, Listenplatz und Stimmenart. */
export const getWahlDefinition = kalibrierung => ({
  name: kalibrierung.name,
  stimmen: kalibrierung.stimmen.map(stimme => ({
    id: stimme.id, name: stimme.name, auswahl: stimme.auswahl ?? 1,
    wahlvorschlaege: stimme.felder.map(({ id, nummer, beschriftung }) => ({ id, nummer, beschriftung }))
      .sort((a, b) => a.nummer - b.nummer || a.id.localeCompare(b.id)),
  })).sort((a, b) => a.id.localeCompare(b.id)),
});
