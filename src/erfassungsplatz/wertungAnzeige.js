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

/** Nur ein eindeutig erkannter Zettel darf auf den Stapel: mindestens eine Stimme gueltig, die
 *  uebrigen gueltig oder sicher ohne Markierung. Ein ganz leerer Zettel sowie Mehrfach- und unklare
 *  Markierungen entscheidet der Wahlvorstand am Papierzettel. */
export const isUnambiguous = result =>
  result.stimmen.some(stimme => stimme.status === 'gueltig')
  && result.stimmen.every(stimme => ['gueltig', 'leer'].includes(stimme.status));

const feldName = (felder, id) => felder.find(f => f.id === id)?.beschriftung ?? id;

/** Eine Zeile je Stimme: Wertung plus die getroffenen Felder im Klartext. Die Stimmen
 *  stehen in der Kalibrierung - ein Zettel mit nur einer Stimme ist genauso moeglich. */
export const stimmRows = result =>
  result.stimmen.map(stimme => ({
    stimme: stimme.id,
    title: stimme.name,
    status: stimme.status,
    text: STIMM_TEXT[stimme.status],
    treffer: stimme.treffer.map(id => feldName(result.felder, id)),
  }));

/** Kurzfassung fuer die Statuszeile. */
export const summary = result =>
  isUnambiguous(result)
    ? stimmRows(result).map(row => `${row.title}: ${row.treffer[0] ?? row.text}`).join(' | ')
    : 'Zettel muss dem Wahlvorstand vorgelegt werden.';

/** Zeichnet die Feldlagen als Ringe auf einen 2D-Kontext - macht die Kalibrierung sichtbar. */
export const drawFelder = (context, result, { lineWidth = 3 } = {}) => {
  context.lineWidth = lineWidth;
  context.font = `${Math.max(10, result.radius)}px sans-serif`;
  context.textBaseline = 'middle';

  for (const feld of result.felder) {
    context.strokeStyle = COLORS[feld.status];
    context.beginPath();
    context.arc(feld.x, feld.y, result.radius * 1.35, 0, 2 * Math.PI);
    context.stroke();

    if (feld.status !== 'leer') {
      context.fillStyle = COLORS[feld.status];
      context.fillText(feld.id, feld.x + result.radius * 1.7, feld.y);
    }
  }
};
