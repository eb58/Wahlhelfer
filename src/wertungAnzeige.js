/**
 * Aufbereitung der Erkennung fuer die Anzeige - bewusst ohne DOM, damit pruefbar.
 * Die Wortwahl folgt der Konzeptstudie: die Software schlaegt vor, der Wahlvorstand entscheidet.
 */

export const COLORS = { angekreuzt: '#1f7a4d', unklar: '#c08a1e', leer: '#8b968d' };

const STIMM_TEXT = {
  gueltig: 'Stimme erkannt',
  mehrfach: 'Mehrfachmarkierung - Wahlvorstand entscheidet',
  zweifelsfall: 'Unklare Markierung - Wahlvorstand entscheidet',
  leer: 'Keine Markierung',
};

export const stimmName = stimme => (stimme === 'erststimme' ? 'Erststimme' : 'Zweitstimme');

/** Nur eine eindeutige Wertung darf ohne Rueckfrage weiterlaufen. */
export const istEindeutig = ergebnis => ergebnis.erststimme.status === 'gueltig' && ergebnis.zweitstimme.status === 'gueltig';

const feldName = (felder, id) => felder.find(f => f.id === id)?.beschriftung ?? id;

/** Eine Zeile je Stimme: Wertung plus die getroffenen Felder im Klartext. */
export const stimmZeilen = ergebnis =>
  ['erststimme', 'zweitstimme'].map(stimme => {
    const wertung = ergebnis[stimme];
    return {
      stimme,
      titel: stimmName(stimme),
      status: wertung.status,
      text: STIMM_TEXT[wertung.status],
      treffer: wertung.treffer.map(id => feldName(ergebnis.felder, id)),
    };
  });

/** Kurzfassung fuer die Statuszeile. */
export const summary = ergebnis =>
  istEindeutig(ergebnis)
    ? stimmZeilen(ergebnis).map(z => `${z.titel}: ${z.treffer[0]}`).join(' | ')
    : 'Zettel muss dem Wahlvorstand vorgelegt werden.';

/** Zeichnet die Feldlagen als Ringe auf einen 2D-Kontext - macht die Kalibrierung sichtbar. */
export const drawFelder = (context, ergebnis, { lineWidth = 3 } = {}) => {
  context.lineWidth = lineWidth;
  context.font = `${Math.max(10, ergebnis.radius)}px sans-serif`;
  context.textBaseline = 'middle';

  for (const feld of ergebnis.felder) {
    context.strokeStyle = COLORS[feld.status];
    context.beginPath();
    context.arc(feld.x, feld.y, ergebnis.radius * 1.35, 0, 2 * Math.PI);
    context.stroke();

    if (feld.status !== 'leer') {
      context.fillStyle = COLORS[feld.status];
      context.fillText(feld.id, feld.x + ergebnis.radius * 1.7, feld.y);
    }
  }
};
