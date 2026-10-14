import { loadBild } from '../src/serverApi.js';

export const showBeleg = async (zettel, stimmen) => {
  const blob = await loadBild(zettel.id);
  const url = URL.createObjectURL(blob);
  const dialog = document.createElement('dialog');
  dialog.className = 'beleg-dialog';
  const title = document.createElement('h2');
  title.textContent = `Stimmzettel ${zettel.id}`;
  const wertung = document.createElement('p');
  wertung.textContent = zettel.stimmen.map(stimme => {
    const definition = stimmen.find(item => item.id === stimme.id);
    const vorschlaege = stimme.wahlvorschlaege.map(id => definition?.wahlvorschlaege.find(item => item.id === id)?.beschriftung ?? id);
    return `${definition?.name ?? stimme.id}: ${vorschlaege.join(', ') || 'Keine Markierung'} (${stimme.status})`;
  }).join(' · ');
  const close = document.createElement('button');
  close.className = 'knopf';
  close.textContent = 'Beleg schließen';
  close.addEventListener('click', () => dialog.close());
  const image = document.createElement(blob.type === 'application/pdf' ? 'iframe' : 'img');
  image.src = url;
  if (blob.type === 'application/pdf') image.title = 'Originalbeleg';
  else image.alt = 'Gespeicherte Originalaufnahme des Stimmzettels';
  dialog.append(title, wertung, close, image);
  dialog.addEventListener('close', () => { URL.revokeObjectURL(url); dialog.remove(); }, { once: true });
  document.body.append(dialog);
  dialog.showModal();
};
